import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildUnshippedList,
  canTransitionComplaint,
  canTransitionCommission,
  computeCommission,
  computeReturnRate,
  evaluateComplaintSla,
  isRuleEffective,
  resolvePromisedDate
} from '../apps/server/dist/common/sales-crm-extension-rules.js'

test('佣金：按比例计提并按退货金额冲减基数', () => {
  const result = computeCommission({ type: 'RATE', rate: 0.05 }, { orderAmount: 10000, returnAmount: 2000 })
  assert.equal(result.commissionAmount, 400)
  assert.match(result.reason, /5\.00%/)
})

test('佣金：固定金额计提不受订单金额影响', () => {
  const result = computeCommission({ type: 'FIXED', fixedAmount: 500 }, { orderAmount: 10000 })
  assert.equal(result.commissionAmount, 500)
})

test('佣金：阶梯规则按累计销售额命中档位', () => {
  const tiers = [{ min: 0, rate: 0.01 }, { min: 100000, rate: 0.02 }]
  const low = computeCommission({ type: 'TIER', tiers }, { orderAmount: 50000, accumulatedAmount: 20000 })
  assert.equal(low.commissionAmount, 500)
  assert.equal(low.matchedTier.min, 0)
  const high = computeCommission({ type: 'TIER', tiers }, { orderAmount: 50000, accumulatedAmount: 150000 })
  assert.equal(high.commissionAmount, 1000)
  assert.equal(high.matchedTier.min, 100000)
})

test('佣金：计佣基数不大于 0 时不计提', () => {
  const result = computeCommission({ type: 'RATE', rate: 0.05 }, { orderAmount: 1000, returnAmount: 1000 })
  assert.equal(result.commissionAmount, 0)
  assert.match(result.reason, /基数/)
})

test('佣金规则生效期：起止日期区间校验', () => {
  assert.equal(isRuleEffective({ effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31', status: 'ACTIVE' }, '2026-06-01'), true)
  assert.equal(isRuleEffective({ effectiveFrom: '2026-01-01', effectiveTo: '2026-12-31', status: 'ACTIVE' }, '2025-12-31'), false)
  assert.equal(isRuleEffective({ status: 'DISABLED' }, '2026-06-01'), false)
})

test('佣金记录状态机：待确认→已确认→已发放', () => {
  assert.equal(canTransitionCommission('PENDING', 'CONFIRMED').allowed, true)
  assert.equal(canTransitionCommission('CONFIRMED', 'PAID').allowed, true)
  assert.equal(canTransitionCommission('PAID', 'CONFIRMED').allowed, false)
})

test('投诉 SLA：不同严重级别时限不同且可判定超时', () => {
  const now = new Date('2026-01-10T00:00:00Z')
  const urgent = evaluateComplaintSla({
    status: 'OPEN',
    createdAt: '2026-01-01T00:00:00Z',
    severity: 'URGENT'
  }, now)
  assert.equal(urgent.dueHours, 8)
  assert.equal(urgent.overdue, true)
  // 已历时 216 小时，超出 8 小时承诺时限即逾期 208 小时
  assert.equal(urgent.overdueHours, 208)

  const low = evaluateComplaintSla({
    status: 'OPEN',
    createdAt: '2026-01-09T00:00:00Z',
    severity: 'LOW'
  }, now)
  assert.equal(low.dueHours, 72)
  assert.equal(low.overdue, false)
})

test('投诉 SLA：已关闭工单不再判定超时', () => {
  const now = new Date('2026-01-10T00:00:00Z')
  const result = evaluateComplaintSla({
    status: 'CLOSED',
    createdAt: '2026-01-01T00:00:00Z',
    resolvedAt: '2026-01-02T00:00:00Z',
    severity: 'HIGH'
  }, now)
  assert.equal(result.closed, true)
  assert.equal(result.overdue, false)
})

test('投诉状态机：按 OPEN→PROCESSING→RESOLVED→CLOSED 流转', () => {
  assert.equal(canTransitionComplaint('OPEN', 'PROCESSING').allowed, true)
  assert.equal(canTransitionComplaint('PROCESSING', 'RESOLVED').allowed, true)
  assert.equal(canTransitionComplaint('RESOLVED', 'CLOSED').allowed, true)
  assert.equal(canTransitionComplaint('CLOSED', 'PROCESSING').allowed, false)
})

test('未发货清单：订单行减已发货并标记逾期', () => {
  const now = new Date('2026-01-20T00:00:00Z')
  const rows = buildUnshippedList([
    {
      orderId: 1, orderNo: 'SO1', customerId: 1, customerName: '客户A',
      productId: 10, productName: '商品A', orderedQty: 10, shippedQty: 4,
      orderDate: '2026-01-01', promisedDate: '2026-01-08'
    },
    {
      orderId: 2, orderNo: 'SO2', customerId: 1, customerName: '客户A',
      productId: 11, productName: '商品B', orderedQty: 5, shippedQty: 5,
      orderDate: '2026-01-01', promisedDate: '2026-01-08'
    }
  ], now)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].unshippedQty, 6)
  assert.equal(rows[0].overdue, true)
})

test('承诺交期：订单日期后默认 7 天', () => {
  assert.equal(resolvePromisedDate('2026-01-01'), '2026-01-08')
  assert.equal(resolvePromisedDate('2026-01-01', 3), '2026-01-04')
})

test('退货率：退货金额除以销售金额', () => {
  const result = computeReturnRate(200000, 10000)
  assert.equal(result.percent, '5.00%')
  assert.equal(result.rate, 0.05)
  assert.equal(computeReturnRate(0, 100).percent, '0.00%')
})
