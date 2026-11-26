/**
 * 采购供应域纯逻辑引擎：供应商资质与银行账户校验、评级雷达、询价比价评分、
 * 需求合并、订单变更与到货计划、扫码与差异收货、暂估冲销与成本分摊、
 * 对账差异与红冲、委外损耗、物流轨迹与运费对账、价目表取价、采购绩效分析。
 * 与持久层解耦，便于单元测试。
 */

export interface CheckResult {
  ok: boolean
  reasons: string[]
}

/** 银行账号格式：8-32 位数字，去除空格与短横线后校验 */
export function normalizeAccountNo(accountNo: string): string {
  return String(accountNo ?? '').replace(/[\s-]/g, '')
}

/**
 * 银行账户校验：账号格式、户名与供应商一致、开户行必填、税号一致、同供应商账号不重复。
 */
export function checkBankAccount(input: {
  accountNo: string
  accountName: string
  bankName?: string | null
  supplierName: string
  taxNo?: string | null
  supplierTaxNo?: string | null
  existingAccounts?: Array<{ id: number; accountNo: string; accountName: string; isDefault?: number }>
}): CheckResult {
  const reasons: string[] = []
  const accountNo = normalizeAccountNo(input.accountNo)
  if (!accountNo) {
    reasons.push('银行账号不能为空')
  } else if (!/^\d{8,32}$/.test(accountNo)) {
    reasons.push('银行账号必须为 8-32 位数字')
  }
  if (!input.accountName?.trim()) {
    reasons.push('账户名称不能为空')
  } else if (input.supplierName?.trim() && input.accountName.trim() !== input.supplierName.trim()) {
    reasons.push('账户名称与供应商名称不一致')
  }
  if (!input.bankName?.trim()) {
    reasons.push('开户银行不能为空')
  }
  if (input.taxNo && input.supplierTaxNo && input.taxNo.trim() !== input.supplierTaxNo.trim()) {
    reasons.push('税号与供应商税号不一致')
  }
  for (const account of input.existingAccounts ?? []) {
    if (normalizeAccountNo(account.accountNo) === accountNo) {
      reasons.push(`银行账号与已有账户 ${account.id} 重复`)
      break
    }
  }
  return { ok: reasons.length === 0, reasons }
}

export interface RadarScores {
  quality: number
  delivery: number
  price: number
  service: number
  compliance?: number
}

/** 供应商评级雷达：加权总分 + 等级 + 最弱维度 */
export function supplierRadar(scores: RadarScores): {
  level: string
  total: number
  radar: Array<{ dimension: string; score: number; weight: number }>
  weakest: string
} {
  const dimensions: Array<{ dimension: string; score: number; weight: number }> = [
    { dimension: '质量', score: scores.quality, weight: 0.3 },
    { dimension: '交付', score: scores.delivery, weight: 0.3 },
    { dimension: '价格', score: scores.price, weight: 0.2 },
    { dimension: '服务', score: scores.service, weight: 0.1 },
    { dimension: '合规', score: scores.compliance ?? scores.quality, weight: 0.1 }
  ]
  const total = Math.round(dimensions.reduce((sum, item) => sum + item.score * item.weight, 0) * 100) / 100
  const level = total >= 90 ? 'A' : total >= 80 ? 'B' : total >= 70 ? 'C' : 'D'
  const weakest = dimensions.reduce((min, item) => (item.score < min.score ? item : min), dimensions[0]).dimension
  return { level, total, radar: dimensions, weakest }
}

