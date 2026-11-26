import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { scopeWhere } from '../../common/data-scope-context'
import {
  applyScenario, contribution, dailyDigest, enrichTrend, forecastCashFlow, growthRate,
  ranking, visibleKpis, type CashFlowItem, type KpiConfig, type Scenario, type TrendPoint
} from '../../common/workbench-engine'
import { AuditService } from '../audit/audit.service'
import { FlowTaskEntity } from '../collaboration/entities/collaboration.entities'
import { NotifyService } from '../notify/notify.service'
import { SchedulerService } from '../ops/scheduler.service'
import { PayableEntity, ReceivableEntity } from '../finance/entities/finance.entities'
import { CustomerEntity } from '../master-data/entities/customer.entity'
import { ProductCategoryEntity } from '../master-data/entities/product-category.entity'
import { ProductEntity } from '../master-data/entities/product.entity'
import { PurchaseOrderEntity } from '../purchase/entities/purchase.entities'
import { RiskAlertEntity } from '../risk/entities/risk-alert.entity'
import { SaleOrderEntity, SaleOrderLineEntity } from '../sales/entities/sales.entities'
import { WorkbenchBriefingEntity, WorkbenchKpiEntity, WorkbenchSubscriptionEntity } from './entities/workbench.entities'

const DEFAULT_KPIS: KpiConfig[] = [
  { code: 'SALES_AMOUNT', name: '累计销售', source: 'SALES', roles: [] },
  { code: 'PURCHASE_AMOUNT', name: '累计采购', source: 'PURCHASE', roles: [] },
  { code: 'AR_BALANCE', name: '应收余额', source: 'AR', roles: [] },
  { code: 'AP_BALANCE', name: '应付余额', source: 'AP', roles: [] },
  { code: 'RISK_OPEN', name: '未关闭风险', source: 'RISK', roles: [] },
  { code: 'TODO_OVERDUE', name: '审批超时', source: 'TODO', roles: [] },
  { code: 'SALES_FUNNEL', name: '销售漏斗转化', source: 'SALES', roles: [] },
  { code: 'PRODUCT_ABC', name: '产品 ABC 分析', source: 'SALES', roles: [] },
  { code: 'CUSTOMER_DRILL', name: '客户贡献明细', source: 'CUSTOMER', roles: [] },
  { code: 'CUSTOMER_CHURN', name: '客户流失预警', source: 'CUSTOMER', roles: [] },
  { code: 'SALES_REGION', name: '区域销售下钻', source: 'SALES', roles: [] },
  { code: 'SALES_CATEGORY', name: '品类销售下钻', source: 'SALES', roles: [] }
]

const EFFECTIVE_STATUS = ['APPROVED', 'PARTIAL', 'DONE']

@Injectable()
export class WorkbenchService implements OnModuleInit {
  private readonly logger = new Logger(WorkbenchService.name)

  constructor(
    @InjectRepository(WorkbenchKpiEntity) private readonly kpiRepo: Repository<WorkbenchKpiEntity>,
    @InjectRepository(WorkbenchSubscriptionEntity) private readonly subRepo: Repository<WorkbenchSubscriptionEntity>,
    @InjectRepository(WorkbenchBriefingEntity) private readonly briefRepo: Repository<WorkbenchBriefingEntity>,
    @InjectRepository(SaleOrderEntity) private readonly orderRepo: Repository<SaleOrderEntity>,
    @InjectRepository(SaleOrderLineEntity) private readonly lineRepo: Repository<SaleOrderLineEntity>,
    @InjectRepository(PurchaseOrderEntity) private readonly purchaseRepo: Repository<PurchaseOrderEntity>,
    @InjectRepository(ReceivableEntity) private readonly arRepo: Repository<ReceivableEntity>,
    @InjectRepository(PayableEntity) private readonly apRepo: Repository<PayableEntity>,
    @InjectRepository(RiskAlertEntity) private readonly riskRepo: Repository<RiskAlertEntity>,
    @InjectRepository(FlowTaskEntity) private readonly taskRepo: Repository<FlowTaskEntity>,
    @InjectRepository(CustomerEntity) private readonly customerRepo: Repository<CustomerEntity>,
    @InjectRepository(ProductEntity) private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(ProductCategoryEntity) private readonly categoryRepo: Repository<ProductCategoryEntity>,
    private readonly audit: AuditService,
    private readonly notify: NotifyService,
    private readonly scheduler: SchedulerService
  ) {}

  /** 注册订阅推送调度：按订阅频率生成经营简报并推送到订阅人 */
  onModuleInit(): void {
    this.scheduler.register({
      code: 'workbench.subscription.digest',
      name: '经营简报订阅推送',
      intervalMinutes: 60,
      enabled: true,
      handler: async () => {
        const result = await this.dispatchDueSubscriptions()
        return `PUSHED=${result.pushed} SKIPPED=${result.skipped}`
      }
    })
  }

