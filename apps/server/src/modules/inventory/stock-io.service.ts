import { randomBytes } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import {
  buildReversalLines, canTransition, getIoTypeMeta, IO_TYPE_META, resolveIoDirection, validateIoDocument,
  type IoDocStatus
} from '../../common/stock-io-engine'
import { AuditService } from '../audit/audit.service'
import { RevisionService } from '../revision/revision.service'
import {
  CreateStockIoAttachmentDto, CreateStockIoDto, PostStockIoDto, QueryStockIoDto, ReverseStockIoDto
} from './dto'
import { StockIoAttachmentEntity, StockIoDocumentEntity, StockIoLineEntity } from './entities/stock-io.entity'
import { InventoryService } from './inventory.service'

export interface StockIoDetail {
  doc: StockIoDocumentEntity
  lines: StockIoLineEntity[]
  attachments: StockIoAttachmentEntity[]
}

@Injectable()
export class StockIoService {
  constructor(
    @InjectRepository(StockIoDocumentEntity) private readonly docRepo: Repository<StockIoDocumentEntity>,
    @InjectRepository(StockIoLineEntity) private readonly lineRepo: Repository<StockIoLineEntity>,
    @InjectRepository(StockIoAttachmentEntity) private readonly attachmentRepo: Repository<StockIoAttachmentEntity>,
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
    private readonly revisionService: RevisionService
  ) {}

  /** 单据类型元数据 */
  types(): Array<{
    code: string
    label: string
    direction: string
    allowProvisional: boolean
    requireCost: boolean
    requireAttachment: boolean
  }> {
    return IO_TYPE_META.map((item) => ({
      code: item.code,
      label: item.label,
      direction: item.direction,
      allowProvisional: item.allowProvisional,
      requireCost: item.requireCost,
      requireAttachment: item.requireAttachment
    }))
  }

