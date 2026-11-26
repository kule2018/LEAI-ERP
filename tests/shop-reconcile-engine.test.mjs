import test from 'node:test'
import assert from 'node:assert/strict'
import {
  compareAmounts, checkRefundEligibility, canTransitionRefund, allocateRefundAmount
} from '../apps/server/dist/common/shop-reconcile-engine.js'

test('金额一致与容差内差异判定为成功', () => {
  assert.deepEqual(compareAmounts(100, 100), { status: 'SUCCESS', diff: 0 })
  assert.equal(compareAmounts(100.005, 100).status, 'SUCCESS')
})

test('金额差异标记 DIFF 并给出方向', () => {
  const result = compareAmounts(120, 100)
  assert.equal(result.status, 'DIFF')
  assert.equal(result.diff, 20)
  assert.match(result.reason, /平台金额大于/)
})

test('无效金额需要人工确认', () => {
  assert.equal(compareAmounts(Number.NaN, 100).status, 'PENDING')
})

test('退款资格校验金额与已退金额', () => {
  const base = { orderAmount: 200, paidAmount: 200, refundedAmount: 0, amount: 50, orderStatus: 'SYNCED' }
  assert.equal(checkRefundEligibility(base).allowed, true)
  assert.equal(checkRefundEligibility({ ...base, amount: 201 }).allowed, false)
  assert.equal(checkRefundEligibility({ ...base, refundedAmount: 180 }).allowed, false)
  assert.equal(checkRefundEligibility({ ...base, paidAmount: 0 }).allowed, false)
})

test('退款状态机只允许提交后审批或驳回', () => {
  assert.equal(canTransitionRefund('SUBMITTED', 'APPROVED'), true)
  assert.equal(canTransitionRefund('SUBMITTED', 'REJECTED'), true)
  assert.equal(canTransitionRefund('APPROVED', 'SUBMITTED'), false)
  assert.equal(canTransitionRefund('REJECTED', 'APPROVED'), false)
})

test('退款金额按行金额比例分摊', () => {
  const result = allocateRefundAmount([
    { qty: 2, unitPrice: 100 },
    { qty: 1, unitPrice: 100 }
  ], 30)
  assert.deepEqual(result.map((item) => item.amount), [20, 10])
  assert.equal(result.reduce((sum, item) => sum + item.payable, 0), 270)
})

test('无有效退款金额时按原价返回', () => {
  const result = allocateRefundAmount([{ qty: 1, unitPrice: 50 }], 0)
  assert.equal(result[0].amount, 0)
  assert.equal(result[0].payable, 50)
})