  /** 按角色筛选可见 KPI（DB 配置覆盖内置默认配置） */
  async listKpis(user: JwtUser): Promise<KpiConfig[]> {
    const stored = await this.kpiRepo.find({ where: { tenantId: user.tenantId, enabled: 1 }, order: { sortNo: 'ASC', id: 'ASC' } })
    const merged = DEFAULT_KPIS.map((item) => ({ ...item }))
    for (const row of stored) {
      const item: KpiConfig = { code: row.code, name: row.name, source: row.source, roles: row.roles ?? [] }
      const index = merged.findIndex((k) => k.code === row.code)
      if (index >= 0) merged[index] = item
      else merged.push(item)
    }
    return visibleKpis(merged, user.roles)
  }

  /** 新增/覆盖 KPI 配置 */
  async saveKpi(
    input: { code: string; name: string; source: string; roles?: string[]; sortNo?: number; enabled?: number },
    user: JwtUser
  ): Promise<WorkbenchKpiEntity> {
    if (!input.code?.trim() || !input.name?.trim()) throw new BadRequestException('KPI 编码与名称必填')
    const existing = await this.kpiRepo.findOne({ where: { tenantId: user.tenantId, code: input.code } })
    const entity = existing ?? this.kpiRepo.create({
      tenantId: user.tenantId, code: input.code, createdBy: user.userId
    })
    entity.name = input.name
    entity.source = input.source || 'SALES'
    entity.roles = input.roles ?? []
    entity.sortNo = input.sortNo ?? 0
    entity.enabled = input.enabled === 0 ? 0 : 1
    const saved = await this.kpiRepo.save(entity)
    await this.audit.record({
      bizType: 'workbench_kpi', bizId: saved.id, action: existing ? 'UPDATE_KPI' : 'CREATE_KPI', afterValue: saved
    }, user)
    return saved
  }

  /** 禁用 KPI（默认 KPI 也落一条禁用配置） */
  async removeKpi(code: string, user: JwtUser): Promise<void> {
    const entity = await this.kpiRepo.findOne({ where: { tenantId: user.tenantId, code } })
    if (!entity) {
      await this.kpiRepo.save(this.kpiRepo.create({
        tenantId: user.tenantId, code, name: code, source: 'SALES', roles: [], enabled: 0, createdBy: user.userId
      }))
      return
    }
    entity.enabled = 0
    await this.kpiRepo.save(entity)
    await this.audit.record({ bizType: 'workbench_kpi', bizId: entity.id, action: 'DISABLE_KPI' }, user)
  }

