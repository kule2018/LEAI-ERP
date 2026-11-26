/**
 * 销售交付扩展引擎（纯函数）
 * 覆盖规范第 3 章中尚未落地的业务规则：
 * 1. 拣货波次复核后才可发货
 * 2. POS 交接班现金盘点差异
 * 3. 组合促销（套装 / 满减）开单匹配
 * 4. 销售退货换货前置校验
 * 5. 客户对账单差异标记与 AI 对账建议（依据 + 置信度）
 * 6. 出货物流轨迹时间轴
 * 7. 出货异常回单严重度与处理校验
 */

export interface PickTaskState {
  id: number
  productId: number
  qty: number
  pickedQty: number
  status: string
}

export interface PickWaveState {
  waveNo: string
  status: string
  tasks: PickTaskState[]
}

export interface WaveReviewPlan {
  total: number
  picked: number
  shortPicked: number
  ready: boolean
  status: string
  reason: string
}

/** 波次复核计划：所有任务拣足数量后方可复核 */
export function buildWaveReviewPlan(wave: PickWaveState): WaveReviewPlan {
  const total = wave.tasks.length
  const shortPicked = wave.tasks.filter((task) => task.pickedQty + 0.000001 < task.qty).length
  const picked = total - shortPicked
  const ready = total > 0 && shortPicked === 0
  return {
    total,
    picked,
    shortPicked,
    ready,
    status: wave.status,
    reason: ready ? '拣货任务已全部完成，可复核' : `尚有 ${shortPicked} 个拣货任务未拣足数量`
  }
}

export interface WaveShippableCheck {
  allowed: boolean
  reason: string
}

/** 波次复核后才可发货：未完成拣货或未复核一律拦截 */
export function checkWaveShippable(wave: PickWaveState): WaveShippableCheck {
  const plan = buildWaveReviewPlan(wave)
  if (!plan.ready) return { allowed: false, reason: plan.reason }
  if (!['REVIEWED', 'DONE'].includes(wave.status)) {
    return { allowed: false, reason: `波次状态为 ${wave.status}，复核后才可发货` }
  }
  return { allowed: true, reason: '波次已复核，允许发货' }
}

export interface ShiftCloseInput {
  /** 开班备用金 */
  openingCash: number
  /** 本班现金收款金额 */
  cashReceived: number
  /** 其他现金收入（找零补差等） */
  otherIncome: number
  /** 实盘现金 */
  actualCash: number
  /** 本班订单笔数 */
  orderCount: number
  /** 本班订单金额 */
  orderAmount: number
}

export interface ShiftCloseResult {
  expectedCash: number
  difference: number
  differenceRate: number
  level: 'OK' | 'WARN' | 'ALARM'
  message: string
  requireApproval: boolean
}

/**
 * POS 交接班：按「开班备用金 + 现金收款 + 其他现金收入」计算应存现金，
 * 与实盘现金比对得出差异；差异超过阈值需说明并留痕。
 */
export function computeShiftClose(input: ShiftCloseInput): ShiftCloseResult {
  const expectedCash = round4(input.openingCash + input.cashReceived + input.otherIncome)
  const difference = round4(input.actualCash - expectedCash)
  const absDiff = Math.abs(difference)
  const base = Math.abs(expectedCash) > 0.01 ? absDiff / Math.abs(expectedCash) : (absDiff > 0 ? 1 : 0)
  const differenceRate = round4(base * 100)
  let level: ShiftCloseResult['level'] = 'OK'
  let message = '现金核对无误'
  let requireApproval = false
  if (absDiff > 50 || differenceRate > 5) {
    level = 'ALARM'
    message = `现金差异 ${difference}（${differenceRate}%），金额较大，需主管审批并说明原因`
    requireApproval = true
  } else if (absDiff > 0.01) {
    level = 'WARN'
    message = `现金差异 ${difference}（${differenceRate}%），请确认找零与备用金`
  }
  return { expectedCash, difference, differenceRate, level, message, requireApproval }
}

export interface BundleItem {
  productId: number
  qty: number
}