  async list(query: QueryStockIoDto, user: JwtUser): Promise<PageResult<StockIoDocumentEntity>> {
    const where: Record<string, unknown> = { tenantId: user.tenantId }
    if (query.ioType) where.ioType = query.ioType
    if (query.status) where.status = query.status
    if (query.warehouseId) where.warehouseId = query.warehouseId
    if (query.keyword) where.docNo = query.keyword
    const [list, total] = await this.docRepo.findAndCount({
      where: where as never,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async detail(id: number, user: JwtUser): Promise<StockIoDetail> {
    const doc = await this.findOwned(id, user)
    const lines = await this.lineRepo.find({ where: { tenantId: user.tenantId, docId: id }, order: { id: 'ASC' } })
    const attachments = await this.attachmentRepo.find({ where: { tenantId: user.tenantId, docId: id }, order: { id: 'ASC' } })
    return { doc, lines, attachments }
  }

  /** 新建草稿：按类型方向自动归集入库 / 出库数量 */
  async create(dto: CreateStockIoDto, user: JwtUser): Promise<StockIoDetail> {
    const meta = getIoTypeMeta(dto.ioType)
    if (!meta) throw new BadRequestException(`未知单据类型：${dto.ioType}`)
    const lines = dto.lines.map((line) => {
      const qtyIn = this.num(line.qtyIn)
      const qtyOut = this.num(line.qtyOut)
      const unitCost = this.num(line.unitCost)
      const qty = qtyIn > 0 ? qtyIn : qtyOut
      return {
        tenantId: user.tenantId,
        productId: line.productId,
        variantId: line.variantId ?? 0,
        locationId: line.locationId ?? 0,
        batchNo: line.batchNo ?? '',
        qtyIn: qtyIn.toFixed(3),
        qtyOut: qtyOut.toFixed(3),
        unitCost: unitCost.toFixed(4),
        amount: (qty * unitCost).toFixed(4),
        isProvisional: line.isProvisional ? 1 : 0,
        remark: line.remark ?? null
      }
    })
    const check = validateIoDocument({
      ioType: dto.ioType,
      status: 'DRAFT',
      lines: lines.map((line) => ({
        qtyIn: this.num(line.qtyIn),
        qtyOut: this.num(line.qtyOut),
        unitCost: this.num(line.unitCost),
        isProvisional: line.isProvisional === 1
      })),
      attachmentCount: 0,
      provisionalAmount: this.num(dto.provisionalAmount)
    }, { ignoreAttachment: true })
    if (!check.ok) throw new BadRequestException(check.reasons.join('；'))

    const direction = resolveIoDirection(meta, lines.map((line) => ({
      qtyIn: this.num(line.qtyIn),
      qtyOut: this.num(line.qtyOut)
    })))
    const doc = await this.docRepo.save(this.docRepo.create({
      tenantId: user.tenantId,
      docNo: await this.nextDocNo(user),
      ioType: dto.ioType,
      direction,
      sourceType: dto.sourceType ?? '',
      sourceId: dto.sourceId ?? 0,
      warehouseId: dto.warehouseId,
      status: 'DRAFT',
      provisionalAmount: this.num(dto.provisionalAmount).toFixed(4),
      costAmount: lines.reduce((sum, line) => sum + this.num(line.amount), 0).toFixed(4),
      reversalOfId: 0,
      reversalReason: null,
      docDate: dto.docDate ?? null,
      remark: dto.remark ?? null,
      createdBy: user.userId
    }))
    await this.lineRepo.save(lines.map((line) => this.lineRepo.create({ ...line, docId: doc.id })))
    await this.auditService.record({ bizType: 'stock_io', bizId: doc.id, action: 'CREATE_STOCK_IO', afterValue: doc }, user)
    return this.detail(doc.id, user)
  }

  /** 过账：按明细写入库存流水与结存 */
  async post(id: number, dto: PostStockIoDto, user: JwtUser): Promise<StockIoDetail> {
    const doc = await this.findOwned(id, user)
    const transition = canTransition(doc.status as IoDocStatus, 'POST')
    if (!transition.ok) throw new BadRequestException(transition.reason)
    const lines = await this.lineRepo.find({ where: { tenantId: user.tenantId, docId: id }, order: { id: 'ASC' } })
    const attachments = await this.attachmentRepo.count({ where: { tenantId: user.tenantId, docId: id } })
    const meta = getIoTypeMeta(doc.ioType)
    if (!meta) throw new BadRequestException(`未知单据类型：${doc.ioType}`)
    const check = validateIoDocument({
      ioType: doc.ioType,
      status: doc.status as IoDocStatus,
      lines: lines.map((line) => ({
        qtyIn: this.num(line.qtyIn),
        qtyOut: this.num(line.qtyOut),
        unitCost: this.num(line.unitCost),
        isProvisional: line.isProvisional === 1
      })),
      attachmentCount: attachments,
      provisionalAmount: this.num(doc.provisionalAmount)
    }, { ignoreDirection: doc.reversalOfId > 0, ignoreAttachment: doc.reversalOfId > 0 })
    if (!check.ok) throw new BadRequestException(check.reasons.join('；'))

    for (const line of lines) {
      await this.inventoryService.postMovement({
        voucherType: 'STOCK_IO',
        voucherId: doc.id,
        voucherLineId: line.id,
        warehouseId: doc.warehouseId,
        locationId: line.locationId,
        productId: line.productId,
        variantId: line.variantId,
        batchNo: line.batchNo,
        qtyIn: line.qtyIn,
        qtyOut: line.qtyOut,
        cost: line.unitCost,
        remark: doc.remark ?? undefined
      }, user)
    }

    doc.status = 'POSTED'
    doc.postedBy = user.userId
    doc.postedAt = new Date()
    doc.updatedAt = new Date()
    if (dto.remark) doc.remark = dto.remark
    await this.docRepo.save(doc)
    await this.auditService.record({
      bizType: 'stock_io', bizId: doc.id, action: 'POST_STOCK_IO',
      afterValue: { docNo: doc.docNo, ioType: doc.ioType, lines: lines.length }
    }, user)
    // 统一版本快照：出入库过账后留存版本，作为结存与追溯的依据
    await this.revisionService.recordSafe({
      entityCode: 'STOCK_IO_DOC',
      bizId: doc.id,
      action: 'POST',
      source: 'INVENTORY',
      snapshot: {
        docNo: doc.docNo,
        ioType: doc.ioType,
        status: doc.status,
        warehouseId: doc.warehouseId,
        provisionalAmount: doc.provisionalAmount ?? null,
        remark: doc.remark ?? null,
        lines: lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId ?? null,
          locationId: line.locationId ?? null,
          batchNo: line.batchNo ?? null,
          qtyIn: line.qtyIn,
          qtyOut: line.qtyOut,
          unitCost: line.unitCost
        }))
      }
    }, user)
    return this.detail(doc.id, user)
  }

