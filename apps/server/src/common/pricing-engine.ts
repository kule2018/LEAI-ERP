/**
 * 定价纯逻辑引擎：价格协议自动取价、阶梯价、价格权限校验。
 * 供销售开单复用，与持久层解耦便于单测。
 */

export interface PriceTier {
  minQty: number
  price: number
}

export interface PriceAgreementInput {
  id: number
  customerId: number
  productId: number
  categoryId?: number | null
  price: string | number
  tiers?: PriceTier[] | null
  effectiveFrom?: string | null
  effectiveTo?: string | null
  status?: string | null
}

/** 日期区间是否有效（无效日期视为不限制） */
export function isAgreementEffective(agreement: PriceAgreementInput, date: string): boolean {
  if (agreement.status && agreement.status.toUpperCase() !== 'ENABLED') return false
  if (agreement.effectiveFrom && agreement.effectiveFrom > date) return false
  if (agreement.effectiveTo && agreement.effectiveTo < date) return false
  return true
}

/** 按数量匹配阶梯价；无匹配阶梯则用协议基础价 */
export function tierPrice(agreement: PriceAgreementInput, qty: number): number {
  const tiers = [...(agreement.tiers ?? [])].sort((a, b) => b.minQty - a.minQty)
  const matched = tiers.find((tier) => qty >= tier.minQty)
  return matched ? Number(matched.price) : Number(agreement.price)
}

/**
 * 在多个协议中选最适用的：客户专属 > 品类协议 > 通用协议，同类取最低价。
 * 只考虑在 date 生效的协议。
 */
export function resolveAgreementPrice(
  agreements: PriceAgreementInput[],
  productId: number,
  categoryId: number | null,
  qty: number,
  date: string
): { agreementId: number | null; unitPrice: number } | null {
  const effective = agreements.filter(
    (a) => a.productId === productId && isAgreementEffective(a, date)
  )
  if (effective.length === 0) return null
  const score = (a: PriceAgreementInput) => (a.customerId > 0 ? 2 : 0) + (categoryId && a.categoryId === categoryId ? 1 : 0)
  const bestScope = Math.max(...effective.map(score))
  const candidates = effective.filter((a) => score(a) === bestScope)
  const priced = candidates.map((a) => ({ agreementId: a.id, unitPrice: tierPrice(a, qty) }))
  priced.sort((a, b) => a.unitPrice - b.unitPrice)
  return priced[0]
}

/** 价格权限：低于底价需审批 */
export function checkFloorPrice(unitPrice: number, floorPrice: number | null | undefined): {
  ok: boolean
  needsApproval: boolean
} {
  if (floorPrice == null || Number(floorPrice) <= 0) return { ok: true, needsApproval: false }
  return unitPrice >= Number(floorPrice)
    ? { ok: true, needsApproval: false }
    : { ok: false, needsApproval: true }
}
