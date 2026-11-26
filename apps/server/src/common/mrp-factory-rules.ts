/**
 * MRP 多工厂过滤与采购需求生成规则：
 * 按工厂/仓库维度过滤可用库存与在途量，按采购建议生成采购需求。
 */

export interface FactoryStockInput {
  productId: number
  warehouseId: number
  qtyOnHand: number
  qtyOccupied: number
}

/** 按工厂仓库集合过滤库存快照 */
export function filterStockByFactories<T extends { warehouseId: number }>(
  rows: T[],
  factoryWarehouseIds: number[]
): T[] {
  if (factoryWarehouseIds.length === 0) return rows
  const allowed = new Set(factoryWarehouseIds)
  return rows.filter((row) => allowed.has(Number(row.warehouseId)))
}

/** MRP 运行参数校验 */
export function validateMrpFactoryFilter(input: {
  factoryId?: number | null
  warehouseIds?: number[]
}): { ok: boolean; reason?: string; factoryWarehouseIds: number[] } {
  if (input.factoryId && (!Number.isInteger(input.factoryId) || input.factoryId <= 0)) {
    return { ok: false, reason: '工厂 ID 无效', factoryWarehouseIds: [] }
  }
  const ids = (input.warehouseIds ?? []).filter((id) => Number.isInteger(id) && id > 0)
  return { ok: true, factoryWarehouseIds: [...new Set(ids)] }
}

/** 采购建议 → 采购需求行 */
export interface PurchaseDemandFromMrpInput {
  productId: number
  netQty: number
  suggestType: string
}

/** 仅净需求大于 0 且建议类型为 PURCHASE 的项生成需求 */
export function buildDemandsFromMrp(
  suggests: PurchaseDemandFromMrpInput[]
): Array<{ productId: number; qty: number }> {
  return suggests
    .filter((item) => item.suggestType === 'PURCHASE' && item.netQty > 0)
    .map((item) => ({ productId: item.productId, qty: Number(item.netQty.toFixed(3)) }))
}

/** 需求去重合并：同产品多建议合并 */
export function mergeDemandRows(rows: Array<{ productId: number; qty: number }>): Array<{ productId: number; qty: number }> {
  const map = new Map<number, number>()
  for (const row of rows) map.set(row.productId, (map.get(row.productId) ?? 0) + row.qty)
  return [...map.entries()].map(([productId, qty]) => ({ productId, qty: Number(qty.toFixed(3)) }))
}
