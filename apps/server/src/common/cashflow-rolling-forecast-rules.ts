/**
 * 资金滚动预测规则（纯函数层）
 *
 * 规范要求：资金计划 —— 现金流日历、滚动预测、情景模拟。
 * 滚动预测：以历史实际现金流为基线，按月滚动推演未来若干月的现金流与期末资金余额；
 * 已有计划（PLAN）优先于基线推算，情景系数（inflowFactor / outflowFactor）用于乐观/悲观调整。
 */

/** 月度现金流汇总桶 */
export interface CashflowMonthlyBucket {
  /** YYYY-MM */
  month: string
  inflow: number
  outflow: number
}

/** 滚动预测输入参数 */
export interface RollingForecastOptions {
  /** 预测月数 */
  months: number
  /** 基线月（最后一个月实际/当前月），预测自其次月开始 */
  baseMonth: string
  /** 期初余额 */
  openingBalance: number
  /** 流入情景系数 */
  inflowFactor: number
  /** 流出情景系数 */
  outflowFactor: number
  /** 基线取近 N 个月实际均值，默认 3 */
  baselineMonths: number
}

/** 滚动预测单月结果 */
export interface RollingForecastRow {
  month: string
  openingBalance: number
  inflow: number
  outflow: number
  net: number
  endingBalance: number
  /** PLAN：有明确计划；BASELINE：无计划，按历史基线推算 */
  source: 'PLAN' | 'BASELINE'
  /** 置信度 0~1 */
  confidence: number
}

/** 滚动预测汇总结果 */
export interface RollingForecastResult {
  baseMonth: string
  months: number
  baseline: { inflow: number; outflow: number }
  rows: RollingForecastRow[]
  totalInflow: number
  totalOutflow: number
  net: number
  endingBalance: number
  minEndingBalance: number
  warning: string | null
}

const DEFAULT_BASELINE_MONTHS = 3
/** PLAN 数据置信度 */
const PLAN_CONFIDENCE = 0.9
/** 基线推算置信度 */
const BASELINE_CONFIDENCE = 0.5
/** 无任何基线时的置信度 */
const EMPTY_CONFIDENCE = 0.3

/** 保留 4 位小数 */
function round4(value: number): number {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  return Number(num.toFixed(4))
}

/** 数值化 */
function toNum(value: unknown): number {
  const num = Number(value ?? 0)
  return Number.isFinite(num) ? num : 0
}

/**
 * 生成基线月之后连续 count 个月的月份序列（YYYY-MM）
 */
export function nextMonths(baseMonth: string, count: number): string[] {
  const matched = /^(\d{4})-(\d{1,2})$/.exec(String(baseMonth ?? '').trim())
  const year = matched ? Number(matched[1]) : new Date().getUTCFullYear()
  const month = matched ? Number(matched[2]) : 1
  const total = Math.max(0, Math.floor(count))
  const months: string[] = []
  for (let i = 1; i <= total; i += 1) {
    const index = month - 1 + i
    const targetYear = year + Math.floor(index / 12)
    const targetMonth = (index % 12) + 1
    months.push(`${targetYear}-${String(targetMonth).padStart(2, '0')}`)
  }
  return months
}

/**
 * 计算基线：取最近 baselineMonths 个月实际的月度均值
 */
export function computeBaseline(
  actuals: CashflowMonthlyBucket[],
  baselineMonths: number = DEFAULT_BASELINE_MONTHS
): { inflow: number; outflow: number; months: number } {
  const sorted = [...(actuals ?? [])]
    .filter((item) => item && typeof item.month === 'string' && /^\d{4}-\d{1,2}$/.test(item.month))
    .sort((a, b) => a.month.localeCompare(b.month))
  const window = Math.max(1, Math.floor(baselineMonths || DEFAULT_BASELINE_MONTHS))
  const recent = sorted.slice(-window)
  if (!recent.length) return { inflow: 0, outflow: 0, months: 0 }
  const inflow = recent.reduce((sum, item) => sum + toNum(item.inflow), 0) / recent.length
  const outflow = recent.reduce((sum, item) => sum + toNum(item.outflow), 0) / recent.length
  return { inflow: round4(inflow), outflow: round4(outflow), months: recent.length }
}

