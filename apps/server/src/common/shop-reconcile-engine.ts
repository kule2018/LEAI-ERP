export interface ReconcileResult {
  status: 'SUCCESS' | 'DIFF' | 'PENDING'
  diff: number
  reason?: string
}

export interface RefundEligibilityInput {
  orderAmount: number
  paidAmount: number
  refundedAmount: number
  amount: number
  orderStatus?: string
}

export interface RefundEligibility {
  allowed: boolean
  reason?: string
}

export interface RefundLine {
  qty: number
  unitPrice: number
}

export interface RefundAllocation {
  amount: number
  payable: number
}

export const REFUND_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: []
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function compareAmounts(platformAmount: number, localAmount: number, tolerance = 0.01): ReconcileResult {
  if (!Number.isFinite(platformAmount) || !Number.isFinite(localAmount)) {
    return { status: 'PENDING', diff: 0, reason: '金额无效，需人工确认' }
  }
  const diff = round(platformAmount - localAmount, 4)
  if (Math.abs(diff) <= tolerance) return { status: 'SUCCESS', diff }
  return { status: 'DIFF', diff, reason: diff > 0 ? '平台金额大于本地金额' : '本地金额大于平台金额' }
}

export function checkRefundEligibility(input: RefundEligibilityInput): RefundEligibility {
  if (!Number.isFinite(input.amount) || input.amount <= 0) return { allowed: false, reason: '退款金额必须大于零' }
  if (input.orderStatus && !['SYNCED', 'SHIPPED'].includes(input.orderStatus)) {
    return { allowed: false, reason: '只有已同步或未完结订单可以退款' }
  }
  const paid = round(input.paidAmount, 4)
  if (paid <= 0) return { allowed: false, reason: '订单未支付，无法退款' }
  const refundable = round(paid - input.refundedAmount, 4)
  if (input.amount > refundable) return { allowed: false, reason: `可退款金额仅 ${refundable}` }
  if (input.amount > input.orderAmount) return { allowed: false, reason: '退款金额不能超过订单金额' }
  return { allowed: true }
}

export function canTransitionRefund(from: string, to: string): boolean {
  return (REFUND_TRANSITIONS[from] ?? []).includes(to)
}

export function allocateRefundAmount(lines: RefundLine[], amount: number): RefundAllocation[] {
  const total = lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0)
  const result = lines.map((line) => ({ amount: 0, payable: round(line.qty * line.unitPrice, 4) }))
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(amount) || amount <= 0 || lines.some((line) => line.qty <= 0)) return result
  let remaining = Math.min(amount, total)
  result.forEach((item, index) => {
    const lineTotal = lines[index].qty * lines[index].unitPrice
    const ratio = total > 0 ? lineTotal / total : 0
    let allocation = index === result.length - 1 ? remaining : round(remaining * ratio, 4)
    allocation = round(Math.min(lineTotal, Math.max(0, allocation)), 4)
    remaining = round(remaining - allocation, 4)
    item.amount = allocation
    item.payable = round(lineTotal - allocation, 4)
  })
  return result
}
