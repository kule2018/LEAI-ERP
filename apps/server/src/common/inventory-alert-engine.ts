/**
 * 库存预警巡检纯逻辑：安全库存、批次临期/过期、呆滞库存。
 * 与持久层解耦，便于单元测试。
 */

export type ExpiryLevel = 'EXPIRED' | 'URGENT' | 'WARNING'

export interface BatchExpiryInput {
  productId: number
  productName?: string
  batchNo: string
  expiryDate: string | Date | null
  qty?: number
}

export interface ExpiryAlert {
  productId: number
  productName: string
  batchNo: string
  expiryDate: string
  daysLeft: number
  qty: number
  level: ExpiryLevel
}

export interface SafetyStockInput {
  productId: number
  productName?: string
  warehouseId: number
  onHand: number
  safetyStock: number
}

export interface SafetyStockAlert {
  productId: number
  productName: string
  warehouseId: number
  onHand: number
  safetyStock: number
  shortage: number
  suggestQty: number
}

export interface SlowMovingInput {
  productId: number
  productName?: string
  warehouseId: number
  qty: number
  lastOutboundDays: number
  thresholdDays: number
}

export interface SlowMovingAlert {
  productId: number
  productName: string
  warehouseId: number
  qty: number
  lastOutboundDays: number
  thresholdDays: number
}

/** 预警策略解析结果 */
export interface ResolvedPolicy {
  warnDays: number
  urgentDays: number
  safetyStock: number
  slowMovingDays: number
}

/** 预警状态机动作 */
export type AlertMergeAction = 'CREATE' | 'UPDATE' | 'REOPEN' | 'SKIP'

export interface AlertStateInput {
  alertLevel?: string | null
  status?: string | null
  thresholdQty?: string | null
}

function toDate(value: string | Date | null): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** 截断到自然日（UTC 零点），用于按日历天比较 */
function startOfDay(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
}

/**
 * 距今天数（正数表示还有多少天到期，负数表示已过期天数）。
 * 按自然日计算：当天到期剩余 0 天，不因具体时分秒被判为过期。
 */
export function daysUntil(date: string | Date, now: Date = new Date()): number {
  const target = toDate(date)
  if (!target) return Number.POSITIVE_INFINITY
  return Math.round((startOfDay(target) - startOfDay(now)) / 86400000)
}

/** 依据剩余天数解析临期级别 */
export function resolveExpiryLevel(daysLeft: number, warnDays: number, urgentDays: number): ExpiryLevel | null {
  if (!Number.isFinite(daysLeft)) return null
  if (daysLeft < 0) return 'EXPIRED'
  if (daysLeft <= urgentDays) return 'URGENT'
  if (daysLeft <= warnDays) return 'WARNING'
  return null
}

/**
 * 批次临期预警：
 * - 已过期 → EXPIRED
 * - 剩余天数 <= urgentDays → URGENT
 * - 剩余天数 <= warnDays → WARNING
 */
export function evaluateBatchExpiry(
  items: BatchExpiryInput[],
  warnDays = 30,
  urgentDays = 7,
  now: Date = new Date()
): ExpiryAlert[] {
  const alerts: ExpiryAlert[] = []
  for (const item of items) {
    if (!item.expiryDate) continue
    const left = daysUntil(item.expiryDate, now)
    const level = resolveExpiryLevel(left, warnDays, urgentDays)
    if (!level) continue
    alerts.push({
      productId: item.productId,
      productName: item.productName ?? '',
      batchNo: item.batchNo,
      expiryDate: toDate(item.expiryDate)?.toISOString() ?? '',
      daysLeft: left,
      qty: item.qty ?? 0,
      level
    })
  }
  return alerts
}

/** 安全库存预警：低于安全库存时给出缺口与建议补货量 */
export function evaluateSafetyStock(items: SafetyStockInput[]): SafetyStockAlert[] {
  const alerts: SafetyStockAlert[] = []
  for (const item of items) {
    const safety = Number(item.safetyStock ?? 0)
    if (!Number.isFinite(safety) || safety <= 0) continue
    const onHand = Number(item.onHand ?? 0)
    if (onHand >= safety) continue
    const shortage = Number((safety - onHand).toFixed(4))
    alerts.push({
      productId: item.productId,
      productName: item.productName ?? '',
      warehouseId: item.warehouseId,
      onHand,
      safetyStock: safety,
      shortage,
      suggestQty: shortage
    })
  }
  return alerts
}

/** 呆滞库存预警：超过阈值天数未出库且仍有库存 */
export function evaluateSlowMoving(items: SlowMovingInput[]): SlowMovingAlert[] {
  const alerts: SlowMovingAlert[] = []
  for (const item of items) {
    const threshold = Number(item.thresholdDays ?? 0)
    if (!Number.isFinite(threshold) || threshold <= 0) continue
    const qty = Number(item.qty ?? 0)
    if (qty <= 0) continue
    const days = Number(item.lastOutboundDays ?? 0)
    if (days < threshold) continue
    alerts.push({
      productId: item.productId,
      productName: item.productName ?? '',
      warehouseId: item.warehouseId,
      qty,
      lastOutboundDays: days,
      thresholdDays: threshold
    })
  }
  return alerts
}

/**
 * 预警策略解析：优先级为「产品+仓库 > 产品 > 全局默认」。
 */
export function resolvePolicy(
  policies: Array<{
    productId: number
    warehouseId: number
    warnDays: number
    urgentDays: number
    safetyStock: number
    slowMovingDays: number
  }>,
  productId: number,
  warehouseId: number,
  fallback: ResolvedPolicy = { warnDays: 30, urgentDays: 7, safetyStock: 0, slowMovingDays: 0 }
): ResolvedPolicy {
  const match = (p: { productId: number; warehouseId: number }) =>
    p.productId === productId && p.warehouseId === warehouseId
  const scoped = policies.find(match)
    ?? policies.find((p) => p.productId === productId && p.warehouseId === 0)
    ?? policies.find((p) => p.productId === 0 && p.warehouseId === 0)
  if (!scoped) return fallback
  return {
    warnDays: scoped.warnDays ?? fallback.warnDays,
    urgentDays: scoped.urgentDays ?? fallback.urgentDays,
    safetyStock: Number(scoped.safetyStock ?? 0),
    slowMovingDays: scoped.slowMovingDays ?? fallback.slowMovingDays
  }
}

/**
 * 预警生命周期判定：
 * - 无历史预警 → CREATE
 * - 已关闭但仍处于临期/过期 → REOPEN（人工关闭后条件依旧成立需重新提醒）
 * - 级别或剩余天数变化 → UPDATE
 * - 完全一致 → SKIP
 */
export function mergeAlertState(
  previous: AlertStateInput | null,
  nextLevel: string,
  nextThreshold: number
): AlertMergeAction {
  if (!previous) return 'CREATE'
  if ((previous.status ?? 'OPEN') === 'CLOSED') return 'REOPEN'
  const sameLevel = previous.alertLevel === nextLevel
  const sameThreshold = Number(previous.thresholdQty ?? Number.NaN) === nextThreshold
  return sameLevel && sameThreshold ? 'SKIP' : 'UPDATE'
}