/** 资质到期预警：过期 / 临期（默认 30 天）/ 正常 */
export function qualificationAlerts(
  items: Array<{ id: number; qualificationType: string; expireDate: string | null }>,
  at: string,
  warnDays = 30
): Array<{ id: number; qualificationType: string; expireDate: string | null; level: 'EXPIRED' | 'EXPIRING' | 'OK'; daysLeft: number }> {
  const base = new Date(`${at}T00:00:00`).getTime()
  return items.map((item) => {
    if (!item.expireDate) return { ...item, level: 'OK' as const, daysLeft: 9999 }
    const expiry = new Date(`${item.expireDate}T00:00:00`).getTime()
    if (!Number.isFinite(expiry)) return { ...item, level: 'OK' as const, daysLeft: 9999 }
    const daysLeft = Math.round((expiry - base) / 86400000)
    const level = daysLeft < 0 ? 'EXPIRED' : daysLeft <= warnDays ? 'EXPIRING' : 'OK'
    return { id: item.id, qualificationType: item.qualificationType, expireDate: item.expireDate, level, daysLeft }
  })
}

export interface QuoteCandidate {
  id: number
  supplierId: number
  price: number
  leadDays: number
  score?: number
}

export interface ScoredQuote {
  quoteId: number
  supplierId: number
  price: number
  leadDays: number
  priceScore: number
  leadScore: number
  qualityScore: number
  total: number
  rank: number
  awarded: boolean
}

/**
 * 询价比价评分模型：价格、交期、历史评分加权归一化。
 * 价格分按最低价与最高价线性折算，最低价不因价格权重而独占授标。
 */
