/**
 * 采购 P1 规则：越库直发状态机、供应商罚款校验。
 */

export function canTransitionCrossDock(from: string, to: string): { allowed: boolean; reason: string } {
  const allowed: Record<string, string[]> = {
    PENDING: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['COMPLETED'],
    COMPLETED: [],
    CANCELLED: []
  }
  return (allowed[from] ?? []).includes(to)
    ? { allowed: true, reason: '' }
    : { allowed: false, reason: `越库单状态 ${from} 不可流转为 ${to}` }
}

/** 越库直发校验：采购数量必须足以覆盖直发数量 */
export function validateCrossDock(input: {
  orderQty: number
  receivedQty: number
  requestQty: number
  alreadyCrossDockedQty: number
}): { ok: boolean; reason: string; maxQty: number } {
  const maxQty = Number((Math.min(input.orderQty, input.receivedQty) - input.alreadyCrossDockedQty).toFixed(3))
  if (input.requestQty <= 0) return { ok: false, reason: '越库数量必须大于 0', maxQty }
  if (maxQty <= 0) return { ok: false, reason: '无可越库数量', maxQty }
  if (input.requestQty > maxQty + 1e-6) return { ok: false, reason: `越库数量超出可直发数量 ${maxQty}`, maxQty }
  return { ok: true, reason: '', maxQty }
}

/** 罚款状态机 */
export function canApproveFine(from: string): { allowed: boolean; reason: string } {
  if (from !== 'PENDING') return { allowed: false, reason: '仅待审批罚款可审批' }
  return { allowed: true, reason: '' }
}

/** 扣款校验：累计扣款不得超过罚款金额 */
export function validateFineDeduction(amount: number, deducted: number, request: number): {
  ok: boolean
  reason: string
  remaining: number
} {
  const remaining = Number((amount - deducted).toFixed(4))
  if (request <= 0) return { ok: false, reason: '扣款金额必须大于 0', remaining }
  if (request > remaining + 1e-6) return { ok: false, reason: `扣款超出剩余金额 ${remaining}`, remaining }
  return { ok: true, reason: '', remaining }
}