export interface BundleRule {
  id: number
  code: string
  name: string
  /** COMBO=套装价；FULL_REDUCTION=满减 */
  type: 'COMBO' | 'FULL_REDUCTION'
  items: BundleItem[]
  /** 满减门槛金额 */
  thresholdAmount?: number | null
  /** 满减优惠金额 */
  discountAmount?: number | null
  /** 套装价 */
  comboPrice?: number | null
  priority: number
  startDate?: string | null
  endDate?: string | null
  status: string
}

export interface OrderLineLike {
  productId: number
  qty: number
  unitPrice: number
}

export interface BundleMatch {
  bundleId: number
  code: string
  name: string
  type: string
  discountAmount: number
  /** 命中的订单行（套装为成分行，满减为整单） */
  matchedLines: Array<{ productId: number; qty: number; amount: number }>
  reason: string
}

function inEffectiveRange(rule: BundleRule, at: string): boolean {
  if (rule.startDate && at < rule.startDate) return false
  if (rule.endDate && at > rule.endDate) return false
  return true
}

/** 组合促销匹配：套装按成分齐套后比较套装价，满减按整单金额达标 */
export function matchPromotionBundles(
  lines: OrderLineLike[],
  rules: BundleRule[],
  at = new Date().toISOString().slice(0, 10)
): BundleMatch[] {
  const usable = rules.filter((rule) => rule.status === 'ENABLED' && inEffectiveRange(rule, at))
  const matches: BundleMatch[] = []
  const totalAmount = lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0)
  for (const rule of usable) {
    if (rule.type === 'FULL_REDUCTION') {
      const threshold = rule.thresholdAmount ?? 0
      const discount = rule.discountAmount ?? 0
      if (threshold <= 0 || discount <= 0) continue
      if (totalAmount + 0.01 < threshold) continue
      matches.push({
        bundleId: rule.id,
        code: rule.code,
        name: rule.name,
        type: rule.type,
        discountAmount: round4(discount),
        matchedLines: lines.map((line) => ({ productId: line.productId, qty: line.qty, amount: round4(line.qty * line.unitPrice) })),
        reason: `整单金额 ${round4(totalAmount)} 达到满减门槛 ${threshold}`
      })
      continue
    }
    const comboItems = rule.items ?? []
    if (comboItems.length === 0) continue
    const matchedLines: BundleMatch['matchedLines'] = []
    let comboAmount = 0
    let matched = true
    for (const item of comboItems) {
      const line = lines.find((candidate) => candidate.productId === item.productId)
      if (!line || line.qty + 0.000001 < item.qty) {
        matched = false
        break
      }
      comboAmount += item.qty * line.unitPrice
      matchedLines.push({ productId: item.productId, qty: item.qty, amount: round4(item.qty * line.unitPrice) })
    }
    if (!matched) continue
    const comboPrice = rule.comboPrice ?? 0
    if (comboPrice <= 0 || comboAmount - comboPrice <= 0.01) continue
    matches.push({
      bundleId: rule.id,
      code: rule.code,
      name: rule.name,
      type: rule.type,
      discountAmount: round4(comboAmount - comboPrice),
      matchedLines,
      reason: `套装成分齐套，标准合计 ${round4(comboAmount)}，套装价 ${comboPrice}`
    })
  }
  return matches.sort((a, b) => {
    const ruleA = usable.find((rule) => rule.id === a.bundleId)
    const ruleB = usable.find((rule) => rule.id === b.bundleId)
    const priorityDiff = (ruleB?.priority ?? 0) - (ruleA?.priority ?? 0)
    if (priorityDiff !== 0) return priorityDiff
    return b.discountAmount - a.discountAmount
  })
}

/**
 * 选定可叠加的最优促销：同一商品行不允许被多个促销重复优惠，
 * 返回命中的促销及最终优惠额。
 */
export function selectPromotionBundles(
  lines: OrderLineLike[],
  rules: BundleRule[],
  at = new Date().toISOString().slice(0, 10)
): { applied: BundleMatch[]; totalDiscount: number } {
  const candidates = matchPromotionBundles(lines, rules, at)
  const applied: BundleMatch[] = []
  const usedLines = new Set<number>()
  for (const candidate of candidates) {
    const overlap = candidate.matchedLines.some((line) => usedLines.has(line.productId))
    if (overlap) continue
    candidate.matchedLines.forEach((line) => usedLines.add(line.productId))
    applied.push(candidate)
  }
  return { applied, totalDiscount: round4(applied.reduce((sum, item) => sum + item.discountAmount, 0)) }
}

