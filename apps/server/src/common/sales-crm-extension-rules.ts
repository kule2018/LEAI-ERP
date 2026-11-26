/**
 * 销售扩展纯规则：佣金计算、投诉时效、未发货清单、退货率。
 */

export type CommissionType = 'RATE' | 'FIXED' | 'TIER'

export interface CommissionRuleInput {
  type: CommissionType
  /** 比例（0-1），type=RATE 时使用 */
  rate?: number
  /** 固定金额，type=FIXED 时使用 */
  fixedAmount?: number
  /** 阶梯规则：按累计销售额区间命中档位，如 [{ min: 0, rate: 0.01 }, { min: 100000, rate: 0.02 }] */
  tiers?: Array<{ min: number; rate: number }>
}

export interface CommissionContext {
  orderAmount: number
  /** 规则适用门槛（累计销售额） */
  accumulatedAmount?: number
  /** 退货冲减金额 */
  returnAmount?: number
}

export interface CommissionResult {
  commissionAmount: number
  matchedTier: { min: number; rate: number } | null
  reason: string
}

/** 佣金计算：固定金额、比例、阶梯三种方式；退货金额从计佣基数中冲减 */
export function computeCommission(rule: CommissionRuleInput, context: CommissionContext): CommissionResult {
  const base = Number((context.orderAmount - (context.returnAmount ?? 0)).toFixed(4))
  if (base <= 0) return { commissionAmount: 0, matchedTier: null, reason: '计佣基数不大于 0' }
  if (rule.type === 'FIXED') {
    const amount = Number((rule.fixedAmount ?? 0).toFixed(4))
    return { commissionAmount: amount, matchedTier: null, reason: '按固定金额计提' }
  }
  if (rule.type === 'TIER') {
    const tiers = [...(rule.tiers ?? [])].sort((a, b) => a.min - b.min)
    if (tiers.length === 0) return { commissionAmount: 0, matchedTier: null, reason: '未配置阶梯档位' }
    const accumulated = context.accumulatedAmount ?? 0
    let matched = tiers[0]
    for (const tier of tiers) {
      if (accumulated >= tier.min) matched = tier
    }
    return {
      commissionAmount: Number((base * matched.rate).toFixed(4)),
      matchedTier: matched,
      reason: `命中阶梯 ${matched.min} 档，比例 ${(matched.rate * 100).toFixed(2)}%`
    }
  }
  const rate = Number(rule.rate ?? 0)
  if (rate <= 0) return { commissionAmount: 0, matchedTier: null, reason: '规则未配置有效比例' }
  return { commissionAmount: Number((base * rate).toFixed(4)), matchedTier: null, reason: `按 ${(rate * 100).toFixed(2)}% 计提` }
}

export type ComplaintStatus = 'OPEN' | 'PROCESSING' | 'RESOLVED' | 'CLOSED'

export interface ComplaintSlaInput {
  status: string
  createdAt: string
  dueAt?: string | null
  resolvedAt?: string | null
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
}

/** 投诉时效：按严重级别给出响应时限（小时），返回是否超时与剩余/逾期小时数 */
export function evaluateComplaintSla(input: ComplaintSlaInput, now: Date): {
  dueHours: number
  overdue: boolean
  overdueHours: number
  closed: boolean
} {
  const severityHours: Record<string, number> = { LOW: 72, MEDIUM: 48, HIGH: 24, URGENT: 8 }
  const dueHours = severityHours[input.severity] ?? 48
  const closed = input.status === 'RESOLVED' || input.status === 'CLOSED'
  const end = closed && input.resolvedAt ? new Date(input.resolvedAt) : now
  const created = new Date(input.createdAt).getTime()
  const spentHours = Number(((end.getTime() - created) / 3600000).toFixed(2))
  const overdue = !closed && spentHours > dueHours
  return {
    dueHours,
    overdue,
    overdueHours: overdue ? Number((spentHours - dueHours).toFixed(2)) : 0,
    closed
  }
}

/** 投诉工单状态流转：OPEN → PROCESSING → RESOLVED → CLOSED */
export const COMPLAINT_TRANSITIONS: Record<string, string[]> = {
  OPEN: ['PROCESSING'],
  PROCESSING: ['RESOLVED'],
  RESOLVED: ['CLOSED', 'PROCESSING'],
  CLOSED: []
}

