import { randomBytes } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Between, In, Like, Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { scopeWhere } from '../../common/data-scope-context'
import {
  buildCommissionAccrualPlan,
  buildUnshippedList,
  buildVisitPlan,
  canTransitionComplaint,
  canTransitionCommission,
  computeCommission,
  computeReturnRate,
  evaluateComplaintReopen,
  evaluateComplaintSla,
  evaluateCommissionRuleConflict,
  isRuleEffective,
  resolvePromisedDate,
  summarizeVisitCoverage,
  type CommissionResult,
  type VisitPlanRow
} from '../../common/sales-crm-extension-rules'
import {
  buildProductReturnRate, buildPeriodReturnRate, buildQuotationFromTemplate, evaluateCreditFlow
} from '../../common/sales-p1-rules'
import { AuditService } from '../audit/audit.service'
import { FinanceIntegrationService } from '../finance/finance-integration.service'
import { CustomerEntity } from '../master-data/entities/customer.entity'
import { ProductEntity } from '../master-data/entities/product.entity'
import {
  SalesCommissionRecordEntity,
  SalesCommissionRuleEntity,
  SalesComplaintEntity,
  SalesComplaintLogEntity,
  SalesVisitEntity
} from './entities/sales-crm-extension.entity'
import {
  SaleOrderEntity, SaleOrderLineEntity, SaleReturnEntity, SaleReturnLineEntity
} from './entities/sales.entities'
import {
  CustomerCreditFlowEntity, QuotationTemplateEntity, QuotationTemplateLineEntity
} from './entities/sales-p1.entity'
import {
  AccrueCommissionDto,
  AssignComplaintDto,
  CalculateCommissionDto,
  CompleteVisitDto,
  ConfirmCommissionDto,
  CreateComplaintDto,
  CreateCommissionRuleDto,
  CreateVisitDto,
  PlanVisitsDto,
  QueryCommissionRecordDto,
  QueryCommissionRuleDto,
  QueryComplaintDto,
  ApplyQuotationTemplateDto, CreateCreditFlowDto, CreateQuotationTemplateDto, QueryReturnRateDto,
  QueryUnshippedDto,
  QueryVisitDto,
  ReopenComplaintDto,
  ResolveComplaintDto,
  UpdateCommissionRuleDto
} from './sales-crm-extension.dto'

/** 有效订单状态：进入有效销售口径 */
const EFFECTIVE_ORDER_STATUS = ['APPROVED', 'PARTIAL', 'DONE']
/** 有效退货状态：已审批/已完成的退货计入退货率 */
const EFFECTIVE_RETURN_STATUS = ['APPROVED', 'DONE']

/**
 * 销售域 CRM 扩展服务：
 * - 销售佣金规则与佣金核算（比例 / 固定金额 / 阶梯三种计提方式）
 * - 客户投诉工单（SLA 时效监控 + 状态机流转）
 * - 客户回访记录与回访计划
 * - 未发货清单（订单行减已发货）
 * - 退货率分析
 */
@Injectable()
export class SalesCrmExtensionService {
  constructor(
    @InjectRepository(SalesCommissionRuleEntity) private readonly ruleRepo: Repository<SalesCommissionRuleEntity>,
    @InjectRepository(SalesCommissionRecordEntity) private readonly recordRepo: Repository<SalesCommissionRecordEntity>,
    @InjectRepository(SalesComplaintEntity) private readonly complaintRepo: Repository<SalesComplaintEntity>,
    @InjectRepository(SalesComplaintLogEntity) private readonly complaintLogRepo: Repository<SalesComplaintLogEntity>,
    @InjectRepository(SalesVisitEntity) private readonly visitRepo: Repository<SalesVisitEntity>,
    @InjectRepository(SaleOrderEntity) private readonly orderRepo: Repository<SaleOrderEntity>,
    @InjectRepository(SaleOrderLineEntity) private readonly orderLineRepo: Repository<SaleOrderLineEntity>,
    @InjectRepository(SaleReturnEntity) private readonly returnRepo: Repository<SaleReturnEntity>,
    @InjectRepository(SaleReturnLineEntity) private readonly returnLineRepo: Repository<SaleReturnLineEntity>,
    @InjectRepository(CustomerEntity) private readonly customerRepo: Repository<CustomerEntity>,
    @InjectRepository(ProductEntity) private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(QuotationTemplateEntity) private readonly quoteTemplateRepo: Repository<QuotationTemplateEntity>,
    @InjectRepository(QuotationTemplateLineEntity) private readonly quoteTemplateLineRepo: Repository<QuotationTemplateLineEntity>,
    @InjectRepository(CustomerCreditFlowEntity) private readonly creditFlowRepo: Repository<CustomerCreditFlowEntity>,
    private readonly auditService: AuditService,
    private readonly financeIntegration: FinanceIntegrationService
  ) {}

  /* ------------------------------ 佣金规则 ------------------------------ */

