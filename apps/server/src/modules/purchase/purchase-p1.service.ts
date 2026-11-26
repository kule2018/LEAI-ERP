import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import {
  canApproveFine, canTransitionCrossDock, validateCrossDock, validateFineDeduction
} from '../../common/purchase-p1-rules'
import { AuditService } from '../audit/audit.service'
import {
  CrossDockEntity, SupplierFineEntity
} from './entities/purchase-extension-p1.entity'
import {
  PurchaseOrderEntity, PurchaseOrderLineEntity, GoodsReceiptEntity, GoodsReceiptLineEntity
} from './entities/purchase.entities'
import { SupplierEntity } from '../master-data/entities/supplier.entity'
import { PaginationDto } from '../../common/dto/pagination.dto'

@Injectable()
export class PurchaseP1Service {
  constructor(
    @InjectRepository(CrossDockEntity) private readonly crossDockRepo: Repository<CrossDockEntity>,
    @InjectRepository(SupplierFineEntity) private readonly fineRepo: Repository<SupplierFineEntity>,
    @InjectRepository(PurchaseOrderEntity) private readonly orderRepo: Repository<PurchaseOrderEntity>,
    @InjectRepository(PurchaseOrderLineEntity) private readonly orderLineRepo: Repository<PurchaseOrderLineEntity>,
    @InjectRepository(GoodsReceiptEntity) private readonly receiptRepo: Repository<GoodsReceiptEntity>,
    @InjectRepository(GoodsReceiptLineEntity) private readonly receiptLineRepo: Repository<GoodsReceiptLineEntity>,
    @InjectRepository(SupplierEntity) private readonly supplierRepo: Repository<SupplierEntity>,
    private readonly auditService: AuditService
  ) {}

  /* ------------------------------ 越库直发 ------------------------------ */