/** 投诉状态流转校验 */
export function canTransitionComplaint(from: string, to: string): { allowed: boolean; reason: string } {
  const allowed = COMPLAINT_TRANSITIONS[from] ?? []
  if (allowed.includes(to)) return { allowed: true, reason: `允许从 ${from} 流转到 ${to}` }
  if (from === to) return { allowed: true, reason: '状态未变更' }
  return { allowed: false, reason: `不允许从 ${from} 流转到 ${to}` }
}

/** 佣金记录状态流转：PENDING → CONFIRMED → PAID */
export const COMMISSION_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PAID', 'CANCELLED'],
  PAID: [],
  CANCELLED: []
}

/** 佣金记录状态流转校验 */
export function canTransitionCommission(from: string, to: string): { allowed: boolean; reason: string } {
  const allowed = COMMISSION_TRANSITIONS[from] ?? []
  if (allowed.includes(to)) return { allowed: true, reason: `允许从 ${from} 流转到 ${to}` }
  if (from === to) return { allowed: true, reason: '状态未变更' }
  return { allowed: false, reason: `不允许从 ${from} 流转到 ${to}` }
}

/** 佣金规则生效期校验：起止日期为空视为不限 */
export function isRuleEffective(
  rule: { effectiveFrom?: string | null; effectiveTo?: string | null; status?: string },
  date: string
): boolean {
  if (rule.status && rule.status !== 'ACTIVE') return false
  if (rule.effectiveFrom && date < rule.effectiveFrom) return false
  if (rule.effectiveTo && date > rule.effectiveTo) return false
  return true
}

/** 默认承诺交期天数：订单日期后 7 天 */
export const DEFAULT_PROMISE_DAYS = 7