  /** 佣金规则列表 */
  async listRules(query: QueryCommissionRuleDto, user: JwtUser): Promise<PageResult<SalesCommissionRuleEntity>> {
    const where = scopeWhere<SalesCommissionRuleEntity>({
      tenantId: user.tenantId,
      ...(query.ruleType ? { ruleType: query.ruleType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { ruleName: Like(`%${query.keyword}%`) } : {})
    }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.ruleRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 新增佣金规则 */
  async createRule(dto: CreateCommissionRuleDto, user: JwtUser): Promise<SalesCommissionRuleEntity> {
    this.validateRulePayload(dto.ruleType, dto.rate, dto.fixedAmount, dto.tiers)
    const exists = await this.ruleRepo.findOne({ where: { tenantId: user.tenantId, ruleCode: dto.ruleCode } })
    if (exists) throw new BadRequestException(`佣金规则编码已存在：${dto.ruleCode}`)
    await this.assertRuleNoConflict({
      salesRepId: dto.salesRepId ?? null,
      effectiveFrom: dto.effectiveFrom ?? null,
      effectiveTo: dto.effectiveTo ?? null,
      status: 'ACTIVE'
    }, user)
    const rule = await this.ruleRepo.save(this.ruleRepo.create({
      tenantId: user.tenantId,
      ruleCode: dto.ruleCode,
      ruleName: dto.ruleName,
      ruleType: dto.ruleType,
      rate: dto.rate ?? null,
      fixedAmount: dto.fixedAmount ?? null,
      tiers: (dto.tiers ?? null) as Array<{ min: number; rate: number }> | null,
      salesRepId: dto.salesRepId ?? null,
      effectiveFrom: dto.effectiveFrom ?? null,
      effectiveTo: dto.effectiveTo ?? null,
      status: 'ACTIVE',
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'sales_commission_rule', bizId: rule.id, action: 'CREATE_COMMISSION_RULE', afterValue: rule }, user)
    return rule
  }

  /** 修改佣金规则 */
  async updateRule(id: number, dto: UpdateCommissionRuleDto, user: JwtUser): Promise<SalesCommissionRuleEntity> {
    const rule = await this.findRule(id, user)
    const nextType = dto.ruleType ?? rule.ruleType
    const nextRate = dto.rate ?? rule.rate ?? undefined
    const nextFixed = dto.fixedAmount ?? rule.fixedAmount ?? undefined
    const nextTiers = dto.tiers ?? (rule.tiers ?? undefined)
    this.validateRulePayload(nextType, nextRate, nextFixed, nextTiers)
    if (dto.ruleName !== undefined) rule.ruleName = dto.ruleName
    rule.ruleType = nextType
    rule.rate = nextRate ?? null
    rule.fixedAmount = nextFixed ?? null
    rule.tiers = (nextTiers ?? null) as Array<{ min: number; rate: number }> | null
    if (dto.salesRepId !== undefined) rule.salesRepId = dto.salesRepId
    if (dto.effectiveFrom !== undefined) rule.effectiveFrom = dto.effectiveFrom
    if (dto.effectiveTo !== undefined) rule.effectiveTo = dto.effectiveTo
    if (dto.status !== undefined) rule.status = dto.status
    await this.assertRuleNoConflict({
      id: rule.id,
      salesRepId: rule.salesRepId ?? null,
      effectiveFrom: rule.effectiveFrom ?? null,
      effectiveTo: rule.effectiveTo ?? null,
      status: rule.status
    }, user)
    const saved = await this.ruleRepo.save(rule)
    await this.auditService.record({ bizType: 'sales_commission_rule', bizId: saved.id, action: 'UPDATE_COMMISSION_RULE', afterValue: saved }, user)
    return saved
  }

  /* ------------------------------ 佣金核算 ------------------------------ */

  /** 佣金试算：不落库，供前端确认 */
  async previewCommission(ruleId: number, orderId: number, user: JwtUser): Promise<{
    ruleId: number
    ruleName: string
    orderId: number
    orderNo: string
    orderAmount: number
    returnAmount: number
    accumulatedAmount: number
    period: string
    result: CommissionResult
  }> {
    const rule = await this.findRule(ruleId, user)
    const order = await this.findOrder(orderId, user)
    const returnAmount = await this.sumOrderReturnAmount(order.id, user)
    const accumulatedAmount = await this.sumAccumulatedAmount(rule.salesRepId, user)
    const result = computeCommission(
      { type: rule.ruleType as 'RATE' | 'FIXED' | 'TIER', rate: this.num(rule.rate), fixedAmount: this.num(rule.fixedAmount), tiers: rule.tiers ?? undefined },
      { orderAmount: this.num(order.totalAmount), returnAmount, accumulatedAmount }
    )
    return {
      ruleId: rule.id,
      ruleName: rule.ruleName,
      orderId: order.id,
      orderNo: order.orderNo,
      orderAmount: this.num(order.totalAmount),
      returnAmount,
      accumulatedAmount,
      period: this.periodOf(order.orderDate),
      result
    }
  }

  /** 佣金核算：按订单计提佣金并生成核算记录（同一订单同一规则重复计提覆盖） */
  async calculateCommission(dto: CalculateCommissionDto, user: JwtUser): Promise<SalesCommissionRecordEntity> {
    const rule = await this.findRule(dto.ruleId, user)
    const order = await this.findOrder(dto.orderId, user)
    if (!EFFECTIVE_ORDER_STATUS.includes(order.status)) {
      throw new BadRequestException(`订单状态 ${order.status} 不参与佣金核算`)
    }
    if (!isRuleEffective({ effectiveFrom: rule.effectiveFrom, effectiveTo: rule.effectiveTo, status: rule.status }, order.orderDate)) {
      throw new BadRequestException('佣金规则在订单日期不在生效期内')
    }
    const returnAmount = await this.sumOrderReturnAmount(order.id, user)
    const accumulatedAmount = await this.sumAccumulatedAmount(rule.salesRepId, user)
    const result = computeCommission(
      { type: rule.ruleType as 'RATE' | 'FIXED' | 'TIER', rate: this.num(rule.rate), fixedAmount: this.num(rule.fixedAmount), tiers: rule.tiers ?? undefined },
      { orderAmount: this.num(order.totalAmount), returnAmount, accumulatedAmount }
    )
    const period = dto.period ?? this.periodOf(order.orderDate)
    const existing = await this.recordRepo.findOne({
      where: { tenantId: user.tenantId, ruleId: rule.id, orderId: order.id, period }
    })
    const record = existing
      ? this.recordRepo.create({
        ...existing,
        orderNo: order.orderNo,
        salesRepId: rule.salesRepId,
        orderAmount: this.money(this.num(order.totalAmount)),
        returnAmount: this.money(returnAmount),
        commissionAmount: this.money(result.commissionAmount),
        status: 'PENDING',
        remark: dto.remark ?? existing.remark
      })
      : this.recordRepo.create({
        tenantId: user.tenantId,
        ruleId: rule.id,
        orderId: order.id,
        orderNo: order.orderNo,
        salesRepId: rule.salesRepId,
        orderAmount: this.money(this.num(order.totalAmount)),
        returnAmount: this.money(returnAmount),
        commissionAmount: this.money(result.commissionAmount),
        period,
        status: 'PENDING',
        remark: dto.remark ?? null,
        createdBy: user.userId
      })
    const saved = await this.recordRepo.save(record)
    await this.auditService.record({
      bizType: 'sales_commission_record',
      bizId: saved.id,
      action: 'CALCULATE_COMMISSION',
      afterValue: { ...saved, reason: result.reason }
    }, user)
    return saved
  }

  /** 佣金核算记录列表 */
  async listRecords(query: QueryCommissionRecordDto, user: JwtUser): Promise<PageResult<SalesCommissionRecordEntity>> {
    const where = scopeWhere<SalesCommissionRecordEntity>({
      tenantId: user.tenantId,
      ...(query.period ? { period: query.period } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.salesRepId ? { salesRepId: query.salesRepId } : {})
    }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.recordRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 佣金确认 */
  async confirmRecord(id: number, dto: ConfirmCommissionDto, user: JwtUser): Promise<SalesCommissionRecordEntity> {
    const record = await this.findRecord(id, user)
    const check = canTransitionCommission(record.status, 'CONFIRMED')
    if (!check.allowed) throw new BadRequestException(check.reason)
    record.status = 'CONFIRMED'
    if (dto.remark !== undefined) record.remark = dto.remark
    const saved = await this.recordRepo.save(record)
    await this.auditService.record({ bizType: 'sales_commission_record', bizId: saved.id, action: 'CONFIRM_COMMISSION', afterValue: saved }, user)
    return saved
  }

  /** 佣金发放：提供收款方时自动生成佣金应付单，实现发放与财务联动 */
  async payRecord(id: number, dto: ConfirmCommissionDto, user: JwtUser): Promise<SalesCommissionRecordEntity> {
    const record = await this.findRecord(id, user)
    const check = canTransitionCommission(record.status, 'PAID')
    if (!check.allowed) throw new BadRequestException(check.reason)
    record.status = 'PAID'
    record.paidAt = new Date()
    if (dto.remark !== undefined) record.remark = dto.remark
    if (dto.supplierId) {
      const payable = await this.financeIntegration.ensureCommissionPayable({
        supplierId: dto.supplierId,
        sourceId: record.id,
        sourceNo: record.orderNo ?? `COMM-${record.id}`,
        amount: record.commissionAmount,
        remark: `销售佣金发放 #${record.id}`
      }, user)
      record.payableId = payable.id
      record.payableNo = payable.sourceNo ?? `AP-${payable.id}`
    } else if (!record.remark) {
      record.remark = '未指定收款方，未自动生成应付单，请手工在财务模块生成'
    }
    const saved = await this.recordRepo.save(record)
    await this.auditService.record({ bizType: 'sales_commission_record', bizId: saved.id, action: 'PAY_COMMISSION', afterValue: { payableId: saved.payableId, payableNo: saved.payableNo } }, user)
    return saved
  }

  /** 佣金作废 */
  async cancelRecord(id: number, dto: ConfirmCommissionDto, user: JwtUser): Promise<SalesCommissionRecordEntity> {
    const record = await this.findRecord(id, user)
    const check = canTransitionCommission(record.status, 'CANCELLED')
    if (!check.allowed) throw new BadRequestException(check.reason)
    record.status = 'CANCELLED'
    if (dto.remark !== undefined) record.remark = dto.remark
    const saved = await this.recordRepo.save(record)
    await this.auditService.record({ bizType: 'sales_commission_record', bizId: saved.id, action: 'CANCEL_COMMISSION', afterValue: saved }, user)
    return saved
  }

  /** 佣金汇总：按业务员统计 */
  async summarizeRecords(period: string | undefined, user: JwtUser): Promise<{
    period: string
    totalAmount: number
    totalCount: number
    bySalesRep: Array<{ salesRepId: number | null; amount: number; count: number }>
  }> {
    const where = scopeWhere<SalesCommissionRecordEntity>({
      tenantId: user.tenantId,
      ...(period ? { period } : {})
    }, user, { ownerField: 'createdBy' })
    const records = await this.recordRepo.find({ where })
    const valid = records.filter((item) => ['CONFIRMED', 'PAID'].includes(item.status))
    const grouped = new Map<string, { salesRepId: number | null; amount: number; count: number }>()
    for (const item of valid) {
      const key = String(item.salesRepId ?? 0)
      const bucket = grouped.get(key) ?? { salesRepId: item.salesRepId ?? null, amount: 0, count: 0 }
      bucket.amount = Number((bucket.amount + this.num(item.commissionAmount)).toFixed(4))
      bucket.count += 1
      grouped.set(key, bucket)
    }
    return {
      period: period ?? this.periodOf(this.today()),
      totalAmount: Number(valid.reduce((sum, item) => sum + this.num(item.commissionAmount), 0).toFixed(4)),
      totalCount: valid.length,
      bySalesRep: [...grouped.values()].sort((a, b) => b.amount - a.amount)
    }
  }

  /** 佣金批量计提：按期间对生效订单批量生成佣金记录（已计提自动跳过） */
  async accrueCommissions(dto: AccrueCommissionDto, user: JwtUser): Promise<{
    period: string
    created: number
    skipped: number
    totalAmount: number
    records: SalesCommissionRecordEntity[]
  }> {
    const rules = await this.ruleRepo.find({ where: { tenantId: user.tenantId, status: 'ACTIVE' } })
    const targetRules = dto.ruleId ? rules.filter((item) => item.id === dto.ruleId) : rules
    if (targetRules.length === 0) throw new BadRequestException('没有可用于计提的生效佣金规则')
    // 限定销售员的规则需按单据人工指定归属，批量计提仅处理全员规则
    const globalRules = targetRules.filter((item) => item.salesRepId === null)
    if (globalRules.length === 0) throw new BadRequestException('所选规则均限定销售员，请按订单单独计提')
    const orders = await this.orderRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const existing = await this.recordRepo.find({ where: { tenantId: user.tenantId, period: dto.period } })
    const takenKeys = existing.map((item) => `${item.ruleId}-${item.orderId}`)
    const items: Array<{ ruleId: number; orderId: number; orderNo: string; salesRepId: number | null; orderAmount: number; returnAmount: number; period: string }> = []
    for (const rule of globalRules) {
      for (const order of orders) {
        if (this.periodOf(order.orderDate) !== dto.period) continue
        if (!EFFECTIVE_ORDER_STATUS.includes(order.status)) continue
        if (!isRuleEffective({ effectiveFrom: rule.effectiveFrom, effectiveTo: rule.effectiveTo, status: rule.status }, order.orderDate)) continue
        items.push({
          ruleId: rule.id,
          orderId: order.id,
          orderNo: order.orderNo,
          salesRepId: rule.salesRepId,
          orderAmount: this.num(order.totalAmount),
          returnAmount: await this.sumOrderReturnAmount(order.id, user),
          period: dto.period
        })
      }
    }
    const plan = buildCommissionAccrualPlan(items, takenKeys)
    const created: SalesCommissionRecordEntity[] = []
    for (const item of plan) {
      const rule = targetRules.find((entry) => entry.id === item.ruleId)
      if (!rule) continue
      const accumulatedAmount = await this.sumAccumulatedAmount(rule.salesRepId, user)
      const result = computeCommission(
        { type: rule.ruleType as 'RATE' | 'FIXED' | 'TIER', rate: this.num(rule.rate), fixedAmount: this.num(rule.fixedAmount), tiers: rule.tiers ?? undefined },
        { orderAmount: item.orderAmount, returnAmount: item.returnAmount, accumulatedAmount }
      )
      const record = await this.recordRepo.save(this.recordRepo.create({
        tenantId: user.tenantId,
        ruleId: rule.id,
        orderId: item.orderId,
        orderNo: item.orderNo,
        salesRepId: rule.salesRepId,
        orderAmount: this.money(item.orderAmount),
        returnAmount: this.money(item.returnAmount),
        commissionAmount: this.money(result.commissionAmount),
        period: dto.period,
        status: 'PENDING',
        remark: `批量计提 ${dto.period}`
      }))
      created.push(record)
    }
    await this.auditService.record({
      bizType: 'sales_commission_record', bizId: 0, action: 'ACCRUE_COMMISSION',
      afterValue: { period: dto.period, created: created.length, skipped: items.length - plan.length }
    }, user)
    return {
      period: dto.period,
      created: created.length,
      skipped: items.length - plan.length,
      totalAmount: Number(created.reduce((sum, item) => sum + this.num(item.commissionAmount), 0).toFixed(4)),
      records: created
    }
  }

  /* ------------------------------ 投诉工单 ------------------------------ */

  /** 投诉工单列表（含 SLA 时效统计） */
  async listComplaints(query: QueryComplaintDto, user: JwtUser): Promise<PageResult<SalesComplaintEntity> & { slaSummary: { total: number; overdue: number } }> {
    const where = scopeWhere<SalesComplaintEntity>({
      tenantId: user.tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {})
    }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.complaintRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    const now = new Date()
    const openList = await this.complaintRepo.find({ where: { tenantId: user.tenantId, status: In(['OPEN', 'PROCESSING']) } })
    const overdueCount = openList.filter((item) => this.slaOf(item, now).overdue).length
    const filtered = query.overdueOnly === 'true' ? list.filter((item) => this.slaOf(item, now).overdue) : list
    const page = buildPageResult(filtered, query.overdueOnly === 'true' ? filtered.length : total, query.page, query.pageSize)
    return { ...page, slaSummary: { total: openList.length, overdue: overdueCount } }
  }

  /** 投诉工单详情 */
  async complaintDetail(id: number, user: JwtUser): Promise<{
    complaint: SalesComplaintEntity
    sla: { dueHours: number; overdue: boolean; overdueHours: number; closed: boolean }
    order: SaleOrderEntity | null
    logs: SalesComplaintLogEntity[]
  }> {
    const complaint = await this.findComplaint(id, user)
    const order = complaint.orderId
      ? await this.orderRepo.findOne({ where: { id: complaint.orderId, tenantId: user.tenantId, isDeleted: 0 } })
      : null
    const logs = await this.complaintLogRepo.find({ where: { tenantId: user.tenantId, complaintId: id }, order: { id: 'ASC' } })
    return { complaint, sla: this.slaOf(complaint, new Date()), order, logs }
  }

  /** 新建投诉工单 */
  async createComplaint(dto: CreateComplaintDto, user: JwtUser): Promise<SalesComplaintEntity> {
    const customer = await this.customerRepo.findOne({ where: { id: dto.customerId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!customer) throw new NotFoundException('客户不存在')
    if (dto.orderId) {
      const order = await this.findOrder(dto.orderId, user)
      if (order.customerId !== dto.customerId) throw new BadRequestException('投诉关联订单与客户不匹配')
    }
    const complaint = await this.complaintRepo.save(this.complaintRepo.create({
      tenantId: user.tenantId,
      complaintNo: this.number('CP'),
      customerId: dto.customerId,
      orderId: dto.orderId ?? null,
      complaintType: dto.complaintType ?? 'SERVICE',
      title: dto.title,
      description: dto.description ?? null,
      severity: dto.severity ?? 'MEDIUM',
      status: 'OPEN',
      assigneeId: null,
      resolution: null,
      resolvedAt: null,
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'sales_complaint', bizId: complaint.id, action: 'CREATE_COMPLAINT', afterValue: complaint }, user)
    await this.writeComplaintLog(complaint.id, 'CREATE', '', 'OPEN', `投诉创建：${complaint.title}`, user)
    return complaint
  }

  /** 投诉派单 */
  async assignComplaint(id: number, dto: AssignComplaintDto, user: JwtUser): Promise<SalesComplaintEntity> {
    const complaint = await this.findComplaint(id, user)
    const check = canTransitionComplaint(complaint.status, 'PROCESSING')
    if (!check.allowed) throw new BadRequestException(check.reason)
    complaint.assigneeId = dto.assigneeId
    complaint.status = 'PROCESSING'
    const saved = await this.complaintRepo.save(complaint)
    await this.auditService.record({ bizType: 'sales_complaint', bizId: saved.id, action: 'ASSIGN_COMPLAINT', afterValue: { assigneeId: dto.assigneeId, status: saved.status } }, user)
    await this.writeComplaintLog(saved.id, 'ASSIGN', 'OPEN', 'PROCESSING', `派单至处理人 #${dto.assigneeId}`, user)
    return saved
  }

  /** 投诉处理完成 */
  async resolveComplaint(id: number, dto: ResolveComplaintDto, user: JwtUser): Promise<SalesComplaintEntity> {
    const complaint = await this.findComplaint(id, user)
    const check = canTransitionComplaint(complaint.status, 'RESOLVED')
    if (!check.allowed) throw new BadRequestException(check.reason)
    complaint.resolution = dto.resolution
    complaint.status = 'RESOLVED'
    complaint.resolvedAt = new Date()
    const saved = await this.complaintRepo.save(complaint)
    await this.auditService.record({ bizType: 'sales_complaint', bizId: saved.id, action: 'RESOLVE_COMPLAINT', afterValue: saved }, user)
    await this.writeComplaintLog(saved.id, 'RESOLVE', 'PROCESSING', 'RESOLVED', `处理结果：${dto.resolution}`, user)
    return saved
  }

  /** 投诉归档关闭 */
  async closeComplaint(id: number, user: JwtUser): Promise<SalesComplaintEntity> {
    const complaint = await this.findComplaint(id, user)
    const check = canTransitionComplaint(complaint.status, 'CLOSED')
    if (!check.allowed) throw new BadRequestException(check.reason)
    complaint.status = 'CLOSED'
    if (!complaint.resolvedAt) complaint.resolvedAt = new Date()
    const saved = await this.complaintRepo.save(complaint)
    await this.auditService.record({ bizType: 'sales_complaint', bizId: saved.id, action: 'CLOSE_COMPLAINT', afterValue: saved }, user)
    await this.writeComplaintLog(saved.id, 'CLOSE', 'RESOLVED', 'CLOSED', '工单归档关闭', user)
    return saved
  }

  /** 投诉工单重开：仅已关闭工单可重开，重开次数受控 */
  async reopenComplaint(id: number, dto: ReopenComplaintDto, user: JwtUser): Promise<SalesComplaintEntity> {
    const complaint = await this.findComplaint(id, user)
    const check = evaluateComplaintReopen({ status: complaint.status, reopenCount: complaint.reopenCount ?? 0 })
    if (!check.allowed) throw new BadRequestException(check.reason)
    const fromStatus = complaint.status
    complaint.status = 'PROCESSING'
    complaint.reopenCount = (complaint.reopenCount ?? 0) + 1
    complaint.resolvedAt = null
    complaint.lastActionAt = new Date()
    const saved = await this.complaintRepo.save(complaint)
    await this.auditService.record({ bizType: 'sales_complaint', bizId: saved.id, action: 'REOPEN_COMPLAINT', afterValue: { reopenCount: saved.reopenCount } }, user)
    await this.writeComplaintLog(saved.id, 'REOPEN', fromStatus, 'PROCESSING', `重开原因：${dto.reason}`, user)
    return saved
  }

  /* ------------------------------ 客户回访 ------------------------------ */

  /** 回访记录列表 */
  async listVisits(query: QueryVisitDto, user: JwtUser): Promise<PageResult<SalesVisitEntity>> {
    const where = scopeWhere<SalesVisitEntity>({
      tenantId: user.tenantId,
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.channel ? { channel: query.channel } : {})
    }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.visitRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 新增回访记录 */
  async createVisit(dto: CreateVisitDto, user: JwtUser): Promise<SalesVisitEntity> {
    const customer = await this.customerRepo.findOne({ where: { id: dto.customerId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!customer) throw new NotFoundException('客户不存在')
    const visit = await this.visitRepo.save(this.visitRepo.create({
      tenantId: user.tenantId,
      visitNo: this.number('VS'),
      customerId: dto.customerId,
      salesRepId: dto.salesRepId ?? user.userId,
      visitDate: dto.visitDate ?? this.today(),
      channel: dto.channel ?? 'PHONE',
      content: dto.content ?? null,
      feedback: dto.feedback ?? null,
      nextVisitAt: dto.nextVisitAt ? new Date(dto.nextVisitAt) : null,
      status: dto.status ?? 'DONE',
      satisfaction: dto.satisfaction ?? null,
      completedAt: (dto.status ?? 'DONE') === 'DONE' ? new Date() : null,
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'sales_visit', bizId: visit.id, action: 'CREATE_VISIT', afterValue: visit }, user)
    return visit
  }

  /** 回访计划：登记下次回访时间 */
  async planVisit(id: number, nextVisitAt: string, user: JwtUser): Promise<SalesVisitEntity> {
    const visit = await this.findVisit(id, user)
    visit.nextVisitAt = new Date(nextVisitAt)
    visit.status = 'PLANNED'
    const saved = await this.visitRepo.save(visit)
    await this.auditService.record({ bizType: 'sales_visit', bizId: saved.id, action: 'PLAN_VISIT', afterValue: { nextVisitAt: saved.nextVisitAt } }, user)
    return saved
  }

  /** 完成回访：登记内容、满意度评分与下次回访安排 */
  async completeVisit(id: number, dto: CompleteVisitDto, user: JwtUser): Promise<SalesVisitEntity> {
    const visit = await this.findVisit(id, user)
    if (visit.status === 'DONE') throw new BadRequestException('该回访记录已完成')
    if (dto.content !== undefined) visit.content = dto.content
    if (dto.feedback !== undefined) visit.feedback = dto.feedback
    if (dto.satisfaction !== undefined) visit.satisfaction = dto.satisfaction
    if (dto.nextVisitAt !== undefined) visit.nextVisitAt = new Date(dto.nextVisitAt)
    visit.status = 'DONE'
    visit.completedAt = new Date()
    const saved = await this.visitRepo.save(visit)
    await this.auditService.record({ bizType: 'sales_visit', bizId: saved.id, action: 'COMPLETE_VISIT', afterValue: { satisfaction: saved.satisfaction, nextVisitAt: saved.nextVisitAt } }, user)
    return saved
  }

  /** 批量生成回访计划：按客户回访周期推算到期日并落库 */
  async planVisits(dto: PlanVisitsDto, user: JwtUser): Promise<{ created: number; plans: VisitPlanRow[] }> {
    const intervalDays = dto.intervalDays ?? 30
    const customers = await this.customerRepo.find({
      where: {
        tenantId: user.tenantId,
        isDeleted: 0,
        ...(dto.customerIds && dto.customerIds.length > 0 ? { id: In(dto.customerIds) } : {})
      }
    })
    if (customers.length === 0) return { created: 0, plans: [] }
    const customerIds = customers.map((item) => item.id)
    const visits = await this.visitRepo.find({ where: { tenantId: user.tenantId, customerId: In(customerIds) }, order: { id: 'DESC' } })
    const lastVisitMap = new Map<number, Date | null>()
    for (const visit of visits) {
      if (!lastVisitMap.has(visit.customerId)) lastVisitMap.set(visit.customerId, visit.visitDate ? new Date(visit.visitDate) : null)
    }
    const now = new Date()
    const rows = buildVisitPlan(
      customers.map((customer) => ({
        customerId: customer.id,
        customerName: customer.customerName,
        salesRepId: dto.salesRepId ?? null,
        intervalDays,
        lastVisitAt: lastVisitMap.get(customer.id) ? (lastVisitMap.get(customer.id) as Date).toISOString() : null
      })),
      now
    )
    const planned = rows.filter((row) => row.overdueDays === 0 || row.overdueDays > 0)
    const created: SalesVisitEntity[] = []
    for (const row of planned) {
      const existing = await this.visitRepo.findOne({
        where: { tenantId: user.tenantId, customerId: row.customerId, status: 'PLANNED' }
      })
      if (existing) continue
      const visit = await this.visitRepo.save(this.visitRepo.create({
        tenantId: user.tenantId,
        visitNo: this.number('VS'),
        customerId: row.customerId,
        salesRepId: row.salesRepId ?? user.userId,
        visitDate: row.visitDate,
        channel: dto.channel ?? 'PHONE',
        content: null,
        feedback: null,
        nextVisitAt: new Date(row.visitDate),
        status: 'PLANNED',
        createdBy: user.userId
      }))
      created.push(visit)
    }
    await this.auditService.record({
      bizType: 'sales_visit', bizId: 0, action: 'PLAN_VISITS',
      afterValue: { intervalDays, created: created.length, customerCount: customers.length }
    }, user)
    return { created: created.length, plans: rows }
  }

  /** 回访覆盖率统计：计划数、完成数、超期数、满意度均值 */
  async visitSummary(user: JwtUser): Promise<{
    total: number
    planned: number
    done: number
    overdue: number
    rate: number
    avgSatisfaction: number
  }> {
    const visits = await this.visitRepo.find({ where: { tenantId: user.tenantId } })
    return summarizeVisitCoverage(
      visits.map((item) => ({ status: item.status, visitDate: item.visitDate, satisfaction: item.satisfaction })),
      new Date()
    )
  }

  /* ------------------------------ 未发货清单 ------------------------------ */

  /** 未发货清单：订单行数量减已发货数量，标记逾期 */
  async unshippedList(query: QueryUnshippedDto, user: JwtUser): Promise<{
    list: Array<ReturnType<typeof buildUnshippedList>[number]>
    summary: { totalRows: number; overdueRows: number; totalUnshippedQty: number }
  }> {
    const orders = await this.orderRepo.find({
      where: {
        tenantId: user.tenantId,
        isDeleted: 0,
        status: In(EFFECTIVE_ORDER_STATUS),
        ...(query.customerId ? { customerId: query.customerId } : {})
      }
    })
    if (orders.length === 0) return { list: [], summary: { totalRows: 0, overdueRows: 0, totalUnshippedQty: 0 } }
    const orderIds = orders.map((item) => item.id)
    const lines = await this.orderLineRepo.find({ where: { tenantId: user.tenantId, orderId: In(orderIds) } })
    const customers = await this.customerRepo.find({ where: { tenantId: user.tenantId } })
    const products = await this.productRepo.find({ where: { tenantId: user.tenantId } })
    const customerNames = new Map(customers.map((item) => [item.id, item.customerName]))
    const productNames = new Map(products.map((item) => [item.id, item.productName]))
    const orderMap = new Map(orders.map((item) => [item.id, item]))
    const rows = buildUnshippedList(
      lines.map((line) => {
        const order = orderMap.get(line.orderId)!
        return {
          orderId: order.id,
          orderNo: order.orderNo,
          customerId: order.customerId,
          customerName: customerNames.get(order.customerId) ?? '',
          productId: line.productId,
          productName: productNames.get(line.productId) ?? '',
          orderedQty: this.num(line.qty),
          shippedQty: this.num(line.shippedQty),
          orderDate: order.orderDate,
          promisedDate: resolvePromisedDate(order.orderDate)
        }
      }),
      new Date()
    )
    const filtered = query.overdueOnly === 'true' ? rows.filter((row) => row.overdue) : rows
    return {
      list: filtered,
      summary: {
        totalRows: filtered.length,
        overdueRows: filtered.filter((row) => row.overdue).length,
        totalUnshippedQty: Number(filtered.reduce((sum, row) => sum + row.unshippedQty, 0).toFixed(3))
      }
    }
  }

  /* ------------------------------ 退货率 ------------------------------ */

  /** 退货率分析：退货金额 / 销售金额 */
  async returnRate(query: QueryReturnRateDto, user: JwtUser): Promise<{
    salesAmount: number
    returnAmount: number
    rate: number
    percent: string
    orderCount: number
    returnCount: number
    byCustomer: Array<{ customerId: number; customerName: string; salesAmount: number; returnAmount: number; percent: string }>
    byProduct: Array<Record<string, unknown>>
    byPeriod: Array<Record<string, unknown>>
  }> {
    const orders = await this.orderRepo.find({
      where: {
        tenantId: user.tenantId,
        isDeleted: 0,
        status: In(EFFECTIVE_ORDER_STATUS),
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.beginDate || query.endDate
          ? {
            orderDate: query.beginDate && query.endDate
              ? Between(query.beginDate, query.endDate)
              : query.beginDate
                ? Between(query.beginDate, '2999-12-31')
                : Between('1970-01-01', query.endDate!)
          }
          : {})
      }
    })
    const returns = await this.returnRepo.find({
      where: {
        tenantId: user.tenantId,
        isDeleted: 0,
        status: In(EFFECTIVE_RETURN_STATUS),
        ...(query.customerId ? { customerId: query.customerId } : {}),
        ...(query.beginDate || query.endDate
          ? {
            createdAt: query.beginDate && query.endDate
              ? Between(new Date(`${query.beginDate}T00:00:00`), new Date(`${query.endDate}T23:59:59`))
              : query.beginDate
                ? Between(new Date(`${query.beginDate}T00:00:00`), new Date('2999-12-31'))
                : Between(new Date('1970-01-01'), new Date(`${query.endDate!}T23:59:59`))
          }
          : {})
      }
    })
    const salesAmount = orders.reduce((sum, item) => sum + this.num(item.totalAmount), 0)
    const returnAmount = returns.reduce((sum, item) => sum + this.num(item.refundAmount), 0)
    const rate = computeReturnRate(salesAmount, returnAmount)

    const customers = await this.customerRepo.find({ where: { tenantId: user.tenantId } })
    const customerNames = new Map(customers.map((item) => [item.id, item.customerName]))
    const customerIds = new Set<number>([...orders.map((item) => item.customerId), ...returns.map((item) => item.customerId)])
    const byCustomer = [...customerIds].map((customerId) => {
      const customerSales = orders.filter((item) => item.customerId === customerId).reduce((sum, item) => sum + this.num(item.totalAmount), 0)
      const customerReturn = returns.filter((item) => item.customerId === customerId).reduce((sum, item) => sum + this.num(item.refundAmount), 0)
      const stat = computeReturnRate(customerSales, customerReturn)
      return {
        customerId,
        customerName: customerNames.get(customerId) ?? '',
        salesAmount: Number(customerSales.toFixed(4)),
        returnAmount: Number(customerReturn.toFixed(4)),
        percent: stat.percent
      }
    }).sort((a, b) => b.returnAmount - a.returnAmount)

    let byProduct: ReturnType<typeof buildProductReturnRate> = []
    let byPeriod: ReturnType<typeof buildPeriodReturnRate> = []
    if (query.groupBy === 'PRODUCT' || query.productId) {
      const returnLines = await this.returnLineRepo.find({
        where: { tenantId: user.tenantId, returnId: In(returns.map((item) => item.id)) }
      })
      const orderLines = await this.orderLineRepo.find({
        where: { tenantId: user.tenantId, orderId: In(orders.map((item) => item.id)) }
      })
      const products = await this.productRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
      const productMap = new Map<number, string>(products.map((item) => [item.id, item.productName]))
      const productIds = new Set<number>([
        ...returnLines.map((item) => item.productId),
        ...orderLines.map((item) => item.productId)
      ])
      byProduct = buildProductReturnRate(
        [...productIds].filter((id) => !query.productId || id === query.productId).map((productId) => ({
          productId,
          salesAmount: orderLines.filter((line) => line.productId === productId).reduce((sum, line) => sum + this.num(line.amount), 0),
          returnAmount: returnLines.filter((line) => line.productId === productId).reduce((sum, line) => sum + this.num(line.amount), 0)
        })),
        productMap
      )
    }
    if (query.groupBy === 'PERIOD') {
      byPeriod = buildPeriodReturnRate(
        [...new Set([...orders.map((item) => this.periodOf(item.orderDate)), ...returns.map((item) => this.periodOf(String(item.createdAt)))])]
          .map((period) => ({
            period,
            salesAmount: orders.filter((item) => this.periodOf(item.orderDate) === period).reduce((sum, item) => sum + this.num(item.totalAmount), 0),
            returnAmount: returns.filter((item) => this.periodOf(String(item.createdAt)) === period).reduce((sum, item) => sum + this.num(item.refundAmount), 0)
          }))
      )
    }
    return {
      salesAmount: Number(salesAmount.toFixed(4)),
      returnAmount: Number(returnAmount.toFixed(4)),
      rate: rate.rate,
      percent: rate.percent,
      orderCount: orders.length,
      returnCount: returns.length,
      byCustomer,
      byProduct,
      byPeriod
    }
  }

  /* ------------------------------ 报价模板 ------------------------------ */

  async listQuotationTemplates(user: JwtUser): Promise<QuotationTemplateEntity[]> {
    return this.quoteTemplateRepo.find({ where: { tenantId: user.tenantId }, order: { id: 'DESC' } })
  }

  async createQuotationTemplate(dto: CreateQuotationTemplateDto, user: JwtUser): Promise<QuotationTemplateEntity> {
    const existing = await this.quoteTemplateRepo.findOne({ where: { tenantId: user.tenantId, templateCode: dto.templateCode } })
    if (existing) throw new BadRequestException('模板编码已存在')
    const saved = await this.quoteTemplateRepo.save(this.quoteTemplateRepo.create({
      tenantId: user.tenantId,
      templateCode: dto.templateCode,
      templateName: dto.templateName,
      customerId: dto.customerId ?? null,
      remark: dto.remark ?? null,
      createdBy: user.userId
    }))
    for (const line of dto.lines) {
      await this.quoteTemplateLineRepo.save(this.quoteTemplateLineRepo.create({
        tenantId: user.tenantId,
        templateId: saved.id,
        productId: line.productId,
        qty: Number(line.qty).toFixed(3),
        unitPrice: Number(line.unitPrice).toFixed(4),
        remark: line.remark ?? null
      }))
    }
    await this.auditService.record({ bizType: 'sale_quotation_template', bizId: saved.id, action: 'CREATE_QUOTE_TEMPLATE', afterValue: saved }, user)
    return saved
  }

  /** 应用报价模板：返回报价行建议（不直接创建报价单） */
  async applyQuotationTemplate(dto: ApplyQuotationTemplateDto, user: JwtUser): Promise<{ templateId: number; lines: Array<Record<string, unknown>>; totalAmount: number }> {
    const template = await this.quoteTemplateRepo.findOne({ where: { id: dto.templateId, tenantId: user.tenantId } })
    if (!template) throw new NotFoundException('报价模板不存在')
    const lines = await this.quoteTemplateLineRepo.find({ where: { tenantId: user.tenantId, templateId: template.id }, order: { id: 'ASC' } })
    const result = buildQuotationFromTemplate(
      lines.map((item) => ({ productId: item.productId, qty: Number(item.qty), unitPrice: Number(item.unitPrice), remark: item.remark })),
      dto.overrides
    )
    await this.auditService.record({ bizType: 'sale_quotation_template', bizId: template.id, action: 'APPLY_QUOTE_TEMPLATE', afterValue: { lineCount: result.length } }, user)
    return {
      templateId: template.id,
      lines: result as unknown as Array<Record<string, unknown>>,
      totalAmount: Number(result.reduce((sum, item) => sum + item.amount, 0).toFixed(4))
    }
  }

  /* ------------------------------ 信用动态流水 ------------------------------ */

  async listCreditFlows(customerId: number, user: JwtUser): Promise<{ flows: CustomerCreditFlowEntity[]; creditLimit: number; creditUsed: number }> {
    const customer = await this.customerRepo.findOne({ where: { id: customerId, tenantId: user.tenantId } })
    if (!customer) throw new NotFoundException('客户不存在')
    const flows = await this.creditFlowRepo.find({ where: { tenantId: user.tenantId, customerId }, order: { id: 'DESC' } })
    return { flows, creditLimit: this.num(customer.creditLimit), creditUsed: this.num(customer.creditUsed) }
  }

  /** 登记信用占用/释放流水，并同步客户已用额度 */
  async createCreditFlow(dto: CreateCreditFlowDto, user: JwtUser): Promise<CustomerCreditFlowEntity> {
    const customer = await this.customerRepo.findOne({ where: { id: dto.customerId, tenantId: user.tenantId } })
    if (!customer) throw new NotFoundException('客户不存在')
    const beforeUsed = this.num(customer.creditUsed)
    const check = evaluateCreditFlow({
      creditLimit: this.num(customer.creditLimit),
      creditUsed: beforeUsed,
      type: dto.flowType as 'OCCUPY',
      amount: Number(dto.amount)
    })
    if (!check.ok) throw new BadRequestException(check.reason)
    const saved = await this.creditFlowRepo.save(this.creditFlowRepo.create({
      tenantId: user.tenantId,
      customerId: dto.customerId,
      flowType: dto.flowType,
      amount: Number(dto.amount).toFixed(4),
      beforeUsed: beforeUsed.toFixed(4),
      afterUsed: check.nextUsed.toFixed(4),
      sourceType: dto.sourceType ?? null,
      sourceId: dto.sourceId ?? null,
      remark: dto.remark ?? null,
      createdBy: user.userId
    }))
    customer.creditUsed = check.nextUsed.toFixed(4)
    await this.customerRepo.save(customer)
    await this.auditService.record({
      bizType: 'sale_customer_credit_flow', bizId: saved.id, action: 'CREATE_CREDIT_FLOW',
      afterValue: { customerId: dto.customerId, type: dto.flowType, afterUsed: check.nextUsed }
    }, user)
    return saved
  }

  /* ------------------------------ 内部方法 ------------------------------ */

  private validateRulePayload(
    ruleType: string,
    rate?: string | undefined,
    fixedAmount?: string | undefined,
    tiers?: Array<Record<string, unknown>> | undefined
  ): void {
    if (ruleType === 'RATE') {
      const value = Number(rate ?? 0)
      if (!rate || !Number.isFinite(value) || value <= 0) throw new BadRequestException('比例型佣金规则必须配置大于 0 的比例')
    }
    if (ruleType === 'FIXED') {
      const value = Number(fixedAmount ?? 0)
      if (fixedAmount === undefined || !Number.isFinite(value) || value <= 0) throw new BadRequestException('固定金额型佣金规则必须配置大于 0 的金额')
    }
    if (ruleType === 'TIER') {
      if (!tiers || tiers.length === 0) throw new BadRequestException('阶梯型佣金规则必须配置阶梯档位')
      for (const tier of tiers) {
        const min = Number(tier.min ?? Number.NaN)
        const tierRate = Number(tier.rate ?? Number.NaN)
        if (!Number.isFinite(min) || min < 0) throw new BadRequestException('阶梯门槛必须为非负数')
        if (!Number.isFinite(tierRate) || tierRate <= 0 || tierRate > 1) throw new BadRequestException('阶梯比例必须在 0 与 1 之间')
      }
    }
  }

  private slaOf(complaint: SalesComplaintEntity, now: Date): { dueHours: number; overdue: boolean; overdueHours: number; closed: boolean } {
    return evaluateComplaintSla({
      status: complaint.status,
      createdAt: new Date(complaint.createdAt).toISOString(),
      dueAt: null,
      resolvedAt: complaint.resolvedAt ? new Date(complaint.resolvedAt).toISOString() : null,
      severity: complaint.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    }, now)
  }

  private async sumOrderReturnAmount(orderId: number, user: JwtUser): Promise<number> {
    const returns = await this.returnRepo.find({
      where: { tenantId: user.tenantId, orderId, isDeleted: 0, status: In(EFFECTIVE_RETURN_STATUS) }
    })
    return Number(returns.reduce((sum, item) => sum + this.num(item.refundAmount), 0).toFixed(4))
  }

  /** 已确认/已发放的累计销售额，用于阶梯规则档位判定 */
  private async sumAccumulatedAmount(salesRepId: number | null, user: JwtUser): Promise<number> {
    const where: Record<string, unknown> = { tenantId: user.tenantId, status: In(['CONFIRMED', 'PAID']) }
    if (salesRepId) where.salesRepId = salesRepId
    const records = await this.recordRepo.find({ where: where as never })
    return Number(records.reduce((sum, item) => sum + this.num(item.orderAmount), 0).toFixed(4))
  }

  private async findRule(id: number, user: JwtUser): Promise<SalesCommissionRuleEntity> {
    const rule = await this.ruleRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!rule) throw new NotFoundException('佣金规则不存在')
    return rule
  }

  private async findRecord(id: number, user: JwtUser): Promise<SalesCommissionRecordEntity> {
    const record = await this.recordRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!record) throw new NotFoundException('佣金核算记录不存在')
    return record
  }

  private async findComplaint(id: number, user: JwtUser): Promise<SalesComplaintEntity> {
    const complaint = await this.complaintRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!complaint) throw new NotFoundException('投诉工单不存在')
    return complaint
  }

  private async findVisit(id: number, user: JwtUser): Promise<SalesVisitEntity> {
    const visit = await this.visitRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!visit) throw new NotFoundException('回访记录不存在')
    return visit
  }

  private async findOrder(id: number, user: JwtUser): Promise<SaleOrderEntity> {
    const order = await this.orderRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!order) throw new NotFoundException('销售单不存在')
    return order
  }

  private num(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  private money(value: number): string {
    return Number(value.toFixed(4)).toFixed(4)
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10)
  }

  private periodOf(date: string): string {
    return date.slice(0, 7)
  }

  private number(prefix: string): string {
    const suffix = `${Date.now().toString(36)}${randomBytes(2).toString('hex')}`.toUpperCase()
    return `${prefix}${suffix}`
  }

  /** 记录投诉工单流转轨迹 */
  private async writeComplaintLog(
    complaintId: number,
    action: string,
    fromStatus: string,
    toStatus: string,
    remark: string,
    user: JwtUser
  ): Promise<void> {
    await this.complaintLogRepo.save(this.complaintLogRepo.create({
      tenantId: user.tenantId,
      complaintId,
      action,
      fromStatus,
      toStatus,
      operatorId: user.userId,
      operatorName: user.realName ?? user.username,
      remark: remark.slice(0, 500),
      durationMs: 0
    }))
  }

  /** 佣金规则冲突校验：同一销售员（或全员）有效期不可重叠 */
  private async assertRuleNoConflict(
    incoming: {
      id?: number
      salesRepId: number | null
      effectiveFrom: string | null
      effectiveTo: string | null
      status: string
    },
    user: JwtUser
  ): Promise<void> {
    const rules = await this.ruleRepo.find({ where: { tenantId: user.tenantId, status: 'ACTIVE' } })
    const check = evaluateCommissionRuleConflict(
      rules.map((item) => ({
        id: item.id,
        ruleName: item.ruleName,
        salesRepId: item.salesRepId ?? null,
        effectiveFrom: item.effectiveFrom ?? null,
        effectiveTo: item.effectiveTo ?? null,
        status: item.status
      })),
      incoming
    )
    if (!check.ok) throw new BadRequestException(check.reason ?? '佣金规则适用范围冲突')
  }
}
