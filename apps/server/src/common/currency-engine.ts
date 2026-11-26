/**
 * 多币种纯逻辑引擎：汇率换算、本位币汇总、汇率变更留痕校验。
 * 与持久层解耦便于单测。
 */

/** 金额换算：from 币种金额 × 汇率 = to 币种金额 */
export function convertAmount(amount: number, rate: number): number {
  return Number((amount * rate).toFixed(4))
}

/** 直接汇率与反向汇率 */
export function reverseRate(rate: number): number {
  if (!Number.isFinite(rate) || rate === 0) return 0
  return Number((1 / rate).toFixed(8))
}

/** 本位币汇总：按各币种金额与对应汇率汇总 */
export function toBaseCurrency(items: Array<{ amount: number; rate: number }>): number {
  return Number(items.reduce((sum, item) => sum + item.amount * item.rate, 0).toFixed(4))
}

/** 汇率变更检查：新汇率与旧汇率差异超过阈值时需要留痕审批 */
export function needsRateApproval(oldRate: number, newRate: number, thresholdPercent = 5): boolean {
  if (!oldRate || oldRate <= 0) return true
  const change = Math.abs(newRate - oldRate) / oldRate * 100
  return change > thresholdPercent
}

/** 支持的币种代码校验（ISO 4217 常用集） */
export const SUPPORTED_CURRENCIES = ['CNY', 'USD', 'EUR', 'JPY', 'HKD', 'GBP', 'AUD', 'SGD'] as const
export function isValidCurrency(code: string): boolean {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code.toUpperCase())
}
