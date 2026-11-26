/**
 * 人事审批与核算规则引擎（纯函数）：
 * - 通用审批状态机（请假/加班/用车/资产领用/费用报销）
 * - 社保公积金明细分摊
 * - 行政资产盘点差异
 * - 绩效综合得分（KPI + 360 反馈 + 校准）与强制分布
 * - 车辆油耗与用车里程
 * - 请假天数计算
 */

export type HrApprovalAction = 'APPROVE' | 'REJECT'

/** 通用人事审批：仅待审批状态可审批 */
export function evaluateHrApproval(status: string, action: HrApprovalAction): { ok: boolean; reason: string | null } {
  if (status !== 'PENDING') return { ok: false, reason: `当前状态 ${status} 不允许${action === 'APPROVE' ? '审批通过' : '驳回'}` }
  return { ok: true, reason: null }
}

export interface SocialInsuranceItem {
  itemCode: string
  itemName: string
  companyRate: number
  personalRate: number
  baseAmount?: number
}

/** 默认社保个人合计 10.5%（养老 8 + 医疗 2 + 失业 0.5），与 calculatePayroll 默认口径一致 */
export const DEFAULT_SOCIAL_ITEMS: SocialInsuranceItem[] = [
  { itemCode: 'PENSION', itemName: '养老保险', companyRate: 0.16, personalRate: 0.08 },
  { itemCode: 'MEDICAL', itemName: '医疗保险', companyRate: 0.09, personalRate: 0.02 },
  { itemCode: 'UNEMPLOYMENT', itemName: '失业保险', companyRate: 0.005, personalRate: 0.005 },
  { itemCode: 'INJURY', itemName: '工伤保险', companyRate: 0.004, personalRate: 0 },
  { itemCode: 'MATERNITY', itemName: '生育保险', companyRate: 0.008, personalRate: 0 }
]

/** 住房公积金：单位与个人同比例，单独成项不计入社保合计 */
export const DEFAULT_HOUSING_FUND: SocialInsuranceItem = {
  itemCode: 'HOUSING_FUND', itemName: '住房公积金', companyRate: 0.05, personalRate: 0.05
}

export interface SocialInsuranceBreakdownRow extends SocialInsuranceItem {
  baseAmount: number
  companyAmount: number
  personalAmount: number
}

/** 社保公积金明细分摊：按缴费基数与费率计算单位/个人金额 */
export function socialInsuranceBreakdown(
  baseAmount: number,
  items: SocialInsuranceItem[] = DEFAULT_SOCIAL_ITEMS,
  housingFund: SocialInsuranceItem | null = DEFAULT_HOUSING_FUND
): { items: SocialInsuranceBreakdownRow[]; companyTotal: number; personalTotal: number } {
  const base = Math.max(0, Number(baseAmount) || 0)
  const all = housingFund ? [...items, housingFund] : [...items]
  const rows = all.map((item) => {
    const itemBase = item.baseAmount ?? base
    return {
      ...item,
      baseAmount: itemBase,
      companyAmount: round(itemBase * (item.companyRate ?? 0)),
      personalAmount: round(itemBase * (item.personalRate ?? 0))
    }
  })
  const socialRows = housingFund ? rows.filter((row) => row.itemCode !== housingFund.itemCode) : rows
  return {
    items: rows,
    companyTotal: round(socialRows.reduce((sum, row) => sum + row.companyAmount, 0)),
    personalTotal: round(socialRows.reduce((sum, row) => sum + row.personalAmount, 0))
  }
}

export interface StocktakeBookRow {
  assetId: number
  status: string
  holderId: number | null
}

export interface StocktakeActualRow {
  assetId: number
  status: string
  holderId: number | null
}

export interface StocktakeDiffRow {
  assetId: number
  bookStatus: string
  actualStatus: string
  bookHolderId: number | null
  actualHolderId: number | null
  difference: 'NORMAL' | 'STATUS_DIFF' | 'HOLDER_DIFF' | 'MISSING'
  remark: string | null
}

