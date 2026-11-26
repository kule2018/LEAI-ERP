/**
 * 库存成本核算规则（纯函数）
 *
 * 支持三种成本核算方法：
 * - MOVING_WEIGHTED：移动加权平均（默认）
 * - FIFO：先进先出（按入库时间消耗成本层）
 * - BATCH：分批实际成本（按指定批次消耗成本层）
 */

/** 成本核算方法枚举 */
export const COSTING_METHODS = ['MOVING_WEIGHTED', 'FIFO', 'BATCH'] as const
export type CostingMethod = (typeof COSTING_METHODS)[number]

/** 判断是否为合法的成本核算方法 */
export function isCostingMethod(value: unknown): value is CostingMethod {
  return typeof value === 'string' && (COSTING_METHODS as readonly string[]).includes(value)
}

/** 成本核算方法中文名 */
export const COSTING_METHOD_LABEL: Record<CostingMethod, string> = {
  MOVING_WEIGHTED: '移动加权平均',
  FIFO: '先进先出',
  BATCH: '分批实际成本'
}

/** 成本来源 */
export type CostSource = 'AVG_COST' | 'COST_LAYER' | 'FALLBACK' | 'NONE'

export interface MovingWeightedInput {
  /** 期初结存数量 */
  beforeQty: number
  /** 期初结存单位成本 */
  beforeAvgCost: number
  /** 本次入库数量 */
  qtyIn: number
  /** 本次入库单位成本 */
  unitCost: number
}

export interface MovingWeightedResult {
  /** 结存单位成本（移动加权平均） */
  avgCost: number
  /** 结存总金额 */
  totalAmount: number
  /** 本次入库金额 */
  inAmount: number
}

/**
 * 移动加权平均成本计算：
 * 新均价 =（期初数量 × 期初均价 + 入库数量 × 入库单价）/（期初数量 + 入库数量）
 * 期初数量为 0 时直接取入库单价。
 */
export function computeMovingWeightedCost(input: MovingWeightedInput): MovingWeightedResult {
  const beforeQty = num(input.beforeQty)
  const beforeAvgCost = num(input.beforeAvgCost)
  const qtyIn = num(input.qtyIn)
  const unitCost = num(input.unitCost)
  const totalQty = beforeQty + qtyIn
  const avgCost = totalQty > 0
    ? round4((beforeQty * beforeAvgCost + qtyIn * unitCost) / totalQty)
    : 0
  return {
    avgCost,
    totalAmount: round4(totalQty * avgCost),
    inAmount: round4(qtyIn * unitCost)
  }
}

/** 成本层（一次入库形成的成本批次） */
export interface CostLayerInput {
  id: number
  /** 剩余可用数量 */
  qtyAvailable: number
  /** 单位成本 */
  unitCost: number
  /** 入库时间（排序用） */
  occurredAt?: string | Date | null
  /** 批次号 */
  batchNo?: string | null
}

/** 单层消耗结果 */
export interface LayerConsumption {
  layerId: number
  /** 本次消耗数量 */
  qty: number
  /** 该层单位成本 */
  unitCost: number
  /** 本次消耗金额 */
  amount: number
}

export interface OutboundCostResult {
  /** 出库单位成本（加权平均） */
  unitCost: number
  /** 出库总金额 */
  amount: number
  /** 各成本层消耗明细 */
  consumptions: LayerConsumption[]
  /** 成本层未覆盖的出库数量 */
  shortfallQty: number
  /** 成本来源 */
  source: CostSource
}

/**
 * 按给定顺序消耗成本层（先进先出）。
 * 返回加权单位成本与各层消耗明细；层不足时以 shortfallQty 记录缺口。
 */
export function consumeCostLayers(layers: CostLayerInput[], qtyOut: number): {
  consumptions: LayerConsumption[]
  amount: number
  shortfallQty: number
} {
  const need = num(qtyOut)
  const consumptions: LayerConsumption[] = []
  let amount = 0
  let remaining = need
  for (const layer of layers) {
    if (remaining <= 0) break
    const available = num(layer.qtyAvailable)
    if (available <= 0) continue
    const take = Math.min(available, remaining)
    const unitCost = num(layer.unitCost)
    consumptions.push({
      layerId: layer.id,
      qty: round3(take),
      unitCost: round4(unitCost),
      amount: round4(take * unitCost)
    })
    amount += take * unitCost
    remaining -= take
  }
  return { consumptions, amount: round4(amount), shortfallQty: round3(Math.max(remaining, 0)) }
}

