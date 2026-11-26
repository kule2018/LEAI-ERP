/**
 * 销售合同续签引擎：纯函数计算续签后的起止日期与标题，便于单测覆盖边界。
 */

export function dateText(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 原合同到期次日作为续签起始日 */
export function nextDayText(endDate: Date | string): string {
  const date = new Date(endDate)
  date.setDate(date.getDate() + 1)
  return dateText(date)
}

/** 按月数平移日期，作为续签到期日（月末自动收敛到目标月最后一天） */
export function shiftMonthsText(endDate: Date | string, months: number): string {
  const date = new Date(endDate)
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + months)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, lastDay))
  return dateText(date)
}

/**
 * 计算续签后的合同期间：
 * 起始日默认取原到期日次日，到期日默认按续签月数平移原到期日。
 */
export function resolveRenewPeriod(
  sourceEndDate: Date | string | null,
  termMonths: number,
  overrideStart?: string | null,
  overrideEnd?: string | null
): { startDate: string | null; endDate: string | null } {
  if (!sourceEndDate) {
    return { startDate: overrideStart ?? null, endDate: overrideEnd ?? null }
  }
  const startDate = overrideStart || nextDayText(sourceEndDate)
  const endDate = overrideEnd || shiftMonthsText(sourceEndDate, termMonths)
  return { startDate, endDate }
}

/** 续签标题：保留原标题并标注续签 */
export function resolveRenewTitle(sourceTitle: string, override?: string | null): string {
  if (override?.trim()) return override.trim()
  return `${sourceTitle}（续签）`
}