export function scoreQuotes(
  quotes: QuoteCandidate[],
  weights: { price: number; lead: number; score: number },
  qualityFloor = 60
): ScoredQuote[] {
  if (quotes.length === 0) return []
  const prices = quotes.map((item) => item.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const minLead = Math.min(...quotes.map((item) => item.leadDays))
  const maxLead = Math.max(...quotes.map((item) => item.leadDays))
  const weightSum = weights.price + weights.lead + weights.score || 1

  const scored = quotes.map((quote) => {
    // 采用比值归一化，避免单价差额过大时价格分压制交期与质量分
    const priceScore = maxPrice === minPrice || quote.price <= 0
      ? 100
      : Math.round((minPrice / quote.price) * 100 * 100) / 100
    const leadScore = maxLead === minLead || quote.leadDays <= 0
      ? 100
      : Math.round((minLead / quote.leadDays) * 100 * 100) / 100
    const qualityScore = quote.score ?? 0
    const total = Math.round(
      (priceScore * weights.price + leadScore * weights.lead + qualityScore * weights.score) / weightSum * 100
    ) / 100
    return {
      quoteId: quote.id,
      supplierId: quote.supplierId,
      price: quote.price,
      leadDays: quote.leadDays,
      priceScore,
      leadScore,
      qualityScore,
      total,
      rank: 0,
      awarded: false
    }
  })

  scored.sort((a, b) => b.total - a.total)
  scored.forEach((item, index) => {
    item.rank = index + 1
  })
  if (scored.length > 0 && scored[0].qualityScore >= qualityFloor) {
    scored[0].awarded = true
  }
  return scored
}

/**
 * 自动比价授标建议：不得仅以最低价授标；
 * 若最低价报价总分落后第一名超过 5 分，说明价格不是唯一依据，需人工确认。
 */
export function recommendAward(scored: ScoredQuote[]): {
  recommendedQuoteId: number | null
  needsManualReview: boolean
  reasons: string[]
} {
  if (scored.length === 0) return { recommendedQuoteId: null, needsManualReview: true, reasons: ['无可用报价'] }
  const best = scored[0]
  const cheapest = [...scored].sort((a, b) => a.price - b.price)[0]
  const reasons: string[] = []
  let needsManualReview = false
  if (best.qualityScore < 60) {
    needsManualReview = true
    reasons.push('评分最高报价的历史评分低于 60，需人工确认')
  }
  if (cheapest.quoteId !== best.quoteId) {
    const gap = Math.round((best.total - cheapest.total) * 100) / 100
    if (gap > 5) {
      needsManualReview = true
      reasons.push(`最低价报价总分落后 ${gap} 分，价格不作为唯一授标依据`)
    } else {
      reasons.push('最低价报价与综合第一仅差综合分，授标理由可按价格优先')
    }
  } else {
    reasons.push('最低价同时为综合分第一')
  }
  return { recommendedQuoteId: best.awarded ? best.quoteId : null, needsManualReview, reasons }
}

export interface DemandRow {
  id: number
  productId: number
  qty: number
  sourceType?: string | null
}

/** 采购需求合并：按产品汇总数量并保留来源需求单 */
export function mergeDemandPlan(demands: DemandRow[]): Array<{
  productId: number
  qty: number
  sourceDemandIds: number[]
  sourceTypes: string[]
}> {
  const grouped = new Map<number, { productId: number; qty: number; sourceDemandIds: number[]; sourceTypes: string[] }>()
  for (const demand of demands) {
    const bucket = grouped.get(demand.productId) ?? {
      productId: demand.productId,
      qty: 0,
      sourceDemandIds: [],
      sourceTypes: []
    }
    bucket.qty = Math.round((bucket.qty + demand.qty) * 1000) / 1000
    bucket.sourceDemandIds.push(demand.id)
    const sourceType = demand.sourceType ?? 'MANUAL'
    if (!bucket.sourceTypes.includes(sourceType)) bucket.sourceTypes.push(sourceType)
    grouped.set(demand.productId, bucket)
  }
  return [...grouped.values()]
}

/** 采购订单变更差异：仅保留发生变化的字段 */
export function diffOrderChange(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Array<{ field: string; before: unknown; after: unknown }> {
  const fields = new Set([...Object.keys(before), ...Object.keys(after)])
  const result: Array<{ field: string; before: unknown; after: unknown }> = []
  for (const field of fields) {
    const oldValue = before[field] ?? null
    const newValue = after[field] ?? null
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      result.push({ field, before: oldValue, after: newValue })
    }
  }
  return result
}

/** 到货计划进度与逾期判定 */
export function arrivalPlanStatus(input: {
  planQty: number
  arrivedQty: number
  planDate: string | null
  at: string
}): { status: string; progress: number; overdueDays: number } {
  const progress = input.planQty > 0 ? Math.min(100, Math.round((input.arrivedQty / input.planQty) * 1000) / 10) : 0
  let status = 'PENDING'
  if (input.arrivedQty >= input.planQty && input.planQty > 0) status = 'DONE'
  else if (input.arrivedQty > 0) status = 'PARTIAL'
  let overdueDays = 0
  if (input.planDate) {
    const plan = new Date(`${input.planDate}T00:00:00`).getTime()
    const current = new Date(`${input.at}T00:00:00`).getTime()
    if (Number.isFinite(plan) && Number.isFinite(current) && current > plan && status !== 'DONE') {
      overdueDays = Math.round((current - plan) / 86400000)
      status = 'OVERDUE'
    }
  }
  return { status, progress, overdueDays }
}

export interface ScanLine {
  id: number
  productId: number
  barcode?: string | null
  serialNo?: string | null
  batchNo?: string | null
  qty: number
  receivedQty: number
}

/** 扫码收货：按条码 / 序列号 / 批次匹配订单行，并返回未收数量 */
export function matchScan(
  code: string,
  lines: ScanLine[]
): { matched: boolean; lineId?: number; productId?: number; remainQty: number; reason?: string } {
  const target = String(code ?? '').trim()
  if (!target) return { matched: false, remainQty: 0, reason: '扫码内容为空' }
  const hit = lines.find((line) =>
    (line.barcode && line.barcode.trim() === target) ||
    (line.serialNo && line.serialNo.trim() === target) ||
    (line.batchNo && line.batchNo.trim() === target)
  )
  if (!hit) return { matched: false, remainQty: 0, reason: '未匹配到订单行' }
  const remainQty = Math.round((hit.qty - hit.receivedQty) * 1000) / 1000
  if (remainQty <= 0) return { matched: false, lineId: hit.id, productId: hit.productId, remainQty: 0, reason: '该行已收完' }
  return { matched: true, lineId: hit.id, productId: hit.productId, remainQty }
}

/** 差异收货：超收 / 欠收 / 相符，超出容差需审批 */
export function receiptDifference(input: {
  orderQty: number
  receiptQty: number
  toleranceRate?: number
  qualityFailQty?: number
}): { type: string; diffQty: number; needApproval: boolean; reason: string } {
  const tolerance = input.toleranceRate ?? 0
  const diffQty = Math.round((input.receiptQty - input.orderQty) * 1000) / 1000
  const qualityFailQty = input.qualityFailQty ?? 0
  if (qualityFailQty > 0) {
    return { type: 'QUALITY', diffQty, needApproval: true, reason: `质检不合格数量 ${qualityFailQty}，需审批并退货` }
  }
  if (diffQty > 0) {
    const allowed = input.orderQty * tolerance
    return {
      type: 'OVER',
      diffQty,
      needApproval: diffQty > allowed,
      reason: diffQty > allowed ? `超收 ${diffQty} 超出容差 ${allowed}，需审批` : `超收 ${diffQty} 在容差内`
    }
  }
  if (diffQty < 0) {
    const allowed = input.orderQty * tolerance
    return {
      type: 'SHORT',
      diffQty,
      needApproval: Math.abs(diffQty) > allowed,
      reason: Math.abs(diffQty) > allowed ? `欠收 ${Math.abs(diffQty)} 超出容差 ${allowed}，需审批` : `欠收 ${Math.abs(diffQty)} 在容差内`
    }
  }
  return { type: 'EQUAL', diffQty: 0, needApproval: false, reason: '收货数量与订单一致' }
}

/** 暂估与发票匹配：金额差异在容差内允许冲销 */
export function checkEstimateReversal(input: {
  estimateAmount: number
  invoiceAmount: number
  toleranceRate?: number
}): { allowed: boolean; diff: number; reason: string } {
  const diff = Math.round((input.invoiceAmount - input.estimateAmount) * 10000) / 10000
  const tolerance = Math.abs(input.estimateAmount) * (input.toleranceRate ?? 0.01)
  if (Math.abs(diff) <= tolerance) {
    return { allowed: true, diff, reason: '发票与暂估金额一致，可冲销' }
  }
  return { allowed: false, diff, reason: `发票与暂估差异 ${diff} 超出容差 ${Math.round(tolerance * 10000) / 10000}，不可直接冲销` }
}

export interface CostItem {
  key: string
  qty?: number
  amount?: number
  weight?: number
}

/** 成本分摊：按数量 / 金额 / 重量 / 均分分摊，尾差归入第一项 */
export function allocateCost(
  total: number,
  items: CostItem[],
  basis: 'QTY' | 'AMOUNT' | 'WEIGHT' | 'EQUAL'
): Array<{ key: string; ratio: number; amount: number }> {
  if (items.length === 0) return []
  const weights = items.map((item) => {
    if (basis === 'QTY') return item.qty ?? 0
    if (basis === 'AMOUNT') return item.amount ?? 0
    if (basis === 'WEIGHT') return item.weight ?? 0
    return 1
  })
  const totalWeight = weights.reduce((sum, value) => sum + value, 0)
  let allocated = 0
  const result = items.map((item, index) => {
    const ratio = totalWeight > 0 ? weights[index] / totalWeight : 1 / items.length
    const amount = index === items.length - 1 ? Math.round((total - allocated) * 10000) / 10000 : Math.round(total * ratio * 10000) / 10000
    allocated = Math.round((allocated + amount) * 10000) / 10000
    return { key: item.key, ratio: Math.round(ratio * 10000) / 10000, amount }
  })
  return result
}

/** 对账单三方差异：订单 / 收货 / 发票 */
export function statementDifference(input: {
  orderAmount: number
  receivedAmount: number
  invoicedAmount: number
  toleranceRate?: number
}): { matched: boolean; differences: Array<{ field: string; amount: number }>; reason: string } {
  const tolerance = input.toleranceRate ?? 0.01
  const differences: Array<{ field: string; amount: number }> = []
  const check = (field: string, amount: number): void => {
    if (Math.abs(amount) > Math.abs(input.orderAmount) * tolerance + 0.01) differences.push({ field, amount })
  }
  check('收货金额', Math.round((input.receivedAmount - input.orderAmount) * 10000) / 10000)
  check('发票金额', Math.round((input.invoicedAmount - input.orderAmount) * 10000) / 10000)
  return {
    matched: differences.length === 0,
    differences,
    reason: differences.length === 0 ? '订单、收货、发票三方一致' : `存在 ${differences.length} 项差异`
  }
}

/** 对账单红冲：核销 + 已红冲金额不得超过账单金额 */
export function checkStatementReverse(input: {
  amount: number
  statementAmount: number
  settledAmount: number
  reversedAmount: number
}): { allowed: boolean; reason: string } {
  if (input.amount <= 0) return { allowed: false, reason: '红冲金额必须大于零' }
  const used = input.settledAmount + input.reversedAmount + input.amount
  if (used > input.statementAmount + 0.01) {
    return { allowed: false, reason: `红冲后核销合计 ${Math.round(used * 10000) / 10000} 超过账单金额 ${input.statementAmount}` }
  }
  return { allowed: true, reason: '红冲校验通过' }
}

/** 委外损耗：损耗量与损耗率，超标准损耗率需审批 */
export function outsourceLoss(input: {
  issuedQty: number
  receivedQty: number
  standardLossRate?: number
}): { lossQty: number; lossRate: number; exceed: boolean; needApproval: boolean; reason: string } {
  const lossQty = Math.round(Math.max(0, input.issuedQty - input.receivedQty) * 1000) / 1000
  const lossRate = input.issuedQty > 0 ? Math.round((lossQty / input.issuedQty) * 10000) / 10000 : 0
  const standard = input.standardLossRate ?? 0.03
  const exceed = lossRate > standard
  return {
    lossQty,
    lossRate,
    exceed,
    needApproval: exceed,
    reason: exceed
      ? `损耗率 ${(lossRate * 100).toFixed(2)}% 超过标准 ${(standard * 100).toFixed(2)}%，需审批`
      : `损耗率 ${(lossRate * 100).toFixed(2)}% 在标准范围内`
  }
}

export interface TrackNode {
  nodeName: string
  nodeTime: string
  location?: string | null
  status?: string | null
}

/** 物流轨迹：取最新节点并判定异常签收 */
export function waybillTrackStatus(nodes: TrackNode[]): {
  latest: TrackNode | null
  nodeCount: number
  abnormal: boolean
  reason: string
} {
  if (nodes.length === 0) return { latest: null, nodeCount: 0, abnormal: false, reason: '暂无轨迹节点' }
  const sorted = [...nodes].sort((a, b) => (a.nodeTime < b.nodeTime ? -1 : a.nodeTime > b.nodeTime ? 1 : 0))
  const latest = sorted[sorted.length - 1]
  const abnormal = ['EXCEPTION', 'REJECTED', 'LOST', 'DAMAGED'].includes(String(latest.status ?? ''))
  return {
    latest,
    nodeCount: nodes.length,
    abnormal,
    reason: abnormal ? `最新节点 ${latest.nodeName} 状态异常` : `最新节点 ${latest.nodeName}`
  }
}

/** 运费对账：承运商结算运费与申报运费差异 */
export function freightReconcile(input: { declaredAmount: number; settledAmount: number; toleranceRate?: number }): {
  matched: boolean
  diff: number
  reason: string
} {
  const diff = Math.round((input.settledAmount - input.declaredAmount) * 10000) / 10000
  const tolerance = Math.abs(input.declaredAmount) * (input.toleranceRate ?? 0.02)
  if (Math.abs(diff) <= tolerance) return { matched: true, diff, reason: '运费一致' }
  return { matched: false, diff, reason: `运费差异 ${diff} 超出容差 ${Math.round(tolerance * 10000) / 10000}` }
}

export interface PriceRow {
  id: number
  supplierId: number
  productId: number
  price: number
  startDate?: string | null
  endDate?: string | null
  priority?: number
  status?: string
}

/** 采购取价：在有效期内按优先级选价，同优先级取最新 */
export function resolvePurchasePrice(
  prices: PriceRow[],
  input: { productId: number; supplierId?: number; at: string }
): { priceId: number | null; price: number | null; reason: string } {
  const candidates = prices.filter((price) => {
    if (price.productId !== input.productId) return false
    if (input.supplierId && price.supplierId !== input.supplierId) return false
    if (price.status && price.status !== 'ENABLED') return false
    if (price.startDate && price.startDate > input.at) return false
    if (price.endDate && price.endDate < input.at) return false
    return true
  })
  if (candidates.length === 0) return { priceId: null, price: null, reason: '无可用价目价' }
  const sorted = [...candidates].sort((a, b) => {
    const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0)
    if (priorityDiff !== 0) return priorityDiff
    return b.id - a.id
  })
  return { priceId: sorted[0].id, price: sorted[0].price, reason: '按有效期与优先级命中价目价' }
}