/** 成本层排序：先进先出按入库时间升序，分批按批次号 + 入库时间 */
export function sortCostLayers(layers: CostLayerInput[], method: CostingMethod, batchNo?: string | null): CostLayerInput[] {
  const filtered = batchNo
    ? layers.filter((item) => (item.batchNo ?? '') === batchNo)
    : [...layers]
  return filtered.sort((a, b) => {
    if (method === 'BATCH' && (a.batchNo ?? '') !== (b.batchNo ?? '')) {
      return (a.batchNo ?? '').localeCompare(b.batchNo ?? '')
    }
    const at = time(a.occurredAt)
    const bt = time(b.occurredAt)
    if (at !== bt) return at - bt
    return a.id - b.id
  })
}

export interface ResolveOutboundCostInput {
  /** 成本核算方法 */
  method: CostingMethod
  /** 移动加权结存成本 */
  avgCost: number
  /** 成本层 */
  layers: CostLayerInput[]
  /** 出库数量 */
  qtyOut: number
  /** 出库批次（BATCH 方法使用） */
  batchNo?: string | null
  /** 调用方传入的兜底成本 */
  fallbackCost?: number | null
}

/**
 * 解析出库成本：
 * - MOVING_WEIGHTED：取结存移动加权均价；
 * - FIFO / BATCH：消耗成本层得到加权单位成本；
 * - 层不足或无成本时使用调用方兜底成本（仍无则无成本）。
 */
export function resolveOutboundCost(input: ResolveOutboundCostInput): OutboundCostResult {
  const qtyOut = num(input.qtyOut)
  const fallback = input.fallbackCost === undefined || input.fallbackCost === null ? null : num(input.fallbackCost)

  if (input.method === 'MOVING_WEIGHTED') {
    const avgCost = num(input.avgCost)
    if (avgCost > 0) {
      return { unitCost: round4(avgCost), amount: round4(qtyOut * avgCost), consumptions: [], shortfallQty: 0, source: 'AVG_COST' }
    }
    if (fallback !== null && fallback > 0) {
      return { unitCost: round4(fallback), amount: round4(qtyOut * fallback), consumptions: [], shortfallQty: 0, source: 'FALLBACK' }
    }
    return { unitCost: 0, amount: 0, consumptions: [], shortfallQty: 0, source: 'NONE' }
  }

  const ordered = sortCostLayers(input.layers, input.method, input.method === 'BATCH' ? input.batchNo : null)
  const consumed = consumeCostLayers(ordered, qtyOut)
  if (consumed.consumptions.length > 0) {
    const unitCost = qtyOut > 0 ? round4(consumed.amount / qtyOut) : 0
    return {
      unitCost,
      amount: consumed.amount,
      consumptions: consumed.consumptions,
      shortfallQty: consumed.shortfallQty,
      source: 'COST_LAYER'
    }
  }
  const avgCost = num(input.avgCost)
  if (avgCost > 0) {
    return { unitCost: round4(avgCost), amount: round4(qtyOut * avgCost), consumptions: [], shortfallQty: 0, source: 'AVG_COST' }
  }
  if (fallback !== null && fallback > 0) {
    return { unitCost: round4(fallback), amount: round4(qtyOut * fallback), consumptions: [], shortfallQty: 0, source: 'FALLBACK' }
  }
  return { unitCost: 0, amount: 0, consumptions: [], shortfallQty: 0, source: 'NONE' }
}

/** 库存估值：结存数量 × 结存单位成本 */
export function computeStockValuation(qtyOnHand: number, unitCost: number): { amount: number; unitCost: number } {
  const cost = num(unitCost)
  return { unitCost: round4(cost), amount: round4(num(qtyOnHand) * cost) }
}

