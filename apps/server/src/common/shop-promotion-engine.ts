export type ShopCouponType = 'FIXED' | 'PERCENT'

export interface CouponRule {
  code: string
  type: ShopCouponType
  value: number
  minAmount: number
  maxDiscount?: number
  startTime: Date | string
  endTime: Date | string
  status?: string
  stackable?: boolean
}

export interface CouponContext {
  amount: number
  at?: Date
  appliedCodes?: string[]
}

export interface CouponResult {
  valid: boolean
  discount: number
  reason?: string
}

export interface SeckillRule {
  status?: string
  startTime: Date | string
  endTime: Date | string
  basePrice: number
  seckillPrice: number
  limitPerUser: number
}

export interface SeckillContext {
  at?: Date
  qty: number
  purchased?: number
}

export interface SeckillResult {
  active: boolean
  allowed: boolean
  price: number
  reason?: string
}

export interface ActivityStockState {
  total: number
  sold: number
  locked: number
}

export interface StockOperationResult {
  ok: boolean
  available: number
  state: ActivityStockState
}

export interface PromotionPriceLine {
  qty: number
  unitPrice: number
}

export interface PromotionPricedLine extends PromotionPriceLine {
  discount: number
  payable: number
}

function time(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime()
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function isActiveStatus(status: string | undefined): boolean {
  return !status || status === 'ACTIVE' || status === 'ENABLED'
}

export function validateCoupon(rule: CouponRule, ctx: CouponContext): CouponResult {
  if (!isActiveStatus(rule.status)) return { valid: false, discount: 0, reason: '优惠券未启用' }
  const at = (ctx.at ?? new Date()).getTime()
  if (!Number.isFinite(at)) return { valid: false, discount: 0, reason: '校验时间无效' }
  const start = time(rule.startTime)
  const end = time(rule.endTime)
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return { valid: false, discount: 0, reason: '优惠券有效期配置错误' }
  if (at < start || at > end) return { valid: false, discount: 0, reason: '优惠券不在有效期内' }
  if (!Number.isFinite(ctx.amount) || ctx.amount <= 0) return { valid: false, discount: 0, reason: '订单金额无效' }
  if (ctx.amount < rule.minAmount) return { valid: false, discount: 0, reason: `订单未满 ${rule.minAmount} 元` }
  const applied = ctx.appliedCodes ?? []
  if (applied.includes(rule.code)) return { valid: false, discount: 0, reason: '该优惠券已使用' }
  if (applied.length > 0 && !rule.stackable) return { valid: false, discount: 0, reason: '该优惠券不可叠加' }
  let discount = 0
  if (rule.type === 'FIXED') {
    discount = rule.value
  } else if (rule.type === 'PERCENT') {
    if (rule.value <= 0 || rule.value > 100) return { valid: false, discount: 0, reason: '折扣比例必须在 1-100 之间' }
    discount = ctx.amount * rule.value / 100
  } else {
    return { valid: false, discount: 0, reason: '优惠券类型不支持' }
  }
  if (!Number.isFinite(discount) || discount <= 0) return { valid: false, discount: 0, reason: '优惠金额无效' }
  if (rule.maxDiscount !== undefined && rule.maxDiscount >= 0) discount = Math.min(discount, rule.maxDiscount)
  discount = Math.min(round(discount, 4), round(ctx.amount, 4))
  return { valid: true, discount: round(discount, 4) }
}

export function isPromotionActive(rule: Pick<SeckillRule, 'status' | 'startTime' | 'endTime'>, at = new Date()): boolean {
  if (!isActiveStatus(rule.status)) return false
  const now = at.getTime()
  return now >= time(rule.startTime) && now <= time(rule.endTime)
}

export function resolveSeckillPrice(rule: SeckillRule, ctx: SeckillContext): SeckillResult {
  const base = rule.basePrice > 0 ? rule.basePrice : 0
  if (!isPromotionActive(rule, ctx.at)) return { active: false, allowed: false, price: base, reason: '秒杀活动未开始或已结束' }
  if (!Number.isFinite(ctx.qty) || ctx.qty <= 0) return { active: true, allowed: false, price: base, reason: '购买数量无效' }
  if (rule.seckillPrice <= 0) return { active: true, allowed: false, price: base, reason: '秒杀价格无效' }
  const purchased = ctx.purchased ?? 0
  if (purchased + ctx.qty > rule.limitPerUser) {
    return { active: true, allowed: false, price: rule.seckillPrice, reason: `每人限购 ${rule.limitPerUser} 件` }
  }
  return { active: true, allowed: true, price: Math.min(rule.seckillPrice, base) }
}

export function availableActivityStock(state: ActivityStockState): number {
  return round(Math.max(0, state.total - state.sold - state.locked), 3)
}

export function checkActivityStock(state: ActivityStockState, qty: number): { ok: boolean; available: number } {
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, available: availableActivityStock(state) }
  return { ok: qty <= availableActivityStock(state), available: availableActivityStock(state) }
}

export function allocateActivityStock(state: ActivityStockState, qty: number): StockOperationResult {
  const available = availableActivityStock(state)
  if (!Number.isFinite(qty) || qty <= 0 || qty > available) return { ok: false, available, state }
  return {
    ok: true,
    available: round(available - qty, 3),
    state: { total: state.total, sold: state.sold, locked: round(state.locked + qty, 3) }
  }
}

export function releaseActivityStock(state: ActivityStockState, qty: number): StockOperationResult {
  const available = availableActivityStock(state)
  if (!Number.isFinite(qty) || qty <= 0 || qty > state.locked) return { ok: false, available, state }
  return {
    ok: true,
    available: round(available + qty, 3),
    state: { total: state.total, sold: state.sold, locked: round(state.locked - qty, 3) }
  }
}

export function confirmActivityStock(state: ActivityStockState, qty: number): StockOperationResult {
  const available = availableActivityStock(state)
  if (!Number.isFinite(qty) || qty <= 0 || qty > state.locked) return { ok: false, available, state }
  return {
    ok: true,
    available,
    state: { total: state.total, sold: round(state.sold + qty, 3), locked: round(state.locked - qty, 3) }
  }
}

export function applyCouponToLines(lines: PromotionPriceLine[], discount: number): PromotionPricedLine[] {
  const total = lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0)
  const priced = lines.map((line) => ({
    qty: line.qty,
    unitPrice: line.unitPrice,
    discount: 0,
    payable: round(line.qty * line.unitPrice, 4)
  }))
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(discount) || discount <= 0 || lines.some((line) => line.qty <= 0)) return priced
  let remaining = Math.min(discount, total)
  const result = priced.map((line, index) => {
    const amount = line.qty * line.unitPrice
    const ratio = total > 0 ? amount / total : 0
    let allocation = index === priced.length - 1 ? remaining : round(remaining * ratio, 4)
    allocation = round(Math.min(amount, Math.max(0, allocation)), 4)
    remaining = round(remaining - allocation, 4)
    return {
      qty: line.qty,
      unitPrice: round((amount - allocation) / line.qty, 4),
      discount: allocation,
      payable: round(amount - allocation, 4)
    }
  })
  return result
}