/** 盘点差异：账实比对，输出正常/状态差异/持有人差异/盘亏 */
export function assetStocktakeDiff(book: StocktakeBookRow[], actual: StocktakeActualRow[]): StocktakeDiffRow[] {
  const actualMap = new Map(actual.map((item) => [item.assetId, item]))
  const rows: StocktakeDiffRow[] = book.map((item) => {
    const found = actualMap.get(item.assetId)
    if (!found) {
      return {
        assetId: item.assetId, bookStatus: item.status, actualStatus: 'MISSING',
        bookHolderId: item.holderId, actualHolderId: null, difference: 'MISSING', remark: '实物未找到'
      }
    }
    let difference: StocktakeDiffRow['difference'] = 'NORMAL'
    let remark: string | null = null
    if (found.status !== item.status) {
      difference = 'STATUS_DIFF'
      remark = `账面状态 ${item.status}，实盘状态 ${found.status}`
    } else if ((found.holderId ?? null) !== (item.holderId ?? null)) {
      difference = 'HOLDER_DIFF'
      remark = `持有人不一致：账面 ${item.holderId ?? '无'}，实盘 ${found.holderId ?? '无'}`
    }
    return {
      assetId: item.assetId, bookStatus: item.status, actualStatus: found.status,
      bookHolderId: item.holderId, actualHolderId: found.holderId, difference, remark
    }
  })
  for (const item of actual) {
    if (!book.some((row) => row.assetId === item.assetId)) {
      rows.push({
        assetId: item.assetId, bookStatus: 'NONE', actualStatus: item.status,
        bookHolderId: null, actualHolderId: item.holderId, difference: 'STATUS_DIFF', remark: '账外资产'
      })
    }
  }
  return rows
}

export interface PerformanceCompositeInput {
  kpiScore: number
  feedbackScore?: number | null
  calibration?: number | null
  weights?: { kpi?: number; feedback?: number; calibration?: number }
}

/** 绩效综合得分：KPI + 360 反馈 + 校准分，默认权重 0.6 / 0.3 / 0.1，缺失项不参与加权 */
export function performanceCompositeScore(input: PerformanceCompositeInput): { score: number; level: string } {
  const weights = { kpi: 0.6, feedback: 0.3, calibration: 0.1, ...(input.weights ?? {}) }
  const kpi = clampScore(input.kpiScore)
  const parts: Array<{ value: number; weight: number }> = [{ value: kpi, weight: weights.kpi }]
  if (input.feedbackScore !== null && input.feedbackScore !== undefined) {
    parts.push({ value: clampScore(input.feedbackScore), weight: weights.feedback })
  }
  if (input.calibration !== null && input.calibration !== undefined && Number(input.calibration) !== 0) {
    parts.push({ value: clampScore(input.calibration), weight: weights.calibration })
  }
  const totalWeight = parts.reduce((sum, item) => sum + item.weight, 0)
  const raw = parts.reduce((sum, item) => sum + item.value * item.weight, 0)
  const score = round(raw / (totalWeight || 1), 1)
  return { score, level: performanceLevel(score) }
}

export function performanceLevel(score: number): string {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  return 'D'
}

export interface CalibrationRatio {
  level: string
  ratio: number
}

/** 默认强制分布：A 30%、B 40%、C 25%、D 5% */
export const DEFAULT_CALIBRATION_RATIOS: CalibrationRatio[] = [
  { level: 'A', ratio: 0.3 },
  { level: 'B', ratio: 0.4 },
  { level: 'C', ratio: 0.25 },
  { level: 'D', ratio: 0.05 }
]

export interface CalibrationRow {
  level: string
  count: number
  ratio: number
  targetRatio: number
  deviation: number
}

