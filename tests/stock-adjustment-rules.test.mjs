import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canCancelAdjustment,
  canPostAdjustment,
  validateAdjustmentLines
} from '../apps/server/dist/common/stock-adjustment-rules.js'

test('调整单：数量为零直接报错', () => {
  const result = validateAdjustmentLines([{ productId: 1, qty: 0 }])
  assert.equal(result.passed, false)
  assert.equal(result.violations[0].code, 'QTY_ZERO')
})

test('调整单：盘盈必须填写成本', () => {
  const result = validateAdjustmentLines([{ productId: 1, qty: 5 }])
  assert.equal(result.passed, false)
  assert.equal(result.violations[0].code, 'COST_MISSING')
})

test('调整单：盘亏超过可用库存被拦截', () => {
  const result = validateAdjustmentLines([{ productId: 1, qty: -8, availableQty: 5, availableCost: 10 }])
  assert.equal(result.passed, false)
  assert.equal(result.violations[0].code, 'STOCK_SHORTAGE')
})

test('调整单：盘亏成本高于账面成本给出警告但可过账', () => {
  const result = validateAdjustmentLines([{ productId: 1, qty: -2, cost: 12, availableQty: 10, availableCost: 10 }])
  assert.equal(result.passed, true)
  assert.equal(result.violations[0].code, 'COST_EXCEED')
  assert.equal(result.violations[0].level, 'WARN')
})

test('调整单：盘盈盘亏汇总与过账分录生成', () => {
  const result = validateAdjustmentLines([
    { productId: 1, qty: 5, cost: 4 },
    { productId: 2, qty: -2, availableQty: 10, availableCost: 6 }
  ])
  assert.equal(result.passed, true)
  assert.equal(result.totalQtyIn, 5)
  assert.equal(result.totalQtyOut, 2)
  assert.equal(result.totalAmount, 32)
  assert.equal(result.postings.length, 2)
  assert.equal(result.postings[0].qtyIn, 5)
  assert.equal(result.postings[0].qtyOut, 0)
  assert.equal(result.postings[1].qtyOut, 2)
})

test('调整单状态机：仅草稿可过账与作废', () => {
  assert.equal(canPostAdjustment('DRAFT'), true)
  assert.equal(canPostAdjustment('POSTED'), false)
  assert.equal(canCancelAdjustment('DRAFT'), true)
  assert.equal(canCancelAdjustment('CANCELLED'), false)
})
