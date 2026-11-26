/**
 * 财务闭环规则（纯函数）：折旧计提、费用报销审批与分摊、现金流量表分类。
 */

/* ---------------- 固定资产折旧 ---------------- */

export type DepreciationMethod = 'STRAIGHT_LINE' | 'DOUBLE_DECLINING' | 'SUM_OF_YEARS'

export const DEPRECIATION_METHODS: DepreciationMethod[] = ['STRAIGHT_LINE', 'DOUBLE_DECLINING', 'SUM_OF_YEARS']
export const DEPRECIATION_METHOD_LABEL: Record<DepreciationMethod, string> = {
  STRAIGHT_LINE: '平均年限法',
  DOUBLE_DECLINING: '双倍余额递减法',
  SUM_OF_YEARS: '年数总和法'
}

export interface DepreciationInput {
  originalValue: number
  residualRate: number
  usefulMonths: number
  alreadyDepreciated: number
  method?: DepreciationMethod
}

/** 折旧额计算：直线法按原值减残值均摊；双倍余额递减前期不扣残值、末期改直线；年数总和按月折算 */
export function computeMonthlyDepreciation(input: DepreciationInput): {
  amount: number
  remainingValue: number
  method: DepreciationMethod
  reason: string
} {
  const method = input.method ?? 'STRAIGHT_LINE'
  const residualRate = Math.max(0, Math.min(1, input.residualRate ?? 0))
  const original = Math.max(0, input.originalValue ?? 0)
  const months = Math.max(1, Math.floor(input.usefulMonths ?? 0))
  const depreciated = Math.max(0, input.alreadyDepreciated ?? 0)
  const residual = Number((original * residualRate).toFixed(4))
  const depreciable = Number(Math.max(0, original - residual - depreciated).toFixed(4))
  if (depreciable <= 0) return { amount: 0, remainingValue: residual, method, reason: '已提足折旧或残值' }
  let amount = 0
  let reason = ''
  if (method === 'STRAIGHT_LINE') {
    amount = depreciable / months
    reason = '平均年限法：剩余应折旧额 / 剩余月数'
  } else if (method === 'DOUBLE_DECLINING') {
    const rate = 2 / months
    const netBook = Number(Math.max(0, original - depreciated).toFixed(4))
    const remainingDepreciable = Number(Math.max(0, netBook - residual).toFixed(4))
    const elapsedMonths = original > 0 ? Math.min(months, Math.floor((depreciated / original) * months)) : 0
    const remainingMonths = Math.max(1, months - elapsedMonths)
    const declining = netBook * rate
    const straightLine = remainingDepreciable / remainingMonths
    if (declining <= straightLine) {
      amount = straightLine
      reason = '改按直线法提足剩余折旧'
    } else {
      amount = Math.min(declining, remainingDepreciable)
      reason = '双倍余额递减法：账面净值 × 2 / 使用月数'
    }
  } else {
    const year = Math.min(months, Math.floor(depreciated / (original / months)) + 1)
    const remainingYears = months - year + 1
    const totalYears = (months * (months + 1)) / 2
    amount = (depreciable * remainingYears) / totalYears
    reason = '年数总和法：剩余应折旧额 × 剩余月数 / 月数总和'
  }
  amount = Number(Math.min(amount, depreciable).toFixed(4))
  return { amount, remainingValue: Number(Math.max(residual, original - depreciated - amount).toFixed(4)), method, reason }
}

/** 折旧凭证分录：借记费用科目、贷记累计折旧科目 */
export function buildDepreciationVoucherEntries(input: {
  expenseSubjectId: number
  accumulatedSubjectId: number
  amount: number
  summary: string
}): Array<{ subjectId: number; summary: string; debit: string; credit: string }> {
  const amount = Math.max(0, Number(input.amount ?? 0)).toFixed(4)
  return [
    { subjectId: input.expenseSubjectId, summary: input.summary, debit: amount, credit: '0.0000' },
    { subjectId: input.accumulatedSubjectId, summary: input.summary, debit: '0.0000', credit: amount }
  ]
}

/** 折旧计提完整性校验所需的资产摘要 */
export interface DepreciationAssetSummary {
  assetNo: string
  status: string
  usefulMonths: number
  purchaseDate: string | null
  disposeDate: string | null
  depreciated: boolean
}

/** 期间末日期上限（日期格式 YYYY-MM-DD，字典序即时序） */
export function periodEndDate(period: string): string {
  return `${period}-31`
}

/** 资产在指定期间是否应计提折旧：在用、已启用、购置不晚于期末、期末未处置 */
export function isAssetDepreciableInPeriod(asset: DepreciationAssetSummary, period: string): boolean {
  if (asset.depreciated) return false
  if (asset.status !== 'ACTIVE') return false
  if (!asset.usefulMonths || asset.usefulMonths <= 0) return false
  const end = periodEndDate(period)
  if (asset.disposeDate && asset.disposeDate <= end) return false
  if (asset.purchaseDate && asset.purchaseDate > end) return false
  return true
}

/**
 * 折旧计提完整性：返回期间内应计提而未计提的资产编号。
 * 月结检查据此阻断「折旧未提完就结账」的情况。
 */
export function checkDepreciationCompleteness(
  assets: DepreciationAssetSummary[],
  period: string
): { complete: boolean; missing: string[] } {
  const missing = assets
    .filter((asset) => isAssetDepreciableInPeriod(asset, period))
    .map((asset) => asset.assetNo)
  return { complete: missing.length === 0, missing }
}

