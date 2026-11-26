import { randomBytes } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Like, Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { assertBizEditable } from '../../common/approval-guard'
import { scopeWhere } from '../../common/data-scope-context'
import { threeWayMatch } from '../../common/business-closure-engine'
import { checkBudget, evaluateSupplierAdmission } from '../../common/procurement-rules'
import { canTransition } from '../../common/state-machine'
import { AuditService } from '../audit/audit.service'
import { CollaborationService } from '../collaboration/collaboration.service'
import { FlowBizCallbackRegistry } from '../collaboration/flow-biz-callback'
import { createDomainEvent, DomainEventBus } from '../events/domain-event.module'
import { FinanceIntegrationService } from '../finance/finance-integration.service'
import { FinBudgetEntity, FinInvoiceEntity } from '../finance/entities/finance.entities'
import { InventoryService } from '../inventory/inventory.service'
import { ProductEntity } from '../master-data/entities/product.entity'
import { RevisionService } from '../revision/revision.service'
import { SupplierEntity } from '../master-data/entities/supplier.entity'
import { WarehouseEntity } from '../master-data/entities/warehouse.entity'
import {
  AwardDto,
  CreateCarrierDto,
  CreateDemandDto,
  CreateEvaluateDto,
  CreatePurchaseContractDto,
  CreatePurchaseOrderDto,
  CreatePurchasePriceDto,
  CreateReceiptDto,
  CreateRfqDto,
  CreateVendorStatementDto,
  CreateWaybillDto,
  CreateOutsourceOrderDto,
  OutsourceIssueDto,
  OutsourceReceiveDto,
  PurchaseReturnLineDto,
  QueryPortalDto,
  QueryPurchaseDto,
  SettleVendorStatementDto,
  SupplierQuoteDto,
  UpdatePurchaseOrderDto,
  UpdateQcDto,
  UpdateReceiptDto
} from './dto'
import {
  GoodsReceiptEntity,
  GoodsReceiptLineEntity,
  LogisticsCarrierEntity,
  LogisticsWaybillEntity,
  OutsourceOrderEntity,
  OutsourceOrderLineEntity,
  PurchaseContractEntity,
  PurchaseDemandEntity,
  PurchaseOrderEntity,
  PurchaseOrderLineEntity,
  PurchasePriceEntity,
  PurchaseReturnEntity,
  PurchaseReturnLineEntity,
  PurQuotationEntity,
  PurQuotationLineEntity,
  PurSupplierQuoteEntity,
  SupplierEvaluateEntity,
  VendorStatementEntity
} from './entities/purchase.entities'

@Injectable()
export class PurchaseService implements OnModuleInit {
  constructor(
    @InjectRepository(SupplierEvaluateEntity) private readonly evaluateRepo: Repository<SupplierEvaluateEntity>,
    @InjectRepository(PurQuotationEntity) private readonly rfqRepo: Repository<PurQuotationEntity>,
    @InjectRepository(PurQuotationLineEntity) private readonly rfqLineRepo: Repository<PurQuotationLineEntity>,
    @InjectRepository(PurSupplierQuoteEntity) private readonly quoteRepo: Repository<PurSupplierQuoteEntity>,
    @InjectRepository(PurchaseDemandEntity) private readonly demandRepo: Repository<PurchaseDemandEntity>,
    @InjectRepository(PurchaseOrderEntity) private readonly orderRepo: Repository<PurchaseOrderEntity>,
    @InjectRepository(PurchaseOrderLineEntity) private readonly orderLineRepo: Repository<PurchaseOrderLineEntity>,
    @InjectRepository(GoodsReceiptEntity) private readonly receiptRepo: Repository<GoodsReceiptEntity>,
    @InjectRepository(GoodsReceiptLineEntity) private readonly receiptLineRepo: Repository<GoodsReceiptLineEntity>,
    @InjectRepository(VendorStatementEntity) private readonly statementRepo: Repository<VendorStatementEntity>,
    @InjectRepository(PurchaseReturnEntity) private readonly returnRepo: Repository<PurchaseReturnEntity>,
    @InjectRepository(PurchaseReturnLineEntity) private readonly returnLineRepo: Repository<PurchaseReturnLineEntity>,
    @InjectRepository(PurchaseContractEntity) private readonly contractRepo: Repository<PurchaseContractEntity>,
    @InjectRepository(PurchasePriceEntity) private readonly priceRepo: Repository<PurchasePriceEntity>,
    @InjectRepository(LogisticsCarrierEntity) private readonly carrierRepo: Repository<LogisticsCarrierEntity>,
    @InjectRepository(LogisticsWaybillEntity) private readonly waybillRepo: Repository<LogisticsWaybillEntity>,
    @InjectRepository(OutsourceOrderEntity) private readonly outsourceRepo: Repository<OutsourceOrderEntity>,
    @InjectRepository(OutsourceOrderLineEntity) private readonly outsourceLineRepo: Repository<OutsourceOrderLineEntity>,
    @InjectRepository(FinInvoiceEntity) private readonly invoiceRepo: Repository<FinInvoiceEntity>,
    @InjectRepository(FinBudgetEntity) private readonly budgetRepo: Repository<FinBudgetEntity>,
    @InjectRepository(SupplierEntity) private readonly supplierRepo: Repository<SupplierEntity>,
    @InjectRepository(ProductEntity) private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(WarehouseEntity) private readonly warehouseRepo: Repository<WarehouseEntity>,
    private readonly auditService: AuditService,
    private readonly inventoryService: InventoryService,
    private readonly financeIntegrationService: FinanceIntegrationService,
    private readonly eventBus: DomainEventBus,
    private readonly revisionService: RevisionService,
    private readonly collaborationService: CollaborationService,
    private readonly flowCallbackRegistry: FlowBizCallbackRegistry
  ) {}

  onModuleInit(): void {
    this.flowCallbackRegistry.register({
      bizType: 'purchase_order',
      onApproved: async ({ bizId, user, comment }) => {
        await this.doApproveOrder(bizId, user, comment)
      },
      onRejected: async ({ bizId, user }) => {
        const order = await this.orderRepo.findOne({ where: { id: bizId, tenantId: user.tenantId } })
        if (!order || order.status !== 'SUBMITTED') return
        if (!canTransition('purchase_order', order.status, 'CANCELLED')) return
        order.status = 'CANCELLED'
        await this.orderRepo.save(order)
        await this.auditService.record({ bizType: 'purchase_order', bizId, action: 'FLOW_REJECTED' }, user)
      },
      onWithdrawn: async ({ bizId, user }) => {
        const order = await this.orderRepo.findOne({ where: { id: bizId, tenantId: user.tenantId } })
        if (!order || order.status !== 'SUBMITTED') return
        order.status = 'DRAFT'
        await this.orderRepo.save(order)
        await this.auditService.record({ bizType: 'purchase_order', bizId, action: 'FLOW_WITHDRAWN' }, user)
      },
      onDelegated: async ({ instance, user, comment }) => {
        await this.auditService.record({ bizType: 'purchase_order', bizId: instance.bizId, action: 'FLOW_DELEGATED', afterValue: { comment } }, user)
      },
      onAddSign: async ({ instance, user, comment }) => {
        await this.auditService.record({ bizType: 'purchase_order', bizId: instance.bizId, action: 'FLOW_ADD_SIGN', afterValue: { comment } }, user)
      }
    })
  }