export interface PerformanceInput {
  orders: Array<{ supplierId: number; totalAmount: number; expectedDate?: string | null; receivedDate?: string | null }>
  receipts: Array<{ supplierId: number; qty: number; passQty: number; amount: number }>
}

/** 采购绩效：及时率、质量合格率、供应商排行、成本分析 */
export function purchasePerformance(input: PerformanceInput): {
  onTimeRate: number
  passRate: number
  supplierRanking: Array<{ supplierId: number; orderAmount: number; onTimeRate: number; passRate: number; totalScore: number }>
  totalAmount: number
} {
  const onTime = input.orders.filter((order) => order.expectedDate && order.receivedDate && order.receivedDate <= order.expectedDate).length
  const onTimeRate = input.orders.length > 0 ? Math.round((onTime / input.orders.length) * 1000) / 10 : 0
  const totalQty = input.receipts.reduce((sum, item) => sum + item.qty, 0)
  const passQty = input.receipts.reduce((sum, item) => sum + item.passQty, 0)
  const passRate = totalQty > 0 ? Math.round((passQty / totalQty) * 1000) / 10 : 0
  const supplierIds = new Set<number>([
    ...input.orders.map((item) => item.supplierId),
    ...input.receipts.map((item) => item.supplierId)
  ])
  const supplierRanking = [...supplierIds].map((supplierId) => {
    const orders = input.orders.filter((item) => item.supplierId === supplierId)
    const receipts = input.receipts.filter((item) => item.supplierId === supplierId)
    const orderAmount = Math.round(orders.reduce((sum, item) => sum + item.totalAmount, 0) * 10000) / 10000
    const delivered = orders.filter((order) => order.receivedDate).length
    const supplierOnTime = orders.filter((order) => order.expectedDate && order.receivedDate && order.receivedDate <= order.expectedDate).length
    const supplierOnTimeRate = delivered > 0 ? Math.round((supplierOnTime / delivered) * 1000) / 10 : 0
    const qty = receipts.reduce((sum, item) => sum + item.qty, 0)
    const pass = receipts.reduce((sum, item) => sum + item.passQty, 0)
    const supplierPassRate = qty > 0 ? Math.round((pass / qty) * 1000) / 10 : 0
    const totalScore = Math.round((supplierOnTimeRate * 0.4 + supplierPassRate * 0.6) * 100) / 100
    return { supplierId, orderAmount, onTimeRate: supplierOnTimeRate, passRate: supplierPassRate, totalScore }
  }).sort((a, b) => b.totalScore - a.totalScore)
  const totalAmount = Math.round(input.orders.reduce((sum, item) => sum + item.totalAmount, 0) * 10000) / 10000
  return { onTimeRate, passRate, supplierRanking, totalAmount }
}

