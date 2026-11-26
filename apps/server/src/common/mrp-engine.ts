/**
 * MRP 纯逻辑引擎：净需求公式、缺料树展开、例外消息。
 * 供制造服务复用，与持久层解耦便于单测。
 */

export interface MrpDemand {
  productId: number
  grossQty: number
  safetyQty?: number
  availableQty?: number
  onWayQty?: number
  allocatedQty?: number
}

export interface MrpResult {
  productId: number
  grossQty: number
  netQty: number
  exception: 'NONE' | 'SHORTAGE' | 'EXCESS'
}

/** 净需求 = 需求 + 安全库存 - 可用 - 在途 + 已分配 */
export function computeNetDemand(demand: MrpDemand): MrpResult {
  const net = demand.grossQty
    + (demand.safetyQty ?? 0)
    - (demand.availableQty ?? 0)
    - (demand.onWayQty ?? 0)
    + (demand.allocatedQty ?? 0)
  const netQty = Math.max(0, Number(net.toFixed(4)))
  return {
    productId: demand.productId,
    grossQty: demand.grossQty,
    netQty,
    exception: netQty > 0 ? 'SHORTAGE' : demand.grossQty === 0 ? 'NONE' : 'EXCESS'
  }
}

export interface BomEdge {
  parentId: number
  childId: number
  qtyPerUnit: number
}

/**
 * 展开缺料树：从顶层成品按 BOM 逐层计算子件毛需求。
 * returns Map<productId, qty>，可配合 computeNetDemand 得出每层净需求。
 */
export function explodeBom(
  topProductId: number,
  topQty: number,
  edges: BomEdge[],
  maxDepth = 10
): Map<number, number> {
  const result = new Map<number, number>()
  const walk = (productId: number, qty: number, depth: number, visiting: Set<number>) => {
    if (depth > maxDepth || visiting.has(productId)) return
    const children = edges.filter((edge) => edge.parentId === productId)
    const nextVisiting = new Set(visiting).add(productId)
    for (const edge of children) {
      const childQty = qty * edge.qtyPerUnit
      result.set(edge.childId, (result.get(edge.childId) ?? 0) + childQty)
      walk(edge.childId, childQty, depth + 1, nextVisiting)
    }
  }
  walk(topProductId, topQty, 0, new Set())
  return result
}

/** 生成例外消息（缺料/过量/循环） */
export function mrpExceptions(results: MrpResult[]): string[] {
  return results
    .filter((r) => r.exception !== 'NONE')
    .map((r) => r.exception === 'SHORTAGE'
      ? `产品 ${r.productId} 缺料 ${r.netQty}`
      : `产品 ${r.productId} 需求可被现有库存覆盖 ${Math.abs(r.netQty)}`)
}