  async listEvaluates(query: QueryPurchaseDto, user: JwtUser): Promise<PageResult<SupplierEvaluateEntity>> {
    const where = scopeWhere<SupplierEvaluateEntity>({ tenantId: user.tenantId, ...(query.keyword ? { period: Like(`%${query.keyword}%`) } : {}) }, user)
    const [list, total] = await this.evaluateRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createEvaluate(dto: CreateEvaluateDto, user: JwtUser): Promise<SupplierEvaluateEntity> {
    const total = this.num(dto.qualityScore) * 0.3 + this.num(dto.deliveryScore) * 0.3 + this.num(dto.priceScore) * 0.2 + this.num(dto.serviceScore) * 0.2
    const level = total >= 90 ? 'A' : total >= 80 ? 'B' : total >= 70 ? 'C' : 'D'
    const entity = this.evaluateRepo.create({ ...dto, tenantId: user.tenantId, totalScore: this.money(total), level })
    const saved = await this.evaluateRepo.save(entity)
    const supplier = await this.findSupplier(dto.supplierId, user)
    supplier.ratingScore = this.money(total)
    await this.supplierRepo.save(supplier)
    await this.auditService.record({ bizType: 'supplier_evaluate', bizId: saved.id, action: 'CREATE_EVALUATE', afterValue: saved }, user)
    return saved
  }

  /** 供应商准入审批：资质校验 + 评级门槛 + 黑名单 */
  async approveSupplierAdmission(
    supplierId: number,
    input: { hasBusinessLicense: boolean; hasQualification: boolean; minScore?: number },
    user: JwtUser
  ): Promise<{ approved: boolean; reason?: string; score: number }> {
    const supplier = await this.findSupplier(supplierId, user)
    const score = this.num(supplier.ratingScore)
    const check = evaluateSupplierAdmission({
      hasBusinessLicense: input.hasBusinessLicense,
      hasQualification: input.hasQualification,
      blacklisted: supplier.status === 'BLACKLIST',
      score,
      minScore: input.minScore
    })
    if (!check.ok) {
      await this.auditService.record({ bizType: 'supplier', bizId: supplierId, action: 'ADMISSION_REJECTED', afterValue: { reason: check.reason } }, user)
      return { approved: false, reason: check.reason, score }
    }
    supplier.status = 'ACTIVE'
    await this.supplierRepo.save(supplier)
    await this.auditService.record({ bizType: 'supplier', bizId: supplierId, action: 'ADMISSION_APPROVED', afterValue: { score } }, user)
    return { approved: true, score }
  }

  async listRfqs(query: QueryPurchaseDto, user: JwtUser): Promise<PageResult<PurQuotationEntity>> {
    const where = scopeWhere<PurQuotationEntity>({ tenantId: user.tenantId, isDeleted: 0, ...(query.status ? { status: query.status } : {}), ...(query.keyword ? { projectName: Like(`%${query.keyword}%`) } : {}) }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.rfqRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async rfqDetail(id: number, user: JwtUser): Promise<{ rfq: PurQuotationEntity; lines: Array<PurQuotationLineEntity & { quotes: PurSupplierQuoteEntity[] }> }> {
    const rfq = await this.findRfq(id, user)
    const lines = await this.rfqLineRepo.find({ where: { tenantId: user.tenantId, rfqId: id }, order: { id: 'ASC' } })
    const detail = []
    for (const line of lines) {
      const quotes = await this.quoteRepo.find({ where: { tenantId: user.tenantId, rfqLineId: line.id }, order: { score: 'DESC' } })
      detail.push({ ...line, quotes })
    }
    return { rfq, lines: detail }
  }

  async createRfq(dto: CreateRfqDto, user: JwtUser): Promise<PurQuotationEntity> {
    const rfq = await this.rfqRepo.save(this.rfqRepo.create({
      tenantId: user.tenantId,
      rfqNo: this.number('RFQ'),
      projectName: dto.projectName,
      quoteDeadline: dto.quoteDeadline ?? null,
      createdBy: user.userId
    }))
    for (const line of dto.lines) {
      await this.rfqLineRepo.save(this.rfqLineRepo.create({
        tenantId: user.tenantId,
        rfqId: rfq.id,
        productId: line.productId,
        qty: line.qty,
        targetPrice: line.targetPrice ?? '0'
      }))
    }
    await this.auditService.record({ bizType: 'rfq', bizId: rfq.id, action: 'CREATE_RFQ', afterValue: rfq }, user)
    return rfq
  }

  async addQuote(rfqLineId: number, dto: SupplierQuoteDto, user: JwtUser): Promise<PurSupplierQuoteEntity> {
    const line = await this.rfqLineRepo.findOne({ where: { id: rfqLineId, tenantId: user.tenantId } })
    if (!line) throw new NotFoundException('询价明细不存在')
    await this.findSupplier(dto.supplierId, user)
    const quote = await this.quoteRepo.save(this.quoteRepo.create({
      tenantId: user.tenantId,
      rfqLineId,
      supplierId: dto.supplierId,
      price: dto.price,
      leadDays: dto.leadDays ?? 0,
      score: dto.score ?? '0'
    }))
    await this.auditService.record({ bizType: 'rfq_quote', bizId: quote.id, action: 'ADD_QUOTE', afterValue: quote }, user)
    return quote
  }

  async award(dto: AwardDto, user: JwtUser): Promise<PurSupplierQuoteEntity> {
    const quote = await this.quoteRepo.findOne({ where: { id: dto.quoteId, tenantId: user.tenantId } })
    if (!quote) throw new NotFoundException('供应商报价不存在')
    const siblings = await this.quoteRepo.find({ where: { tenantId: user.tenantId, rfqLineId: quote.rfqLineId } })
    for (const item of siblings) {
      item.awarded = item.id === quote.id ? 'YES' : 'NO'
      await this.quoteRepo.save(item)
    }
    await this.auditService.record({ bizType: 'rfq_quote', bizId: quote.id, action: 'AWARD_QUOTE' }, user)
    return quote
  }

  async listDemands(query: QueryPurchaseDto, user: JwtUser): Promise<PageResult<PurchaseDemandEntity>> {
    const where = scopeWhere<PurchaseDemandEntity>({ tenantId: user.tenantId, isDeleted: 0, ...(query.status ? { status: query.status } : {}), ...(query.keyword ? { demandNo: Like(`%${query.keyword}%`) } : {}) }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.demandRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 采购需求预算校验：按当期预算与控制规则决定放行/警告/拦截 */
  async checkDemandBudget(amount: number, user: JwtUser, period = new Date().toISOString().slice(0, 7)) {
    const budgets = await this.budgetRepo.find({ where: { tenantId: user.tenantId, period } })
    if (budgets.length === 0) return { allowed: true, warnings: [] as string[] }
    const result = { allowed: true, warnings: [] as string[] }
    for (const budget of budgets) {
      const check = checkBudget(
        this.num(budget.budgetAmount),
        this.num(budget.usedAmount),
        amount,
        (budget.controlRule as 'WARN' | 'STRICT' | 'NONE') ?? 'WARN'
      )
      if (!check.allowed) result.allowed = false
      if (check.warning) result.warnings.push(`预算 ${budget.id} 超限 ${check.overAmount}`)
    }
    return result
  }

  async createDemand(dto: CreateDemandDto, user: JwtUser): Promise<PurchaseDemandEntity> {
    const product = await this.findProduct(dto.productId, user)
    const estimated = this.num(product.cost || product.price) * this.num(dto.qty)
    const budgetCheck = await this.checkDemandBudget(estimated, user)
    if (!budgetCheck.allowed) throw new BadRequestException('采购需求超出预算（严格控制），无法创建')
    const entity = this.demandRepo.create({ ...dto, tenantId: user.tenantId, demandNo: this.number('PD'), sourceType: dto.sourceType ?? 'MANUAL', createdBy: user.userId })
    const saved = await this.demandRepo.save(entity)
    await this.auditService.record({ bizType: 'purchase_demand', bizId: saved.id, action: 'CREATE_DEMAND', afterValue: saved }, user)
    return saved
  }

  async listOrders(query: QueryPurchaseDto, user: JwtUser): Promise<PageResult<PurchaseOrderEntity>> {
    const where = scopeWhere<PurchaseOrderEntity>({ tenantId: user.tenantId, isDeleted: 0, ...(query.status ? { status: query.status } : {}), ...(query.keyword ? { orderNo: Like(`%${query.keyword}%`) } : {}) }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.orderRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async orderDetail(id: number, user: JwtUser): Promise<{ order: PurchaseOrderEntity; lines: PurchaseOrderLineEntity[] }> {
    const order = await this.findOrder(id, user)
    const lines = await this.orderLineRepo.find({ where: { tenantId: user.tenantId, orderId: id }, order: { id: 'ASC' } })
    return { order, lines }
  }

  async createOrder(dto: CreatePurchaseOrderDto, user: JwtUser): Promise<PurchaseOrderEntity> {
    const supplier = await this.findSupplier(dto.supplierId, user)
    if (supplier.blacklist === 1) throw new BadRequestException('供应商在黑名单中，禁止下单')
    if (supplier.qualificationStatus === 'EXPIRED') throw new BadRequestException('供应商资质已过期')
    const warehouseId = await this.resolveWarehouseId(dto.warehouseId, user)

    let total = 0
    for (const line of dto.lines) await this.findProduct(line.productId, user), total += this.num(line.qty) * this.num(line.unitPrice)
    const order = await this.orderRepo.save(this.orderRepo.create({
      tenantId: user.tenantId,
      orderNo: this.number('PO'),
      supplierId: dto.supplierId,
      warehouseId,
      orderDate: dto.orderDate,
      totalAmount: this.money(total),
      remark: dto.remark ?? null,
      createdBy: user.userId
    }))
    for (const line of dto.lines) {
      await this.orderLineRepo.save(this.orderLineRepo.create({
        tenantId: user.tenantId,
        orderId: order.id,
        productId: line.productId,
        variantId: line.variantId ?? null,
        warehouseId: line.warehouseId ?? warehouseId,
        qty: line.qty,
        unitPrice: line.unitPrice,
        amount: this.money(this.num(line.qty) * this.num(line.unitPrice))
      }))
    }
    await this.auditService.record({ bizType: 'purchase_order', bizId: order.id, action: 'CREATE_ORDER', afterValue: order }, user)
    await this.eventBus.emit(createDomainEvent('purchase.order.created', user, 'purchase_order', order.id, { orderNo: order.orderNo, totalAmount: order.totalAmount }))
    return order
  }

  async submitOrder(id: number, user: JwtUser): Promise<PurchaseOrderEntity> {
    const order = await this.findOrder(id, user)
    if (!canTransition('purchase_order', order.status, 'SUBMITTED')) throw new BadRequestException('只有草稿单据可以提交')
    order.status = 'SUBMITTED'
    const saved = await this.orderRepo.save(order)
    await this.auditService.record({ bizType: 'purchase_order', bizId: id, action: 'SUBMIT_ORDER' }, user)
    // 统一版本快照：采购订单提交后锁定审批依据，避免后续改单影响在途审批
    await this.revisionService.recordSafe({
      entityCode: 'PURCHASE_ORDER',
      bizId: saved.id,
      action: 'SUBMIT',
      source: 'PURCHASE',
      snapshot: {
        orderNo: saved.orderNo,
        status: saved.status,
        supplierId: saved.supplierId,
        orderDate: saved.orderDate ?? null,
        totalAmount: saved.totalAmount,
        expectedDate: saved.expectedDate ?? null,
        remark: saved.remark ?? null
      }
    }, user)
    if (await this.collaborationService.hasActiveDefinition('purchase_order', user.tenantId)) {
      await this.collaborationService.startFlow({
        bizType: 'purchase_order',
        bizId: saved.id,
        bizNo: saved.orderNo,
        context: { totalAmount: saved.totalAmount, supplierId: saved.supplierId }
      }, user)
      await this.auditService.record({ bizType: 'purchase_order', bizId: saved.id, action: 'FLOW_STARTED' }, user)
    }
    return saved
  }

  async approveOrder(id: number, user: JwtUser): Promise<PurchaseOrderEntity> {
    if (await this.collaborationService.hasActiveDefinition('purchase_order', user.tenantId)) {
      const instance = await this.collaborationService.findInstanceByBiz('purchase_order', id, user.tenantId)
      if (!instance || instance.status !== 'APPROVED') {
        throw new BadRequestException('审批流程未完成，不能直接审核采购订单')
      }
    }
    return this.doApproveOrder(id, user)
  }

  /** 审批通过后的业务写回：供直接审核与流程回调共用 */
  private async doApproveOrder(id: number, user: JwtUser, comment?: string): Promise<PurchaseOrderEntity> {
    const order = await this.findOrder(id, user)
    if (!canTransition('purchase_order', order.status, 'APPROVED')) return order
    order.status = 'APPROVED'
    const saved = await this.orderRepo.save(order)
    await this.auditService.record({ bizType: 'purchase_order', bizId: id, action: 'APPROVE_ORDER', afterValue: { comment: comment ?? null } }, user)
    await this.eventBus.emit(createDomainEvent('purchase.order.approved', user, 'purchase_order', id, { orderNo: order.orderNo, totalAmount: saved.totalAmount }))
    return saved
  }

  async updateOrder(id: number, dto: UpdatePurchaseOrderDto, user: JwtUser): Promise<PurchaseOrderEntity> {
    const order = await this.findOrder(id, user)
    const instance = await this.collaborationService.findInstanceByBiz('purchase_order', id, user.tenantId)
    assertBizEditable(
      order as unknown as Record<string, unknown>,
      dto as unknown as Record<string, unknown>,
      ['status'],
      { status: order.status, flowRunning: instance?.status === 'RUNNING' }
    )
    const before = { ...order }
    Object.assign(order, dto)
    const saved = await this.orderRepo.save(order)
    await this.auditService.record({ bizType: 'purchase_order', bizId: id, action: 'UPDATE_ORDER', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  async listReceipts(query: QueryPurchaseDto, user: JwtUser): Promise<PageResult<GoodsReceiptEntity>> {
    const where = scopeWhere<GoodsReceiptEntity>({ tenantId: user.tenantId, isDeleted: 0, ...(query.status ? { status: query.status } : {}), ...(query.keyword ? { receiptNo: Like(`%${query.keyword}%`) } : {}) }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.receiptRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createReceipt(dto: CreateReceiptDto, user: JwtUser): Promise<GoodsReceiptEntity> {
    const order = await this.findOrder(dto.orderId, user)
    if (order.status !== 'APPROVED' && order.status !== 'PARTIAL') throw new BadRequestException('采购订单未进入收货状态')
    const receipt = await this.receiptRepo.save(this.receiptRepo.create({
      tenantId: user.tenantId,
      receiptNo: this.number('GR'),
      orderId: order.id,
      supplierId: order.supplierId,
      createdBy: user.userId
    }))
    for (const line of dto.lines) {
      const orderLine = await this.orderLineRepo.findOne({ where: { id: line.orderLineId, orderId: order.id, tenantId: user.tenantId } })
      if (!orderLine) throw new BadRequestException('收货明细未匹配到订单行')
      const product = await this.findProduct(orderLine.productId, user)
      // 质检不合格行在入库前拦截，禁止收货
      if ((line.qcStatus ?? 'PENDING') === 'FAIL') {
        throw new BadRequestException(`产品「${product.productName}」质检不合格，禁止入库，请先处理质检结果`)
      }
      // 批次/序列号按产品追溯策略强制填写
      if (product.trackingType === 'BATCH' && !line.batchNo) {
        throw new BadRequestException(`产品「${product.productName}」启用批次管理，批次号必填`)
      }
      if (product.trackingType === 'SERIAL' && !line.serialNo) {
        throw new BadRequestException(`产品「${product.productName}」启用序列号管理，序列号必填`)
      }
      const remain = this.num(orderLine.qty) - this.num(orderLine.receivedQty)
      if (this.num(line.qty) > remain) throw new BadRequestException('收货数量超过未收数量')
      orderLine.receivedQty = this.money(this.num(orderLine.receivedQty) + this.num(line.qty))
      await this.orderLineRepo.save(orderLine)
      await this.receiptLineRepo.save(this.receiptLineRepo.create({
        tenantId: user.tenantId,
        receiptId: receipt.id,
        orderLineId: orderLine.id,
        productId: orderLine.productId,
        qty: line.qty,
        batchNo: line.batchNo ?? null,
        serialNo: line.serialNo ?? null,
        qcStatus: line.qcStatus ?? 'PENDING'
      }))
    }
    await this.auditService.record({ bizType: 'goods_receipt', bizId: receipt.id, action: 'CREATE_RECEIPT', afterValue: receipt }, user)
    // 统一版本快照：收货单留存版本，便于按批次/序列号回溯当时的收货明细
    const receiptLines = await this.receiptLineRepo.find({ where: { tenantId: user.tenantId, receiptId: receipt.id } })
    await this.revisionService.recordSafe({
      entityCode: 'PURCHASE_RECEIPT',
      bizId: receipt.id,
      action: 'CREATE',
      source: 'PURCHASE',
      snapshot: {
        receiptNo: receipt.receiptNo,
        orderId: receipt.orderId,
        supplierId: receipt.supplierId,
        status: receipt.status,
        lines: receiptLines.map((line) => ({
          orderLineId: line.orderLineId,
          productId: line.productId,
          qty: line.qty,
          batchNo: line.batchNo ?? null,
          serialNo: line.serialNo ?? null,
          qcStatus: line.qcStatus ?? 'PENDING'
        }))
      }
    }, user)
    return receipt
  }

  async receiptDetail(id: number, user: JwtUser): Promise<{ receipt: GoodsReceiptEntity; lines: GoodsReceiptLineEntity[] }> {
    const receipt = await this.receiptRepo.findOne({
      where: scopeWhere({ id, tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' })
    })
    if (!receipt) throw new NotFoundException('收货单不存在')
    const lines = await this.receiptLineRepo.find({ where: { tenantId: user.tenantId, receiptId: id }, order: { id: 'ASC' } })
    return { receipt, lines }
  }

  async updateQc(receiptId: number, lineId: number, dto: UpdateQcDto, user: JwtUser): Promise<GoodsReceiptLineEntity> {
    const line = await this.receiptLineRepo.findOne({ where: { id: lineId, receiptId, tenantId: user.tenantId } })
    if (!line) throw new NotFoundException('收货明细不存在')
    const before = { ...line }
    line.qcStatus = dto.qcStatus
    const saved = await this.receiptLineRepo.save(line)
    await this.auditService.record({ bizType: 'goods_receipt_qc', bizId: saved.id, action: 'UPDATE_QC', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  async updateReceipt(id: number, dto: UpdateReceiptDto, user: JwtUser): Promise<GoodsReceiptEntity> {
    const receipt = await this.receiptRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!receipt) throw new NotFoundException('收货单不存在')
    let payableAmount = 0
    if (dto.status === 'DONE' && receipt.status !== 'DONE') {
      const lines = await this.receiptLineRepo.find({ where: { tenantId: user.tenantId, receiptId: id } })
      if (lines.some((line) => line.qcStatus !== 'PASS')) throw new BadRequestException('存在未质检合格的收货明细')
      const order = await this.findOrder(receipt.orderId, user)
      const orderLines = await this.orderLineRepo.find({ where: { tenantId: user.tenantId, orderId: receipt.orderId } })
      for (const line of lines) {
        const orderLine = orderLines.find((item) => item.id === line.orderLineId)
        const movementWarehouseId = orderLine?.warehouseId ?? order.warehouseId
        if (!movementWarehouseId) throw new BadRequestException('采购单未指定仓库，无法入库过账')
        payableAmount += this.num(line.qty) * this.num(orderLine?.unitPrice ?? 0)
        await this.inventoryService.postMovement({
          voucherType: 'PURCHASE_IN',
          voucherId: receipt.id,
          voucherLineId: line.id,
          warehouseId: movementWarehouseId,
          productId: line.productId,
          variantId: orderLine?.variantId ?? 0,
          batchNo: line.batchNo ?? '',
          qtyIn: line.qty,
          cost: orderLine?.unitPrice ?? '0',
          remark: `采购收货 ${receipt.receiptNo}`
        }, user)
      }
      await this.financeIntegrationService.ensurePurchasePayable({
        supplierId: receipt.supplierId,
        sourceId: receipt.id,
        sourceNo: receipt.receiptNo,
        amount: this.money(payableAmount),
        dueDate: null
      }, user)
      const allReceived = orderLines.every((line) => this.num(line.receivedQty) >= this.num(line.qty))
      order.status = allReceived ? 'DONE' : 'PARTIAL'
      await this.orderRepo.save(order)
      receipt.receivedAt = new Date()
    }
    Object.assign(receipt, dto)
    const before = { ...receipt }
    const saved = await this.receiptRepo.save(receipt)
    await this.auditService.record({ bizType: 'goods_receipt', bizId: id, action: 'UPDATE_RECEIPT', beforeValue: before, afterValue: saved }, user)
    if (saved.status === 'DONE' && payableAmount > 0) {
      await this.eventBus.emit(createDomainEvent('purchase.receipt.completed', user, 'goods_receipt', saved.id, { amount: payableAmount, receiptNo: saved.receiptNo }))
    }
    return saved
  }

  async listStatements(query: QueryPurchaseDto, user: JwtUser): Promise<PageResult<VendorStatementEntity>> {
    const where = scopeWhere<VendorStatementEntity>({ tenantId: user.tenantId, isDeleted: 0, ...(query.status ? { status: query.status } : {}), ...(query.keyword ? { statementNo: Like(`%${query.keyword}%`) } : {}) }, user)
    const [list, total] = await this.statementRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createStatement(dto: CreateVendorStatementDto, user: JwtUser): Promise<VendorStatementEntity> {
    await this.findSupplier(dto.supplierId, user)
    const entity = this.statementRepo.create({ ...dto, tenantId: user.tenantId, statementNo: this.number('VS') })
    const saved = await this.statementRepo.save(entity)
    await this.auditService.record({ bizType: 'vendor_statement', bizId: saved.id, action: 'CREATE_STATEMENT', afterValue: saved }, user)
    return saved
  }

  async settleStatement(id: number, dto: SettleVendorStatementDto, user: JwtUser): Promise<VendorStatementEntity> {
    const statement = await this.statementRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!statement) throw new NotFoundException('供应商对账单不存在')
    const settled = this.num(statement.settledAmount) + this.num(dto.amount)
    if (settled > this.num(statement.amount)) throw new BadRequestException('核销金额超过账单金额')
    statement.settledAmount = this.money(settled)
    statement.status = settled >= this.num(statement.amount) ? 'DONE' : 'PARTIAL'
    const saved = await this.statementRepo.save(statement)
    await this.auditService.record({ bizType: 'vendor_statement', bizId: id, action: 'SETTLE_STATEMENT', afterValue: saved }, user)
    return saved
  }

  async listReturns(query: QueryPurchaseDto, user: JwtUser): Promise<PageResult<PurchaseReturnEntity>> {
    const where = scopeWhere<PurchaseReturnEntity>({ tenantId: user.tenantId, isDeleted: 0, ...(query.status ? { status: query.status } : {}), ...(query.keyword ? { returnNo: Like(`%${query.keyword}%`) } : {}) }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.returnRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createReturn(dto: { supplierId: number; receiptId?: number; reason?: string; lines: PurchaseReturnLineDto[] }, user: JwtUser): Promise<PurchaseReturnEntity> {
    await this.findSupplier(dto.supplierId, user)
    const refund = dto.lines.reduce((sum, line) => sum + this.num(line.amount), 0)
    const entity = await this.returnRepo.save(this.returnRepo.create({
      tenantId: user.tenantId,
      returnNo: this.number('PR'),
      supplierId: dto.supplierId,
      receiptId: dto.receiptId ?? null,
      reason: dto.reason ?? null,
      refundAmount: this.money(refund),
      createdBy: user.userId
    }))
    for (const line of dto.lines) {
      await this.returnLineRepo.save(this.returnLineRepo.create({ tenantId: user.tenantId, returnId: entity.id, productId: line.productId, qty: line.qty, amount: line.amount }))
    }
    await this.auditService.record({ bizType: 'purchase_return', bizId: entity.id, action: 'CREATE_RETURN', afterValue: entity }, user)
    return entity
  }

  async listContracts(query: QueryPurchaseDto, user: JwtUser): Promise<PageResult<PurchaseContractEntity>> {
    const where = scopeWhere<PurchaseContractEntity>({ tenantId: user.tenantId, isDeleted: 0, ...(query.status ? { status: query.status } : {}), ...(query.keyword ? { title: Like(`%${query.keyword}%`) } : {}) }, user)
    const [list, total] = await this.contractRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createContract(dto: CreatePurchaseContractDto, user: JwtUser): Promise<PurchaseContractEntity> {
    await this.findSupplier(dto.supplierId, user)
    const entity = this.contractRepo.create({ ...dto, tenantId: user.tenantId, contractNo: this.number('PC'), startDate: dto.startDate ?? null, endDate: dto.endDate ?? null, totalAmount: dto.totalAmount ?? '0' })
    const saved = await this.contractRepo.save(entity)
    await this.auditService.record({ bizType: 'purchase_contract', bizId: saved.id, action: 'CREATE_CONTRACT', afterValue: saved }, user)
    return saved
  }

  async listPrices(query: QueryPurchaseDto, user: JwtUser): Promise<PageResult<PurchasePriceEntity>> {
    const where = scopeWhere<PurchasePriceEntity>({ tenantId: user.tenantId, isDeleted: 0, ...(query.keyword ? { productId: Number(query.keyword) || undefined } : {}) }, user)
    const [list, total] = await this.priceRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createPrice(dto: CreatePurchasePriceDto, user: JwtUser): Promise<PurchasePriceEntity> {
    await this.findSupplier(dto.supplierId, user)
    await this.findProduct(dto.productId, user)
    const entity = this.priceRepo.create({ ...dto, tenantId: user.tenantId, startDate: dto.startDate ?? null, endDate: dto.endDate ?? null })
    const saved = await this.priceRepo.save(entity)
    await this.auditService.record({ bizType: 'purchase_price', bizId: saved.id, action: 'CREATE_PRICE', afterValue: saved }, user)
    return saved
  }

  async listCarriers(query: QueryPurchaseDto, user: JwtUser): Promise<PageResult<LogisticsCarrierEntity>> {
    const where = scopeWhere<LogisticsCarrierEntity>({ tenantId: user.tenantId, isDeleted: 0, ...(query.keyword ? { carrierName: Like(`%${query.keyword}%`) } : {}) }, user)
    const [list, total] = await this.carrierRepo.findAndCount({ where, order: { id: 'ASC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createCarrier(dto: CreateCarrierDto, user: JwtUser): Promise<LogisticsCarrierEntity> {
    const entity = this.carrierRepo.create({ ...dto, tenantId: user.tenantId, contactPhone: dto.contactPhone ?? null })
    const saved = await this.carrierRepo.save(entity)
    await this.auditService.record({ bizType: 'logistics_carrier', bizId: saved.id, action: 'CREATE_CARRIER', afterValue: saved }, user)
    return saved
  }

  async listWaybills(query: QueryPurchaseDto, user: JwtUser): Promise<PageResult<LogisticsWaybillEntity>> {
    const where = scopeWhere<LogisticsWaybillEntity>({ tenantId: user.tenantId, isDeleted: 0, ...(query.keyword ? { waybillNo: Like(`%${query.keyword}%`) } : {}) }, user)
    const [list, total] = await this.waybillRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createWaybill(dto: CreateWaybillDto, user: JwtUser): Promise<LogisticsWaybillEntity> {
    const entity = this.waybillRepo.create({ ...dto, tenantId: user.tenantId, sourceType: dto.sourceType ?? null, sourceId: dto.sourceId ?? null })
    const saved = await this.waybillRepo.save(entity)
    await this.auditService.record({ bizType: 'logistics_waybill', bizId: saved.id, action: 'CREATE_WAYBILL', afterValue: saved }, user)
    return saved
  }

  /**
   * 三方匹配：订单 / 收货 / 发票按来源单据比对数量与单价。
   * 发票通过 bizType=PURCHASE_RECEIPT、bizId=收货单 ID 关联。
   */
  async threeWayMatch(receiptId: number, user: JwtUser): Promise<{
    receiptId: number
    matched: boolean
    status: string
    issues: string[]
  }> {
    const receipt = await this.receiptRepo.findOne({ where: { id: receiptId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!receipt) throw new NotFoundException('收货单不存在')
    const receiptLines = await this.receiptLineRepo.find({ where: { tenantId: user.tenantId, receiptId } })
    const orderLines = await this.orderLineRepo.find({ where: { tenantId: user.tenantId, orderId: receipt.orderId } })
    const invoices = await this.invoiceRepo.find({
      where: {
        tenantId: user.tenantId,
        bizType: 'PURCHASE_RECEIPT',
        bizId: receiptId,
        ...(receipt.supplierId ? { supplierId: receipt.supplierId } : {})
      }
    })
    const invoice = invoices[0]
    const lineAmounts = receiptLines.map((line) => {
      const oLine = orderLines.find((item) => item.id === line.orderLineId)
      const price = oLine ? this.num(oLine.unitPrice) : 0
      return this.num(line.qty) * price
    })
    const totalLineAmount = lineAmounts.reduce((sum, amount) => sum + amount, 0)

    const allIssues: string[] = []
    let allMatched = true
    let worstStatus = 'MATCHED'
    const statusRank: Record<string, number> = { MATCHED: 0, PRICE_DIFF: 1, QUANTITY_DIFF: 2, MISSING: 3 }

    if (invoice && totalLineAmount <= 0) {
      allIssues.push('发票已关联，但订单行单价为 0，无法按比例分摊核对')
    }
    if (!invoice) {
      allIssues.push('未找到关联发票，请先在发票模块登记 bizType=PURCHASE_RECEIPT 的发票')
    }

    for (let index = 0; index < receiptLines.length; index++) {
      const rLine = receiptLines[index]
      const oLine = orderLines.find((item) => item.id === rLine.orderLineId)
      const orderQty = oLine ? this.num(oLine.qty) : 0
      const orderPrice = oLine ? this.num(oLine.unitPrice) : 0
      const allocatedAmount = invoice && totalLineAmount > 0
        ? this.num(invoice.amount) * (lineAmounts[index] / totalLineAmount)
        : 0
      const result = threeWayMatch({
        orderQty,
        orderPrice,
        receiptQty: this.num(rLine.qty),
        invoiceQty: orderPrice > 0 ? allocatedAmount / orderPrice : 0,
        invoicePrice: orderPrice
      })
      if (!result.matched) allMatched = false
      if (statusRank[result.status] > statusRank[worstStatus]) worstStatus = result.status
      allIssues.push(...result.issues.map((issue) => `产品 ${rLine.productId}：${issue}`))
      allIssues.push(`产品 ${rLine.productId}：发票无行级明细，金额按收货金额 ${totalLineAmount > 0 ? ((lineAmounts[index] / totalLineAmount) * 100).toFixed(1) : '0'}% 分摊，结果仅供核对`)
    }

    await this.auditService.record({
      bizType: 'purchase_receipt', bizId: receiptId, action: 'THREE_WAY_MATCH',
      afterValue: { matched: allMatched, status: worstStatus, issues: allIssues }
    }, user)
    return { receiptId, matched: allMatched, status: worstStatus, issues: allIssues }
  }

  async summary(user: JwtUser): Promise<Record<string, unknown>> {
    const orders = await this.orderRepo.find({
      where: scopeWhere<PurchaseOrderEntity>({ tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' })
    })
    const receipts = await this.receiptRepo.find({
      where: scopeWhere<GoodsReceiptEntity>({ tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' })
    })
    const suppliers = await this.supplierRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const lines = await this.orderLineRepo.find({ where: { tenantId: user.tenantId } })
    const bySupplier = new Map<string, number>()
    for (const order of orders) {
      const name = suppliers.find((item) => item.id === order.supplierId)?.supplierName ?? String(order.supplierId)
      bySupplier.set(name, (bySupplier.get(name) ?? 0) + this.num(order.totalAmount))
    }

    // 及时率：以订单期望到货日为准，收货未超期视为及时
    const orderById = new Map(orders.map((order) => [order.id, order]))
    let onTimeTotal = 0
    let onTimeCount = 0
    for (const receipt of receipts) {
      const order = orderById.get(receipt.orderId)
      if (!order?.expectedDate || !receipt.receivedAt) continue
      onTimeTotal += 1
      if (new Date(receipt.receivedAt) <= new Date(order.expectedDate)) onTimeCount += 1
    }

    // 质量合格率：已质检行中 PASS 数量占比
    const receiptIds = receipts.map((receipt) => receipt.id)
    const receiptLines = receiptIds.length
      ? await this.receiptLineRepo.find({ where: { tenantId: user.tenantId, receiptId: In(receiptIds) } })
      : []
    const inspectedLines = receiptLines.filter((line) => line.qcStatus && line.qcStatus !== 'PENDING')
    const passedLines = inspectedLines.filter((line) => line.qcStatus === 'PASS')

    // 供应商排行：按采购金额倒序
    const supplierRanking = [...bySupplier.entries()]
      .map(([name, amount]) => ({ name, amount: this.money(amount) }))
      .sort((a, b) => Number(b.amount) - Number(a.amount))

    return {
      orderCount: orders.length,
      receiptCount: receipts.length,
      totalAmount: this.money(orders.reduce((sum, order) => sum + this.num(order.totalAmount), 0)),
      receivedQty: this.money(lines.reduce((sum, line) => sum + this.num(line.receivedQty), 0)),
      bySupplier: supplierRanking,
      onTimeRate: onTimeTotal > 0 ? Number((onTimeCount / onTimeTotal).toFixed(4)) : 0,
      onTimeSampleCount: onTimeTotal,
      qualityPassRate: inspectedLines.length > 0 ? Number((passedLines.length / inspectedLines.length).toFixed(4)) : 0,
      inspectedLineCount: inspectedLines.length,
      supplierRanking
    }
  }

  async listOutsourceOrders(query: QueryPurchaseDto, user: JwtUser): Promise<PageResult<OutsourceOrderEntity>> {
    const where = scopeWhere<OutsourceOrderEntity>({
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { outsourceNo: Like(`%${query.keyword}%`) } : {})
    }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.outsourceRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async outsourceDetail(id: number, user: JwtUser): Promise<{ order: OutsourceOrderEntity; lines: OutsourceOrderLineEntity[] }> {
    const order = await this.findOutsource(id, user)
    const lines = await this.outsourceLineRepo.find({ where: { tenantId: user.tenantId, orderId: id }, order: { id: 'ASC' } })
    return { order, lines }
  }

  async createOutsourceOrder(dto: CreateOutsourceOrderDto, user: JwtUser): Promise<OutsourceOrderEntity> {
    await this.findSupplier(dto.supplierId, user)
    await this.findProduct(dto.productId, user)
    if (dto.warehouseId) await this.findWarehouse(dto.warehouseId, user)
    const qty = this.num(dto.qty)
    const unitPrice = this.num(dto.unitPrice)
    for (const line of dto.lines) {
      await this.findProduct(line.materialId, user)
    }
    const order = this.outsourceRepo.create({
      tenantId: user.tenantId,
      outsourceNo: this.number('OUT'),
      supplierId: dto.supplierId,
      productId: dto.productId,
      warehouseId: dto.warehouseId ?? null,
      qty: dto.qty,
      unitPrice: dto.unitPrice,
      amount: this.money(qty * unitPrice),
      status: 'DRAFT',
      createdBy: user.userId,
      remark: dto.remark ?? null
    })
    const saved = await this.outsourceRepo.save(order)
    for (const line of dto.lines) {
      await this.outsourceLineRepo.save(this.outsourceLineRepo.create({
        tenantId: user.tenantId,
        orderId: saved.id,
        materialId: line.materialId,
        qty: line.qty
      }))
    }
    await this.auditService.record({ bizType: 'outsource_order', bizId: saved.id, action: 'CREATE_OUTSOURCE', afterValue: saved }, user)
    return saved
  }

  async setOutsourceStatus(id: number, target: string, user: JwtUser): Promise<OutsourceOrderEntity> {
    const order = await this.findOutsource(id, user)
    if (!canTransition('outsource_order', order.status, target)) {
      throw new BadRequestException(`不允许从 ${order.status} 流转到 ${target}`)
    }
    order.status = target
    order.updatedAt = new Date()
    const saved = await this.outsourceRepo.save(order)
    await this.auditService.record({ bizType: 'outsource_order', bizId: id, action: 'SET_OUTSOURCE_STATUS', afterValue: { status: target } }, user)
    return saved
  }

  async issueOutsourceMaterial(id: number, dto: OutsourceIssueDto, user: JwtUser): Promise<OutsourceOrderEntity> {
    const order = await this.findOutsource(id, user)
    if (!['APPROVED', 'PARTIAL'].includes(order.status)) {
      throw new BadRequestException('委外单未审批，不能发料或退料')
    }
    if (!order.warehouseId) throw new BadRequestException('委外单未指定仓库')
    const line = await this.outsourceLineRepo.findOne({ where: { tenantId: user.tenantId, orderId: id, materialId: dto.materialId } })
    if (!line) throw new NotFoundException('委外物料不存在')
    const qty = this.num(dto.qty)
    if (qty <= 0) throw new BadRequestException('数量必须大于零')
    if (dto.issueType === 'RETURN' && this.num(line.issuedQty) - this.num(line.returnedQty) < qty) {
      throw new BadRequestException('退料数量不能超过已发未退数量')
    }
    if (dto.issueType === 'PICK' && this.num(line.issuedQty) - this.num(line.returnedQty) + qty > this.num(line.qty)) {
      throw new BadRequestException('发料数量超过应发数量')
    }
    if (dto.issueType === 'PICK') line.issuedQty = this.money(this.num(line.issuedQty) + qty)
    else line.returnedQty = this.money(this.num(line.returnedQty) + qty)
    await this.outsourceLineRepo.save(line)
    const totalIssued = await this.outsourceLineRepo.find({ where: { tenantId: user.tenantId, orderId: id } })
    order.issuedQty = this.money(totalIssued.reduce((sum, item) => sum + this.num(item.issuedQty) - this.num(item.returnedQty), 0))
    order.status = order.status === 'APPROVED' ? 'PARTIAL' : order.status
    const saved = await this.outsourceRepo.save(order)
    await this.inventoryService.postMovement({
      voucherType: dto.issueType === 'PICK' ? 'OUTSOURCE_PICK' : 'OUTSOURCE_RETURN',
      voucherId: id,
      warehouseId: order.warehouseId,
      productId: dto.materialId,
      batchNo: dto.batchNo,
      ...(dto.issueType === 'PICK' ? { qtyOut: dto.qty } : { qtyIn: dto.qty }),
      remark: `委外单 ${order.outsourceNo} ${dto.issueType === 'PICK' ? '发料' : '退料'}`
    }, user)
    await this.auditService.record({ bizType: 'outsource_order', bizId: id, action: 'ISSUE_OUTSOURCE_MATERIAL', afterValue: { ...dto, orderNo: order.outsourceNo } }, user)
    return saved
  }

  async receiveOutsource(id: number, dto: OutsourceReceiveDto, user: JwtUser): Promise<OutsourceOrderEntity> {
    const order = await this.findOutsource(id, user)
    if (!['APPROVED', 'PARTIAL'].includes(order.status)) {
      throw new BadRequestException('委外单未审批或已关闭')
    }
    if (!order.warehouseId) throw new BadRequestException('委外单未指定仓库')
    const remaining = this.num(order.qty) - this.num(order.receivedQty)
    const qty = this.num(dto.qty)
    if (qty <= 0 || qty > remaining) throw new BadRequestException('收货数量超出未完工数量')
    order.receivedQty = this.money(this.num(order.receivedQty) + qty)
    order.status = this.num(order.receivedQty) >= this.num(order.qty) ? 'DONE' : 'PARTIAL'
    order.updatedAt = new Date()
    const saved = await this.outsourceRepo.save(order)
    await this.inventoryService.postMovement({
      voucherType: 'OUTSOURCE_FINISH_IN',
      voucherId: id,
      warehouseId: order.warehouseId,
      productId: order.productId,
      batchNo: dto.batchNo,
      qtyIn: dto.qty,
      remark: `委外单 ${order.outsourceNo} 完工入库`
    }, user)
    await this.auditService.record({ bizType: 'outsource_order', bizId: id, action: 'RECEIVE_OUTSOURCE', afterValue: { receivedQty: order.receivedQty, status: order.status } }, user)
    return saved
  }

  async portalSummary(query: QueryPortalDto, user: JwtUser): Promise<Record<string, unknown>> {
    const supplierId = query.supplierId ?? 0
    const orders = await this.orderRepo.find({ where: { tenantId: user.tenantId, ...(supplierId ? { supplierId } : {}), isDeleted: 0 } })
    const receipts = await this.receiptRepo.find({ where: { tenantId: user.tenantId, ...(supplierId ? { supplierId } : {}), isDeleted: 0 } })
    const statements = await this.statementRepo.find({ where: { tenantId: user.tenantId, ...(supplierId ? { supplierId } : {}) } })
    const evaluates = await this.evaluateRepo.find({ where: { tenantId: user.tenantId, ...(supplierId ? { supplierId } : {}) } })
    return {
      supplierId: supplierId || null,
      orderCount: orders.length,
      receiptCount: receipts.length,
      statementCount: statements.length,
      orderAmount: this.money(orders.reduce((sum, item) => sum + this.num(item.totalAmount), 0)),
      unpaidAmount: this.money(statements.reduce((sum, item) => sum + this.num(item.amount) - this.num(item.settledAmount), 0)),
      rating: evaluates.length ? this.money(evaluates.reduce((sum, item) => sum + this.num(item.totalScore), 0) / evaluates.length) : '0.0000'
    }
  }

  async portalOrders(query: QueryPortalDto, user: JwtUser): Promise<PageResult<PurchaseOrderEntity>> {
    const where = { tenantId: user.tenantId, isDeleted: 0, ...(query.supplierId ? { supplierId: query.supplierId } : {}), ...(query.status ? { status: query.status } : {}) }
    const [list, total] = await this.orderRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async portalReceipts(query: QueryPortalDto, user: JwtUser): Promise<PageResult<GoodsReceiptEntity>> {
    const where = { tenantId: user.tenantId, isDeleted: 0, ...(query.supplierId ? { supplierId: query.supplierId } : {}) }
    const [list, total] = await this.receiptRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async portalStatements(query: QueryPortalDto, user: JwtUser): Promise<PageResult<VendorStatementEntity>> {
    const where = { tenantId: user.tenantId, ...(query.supplierId ? { supplierId: query.supplierId } : {}) }
    const [list, total] = await this.statementRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async portalEvaluates(query: QueryPortalDto, user: JwtUser): Promise<PageResult<SupplierEvaluateEntity>> {
    const where = { tenantId: user.tenantId, ...(query.supplierId ? { supplierId: query.supplierId } : {}) }
    const [list, total] = await this.evaluateRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  private async findOutsource(id: number, user: JwtUser): Promise<OutsourceOrderEntity> {
    const entity = await this.outsourceRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('委外单不存在')
    return entity
  }

  private number(prefix: string): string {
    return `${prefix}${`${Date.now().toString(36)}${randomBytes(2).toString('hex')}`.toUpperCase()}`
  }

  private num(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  private money(value: number): string { return value.toFixed(4) }

  private async findRfq(id: number, user: JwtUser): Promise<PurQuotationEntity> {
    const entity = await this.rfqRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('询价单不存在')
    return entity
  }

  private async findOrder(id: number, user: JwtUser): Promise<PurchaseOrderEntity> {
    const entity = await this.orderRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('采购订单不存在')
    return entity
  }

  private async findSupplier(id: number, user: JwtUser): Promise<SupplierEntity> {
    const entity = await this.supplierRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('供应商不存在')
    return entity
  }

  private async findProduct(id: number, user: JwtUser): Promise<ProductEntity> {
    const entity = await this.productRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('产品不存在')
    return entity
  }

  private async resolveWarehouseId(id: number | undefined, user: JwtUser): Promise<number> {
    if (id) {
      await this.findWarehouse(id, user)
      return id
    }
    const warehouses = await this.warehouseRepo.find({
      where: { tenantId: user.tenantId, isDeleted: 0, status: 'ACTIVE' },
      order: { isDefault: 'DESC', id: 'ASC' }
    })
    if (warehouses.length === 0) throw new BadRequestException('请先创建仓库')
    return warehouses[0].id
  }

  private async findWarehouse(id: number, user: JwtUser): Promise<WarehouseEntity> {
    const entity = await this.warehouseRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('仓库不存在')
    return entity
  }
}
