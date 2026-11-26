import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import PDFDocument from 'pdfkit'
import { InjectRepository } from '@nestjs/typeorm'
import type { Redis } from 'ioredis'
import { FindOptionsWhere, In, Like, Repository } from 'typeorm'
import { PRINT_CHANNEL, buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { scopeWhere } from '../../common/data-scope-context'
import { renderPrintFields, validatePrintTemplate, type PrintTemplateSchema } from '../../common/print-template-engine'
import { evaluateDuplicatePrint } from '../../common/platform-guard-engine'
import {
  buildCycleKey, buildSerial, detectDuplicateSerials, evaluateBarcodeRule, evaluateLabelPrintRepeat
} from '../../common/barcode-engine'
import { env } from '../../config/env'
import { AuditService } from '../audit/audit.service'
import {
  BatchCreateLabelDto,
  CreateBarcodeRuleDto,
  CreatePrintJobDto,
  CreatePrintLabelDto,
  CreatePrintTemplateDto,
  QueryLabelInstanceDto,
  QueryPrintJobDto,
  QueryPrintRecordDto,
  QueryPrintTemplateDto,
  UpdateBarcodeRuleDto,
  UpdatePrintTemplateDto
} from './dto'
import { PrintJobEntity } from './entities/print-job.entity'
import { PrintLabelTemplateEntity } from './entities/print-label-template.entity'
import { PrintLabelInstanceEntity, PrintBarcodeRuleEntity } from './entities/print-label-instance.entity'
import { PrintRecordEntity } from './entities/print-record.entity'
import { PrintTemplateEntity } from './entities/print-template.entity'
import { StockIoDocumentEntity, StockIoLineEntity } from '../inventory/entities/stock-io.entity'
import { SaleOrderEntity, SaleOrderLineEntity } from '../sales/entities/sales.entities'
import { PurchaseOrderEntity, PurchaseOrderLineEntity } from '../purchase/entities/purchase.entities'
import { CustomFieldService } from '../customization/custom-field.service'
import { CUSTOM_ENTITY_BY_BIZ_TYPE, CUSTOM_VALUE_KEY_PREFIX } from '../../common/custom-field-engine'

/** 打印模板可用字段（业务维度） */
export interface PrintFieldItem {
  key: string
  label: string
  group: 'common' | 'biz' | 'custom'
  type?: string
  options?: string[]
}

/** 各业务单据的字段目录，模板中以 {{key}} 引用 */
const PRINT_BIZ_FIELDS: Record<string, PrintFieldItem[]> = {
  stock_io: [
    { key: 'docNo', label: '单据号', group: 'biz' },
    { key: 'ioType', label: '出入库类型', group: 'biz' },
    { key: 'direction', label: '方向', group: 'biz' },
    { key: 'warehouseId', label: '仓库', group: 'biz' },
    { key: 'docDate', label: '单据日期', group: 'biz' },
    { key: 'costAmount', label: '成本金额', group: 'biz' },
    { key: 'provisionalAmount', label: '暂估金额', group: 'biz' }
  ],
  sale_order: [
    { key: 'orderNo', label: '订单号', group: 'biz' },
    { key: 'customerId', label: '客户', group: 'biz' },
    { key: 'warehouseId', label: '仓库', group: 'biz' },
    { key: 'orderDate', label: '下单日期', group: 'biz' },
    { key: 'payStatus', label: '付款状态', group: 'biz' },
    { key: 'shipStatus', label: '发货状态', group: 'biz' },
    { key: 'totalAmount', label: '订单总额', group: 'biz' },
    { key: 'paidAmount', label: '已付金额', group: 'biz' }
  ],
  purchase_order: [
    { key: 'orderNo', label: '采购单号', group: 'biz' },
    { key: 'supplierId', label: '供应商', group: 'biz' },
    { key: 'warehouseId', label: '仓库', group: 'biz' },
    { key: 'orderDate', label: '下单日期', group: 'biz' },
    { key: 'payStatus', label: '付款状态', group: 'biz' },
    { key: 'totalAmount', label: '订单总额', group: 'biz' },
    { key: 'expectedDate', label: '期望到货日', group: 'biz' }
  ],
  goods_receipt: [
    { key: 'receiptNo', label: '收货单号', group: 'biz' },
    { key: 'supplierId', label: '供应商', group: 'biz' },
    { key: 'status', label: '状态', group: 'biz' }
  ]
}

@Injectable()
export class PrintService {
  constructor(
    @InjectRepository(PrintTemplateEntity) private readonly templateRepo: Repository<PrintTemplateEntity>,
    @InjectRepository(PrintRecordEntity) private readonly recordRepo: Repository<PrintRecordEntity>,
    @InjectRepository(PrintJobEntity) private readonly jobRepo: Repository<PrintJobEntity>,
    @InjectRepository(PrintLabelTemplateEntity) private readonly labelRepo: Repository<PrintLabelTemplateEntity>,
    @InjectRepository(PrintLabelInstanceEntity) private readonly labelInstanceRepo: Repository<PrintLabelInstanceEntity>,
    @InjectRepository(StockIoDocumentEntity) private readonly stockIoDocRepo: Repository<StockIoDocumentEntity>,
    @InjectRepository(StockIoLineEntity) private readonly stockIoLineRepo: Repository<StockIoLineEntity>,
    @InjectRepository(PrintBarcodeRuleEntity) private readonly barcodeRuleRepo: Repository<PrintBarcodeRuleEntity>,
    @InjectRepository(SaleOrderEntity) private readonly saleOrderRepo: Repository<SaleOrderEntity>,
    @InjectRepository(SaleOrderLineEntity) private readonly saleOrderLineRepo: Repository<SaleOrderLineEntity>,
    @InjectRepository(PurchaseOrderEntity) private readonly purchaseOrderRepo: Repository<PurchaseOrderEntity>,
    @InjectRepository(PurchaseOrderLineEntity) private readonly purchaseOrderLineRepo: Repository<PurchaseOrderLineEntity>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly auditService: AuditService,
    private readonly customFieldService: CustomFieldService
  ) {}

  async listTemplates(query: QueryPrintTemplateDto, user: JwtUser): Promise<PageResult<PrintTemplateEntity>> {
    const where: FindOptionsWhere<PrintTemplateEntity> = { tenantId: user.tenantId, isDeleted: 0 }
    if (query.bizType) {
      where.bizType = query.bizType
    }
    if (query.keyword) {
      where.name = Like(`%${query.keyword}%`)
    }
    const [list, total] = await this.templateRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createTemplate(dto: CreatePrintTemplateDto, user: JwtUser): Promise<PrintTemplateEntity> {
    const existing = await this.templateRepo.findOne({
      where: { tenantId: user.tenantId, code: dto.code, isDeleted: 0 }
    })
    if (existing) {
      throw new ConflictException('模板编码已存在')
    }
    const entity = this.templateRepo.create({
      ...dto,
      tenantId: user.tenantId,
      paper: dto.paper ?? 'A4',
      schema: dto.schema ?? {},
      createdBy: user.userId
    })
    const saved = await this.templateRepo.save(entity)
    await this.auditService.record({ bizType: 'print_template', bizId: saved.id, action: 'CREATE_TEMPLATE', afterValue: saved }, user)
    return saved
  }

  async updateTemplate(id: number, dto: UpdatePrintTemplateDto, user: JwtUser): Promise<PrintTemplateEntity> {
    const entity = await this.findTemplate(id, user)
    const before = { ...entity }
    if (dto.isActive !== undefined) {
      entity.isActive = dto.isActive === 'YES' ? 1 : 0
    }
    if (dto.isDefault !== undefined) {
      entity.isDefault = dto.isDefault === 'YES' ? 1 : 0
    }
    const { isActive: _isActive, isDefault: _isDefault, ...rest } = dto
    void _isActive
    void _isDefault
    Object.assign(entity, rest)
    entity.version += 1
    entity.updatedAt = new Date()
    const saved = await this.templateRepo.save(entity)
    await this.auditService.record({ bizType: 'print_template', bizId: id, action: 'UPDATE_TEMPLATE', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  /** 模板发布：校验循环区、字段绑定、LOGO 与码图配置后启用当前版本 */
  async publishTemplate(id: number, user: JwtUser): Promise<PrintTemplateEntity> {
    const entity = await this.findTemplate(id, user)
    const validation = validatePrintTemplate((entity.schema ?? {}) as PrintTemplateSchema)
    if (!validation.valid) throw new BadRequestException(`模板发布校验失败：${validation.errors.join('；')}`)
    const siblings = await this.templateRepo.find({ where: { tenantId: user.tenantId, code: entity.code } })
    for (const item of siblings) {
      if (item.id === id) continue
      item.isActive = 0
      await this.templateRepo.save(item)
    }
    entity.isActive = 1
    entity.updatedAt = new Date()
    const saved = await this.templateRepo.save(entity)
    await this.auditService.record({ bizType: 'print_template', bizId: id, action: 'PUBLISH_TEMPLATE', afterValue: { code: saved.code, version: saved.version, schema: saved.schema } }, user)
    return saved
  }

  async copyTemplate(id: number, user: JwtUser): Promise<PrintTemplateEntity> {
    const source = await this.findTemplate(id, user)
    const entity = this.templateRepo.create({
      tenantId: user.tenantId,
      code: `${source.code.slice(0, 48)}_COPY${Date.now()}`,
      name: `${source.name} 副本`,
      bizType: source.bizType,
      paper: source.paper,
      schema: source.schema,
      version: 1,
      isDefault: 0,
      isActive: 0,
      createdBy: user.userId
    })
    const saved = await this.templateRepo.save(entity)
    await this.auditService.record({ bizType: 'print_template', bizId: saved.id, action: 'COPY_TEMPLATE', afterValue: { sourceId: id, code: saved.code } }, user)
    return saved
  }

  async removeTemplate(id: number, user: JwtUser): Promise<void> {
    const entity = await this.findTemplate(id, user)
    entity.isDeleted = 1
    await this.templateRepo.save(entity)
    await this.auditService.record({ bizType: 'print_template', bizId: id, action: 'DELETE_TEMPLATE', beforeValue: entity }, user)
  }

  async previewTemplate(id: number, user: JwtUser): Promise<PrintTemplateEntity> {
    return this.findTemplate(id, user)
  }

  async createJob(dto: CreatePrintJobDto, user: JwtUser): Promise<PrintRecordEntity> {
    const template = await this.resolveTemplate(dto, user)
    if (!template) {
      throw new BadRequestException('未找到可用打印模板')
    }
    const watermark = `tenant-${user.tenantId}-user-${user.userId}-${Date.now()}`
    const duplicateWarning = await this.duplicateWarning(user.tenantId, dto.bizType, dto.bizId)
    const entity = this.recordRepo.create({
      tenantId: user.tenantId,
      bizType: dto.bizType,
      bizId: dto.bizId,
      bizNo: dto.bizNo ?? null,
      templateId: template.id,
      templateCode: template.code,
      copies: dto.copies ?? 1,
      channel: dto.channel ?? PRINT_CHANNEL.SERVER_PDF,
      printedBy: user.userId,
      pdfUrl: null,
      watermark,
      duplicateWarning
    })
    const saved = await this.recordRepo.save(entity)
    saved.pdfUrl = entity.channel === PRINT_CHANNEL.SILENT ? null : `/api/v1/print/records/${saved.id}/pdf`
    await this.recordRepo.save(saved)
    await this.jobRepo.save(this.jobRepo.create({
      tenantId: user.tenantId,
      jobNo: this.jobNo(),
      bizType: dto.bizType,
      bizId: dto.bizId,
      templateId: template.id,
      copies: dto.copies ?? 1,
      channel: dto.channel ?? PRINT_CHANNEL.SERVER_PDF,
      status: 'DONE',
      recordId: saved.id,
      createdBy: user.userId,
      finishedAt: new Date()
    }))
    await this.auditService.record({ bizType: 'print_job', bizId: saved.id, action: 'CREATE_PRINT_JOB', afterValue: saved }, user)
    return saved
  }

  /** 静默打印：以 SILENT 通道创建任务，由本地打印客户端拉取执行 */
  async createSilentJob(dto: CreatePrintJobDto, user: JwtUser): Promise<PrintRecordEntity> {
    const record = await this.createJob({ ...dto, channel: PRINT_CHANNEL.SILENT }, user)
    await this.auditService.record({
      bizType: 'print_record',
      bizId: record.id,
      action: 'CREATE_SILENT_PRINT_JOB',
      afterValue: { bizType: dto.bizType, bizId: dto.bizId, channel: PRINT_CHANNEL.SILENT }
    }, user)
    return record
  }

  async listJobs(query: QueryPrintJobDto, user: JwtUser): Promise<PageResult<PrintJobEntity>> {
    const where = scopeWhere<PrintJobEntity>({ tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.jobRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async retryJob(id: number, user: JwtUser): Promise<PrintJobEntity> {
    const job = await this.jobRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!job) throw new NotFoundException('打印任务不存在')
    job.status = 'PENDING'
    job.errorText = null
    job.finishedAt = null
    const saved = await this.jobRepo.save(job)
    await this.auditService.record({ bizType: 'print_job', bizId: id, action: 'RETRY_JOB' }, user)
    return saved
  }

  /** 批量打印：逐单生成打印记录与任务，单条失败不影响其余 */
  async batchPrint(items: CreatePrintJobDto[], user: JwtUser): Promise<{ total: number; success: number; failed: Array<{ bizId: number; reason: string }> }> {
    const failed: Array<{ bizId: number; reason: string }> = []
    let success = 0
    for (const item of items) {
      try { await this.createJob(item, user); success++ }
      catch (cause) { failed.push({ bizId: item.bizId, reason: cause instanceof Error ? cause.message : String(cause) }) }
    }
    await this.auditService.record({ bizType: 'print_job', bizId: 0, action: 'BATCH_PRINT', afterValue: { total: items.length, success, failed: failed.length } }, user)
    return { total: items.length, success, failed }
  }

  /** 补打：基于原记录生成新记录（独立水印与审计），需 print:record:reprint 权限（controller 控制） */
  async reprint(recordId: number, user: JwtUser): Promise<PrintRecordEntity> {
    const original = await this.recordRepo.findOne({ where: { id: recordId, tenantId: user.tenantId } })
    if (!original) throw new NotFoundException('打印记录不存在')
    const watermark = `reprint-${recordId}-tenant-${user.tenantId}-user-${user.userId}-${Date.now()}`
    const entity = this.recordRepo.create({
      tenantId: user.tenantId,
      bizType: original.bizType,
      bizId: original.bizId,
      bizNo: original.bizNo,
      templateId: original.templateId,
      templateCode: original.templateCode,
      copies: original.copies,
      channel: original.channel,
      printedBy: user.userId,
      pdfUrl: null,
      watermark,
      reprintOf: original.id
    })
    const saved = await this.recordRepo.save(entity)
    saved.pdfUrl = `/api/v1/print/records/${saved.id}/pdf`
    await this.recordRepo.save(saved)
    await this.auditService.record({ bizType: 'print_record', bizId: saved.id, action: 'REPRINT', afterValue: { reprintOf: recordId } }, user)
    return saved
  }

  /** 模板版本回滚：把指定历史版本设为启用，其余停用 */
  async rollbackTemplate(id: number, user: JwtUser): Promise<PrintTemplateEntity> {
    const template = await this.findTemplate(id, user)
    const siblings = await this.templateRepo.find({ where: { tenantId: user.tenantId, code: template.code } })
    for (const item of siblings) {
      item.isActive = item.id === id ? 1 : 0
      await this.templateRepo.save(item)
    }
    const saved = await this.templateRepo.save(template)
    await this.auditService.record({ bizType: 'print_template', bizId: id, action: 'ROLLBACK_TEMPLATE', afterValue: { code: template.code, version: template.version } }, user)
    return saved
  }

  /** 模板版本时间线 */
  async templateVersions(code: string, user: JwtUser): Promise<PrintTemplateEntity[]> {
    return this.templateRepo.find({ where: { tenantId: user.tenantId, code }, order: { version: 'DESC' } })
  }

  async listLabels(query: QueryPrintRecordDto, user: JwtUser): Promise<PageResult<PrintLabelTemplateEntity>> {
    const [list, total] = await this.labelRepo.findAndCount({
      where: { tenantId: user.tenantId, isDeleted: 0 },
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createLabel(dto: CreatePrintLabelDto, user: JwtUser): Promise<PrintLabelTemplateEntity> {
    const existing = await this.labelRepo.findOne({ where: { tenantId: user.tenantId, labelCode: dto.labelCode, isDeleted: 0 } })
    if (existing) throw new ConflictException('标签模板编码已存在')
    const entity = this.labelRepo.create({
      ...dto,
      tenantId: user.tenantId,
      barcodeType: dto.barcodeType ?? 'CODE128',
      paperSize: dto.paperSize ?? '50x30',
      schema: dto.schema ?? {}
    })
    const saved = await this.labelRepo.save(entity)
    await this.auditService.record({ bizType: 'print_label', bizId: saved.id, action: 'CREATE_LABEL', afterValue: saved }, user)
    return saved
  }

  private jobNo(): string {
    return `JOB${`${Date.now().toString(36)}${randomBytes(2).toString('hex')}`.toUpperCase()}`
  }

  /** 重复打印提示：同一单据短时间内已打印过则记录提示，不阻断打印 */
  private async duplicateWarning(tenantId: number, bizType: string, bizId: number): Promise<string | null> {
    const records = await this.recordRepo.find({
      where: { tenantId, bizType, bizId, isDeleted: 0 },
      order: { printedAt: 'DESC' },
      take: 20
    })
    const judgement = evaluateDuplicatePrint(
      records.map((item) => ({ bizType: item.bizType, bizId: item.bizId, printedAt: item.printedAt })),
      bizType,
      bizId,
      30,
      new Date()
    )
    return judgement.duplicated ? judgement.message : null
  }

  async listRecords(query: QueryPrintRecordDto, user: JwtUser): Promise<PageResult<PrintRecordEntity>> {
    const where: FindOptionsWhere<PrintRecordEntity> = scopeWhere<PrintRecordEntity>({ tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'printedBy' })
    if (query.bizType) {
      where.bizType = query.bizType
    }
    if (query.keyword) {
      where.bizNo = Like(`%${query.keyword}%`)
    }
    const [list, total] = await this.recordRepo.findAndCount({
      where,
      order: { printedAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async renderRecordPdf(id: number, user: JwtUser): Promise<Buffer> {
    const record = await this.recordRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!record) throw new NotFoundException('打印记录不存在')
    const template = await this.templateRepo.findOne({ where: { id: record.templateId, tenantId: user.tenantId } })
    const fontPath = env.pdf.fontPath && existsSync(env.pdf.fontPath) ? env.pdf.fontPath : null
    const title = this.pdfText(template?.name ?? 'Print Record', Boolean(fontPath))

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: template?.paper === 'A5' ? 'A5' : 'A4',
        margin: 48
      })
      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)
      if (fontPath) doc.font(fontPath)
      else doc.font('Helvetica')
      doc.fontSize(20).text(title).moveDown(1)
      doc.fontSize(11)
      doc.text(`${this.pdfText('Business Type', Boolean(fontPath))}: ${this.pdfText(record.bizType, Boolean(fontPath))}`)
      doc.text(`${this.pdfText('Business No', Boolean(fontPath))}: ${this.pdfText(record.bizNo ?? '-', Boolean(fontPath))}`)
      doc.text(`${this.pdfText('Template', Boolean(fontPath))}: ${this.pdfText(record.templateCode, Boolean(fontPath))} v${template?.version ?? 1}`)
      doc.text(`${this.pdfText('Copies', Boolean(fontPath))}: ${record.copies}`)
      doc.text(`${this.pdfText('Printed By', Boolean(fontPath))}: ${record.printedBy}`)
      doc.text(`${this.pdfText('Printed At', Boolean(fontPath))}: ${record.printedAt.toISOString()}`)
      doc.moveDown(1)
      doc.fontSize(9).fillColor('#888888')
      doc.text(this.pdfText(record.watermark ?? '', Boolean(fontPath)))
      doc.end()
    })
  }

  private pdfText(value: string, chineseFont: boolean): string {
    if (chineseFont) return value
    return String(value).replace(/[^\x20-\x7E]/g, '?')
  }

  async renderRecordHtml(id: number, user: JwtUser): Promise<string> {
    const record = await this.recordRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!record) throw new NotFoundException('打印记录不存在')
    const template = await this.templateRepo.findOne({ where: { id: record.templateId, tenantId: user.tenantId } })
    const schema = (template?.schema ?? {}) as Record<string, unknown>
    const values: Record<string, string> = {
      'order.order_no': record.bizNo ?? '',
      'order.biz_type': record.bizType,
      'order.biz_id': String(record.bizId),
      'order.copies': String(record.copies),
      'order.printed_by': String(record.printedBy),
      'order.printed_at': record.printedAt.toISOString(),
      'order.watermark': record.watermark ?? ''
    }
    let body = typeof schema.body === 'string'
      ? schema.body
      : `<h1>${template?.name ?? '打印单据'}</h1><p>业务单号：{{order.order_no}}</p><p>业务类型：{{order.biz_type}}</p><p>份数：{{order.copies}}</p><p>打印人：{{order.printed_by}}</p><p>时间：{{order.printed_at}}</p>`
    const safeValues = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, this.escapeHtml(value)]))
    const bizData = await this.resolveBizData(record.bizType, record.bizId, user.tenantId)
    // 自定义字段：模板中可用 {{custom.字段标识}} 直接引用该单据的自定义字段取值
    const customValues = await this.resolveCustomValues(record.bizType, record.bizId, user)
    body = renderPrintFields(body, schema as PrintTemplateSchema, { ...safeValues, ...bizData, ...customValues })
    const paper = template?.paper ?? 'A4'
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${this.escapeHtml(template?.name ?? '打印单据')}</title><style>@page{size:${this.escapeHtml(paper)};margin:12mm}body{font-family:"Microsoft YaHei",Arial,sans-serif;color:#111}h1{font-size:22px}.watermark{position:fixed;right:12px;bottom:12px;color:#999;font-size:11px}@media print{.no-print{display:none}}</style></head><body><div class="no-print"><button onclick="window.print()">打印 / 导出 PDF</button></div>${body}<div class="watermark">${this.escapeHtml(record.watermark ?? '')}</div></body></html>`
  }

  /** 解析业务单据数据，供打印模板渲染（当前支持出入库单） */
  private async resolveBizData(bizType: string, bizId: number, tenantId: number): Promise<Record<string, unknown>> {
    if (bizType === 'sale_order') return this.resolveSaleOrderData(bizId, tenantId)
    if (bizType === 'purchase_order') return this.resolvePurchaseOrderData(bizId, tenantId)
    if (bizType !== 'stock_io') return {}
    const doc = await this.stockIoDocRepo.findOne({ where: { id: bizId, tenantId } })
    if (!doc) return {}
    const lines = await this.stockIoLineRepo.find({ where: { docId: bizId, tenantId }, order: { id: 'ASC' } })
    return {
      docNo: this.escapeHtml(doc.docNo),
      ioType: this.escapeHtml(doc.ioType),
      status: this.escapeHtml(doc.status),
      direction: this.escapeHtml(doc.direction),
      warehouseId: this.escapeHtml(String(doc.warehouseId)),
      docDate: this.escapeHtml(doc.docDate ?? ''),
      costAmount: this.escapeHtml(String(doc.costAmount)),
      provisionalAmount: this.escapeHtml(String(doc.provisionalAmount)),
      remark: this.escapeHtml(doc.remark ?? ''),
      lines: lines.map((line) => ({
        productId: this.escapeHtml(String(line.productId)),
        batchNo: this.escapeHtml(line.batchNo ?? ''),
        qtyIn: this.escapeHtml(String(line.qtyIn)),
        qtyOut: this.escapeHtml(String(line.qtyOut)),
        unitCost: this.escapeHtml(String(line.unitCost)),
        amount: this.escapeHtml(String(line.amount))
      }))
    }
  }

  /** 销售订单打印数据 */
  private async resolveSaleOrderData(bizId: number, tenantId: number): Promise<Record<string, unknown>> {
    const order = await this.saleOrderRepo.findOne({ where: { id: bizId, tenantId, isDeleted: 0 } })
    if (!order) return {}
    const lines = await this.saleOrderLineRepo.find({ where: { orderId: bizId, tenantId }, order: { id: 'ASC' } })
    return {
      docNo: this.escapeHtml(order.orderNo),
      orderNo: this.escapeHtml(order.orderNo),
      customerId: this.escapeHtml(String(order.customerId)),
      warehouseId: this.escapeHtml(String(order.warehouseId ?? '')),
      orderDate: this.escapeHtml(order.orderDate ?? ''),
      status: this.escapeHtml(order.status),
      payStatus: this.escapeHtml(order.payStatus),
      shipStatus: this.escapeHtml(order.shipStatus),
      totalAmount: this.escapeHtml(String(order.totalAmount)),
      paidAmount: this.escapeHtml(String(order.paidAmount)),
      remark: this.escapeHtml(order.remark ?? ''),
      lines: lines.map((line) => ({
        productId: this.escapeHtml(String(line.productId)),
        qty: this.escapeHtml(String(line.qty)),
        unitPrice: this.escapeHtml(String(line.unitPrice)),
        discount: this.escapeHtml(String(line.discount)),
        amount: this.escapeHtml(String(line.amount)),
        shippedQty: this.escapeHtml(String(line.shippedQty))
      }))
    }
  }

  /** 采购订单打印数据 */
  private async resolvePurchaseOrderData(bizId: number, tenantId: number): Promise<Record<string, unknown>> {
    const order = await this.purchaseOrderRepo.findOne({ where: { id: bizId, tenantId, isDeleted: 0 } })
    if (!order) return {}
    const lines = await this.purchaseOrderLineRepo.find({ where: { orderId: bizId, tenantId }, order: { id: 'ASC' } })
    return {
      docNo: this.escapeHtml(order.orderNo),
      orderNo: this.escapeHtml(order.orderNo),
      supplierId: this.escapeHtml(String(order.supplierId)),
      warehouseId: this.escapeHtml(String(order.warehouseId ?? '')),
      orderDate: this.escapeHtml(order.orderDate ?? ''),
      status: this.escapeHtml(order.status),
      payStatus: this.escapeHtml(order.payStatus),
      totalAmount: this.escapeHtml(String(order.totalAmount)),
      expectedDate: this.escapeHtml(order.expectedDate ?? ''),
      remark: this.escapeHtml(order.remark ?? ''),
      lines: lines.map((line) => ({
        productId: this.escapeHtml(String(line.productId)),
        qty: this.escapeHtml(String(line.qty)),
        unitPrice: this.escapeHtml(String(line.unitPrice)),
        amount: this.escapeHtml(String(line.amount)),
        receivedQty: this.escapeHtml(String(line.receivedQty))
      }))
    }
  }

  /**
   * 打印可用字段目录：通用字段 + 业务字段 + 自定义字段。
   * 模板中以 {{key}} 引用，自定义字段前缀为 custom.
   */
  async listFields(bizType: string, user: JwtUser): Promise<PrintFieldItem[]> {
    const common: PrintFieldItem[] = [
      { key: 'docNo', label: '单据号', group: 'common' },
      { key: 'status', label: '状态', group: 'common' },
      { key: 'remark', label: '备注', group: 'common' },
      { key: 'lines', label: '明细行', group: 'common', type: 'lines' }
    ]
    const bizFields: PrintFieldItem[] = PRINT_BIZ_FIELDS[bizType] ?? []
    const custom: PrintFieldItem[] = []
    const entityCode = CUSTOM_ENTITY_BY_BIZ_TYPE[bizType]
    if (entityCode) {
      try {
        const definitions = await this.customFieldService.definitions(entityCode, user)
        for (const definition of definitions) {
          custom.push({
            key: `${CUSTOM_VALUE_KEY_PREFIX}${definition.fieldKey}`,
            label: definition.fieldLabel,
            group: 'custom',
            type: String(definition.fieldType ?? 'string'),
            options: definition.options?.map((option) => option.label) ?? []
          })
        }
      } catch {
        // 自定义字段读取失败时不影响基础字段目录
      }
    }
    return [...common, ...bizFields, ...custom]
  }

  /** 解析自定义字段取值：按 bizType 找到实体编码后读取该单据的自定义字段 */
  private async resolveCustomValues(bizType: string, bizId: number, user: JwtUser): Promise<Record<string, string>> {
    const entityCode = CUSTOM_ENTITY_BY_BIZ_TYPE[bizType]
    if (!entityCode) return {}
    try {
      const values = await this.customFieldService.values(entityCode, bizId, user)
      return Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
          `${CUSTOM_VALUE_KEY_PREFIX}${key}`,
          this.escapeHtml(value === null || value === undefined ? '' : String(value))
        ])
      )
    } catch {
      return {}
    }
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char] ?? char)
  }

  /* ---------------- 条码标签批量生成与序列号 ---------------- */

  /** 批量生成条码标签序列号：按编码规则取号，序列号租户内唯一 */
  async batchCreateLabels(dto: BatchCreateLabelDto, user: JwtUser): Promise<PrintLabelInstanceEntity[]> {
    const template = await this.labelRepo.findOne({ where: { id: dto.labelTemplateId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!template) throw new NotFoundException('标签模板不存在')
    const rule = await this.resolveBarcodeRule(dto.ruleCode, user)
    const now = new Date()
    const cycleKey = buildCycleKey(rule, now)
    const serialKey = `print:barcode:${user.tenantId}:${rule.ruleCode}:${cycleKey}`
    const start = await this.redis.incr(serialKey)
    const candidates = Array.from({ length: dto.count }, (_, index) =>
      buildSerial(rule, now, start + index)
    )
    const existing = await this.labelInstanceRepo.find({
      where: { tenantId: user.tenantId, serialNo: In(candidates.length ? candidates : ['__none__']) }
    })
    const duplicates = detectDuplicateSerials(candidates, new Set(existing.map((item) => item.serialNo)))
    if (duplicates.length) {
      throw new ConflictException(`序列号重复：${duplicates.slice(0, 5).join('、')}`)
    }
    const rows = candidates.map((serialNo) => this.labelInstanceRepo.create({
      tenantId: user.tenantId,
      labelTemplateId: template.id,
      templateCode: template.labelCode,
      productId: dto.productId,
      variantId: dto.variantId ?? 0,
      serialNo,
      barcodeType: rule.barcodeType,
      batchNo: dto.batchNo ?? '',
      quantity: '1',
      printCount: 0,
      lastPrintedAt: null,
      status: 'GENERATED',
      createdBy: user.userId
    }))
    const saved = await this.labelInstanceRepo.save(rows)
    await this.auditService.record({
      bizType: 'print_label_instance',
      bizId: template.id,
      action: 'BATCH_CREATE_LABELS',
      afterValue: { count: saved.length, ruleCode: rule.ruleCode, productId: dto.productId }
    }, user)
    return saved
  }

  /** 标签实例查询 */
  async listLabelInstances(query: QueryLabelInstanceDto, user: JwtUser): Promise<PageResult<PrintLabelInstanceEntity>> {
    const where: FindOptionsWhere<PrintLabelInstanceEntity> = { tenantId: user.tenantId, isDeleted: 0 }
    if (query.productId) where.productId = query.productId
    if (query.status) where.status = query.status
    const [list, total] = await this.labelInstanceRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 打印标签：累计打印次数并给出重复打印提示 */
  async printLabelInstance(id: number, user: JwtUser): Promise<{ instance: PrintLabelInstanceEntity; warning: string | null }> {
    const instance = await this.labelInstanceRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!instance) throw new NotFoundException('标签实例不存在')
    const judgement = evaluateLabelPrintRepeat(instance.printCount)
    instance.printCount += 1
    instance.lastPrintedAt = new Date()
    instance.status = 'PRINTED'
    const saved = await this.labelInstanceRepo.save(instance)
    if (judgement.warn) {
      await this.auditService.record({
        bizType: 'print_label_instance',
        bizId: id,
        action: 'REPEAT_PRINT_LABEL',
        afterValue: { serialNo: instance.serialNo, printCount: instance.printCount, warning: judgement.message }
      }, user)
    }
    return { instance: saved, warning: judgement.message }
  }

  /** 编码规则查询 */
  async listBarcodeRules(user: JwtUser): Promise<PrintBarcodeRuleEntity[]> {
    return this.barcodeRuleRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 }, order: { id: 'ASC' } })
  }

  /** 编码规则新增 */
  async createBarcodeRule(dto: CreateBarcodeRuleDto, user: JwtUser): Promise<PrintBarcodeRuleEntity> {
    const judgement = evaluateBarcodeRule(dto)
    if (!judgement.ok) throw new BadRequestException(judgement.reason)
    const existing = await this.barcodeRuleRepo.findOne({ where: { tenantId: user.tenantId, ruleCode: dto.ruleCode, isDeleted: 0 } })
    if (existing) throw new ConflictException('编码规则已存在')
    const entity = this.barcodeRuleRepo.create({
      tenantId: user.tenantId,
      ruleCode: dto.ruleCode,
      prefix: dto.prefix ?? '',
      dateFormat: dto.dateFormat ?? 'yyyyMMdd',
      seqLength: dto.seqLength ?? 6,
      resetCycle: dto.resetCycle ?? 'DAILY',
      barcodeType: dto.barcodeType ?? 'CODE128',
      status: 'ACTIVE',
      remark: dto.remark ?? null,
      createdBy: user.userId
    })
    const saved = await this.barcodeRuleRepo.save(entity)
    await this.auditService.record({ bizType: 'print_barcode_rule', bizId: saved.id, action: 'CREATE_BARCODE_RULE', afterValue: saved }, user)
    return saved
  }

  /** 编码规则更新 */
  async updateBarcodeRule(id: number, dto: UpdateBarcodeRuleDto, user: JwtUser): Promise<PrintBarcodeRuleEntity> {
    const entity = await this.barcodeRuleRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('编码规则不存在')
    const judgement = evaluateBarcodeRule({ ...entity, ...dto })
    if (!judgement.ok) throw new BadRequestException(judgement.reason)
    Object.assign(entity, dto)
    const saved = await this.barcodeRuleRepo.save(entity)
    await this.auditService.record({ bizType: 'print_barcode_rule', bizId: id, action: 'UPDATE_BARCODE_RULE', afterValue: saved }, user)
    return saved
  }

  /** 取编码规则：指定规则码或默认启用规则 */
  private async resolveBarcodeRule(ruleCode: string | undefined, user: JwtUser): Promise<PrintBarcodeRuleEntity> {
    const rule = ruleCode
      ? await this.barcodeRuleRepo.findOne({ where: { tenantId: user.tenantId, ruleCode, isDeleted: 0 } })
      : await this.barcodeRuleRepo.findOne({ where: { tenantId: user.tenantId, status: 'ACTIVE', isDeleted: 0 }, order: { id: 'ASC' } })
    if (!rule) throw new NotFoundException('未找到可用的条码编码规则')
    if (rule.status !== 'ACTIVE') throw new BadRequestException(`编码规则 ${rule.ruleCode} 已停用`)
    return rule
  }

  private async resolveTemplate(dto: CreatePrintJobDto, user: JwtUser): Promise<PrintTemplateEntity | null> {
    if (dto.templateCode) {
      const byCode = await this.templateRepo.findOne({
        where: { tenantId: user.tenantId, code: dto.templateCode, isActive: 1, isDeleted: 0 }
      })
      return byCode
    }
    const byDefault = await this.templateRepo.findOne({
      where: { tenantId: user.tenantId, bizType: dto.bizType, isDefault: 1, isActive: 1, isDeleted: 0 }
    })
    if (byDefault) {
      return byDefault
    }
    return this.templateRepo.findOne({
      where: { tenantId: user.tenantId, bizType: dto.bizType, isActive: 1, isDeleted: 0 }
    })
  }

  private async findTemplate(id: number, user: JwtUser): Promise<PrintTemplateEntity> {
    const entity = await this.templateRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) {
      throw new NotFoundException('打印模板不存在')
    }
    return entity
  }
}