  async listCrossDocks(query: PaginationDto & { status?: string }, user: JwtUser): Promise<PageResult<CrossDockEntity>> {
    const [list, total] = await this.crossDockRepo.findAndCount({
      where: { tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) },
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 创建越库单：校验采购订单到货数量与已越库数量 */
  async createCrossDock(dto: {
    supplierId: number
    purchaseOrderId?: number
    saleOrderId?: number
    customerId?: number
    productId: number
    qty: string
    warehouseId?: number
    remark?: string
  }, user: JwtUser): Promise<CrossDockEntity> {
    const supplier = await this.supplierRepo.findOne({ where: { id: dto.supplierId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!supplier) throw new NotFoundException('供应商不存在')
    const order = dto.purchaseOrderId
      ? await this.orderRepo.findOne({ where: { id: dto.purchaseOrderId, tenantId: user.tenantId, isDeleted: 0 } })
      : null
    const receipts = order
      ? await this.receiptRepo.find({ where: { tenantId: user.tenantId, orderId: order.id, isDeleted: 0 } })
      : []
    const orderLines = order
      ? await this.orderLineRepo.find({ where: { tenantId: user.tenantId, orderId: order.id } })
      : []
    const orderQty = order
      ? orderLines.reduce((sum, item) => sum + Number(item.qty ?? 0), 0)
      : Number(dto.qty)
    const receiptLines = receipts.length > 0
      ? await this.receiptLineRepo.find({ where: { tenantId: user.tenantId, receiptId: In(receipts.map((item) => item.id)) } })
      : []
    const receivedQty = order
      ? receiptLines.reduce((sum, item) => sum + Number(item.qty ?? 0), 0)
      : Number(dto.qty)
    const existing = await this.crossDockRepo.find({ where: { tenantId: user.tenantId, purchaseOrderId: dto.purchaseOrderId ?? 0 } })
    const already = existing.filter((item) => item.status !== 'CANCELLED')
      .reduce((sum, item) => sum + Number(item.qty), 0)
    const check = validateCrossDock({ orderQty, receivedQty, requestQty: Number(dto.qty), alreadyCrossDockedQty: already })
    if (!check.ok) throw new BadRequestException(check.reason)
    const saved = await this.crossDockRepo.save(this.crossDockRepo.create({
      tenantId: user.tenantId,
      crossdockNo: this.number('CD'),
      supplierId: dto.supplierId,
      customerId: dto.customerId ?? null,
      purchaseOrderId: dto.purchaseOrderId ?? null,
      saleOrderId: dto.saleOrderId ?? null,
      productId: dto.productId,
      qty: Number(dto.qty).toFixed(3),
      warehouseId: dto.warehouseId ?? null,
      status: 'PENDING',
      remark: dto.remark ?? null,
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'po_crossdock', bizId: saved.id, action: 'CREATE_CROSSDOCK', afterValue: saved }, user)
    return saved
  }

  /** 越库状态流转 */
  async transitionCrossDock(id: number, to: string, user: JwtUser): Promise<CrossDockEntity> {
    const entity = await this.crossDockRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('越库单不存在')
    const check = canTransitionCrossDock(entity.status, to)
    if (!check.allowed) throw new BadRequestException(check.reason)
    entity.status = to
    if (to === 'COMPLETED') entity.completedAt = new Date()
    const saved = await this.crossDockRepo.save(entity)
    await this.auditService.record({ bizType: 'po_crossdock', bizId: saved.id, action: 'TRANSITION_CROSSDOCK', afterValue: { status: to } }, user)
    return saved
  }

  /* ------------------------------ 供应商罚款 ------------------------------ */

  async listFines(query: PaginationDto & { supplierId?: number }, user: JwtUser): Promise<PageResult<SupplierFineEntity>> {
    const [list, total] = await this.fineRepo.findAndCount({
      where: { tenantId: user.tenantId, ...(query.supplierId ? { supplierId: query.supplierId } : {}) },
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createFine(dto: {
    supplierId: number
    purchaseOrderId?: number
    fineType: string
    amount: string
    reason?: string
  }, user: JwtUser): Promise<SupplierFineEntity> {
    const supplier = await this.supplierRepo.findOne({ where: { id: dto.supplierId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!supplier) throw new NotFoundException('供应商不存在')
    if (Number(dto.amount) <= 0) throw new BadRequestException('罚款金额必须大于 0')
    const saved = await this.fineRepo.save(this.fineRepo.create({
      tenantId: user.tenantId,
      fineNo: this.number('FINE'),
      supplierId: dto.supplierId,
      purchaseOrderId: dto.purchaseOrderId ?? null,
      fineType: dto.fineType,
      amount: Number(dto.amount).toFixed(4),
      reason: dto.reason ?? null,
      status: 'PENDING',
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'po_supplier_fine', bizId: saved.id, action: 'CREATE_SUPPLIER_FINE', afterValue: saved }, user)
    return saved
  }

  async approveFine(id: number, user: JwtUser): Promise<SupplierFineEntity> {
    const entity = await this.fineRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('罚款单不存在')
    const check = canApproveFine(entity.status)
    if (!check.allowed) throw new BadRequestException(check.reason)
    entity.status = 'APPROVED'
    entity.approvedBy = user.userId
    const saved = await this.fineRepo.save(entity)
    await this.auditService.record({ bizType: 'po_supplier_fine', bizId: saved.id, action: 'APPROVE_SUPPLIER_FINE', afterValue: { status: saved.status } }, user)
    return saved
  }

  async deductFine(id: number, amount: number, user: JwtUser): Promise<SupplierFineEntity> {
    const entity = await this.fineRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('罚款单不存在')
    if (entity.status !== 'APPROVED') throw new BadRequestException('仅已审批罚款可扣款')
    const check = validateFineDeduction(Number(entity.amount), Number(entity.deductedAmount), amount)
    if (!check.ok) throw new BadRequestException(check.reason)
    entity.deductedAmount = Number((Number(entity.deductedAmount) + amount).toFixed(4)).toString()
    if (Number(entity.deductedAmount) >= Number(entity.amount) - 1e-6) entity.status = 'DEDUCTED'
    const saved = await this.fineRepo.save(entity)
    await this.auditService.record({ bizType: 'po_supplier_fine', bizId: saved.id, action: 'DEDUCT_SUPPLIER_FINE', afterValue: { deductedAmount: saved.deductedAmount } }, user)
    return saved
  }

  private number(prefix: string): string {
    return `${prefix}${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
  }
}
