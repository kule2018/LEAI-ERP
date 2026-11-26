/**
 * 资产与成本纯逻辑规则：OEE、设备保养到期、联副产品分摊、成本重算、采购成本分摊。
 * 与持久层解耦便于单测，供各业务服务复用。
 */

/** OEE = 可用率 × 性能 × 质量（输入为 0~1 或 0~100 的百分比） */
export function computeOee(availability: number, performance: number, quality: number): number {
  const norm = (v: number) => v > 1 ? v / 100 : v
  return Number((norm(availability) * norm(performance) * norm(quality)).toFixed(4))
}

/** 保养到期判断：距上次保养天数 >= 周期天数 */
export function maintenanceDue(lastMaintenance: string | null, cycleDays: number, now: Date = new Date()): {
  due: boolean
  overdueDays: number
} {
  if (!lastMaintenance || cycleDays <= 0) return { due: false, overdueDays: 0 }
  const last = new Date(`${lastMaintenance}T00:00:00`)
  if (Number.isNaN(last.getTime())) return { due: false, overdueDays: 0 }
  const days = Math.floor((now.getTime() - last.getTime()) / 86400000)
  return { due: days >= cycleDays, overdueDays: Math.max(0, days - cycleDays) }
}

export interface ByProductInput {
  productId: number
  qty: number
  unitCost: number
}

/** 联副产品成本分摊：主产品成本扣除联副产品可变现价值 */
export function allocateByProductCost(mainCost: number, byProducts: ByProductInput[]): {
  netMainCost: number
  byProductValues: Array<{ productId: number; value: number }>
} {
  const byProductValues = byProducts.map((item) => ({
    productId: item.productId,
    value: Number((item.qty * item.unitCost).toFixed(4))
  }))
  const total = byProductValues.reduce((sum, item) => sum + item.value, 0)
  return { netMainCost: Number((mainCost - total).toFixed(4)), byProductValues }
}

/** 采购入库成本分摊：按数量权重把额外费用（运费/关税）分摊到各行 */
export function allocateLandedCost(lines: Array<{ id: number; qty: number; amount: number }>, extraCost: number): Array<{
  id: number
  allocatedCost: number
}> {
  const totalQty = lines.reduce((sum, l) => sum + l.qty, 0)
  if (totalQty <= 0) return lines.map((l) => ({ id: l.id, allocatedCost: 0 }))
  return lines.map((l) => ({
    id: l.id,
    allocatedCost: Number((extraCost * (l.qty / totalQty)).toFixed(4))
  }))
}

/** 成本重算任务状态机 */
export const COST_JOB_STATUS = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  DONE: 'DONE',
  FAILED: 'FAILED'
} as const

export type CostJobStatus = (typeof COST_JOB_STATUS)[keyof typeof COST_JOB_STATUS]

const TRANSITIONS: Record<CostJobStatus, CostJobStatus[]> = {
  PENDING: ['RUNNING', 'FAILED'],
  RUNNING: ['DONE', 'FAILED'],
  DONE: [],
  FAILED: ['PENDING']
}

export function canTransitionCostJob(from: CostJobStatus, to: CostJobStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

/** 资产盘点差异：账面数量 vs 实盘数量 */
export function assetStocktakeDiff(bookQty: number, actualQty: number): number {
  return Number((actualQty - bookQty).toFixed(4))
}
