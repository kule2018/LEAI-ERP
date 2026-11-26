export interface LeadScoreInput {
  source?: string | null
  budget?: number
  industry?: string | null
  followers?: number
}

export interface LeadLike {
  id: number
  name: string
  phone?: string | null
}

export interface OpportunityGateInput {
  stage: string
  expectedAmount?: number
  closeDate?: string | null
  followCount?: number
  note?: string | null
}

export interface QuotationValidity {
  valid: boolean
  expired: boolean
  reason?: string
}

export interface CustomerMergeCheck {
  allowed: boolean
  reasons: string[]
}

function normalize(value: string | null | undefined): string {
  return String(value ?? '').replace(/[\s-]/g, '').toLowerCase()
}

export function scoreLead(input: LeadScoreInput): number {
  let score = 20
  if (['WEBSITE', '广告', 'EXHIBITION'].includes(input.source ?? '')) score += 20
  if ((input.budget ?? 0) >= 100000) score += 30
  else if ((input.budget ?? 0) >= 10000) score += 15
  if (input.industry) score += 10
  score += Math.min(20, (input.followers ?? 0) * 5)
  return Math.min(100, score)
}

export function isDuplicateLead(candidate: LeadLike, existing: LeadLike[]): boolean {
  return existing.some((item) => item.id !== candidate.id && (
    normalize(item.name) === normalize(candidate.name) ||
    (Boolean(candidate.phone) && normalize(item.phone) === normalize(candidate.phone))
  ))
}

const STAGE_REQUIREMENTS: Record<string, Array<keyof OpportunityGateInput>> = {
  PROSPECT: [],
  QUALIFIED: ['expectedAmount'],
  PROPOSAL: ['expectedAmount', 'followCount'],
  NEGOTIATION: ['expectedAmount', 'closeDate'],
  WON: ['expectedAmount', 'closeDate']
}

export function opportunityGate(input: OpportunityGateInput): string[] {
  const required = STAGE_REQUIREMENTS[input.stage] ?? []
  const missing: string[] = []
  for (const field of required) {
    const value = input[field]
    if (value == null || value === '' || (typeof value === 'number' && value <= 0)) missing.push(String(field))
  }
  return missing
}

export function checkQuotationValidity(expireDate: string | null | undefined, at = new Date()): QuotationValidity {
  if (!expireDate) return { valid: true, expired: false }
  const expiry = new Date(`${expireDate}T23:59:59`).getTime()
  if (!Number.isFinite(expiry)) return { valid: false, expired: false, reason: '有效期格式错误' }
  if (at.getTime() > expiry) return { valid: false, expired: true, reason: '报价已过期，不可转单' }
  return { valid: true, expired: false }
}

export function checkCustomerMerge(fromBalance: number, toBalance: number, hasOpenOrder: boolean, approved: boolean): CustomerMergeCheck {
  const reasons: string[] = []
  if (!approved) reasons.push('客户合并未审批')
  if (hasOpenOrder) reasons.push('存在未完结销售单')
  if (fromBalance > 0 && toBalance > 0) reasons.push('双方均有应收余额')
  return { allowed: reasons.length === 0, reasons }
}

export function isIdempotent(existingKeys: string[], key: string): boolean {
  return existingKeys.includes(key)
}

export function targetProgress(actual: number, target: number): { rate: number; warning: boolean } {
  if (!target || target <= 0) return { rate: 0, warning: false }
  const rate = Math.round((actual / target) * 1000) / 10
  return { rate, warning: rate < 70 }
}

export interface CustomerProfileInput {
  contactCount: number
  orderCount: number
  totalAmount: number
  lastOrderDate: string | null
  overdueAmount: number
  followCount: number
  at?: string
}

export interface CustomerProfile {
  contactCount: number
  orderCount: number
  totalAmount: number
  avgAmount: number
  lastOrderDate: string | null
  daysSinceLastOrder: number | null
  overdueAmount: number
  followCount: number
  level: 'A' | 'B' | 'C'
}

