import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MATCH_STATUS, threeWayMatch, checkKitting, provisionalReversal, canTransitionTransfer, canUnpost
} from '../apps/server/dist/common/business-closure-engine.js'

// 三方匹配
test('三方匹配：数量价格一致通过', () => {
  const result = threeWayMatch({ orderQty: 100, orderPrice: 10, receiptQty: 100, invoiceQty: 100, invoicePrice: 10 })
  assert.equal(result.status, MATCH_STATUS.MATCHED)
  assert.equal(result.matched, true)
})

test('三方匹配：缺收货/发票', () => {
  const result = threeWayMatch({ orderQty: 100, orderPrice: 10, receiptQty: 0, invoiceQty: 100, invoicePrice: 10 })
  assert.equal(result.status, MATCH_STATUS.MISSING)
  assert.equal(result.matched, false)
  assert.ok(result.issues.some((i) => i.includes('无收货')))
})

test('三方匹配：数量差异', () => {
  const result = threeWayMatch({ orderQty: 100, orderPrice: 10, receiptQty: 90, invoiceQty: 90, invoicePrice: 10 })
  assert.equal(result.status, MATCH_STATUS.QUANTITY_DIFF)
})

test('三方匹配：价格差异', () => {
  const result = threeWayMatch({ orderQty: 100, orderPrice: 10, receiptQty: 100, invoiceQty: 100, invoicePrice: 12 })
  assert.equal(result.status, MATCH_STATUS.PRICE_DIFF)
})

test('三方匹配：容差内通过', () => {
  const result = threeWayMatch({ orderQty: 100, orderPrice: 10, receiptQty: 100, invoiceQty: 100, invoicePrice: 10.005, priceTolerance: 0.01 })
  assert.equal(result.matched, true)
})

// 齐套检查
test('齐套检查：全部满足', () => {
  const result = checkKitting([
    { materialId: 1, requiredQty: 10, availableQty: 20 },
    { materialId: 2, requiredQty: 5, availableQty: 5 }
  ])
  assert.equal(result.complete, true)
  assert.equal(result.shortfalls.length, 0)
})

test('齐套检查：缺料列出差额', () => {
  const result = checkKitting([
    { materialId: 1, requiredQty: 10, availableQty: 3 },
    { materialId: 2, requiredQty: 5, availableQty: 5 }
  ])
  assert.equal(result.complete, false)
  assert.equal(result.shortfalls[0].short, 7)
})

// 暂估冲销
test('暂估冲销：金额一致无需调整', () => {
  assert.deepEqual(provisionalReversal(1000, 1000), { difference: 0, needAdjust: false })
})

test('暂估冲销：金额差异需调整', () => {
  const result = provisionalReversal(1000, 1100)
  assert.equal(result.difference, 100)
  assert.equal(result.needAdjust, true)
})

// 调拨状态机
test('调拨状态机：合法流转', () => {
  assert.equal(canTransitionTransfer('DRAFT', 'SUBMITTED'), true)
  assert.equal(canTransitionTransfer('SUBMITTED', 'IN_TRANSIT'), true)
  assert.equal(canTransitionTransfer('IN_TRANSIT', 'RECEIVED'), true)
})

test('调拨状态机：跳级拦截', () => {
  assert.equal(canTransitionTransfer('DRAFT', 'RECEIVED'), false)
  assert.equal(canTransitionTransfer('RECEIVED', 'DRAFT'), false)
})

// 反审核
test('反审核：已过账且期间未结账允许', () => {
  assert.equal(canUnpost('POSTED', false, false).ok, true)
})

test('反审核：草稿/已结账/有引用均拒绝', () => {
  assert.equal(canUnpost('DRAFT', false, false).ok, false)
  assert.equal(canUnpost('POSTED', true, false).ok, false)
  assert.equal(canUnpost('POSTED', false, true).ok, false)
})
