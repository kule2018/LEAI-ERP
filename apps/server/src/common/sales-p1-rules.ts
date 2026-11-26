/**
 * 销售 P1 规则：退货率多维统计、报价模板复用、信用动态流水。
 */

/** 按产品聚合退货率 */
export function buildProductReturnRate(
  lines: Array<{ productId: number; salesAmount: number; returnAmount: number }>,
  productNames?: Map<number, string>
): Array<{ productId: number; productName: string; salesAmount: number; returnAmount: number; rate: number; percent: string }> {
  const map = new Map<number, { productId: number; salesAmount: number; returnAmount: number }>()
  for (const line of lines) {
    const current = map.get(line.productId) ?? { productId: line.productId, salesAmount: 0, returnAmount: 0 }
    current.salesAmount += line.salesAmount
    current.returnAmount += line.returnAmount
    map.set(line.productId, current)
  }
  return [...map.values()].map((row) => {
    const rate = row.salesAmount > 0 ? Number((row.returnAmount / row.salesAmount).toFixed(6)) : 0
    return {
      ...row,
      productName: productNames?.get(row.productId) ?? '',
      salesAmount: Number(row.salesAmount.toFixed(4)),
      returnAmount: Number(row.returnAmount.toFixed(4)),
      rate,
      percent: `${(rate * 100).toFixed(2)}%`
    }
  }).sort((a, b) => b.returnAmount - a.returnAmount)
}

/** 按期间聚合退货率 */
export function buildPeriodReturnRate(
  rows: Array<{ period: string; salesAmount: number; returnAmount: number }>
): Array<{ period: string; salesAmount: number; returnAmount: number; rate: number; percent: string }> {
  const map = new Map<string, { period: string; salesAmount: number; returnAmount: number }>()
  for (const row of rows) {
    const current = map.get(row.period) ?? { period: row.period, salesAmount: 0, returnAmount: 0 }
    current.salesAmount += row.salesAmount
    current.returnAmount += row.returnAmount
    map.set(row.period, current)
  }
  return [...map.values()].sort((a, b) => a.period.localeCompare(b.period)).map((row) => {
    const rate = row.salesAmount > 0 ? Number((row.returnAmount / row.salesAmount).toFixed(6)) : 0
    return { ...row, rate, percent: `${(rate * 100).toFixed(2)}%` }
  })
}

/** 报价模板应用：模板行 → 报价行 */
export function buildQuotationFromTemplate(
  templateLines: Array<{ productId: number; qty: number; unitPrice: number; remark?: string | null }>,
  overrides?: Record<number, { qty?: number; unitPrice?: number }>
): Array<{ productId: number; qty: number; unitPrice: number; amount: number; remark: string | null }> {
  return templateLines.map((line) => {
    const override = overrides?.[line.productId]
    const qty = override?.qty ?? line.qty
    const unitPrice = override?.unitPrice ?? line.unitPrice
    return {
      productId: line.productId,
      qty: Number(qty.toFixed(3)),
      unitPrice: Number(unitPrice.toFixed(4)),
      amount: Number((qty * unitPrice).toFixed(4)),
      remark: line.remark ?? null
    }
  })
}

/** 信用流水方向 */
export type CreditFlowType = 'OCCUPY' | 'RELEASE' | 'ADJUST'

/** 信用变动校验：占用/释放后额度不得为负或超限 */
export function evaluateCreditFlow(input: {
  creditLimit: number
  creditUsed: number
  type: CreditFlowType
  amount: number
}): { ok: boolean; reason: string; nextUsed: number; available: number } {
  const limit = Math.max(0, input.creditLimit)
  const used = Math.max(0, input.creditUsed)
  const amount = Math.max(0, input.amount)
  const nextUsed = input.type === 'OCCUPY' ? used + amount : Math.max(0, used - amount)
  const available = Number(Math.max(0, limit - nextUsed).toFixed(4))
  if (input.type === 'OCCUPY' && nextUsed > limit + 1e-6) {
    return { ok: false, reason: `信用额度不足，可用 ${available}`, nextUsed: Number(nextUsed.toFixed(4)), available }
  }
  return { ok: true, reason: '', nextUsed: Number(nextUsed.toFixed(4)), available }
}
