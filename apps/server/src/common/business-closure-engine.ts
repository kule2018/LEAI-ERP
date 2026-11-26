/**
 * 业务闭环纯逻辑引擎：三方匹配、齐套检查、暂估冲销、调拨状态机、反审核校验。
 * 与持久层解耦便于单测，供各业务服务复用。
 */

export const MATCH_STATUS = {
  MATCHED: 'MATCHED',
  QUANTITY_DIFF: 'QUANTITY_DIFF',
  PRICE_DIFF: 'PRICE_DIFF',
  MISSING: 'MISSING'
} as const

export type MatchStatus = (typeof MATCH_STATUS)[keyof typeof MATCH_STATUS]

export interface ThreeWayInput {
  orderQty: number
  orderPrice: number
  receiptQty: number
  invoiceQty: number
  invoicePrice: number
  qtyTolerance?: number
  priceTolerance?: number
}

/** 三方匹配（订单/收货/发票）：检查数量与价格差异 */
export function threeWayMatch(input: ThreeWayInput): {
  status: MatchStatus
  issues: string[]
  matched: boolean
} {
  const issues: string[] = []
  const qtyTol = input.qtyTolerance ?? 0
  const priceTol = input.priceTolerance ?? 0.01
  if (input.receiptQty <= 0) issues.push('无收货记录')
  if (input.invoiceQty <= 0) issues.push('无发票记录')
  if (Math.abs(input.receiptQty - input.orderQty) > qtyTol) {
    issues.push(`收货数量 ${input.receiptQty} 与订单 ${input.orderQty} 不符`)
  }
  if (Math.abs(input.invoiceQty - input.receiptQty) > qtyTol) {
    issues.push(`发票数量 ${input.invoiceQty} 与收货 ${input.receiptQty} 不符`)
  }
  if (Math.abs(input.invoicePrice - input.orderPrice) > priceTol) {
    issues.push(`发票单价 ${input.invoicePrice} 与订单 ${input.orderPrice} 不符`)
  }
  let status: MatchStatus = MATCH_STATUS.MATCHED
  if (input.receiptQty <= 0 || input.invoiceQty <= 0) status = MATCH_STATUS.MISSING
  else if (issues.some((i) => i.includes('数量'))) status = MATCH_STATUS.QUANTITY_DIFF
  else if (issues.some((i) => i.includes('单价'))) status = MATCH_STATUS.PRICE_DIFF
  return { status, issues, matched: issues.length === 0 }
}

export interface AvailabilityInput {
  materialId: number
  requiredQty: number
  availableQty: number
}

/** 齐套检查：所有子件可用量满足需求才能下达工单 */
export function checkKitting(materials: AvailabilityInput[]): {
  complete: boolean
  shortfalls: Array<{ materialId: number; short: number }>
} {
  const shortfalls = materials
    .map((m) => ({ materialId: m.materialId, short: Math.max(0, m.requiredQty - m.availableQty) }))
    .filter((item) => item.short > 0)
  return { complete: shortfalls.length === 0, shortfalls }
}

/** 暂估冲销：发票金额确定后生成冲销分录 */
export function provisionalReversal(provisionalAmount: number, invoiceAmount: number): {
  difference: number
  needAdjust: boolean
} {
  const difference = Number((invoiceAmount - provisionalAmount).toFixed(4))
  return { difference, needAdjust: Math.abs(difference) > 0.0001 }
}

export const TRANSFER_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  IN_TRANSIT: 'IN_TRANSIT',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED'
} as const

export type TransferStatus = (typeof TRANSFER_STATUS)[keyof typeof TRANSFER_STATUS]

const TRANSFER_TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['RECEIVED'],
  RECEIVED: [],
  CANCELLED: []
}

/** 调拨状态机：禁止跳级 */
export function canTransitionTransfer(from: TransferStatus, to: TransferStatus): boolean {
  return TRANSFER_TRANSITIONS[from]?.includes(to) ?? false
}

/** 反审核校验：只有已过账、期间未结账、且无后续关联凭证才能反审核 */
export function canUnpost(status: string, periodClosed: boolean, hasreferences: boolean): {
  ok: boolean
  reason?: string
} {
  if (status !== 'POSTED') return { ok: false, reason: '只有已过账凭证可以反审核' }
  if (periodClosed) return { ok: false, reason: '会计期间已结账，无法反审核' }
  if (hasreferences) return { ok: false, reason: '凭证已被其他单据引用，无法反审核' }
  return { ok: true }
}