/** 成本方法切换校验：存在未结清成本层时不允许切换为分批成本 */
export function validateCostingMethodChange(
  currentMethod: CostingMethod,
  targetMethod: CostingMethod,
  openLayerCount: number
): { allowed: boolean; reason: string } {
  if (currentMethod === targetMethod) return { allowed: true, reason: '成本方法未变更' }
  if (openLayerCount > 0 && targetMethod === 'BATCH') {
    return { allowed: false, reason: `存在 ${openLayerCount} 条未结清成本层，切换为分批实际成本需先结清成本层` }
  }
  return { allowed: true, reason: `允许从 ${COSTING_METHOD_LABEL[currentMethod]} 切换为 ${COSTING_METHOD_LABEL[targetMethod]}` }
}

/** 存货收发存明细项 */
export interface InventoryCostingItem {
  productId: number
  productName?: string | null
  /** 期初结存数量 */
  openingQty: number
  /** 期初结存金额 */
  openingAmount: number
  /** 本期入库数量 */
  inQty: number
  /** 本期入库金额 */
  inAmount: number
  /** 本期出库数量 */
  outQty: number
  /** 本期出库金额 */
  outAmount: number
}

/** 存货收发存行 */
export interface InventoryMovementRow {
  productId: number
  productName: string
  openingQty: number
  openingAmount: number
  openingAvgCost: number
  inQty: number
  inAmount: number
  outQty: number
  outAmount: number
  closingQty: number
  closingAmount: number
  closingAvgCost: number
}

/** 存货收发存汇总 */
export interface InventoryMovementReport {
  rows: InventoryMovementRow[]
  totals: {
    openingQty: number
    openingAmount: number
    inQty: number
    inAmount: number
    outQty: number
    outAmount: number
    closingQty: number
    closingAmount: number
  }
  /** 收发存合计与存货科目余额的差异（存货科目余额 - 收发存期末金额） */
  difference: number | null
  reconciled: boolean
}

/**
 * 存货收发存报表（移动加权口径）：
 * 期末数量 = 期初数量 + 入库数量 - 出库数量；期末金额 = 期初金额 + 入库金额 - 出库金额；
 * 期末均价 = 期末金额 / 期末数量。
 */
export function buildInventoryMovementReport(
  items: InventoryCostingItem[],
  subjectBalance?: number | null
): InventoryMovementReport {
  const rows: InventoryMovementRow[] = (items ?? []).map((item) => {
    const openingQty = num(item.openingQty)
    const openingAmount = num(item.openingAmount)
    const inQty = num(item.inQty)
    const inAmount = num(item.inAmount)
    const outQty = num(item.outQty)
    const outAmount = num(item.outAmount)
    const closingQty = round4(openingQty + inQty - outQty)
    const closingAmount = round4(openingAmount + inAmount - outAmount)
    return {
      productId: item.productId,
      productName: item.productName ?? '',
      openingQty: round4(openingQty),
      openingAmount: round4(openingAmount),
      openingAvgCost: openingQty > 0 ? round4(openingAmount / openingQty) : 0,
      inQty: round4(inQty),
      inAmount: round4(inAmount),
      outQty: round4(outQty),
      outAmount: round4(outAmount),
      closingQty,
      closingAmount,
      closingAvgCost: closingQty > 0 ? round4(closingAmount / closingQty) : 0
    }
  })
  const sum = (pick: (row: InventoryMovementRow) => number): number =>
    round4(rows.reduce((acc, row) => acc + pick(row), 0))
  const totals = {
    openingQty: sum((row) => row.openingQty),
    openingAmount: sum((row) => row.openingAmount),
    inQty: sum((row) => row.inQty),
    inAmount: sum((row) => row.inAmount),
    outQty: sum((row) => row.outQty),
    outAmount: sum((row) => row.outAmount),
    closingQty: sum((row) => row.closingQty),
    closingAmount: sum((row) => row.closingAmount)
  }
  const difference = subjectBalance === null || subjectBalance === undefined
    ? null
    : round4(num(subjectBalance) - totals.closingAmount)
  return {
    rows,
    totals,
    difference,
    reconciled: difference === null ? true : Math.abs(difference) < 0.01
  }
}

/* ------------------------------ 内部工具 ------------------------------ */

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

function time(value: string | Date | null | undefined): number {
  if (!value) return 0
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}