/**
 * 构建滚动预测
 *
 * - 有计划月份：以计划金额为准（置信度 0.9）
 * - 无计划月份：以历史基线推算（置信度 0.5）
 * - 逐月滚动：上月期末余额作为本月期初余额
 */
export function buildRollingForecast(input: {
  actuals: CashflowMonthlyBucket[]
  plans: CashflowMonthlyBucket[]
  options: RollingForecastOptions
}): RollingForecastResult {
  const options = input.options
  const months = Math.max(1, Math.min(24, Math.floor(options.months || 6)))
  const inflowFactor = toNum(options.inflowFactor) || 1
  const outflowFactor = toNum(options.outflowFactor) || 1
  const baseline = computeBaseline(input.actuals ?? [], options.baselineMonths ?? DEFAULT_BASELINE_MONTHS)

  const planMap = new Map<string, CashflowMonthlyBucket>()
  for (const plan of input.plans ?? []) {
    if (!plan || typeof plan.month !== 'string') continue
    const existing = planMap.get(plan.month)
    if (existing) {
      existing.inflow = round4(existing.inflow + toNum(plan.inflow))
      existing.outflow = round4(existing.outflow + toNum(plan.outflow))
    } else {
      planMap.set(plan.month, { month: plan.month, inflow: round4(toNum(plan.inflow)), outflow: round4(toNum(plan.outflow)) })
    }
  }

  const rows: RollingForecastRow[] = []
  let balance = round4(toNum(options.openingBalance))
  let totalInflow = 0
  let totalOutflow = 0
  let minEndingBalance: number | null = null

  for (const month of nextMonths(options.baseMonth, months)) {
    const plan = planMap.get(month)
    const hasPlan = !!plan && (toNum(plan.inflow) > 0 || toNum(plan.outflow) > 0)
    const rawInflow = hasPlan ? toNum(plan!.inflow) : baseline.inflow
    const rawOutflow = hasPlan ? toNum(plan!.outflow) : baseline.outflow
    const inflow = round4(rawInflow * inflowFactor)
    const outflow = round4(rawOutflow * outflowFactor)
    const net = round4(inflow - outflow)
    const opening = balance
    const ending = round4(opening + net)
    balance = ending
    minEndingBalance = minEndingBalance === null ? ending : Math.min(minEndingBalance, ending)
    totalInflow = round4(totalInflow + inflow)
    totalOutflow = round4(totalOutflow + outflow)
    rows.push({
      month,
      openingBalance: opening,
      inflow,
      outflow,
      net,
      endingBalance: ending,
      source: hasPlan ? 'PLAN' : 'BASELINE',
      confidence: hasPlan ? PLAN_CONFIDENCE : baseline.months > 0 ? BASELINE_CONFIDENCE : EMPTY_CONFIDENCE
    })
  }

  const warnings: string[] = []
  const minBalance = minEndingBalance === null ? balance : minEndingBalance
  if (baseline.months === 0) warnings.push('缺少历史实际现金流，滚动预测基于零基线推算')
  if (minBalance < 0) warnings.push('预测期内资金余额将出现负数，需提前安排融资或压缩支出')
  const planCount = rows.filter((row) => row.source === 'PLAN').length
  if (planCount === 0) warnings.push('预测期无已登记资金计划，全部按历史基线推算')

  return {
    baseMonth: options.baseMonth,
    months,
    baseline: { inflow: baseline.inflow, outflow: baseline.outflow },
    rows,
    totalInflow,
    totalOutflow,
    net: round4(totalInflow - totalOutflow),
    endingBalance: balance,
    minEndingBalance: round4(minBalance),
    warning: warnings.length ? warnings.join('；') : null
  }
}

/**
 * 汇总现金流日历条目为月度桶
 */
export function bucketByMonth(
  items: Array<{ bizDate: string; direction: string; amount: number | string }>
): CashflowMonthlyBucket[] {
  const map = new Map<string, CashflowMonthlyBucket>()
  for (const item of items ?? []) {
    const month = String(item.bizDate ?? '').slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(month)) continue
    const bucket = map.get(month) ?? { month, inflow: 0, outflow: 0 }
    const amount = toNum(item.amount)
    if (item.direction === 'OUT') bucket.outflow = round4(bucket.outflow + amount)
    else bucket.inflow = round4(bucket.inflow + amount)
    map.set(month, bucket)
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month))
}