/** 计算承诺交期：订单日期 + 交期天数 */
export function resolvePromisedDate(orderDate: string, days: number = DEFAULT_PROMISE_DAYS): string {
  const base = new Date(`${orderDate.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(base.getTime())) return orderDate
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString().slice(0, 10)
}

export interface UnshippedLineInput {
  orderId: number
  orderNo: string
  customerId: number
  customerName: string
  productId: number
  productName: string
  orderedQty: number
  shippedQty: number
  orderDate: string
  promisedDate?: string | null
}

export interface UnshippedRow extends UnshippedLineInput {
  unshippedQty: number
  overdue: boolean
}

/** 未发货清单：订单行减去已发货数量 */
export function buildUnshippedList(lines: UnshippedLineInput[], now: Date): UnshippedRow[] {
  return lines
    .map((line) => {
      const unshippedQty = Number((line.orderedQty - line.shippedQty).toFixed(4))
      const overdue = Boolean(line.promisedDate) && new Date(line.promisedDate as string).getTime() < now.getTime() && unshippedQty > 0
      return { ...line, unshippedQty, overdue }
    })
    .filter((row) => row.unshippedQty > 0)
}

/** 退货率：退货金额 / 销售金额 */
export function computeReturnRate(salesAmount: number, returnAmount: number): { rate: number; percent: string } {
  if (salesAmount <= 0) return { rate: 0, percent: '0.00%' }
  const rate = Number((returnAmount / salesAmount).toFixed(6))
  return { rate, percent: `${(rate * 100).toFixed(2)}%` }
}

/* ---------------- 佣金规则冲突与批量计提 ---------------- */

export interface CommissionRuleConflictInput {
  id?: number
  ruleName?: string
  /** null 表示适用全部销售员 */
  salesRepId: number | null
  effectiveFrom: string | null
  effectiveTo: string | null
  status: string
}

/** 两个佣金规则的适用范围是否重叠 */
export function isCommissionRuleScopeOverlap(a: CommissionRuleConflictInput, b: CommissionRuleConflictInput): boolean {
  if (a.salesRepId !== null && b.salesRepId !== null && a.salesRepId !== b.salesRepId) return false
  const aFrom = a.effectiveFrom ?? '0000-01-01'
  const bFrom = b.effectiveFrom ?? '0000-01-01'
  const aTo = a.effectiveTo ?? '9999-12-31'
  const bTo = b.effectiveTo ?? '9999-12-31'
  return aFrom <= bTo && bFrom <= aTo
}

/** 佣金规则冲突校验：同一销售员（或全员）有效期不可重叠 */
export function evaluateCommissionRuleConflict(
  existing: CommissionRuleConflictInput[],
  incoming: CommissionRuleConflictInput
): { ok: boolean; reason?: string; conflictId?: number } {
  if (incoming.status !== 'ACTIVE') return { ok: true }
  for (const item of existing) {
    if (item.id === incoming.id) continue
    if (item.status !== 'ACTIVE') continue
    if (!isCommissionRuleScopeOverlap(item, incoming)) continue
    return {
      ok: false,
      reason: `与佣金规则「${item.ruleName ?? item.id}」适用范围重叠，请调整有效期或销售员`,
      conflictId: item.id
    }
  }
  return { ok: true }
}

export interface CommissionAccrualInput {
  ruleId: number
  orderId: number
  orderNo: string
  salesRepId: number | null
  orderAmount: number
  returnAmount: number
  period: string
}

/** 批量计提计划：跳过已计提的（规则 + 订单）组合 */
export function buildCommissionAccrualPlan(items: CommissionAccrualInput[], takenKeys: string[]): CommissionAccrualInput[] {
  const taken = new Set(takenKeys)
  return items.filter((item) => !taken.has(`${item.ruleId}-${item.orderId}`))
}

/* ---------------- 客户回访闭环 ---------------- */

export interface VisitPlanCustomer {
  customerId: number
  customerName?: string
  salesRepId: number | null
  /** 回访周期（天） */
  intervalDays: number
  lastVisitAt: string | null
}

export interface VisitPlanRow {
  customerId: number
  customerName: string
  salesRepId: number | null
  visitDate: string
  overdueDays: number
  reason: string
}

/** 生成回访计划：按客户回访周期推算下次回访日期 */
export function buildVisitPlan(customers: VisitPlanCustomer[], now: Date): VisitPlanRow[] {
  const rows: VisitPlanRow[] = []
  for (const customer of customers) {
    const intervalDays = customer.intervalDays > 0 ? customer.intervalDays : 30
    const base = customer.lastVisitAt ? new Date(customer.lastVisitAt) : now
    const due = new Date(base.getTime() + intervalDays * 24 * 60 * 60 * 1000)
    const overdueDays = Math.floor((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000))
    rows.push({
      customerId: customer.customerId,
      customerName: customer.customerName ?? '',
      salesRepId: customer.salesRepId,
      visitDate: due.toISOString().slice(0, 10),
      overdueDays: overdueDays > 0 ? overdueDays : 0,
      reason: customer.lastVisitAt ? '按回访周期到期' : '新客户首次回访'
    })
  }
  return rows
}

export interface VisitCoverageInput {
  status: string
  visitDate: string
  satisfaction?: number | null
}

/** 回访覆盖率统计：计划数、完成数、超期数、满意度均值 */
export function summarizeVisitCoverage(visits: VisitCoverageInput[], now: Date): {
  total: number
  planned: number
  done: number
  overdue: number
  rate: number
  avgSatisfaction: number
} {
  const total = visits.length
  const planned = visits.filter((item) => item.status === 'PLANNED').length
  const done = visits.filter((item) => item.status === 'DONE').length
  const overdue = visits.filter((item) => item.status === 'PLANNED' && new Date(item.visitDate).getTime() < now.getTime()).length
  const scored = visits.filter((item) => item.status === 'DONE' && typeof item.satisfaction === 'number')
  const avgSatisfaction = scored.length > 0
    ? Number((scored.reduce((sum, item) => sum + Number(item.satisfaction ?? 0), 0) / scored.length).toFixed(2))
    : 0
  const rate = total > 0 ? Number(((done / total) * 100).toFixed(2)) : 0
  return { total, planned, done, overdue, rate, avgSatisfaction }
}

/* ---------------- 投诉工单重开 ---------------- */

/** 投诉重开校验：仅已关闭工单可重开，且重开次数受控 */
export function evaluateComplaintReopen(input: { status: string; reopenCount: number; maxReopen?: number }): { allowed: boolean; reason: string } {
  if (input.status !== 'CLOSED') return { allowed: false, reason: '仅已关闭的投诉工单可重开' }
  const max = input.maxReopen ?? 3
  if (input.reopenCount >= max) return { allowed: false, reason: `重开次数已达上限（${max} 次）` }
  return { allowed: true, reason: '' }
}
