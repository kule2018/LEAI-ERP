/**
 * 盘点差异审批规则（纯函数层）
 *
 * 规范要求：库存 —— 盘点（盲盘/复盘/差异审批）。
 * 状态机：DRAFT → COUNTING → RECOUNTED → PENDING_APPROVAL → APPROVED → DONE，另有 REJECTED（驳回后重新盘点）。
 * 差异数量容差内视为无差异，可直接过账；存在差异时必须先提交审批，审批通过后方可过账。
 */

/** 盘点单状态 */
export const STOCKTAKE_STATUS = {
  DRAFT: 'DRAFT',
  COUNTING: 'COUNTING',
  RECOUNTED: 'RECOUNTED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  DONE: 'DONE'
} as const

export type StocktakeStatus = (typeof STOCKTAKE_STATUS)[keyof typeof STOCKTAKE_STATUS]

/** 盘点明细（用于差异汇总） */
export interface StocktakeApprovalLine {
  productId: number
  bookQty: number
  actualQty: number
  recountQty: number | null
  diffQty: number
  /** 单位成本，用于差异金额折算（缺省按 0 计） */
  unitCost?: number
}

/** 差异汇总 */
export interface StocktakeDiffSummary {
  totalLines: number
  diffLines: number
  gainQty: number
  lossQty: number
  gainAmount: number
  lossAmount: number
  netQty: number
  netAmount: number
  maxAbsDiffQty: number
}

/** 提交审批评估结果 */
export interface StocktakeApprovalEvaluation {
  /** 是否允许提交审批 */
  ok: boolean
  /** 不允许的原因 */
  reason: string | null
  /** 是否需要走审批（存在超容差差异时需要） */
  needApproval: boolean
  summary: StocktakeDiffSummary
}

/** 默认差异数量容差 */
export const DEFAULT_STOCKTAKE_TOLERANCE = 0

function toNum(value: unknown): number {
  const num = Number(value ?? 0)
  return Number.isFinite(num) ? num : 0
}

function round4(value: number): number {
  return Number(toNum(value).toFixed(4))
}

/**
 * 汇总盘点差异
 */
export function summarizeStocktakeDiff(
  lines: StocktakeApprovalLine[],
  toleranceQty: number = DEFAULT_STOCKTAKE_TOLERANCE
): StocktakeDiffSummary {
  const tolerance = Math.abs(toNum(toleranceQty))
  const summary: StocktakeDiffSummary = {
    totalLines: (lines ?? []).length,
    diffLines: 0,
    gainQty: 0,
    lossQty: 0,
    gainAmount: 0,
    lossAmount: 0,
    netQty: 0,
    netAmount: 0,
    maxAbsDiffQty: 0
  }
  for (const line of lines ?? []) {
    const diff = toNum(line.diffQty)
    if (Math.abs(diff) <= tolerance) continue
    summary.diffLines += 1
    const amount = round4(diff * toNum(line.unitCost))
    summary.netQty = round4(summary.netQty + diff)
    summary.netAmount = round4(summary.netAmount + amount)
    if (Math.abs(diff) > summary.maxAbsDiffQty) summary.maxAbsDiffQty = Math.abs(diff)
    if (diff > 0) {
      summary.gainQty = round4(summary.gainQty + diff)
      summary.gainAmount = round4(summary.gainAmount + amount)
    } else {
      summary.lossQty = round4(summary.lossQty - diff)
      summary.lossAmount = round4(summary.lossAmount - amount)
    }
  }
  return summary
}

/**
 * 评估盘点差异是否可以提交审批
 */
export function evaluateStocktakeApproval(input: {
  status: string
  blindMode: boolean
  lines: StocktakeApprovalLine[]
  toleranceQty?: number
}): StocktakeApprovalEvaluation {
  const tolerance = Math.abs(toNum(input.toleranceQty ?? DEFAULT_STOCKTAKE_TOLERANCE))
  const summary = summarizeStocktakeDiff(input.lines ?? [], tolerance)
  const status = String(input.status ?? '')

  if (!canSubmitStocktakeApproval(status)) {
    return { ok: false, reason: `当前状态 ${status} 不允许提交差异审批`, needApproval: false, summary }
  }
  if (input.blindMode && status !== STOCKTAKE_STATUS.RECOUNTED) {
    return { ok: false, reason: '盲盘必须先完成复盘才能提交差异审批', needApproval: false, summary }
  }
  if (!summary.totalLines) {
    return { ok: false, reason: '盘点单没有明细，无法提交差异审批', needApproval: false, summary }
  }
  if (!summary.diffLines) {
    return { ok: true, reason: null, needApproval: false, summary }
  }
  return { ok: true, reason: null, needApproval: true, summary }
}

/** 是否允许提交差异审批 */
export function canSubmitStocktakeApproval(status: string): boolean {
  const allowed: StocktakeStatus[] = [
    STOCKTAKE_STATUS.DRAFT,
    STOCKTAKE_STATUS.COUNTING,
    STOCKTAKE_STATUS.RECOUNTED,
    STOCKTAKE_STATUS.REJECTED
  ]
  return allowed.includes(status as StocktakeStatus)
}

/** 是否允许审批通过（并过账） */
export function canApproveStocktakeDiff(status: string): boolean {
  const allowed: StocktakeStatus[] = [STOCKTAKE_STATUS.PENDING_APPROVAL, STOCKTAKE_STATUS.APPROVED]
  return allowed.includes(status as StocktakeStatus)
}

/** 是否允许驳回差异审批 */
export function canRejectStocktakeDiff(status: string): boolean {
  return status === STOCKTAKE_STATUS.PENDING_APPROVAL
}

/** 是否允许直接过账（无差异场景） */
export function canPostStocktakeDiffDirectly(status: string): boolean {
  return canSubmitStocktakeApproval(status)
}
