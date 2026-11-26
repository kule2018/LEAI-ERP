import test from 'node:test'
import assert from 'node:assert/strict'
import {
  convertAmount, reverseRate, toBaseCurrency, needsRateApproval, isValidCurrency
} from '../apps/server/dist/common/currency-engine.js'

test('金额换算', () => {
  assert.equal(convertAmount(100, 7.2), 720)
  assert.equal(convertAmount(100, 0), 0)
})

test('反向汇率', () => {
  assert.equal(reverseRate(2), 0.5)
  assert.equal(reverseRate(0), 0)
})

test('本位币汇总', () => {
  const total = toBaseCurrency([
    { amount: 100, rate: 7.2 },
    { amount: 200, rate: 1 }
  ])
  assert.equal(total, 920)
})

test('汇率变更超过阈值需审批', () => {
  assert.equal(needsRateApproval(7.2, 7.3), false)
  assert.equal(needsRateApproval(7.2, 8.0), true)
  assert.equal(needsRateApproval(0, 7.2), true)
})

test('币种代码校验', () => {
  assert.equal(isValidCurrency('CNY'), true)
  assert.equal(isValidCurrency('usd'), true)
  assert.equal(isValidCurrency('XXX'), false)
})