/** 折旧前置校验：停用/已处置/已结账期间/重复计提均拦截 */
export function canRunDepreciation(input: {
  status: string
  isDeleted: number
  periodClosed: boolean
  alreadyPosted: boolean
}): { ok: boolean; reason: string } {
  if (input.isDeleted === 1) return { ok: false, reason: '资产已删除' }
  if (input.status !== 'ACTIVE') return { ok: false, reason: '仅启用状态的资产可计提折旧' }
  if (input.periodClosed) return { ok: false, reason: '会计期间已结账，无法计提折旧' }
  if (input.alreadyPosted) return { ok: false, reason: '该资产当月已计提折旧' }
  return { ok: true, reason: '' }
}

/* ---------------- 费用报销审批与分摊 ---------------- */

export type ClaimStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PAID' | 'CANCELLED'

export const CLAIM_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  SUBMITTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['PAID', 'CANCELLED'],
  REJECTED: [],
  PAID: [],
  CANCELLED: []
}

export function canTransitionClaim(from: string, to: string): { allowed: boolean; reason: string } {
  const targets = CLAIM_TRANSITIONS[from as ClaimStatus]
  if (!targets) return { allowed: false, reason: `未知报销状态：${from}` }
  if (!targets.includes(to as ClaimStatus)) return { allowed: false, reason: `不能从 ${from} 流转到 ${to}` }
  return { allowed: true, reason: '' }
}

/** 报销审批：政策拒绝/无发票且政策要求发票时直接拒绝，超额时需说明 */
export function evaluateClaimApproval(input: {
  amount: number
  policyLevel: string
  hasInvoice: boolean
  policyRequiresInvoice?: boolean
  policyLimit?: number
  approveRemark?: string
}): { approved: boolean; level: 'PASS' | 'WARN' | 'REJECT'; reason: string } {
  if (input.policyLevel === 'REJECT' || input.amount <= 0) {
    return { approved: false, level: 'REJECT', reason: '费用不符合政策或金额无效' }
  }
  if (input.policyRequiresInvoice && !input.hasInvoice) {
    return { approved: false, level: 'REJECT', reason: '政策要求必须提供发票' }
  }
  if (input.policyLimit && input.amount > input.policyLimit) {
    if (!input.approveRemark?.trim()) {
      return { approved: false, level: 'WARN', reason: '超出政策额度，审批必须填写说明' }
    }
    return { approved: true, level: 'WARN', reason: `超额审批：${input.approveRemark}` }
  }
  return { approved: true, level: 'PASS', reason: '符合费用政策' }
}

export interface ClaimAllocationInput {
  deptId: number
  ratio: number
  subjectId?: number
}

/** 报销部门分摊：比例合计须为 1，按金额与比例计算分摊额（尾差归入最后一行） */
export function allocateClaimToDepartments(amount: number, allocations: ClaimAllocationInput[]): Array<{
  deptId: number
  ratio: number
  amount: number
  subjectId?: number
}> {
  const total = Number(amount ?? 0)
  const sum = allocations.reduce((acc, item) => acc + Number(item.ratio ?? 0), 0)
  if (allocations.length === 0 || Math.abs(sum - 1) > 0.0001) {
    throw new Error('部门分摊比例合计必须为 1')
  }
  let allocated = 0
  return allocations.map((item, index) => {
    const value = index === allocations.length - 1
      ? Number((total - allocated).toFixed(4))
      : Number((total * Number(item.ratio)).toFixed(4))
    allocated = Number((allocated + value).toFixed(4))
    return { deptId: item.deptId, ratio: Number(item.ratio), amount: value, subjectId: item.subjectId }
  })
}

/* ---------------- 现金流量表分类 ---------------- */

export type CashFlowCategory = 'OPERATING' | 'INVESTING' | 'FINANCING'

export const CASH_FLOW_CATEGORIES: CashFlowCategory[] = ['OPERATING', 'INVESTING', 'FINANCING']

/** 按业务来源分类现金流：经营/投资/筹资 */
export function classifyCashFlow(sourceType: string | null | undefined): CashFlowCategory {
  const value = String(sourceType ?? '').toUpperCase()
  if (/INVEST|ASSET|FIXED|CAPITAL/.test(value)) return 'INVESTING'
  if (/FINANC|LOAN|BORROW|REPAY|EQUITY|CAPITAL_IN/.test(value)) return 'FINANCING'
  return 'OPERATING'
}

export interface CashFlowTx {
  id: number
  sourceType: string | null
  amount: number
  date: string
  direction: 'IN' | 'OUT'
}

/** 正式现金流量表：按三大活动分类汇总收支并计算净额 */
export function buildCashFlowStatement(input: {
  transactions: CashFlowTx[]
  openingBalance: number
  period: string
}): {
  period: string
  openingBalance: number
  sections: Array<{ category: CashFlowCategory; inflow: number; outflow: number; net: number; count: number }>
  netIncrease: number
  endingBalance: number
} {
  const sections = CASH_FLOW_CATEGORIES.map((category) => {
    const rows = input.transactions.filter((item) => classifyCashFlow(item.sourceType) === category)
    const inflow = Number(rows.filter((item) => item.direction === 'IN').reduce((sum, item) => sum + Math.max(0, item.amount), 0).toFixed(4))
    const outflow = Number(rows.filter((item) => item.direction === 'OUT').reduce((sum, item) => sum + Math.max(0, item.amount), 0).toFixed(4))
    return { category, inflow, outflow, net: Number((inflow - outflow).toFixed(4)), count: rows.length }
  })
  const netIncrease = Number(sections.reduce((sum, item) => sum + item.net, 0).toFixed(4))
  return {
    period: input.period,
    openingBalance: Number(input.openingBalance.toFixed(4)),
    sections,
    netIncrease,
    endingBalance: Number((input.openingBalance + netIncrease).toFixed(4))
  }
}
