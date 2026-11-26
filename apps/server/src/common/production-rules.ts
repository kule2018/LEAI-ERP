/**
 * 生产与盘点纯逻辑规则：盲盘差异、复盘、BOM 成本卷算、工艺顺序、倒冲。
 * 与持久层解耦便于单测，供各业务服务复用。
 */

export interface StocktakeLineInput {
  productId: number
  bookQty: number
  actualQty: number
  recountQty?: number | null
}

/** 盲盘差异计算：盲盘不展示账面量，实盘后对比；复盘以第二次为准 */
export function computeStocktakeLines(lines: StocktakeLineInput[], blindMode: boolean): Array<{
  productId: number
  bookQty: number
  displayBookQty: number | null
  actualQty: number
  recountQty: number | null
  diffQty: number
  needRecount: boolean
}> {
  return lines.map((line) => {
    const finalQty = line.recountQty != null ? line.recountQty : line.actualQty
    return {
      productId: line.productId,
      bookQty: line.bookQty,
      displayBookQty: blindMode ? null : line.bookQty,
      actualQty: line.actualQty,
      recountQty: line.recountQty ?? null,
      diffQty: Number((finalQty - line.bookQty).toFixed(4)),
      needRecount: blindMode && line.recountQty == null
    }
  })
}

export interface BomCostEdge {
  parentId: number
  childId: number
  qtyPerUnit: number
  childCost: number
}

/**
 * BOM 成本卷算：每个子件成本 = 自身直接成本 + 其子件卷算成本。
 * 成品成本 = Σ(子件单位成本 × 用量)。visited 仅沿当前路径防止循环。
 */
export function rollupBomCost(productId: number, edges: BomCostEdge[], maxDepth = 10): number {
  const unitCost = (id: number, path: Set<number>, depth: number): number => {
    if (depth > maxDepth || path.has(id)) return 0
    const nextPath = new Set(path).add(id)
    let cost = 0
    for (const edge of edges.filter((e) => e.parentId === id)) {
      const childUnitCost = edge.childCost + unitCost(edge.childId, nextPath, depth + 1)
      cost += edge.qtyPerUnit * childUnitCost
    }
    return cost
  }
  return Number(unitCost(productId, new Set(), 0).toFixed(4))
}

export interface OperationInput {
  sortNo: number
  workCenterId?: number | null
  standardMinutes: number
}

/** 工艺顺序校验：sortNo 必须为正且严格递增，工时非负 */
export function validateRouting(operations: OperationInput[]): { ok: boolean; reason?: string } {
  const sorted = [...operations].sort((a, b) => a.sortNo - b.sortNo)
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].sortNo <= 0) return { ok: false, reason: '工序序号必须为正数' }
    if (i > 0 && sorted[i].sortNo === sorted[i - 1].sortNo) {
      return { ok: false, reason: `工序序号 ${sorted[i].sortNo} 重复` }
    }
    if (Number(sorted[i].standardMinutes) < 0) return { ok: false, reason: '工时不能为负' }
  }
  return { ok: true }
}

export interface BackflushInput {
  materialId: number
  requiredQty: number
  alreadyIssuedQty: number
  availableQty: number
}

/** 倒冲计算：完工时按 BOM 应耗量减去已领量，得出需自动倒冲数量 */
export function computeBackflush(items: BackflushInput[]): Array<{
  materialId: number
  qty: number
  sufficient: boolean
}> {
  return items.map((item) => {
    const qty = Math.max(0, Number((item.requiredQty - item.alreadyIssuedQty).toFixed(4)))
    return { materialId: item.materialId, qty, sufficient: item.availableQty >= qty }
  })
}