function dayDiff(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00`).getTime()
  const end = new Date(`${to}T00:00:00`).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.round((end - start) / 86400000)
}

/** 客户 360 画像：联系人、订单、金额与活跃度 */
export function buildCustomerProfile360(input: CustomerProfileInput): CustomerProfile {
  const at = input.at ?? new Date().toISOString().slice(0, 10)
  const avgAmount = input.orderCount > 0
    ? Math.round((input.totalAmount / input.orderCount) * 100) / 100
    : 0
  const daysSinceLastOrder = input.lastOrderDate ? dayDiff(input.lastOrderDate, at) : null
  const level: 'A' | 'B' | 'C' = input.orderCount >= 10 && input.totalAmount >= 100000
    ? 'A'
    : input.orderCount >= 3
      ? 'B'
      : 'C'
  return {
    contactCount: input.contactCount,
    orderCount: input.orderCount,
    totalAmount: input.totalAmount,
    avgAmount,
    lastOrderDate: input.lastOrderDate,
    daysSinceLastOrder,
    overdueAmount: input.overdueAmount,
    followCount: input.followCount,
    level
  }
}

export interface ChurnRiskResult {
  level: 'HIGH' | 'MEDIUM' | 'LOW'
  score: number
  reasons: string[]
  actions: string[]
}

/** 客户流失预警：按活跃间隔、应收逾期与跟进强度综合评分 */
export function churnRisk(profile: CustomerProfile): ChurnRiskResult {
  const reasons: string[] = []
  const actions: string[] = []
  let score = 0
  if (profile.daysSinceLastOrder == null) {
    score += 40
    reasons.push('暂无成交记录')
    actions.push('安排首次成交方案')
  } else if (profile.daysSinceLastOrder > 90) {
    score += 40
    reasons.push(`距上次成交已 ${profile.daysSinceLastOrder} 天`)
    actions.push('安排客户回访并提供权益方案')
  } else if (profile.daysSinceLastOrder > 60) {
    score += 25
    reasons.push(`距上次成交已 ${profile.daysSinceLastOrder} 天`)
    actions.push('触发关怀营销')
  }
  if (profile.overdueAmount > 0) {
    score += 25
    reasons.push(`存在逾期应收 ${profile.overdueAmount}`)
    actions.push('优先处理催收')
  }
  if (profile.orderCount <= 1) {
    score += 15
    reasons.push('成交次数少')
    actions.push('推动复购与增购')
  }
  if (profile.followCount < 3) {
    score += 15
    reasons.push('跟进频次偏低')
    actions.push('补充跟进记录')
  }
  const level: 'HIGH' | 'MEDIUM' | 'LOW' = score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW'
  return { level, score, reasons, actions }
}

export interface QuotationLineLike {
  productId: number
  qty: number
  unitPrice: number
}

export interface QuotationVersionDiff {
  changed: Array<{ productId: number; field: 'qty' | 'unitPrice'; before: number; after: number }>
  added: QuotationLineLike[]
  removed: QuotationLineLike[]
  totalBefore: number
  totalAfter: number
  totalDiff: number
}

/** 报价版本对比：逐行比较数量与单价差异 */
export function quotationVersionDiff(before: QuotationLineLike[], after: QuotationLineLike[]): QuotationVersionDiff {
  const changed: QuotationVersionDiff['changed'] = []
  const added: QuotationLineLike[] = []
  const removed: QuotationLineLike[] = []
  const beforeMap = new Map(before.map((line) => [line.productId, line]))
  const afterMap = new Map(after.map((line) => [line.productId, line]))
  for (const line of after) {
    const old = beforeMap.get(line.productId)
    if (!old) {
      added.push(line)
      continue
    }
    if (old.qty !== line.qty) changed.push({ productId: line.productId, field: 'qty', before: old.qty, after: line.qty })
    if (old.unitPrice !== line.unitPrice) changed.push({ productId: line.productId, field: 'unitPrice', before: old.unitPrice, after: line.unitPrice })
  }
  for (const line of before) {
    if (!afterMap.has(line.productId)) removed.push(line)
  }
  const totalBefore = before.reduce((sum, line) => sum + line.qty * line.unitPrice, 0)
  const totalAfter = after.reduce((sum, line) => sum + line.qty * line.unitPrice, 0)
  return {
    changed,
    added,
    removed,
    totalBefore: Math.round(totalBefore * 10000) / 10000,
    totalAfter: Math.round(totalAfter * 10000) / 10000,
    totalDiff: Math.round((totalAfter - totalBefore) * 10000) / 10000
  }
}

/** POS 会员价：会员价有效且不高于原价时取会员价 */
export function posMemberPrice(basePrice: number, memberPrice: number | null | undefined): number {
  if (memberPrice == null || !Number.isFinite(memberPrice) || memberPrice <= 0) return basePrice
  return Math.min(basePrice, memberPrice)
}

export interface PosPayment {
  payType: string
  amount: number
}

export interface PosPaymentSplit {
  splits: PosPayment[]
  paidAmount: number
  remainder: number
  valid: boolean
  reason?: string
}

/** POS 多支付拆分：校验各支付方式金额合计与应收一致 */
export function posPaymentSplit(total: number, payments: PosPayment[]): PosPaymentSplit {
  const splits = payments.filter((item) => item.amount > 0)
  const paidAmount = Math.round(splits.reduce((sum, item) => sum + item.amount, 0) * 100) / 100
  const remainder = Math.round((total - paidAmount) * 100) / 100
  if (splits.length === 0) return { splits, paidAmount, remainder, valid: false, reason: '缺少支付记录' }
  if (Math.abs(remainder) > 0.01) return { splits, paidAmount, remainder, valid: false, reason: '支付金额与应收不一致' }
  return { splits, paidAmount, remainder: 0, valid: true }
}

export interface SalesTargetAlert {
  rate: number
  gap: number
  level: 'EXCEED' | 'NORMAL' | 'WARNING' | 'CRITICAL'
  message: string
}

/** 销售目标达成预警 */
export function salesTargetAlert(target: number, actual: number): SalesTargetAlert {
  if (!target || target <= 0) return { rate: 0, gap: 0, level: 'NORMAL', message: '未设置销售目标' }
  const rate = Math.round((actual / target) * 1000) / 10
  const gap = Math.round((target - actual) * 10000) / 10000
  if (rate >= 100) return { rate, gap, level: 'EXCEED', message: '目标已达成' }
  if (rate >= 70) return { rate, gap, level: 'NORMAL', message: '目标进展正常' }
  if (rate >= 50) return { rate, gap, level: 'WARNING', message: '目标达成率偏低，需加速' }
  return { rate, gap, level: 'CRITICAL', message: '目标严重滞后，需立即干预' }
}

export interface RedInvoiceInput {
  invoiceNo: string
  amount: number
  taxAmount?: number
  reason?: string | null
  bizType?: string | null
}

/** 红字发票生成：退货冲红时按原发票生成红字凭证 */
export function buildRedInvoice(input: RedInvoiceInput): {
  invoiceNo: string
  invoiceType: 'RED'
  amount: number
  taxAmount: number
  bizType: string
  reason: string
} {
  return {
    invoiceNo: `RED-${input.invoiceNo}`,
    invoiceType: 'RED',
    amount: Math.round(input.amount * 10000) / 10000,
    taxAmount: Math.round((input.taxAmount ?? 0) * 10000) / 10000,
    bizType: input.bizType ?? 'SALE_RETURN',
    reason: input.reason?.trim() || '退货红字发票'
  }
}

/** 客户对账单红冲：核销 + 已红冲金额不得超过账单金额 */
export function checkStatementReverse(input: {
  amount: number
  statementAmount: number
  settledAmount: number
  reversedAmount: number
  status: string
  reason?: string | null
}): { allowed: boolean; reason: string } {
  if (!input.reason?.trim()) return { allowed: false, reason: '红冲原因必填' }
  if (input.amount <= 0) return { allowed: false, reason: '红冲金额必须大于零' }
  if (['REVERSED', 'CLOSED'].includes(input.status)) return { allowed: false, reason: '当前对账单状态不允许红冲' }
  const used = input.settledAmount + input.reversedAmount + input.amount
  if (used > input.statementAmount + 0.01) {
    return { allowed: false, reason: `红冲后核销合计 ${Math.round(used * 10000) / 10000} 超过账单金额 ${input.statementAmount}` }
  }
  return { allowed: true, reason: '红冲校验通过' }
}