export interface MatchEvidenceLine {
  productId: number
  orderNo: string
  receiptNo: string
  invoiceNo: string | null
  orderQty: number
  receiptQty: number
  invoiceQty: number
  orderPrice: number
  invoicePrice: number
  status: string
  issues: string[]
}

/** 三方匹配证据链：把订单/收货/发票的逐行比对结果固化为可追溯凭证 */
export function matchEvidenceChain(
  lines: Array<{
    productId: number
    orderNo: string
    receiptNo: string
    invoiceNo: string | null
    orderQty: number
    receiptQty: number
    invoiceQty: number
    orderPrice: number
    invoicePrice: number
    matched: boolean
    status: string
    issues: string[]
  }>
): { evidence: MatchEvidenceLine[]; matched: boolean; status: string; issueCount: number } {
  const statusRank: Record<string, number> = { MATCHED: 0, PRICE_DIFF: 1, QUANTITY_DIFF: 2, MISSING: 3 }
  const evidence = lines.map((line) => ({
    productId: line.productId,
    orderNo: line.orderNo,
    receiptNo: line.receiptNo,
    invoiceNo: line.invoiceNo,
    orderQty: line.orderQty,
    receiptQty: line.receiptQty,
    invoiceQty: line.invoiceQty,
    orderPrice: line.orderPrice,
    invoicePrice: line.invoicePrice,
    status: line.status,
    issues: line.issues
  }))
  const matched = evidence.every((line) => line.status === 'MATCHED')
  const status = evidence.reduce(
    (worst, line) => (statusRank[line.status] > statusRank[worst] ? line.status : worst),
    'MATCHED'
  )
  return {
    evidence,
    matched,
    status,
    issueCount: evidence.reduce((sum, line) => sum + line.issues.length, 0)
  }
}