  /** 工作台总览：角色 KPI + 异常预警 + AI 日报摘要 */
  async overview(user: JwtUser): Promise<Record<string, unknown>> {
    const configs = await this.listKpis(user)
    const [orders, purchases, ars, aps, risks, tasks] = await Promise.all([
      this.orderRepo.find({ where: scopeWhere<SaleOrderEntity>({ tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' }) }),
      this.purchaseRepo.find({ where: scopeWhere<PurchaseOrderEntity>({ tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' }) }),
      this.arRepo.find({ where: scopeWhere<ReceivableEntity>({ tenantId: user.tenantId, status: 'OPEN' }, user) }),
      this.apRepo.find({ where: scopeWhere<PayableEntity>({ tenantId: user.tenantId, status: 'OPEN' }, user) }),
      this.riskRepo.find({ where: { tenantId: user.tenantId, status: 'OPEN' }, order: { createdAt: 'DESC' }, take: 200 }),
      this.taskRepo.find({ where: { tenantId: user.tenantId, status: 'PENDING', assigneeId: user.userId } })
    ])

    const now = new Date()
    const currentMonth = this.monthOf(now)
    const previousMonth = this.monthOf(new Date(now.getFullYear(), now.getMonth() - 1, 1))
    const effectiveOrders = orders.filter((item) => EFFECTIVE_STATUS.includes(item.status))
    const effectivePurchases = purchases.filter((item) => EFFECTIVE_STATUS.includes(item.status))
    const salesCurrent = effectiveOrders.filter((item) => item.orderDate.startsWith(currentMonth)).reduce((sum, item) => sum + this.num(item.totalAmount), 0)
    const salesPrevious = effectiveOrders.filter((item) => item.orderDate.startsWith(previousMonth)).reduce((sum, item) => sum + this.num(item.totalAmount), 0)
    const purchaseCurrent = effectivePurchases.filter((item) => item.orderDate.startsWith(currentMonth)).reduce((sum, item) => sum + this.num(item.totalAmount), 0)
    const purchasePrevious = effectivePurchases.filter((item) => item.orderDate.startsWith(previousMonth)).reduce((sum, item) => sum + this.num(item.totalAmount), 0)

    const abcCount = await this.abcValue(user.tenantId)
    const regionRows = await this.regionBreakdown(user)
    const categoryRows = await this.categoryBreakdown(user)

    const values: Record<string, { value: string; yoy?: number }> = {
      SALES_AMOUNT: { value: this.money(effectiveOrders.reduce((sum, item) => sum + this.num(item.totalAmount), 0)), yoy: growthRate(salesCurrent, salesPrevious) },
      PURCHASE_AMOUNT: { value: this.money(effectivePurchases.reduce((sum, item) => sum + this.num(item.totalAmount), 0)), yoy: growthRate(purchaseCurrent, purchasePrevious) },
      AR_BALANCE: { value: this.money(ars.reduce((sum, item) => sum + this.num(item.amount) - this.num(item.receivedAmount), 0)) },
      AP_BALANCE: { value: this.money(aps.reduce((sum, item) => sum + this.num(item.amount) - this.num(item.paidAmount), 0)) },
      RISK_OPEN: { value: String(risks.length) },
      TODO_OVERDUE: { value: String(tasks.filter((item) => item.dueAt && item.dueAt.getTime() < now.getTime()).length) },
      SALES_FUNNEL: { value: this.funnelValue(effectiveOrders) },
      PRODUCT_ABC: { value: abcCount },
      CUSTOMER_DRILL: { value: String(this.customerStats(effectiveOrders).active) },
      CUSTOMER_CHURN: { value: String(this.customerStats(effectiveOrders).churned) },
      SALES_REGION: { value: String(regionRows.length) },
      SALES_CATEGORY: { value: String(categoryRows.length) }
    }

    const kpis = configs.map((config) => ({ ...config, ...(values[config.code] ?? { value: '0' }) }))
    const alerts = risks.slice(0, 8).map((item) => ({
      id: item.id, title: item.title, severity: item.severity, riskType: item.riskType, bizType: item.bizType, bizId: item.bizId
    }))
    const digest = dailyDigest(
      kpis.map((item) => ({ name: item.name, value: String(item.value), yoy: item.yoy })),
      alerts.map((item) => ({ title: item.title, severity: item.severity }))
    )
    return { kpis, alerts, digest, generatedAt: new Date().toISOString() }
  }

  /** KPI 下钻：返回对应明细，全部受数据权限约束 */
  async drill(code: string, user: JwtUser): Promise<{ code: string; title: string; rows: Array<Record<string, unknown>> }> {
    if (code === 'SALES_AMOUNT' || code === 'PURCHASE_AMOUNT') {
      const isSales = code === 'SALES_AMOUNT'
      const rows = isSales
        ? await this.orderRepo.find({ where: scopeWhere<SaleOrderEntity>({ tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' }), order: { createdAt: 'DESC' }, take: 200 })
        : await this.purchaseRepo.find({ where: scopeWhere<PurchaseOrderEntity>({ tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' }), order: { createdAt: 'DESC' }, take: 200 })
      return {
        code,
        title: isSales ? '销售单明细' : '采购单明细',
        rows: rows.filter((item) => EFFECTIVE_STATUS.includes(item.status)).map((item) => ({
          id: item.id, no: item.orderNo, date: item.orderDate, amount: this.num(item.totalAmount), status: item.status
        }))
      }
    }
    if (code === 'AR_BALANCE' || code === 'AP_BALANCE') {
      const isAr = code === 'AR_BALANCE'
      const rows = isAr
        ? await this.arRepo.find({ where: scopeWhere<ReceivableEntity>({ tenantId: user.tenantId, status: 'OPEN' }, user) })
        : await this.apRepo.find({ where: scopeWhere<PayableEntity>({ tenantId: user.tenantId, status: 'OPEN' }, user) })
      return {
        code,
        title: isAr ? '应收明细' : '应付明细',
        rows: rows.map((item) => ({
          id: item.id, no: item.sourceNo, date: item.dueDate,
          amount: this.num(item.amount) - this.num(isAr ? (item as ReceivableEntity).receivedAmount : (item as PayableEntity).paidAmount),
          status: item.status
        }))
      }
    }
    if (code === 'RISK_OPEN') {
      const rows = await this.riskRepo.find({ where: { tenantId: user.tenantId, status: 'OPEN' }, order: { createdAt: 'DESC' }, take: 200 })
      return { code, title: '风险预警明细', rows: rows.map((item) => ({
        id: item.id, title: item.title, severity: item.severity, riskType: item.riskType, message: item.message
      })) }
    }
    if (code === 'TODO_OVERDUE') {
      const now = Date.now()
      const rows = await this.taskRepo.find({ where: { tenantId: user.tenantId, status: 'PENDING', assigneeId: user.userId } })
      return { code, title: '待办明细', rows: rows.filter((item) => item.dueAt && item.dueAt.getTime() < now).map((item) => ({
        id: item.id, instanceId: item.instanceId, nodeId: item.nodeId, dueAt: item.dueAt, status: item.status
      })) }
    }
    if (code === 'SALES_FUNNEL') {
      const orders = await this.orderRepo.find({ where: scopeWhere<SaleOrderEntity>({ tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' }), take: 1000 })
      const effective = orders.filter((item) => EFFECTIVE_STATUS.includes(item.status))
      const shipped = effective.filter((item) => ['SHIPPED', 'DELIVERED', 'RECEIVED'].includes(item.shipStatus ?? ''))
      const paid = effective.filter((item) => item.payStatus === 'PAID')
      const stages = [
        { stage: '全部订单', count: orders.length, rate: 1 },
        { stage: '有效订单', count: effective.length, rate: orders.length ? effective.length / orders.length : 0 },
        { stage: '已发货', count: shipped.length, rate: effective.length ? shipped.length / effective.length : 0 },
        { stage: '已收款', count: paid.length, rate: effective.length ? paid.length / effective.length : 0 }
      ]
      return { code, title: '销售漏斗转化', rows: stages.map((item) => ({ ...item, rate: Number((item.rate * 100).toFixed(2)) })) }
    }
    if (code === 'PRODUCT_ABC') {
      const lines = await this.lineRepo.find({ where: { tenantId: user.tenantId }, take: 5000 })
      const totals = new Map<number, number>()
      for (const line of lines) {
        totals.set(line.productId, (totals.get(line.productId) ?? 0) + this.num(line.amount))
      }
      const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1])
      const grandTotal = sorted.reduce((sum, item) => sum + item[1], 0)
      let cumulative = 0
      const rows = sorted.map(([productId, amount]) => {
        cumulative += amount
        const ratio = grandTotal ? cumulative / grandTotal : 0
        const abc = ratio <= 0.7 ? 'A' : ratio <= 0.9 ? 'B' : 'C'
        return { productId, amount, ratio: Number((ratio * 100).toFixed(2)), abc }
      })
      return { code, title: '产品 ABC 分析', rows }
    }
    if (code === 'SALES_REGION') {
      return { code, title: '区域销售下钻', rows: await this.regionBreakdown(user) }
    }
    if (code === 'SALES_CATEGORY') {
      return { code, title: '品类销售下钻', rows: await this.categoryBreakdown(user) }
    }
    if (code === 'CUSTOMER_DRILL' || code === 'CUSTOMER_CHURN') {
      const orders = await this.orderRepo.find({ where: scopeWhere<SaleOrderEntity>({ tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' }), take: 2000 })
      const map = new Map<number, { amount: number; count: number; lastOrderDate: string }>()
      for (const order of orders.filter((item) => EFFECTIVE_STATUS.includes(item.status))) {
        const current = map.get(order.customerId) ?? { amount: 0, count: 0, lastOrderDate: order.orderDate }
        current.amount += this.num(order.totalAmount)
        current.count += 1
        if (order.orderDate > current.lastOrderDate) current.lastOrderDate = order.orderDate
        map.set(order.customerId, current)
      }
      const threshold = Date.now() - 90 * 86400000
      const rows = [...map.entries()].map(([customerId, item]) => ({
        customerId,
        ...item,
        churned: new Date(item.lastOrderDate).getTime() < threshold
      })).filter((item) => (code === 'CUSTOMER_CHURN' ? item.churned : true)).sort((a, b) => b.amount - a.amount)
      return { code, title: code === 'CUSTOMER_CHURN' ? '客户流失预警' : '客户贡献明细', rows }
    }
    throw new NotFoundException('未知 KPI')
  }

  /** 销售趋势：同环比、毛利拆解、贡献度、业务员排行 */
  async salesTrend(year: number | undefined, user: JwtUser): Promise<Record<string, unknown>> {
    const targetYear = year ?? new Date().getFullYear()
    const [orders, lines] = await Promise.all([
      this.orderRepo.find({ where: scopeWhere<SaleOrderEntity>({ tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' }) }),
      this.lineRepo.find({ where: { tenantId: user.tenantId } })
    ])
    const effective = orders.filter((item) => EFFECTIVE_STATUS.includes(item.status))
    const costByOrder = new Map<number, number>()
    for (const line of lines) {
      costByOrder.set(line.orderId, (costByOrder.get(line.orderId) ?? 0) + this.num(line.cost))
    }

    const months = Array.from({ length: 12 }, (_, index) => `${targetYear}-${String(index + 1).padStart(2, '0')}`)
    const summarize = (prefix: string): TrendPoint[] => months.map((period) => {
      const matched = effective.filter((item) => item.orderDate.startsWith(`${prefix}-${period.slice(5)}`))
      const amount = matched.reduce((sum, item) => sum + this.num(item.totalAmount), 0)
      const cost = matched.reduce((sum, item) => sum + (costByOrder.get(item.id) ?? 0), 0)
      return { period, amount: Number(amount.toFixed(4)), cost: Number(cost.toFixed(4)) }
    })
    const current = summarize(String(targetYear))
    const previous = summarize(String(targetYear - 1))
    const trend = enrichTrend(current, previous)

    const byCustomer = new Map<string, number>()
    const bySales = new Map<string, number>()
    const byProduct = new Map<string, number>()
    for (const order of effective) {
      if (!order.orderDate.startsWith(String(targetYear))) continue
      byCustomer.set(String(order.customerId), (byCustomer.get(String(order.customerId)) ?? 0) + this.num(order.totalAmount))
      const salesName = `业务员 ${order.createdBy ?? 0}`
      bySales.set(salesName, (bySales.get(salesName) ?? 0) + this.num(order.totalAmount))
    }
    for (const line of lines) {
      const order = effective.find((item) => item.id === line.orderId)
      if (!order?.orderDate.startsWith(String(targetYear))) continue
      byProduct.set(String(line.productId), (byProduct.get(String(line.productId)) ?? 0) + this.num(line.amount))
    }

    const totalAmount = current.reduce((sum, item) => sum + item.amount, 0)
    const previousTotal = previous.reduce((sum, item) => sum + item.amount, 0)
    const totalCost = current.reduce((sum, item) => sum + (item.cost ?? 0), 0)
    return {
      year: targetYear,
      trend,
      totalAmount: Number(totalAmount.toFixed(4)),
      yoy: growthRate(totalAmount, previousTotal),
      grossProfit: Number((totalAmount - totalCost).toFixed(4)),
      margin: totalAmount ? Number(((totalAmount - totalCost) / totalAmount * 100).toFixed(2)) : 0,
      contribution: {
        customer: contribution([...byCustomer].map(([name, amount]) => ({ name, amount }))),
        product: contribution([...byProduct].map(([name, amount]) => ({ name, amount })))
      },
      salesRanking: ranking([...bySales].map(([name, amount]) => ({ name, amount })))
    }
  }

  /** 13 周现金流预测：应收应付按到期日归周，支持情景模拟 */
  async cashFlow(input: { scenario?: Scenario } | undefined, user: JwtUser): Promise<Record<string, unknown>> {
    const scenario: Scenario = input?.scenario ?? 'BASE'
    const [ars, aps] = await Promise.all([
      this.arRepo.find({ where: scopeWhere<ReceivableEntity>({ tenantId: user.tenantId, status: 'OPEN' }, user) }),
      this.apRepo.find({ where: scopeWhere<PayableEntity>({ tenantId: user.tenantId, status: 'OPEN' }, user) })
    ])
    const now = Date.now()
    const items: CashFlowItem[] = []
    for (const row of ars) {
      const due = row.dueDate ? new Date(row.dueDate).getTime() : now
      items.push({
        amount: this.num(row.amount) - this.num(row.receivedAmount),
        daysFromNow: Math.max(0, Math.floor((due - now) / 86400000)),
        direction: 'IN'
      })
    }
    for (const row of aps) {
      const due = row.dueDate ? new Date(row.dueDate).getTime() : now
      items.push({
        amount: this.num(row.amount) - this.num(row.paidAmount),
        daysFromNow: Math.max(0, Math.floor((due - now) / 86400000)),
        direction: 'OUT'
      })
    }
    const base = forecastCashFlow(items)
    const projected = applyScenario(base, scenario)
    return {
      scenario,
      base,
      projected,
      gaps: base.filter((row) => row.cumulative < 0).map((row) => row.week),
      projectedGaps: projected.filter((row) => row.cumulative < 0).map((row) => row.week),
      assumptions: [
        '应收按到期日计入流入，应付按到期日计入流出',
        '乐观情景流入 +10% / 流出 -10%，悲观情景流入 -15% / 流出 +15%',
        '超过 13 周的款项不计入滚动预测，未设到期日按当日处理'
      ],
      generatedAt: new Date().toISOString()
    }
  }

  /** 订阅推送配置 */
  listSubscriptions(user: JwtUser): Promise<WorkbenchSubscriptionEntity[]> {
    return this.subRepo.find({ where: { tenantId: user.tenantId, userId: user.userId }, order: { id: 'DESC' } })
  }

  async saveSubscription(
    input: { resource: string; frequency?: string; channel?: string; enabled?: number },
    user: JwtUser
  ): Promise<WorkbenchSubscriptionEntity> {
    if (!input.resource?.trim()) throw new BadRequestException('订阅资源必填')
    const existing = await this.subRepo.findOne({ where: { tenantId: user.tenantId, userId: user.userId, resource: input.resource } })
    const entity = existing ?? this.subRepo.create({ tenantId: user.tenantId, userId: user.userId, resource: input.resource })
    entity.frequency = input.frequency ?? 'DAILY'
    entity.channel = input.channel ?? 'INBOX'
    entity.enabled = input.enabled === 0 ? 0 : 1
    return this.subRepo.save(entity)
  }

  async removeSubscription(id: number, user: JwtUser): Promise<void> {
    const entity = await this.subRepo.findOne({ where: { id, tenantId: user.tenantId, userId: user.userId } })
    if (!entity) throw new NotFoundException('订阅不存在')
    await this.subRepo.remove(entity)
  }

  /** 经营简报列表 */
  listBriefings(query: { page?: number; pageSize?: number; type?: string }, user: JwtUser): Promise<PageResult<WorkbenchBriefingEntity>> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    return this.briefRepo.findAndCount({
      where: { tenantId: user.tenantId, ...(query.type ? { type: query.type } : {}) },
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }).then(([list, total]) => buildPageResult(list, total, page, pageSize))
  }

  /** 按周报/月报模板生成简报：数据快照 + AI 摘要（标注来源） */
  async createBriefing(
    input: { type: 'WEEK' | 'MONTH' | 'DAILY'; template?: string; title?: string },
    user: JwtUser
  ): Promise<WorkbenchBriefingEntity> {
    const type = input.type === 'WEEK' ? 'WEEK' : input.type === 'DAILY' ? 'DAILY' : 'MONTH'
    const period = type === 'WEEK'
      ? this.isoWeek(new Date())
      : type === 'DAILY'
        ? this.dayOf(new Date())
        : this.monthOf(new Date())
    const [overview, trend, cash] = await Promise.all([
      this.overview(user), this.salesTrend(undefined, user), this.cashFlow(undefined, user)
    ])
    const digest = dailyDigest(
      (overview.kpis as Array<{ name: string; value: string; yoy?: number }>).map((item) => ({ name: item.name, value: String(item.value), yoy: item.yoy })),
      (overview.alerts as Array<{ title: string; severity: string }>).map((item) => ({ title: item.title, severity: item.severity }))
    )
    const entity = this.briefRepo.create({
      tenantId: user.tenantId,
      type,
      period,
      template: input.template ?? (type === 'WEEK' ? 'WEEKLY_STANDARD' : type === 'DAILY' ? 'DAILY_STANDARD' : 'MONTHLY_STANDARD'),
      title: input.title?.trim() || `${period} ${type === 'WEEK' ? '经营周报' : type === 'DAILY' ? '经营日报' : '经营月报'}`,
      snapshot: { overview, trend, cash },
      summary: digest.summary,
      sourceRefs: digest.sources,
      status: 'DRAFT',
      readBy: [],
      createdBy: user.userId
    })
    const saved = await this.briefRepo.save(entity)
    await this.audit.record({ bizType: 'workbench_briefing', bizId: saved.id, action: 'CREATE_BRIEFING', afterValue: { type, period } }, user)
    return saved
  }

  /** 发布简报：生成可打印为 PDF 的 HTML 内容 */
  async publishBriefing(id: number, user: JwtUser): Promise<WorkbenchBriefingEntity> {
    const entity = await this.findBrief(id, user)
    if (entity.status === 'PUBLISHED') throw new BadRequestException('简报已发布')
    entity.pdfContent = this.renderHtml(entity)
    entity.status = 'PUBLISHED'
    const saved = await this.briefRepo.save(entity)
    await this.audit.record({ bizType: 'workbench_briefing', bizId: saved.id, action: 'PUBLISH_BRIEFING' }, user)
    return saved
  }

  /**
   * 订阅到期推送：按订阅频率（日/周/月）生成对应经营简报并推送订阅人。
   * 已生成过同周期简报的订阅跳过，保证幂等；推送失败仅记录日志不影响其他订阅。
   */
  async dispatchDueSubscriptions(now: Date = new Date()): Promise<{ pushed: number; skipped: number }> {
    const subs = await this.subRepo.find({ where: { enabled: 1 } })
    let pushed = 0
    let skipped = 0
    for (const sub of subs) {
      const frequency = (sub.frequency ?? 'DAILY').toUpperCase()
      const type = frequency === 'WEEKLY' ? 'WEEK' : frequency === 'MONTHLY' ? 'MONTH' : 'DAILY'
      const period = type === 'WEEK' ? this.isoWeek(now) : type === 'MONTH' ? this.monthOf(now) : this.dayOf(now)
      const existing = await this.briefRepo.findOne({
        where: { tenantId: sub.tenantId, type, period, createdBy: sub.userId }
      })
      if (existing) { skipped += 1; continue }
      const user: JwtUser = {
        userId: sub.userId,
        tenantId: sub.tenantId,
        username: '',
        realName: '',
        orgId: null,
        roles: [],
        permissions: [],
        isSuperAdmin: false,
        dataScopeLevel: 'SELF'
      }
      try {
        const briefing = await this.createBriefing({ type, title: `${period} ${type === 'WEEK' ? '经营周报' : type === 'MONTH' ? '经营月报' : '经营日报'}` }, user)
        await this.publishBriefing(briefing.id, user)
        const channel = this.resolveNotifyChannel(sub.channel)
        await this.notify.create({
          title: briefing.title,
          content: briefing.summary ?? '经营简报已生成',
          channel,
          receiverId: sub.userId,
          bizType: 'workbench_briefing',
          bizId: briefing.id
        }, user)
        pushed += 1
      } catch (cause) {
        this.logger.warn(`订阅 ${sub.id} 推送失败：${cause instanceof Error ? cause.message : String(cause)}`)
        skipped += 1
      }
    }
    return { pushed, skipped }
  }

  /** PDF 内容（前端可打印或导出） */
  async briefingPdf(id: number, user: JwtUser): Promise<string> {
    const entity = await this.findBrief(id, user)
    return entity.pdfContent ?? this.renderHtml(entity)
  }

  /** 阅读确认 */
  async confirmRead(id: number, user: JwtUser): Promise<WorkbenchBriefingEntity> {
    const entity = await this.findBrief(id, user)
    const readBy = entity.readBy ?? []
    if (!readBy.includes(user.userId)) readBy.push(user.userId)
    entity.readBy = readBy
    return this.briefRepo.save(entity)
  }

  private async findBrief(id: number, user: JwtUser): Promise<WorkbenchBriefingEntity> {
    const entity = await this.briefRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('简报不存在')
    return entity
  }

  private renderHtml(entity: WorkbenchBriefingEntity): string {
    const escape = (value: string) => value.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char] ?? char)
    const summary = escape(entity.summary ?? '').replace(/\n/g, '<br/>')
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(entity.title)}</title>
<style>body{font-family:Arial,"Microsoft YaHei",sans-serif;margin:32px;color:#12161f}h1{font-size:22px}h2{font-size:15px;margin-top:24px}.meta{color:#666;font-size:12px}.summary{line-height:1.8;font-size:14px}table{border-collapse:collapse;width:100%;margin-top:12px}td,th{border:1px solid #ddd;padding:6px 8px;font-size:12px}</style>
</head><body><h1>${escape(entity.title)}</h1><div class="meta">周期：${escape(entity.period)} · 模板：${escape(entity.template ?? '')} · 来源：${escape((entity.sourceRefs ?? []).join('、'))}</div>
<h2>AI 摘要</h2><div class="summary">${summary}</div>
<h2>数据快照</h2><pre>${escape(JSON.stringify(entity.snapshot ?? {}, null, 2))}</pre></body></html>`
  }

  private monthOf(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }

  private dayOf(date: Date): string {
    return `${this.monthOf(date)}-${String(date.getDate()).padStart(2, '0')}`
  }

  /** 订阅渠道映射到消息中心支持的通道，非法值回退站内信 */
  private resolveNotifyChannel(channel: string | null | undefined): string {
    const value = (channel ?? 'INBOX').toUpperCase()
    if (value === 'INBOX' || value === 'INMAIL') return 'INMAIL'
    const supported = ['EMAIL', 'SMS', 'WECOM', 'DINGTALK']
    return supported.includes(value) ? value : 'INMAIL'
  }

  private isoWeek(date: Date): string {
    const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNumber = day.getUTCDay() || 7
    day.setUTCDate(day.getUTCDate() + 4 - dayNumber)
    const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1))
    const week = Math.ceil(((day.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
    return `${day.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
  }

  private num(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  private money(value: number): string {
    return value.toFixed(4)
  }

  /** 销售漏斗转化率：已收款订单占有效订单比例（%） */
  private funnelValue(orders: SaleOrderEntity[]): string {
    if (!orders.length) return '0'
    const paid = orders.filter((item) => item.payStatus === 'PAID').length
    return ((paid / orders.length) * 100).toFixed(2)
  }

  /** 产品 ABC：A 类（累计占比 70% 内）产品数量 */
  private async abcValue(tenantId: number): Promise<string> {
    const lines = await this.lineRepo.find({ where: { tenantId } as never, take: 5000 })
    const totals = new Map<number, number>()
    for (const line of lines) {
      totals.set(line.productId, (totals.get(line.productId) ?? 0) + this.num(line.amount))
    }
    const sorted = [...totals.values()].sort((a, b) => b - a)
    const grandTotal = sorted.reduce((sum, item) => sum + item, 0)
    if (!grandTotal) return '0'
    let cumulative = 0
    let count = 0
    for (const amount of sorted) {
      cumulative += amount
      if (cumulative / grandTotal > 0.7) break
      count += 1
    }
    return String(count)
  }

  /** 区域（客户分组）销售拆分 */
  private async regionBreakdown(user: JwtUser): Promise<Array<Record<string, unknown>>> {
    const orders = await this.orderRepo.find({ where: scopeWhere<SaleOrderEntity>({ tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' }), take: 2000 })
    const customers = await this.customerRepo.find({ where: { tenantId: user.tenantId }, take: 5000 })
    const groupMap = new Map<number, string>()
    for (const customer of customers) groupMap.set(customer.id, customer.customerGroup ?? '未分组')
    const buckets = new Map<string, { orders: number; amount: number; customers: Set<number> }>()
    for (const order of orders.filter((item) => EFFECTIVE_STATUS.includes(item.status))) {
      const region = groupMap.get(order.customerId) ?? '未分组'
      const bucket = buckets.get(region) ?? { orders: 0, amount: 0, customers: new Set<number>() }
      bucket.orders += 1
      bucket.amount += this.num(order.totalAmount)
      bucket.customers.add(order.customerId)
      buckets.set(region, bucket)
    }
    const total = [...buckets.values()].reduce((sum, item) => sum + item.amount, 0)
    return [...buckets.entries()]
      .map(([region, item]) => ({
        region,
        orders: item.orders,
        customers: item.customers.size,
        amount: Number(item.amount.toFixed(2)),
        ratio: total ? Number(((item.amount / total) * 100).toFixed(2)) : 0
      }))
      .sort((a, b) => Number(b.amount) - Number(a.amount))
  }

  /** 品类销售拆分 */
  private async categoryBreakdown(user: JwtUser): Promise<Array<Record<string, unknown>>> {
    const orders = await this.orderRepo.find({ where: scopeWhere<SaleOrderEntity>({ tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' }), take: 2000 })
    const effectiveIds = new Set(orders.filter((item) => EFFECTIVE_STATUS.includes(item.status)).map((item) => item.id))
    const lines = await this.lineRepo.find({ where: { tenantId: user.tenantId }, take: 10000 })
    const products = await this.productRepo.find({ where: { tenantId: user.tenantId }, take: 10000 })
    const categories = await this.categoryRepo.find({ where: { tenantId: user.tenantId }, take: 5000 })
    const productCategory = new Map<number, number | null>()
    for (const product of products) productCategory.set(product.id, product.categoryId ?? null)
    const categoryName = new Map<number, string>()
    for (const category of categories) categoryName.set(category.id, category.categoryName)
    const buckets = new Map<string, { qty: number; amount: number; orders: Set<number> }>()
    for (const line of lines) {
      if (!effectiveIds.has(line.orderId)) continue
      const categoryId = productCategory.get(line.productId) ?? null
      const name = categoryId !== null ? categoryName.get(categoryId) ?? `品类#${categoryId}` : '未分类'
      const bucket = buckets.get(name) ?? { qty: 0, amount: 0, orders: new Set<number>() }
      bucket.qty += this.num(line.qty)
      bucket.amount += this.num(line.amount)
      bucket.orders.add(line.orderId)
      buckets.set(name, bucket)
    }
    const total = [...buckets.values()].reduce((sum, item) => sum + item.amount, 0)
    return [...buckets.entries()]
      .map(([category, item]) => ({
        category,
        orders: item.orders.size,
        qty: Number(item.qty.toFixed(3)),
        amount: Number(item.amount.toFixed(2)),
        ratio: total ? Number(((item.amount / total) * 100).toFixed(2)) : 0
      }))
      .sort((a, b) => Number(b.amount) - Number(a.amount))
  }

  /** 客户活跃与流失统计（90 天未下单视为流失） */
  private customerStats(orders: SaleOrderEntity[]): { active: number; churned: number } {
    const latest = new Map<number, string>()
    for (const order of orders) {
      const current = latest.get(order.customerId)
      if (!current || order.orderDate > current) latest.set(order.customerId, order.orderDate)
    }
    const threshold = Date.now() - 90 * 86400000
    let churned = 0
    for (const date of latest.values()) {
      if (new Date(date).getTime() < threshold) churned += 1
    }
    return { active: latest.size - churned, churned }
  }
}
