/**
 * 生产退料与需求汇总纯规则（第十六批）。
 */

/** 退料量校验：累计退料不得超过已领料量 */
export function evaluateMaterialReturn(input: {
  issuedQty: number
  returningQty: number
  alreadyReturnedQty: number
}): { ok: boolean; reason: string; maxQty: number } {
  const maxQty = Number((input.issuedQty - input.alreadyReturnedQty).toFixed(3))
  if (input.returningQty <= 0) return { ok: false, reason: '退料数量必须大于 0', maxQty }
  if (maxQty <= 0) return { ok: false, reason: '该物料无可退数量（未领料或已全部退回）', maxQty }
  if (input.returningQty > maxQty + 1e-6) return { ok: false, reason: `退料数量超出可退数量 ${maxQty}`, maxQty }
  return { ok: true, reason: '', maxQty }
}

export interface DemandSummaryRow {
  productId: number
  productCode?: string
  productName?: string
  /** 毛需求 */
  grossDemand: number
  /** 现有库存 */
  onHand: number
  /** 在途（已下达未入库） */
  inTransit: number
  /** 净需求 */
  netDemand: number
  /** 建议采购/生产数量 */
  suggestedQty: number
  unit?: string
}

/** 需求汇总：按产品聚合毛需求、库存与在途，得出净需求与建议量 */
export function buildDemandSummary(rows: Array<{
  productId: number
  productCode?: string
  productName?: string
  grossDemand: number
  onHand: number
  inTransit: number
  unit?: string
}>): DemandSummaryRow[] {
  const map = new Map<number, DemandSummaryRow>()
  for (const row of rows) {
    const current = map.get(row.productId) ?? {
      productId: row.productId,
      productCode: row.productCode,
      productName: row.productName,
      grossDemand: 0,
      onHand: 0,
      inTransit: 0,
      netDemand: 0,
      suggestedQty: 0,
      unit: row.unit
    }
    current.grossDemand += row.grossDemand
    current.onHand += row.onHand
    current.inTransit += row.inTransit
    map.set(row.productId, current)
  }
  return [...map.values()].map((row) => {
    const netDemand = Number(Math.max(0, row.grossDemand - row.onHand - row.inTransit).toFixed(3))
    return { ...row, netDemand, suggestedQty: netDemand }
  })
}