export interface FrameAgreementInput {
  version: number
  startDate: string | null
  endDate: string | null
  totalQty: number | null
  usedQty: number
  at: string
}

/** 框架协议版本：校验生效区间与数量上限，输出下一版本号与可用量 */
export function frameAgreementState(input: FrameAgreementInput): {
  valid: boolean
  nextVersion: number
  remainingQty: number | null
  reason?: string
} {
  const nextVersion = (input.version ?? 0) + 1
  if (input.startDate && input.startDate > input.at) {
    return { valid: false, nextVersion, remainingQty: null, reason: '协议尚未生效' }
  }
  if (input.endDate && input.endDate < input.at) {
    return { valid: false, nextVersion, remainingQty: null, reason: '协议已到期' }
  }
  if (input.totalQty != null && input.usedQty >= input.totalQty) {
    return { valid: false, nextVersion, remainingQty: 0, reason: '协议数量额度已用尽' }
  }
  const remainingQty = input.totalQty == null ? null : Math.round((input.totalQty - input.usedQty) * 1000) / 1000
  return { valid: true, nextVersion, remainingQty }
}

export interface BlacklistInput {
  supplierId: number
  level: string
  startDate: string | null
  endDate: string | null
  at: string
}

/** 供应商黑名单准入：命中生效中的黑名单记录时禁止下单 */
export function supplierBlacklistHit(
  rules: Array<{ supplierId: number; level: string; startDate: string | null; endDate: string | null }>,
  supplierId: number,
  at: string
): { hit: boolean; level: string | null; reason: string } {
  const rule = rules.find((item) => {
    if (item.supplierId !== supplierId) return false
    if (item.startDate && item.startDate > at) return false
    if (item.endDate && item.endDate < at) return false
    return true
  })
  if (!rule) return { hit: false, level: null, reason: '未命中黑名单' }
  return { hit: true, level: rule.level, reason: `供应商已列入${rule.level}级黑名单，禁止下单` }
}
