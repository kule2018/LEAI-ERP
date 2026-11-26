import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateCoupon, isPromotionActive, resolveSeckillPrice, availableActivityStock,
  allocateActivityStock, releaseActivityStock, confirmActivityStock, applyCouponToLines
} from '../apps/server/dist/common/shop-promotion-engine.js'

const at = new Date('2026-06-15T12:00:00Z')
const window = {
  startTime: new Date('2026-06-01T00:00:00Z'),
  endTime: new Date('2026-06-30T23:59:59Z')
}

test('优惠券门槛相等可用', () => {
  const result = validateCoupon({
    code: 'FULL100', type: 'FIXED', value: 20, minAmount: 100,
    startTime: window.startTime, endTime: window.endTime
  }, { amount: 100, at })
  assert.equal(result.valid, true)
  assert.equal(result.discount, 20)
})

test('优惠券过期与未满门槛被拒绝', () => {
  const rule = {
    code: 'FIXED20', type: 'FIXED', value: 20, minAmount: 100,
    startTime: window.startTime, endTime: window.endTime
  }
  assert.equal(validateCoupon(rule, { amount: 200, at: new Date('2026-07-01T00:00:00Z') }).valid, false)
  assert.equal(validateCoupon(rule, { amount: 99.99, at }).valid, false)
})

test('优惠券叠加冲突与折扣上限', () => {
  const base = { code: 'PERCENT20', type: 'PERCENT', value: 20, minAmount: 0, startTime: window.startTime, endTime: window.endTime }
  const conflict = validateCoupon({ ...base }, { amount: 500, at, appliedCodes: ['OTHER'] })
  assert.equal(conflict.valid, false)
  assert.match(conflict.reason, /不可叠加/)
  const capped = validateCoupon({ ...base, stackable: true, maxDiscount: 50 }, { amount: 500, at })
  assert.equal(capped.valid, true)
  assert.equal(capped.discount, 50)
})

test('秒杀时段判定包含边界', () => {
  assert.equal(isPromotionActive({ ...window, status: 'ACTIVE' }, window.startTime), true)
  assert.equal(isPromotionActive({ ...window, status: 'ACTIVE' }, window.endTime), true)
  assert.equal(isPromotionActive({ ...window, status: 'PAUSED' }, at), false)
})

test('秒杀价格与每人限购', () => {
  const rule = { ...window, status: 'ACTIVE', basePrice: 100, seckillPrice: 60, limitPerUser: 2 }
  const ok = resolveSeckillPrice(rule, { at, qty: 2, purchased: 0 })
  assert.equal(ok.allowed, true)
  assert.equal(ok.price, 60)
  const blocked = resolveSeckillPrice(rule, { at, qty: 1, purchased: 2 })
  assert.equal(blocked.allowed, false)
  assert.match(blocked.reason, /限购/)
})

test('活动库存不允许超卖到负数', () => {
  const state = { total: 10, sold: 4, locked: 3 }
  assert.equal(availableActivityStock(state), 3)
  const allocated = allocateActivityStock(state, 3)
  assert.equal(allocated.ok, true)
  assert.equal(allocated.state.locked, 6)
  const oversell = allocateActivityStock(state, 4)
  assert.equal(oversell.ok, false)
  assert.equal(oversell.state.locked, 3)
})

test('活动库存释放与确认不能越过锁定量', () => {
  const state = { total: 10, sold: 2, locked: 5 }
  assert.equal(releaseActivityStock(state, 6).ok, false)
  const released = releaseActivityStock(state, 2)
  assert.equal(released.ok, true)
  assert.equal(released.state.locked, 3)
  const confirmed = confirmActivityStock(state, 3)
  assert.equal(confirmed.ok, true)
  assert.deepEqual(confirmed.state, { total: 10, sold: 5, locked: 2 })
})

test('优惠券金额按行金额比例分摊', () => {
  const result = applyCouponToLines([
    { qty: 2, unitPrice: 100 },
    { qty: 1, unitPrice: 100 }
  ], 30)
  assert.deepEqual(result.map((line) => line.discount), [20, 10])
  assert.deepEqual(result.map((line) => line.unitPrice), [90, 90])
  assert.equal(result.reduce((sum, line) => sum + line.payable, 0), 270)
})

test('无有效优惠时不改写行价格', () => {
  const result = applyCouponToLines([{ qty: 1, unitPrice: 50 }], 0)
  assert.equal(result[0].unitPrice, 50)
  assert.equal(result[0].discount, 0)
})