export interface ExchangeCheckInput {
  /** 退货单状态 */
  returnStatus: string
  /** 是否已审批通过 */
  approved: boolean
  /** 质检是否通过 */
  qcPassed: boolean
  /** 可换货数量 */
  returnQty: number
  /** 本次换货数量 */
  exchangeQty: number
}

/** 换货前置校验：需退货单审批通过且质检合格，换货数量不得超过退货数量 */
export function checkExchangeAllowed(input: ExchangeCheckInput): { allowed: boolean; reason: string } {
  if (!input.approved || input.returnStatus !== 'APPROVED') {
    return { allowed: false, reason: '退货单需审批通过后方可换货' }
  }
  if (!input.qcPassed) return { allowed: false, reason: '退回商品质检未通过，不可换货' }
  if (input.exchangeQty <= 0) return { allowed: false, reason: '换货数量必须大于零' }
  if (input.exchangeQty - input.returnQty > 0.000001) {
    return { allowed: false, reason: `换货数量 ${input.exchangeQty} 超过可换数量 ${input.returnQty}` }
  }
  return { allowed: true, reason: '换货校验通过' }
}

export interface StatementDiffInput {
  /** 账单金额 */
  statementAmount: number
  /** 关联订单金额 */
  orderAmount: number
  /** 已核销金额 */
  settledAmount: number
  /** 已红冲金额 */
  reversedAmount: number
  /** 明细条目数 */
  itemCount: number
}

export interface StatementDiffResult {
  flag: 'NO' | 'MINOR' | 'MAJOR'
  diffAmount: number
  diffRate: number
  level: 'OK' | 'WARN' | 'ALARM'
  reasons: string[]
}

/** 客户对账差异标记：账单与订单金额比对 + 核销/红冲超额校验 */
export function buildStatementDiff(input: StatementDiffInput): StatementDiffResult {
  const reasons: string[] = []
  const diffAmount = round4(input.statementAmount - input.orderAmount)
  const absDiff = Math.abs(diffAmount)
  const base = Math.abs(input.orderAmount) > 0.01 ? absDiff / Math.abs(input.orderAmount) : (absDiff > 0 ? 1 : 0)
  const diffRate = round4(base * 100)
  const used = round4(input.settledAmount + input.reversedAmount)
  if (absDiff > 0.01) {
    reasons.push(diffAmount > 0
      ? `账单金额高于订单金额 ${absDiff}`
      : `账单金额低于订单金额 ${absDiff}`)
  }
  if (used - input.statementAmount > 0.01) {
    reasons.push(`已核销加红冲金额 ${used} 超过账单金额 ${input.statementAmount}`)
  }
  if (input.itemCount === 0) reasons.push('账单无明细条目')
  let flag: StatementDiffResult['flag'] = 'NO'
  let level: StatementDiffResult['level'] = 'OK'
  if (reasons.length > 0) {
    flag = diffRate > 5 || used - input.statementAmount > 0.01 ? 'MAJOR' : 'MINOR'
    level = flag === 'MAJOR' ? 'ALARM' : 'WARN'
  }
  return { flag, diffAmount, diffRate, level, reasons }
}

export interface StatementSuggestion {
  type: 'FULL_SETTLE' | 'PARTIAL_SETTLE' | 'HOLD' | 'RED_REVERSE' | 'CHECK_ITEM'
  title: string
  amount: number
  /** 置信度 0~1 */
  confidence: number
  /** 建议依据 */
  evidence: string[]
  action: string
}

/**
 * AI 对账建议：基于差异事实生成建议，每条建议给出依据与置信度，
 * 低置信度建议仅作为提示，需人工确认。
 */
