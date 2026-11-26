/**
 * 库存作业规则引擎（纯函数）：可用量、批次库位矩阵、扫码实盘、调拨签收差异、拆装成本分摊。
 */

export interface StockQuantityInput {
  qtyOnHand: string | number
  qtyOccupied: string | number
  qtyFrozen: string | number
}

export interface AvailableQuantity {
  onHand: number
  occupied: number
  frozen: number
  available: number
  inTransit: number
}

export function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

/** 可用量 = 实物量 - 锁定量 - 冻结量；负数按 0 处理并保留占用超量信息 */
export function computeAvailableQty(input: StockQuantityInput): AvailableQuantity {
  const onHand = toNumber(input.qtyOnHand)
  const occupied = toNumber(input.qtyOccupied)
  const frozen = toNumber(input.qtyFrozen)
  const available = Math.max(0, onHand - occupied - frozen)
  return { onHand, occupied, frozen, available, inTransit: 0 }
}

export interface BalanceMatrixRow {
  productId: number
  variantId: number
  warehouseId: number
  totalOnHand: number
  totalOccupied: number
  totalFrozen: number
  totalAvailable: number
  cells: Array<{
    locationId: number
    batchNo: string
    qtyOnHand: number
    qtyOccupied: number
    qtyFrozen: number
    qtyAvailable: number
  }>
}

export interface BalanceMatrixInput {
  productId: number
  variantId: number
  warehouseId: number
  locationId: number
  batchNo: string
  qtyOnHand: string | number
  qtyOccupied: string | number
  qtyFrozen: string | number
}

/** 批次 × 库位矩阵：按产品/仓库聚合可用量 */
export function buildBatchLocationMatrix(balances: BalanceMatrixInput[]): BalanceMatrixRow[] {
  const rows = new Map<string, BalanceMatrixRow>()
  for (const balance of balances) {
    const key = `${balance.productId}:${balance.variantId}:${balance.warehouseId}`
    let row = rows.get(key)
    if (!row) {
      row = {
        productId: balance.productId,
        variantId: balance.variantId,
        warehouseId: balance.warehouseId,
        totalOnHand: 0,
        totalOccupied: 0,
        totalFrozen: 0,
        totalAvailable: 0,
        cells: []
      }
      rows.set(key, row)
    }
    const available = computeAvailableQty(balance)
    row.totalOnHand += available.onHand
    row.totalOccupied += available.occupied
    row.totalFrozen += available.frozen
    row.totalAvailable += available.available
    row.cells.push({
      locationId: balance.locationId,
      batchNo: balance.batchNo,
      qtyOnHand: available.onHand,
      qtyOccupied: available.occupied,
      qtyFrozen: available.frozen,
      qtyAvailable: available.available
    })
  }
  for (const row of rows.values()) {
    row.cells.sort((a, b) => a.locationId - b.locationId || a.batchNo.localeCompare(b.batchNo))
  }
  return [...rows.values()].sort((a, b) => a.productId - b.productId || a.warehouseId - b.warehouseId)
}

export interface StocktakeScan {
  lineId?: number
  productId?: number
  batchNo?: string
  barcode?: string
  qty: string | number
}

export interface StocktakeScanLine {
  lineId: number
  productId: number
  variantId: number
  batchNo: string
  bookQty: number
  actualQty: number
  recountQty: number | null
  diffQty: number
}

export interface StocktakeScanResult {
  lines: StocktakeScanLine[]
  scannedCount: number
  scannedQty: number
  /** 盲盘下不返回账面数量，避免实盘人员被账面数字引导 */
  blindMode: boolean
}

