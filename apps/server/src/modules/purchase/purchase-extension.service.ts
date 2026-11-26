import { randomBytes } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { unsealSecret } from '../../common/utils/crypto.util'
import { sealSensitiveFields } from '../../common/utils/sensitive.util'
import { Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { threeWayMatch } from '../../common/business-closure-engine'
import { scopeWhere } from '../../common/data-scope-context'
import { checkBudget } from '../../common/procurement-rules'
import {
  allocateCost,
  arrivalPlanStatus,
  checkBankAccount,
  checkEstimateReversal,
  checkStatementReverse,
  diffOrderChange,
  frameAgreementState,
  freightReconcile,
  matchEvidenceChain,
  matchScan,
  mergeDemandPlan,
  outsourceLoss,
  purchasePerformance,
  qualificationAlerts,
  receiptDifference,
  recommendAward,
  resolvePurchasePrice,
  scoreQuotes,
  statementDifference,
  supplierBlacklistHit,
  supplierRadar,
  waybillTrackStatus
} from '../../common/purchase-extension-engine'
import {
  checkPortalDuplicate,
  checkPortalOrderConfirm,
  checkPortalStatementConfirm
} from './purchase-portal-rules'
import { AuditService } from '../audit/audit.service'
import { FinBudgetEntity, FinInvoiceEntity } from '../finance/entities/finance.entities'
import { ProductEntity } from '../master-data/entities/product.entity'
import { SupplierEntity } from '../master-data/entities/supplier.entity'
import {
  AllocateCostDto,
  ApproveAwardDto,
  ApproveLossDto,
  ApprovePriceDto,
  ArrivalPlanDto,
  CompareQuotesDto,
  ConvertDemandDto,
  CreateAwardDto,
  CreateBankAccountDto,
  CreateEstimateDto,
  CreateFrameAgreementDto,
  CreateOutsourceLossDto,
  CreateQualificationDto,
  CreateSupplierBlacklistDto,
  CreateTrackNodeDto,
  DifferenceReceiptDto,
  FreightReconcileDto,
  MatchEvidenceDto,
  MergeDemandsDto,
  OrderChangeDto,
  PortalInvoiceDto,
  PortalShipmentDto,
  QueryPurchaseDto,
  RenewQualificationDto,
  ResolvePriceDto,
  ReverseEstimateDto,
  ReverseStatementDto,
  RfqRoundQuoteDto,
  ScanReceiptDto,
  SettleOutsourceDto,
  StatementDifferenceDto,
  UpgradeFrameAgreementDto,
  WaybillExceptionDto
} from './dto'
import {
  GoodsReceiptEntity,
  GoodsReceiptLineEntity,
  LogisticsTrackNodeEntity,
  LogisticsWaybillEntity,
  OutsourceLossEntity,
  OutsourceOrderEntity,
  OutsourceOrderLineEntity,
  PurchaseArrivalPlanEntity,
  PurchaseAwardEntity,
  PurchaseCostFlowEntity,
  PurchaseDemandEntity,
  PurchaseDemandMergeEntity,
  PurchaseFrameAgreementEntity,
  PurchaseMatchEvidenceEntity,
  PurchaseOrderChangeEntity,
  PurchaseOrderEntity,
  PurchaseOrderLineEntity,
  PurchasePriceEntity,
  PurchasePriceHistoryEntity,
  PurchaseProvisionalEntity,
  PurchaseSupplierBlacklistEntity,
  PurQuotationEntity,
  PurQuotationLineEntity,
  PurSupplierQuoteEntity,
  SupplierBankAccountEntity,
  SupplierEvaluateEntity,
  SupplierPortalActionEntity,
  SupplierQualificationEntity,
  VendorStatementEntity
} from './entities/purchase.entities'

/**
 * 采购供应域扩展服务：供应商资质与银行账户、多轮询价授标、需求合并与转单、
 * 订单变更与到货计划、扫码与差异收货、暂估冲销与成本分摊、对账差异与红冲、
 * 委外损耗与结算、物流轨迹与运费对账、价目表取价、采购绩效与供应商门户协同。
 */
@Injectable()
export class PurchaseExtensionService {
  constructor(
    @InjectRepository(SupplierQualificationEntity) private readonly qualificationRepo: Repository<SupplierQualificationEntity>,
    @InjectRepository(SupplierBankAccountEntity) private readonly bankAccountRepo: Repository<SupplierBankAccountEntity>,
    @InjectRepository(SupplierEvaluateEntity) private readonly evaluateRepo: Repository<SupplierEvaluateEntity>,
    @InjectRepository(SupplierEntity) private readonly supplierRepo: Repository<SupplierEntity>,
    @InjectRepository(ProductEntity) private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(PurQuotationEntity) private readonly rfqRepo: Repository<PurQuotationEntity>,
    @InjectRepository(PurQuotationLineEntity) private readonly rfqLineRepo: Repository<PurQuotationLineEntity>,
    @InjectRepository(PurSupplierQuoteEntity) private readonly quoteRepo: Repository<PurSupplierQuoteEntity>,
    @InjectRepository(PurchaseAwardEntity) private readonly awardRepo: Repository<PurchaseAwardEntity>,
    @InjectRepository(PurchaseDemandEntity) private readonly demandRepo: Repository<PurchaseDemandEntity>,
    @InjectRepository(PurchaseDemandMergeEntity) private readonly demandMergeRepo: Repository<PurchaseDemandMergeEntity>,
    @InjectRepository(PurchaseOrderEntity) private readonly orderRepo: Repository<PurchaseOrderEntity>,
    @InjectRepository(PurchaseOrderLineEntity) private readonly orderLineRepo: Repository<PurchaseOrderLineEntity>,
    @InjectRepository(PurchaseOrderChangeEntity) private readonly orderChangeRepo: Repository<PurchaseOrderChangeEntity>,
    @InjectRepository(PurchaseArrivalPlanEntity) private readonly arrivalPlanRepo: Repository<PurchaseArrivalPlanEntity>,
    @InjectRepository(GoodsReceiptEntity) private readonly receiptRepo: Repository<GoodsReceiptEntity>,
    @InjectRepository(GoodsReceiptLineEntity) private readonly receiptLineRepo: Repository<GoodsReceiptLineEntity>,
    @InjectRepository(PurchaseProvisionalEntity) private readonly provisionalRepo: Repository<PurchaseProvisionalEntity>,
    @InjectRepository(PurchaseCostFlowEntity) private readonly costFlowRepo: Repository<PurchaseCostFlowEntity>,
    @InjectRepository(VendorStatementEntity) private readonly statementRepo: Repository<VendorStatementEntity>,
    @InjectRepository(OutsourceOrderEntity) private readonly outsourceRepo: Repository<OutsourceOrderEntity>,
    @InjectRepository(OutsourceOrderLineEntity) private readonly outsourceLineRepo: Repository<OutsourceOrderLineEntity>,
    @InjectRepository(OutsourceLossEntity) private readonly lossRepo: Repository<OutsourceLossEntity>,
    @InjectRepository(LogisticsWaybillEntity) private readonly waybillRepo: Repository<LogisticsWaybillEntity>,
    @InjectRepository(LogisticsTrackNodeEntity) private readonly trackRepo: Repository<LogisticsTrackNodeEntity>,
    @InjectRepository(PurchasePriceEntity) private readonly priceRepo: Repository<PurchasePriceEntity>,
    @InjectRepository(PurchasePriceHistoryEntity) private readonly priceHistoryRepo: Repository<PurchasePriceHistoryEntity>,
    @InjectRepository(SupplierPortalActionEntity) private readonly portalActionRepo: Repository<SupplierPortalActionEntity>,
    @InjectRepository(FinInvoiceEntity) private readonly invoiceRepo: Repository<FinInvoiceEntity>,
    @InjectRepository(FinBudgetEntity) private readonly budgetRepo: Repository<FinBudgetEntity>,
    @InjectRepository(PurchaseMatchEvidenceEntity) private readonly matchEvidenceRepo: Repository<PurchaseMatchEvidenceEntity>,
    @InjectRepository(PurchaseFrameAgreementEntity) private readonly frameAgreementRepo: Repository<PurchaseFrameAgreementEntity>,
    @InjectRepository(PurchaseSupplierBlacklistEntity) private readonly blacklistRepo: Repository<PurchaseSupplierBlacklistEntity>,
    private readonly auditService: AuditService
  ) {}

  // ---------------------------------------------------------------- 供应商档案

  async listQualifications(supplierId: number, user: JwtUser): Promise<SupplierQualificationEntity[]> {
    return this.qualificationRepo.find({
      where: { tenantId: user.tenantId, supplierId, isDeleted: 0 },
      order: { id: 'ASC' }
    })
  }

  async createQualification(dto: CreateQualificationDto, user: JwtUser): Promise<SupplierQualificationEntity> {
    await this.findSupplier(dto.supplierId, user)
    const entity = this.qualificationRepo.create({
      tenantId: user.tenantId,
      supplierId: dto.supplierId,
      qualificationType: dto.qualificationType,
      certificateNo: dto.certificateNo ?? null,
      issueDate: dto.issueDate ?? null,
      expireDate: dto.expireDate ?? null,
      fileUrl: dto.fileUrl ?? null,
      status: 'VALID',
      createdBy: user.userId
    })
    const saved = await this.qualificationRepo.save(entity)
    await this.refreshSupplierQualification(dto.supplierId, user)
    await this.auditService.record({ bizType: 'supplier_qualification', bizId: saved.id, action: 'CREATE_QUALIFICATION', afterValue: saved }, user)
    return saved
  }

  async renewQualification(id: number, dto: RenewQualificationDto, user: JwtUser): Promise<SupplierQualificationEntity> {
    const entity = await this.qualificationRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('供应商资质不存在')
    const before = { ...entity }
    entity.expireDate = dto.expireDate
    entity.status = 'VALID'
    const saved = await this.qualificationRepo.save(entity)
    await this.refreshSupplierQualification(entity.supplierId, user)
    await this.auditService.record({ bizType: 'supplier_qualification', bizId: id, action: 'RENEW_QUALIFICATION', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  /** 资质到期预警：过期与临期资质清单 */
  async qualificationAlertList(user: JwtUser, warnDays = 30): Promise<Array<Record<string, unknown>>> {
    const list = await this.qualificationRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const alerts = qualificationAlerts(
      list.map((item) => ({ id: item.id, qualificationType: item.qualificationType, expireDate: item.expireDate })),
      this.today(),
      warnDays
    )
    const suppliers = await this.supplierRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    return alerts
      .filter((item) => item.level !== 'OK')
      .map((item) => {
        const row = list.find((entry) => entry.id === item.id)
        return {
          ...item,
          supplierId: row?.supplierId ?? 0,
          supplierName: suppliers.find((supplier) => supplier.id === row?.supplierId)?.supplierName ?? '',
          certificateNo: row?.certificateNo ?? null
        }
      })
  }

  async listBankAccounts(supplierId: number, user: JwtUser): Promise<SupplierBankAccountEntity[]> {
    const list = await this.bankAccountRepo.find({
      where: { tenantId: user.tenantId, supplierId, isDeleted: 0 },
      order: { id: 'ASC' }
    })
    const canView = user.isSuperAdmin || user.permissions.includes('purchase:supplier:bank')
    return list.map((item) => canView
      ? { ...item, accountNo: unsealSecret(item.accountNoEncrypted) ?? item.accountNoMask ?? item.accountNo, accountNoEncrypted: null }
      : { ...item, accountNo: item.accountNoMask ?? item.accountNo, accountNoEncrypted: null })
  }

  /** 银行账户校验：账号格式、户名一致、开户行必填、同供应商账号不重复 */
  async createBankAccount(dto: CreateBankAccountDto, user: JwtUser): Promise<SupplierBankAccountEntity> {
    const supplier = await this.findSupplier(dto.supplierId, user)
    const existing = await this.bankAccountRepo.find({ where: { tenantId: user.tenantId, supplierId: dto.supplierId, isDeleted: 0 } })
    const check = checkBankAccount({
      accountNo: dto.accountNo,
      accountName: dto.accountName,
      bankName: dto.bankName,
      supplierName: supplier.supplierName,
      taxNo: dto.taxNo ?? null,
      existingAccounts: existing.map((item) => ({ id: item.id, accountNo: item.accountNo, accountName: item.accountName, isDefault: item.isDefault }))
    })
    if (!check.ok) throw new BadRequestException(`银行账户校验未通过：${check.reasons.join('；')}`)
    if (dto.isDefault) {
      for (const item of existing) {
        item.isDefault = 0
        await this.bankAccountRepo.save(item)
      }
    }
    const sealed = sealSensitiveFields({ accountNo: dto.accountNo }, ['accountNo'])
    const entity = this.bankAccountRepo.create({
      tenantId: user.tenantId,
      supplierId: dto.supplierId,
      accountName: dto.accountName,
      // 明文列仅保存掩码，原文加密存储
      accountNo: sealed.masked.accountNoMask ?? dto.accountNo,
      accountNoEncrypted: sealed.encrypted.accountNoEncrypted ?? null,
      accountNoMask: sealed.masked.accountNoMask ?? null,
      bankName: dto.bankName,
      bankCode: dto.bankCode ?? null,
      taxNo: dto.taxNo ?? null,
      isDefault: dto.isDefault ?? 0,
      status: 'ACTIVE',
      createdBy: user.userId
    })
    const saved = await this.bankAccountRepo.save(entity)
    await this.auditService.record({
      bizType: 'supplier_bank_account',
      bizId: saved.id,
      action: 'CREATE_BANK_ACCOUNT',
      afterValue: { ...saved, accountNo: saved.accountNoMask, accountNoEncrypted: undefined }
    }, user)
    return saved
  }

  /** 供应商评级雷达：以最近一期评级为基础展开五维雷达 */
  async supplierRadar(supplierId: number, user: JwtUser): Promise<Record<string, unknown>> {
    const supplier = await this.findSupplier(supplierId, user)
    const evaluates = await this.evaluateRepo.find({
      where: { tenantId: user.tenantId, supplierId },
      order: { period: 'DESC', id: 'DESC' }
    })
    const latest = evaluates[0]
    const radar = supplierRadar({
      quality: this.num(latest?.qualityScore),
      delivery: this.num(latest?.deliveryScore),
      price: this.num(latest?.priceScore),
      service: this.num(latest?.serviceScore),
      compliance: this.num(latest?.totalScore)
    })
    return {
      supplierId,
      supplierName: supplier.supplierName,
      ratingScore: supplier.ratingScore,
      period: latest?.period ?? null,
      ...radar
    }
  }

  // ---------------------------------------------------------------- 询价比价

  /** 开启新一轮询价报价 */
  async openRound(rfqId: number, user: JwtUser): Promise<PurQuotationEntity> {
    const rfq = await this.findRfq(rfqId, user)
    rfq.roundNo = this.num(rfq.roundNo) + 1
    rfq.awardStatus = 'PENDING'
    const saved = await this.rfqRepo.save(rfq)
    await this.auditService.record({ bizType: 'rfq', bizId: rfqId, action: 'OPEN_QUOTE_ROUND', afterValue: { roundNo: saved.roundNo } }, user)
    return saved
  }

  async addRoundQuote(rfqLineId: number, dto: RfqRoundQuoteDto, user: JwtUser): Promise<PurSupplierQuoteEntity> {
    const line = await this.rfqLineRepo.findOne({ where: { id: rfqLineId, tenantId: user.tenantId } })
    if (!line) throw new NotFoundException('询价明细不存在')
    const rfq = await this.findRfq(line.rfqId, user)
    await this.findSupplier(dto.supplierId, user)
    const quote = await this.quoteRepo.save(this.quoteRepo.create({
      tenantId: user.tenantId,
      rfqLineId,
      supplierId: dto.supplierId,
      price: dto.price,
      leadDays: dto.leadDays ?? 0,
      score: dto.score ?? '0',
      roundNo: rfq.roundNo,
      attachmentUrl: dto.attachmentUrl ?? null
    }))
    await this.auditService.record({ bizType: 'rfq_quote', bizId: quote.id, action: 'ADD_ROUND_QUOTE', afterValue: { roundNo: rfq.roundNo, price: quote.price } }, user)
    return quote
  }

  /** 自动比价：价格 / 交期 / 评分加权评分，最低价不作为唯一授标依据 */
  async compareQuotes(dto: CompareQuotesDto, user: JwtUser): Promise<Record<string, unknown>> {
    const line = await this.rfqLineRepo.findOne({ where: { id: dto.rfqLineId, tenantId: user.tenantId } })
    if (!line) throw new NotFoundException('询价明细不存在')
    const quotes = await this.quoteRepo.find({ where: { tenantId: user.tenantId, rfqLineId: line.id } })
    const target = quotes.filter((item) => (dto.roundNo ? this.num(item.roundNo) === dto.roundNo : true))
    if (target.length === 0) throw new BadRequestException('该轮次没有可比报价')
    const scored = scoreQuotes(
      target.map((item) => ({ id: item.id, supplierId: item.supplierId, price: this.num(item.price), leadDays: this.num(item.leadDays), score: this.num(item.score) })),
      { price: dto.priceWeight ?? 50, lead: dto.leadWeight ?? 30, score: dto.qualityWeight ?? 20 }
    )
    for (const item of scored) {
      const row = quotes.find((entry) => entry.id === item.quoteId)
      if (row) {
        row.rankNo = item.rank
        await this.quoteRepo.save(row)
      }
    }
    const recommendation = recommendAward(scored)
    await this.auditService.record({
      bizType: 'rfq',
      bizId: line.rfqId,
      action: 'COMPARE_QUOTES',
      afterValue: { rfqLineId: line.id, scored, recommendation }
    }, user)
    return { rfqLineId: line.id, scored, recommendation }
  }

  async createAward(dto: CreateAwardDto, user: JwtUser): Promise<PurchaseAwardEntity> {
    const line = await this.rfqLineRepo.findOne({ where: { id: dto.rfqLineId, tenantId: user.tenantId } })
    if (!line) throw new NotFoundException('询价明细不存在')
    const quote = await this.quoteRepo.findOne({ where: { id: dto.quoteId, rfqLineId: line.id, tenantId: user.tenantId } })
    if (!quote) throw new NotFoundException('供应商报价不存在')
    const record = this.awardRepo.create({
      tenantId: user.tenantId,
      rfqId: line.rfqId,
      rfqLineId: line.id,
      quoteId: quote.id,
      supplierId: quote.supplierId,
      roundNo: quote.roundNo,
      totalScore: '0',
      rankNo: quote.rankNo,
      awardStatus: 'PENDING',
      reason: dto.reason ?? null,
      createdBy: user.userId
    })
    const saved = await this.awardRepo.save(record)
    await this.auditService.record({ bizType: 'pur_award', bizId: saved.id, action: 'CREATE_AWARD', afterValue: saved }, user)
    return saved
  }

  /** 授标审批：仅审批通过后写入授标结果 */
  async approveAward(id: number, dto: ApproveAwardDto, user: JwtUser): Promise<PurchaseAwardEntity> {
    const record = await this.awardRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!record) throw new NotFoundException('授标记录不存在')
    if (record.awardStatus !== 'PENDING') throw new BadRequestException('授标记录已处理')
    record.awardStatus = dto.status
    record.reason = dto.reason ?? record.reason
    record.approvedBy = user.userId
    const saved = await this.awardRepo.save(record)
    if (dto.status === 'APPROVED') {
      const siblings = await this.quoteRepo.find({ where: { tenantId: user.tenantId, rfqLineId: record.rfqLineId } })
      for (const item of siblings) {
        item.awarded = item.id === record.quoteId ? 'YES' : 'NO'
        await this.quoteRepo.save(item)
      }
      const rfq = await this.findRfq(record.rfqId, user)
      rfq.awardStatus = 'AWARDED'
      await this.rfqRepo.save(rfq)
    }
    await this.auditService.record({ bizType: 'pur_award', bizId: id, action: 'APPROVE_AWARD', afterValue: { status: dto.status } }, user)
    return saved
  }

  async listAwards(query: QueryPurchaseDto, user: JwtUser): Promise<PageResult<PurchaseAwardEntity>> {
    const [list, total] = await this.awardRepo.findAndCount({
      where: { tenantId: user.tenantId },
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  // ---------------------------------------------------------------- 采购需求

  /** 采购需求合并：按产品汇总数量并保留来源需求单 */
  async mergeDemands(dto: MergeDemandsDto, user: JwtUser): Promise<PurchaseDemandMergeEntity[]> {
    const demands = await this.demandRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const selected = demands.filter((item) => dto.demandIds.includes(item.id))
    if (selected.length !== dto.demandIds.length) throw new BadRequestException('存在无效的采购需求单')
    const plan = mergeDemandPlan(selected.map((item) => ({ id: item.id, productId: item.productId, qty: this.num(item.qty), sourceType: item.sourceType })))
    const created: PurchaseDemandMergeEntity[] = []
    for (const item of plan) {
      const entity = this.demandMergeRepo.create({
        tenantId: user.tenantId,
        mergeNo: this.number('PDM'),
        productId: item.productId,
        totalQty: this.money3(item.qty),
        sourceDemandIds: item.sourceDemandIds,
        status: 'MERGED',
        createdBy: user.userId
      })
      created.push(await this.demandMergeRepo.save(entity))
    }
    for (const demand of selected) {
      demand.status = 'MERGED'
      await this.demandRepo.save(demand)
    }
    await this.auditService.record({ bizType: 'purchase_demand_merge', bizId: created[0]?.id ?? 0, action: 'MERGE_DEMANDS', afterValue: { demandIds: dto.demandIds, plan } }, user)
    return created
  }

  /** 需求转采购订单：预算校验 + 自动取价 + 黑名单校验 */
  async convertDemand(dto: ConvertDemandDto, user: JwtUser): Promise<PurchaseOrderEntity> {
    const demand = await this.demandRepo.findOne({ where: { id: dto.demandId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!demand) throw new NotFoundException('采购需求不存在')
    if (demand.status === 'ORDERED') throw new BadRequestException('该需求已转订单')
    const supplier = await this.findSupplier(dto.supplierId, user)
    if (supplier.blacklist === 1) throw new BadRequestException('供应商在黑名单中，禁止下单')
    if (supplier.qualificationStatus === 'EXPIRED') throw new BadRequestException('供应商资质已过期')
    const product = await this.findProduct(demand.productId, user)
    const unitPrice = dto.unitPrice ?? await this.resolveUnitPrice(demand.productId, dto.supplierId, user)
    const amount = this.num(unitPrice) * this.num(demand.qty)
    const period = dto.orderDate.slice(0, 7)
    const budgets = await this.budgetRepo.find({ where: { tenantId: user.tenantId, period } })
    for (const budget of budgets) {
      const check = checkBudget(this.num(budget.budgetAmount), this.num(budget.usedAmount), amount, (budget.controlRule as 'WARN' | 'STRICT' | 'NONE') ?? 'WARN')
      if (!check.allowed) throw new BadRequestException('采购需求超出预算（严格控制），无法转单')
    }
    const order = await this.orderRepo.save(this.orderRepo.create({
      tenantId: user.tenantId,
      orderNo: this.number('PO'),
      supplierId: dto.supplierId,
      warehouseId: dto.warehouseId ?? null,
      orderDate: dto.orderDate,
      expectedDate: dto.expectedDate ?? null,
      status: 'DRAFT',
      totalAmount: this.money(amount),
      createdBy: user.userId
    }))
    await this.orderLineRepo.save(this.orderLineRepo.create({
      tenantId: user.tenantId,
      orderId: order.id,
      productId: demand.productId,
      warehouseId: dto.warehouseId ?? null,
      qty: demand.qty,
      unitPrice,
      amount: this.money(amount),
      receivedQty: '0'
    }))
    demand.status = 'ORDERED'
    await this.demandRepo.save(demand)
    await this.priceHistoryRepo.save(this.priceHistoryRepo.create({
      tenantId: user.tenantId,
      supplierId: dto.supplierId,
      productId: demand.productId,
      price: unitPrice,
      sourceType: 'ORDER',
      sourceId: order.id,
      effectiveDate: dto.orderDate,
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'purchase_order', bizId: order.id, action: 'CONVERT_DEMAND', afterValue: { demandId: demand.id, totalAmount: order.totalAmount, productCode: product.productCode } }, user)
    return order
  }

  // ---------------------------------------------------------------- 采购订单

  /** 订单变更：留版本与差异明细，已完结订单不可变更 */
  async changeOrder(id: number, dto: OrderChangeDto, user: JwtUser): Promise<PurchaseOrderChangeEntity> {
    const order = await this.findOrder(id, user)
    if (['DONE', 'CANCELLED'].includes(order.status)) throw new BadRequestException('已完结或已取消订单不可变更')
    const before = {
      expectedDate: order.expectedDate,
      remark: order.remark,
      supplierId: order.supplierId,
      totalAmount: order.totalAmount
    }
    if (dto.changeType === 'DELIVERY') order.expectedDate = dto.expectedDate ?? order.expectedDate
    if (dto.changeType === 'REMARK') order.remark = dto.remark ?? order.remark
    if (dto.changeType === 'SUPPLIER') {
      if (!dto.supplierId) throw new BadRequestException('变更供应商必须指定供应商')
      await this.findSupplier(dto.supplierId, user)
      order.supplierId = dto.supplierId
    }
    if (dto.changeType === 'QUANTITY') {
      if (!dto.qty) throw new BadRequestException('变更数量必须指定数量')
      const lines = await this.orderLineRepo.find({ where: { tenantId: user.tenantId, orderId: id } })
      const line = lines[0]
      if (!line) throw new BadRequestException('订单没有明细行')
      const received = this.num(line.receivedQty)
      if (this.num(dto.qty) < received) throw new BadRequestException('变更数量不能小于已收数量')
      line.qty = dto.qty
      line.amount = this.money(this.num(dto.qty) * this.num(line.unitPrice))
      await this.orderLineRepo.save(line)
      order.totalAmount = this.money(lines.reduce((sum, item) => sum + this.num(item.amount), 0))
    }
    const after = {
      expectedDate: order.expectedDate,
      remark: order.remark,
      supplierId: order.supplierId,
      totalAmount: order.totalAmount
    }
    order.version = this.num(order.version) + 1
    order.updatedAt = new Date()
    await this.orderRepo.save(order)
    const diff = diffOrderChange(before, after)
    const record = this.orderChangeRepo.create({
      tenantId: user.tenantId,
      orderId: id,
      version: order.version,
      changeType: dto.changeType,
      diffDetail: diff,
      reason: dto.reason,
      changedBy: user.userId
    })
    const saved = await this.orderChangeRepo.save(record)
    await this.auditService.record({ bizType: 'purchase_order', bizId: id, action: 'CHANGE_ORDER', afterValue: { version: order.version, diff } }, user)
    return saved
  }

  async listOrderChanges(orderId: number, user: JwtUser): Promise<PurchaseOrderChangeEntity[]> {
    return this.orderChangeRepo.find({ where: { tenantId: user.tenantId, orderId }, order: { version: 'DESC' } })
  }

  async createArrivalPlan(orderId: number, dto: ArrivalPlanDto, user: JwtUser): Promise<PurchaseArrivalPlanEntity> {
    await this.findOrder(orderId, user)
    await this.findProduct(dto.productId, user)
    const entity = this.arrivalPlanRepo.create({
      tenantId: user.tenantId,
      orderId,
      orderLineId: dto.orderLineId ?? null,
      productId: dto.productId,
      planQty: dto.planQty,
      arrivedQty: '0',
      planDate: dto.planDate ?? null,
      status: 'PENDING'
    })
    const saved = await this.arrivalPlanRepo.save(entity)
    await this.auditService.record({ bizType: 'purchase_arrival_plan', bizId: saved.id, action: 'CREATE_ARRIVAL_PLAN', afterValue: saved }, user)
    return saved
  }

  /** 到货计划进度跟踪：进度、逾期天数与订单行到货量 */
  async orderProgress(orderId: number, user: JwtUser): Promise<Record<string, unknown>> {
    const order = await this.findOrder(orderId, user)
    const plans = await this.arrivalPlanRepo.find({ where: { tenantId: user.tenantId, orderId } })
    const lines = await this.orderLineRepo.find({ where: { tenantId: user.tenantId, orderId } })
    const today = this.today()
    const items: Array<Record<string, unknown>> = []
    for (const plan of plans) {
      const line = lines.find((item) => item.id === plan.orderLineId) ?? lines.find((item) => item.productId === plan.productId)
      const arrivedQty = line ? this.num(line.receivedQty) : this.num(plan.arrivedQty)
      const status = arrivalPlanStatus({ planQty: this.num(plan.planQty), arrivedQty, planDate: plan.planDate, at: today })
      plan.arrivedQty = this.money3(arrivedQty)
      plan.status = status.status
      await this.arrivalPlanRepo.save(plan)
      items.push({
        id: plan.id,
        productId: plan.productId,
        planQty: plan.planQty,
        arrivedQty: this.money3(arrivedQty),
        planDate: plan.planDate,
        status: status.status,
        progress: status.progress,
        overdueDays: status.overdueDays
      })
    }
    const overdue = items.filter((item) => item.status === 'OVERDUE')
    return {
      orderId,
      orderNo: order.orderNo,
      expectedDate: order.expectedDate,
      plans: items,
      overdueCount: overdue.length,
      totalProgress: items.length
        ? Math.round((items.reduce((sum, item) => sum + Number(item.progress ?? 0), 0) / items.length) * 10) / 10
        : 0
    }
  }

  /** 供应商门户订单确认 */
  async confirmOrderByPortal(orderId: number, user: JwtUser): Promise<PurchaseOrderEntity> {
    const order = await this.findOrder(orderId, user)
    const check = checkPortalOrderConfirm(order.status, !!order.portalConfirmedAt)
    if (!check.allowed) throw new BadRequestException(check.reason)
    order.portalConfirmedAt = new Date()
    order.portalConfirmedBy = user.userId
    const saved = await this.orderRepo.save(order)
    await this.recordPortalAction(order.supplierId, 'ORDER_CONFIRM', 'PURCHASE_ORDER', order.id, { orderNo: order.orderNo }, user)
    await this.auditService.record({ bizType: 'purchase_order', bizId: orderId, action: 'PORTAL_CONFIRM_ORDER', afterValue: { orderNo: order.orderNo } }, user)
    return saved
  }

  // ---------------------------------------------------------------- 收货与入库

  /** 扫码收货：按条码 / 序列号匹配订单行并生成收货明细 */
  async scanReceipt(dto: ScanReceiptDto, user: JwtUser): Promise<{ receipt: GoodsReceiptEntity; line: GoodsReceiptLineEntity }> {
    const order = await this.findOrder(dto.orderId, user)
    if (order.status !== 'APPROVED' && order.status !== 'PARTIAL') throw new BadRequestException('采购订单未进入收货状态')
    const orderLines = await this.orderLineRepo.find({ where: { tenantId: user.tenantId, orderId: order.id } })
    const products = await this.productRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const scanLines = orderLines.map((line) => {
      const product = products.find((item) => item.id === line.productId)
      return {
        id: line.id,
        productId: line.productId,
        barcode: product?.barcode ?? null,
        serialNo: null as string | null,
        batchNo: null as string | null,
        qty: this.num(line.qty),
        receivedQty: this.num(line.receivedQty)
      }
    })
    const hit = matchScan(dto.code, scanLines)
    if (!hit.matched || !hit.lineId) {
      await this.auditService.record({ bizType: 'purchase_receipt', bizId: order.id, action: 'SCAN_NOT_MATCHED', afterValue: { code: dto.code, reason: hit.reason } }, user)
      throw new BadRequestException(hit.reason ?? '扫码未匹配到订单行')
    }
    const qty = this.num(dto.qty)
    if (qty <= 0) throw new BadRequestException('收货数量必须大于零')
    if (qty > hit.remainQty) throw new BadRequestException(`扫码收货数量超过未收数量 ${hit.remainQty}`)
    const orderLine = orderLines.find((item) => item.id === hit.lineId)
    if (!orderLine) throw new NotFoundException('订单行不存在')
    const receipt = await this.receiptRepo.save(this.receiptRepo.create({
      tenantId: user.tenantId,
      receiptNo: this.number('GR'),
      orderId: order.id,
      supplierId: order.supplierId,
      status: 'DRAFT',
      receiptType: 'NORMAL',
      scanMode: 'SCAN',
      createdBy: user.userId
    }))
    orderLine.receivedQty = this.money3(this.num(orderLine.receivedQty) + qty)
    await this.orderLineRepo.save(orderLine)
    const line = await this.receiptLineRepo.save(this.receiptLineRepo.create({
      tenantId: user.tenantId,
      receiptId: receipt.id,
      orderLineId: orderLine.id,
      productId: orderLine.productId,
      qty: this.money3(qty),
      originQty: this.money3(qty),
      batchNo: null,
      serialNo: dto.code,
      qcStatus: 'PENDING'
    }))
    await this.auditService.record({ bizType: 'goods_receipt', bizId: receipt.id, action: 'SCAN_RECEIPT', afterValue: { code: dto.code, productId: orderLine.productId, qty } }, user)
    return { receipt, line }
  }

  /** 差异收货：标记超收 / 欠收 / 质检不合格并留原因 */
  async receiveDifference(receiptId: number, dto: DifferenceReceiptDto, user: JwtUser): Promise<GoodsReceiptLineEntity> {
    const receipt = await this.findReceipt(receiptId, user)
    const lines = await this.receiptLineRepo.find({ where: { tenantId: user.tenantId, receiptId } })
    const line = lines.find((item) => item.orderLineId === dto.orderLineId) ?? lines[0]
    if (!line) throw new NotFoundException('收货明细不存在')
    const orderLine = await this.orderLineRepo.findOne({ where: { id: line.orderLineId, tenantId: user.tenantId } })
    if (!orderLine) throw new NotFoundException('订单行不存在')
    const failQty = lines.filter((item) => item.qcStatus === 'FAIL').reduce((sum, item) => sum + this.num(item.qty), 0)
    const diff = receiptDifference({
      orderQty: this.num(orderLine.qty),
      receiptQty: this.num(line.qty),
      toleranceRate: dto.toleranceRate ? this.num(dto.toleranceRate) : 0,
      qualityFailQty: failQty
    })
    line.differenceType = diff.type
    line.originQty = this.money3(this.num(orderLine.qty))
    await this.receiptLineRepo.save(line)
    receipt.receiptType = diff.type === 'EQUAL' ? 'NORMAL' : 'DIFFERENCE'
    receipt.differenceReason = `${diff.reason}；${dto.reason}`
    await this.receiptRepo.save(receipt)
    await this.auditService.record({ bizType: 'goods_receipt', bizId: receiptId, action: 'RECEIVE_DIFFERENCE', afterValue: { type: diff.type, diffQty: diff.diffQty, reason: dto.reason } }, user)
    return line
  }

  /** 暂估入库登记 */
  async createEstimate(receiptId: number, dto: CreateEstimateDto, user: JwtUser): Promise<PurchaseProvisionalEntity> {
    const receipt = await this.findReceipt(receiptId, user)
    if (receipt.status !== 'DONE') throw new BadRequestException('收货单未入库，不可暂估')
    const exist = await this.provisionalRepo.findOne({ where: { tenantId: user.tenantId, receiptId, status: 'ESTIMATED' } })
    if (exist) throw new BadRequestException('该收货单已存在未冲销的暂估记录')
    const entity = this.provisionalRepo.create({
      tenantId: user.tenantId,
      receiptId,
      supplierId: receipt.supplierId,
      amount: dto.amount,
      status: 'ESTIMATED',
      createdBy: user.userId
    })
    const saved = await this.provisionalRepo.save(entity)
    await this.auditService.record({ bizType: 'purchase_provisional', bizId: saved.id, action: 'CREATE_ESTIMATE', afterValue: saved }, user)
    return saved
  }

  /** 暂估冲销：发票金额与暂估金额一致（容差内）方可冲销 */
  async reverseEstimate(receiptId: number, dto: ReverseEstimateDto, user: JwtUser): Promise<PurchaseProvisionalEntity> {
    const exist = await this.provisionalRepo.findOne({ where: { tenantId: user.tenantId, receiptId, status: 'ESTIMATED' } })
    if (!exist) throw new NotFoundException('未找到待冲销的暂估记录')
    const check = checkEstimateReversal({
      estimateAmount: this.num(exist.amount),
      invoiceAmount: this.num(dto.invoiceAmount),
      toleranceRate: dto.toleranceRate ? this.num(dto.toleranceRate) : 0.01
    })
    if (!check.allowed) throw new BadRequestException(check.reason)
    exist.status = 'REVERSED'
    exist.invoiceAmount = dto.invoiceAmount
    exist.reverseReason = dto.reason
    const saved = await this.provisionalRepo.save(exist)
    await this.costFlowRepo.save(this.costFlowRepo.create({
      tenantId: user.tenantId,
      receiptId,
      productId: null,
      costType: 'ESTIMATE_REVERSAL',
      amount: this.money(check.diff),
      allocatedFrom: `provisional:${exist.id}`,
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'purchase_provisional', bizId: exist.id, action: 'REVERSE_ESTIMATE', afterValue: { diff: check.diff, reason: dto.reason } }, user)
    return saved
  }

  /** 采购成本分摊：按数量 / 金额 / 重量分摊并记录成本流水 */
  async allocateCost(receiptId: number, dto: AllocateCostDto, user: JwtUser): Promise<PurchaseCostFlowEntity[]> {
    await this.findReceipt(receiptId, user)
    const lines = await this.receiptLineRepo.find({ where: { tenantId: user.tenantId, receiptId } })
    if (lines.length === 0) throw new BadRequestException('收货单没有明细，无法分摊成本')
    const basis = dto.basis as 'QTY' | 'AMOUNT' | 'WEIGHT' | 'EQUAL'
    const orderLines = await this.orderLineRepo.find({ where: { tenantId: user.tenantId } })
    const allocations = allocateCost(
      this.num(dto.totalAmount),
      lines.map((line) => {
        const orderLine = orderLines.find((item) => item.id === line.orderLineId)
        return {
          key: String(line.id),
          qty: this.num(line.qty),
          amount: orderLine ? this.num(orderLine.amount) : 0,
          weight: 1
        }
      }),
      basis
    )
    const saved: PurchaseCostFlowEntity[] = []
    for (const item of allocations) {
      const line = lines.find((entry) => String(entry.id) === item.key)
      const record = this.costFlowRepo.create({
        tenantId: user.tenantId,
        receiptId,
        productId: line?.productId ?? null,
        costType: 'ALLOCATED',
        amount: this.money(item.amount),
        allocatedFrom: `receipt_line:${item.key}`,
        createdBy: user.userId
      })
      saved.push(await this.costFlowRepo.save(record))
    }
    await this.auditService.record({ bizType: 'purchase_cost_flow', bizId: receiptId, action: 'ALLOCATE_COST', afterValue: { basis, totalAmount: dto.totalAmount, count: saved.length } }, user)
    return saved
  }

  // ---------------------------------------------------------------- 对账与红冲

  /** 对账三方差异：订单 / 收货 / 发票金额比对 */
  async statementDifference(id: number, user: JwtUser): Promise<Record<string, unknown>> {
    const statement = await this.findStatement(id, user)
    const orders = await this.orderRepo.find({ where: { tenantId: user.tenantId, supplierId: statement.supplierId } })
    const receipts = await this.receiptRepo.find({ where: { tenantId: user.tenantId, supplierId: statement.supplierId } })
    const invoices = await this.invoiceRepo.find({ where: { tenantId: user.tenantId, invoiceType: 'PURCHASE' } })
    const orderLines = await this.orderLineRepo.find({ where: { tenantId: user.tenantId } })
    const receiptLines = await this.receiptLineRepo.find({ where: { tenantId: user.tenantId } })
    const orderAmount = orders.reduce((sum, item) => sum + this.num(item.totalAmount), 0)
    const receivedAmount = receipts.reduce((sum, receipt) => {
      const lines = receiptLines.filter((line) => line.receiptId === receipt.id)
      return sum + lines.reduce((inner, line) => {
        const orderLine = orderLines.find((item) => item.id === line.orderLineId)
        return inner + (orderLine ? this.num(orderLine.amount) : 0)
      }, 0)
    }, 0)
    const invoicedAmount = invoices.reduce((sum, item) => sum + this.num(item.amount), 0)
    const diff = statementDifference({ orderAmount, receivedAmount, invoicedAmount })
    return {
      statementId: id,
      statementNo: statement.statementNo,
      orderAmount: this.money(orderAmount),
      receivedAmount: this.money(receivedAmount),
      invoicedAmount: this.money(invoicedAmount),
      statementAmount: statement.amount,
      differenceAmount: statement.differenceAmount,
      ...diff
    }
  }

  /** 标记对账差异 */
  async markStatementDifference(id: number, dto: StatementDifferenceDto, user: JwtUser): Promise<VendorStatementEntity> {
    const statement = await this.findStatement(id, user)
    statement.differenceAmount = dto.amount
    statement.differenceReason = dto.reason
    const saved = await this.statementRepo.save(statement)
    await this.auditService.record({ bizType: 'vendor_statement', bizId: id, action: 'MARK_DIFFERENCE', afterValue: { amount: dto.amount, reason: dto.reason } }, user)
    return saved
  }

  /** 对账红冲：核销与已红冲金额合计不得超过账单金额 */
  async reverseStatement(id: number, dto: ReverseStatementDto, user: JwtUser): Promise<VendorStatementEntity> {
    const statement = await this.findStatement(id, user)
    const check = checkStatementReverse({
      amount: this.num(dto.amount),
      statementAmount: this.num(statement.amount),
      settledAmount: this.num(statement.settledAmount),
      reversedAmount: this.num(statement.reversedAmount)
    })
    if (!check.allowed) throw new BadRequestException(check.reason)
    statement.reversedAmount = this.money(this.num(statement.reversedAmount) + this.num(dto.amount))
    statement.reverseReason = dto.reason
    const saved = await this.statementRepo.save(statement)
    await this.auditService.record({ bizType: 'vendor_statement', bizId: id, action: 'REVERSE_STATEMENT', afterValue: { amount: dto.amount, reason: dto.reason } }, user)
    return saved
  }

  /** 供应商门户对账确认 */
  async confirmStatementByPortal(id: number, user: JwtUser): Promise<VendorStatementEntity> {
    const statement = await this.findStatement(id, user)
    const check = checkPortalStatementConfirm(statement.status, !!statement.portalConfirmedAt)
    if (!check.allowed) throw new BadRequestException(check.reason)
    statement.portalConfirmedAt = new Date()
    const saved = await this.statementRepo.save(statement)
    await this.recordPortalAction(statement.supplierId, 'STATEMENT_CONFIRM', 'VENDOR_STATEMENT', id, { statementNo: statement.statementNo }, user)
    await this.auditService.record({ bizType: 'vendor_statement', bizId: id, action: 'PORTAL_CONFIRM_STATEMENT', afterValue: { statementNo: statement.statementNo } }, user)
    return saved
  }

  // ---------------------------------------------------------------- 委外管理

  /** 委外损耗申报：损耗率超标准自动转审批 */
  async createOutsourceLoss(dto: CreateOutsourceLossDto, user: JwtUser): Promise<OutsourceLossEntity> {
    const outsource = await this.outsourceRepo.findOne({ where: { id: dto.outsourceId, tenantId: user.tenantId } })
    if (!outsource) throw new NotFoundException('委外订单不存在')
    const lines = await this.outsourceLineRepo.find({ where: { tenantId: user.tenantId, orderId: outsource.id } })
    const issuedQty = dto.materialId
      ? lines.filter((line) => line.materialId === dto.materialId).reduce((sum, line) => sum + this.num(line.issuedQty), 0)
      : this.num(outsource.issuedQty)
    const receivedQty = dto.materialId
      ? lines.filter((line) => line.materialId === dto.materialId).reduce((sum, line) => sum + this.num(line.returnedQty), 0)
      : this.num(outsource.receivedQty)
    const loss = outsourceLoss({
      issuedQty,
      receivedQty,
      standardLossRate: dto.standardLossRate ? this.num(dto.standardLossRate) : 0.03
    })
    const entity = this.lossRepo.create({
      tenantId: user.tenantId,
      outsourceId: outsource.id,
      materialId: dto.materialId ?? null,
      issuedQty: this.money3(issuedQty),
      receivedQty: this.money3(receivedQty),
      lossQty: this.money3(loss.lossQty),
      lossRate: this.money(loss.lossRate),
      status: loss.needApproval ? 'PENDING' : 'APPROVED',
      reason: dto.reason ?? null,
      createdBy: user.userId
    })
    const saved = await this.lossRepo.save(entity)
    await this.auditService.record({ bizType: 'outsource_loss', bizId: saved.id, action: 'CREATE_LOSS', afterValue: { lossQty: loss.lossQty, lossRate: loss.lossRate, status: saved.status } }, user)
    return saved
  }

  /** 委外损耗审批 */
  async approveLoss(id: number, dto: ApproveLossDto, user: JwtUser): Promise<OutsourceLossEntity> {
    const record = await this.lossRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!record) throw new NotFoundException('委外损耗记录不存在')
    if (record.status !== 'PENDING') throw new BadRequestException('损耗记录已审批')
    record.status = dto.status
    record.reason = dto.reason ?? record.reason
    record.approvedBy = user.userId
    const saved = await this.lossRepo.save(record)
    await this.auditService.record({ bizType: 'outsource_loss', bizId: id, action: 'APPROVE_LOSS', afterValue: { status: dto.status } }, user)
    return saved
  }

  /** 委外结算：生成供应商对账单草稿 */
  async settleOutsource(id: number, dto: SettleOutsourceDto, user: JwtUser): Promise<VendorStatementEntity> {
    const outsource = await this.outsourceRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!outsource) throw new NotFoundException('委外订单不存在')
    if (outsource.status !== 'DONE') throw new BadRequestException('委外订单未完结，不可结算')
    const period = this.today().slice(0, 7)
    const statement = this.statementRepo.create({
      tenantId: user.tenantId,
      statementNo: this.number('VS'),
      supplierId: outsource.supplierId,
      period,
      amount: dto.amount,
      settledAmount: '0',
      reversedAmount: '0',
      differenceAmount: '0',
      status: 'DRAFT'
    })
    const saved = await this.statementRepo.save(statement)
    await this.auditService.record({ bizType: 'vendor_statement', bizId: saved.id, action: 'SETTLE_OUTSOURCE', afterValue: { outsourceId: id, amount: dto.amount } }, user)
    return saved
  }

  /** 委外对账：发料、回收与损耗汇总 */
  async outsourceReconcile(id: number, user: JwtUser): Promise<Record<string, unknown>> {
    const outsource = await this.outsourceRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!outsource) throw new NotFoundException('委外订单不存在')
    const lines = await this.outsourceLineRepo.find({ where: { tenantId: user.tenantId, orderId: id } })
    const losses = await this.lossRepo.find({ where: { tenantId: user.tenantId, outsourceId: id } })
    const issuedQty = outsource.issuedQty
    const receivedQty = outsource.receivedQty
    const lossQty = losses.filter((item) => item.status === 'APPROVED').reduce((sum, item) => sum + this.num(item.lossQty), 0)
    const pendingLoss = losses.filter((item) => item.status === 'PENDING').length
    return {
      outsourceId: id,
      orderNo: outsource.outsourceNo,
      supplierId: outsource.supplierId,
      issuedQty,
      receivedQty,
      lossQty: this.money3(lossQty),
      pendingLossCount: pendingLoss,
      amount: outsource.amount,
      lines: lines.length,
      lossDetail: losses.map((item) => ({ id: item.id, materialId: item.materialId, lossQty: item.lossQty, lossRate: item.lossRate, status: item.status }))
    }
  }

  // ---------------------------------------------------------------- 物流运单

  /** 物流轨迹节点登记 */
  async addTrackNode(waybillId: number, dto: CreateTrackNodeDto, user: JwtUser): Promise<LogisticsTrackNodeEntity> {
    await this.findWaybill(waybillId, user)
    const node = this.trackRepo.create({
      tenantId: user.tenantId,
      waybillId,
      nodeName: dto.nodeName,
      nodeTime: new Date(dto.nodeTime),
      location: dto.location ?? null,
      sourceRef: dto.sourceRef ?? null,
      status: dto.status ?? 'NORMAL'
    })
    const saved = await this.trackRepo.save(node)
    if (saved.status === 'DELIVERED') {
      const waybill = await this.findWaybill(waybillId, user)
      waybill.status = 'DELIVERED'
      waybill.deliveredAt = saved.nodeTime
      await this.waybillRepo.save(waybill)
    }
    await this.auditService.record({ bizType: 'logistics_track_node', bizId: saved.id, action: 'ADD_TRACK_NODE', afterValue: saved }, user)
    return saved
  }

  async listTrackNodes(waybillId: number, user: JwtUser): Promise<Record<string, unknown>> {
    const nodes = await this.trackRepo.find({ where: { tenantId: user.tenantId, waybillId }, order: { nodeTime: 'DESC' } })
    const summary = waybillTrackStatus(nodes.map((node) => ({ nodeName: node.nodeName, nodeTime: this.dateStr(node.nodeTime), location: node.location, status: node.status })))
    return { waybillId, nodes, summary }
  }

  /** 异常签收登记 */
  async reportWaybillException(waybillId: number, dto: WaybillExceptionDto, user: JwtUser): Promise<LogisticsWaybillEntity> {
    const waybill = await this.findWaybill(waybillId, user)
    waybill.exceptionFlag = 1
    waybill.exceptionReason = dto.reason
    waybill.status = dto.status ?? 'EXCEPTION'
    waybill.signer = dto.signer ?? waybill.signer
    const saved = await this.waybillRepo.save(waybill)
    await this.auditService.record({ bizType: 'logistics_waybill', bizId: waybillId, action: 'REPORT_EXCEPTION', afterValue: { reason: dto.reason, status: saved.status } }, user)
    return saved
  }

  /** 运费对账：承运商结算运费与申报运费差异校验 */
  async reconcileFreight(waybillId: number, dto: FreightReconcileDto, user: JwtUser): Promise<Record<string, unknown>> {
    const waybill = await this.findWaybill(waybillId, user)
    const check = freightReconcile({
      declaredAmount: this.num(dto.declaredAmount),
      settledAmount: this.num(dto.settledAmount)
    })
    if (!check.matched) throw new BadRequestException(check.reason)
    waybill.freightAmount = dto.settledAmount
    await this.waybillRepo.save(waybill)
    await this.auditService.record({ bizType: 'logistics_waybill', bizId: waybillId, action: 'RECONCILE_FREIGHT', afterValue: { declaredAmount: dto.declaredAmount, settledAmount: dto.settledAmount } }, user)
    return { waybillId, freightAmount: waybill.freightAmount, ...check }
  }

  // ---------------------------------------------------------------- 价目表

  /** 采购价格矩阵：产品 × 供应商 */
  async priceMatrix(user: JwtUser, productIds: number[] = [], supplierIds: number[] = []): Promise<Array<Record<string, unknown>>> {
    const products = await this.productRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const suppliers = await this.supplierRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const prices = await this.priceRepo.find({ where: { tenantId: user.tenantId } })
    const targetProducts = products.filter((item) => (productIds.length ? productIds.includes(item.id) : true)).slice(0, 100)
    const targetSuppliers = suppliers.filter((item) => (supplierIds.length ? supplierIds.includes(item.id) : true)).slice(0, 50)
    return targetProducts.map((product) => {
      const row: Record<string, unknown> = { productId: product.id, productCode: product.productCode, productName: product.productName }
      for (const supplier of targetSuppliers) {
        const price = prices.find((item) => item.productId === product.id && item.supplierId === supplier.id)
        row[`supplier_${supplier.id}`] = price ? price.price : null
      }
      return row
    })
  }

  /** 历史采购价 */
  async priceHistory(productId: number, supplierId: number, user: JwtUser): Promise<PurchasePriceHistoryEntity[]> {
    return this.priceHistoryRepo.find({
      where: { tenantId: user.tenantId, productId, supplierId },
      order: { id: 'DESC' },
      take: 50
    })
  }

  /** 自动取价：命中有效价目价并留历史价 */
  async resolvePrice(dto: ResolvePriceDto, user: JwtUser): Promise<Record<string, unknown>> {
    const prices = await this.priceRepo.find({ where: { tenantId: user.tenantId, productId: dto.productId } })
    const hit = resolvePurchasePrice(
      prices.map((item) => ({
        id: item.id,
        supplierId: item.supplierId,
        productId: item.productId,
        price: this.num(item.price),
        startDate: item.startDate,
        endDate: item.endDate,
        priority: item.priority,
        status: item.status
      })),
      { productId: dto.productId, supplierId: dto.supplierId, at: dto.at ?? this.today() }
    )
    await this.auditService.record({ bizType: 'purchase_price', bizId: dto.productId, action: 'RESOLVE_PRICE', afterValue: hit }, user)
    return hit
  }

  /** 采购价改价审批 */
  async approvePrice(id: number, dto: ApprovePriceDto, user: JwtUser): Promise<PurchasePriceEntity> {
    const price = await this.priceRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!price) throw new NotFoundException('价目价不存在')
    if (price.approvalStatus !== 'PENDING') throw new BadRequestException('价目价已审批')
    price.approvalStatus = dto.status
    price.version = this.num(price.version) + 1
    if (dto.status === 'APPROVED') {
      price.status = 'ENABLED'
      await this.priceHistoryRepo.save(this.priceHistoryRepo.create({
        tenantId: user.tenantId,
        supplierId: price.supplierId,
        productId: price.productId,
        price: price.price,
        sourceType: 'PRICE_LIST',
        sourceId: price.id,
        effectiveDate: price.startDate,
        createdBy: user.userId
      }))
    }
    const saved = await this.priceRepo.save(price)
    await this.auditService.record({ bizType: 'purchase_price', bizId: id, action: 'APPROVE_PRICE', afterValue: { status: dto.status } }, user)
    return saved
  }

  // ---------------------------------------------------------------- 采购绩效

  /** 采购绩效：及时率、质量合格率、供应商排行与成本分析 */
  async performance(user: JwtUser): Promise<Record<string, unknown>> {
    const orders = await this.orderRepo.find({ where: { tenantId: user.tenantId } })
    const lines = await this.orderLineRepo.find({ where: { tenantId: user.tenantId } })
    const receipts = await this.receiptRepo.find({ where: { tenantId: user.tenantId } })
    const receiptLines = await this.receiptLineRepo.find({ where: { tenantId: user.tenantId } })
    const orderAmount = (orderId: number): number =>
      lines.filter((line) => line.orderId === orderId).reduce((sum, line) => sum + this.num(line.amount), 0)
    const orderInputs = orders.map((order) => {
      const receivedLine = receiptLines.length
        ? receiptLines.find((receiptLine) => {
            const orderLine = lines.find((item) => item.id === receiptLine.orderLineId)
            return orderLine ? orderLine.orderId === order.id : false
          })
        : undefined
      const receipt = receivedLine ? receipts.find((item) => item.id === receivedLine.receiptId) : undefined
      return {
        supplierId: order.supplierId,
        totalAmount: orderAmount(order.id),
        expectedDate: order.expectedDate,
        receivedDate: receipt ? this.dateStr(receipt.receivedAt) : null
      }
    })
    const receiptInputs = receipts.map((receipt) => {
      const receiptLinesOf = receiptLines.filter((line) => line.receiptId === receipt.id)
      return {
        supplierId: receipt.supplierId,
        qty: receiptLinesOf.reduce((sum, line) => sum + this.num(line.qty), 0),
        passQty: receiptLinesOf.filter((line) => line.qcStatus === 'PASS').reduce((sum, line) => sum + this.num(line.qty), 0),
        amount: receiptLinesOf.reduce((sum, line) => {
          const orderLine = lines.find((item) => item.id === line.orderLineId)
          return sum + (orderLine ? this.num(orderLine.amount) : 0)
        }, 0)
      }
    })
    const result = purchasePerformance({ orders: orderInputs, receipts: receiptInputs })
    return {
      ...result,
      orderCount: orders.length,
      receiptCount: receipts.length
    }
  }

  // ---------------------------------------------------------------- 供应商门户

  /** 供应商门户发货通知：登记运单并记录协同动作 */
  async portalShipment(dto: PortalShipmentDto, user: JwtUser): Promise<LogisticsWaybillEntity> {
    await this.findSupplier(dto.supplierId, user)
    const duplicated = await this.waybillRepo.findOne({ where: { tenantId: user.tenantId, waybillNo: dto.waybillNo } })
    const duplicateCheck = checkPortalDuplicate('WAYBILL', !!duplicated)
    if (!duplicateCheck.allowed) throw new BadRequestException(duplicateCheck.reason)
    const waybill = this.waybillRepo.create({
      tenantId: user.tenantId,
      waybillNo: dto.waybillNo,
      carrierId: dto.carrierId,
      supplierId: dto.supplierId,
      sourceType: dto.sourceType ?? 'PURCHASE',
      sourceId: dto.sourceId ?? null,
      status: 'IN_TRANSIT',
      freightAmount: dto.freightAmount ?? '0'
    })
    const saved = await this.waybillRepo.save(waybill)
    await this.recordPortalAction(dto.supplierId, 'SHIPMENT_NOTICE', 'WAYBILL', saved.id, { waybillNo: dto.waybillNo }, user)
    await this.auditService.record({ bizType: 'logistics_waybill', bizId: saved.id, action: 'PORTAL_SHIPMENT', afterValue: { waybillNo: dto.waybillNo, supplierId: dto.supplierId } }, user)
    return saved
  }

  /** 供应商门户发票上传：登记待匹配发票 */
  async portalInvoice(dto: PortalInvoiceDto, user: JwtUser): Promise<FinInvoiceEntity> {
    await this.findSupplier(dto.supplierId, user)
    const duplicated = await this.invoiceRepo.findOne({ where: { tenantId: user.tenantId, invoiceNo: dto.invoiceNo } })
    const duplicateCheck = checkPortalDuplicate('INVOICE', !!duplicated)
    if (!duplicateCheck.allowed) throw new BadRequestException(duplicateCheck.reason)
    const invoice = this.invoiceRepo.create({
      tenantId: user.tenantId,
      invoiceNo: dto.invoiceNo,
      invoiceType: 'PURCHASE',
      supplierId: dto.supplierId,
      amount: dto.amount,
      taxAmount: '0',
      status: 'PENDING',
      bizType: dto.receiptId ? 'PURCHASE_RECEIPT' : 'PURCHASE',
      bizId: dto.receiptId ?? null
    })
    const saved = await this.invoiceRepo.save(invoice)
    await this.recordPortalAction(dto.supplierId, 'INVOICE_UPLOAD', 'FIN_INVOICE', saved.id, { invoiceNo: dto.invoiceNo, amount: dto.amount }, user)
    await this.auditService.record({ bizType: 'fin_invoice', bizId: saved.id, action: 'PORTAL_UPLOAD_INVOICE', afterValue: { invoiceNo: dto.invoiceNo } }, user)
    return saved
  }

  // ---------------------------------------------------------------- 私有方法

  private async recordPortalAction(
    supplierId: number,
    actionType: string,
    bizType: string,
    bizId: number | null,
    content: unknown,
    user: JwtUser
  ): Promise<void> {
    await this.portalActionRepo.save(this.portalActionRepo.create({
      tenantId: user.tenantId,
      supplierId,
      actionType,
      bizType,
      bizId,
      content,
      status: 'RECEIVED',
      createdBy: user.userId
    }))
  }

  private async refreshSupplierQualification(supplierId: number, user: JwtUser): Promise<void> {
    const supplier = await this.findSupplier(supplierId, user)
    const list = await this.qualificationRepo.find({ where: { tenantId: user.tenantId, supplierId, isDeleted: 0 } })
    const today = this.today()
    const expired = list.some((item) => {
      if (!item.expireDate) return false
      return item.expireDate < today
    })
    supplier.qualificationStatus = expired ? 'EXPIRED' : list.length ? 'VALID' : 'PENDING'
    await this.supplierRepo.save(supplier)
  }

  private async resolveUnitPrice(productId: number, supplierId: number, user: JwtUser): Promise<string> {
    const prices = await this.priceRepo.find({ where: { tenantId: user.tenantId, productId } })
    const hit = resolvePurchasePrice(
      prices.map((item) => ({
        id: item.id,
        supplierId: item.supplierId,
        productId: item.productId,
        price: this.num(item.price),
        startDate: item.startDate,
        endDate: item.endDate,
        priority: item.priority,
        status: item.status
      })),
      { productId, supplierId, at: this.today() }
    )
    if (hit.price !== null) return this.money(hit.price)
    const product = await this.findProduct(productId, user)
    return product.cost ?? '0'
  }

  private async findSupplier(id: number, user: JwtUser): Promise<SupplierEntity> {
    const supplier = await this.supplierRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!supplier) throw new NotFoundException('供应商不存在')
    return supplier
  }

  private async findProduct(id: number, user: JwtUser): Promise<ProductEntity> {
    const product = await this.productRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!product) throw new NotFoundException('产品不存在')
    return product
  }

  private async findRfq(id: number, user: JwtUser): Promise<PurQuotationEntity> {
    const rfq = await this.rfqRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!rfq) throw new NotFoundException('询价单不存在')
    return rfq
  }

  private async findOrder(id: number, user: JwtUser): Promise<PurchaseOrderEntity> {
    const order = await this.orderRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!order) throw new NotFoundException('采购订单不存在')
    return order
  }

  private async findReceipt(id: number, user: JwtUser): Promise<GoodsReceiptEntity> {
    const receipt = await this.receiptRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!receipt) throw new NotFoundException('收货单不存在')
    return receipt
  }

  private async findStatement(id: number, user: JwtUser): Promise<VendorStatementEntity> {
    const statement = await this.statementRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!statement) throw new NotFoundException('对账单不存在')
    return statement
  }

  private async findWaybill(id: number, user: JwtUser): Promise<LogisticsWaybillEntity> {
    const waybill = await this.waybillRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!waybill) throw new NotFoundException('运单不存在')
    return waybill
  }

  // ------------------------------------------- 三方匹配证据链 / 框架协议 / 供应商黑名单

  /**
   * 三方匹配证据链：把订单行、收货行、发票行逐行比对结果固化为可追溯凭证。
   * 发票通过 bizType=PURCHASE_RECEIPT、bizId=收货单 ID 关联。
   */
  async runMatchEvidence(dto: MatchEvidenceDto, user: JwtUser): Promise<Record<string, unknown>> {
    const receipt = await this.findReceipt(dto.receiptId, user)
    const receiptLines = await this.receiptLineRepo.find({ where: { tenantId: user.tenantId, receiptId: receipt.id } })
    const order = receipt.orderId
      ? await this.orderRepo.findOne({ where: { id: receipt.orderId, tenantId: user.tenantId } })
      : null
    const orderLines = order
      ? await this.orderLineRepo.find({ where: { tenantId: user.tenantId, orderId: order.id } })
      : []
    const invoices = dto.invoiceId
      ? await this.invoiceRepo.find({ where: { tenantId: user.tenantId, bizType: 'PURCHASE_RECEIPT', bizId: receipt.id } })
      : await this.invoiceRepo.find({ where: { tenantId: user.tenantId, bizType: 'PURCHASE_RECEIPT', bizId: receipt.id } })
    const targetInvoice = dto.invoiceId ? invoices.find((item) => item.id === dto.invoiceId) ?? null : null
    const useInvoice = targetInvoice ?? invoices[0] ?? null

    const lines = receiptLines.map((rLine) => {
      const oLine = orderLines.find((item) => item.id === rLine.orderLineId) ?? orderLines.find((item) => item.productId === rLine.productId)
      const orderQty = oLine ? this.num(oLine.qty) : 0
      const orderPrice = oLine ? this.num(oLine.unitPrice) : 0
      const receiptQty = this.num(rLine.qty)
      const invoiceQty = useInvoice && orderPrice ? this.num(useInvoice.amount) / orderPrice : 0
      const invoicePrice = useInvoice && receiptQty ? this.num(useInvoice.amount) / receiptQty : 0
      const result = threeWayMatch({ orderQty, orderPrice, receiptQty, invoiceQty, invoicePrice })
      return {
        productId: rLine.productId,
        orderNo: order?.orderNo ?? '',
        receiptNo: receipt.receiptNo,
        invoiceNo: useInvoice?.invoiceNo ?? null,
        orderQty,
        receiptQty,
        invoiceQty,
        orderPrice,
        invoicePrice,
        matched: result.matched,
        status: result.status,
        issues: result.issues
      }
    })

    const chain = matchEvidenceChain(lines)
    await this.matchEvidenceRepo.delete({ tenantId: user.tenantId, receiptId: receipt.id })
    const rows = chain.evidence.map((line) =>
      this.matchEvidenceRepo.create({
        tenantId: user.tenantId,
        receiptId: receipt.id,
        receiptNo: receipt.receiptNo,
        orderId: order?.id ?? null,
        orderNo: order?.orderNo ?? null,
        invoiceId: useInvoice?.id ?? null,
        invoiceNo: useInvoice?.invoiceNo ?? null,
        productId: line.productId,
        orderQty: this.money3(line.orderQty),
        receiptQty: this.money3(line.receiptQty),
        invoiceQty: this.money3(line.invoiceQty),
        orderPrice: this.money(line.orderPrice),
        invoicePrice: this.money(line.invoicePrice),
        status: line.status,
        issues: line.issues,
        createdBy: user.userId
      })
    )
    const saved = rows.length ? await this.matchEvidenceRepo.save(rows) : []
    await this.auditService.record({
      bizType: 'purchase_receipt',
      bizId: receipt.id,
      action: 'MATCH_EVIDENCE',
      afterValue: { status: chain.status, matched: chain.matched, issueCount: chain.issueCount, count: saved.length }
    }, user)
    return { receiptId: receipt.id, ...chain, count: saved.length }
  }

  /** 三方匹配证据链列表 */
  async listMatchEvidence(receiptId: number, user: JwtUser): Promise<PurchaseMatchEvidenceEntity[]> {
    return this.matchEvidenceRepo.find({
      where: { tenantId: user.tenantId, receiptId },
      order: { id: 'ASC' }
    })
  }

  /** 框架协议建档（版本 1） */
  async createFrameAgreement(dto: CreateFrameAgreementDto, user: JwtUser): Promise<PurchaseFrameAgreementEntity> {
    await this.findSupplier(dto.supplierId, user)
    const state = frameAgreementState({
      version: 0,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
      totalQty: dto.totalQty == null ? null : this.num(dto.totalQty),
      usedQty: 0,
      at: this.today()
    })
    if (!state.valid) throw new BadRequestException(`框架协议校验未通过：${state.reason}`)
    const entity = this.frameAgreementRepo.create({
      tenantId: user.tenantId,
      agreementNo: dto.agreementNo,
      supplierId: dto.supplierId,
      productId: dto.productId ?? null,
      version: state.nextVersion,
      parentId: null,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
      totalQty: dto.totalQty ?? null,
      usedQty: '0.000',
      price: this.money(this.num(dto.price)),
      changeReason: dto.changeReason ?? null,
      status: 'ACTIVE',
      createdBy: user.userId
    })
    const saved = await this.frameAgreementRepo.save(entity)
    await this.auditService.record({ bizType: 'purchase_frame_agreement', bizId: saved.id, action: 'CREATE_FRAME_AGREEMENT', afterValue: saved }, user)
    return saved
  }

  /** 框架协议列表（含版本历史） */
  async listFrameAgreements(query: QueryPurchaseDto, user: JwtUser): Promise<PageResult<PurchaseFrameAgreementEntity>> {
    const where = scopeWhere<PurchaseFrameAgreementEntity>({
      tenantId: user.tenantId,
      ...(query.status ? { status: query.status } : {})
    }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.frameAgreementRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 框架协议升版：原版本置为 SUPERSEDED，新版本继承额度并累加已用量 */
  async upgradeFrameAgreement(id: number, dto: UpgradeFrameAgreementDto, user: JwtUser): Promise<PurchaseFrameAgreementEntity> {
    const current = await this.frameAgreementRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!current) throw new NotFoundException('框架协议不存在')
    const state = frameAgreementState({
      version: current.version,
      startDate: dto.startDate ?? current.startDate,
      endDate: dto.endDate ?? current.endDate,
      totalQty: dto.totalQty == null ? (current.totalQty == null ? null : this.num(current.totalQty)) : this.num(dto.totalQty),
      usedQty: this.num(current.usedQty),
      at: this.today()
    })
    if (!state.valid) throw new BadRequestException(`框架协议升版未通过：${state.reason}`)
    const before = { ...current }
    current.status = 'SUPERSEDED'
    await this.frameAgreementRepo.save(current)
    const entity = this.frameAgreementRepo.create({
      tenantId: user.tenantId,
      agreementNo: current.agreementNo,
      supplierId: current.supplierId,
      productId: current.productId,
      version: state.nextVersion,
      parentId: current.id,
      startDate: dto.startDate ?? current.startDate,
      endDate: dto.endDate ?? current.endDate,
      totalQty: dto.totalQty ?? current.totalQty,
      usedQty: current.usedQty,
      price: dto.price == null ? current.price : this.money(this.num(dto.price)),
      changeReason: dto.changeReason,
      status: 'ACTIVE',
      createdBy: user.userId
    })
    const saved = await this.frameAgreementRepo.save(entity)
    await this.auditService.record({
      bizType: 'purchase_frame_agreement',
      bizId: saved.id,
      action: 'UPGRADE_FRAME_AGREEMENT',
      beforeValue: before,
      afterValue: saved
    }, user)
    return saved
  }

  /** 供应商黑名单登记 */
  async addSupplierBlacklist(dto: CreateSupplierBlacklistDto, user: JwtUser): Promise<PurchaseSupplierBlacklistEntity> {
    const supplier = await this.findSupplier(dto.supplierId, user)
    const entity = this.blacklistRepo.create({
      tenantId: user.tenantId,
      supplierId: dto.supplierId,
      supplierName: dto.supplierName ?? supplier.supplierName ?? null,
      level: dto.level ?? 'MEDIUM',
      reason: dto.reason ?? null,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
      status: 'ACTIVE',
      createdBy: user.userId
    })
    const saved = await this.blacklistRepo.save(entity)
    if (supplier.blacklist !== 1) {
      supplier.blacklist = 1
      await this.supplierRepo.save(supplier)
    }
    await this.auditService.record({ bizType: 'purchase_supplier_blacklist', bizId: saved.id, action: 'ADD_BLACKLIST', afterValue: saved }, user)
    return saved
  }

  /** 解除供应商黑名单：失效全部生效记录并恢复下单准入 */
  async liftSupplierBlacklist(supplierId: number, user: JwtUser): Promise<{ supplierId: number; lifted: number }> {
    const supplier = await this.findSupplier(supplierId, user)
    const rules = await this.blacklistRepo.find({ where: { tenantId: user.tenantId, supplierId, status: 'ACTIVE' } })
    for (const rule of rules) {
      rule.status = 'LIFTED'
      await this.blacklistRepo.save(rule)
    }
    supplier.blacklist = 0
    await this.supplierRepo.save(supplier)
    await this.auditService.record({
      bizType: 'purchase_supplier_blacklist',
      bizId: supplierId,
      action: 'LIFT_BLACKLIST',
      afterValue: { supplierId, lifted: rules.length }
    }, user)
    return { supplierId, lifted: rules.length }
  }

  /** 供应商黑名单列表 */
  async listSupplierBlacklists(query: QueryPurchaseDto, user: JwtUser): Promise<PageResult<PurchaseSupplierBlacklistEntity>> {
    const where = scopeWhere<PurchaseSupplierBlacklistEntity>({
      tenantId: user.tenantId,
      ...(query.status ? { status: query.status } : {})
    }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.blacklistRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 供应商准入校验：命中黑名单时禁止下单 */
  async checkSupplierBlacklist(supplierId: number, user: JwtUser): Promise<{ hit: boolean; level: string | null; reason: string }> {
    const rules = await this.blacklistRepo.find({ where: { tenantId: user.tenantId, supplierId, status: 'ACTIVE' } })
    const result = supplierBlacklistHit(
      rules.map((item) => ({
        supplierId: item.supplierId,
        level: item.level,
        startDate: item.startDate,
        endDate: item.endDate
      })),
      supplierId,
      this.today()
    )
    if (result.hit) {
      await this.auditService.record({
        bizType: 'purchase_supplier_blacklist',
        bizId: supplierId,
        action: 'BLACKLIST_HIT',
        afterValue: result
      }, user)
    }
    return result
  }

  private num(value: unknown): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  private money(value: number): string {
    return this.num(value).toFixed(4)
  }

  private money3(value: number): string {
    return this.num(value).toFixed(3)
  }

  private dateStr(value: Date | string | null | undefined): string {
    if (!value) return ''
    if (typeof value === 'string') return value.slice(0, 10)
    return value.toISOString().slice(0, 10)
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10)
  }

  private number(prefix: string): string {
    return `${prefix}${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString('hex').toUpperCase()}`
  }
}