/** 绩效校准：按强制分布把分数序列切分为等级并输出偏差 */
export function calibrationDistribution(scores: number[], ratios: CalibrationRatio[] = DEFAULT_CALIBRATION_RATIOS): CalibrationRow[] {
  const sorted = [...scores].filter((item) => Number.isFinite(item)).sort((a, b) => b - a)
  const total = sorted.length
  const counts = new Map<string, number>()
  let cursor = 0
  let cumulative = 0
  for (const rule of ratios) {
    const target = Math.round(total * rule.ratio)
    const size = rule === ratios[ratios.length - 1] ? total - cursor : target
    for (let i = 0; i < size && cursor < total; i += 1, cursor += 1) {
      counts.set(rule.level, (counts.get(rule.level) ?? 0) + 1)
    }
    cumulative += rule.ratio
  }
  void cumulative
  return ratios.map((rule) => {
    const count = counts.get(rule.level) ?? 0
    const actualRatio = total ? round(count / total, 4) : 0
    return {
      level: rule.level,
      count,
      ratio: actualRatio,
      targetRatio: rule.ratio,
      deviation: round(actualRatio - rule.ratio, 4)
    }
  })
}

/** 车辆油耗：升/百公里，超过阈值告警 */
export function vehicleFuelConsumption(litres: number, mileage: number, threshold = 12): {
  per100km: number
  warning: boolean
} {
  const fuel = Math.max(0, Number(litres) || 0)
  const distance = Math.max(0, Number(mileage) || 0)
  if (distance <= 0) return { per100km: 0, warning: false }
  const per100km = round((fuel / distance) * 100, 2)
  return { per100km, warning: per100km > threshold }
}

/** 请假天数：按自然日计算，结束时间不足一天按一天计 */
export function leaveDurationDays(start: Date | string, end: Date | string): number {
  const from = new Date(start).getTime()
  const to = new Date(end).getTime()
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 0
  return Math.max(1, Math.ceil((to - from) / 86400000))
}

export interface VehicleConflictWindow {
  id?: number
  vehicleId: number
  applyUserId: number
  startTime: Date | string
  endTime: Date | string
}

export interface VehicleConflictResult {
  conflict: boolean
  types: Array<'SAME_VEHICLE' | 'SAME_APPLICANT'>
  conflicts: VehicleConflictWindow[]
}

/** 车队冲突校验：同时检测车辆被占用与申请人重复用车 */
export function detectVehicleConflict(
  existing: VehicleConflictWindow[],
  next: { vehicleId: number; applyUserId: number; startTime: Date | string; endTime: Date | string }
): VehicleConflictResult {
  const start = new Date(next.startTime).getTime()
  const end = new Date(next.endTime).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { conflict: true, types: ['SAME_VEHICLE'], conflicts: [] }
  }
  const conflicts = existing.filter((item) => {
    const itemStart = new Date(item.startTime).getTime()
    const itemEnd = new Date(item.endTime).getTime()
    return start < itemEnd && itemStart < end
  })
  const types: Array<'SAME_VEHICLE' | 'SAME_APPLICANT'> = []
  if (conflicts.some((item) => item.vehicleId === next.vehicleId)) types.push('SAME_VEHICLE')
  if (conflicts.some((item) => item.applyUserId === next.applyUserId)) types.push('SAME_APPLICANT')
  return { conflict: types.length > 0, types, conflicts }
}

/** 资产领用归还校验：归还必须存在持有人 */
export function evaluateAssetIssueReturn(action: 'ISSUE' | 'RETURN', holderId: number | null): { ok: boolean; reason: string | null } {
  if (action === 'ISSUE' && !holderId) return { ok: false, reason: '领用必须指定持有人' }
  if (action === 'RETURN' && !holderId) return { ok: false, reason: '该资产当前无持有人，无法归还' }
  return { ok: true, reason: null }
}

function clampScore(value: number): number {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  return Math.min(100, Math.max(0, num))
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}