  /** 冲销：生成方向相反的冲销单并过账，原单置为已冲销 */
  async reverse(id: number, dto: ReverseStockIoDto, user: JwtUser): Promise<StockIoDetail> {
    const doc = await this.findOwned(id, user)
    const transition = canTransition(doc.status as IoDocStatus, 'REVERSE')
    if (!transition.ok) throw new BadRequestException(transition.reason)
    const lines = await this.lineRepo.find({ where: { tenantId: user.tenantId, docId: id }, order: { id: 'ASC' } })
    if (lines.length === 0) throw new BadRequestException('单据无明细，不可冲销')
    const reversed = buildReversalLines(lines.map((line) => ({
      qtyIn: this.num(line.qtyIn),
      qtyOut: this.num(line.qtyOut),
      unitCost: this.num(line.unitCost),
      isProvisional: line.isProvisional === 1
    })))
    const reversalDoc = await this.docRepo.save(this.docRepo.create({
      tenantId: user.tenantId,
      docNo: await this.nextDocNo(user),
      ioType: doc.ioType,
      direction: doc.direction === 'IN' ? 'OUT' : 'IN',
      sourceType: 'STOCK_IO_REVERSAL',
      sourceId: doc.id,
      warehouseId: doc.warehouseId,
      status: 'DRAFT',
      provisionalAmount: '0',
      costAmount: doc.costAmount,
      reversalOfId: doc.id,
      reversalReason: dto.reason,
      docDate: doc.docDate,
      remark: `冲销单据 ${doc.docNo}`,
      createdBy: user.userId
    }))
    await this.lineRepo.save(reversed.map((line, index) => this.lineRepo.create({
      tenantId: user.tenantId,
      docId: reversalDoc.id,
      productId: lines[index].productId,
      variantId: lines[index].variantId,
      locationId: lines[index].locationId,
      batchNo: lines[index].batchNo,
      qtyIn: this.num(line.qtyIn).toFixed(3),
      qtyOut: this.num(line.qtyOut).toFixed(3),
      unitCost: this.num(line.unitCost).toFixed(4),
      amount: (this.num(line.qtyIn) + this.num(line.qtyOut)) * this.num(line.unitCost) > 0
        ? ((this.num(line.qtyIn) + this.num(line.qtyOut)) * this.num(line.unitCost)).toFixed(4)
        : '0',
      isProvisional: 0,
      remark: dto.reason
    })))
    const posted = await this.post(reversalDoc.id, { remark: `冲销 ${doc.docNo}` }, user)
    doc.status = 'REVERSED'
    doc.reversedBy = user.userId
    doc.reversedAt = new Date()
    doc.reversalReason = dto.reason
    doc.updatedAt = new Date()
    await this.docRepo.save(doc)
    await this.auditService.record({
      bizType: 'stock_io', bizId: doc.id, action: 'REVERSE_STOCK_IO',
      beforeValue: { status: 'POSTED' }, afterValue: { status: 'REVERSED', reason: dto.reason, reversalDocNo: posted.doc.docNo }
    }, user)
    return this.detail(doc.id, user)
  }

  async addAttachment(id: number, dto: CreateStockIoAttachmentDto, user: JwtUser): Promise<StockIoAttachmentEntity> {
    const doc = await this.findOwned(id, user)
    if (doc.status !== 'DRAFT') throw new BadRequestException('仅草稿状态单据可维护附件')
    const saved = await this.attachmentRepo.save(this.attachmentRepo.create({
      tenantId: user.tenantId,
      docId: id,
      fileName: dto.fileName,
      fileUrl: dto.fileUrl ?? '',
      fileSize: dto.fileSize ?? 0,
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'stock_io', bizId: id, action: 'ATTACH_STOCK_IO', afterValue: saved }, user)
    return saved
  }

  async removeAttachment(id: number, attachmentId: number, user: JwtUser): Promise<void> {
    const doc = await this.findOwned(id, user)
    if (doc.status !== 'DRAFT') throw new BadRequestException('仅草稿状态单据可维护附件')
    const attachment = await this.attachmentRepo.findOne({ where: { id: attachmentId, tenantId: user.tenantId, docId: id } })
    if (!attachment) throw new NotFoundException('附件不存在')
    await this.attachmentRepo.remove(attachment)
    await this.auditService.record({ bizType: 'stock_io', bizId: id, action: 'DETACH_STOCK_IO', beforeValue: attachment }, user)
  }

  private async findOwned(id: number, user: JwtUser): Promise<StockIoDocumentEntity> {
    const doc = await this.docRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!doc) throw new NotFoundException('出入库单不存在')
    return doc
  }

  /** 单据号：日期 + 随机序列，冲突重试 */
  private async nextDocNo(user: JwtUser): Promise<string> {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    for (let attempt = 0; attempt < 5; attempt++) {
      const suffix = randomBytes(3).toString('hex').toUpperCase()
      const docNo = `IO${day}${suffix}`
      const exists = await this.docRepo.findOne({ where: { tenantId: user.tenantId, docNo } })
      if (!exists) return docNo
    }
    throw new BadRequestException('单据号生成失败，请重试')
  }

  private num(value: string | number | null | undefined): number {
    if (value === null || value === undefined || value === '') return 0
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
}
