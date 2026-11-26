/**
 * 成本重算规则（纯函数层）
 *
 * 对应《ERP业务功能扩展与增强规范》「成本重算：任务队列、进度、失败重试、回滚；重算期间需锁定」。
 * 本模块只做计算，不访问数据库，便于单元测试。
 */
import { COST_JOB_STATUS, canTransitionCostJob } from './asset-cost-rules'
import { resolveOutboundCost, type CostingMethod, type CostLayerInput } from './inventory-costing-rules'

/** 成本重算任务状态（与财务模块成本重算状态机保持一致） */
export const COST_RECALC_STATUS = COST_JOB_STATUS
export type CostRecalcStatus = keyof typeof COST_RECALC_STATUS

/** 期间内的一条库存流水 */
export interface RecalcMovement {
  /** 入库数量 */
  qtyIn: number
  /** 出库数量 */
  qtyOut: number
  /** 流水成本单价 */
  unitCost: number
  /** 业务时间 */
  occurredAt?: string | Date | null
}

/** 单个产品的重算输入 */
export interface RecalcProductInput {
  productId: number
  /** 成本核算方法 */
  method: CostingMethod
  /** 期初结存数量 */
  openingQty: number
  /** 期初结存金额 */
  openingAmount: number
  /** 期末结存数量 */
  closingQty: number
  /** 期间流水 */
  movements: RecalcMovement[]
  /** 成本层（FIFO / BATCH 使用） */
  layers?: CostLayerInput[]
  /** 账面金额（fin_cost.amount），用于差异比对 */
  bookAmount?: number | null
}

/** 单个产品的重算结果 */
export interface RecalcProductResult {
  productId: number
  method: CostingMethod
  /** 期间入库数量 */
  inQty: number
  /** 期间出库数量 */
  outQty: number
  /** 期间入库金额 */
  inAmount: number
  /** 期间出库金额 */
  outAmount: number
  /** 期末结存数量 */
  closingQty: number
  /** 期末结存金额 */
  closingAmount: number
  /** 期末结存单位成本 */
  unitCost: number
  /** 期间成本合计（入库 + 出库） */
  periodAmount: number
  /** 与账面金额的差异 */
  diffAmount: number
  /** 是否存在差异 */
  changed: boolean
}

/**
 * 重算单个产品的期间成本：
 * - 移动加权：期末金额 = 期初金额 + 入库金额 - 出库金额；
 * - FIFO / BATCH：出库成本按成本层先进先出消耗。
 */
export function recalculateProductCost(input: RecalcProductInput): RecalcProductResult {
  const movements = input.movements ?? []
  const inQty = round3(sum(movements.map((item) => num(item.qtyIn))))
  const outQty = round3(sum(movements.map((item) => num(item.qtyOut))))
  const inAmount = round4(sum(movements.map((item) => num(item.qtyIn) * num(item.unitCost))))
  const ledgerOutAmount = round4(sum(movements.map((item) => num(item.qtyOut) * num(item.unitCost))))

  let outAmount = ledgerOutAmount
  if (input.method !== 'MOVING_WEIGHTED') {
    const fallback = outQty > 0 ? round4(ledgerOutAmount / outQty) : null
    const resolved = resolveOutboundCost({
      method: input.method,
      avgCost: input.openingQty > 0 ? round4(num(input.openingAmount) / num(input.openingQty)) : 0,
      layers: input.layers ?? [],
      qtyOut: outQty,
      fallbackCost: fallback
    })
    outAmount = resolved.amount
  }

  const closingQty = round3(num(input.closingQty))
  const closingAmount = round4(num(input.openingAmount) + inAmount - outAmount)
  const unitCost = closingQty > 0 ? round4(closingAmount / closingQty) : 0
  const bookAmount = input.bookAmount === null || input.bookAmount === undefined ? closingAmount : num(input.bookAmount)
  const diffAmount = round4(closingAmount - bookAmount)

  return {
    productId: input.productId,
    method: input.method,
    inQty,
    outQty,
    inAmount,
    outAmount,
    closingQty,
    closingAmount,
    unitCost,
    periodAmount: round4(inAmount + outAmount),
    diffAmount,
    changed: Math.abs(diffAmount) >= 0.01
  }
}

/** 批量重算 */
export function buildRecalculationPlan(inputs: RecalcProductInput[]): RecalcProductResult[] {
  return inputs.map((item) => recalculateProductCost(item))
}

/** 任务进度（0 - 100） */
export function evaluateJobProgress(processed: number, total: number): number {
  if (total <= 0) return 100
  const percent = Math.round((num(processed) / num(total)) * 100)
  return Math.min(100, Math.max(0, percent))
}

/** 是否允许执行（PENDING 状态可执行） */
export function canExecuteCostJob(status: string): boolean {
  return status === COST_RECALC_STATUS.PENDING
}

/** 是否允许重试（FAILED 状态可重试，需先流转回 PENDING） */
export function canRetryCostJob(status: string): boolean {
  return status === COST_RECALC_STATUS.FAILED
}

/** 任务状态流转是否合法 */
export function canTransitionRecalcJob(from: string, to: string): boolean {
  return canTransitionCostJob(from as never, to as never)
}

/** 失败信息（截断到 1000 字符） */
export function resolveJobError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '未知错误')
  return message.length > 1000 ? message.slice(0, 1000) : message
}

/** 重算结果汇总 */
export function summarizeRecalculation(results: RecalcProductResult[]): {
  productCount: number
  changedCount: number
  totalInAmount: number
  totalOutAmount: number
  totalClosingAmount: number
  totalDiffAmount: number
} {
  return {
    productCount: results.length,
    changedCount: results.filter((item) => item.changed).length,
    totalInAmount: round4(sum(results.map((item) => item.inAmount))),
    totalOutAmount: round4(sum(results.map((item) => item.outAmount))),
    totalClosingAmount: round4(sum(results.map((item) => item.closingAmount))),
    totalDiffAmount: round4(sum(results.map((item) => item.diffAmount)))
  }
}

/* ------------------------------ 内部工具 ------------------------------ */

function sum(values: number[]): number {
  return values.reduce((acc, cur) => acc + cur, 0)
}

function num(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000
}

function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000
}