export function buildStatementAiSuggestion(
  diff: StatementDiffResult,
  input: StatementDiffInput
): StatementSuggestion[] {
  const suggestions: StatementSuggestion[] = []
  const remaining = round4(input.statementAmount - input.settledAmount - input.reversedAmount)
  if (diff.level === 'OK') {
    suggestions.push({
      type: 'FULL_SETTLE',
      title: '账单与订单一致，可全额核销',
      amount: remaining,
      confidence: 0.95,
      evidence: [
        `账单金额 ${input.statementAmount} 与订单金额 ${input.orderAmount} 一致`,
        `明细条目 ${input.itemCount} 条`
      ],
      action: '按账单全额发起核销'
    })
    return suggestions
  }
  if (diff.reasons.some((reason) => reason.includes('超过账单金额'))) {
    suggestions.push({
      type: 'RED_REVERSE',
      title: '存在超额核销，建议红冲多余部分',
      amount: round4(input.settledAmount + input.reversedAmount - input.statementAmount),
      confidence: 0.88,
      evidence: diff.reasons,
      action: '发起红冲并附差异说明，经审批后冲回'
    })
  }
  if (diff.diffAmount > 0.01) {
    suggestions.push({
      type: 'HOLD',
      title: '账单高于订单金额，建议暂缓核销并核对明细',
      amount: diff.diffAmount,
      confidence: 0.82,
      evidence: [
        `账单金额 ${input.statementAmount} 高于订单金额 ${input.orderAmount}`,
        `差异率 ${diff.diffRate}%`
      ],
      action: '暂缓核销，核对出库与折扣明细后重算账单'
    })
  } else if (diff.diffAmount < -0.01) {
    suggestions.push({
      type: 'PARTIAL_SETTLE',
      title: '账单低于订单金额，建议按订单金额补差后核销',
      amount: Math.abs(diff.diffAmount),
      confidence: 0.76,
      evidence: [
        `账单金额 ${input.statementAmount} 低于订单金额 ${input.orderAmount}`,
        `差异率 ${diff.diffRate}%`
      ],
      action: '按订单金额补差后再发起核销'
    })
  }
  if (input.itemCount === 0) {
    suggestions.push({
      type: 'CHECK_ITEM',
      title: '账单缺少明细条目，建议重新生成',
      amount: 0,
      confidence: 0.9,
      evidence: ['账单明细条目数为 0'],
      action: '重新生成账单明细并复核'
    })
  }
  return suggestions
}

export interface TrackingNodeLike {
  nodeCode: string
  nodeName: string
  nodeTime: string
  location?: string | null
  operator?: string | null
  source?: string | null
  remark?: string | null
}

export interface TrackingTimelineNode extends TrackingNodeLike {
  step: number
  isCurrent: boolean
}

/** 出货物流轨迹时间轴：按时间正序排列并标记当前节点 */
export function buildTrackingTimeline(nodes: TrackingNodeLike[]): TrackingTimelineNode[] {
  const sorted = [...nodes].sort((a, b) => String(a.nodeTime).localeCompare(String(b.nodeTime)))
  return sorted.map((node, index) => ({
    ...node,
    step: index + 1,
    isCurrent: index === sorted.length - 1
  }))
}

export const SHIPMENT_EXCEPTION_TYPES = ['REJECTED', 'DAMAGED', 'LOST', 'DELAY', 'SHORTAGE', 'OTHER'] as const

export type ShipmentExceptionType = typeof SHIPMENT_EXCEPTION_TYPES[number]

/** 异常严重度：丢失与破损为高危，需主管处理 */
export function exceptionSeverity(type: string): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (['LOST', 'DAMAGED'].includes(type)) return 'HIGH'
  if (['REJECTED', 'SHORTAGE'].includes(type)) return 'MEDIUM'
  return 'LOW'
}

/** 异常回单登记校验 */
export function checkExceptionInput(input: {
  type: string
  description: string
  evidenceUrls?: string[]
}): { allowed: boolean; reason: string } {
  if (!SHIPMENT_EXCEPTION_TYPES.includes(input.type as ShipmentExceptionType)) {
    return { allowed: false, reason: `异常类型不合法：${input.type}` }
  }
  if (!input.description?.trim()) return { allowed: false, reason: '异常描述必填' }
  if ((input.evidenceUrls?.length ?? 0) === 0) {
    return { allowed: false, reason: '异常回单需上传至少一张凭证照片' }
  }
  return { allowed: true, reason: '异常回单校验通过' }
}

function round4(value: number): number {
  return Math.round((Number(value) || 0) * 10000) / 10000
}