/** 扫码实盘：按明细累加实盘数量并重算差异；盲盘模式下不暴露账面数量 */
export function applyStocktakeScans(
  lines: StocktakeScanLine[],
  scans: StocktakeScan[],
  blindMode: boolean
): StocktakeScanResult {
  const byLineId = new Map<number, StocktakeScanLine>()
  const byProduct = new Map<string, StocktakeScanLine>()
  for (const line of lines) {
    byLineId.set(line.lineId, { ...line })
    const productKey = `${line.productId}:${line.batchNo}`
    if (!byProduct.has(productKey)) byProduct.set(productKey, byLineId.get(line.lineId)!)
  }
  let scannedQty = 0
  let matched = 0
  for (const scan of scans) {
    const qty = toNumber(scan.qty)
    if (qty <= 0) continue
    const target = scan.lineId !== undefined
      ? byLineId.get(scan.lineId)
      : byProduct.get(`${scan.productId ?? 0}:${scan.batchNo ?? ''}`)
    if (!target) continue
    target.actualQty = toNumber(target.actualQty) + qty
    scannedQty += qty
    matched += 1
  }
  const result = lines.map((original) => {
    const current = byLineId.get(original.lineId)
    const actualQty = current ? toNumber(current.actualQty) : toNumber(original.actualQty)
    const recountQty = current && current.recountQty !== null ? toNumber(current.recountQty) : null
    const diffQty = recountQty !== null
      ? recountQty - toNumber(original.bookQty)
      : actualQty - toNumber(original.bookQty)
    return {
      lineId: original.lineId,
      productId: original.productId,
      variantId: original.variantId,
      batchNo: original.batchNo,
      bookQty: blindMode ? 0 : toNumber(original.bookQty),
      actualQty,
      recountQty,
      diffQty
    }
  })
  return { lines: result, scannedCount: matched, scannedQty, blindMode }
}

export interface TransferReceiptLine {
  lineId: number
  qty: string | number
  receivedQty: string | number
  shippedQty?: string | number
}

export interface TransferReceiptJudgement {
  lineId: number
  expectedQty: number
  receivedQty: number
  diffQty: number
  abnormal: boolean
  reason: string | null
}

/** 调拨签收差异：短收记录差异，超收视为异常直接拒绝 */
export function evaluateTransferReceipt(lines: TransferReceiptLine[]): {
  judgements: TransferReceiptJudgement[]
  hasShortage: boolean
  hasOverage: boolean
  totalShortage: number
  totalOverage: number
} {
  const judgements = lines.map((line) => {
    const expectedQty = toNumber(line.qty)
    const receivedQty = toNumber(line.receivedQty)
    const diffQty = receivedQty - expectedQty
    const overage = diffQty > 0
    const shortage = diffQty < 0
    return {
      lineId: line.lineId,
      expectedQty,
      receivedQty,
      diffQty,
      abnormal: overage,
      reason: overage ? '签收数量超出调拨数量' : shortage ? '签收短少，形成调拨差异' : null
    }
  })
  return {
    judgements,
    hasShortage: judgements.some((item) => item.diffQty < 0),
    hasOverage: judgements.some((item) => item.diffQty > 0),
    totalShortage: judgements.filter((item) => item.diffQty < 0).reduce((sum, item) => sum + Math.abs(item.diffQty), 0),
    totalOverage: judgements.filter((item) => item.diffQty > 0).reduce((sum, item) => sum + item.diffQty, 0)
  }
}

export interface AssemblyComponent {
  productId: number
  batchNo: string
  variantId: number
  /** 单位成本（取自库存余额移动平均成本） */
  unitCost: number
  /** 单件成品消耗数量 */
  qtyPerOutput: number
}

export interface AssemblyCostResult {
  outputQty: number
  totalCost: number
  unitCost: number
  components: Array<{
    productId: number
    batchNo: string
    variantId: number
    consumedQty: number
    cost: number
    unitCost: number
  }>
}

/** 拆装成本分摊：子件成本按产出数量摊到成品单位成本，成本随批次继承 */
export function allocateAssemblyCost(components: AssemblyComponent[], outputQty: number): AssemblyCostResult {
  const output = toNumber(outputQty)
  const details = components.map((component) => {
    const consumedQty = toNumber(component.qtyPerOutput) * output
    const cost = consumedQty * toNumber(component.unitCost)
    return {
      productId: component.productId,
      batchNo: component.batchNo,
      variantId: component.variantId,
      consumedQty,
      cost,
      unitCost: toNumber(component.unitCost)
    }
  })
  const totalCost = details.reduce((sum, item) => sum + item.cost, 0)
  return {
    outputQty: output,
    totalCost,
    unitCost: output > 0 ? totalCost / output : 0,
    components: details
  }
}
