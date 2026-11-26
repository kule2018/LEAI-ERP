import test from 'node:test'
import assert from 'node:assert/strict'
import { buildInventoryMovementReport } from '../apps/server/dist/common/inventory-costing-rules.js'

test('存货收发存：按移动加权计算期末数量金额与均价', () => {
  const report = buildInventoryMovementReport([
    { productId: 1, productName: '甲产品', openingQty: 10, openingAmount: 100, inQty: 5, inAmount: 60, outQty: 12, outAmount: 130 }
  ])
  const row = report.rows[0]
  assert.equal(row.openingAvgCost, 10)
  assert.equal(row.closingQty, 3)
  assert.equal(row.closingAmount, 30)
  assert.equal(row.closingAvgCost, 10)
  assert.equal(report.totals.closingAmount, 30)
})

test('存货收发存：与存货科目余额对账差异', () => {
  const report = buildInventoryMovementReport(
    [{ productId: 1, productName: '甲产品', openingQty: 10, openingAmount: 100, inQty: 0, inAmount: 0, outQty: 0, outAmount: 0 }],
    95
  )
  assert.equal(report.difference, -5)
  assert.equal(report.reconciled, false)
})

test('存货收发存：科目余额一致时判定为已对账', () => {
  const report = buildInventoryMovementReport(
    [{ productId: 1, productName: '甲产品', openingQty: 10, openingAmount: 100, inQty: 0, inAmount: 0, outQty: 0, outAmount: 0 }],
    100
  )
  assert.equal(report.difference, 0)
  assert.equal(report.reconciled, true)
})
