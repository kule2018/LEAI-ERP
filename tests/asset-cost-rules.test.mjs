import test from 'node:test'
import assert from 'node:assert/strict'
import {
  computeOee, maintenanceDue, allocateByProductCost, allocateLandedCost,
  canTransitionCostJob, assetStocktakeDiff
} from '../apps/server/dist/common/asset-cost-rules.js'

// OEE
test('OEE：百分比输入归一化', () => {
  assert.equal(computeOee(90, 80, 100), 0.72)
})

test('OEE：0~1 输入直接计算', () => {
  assert.equal(computeOee(0.9, 0.8, 1), 0.72)
})

// 保养到期
test('保养到期：未到期与到期', () => {
  const now = new Date('2026-06-01T00:00:00Z')
  assert.equal(maintenanceDue('2026-05-01', 60, now).due, false)
  const due = maintenanceDue('2026-05-01', 30, now)
  assert.equal(due.due, true)
  assert.equal(due.overdueDays, 1)
})

test('保养到期：无记录或周期无效不提醒', () => {
  assert.equal(maintenanceDue(null, 30).due, false)
  assert.equal(maintenanceDue('2026-05-01', 0).due, false)
})

// 联副产品
test('联副产品成本分摊', () => {
  const result = allocateByProductCost(1000, [
    { productId: 2, qty: 10, unitCost: 20 },
    { productId: 3, qty: 5, unitCost: 10 }
  ])
  assert.equal(result.netMainCost, 750)
  assert.equal(result.byProductValues[0].value, 200)
  assert.equal(result.byProductValues[1].value, 50)
})

// 采购成本分摊
test('采购落地成本按数量权重分摊', () => {
  const result = allocateLandedCost([
    { id: 1, qty: 30, amount: 300 },
    { id: 2, qty: 70, amount: 700 }
  ], 100)
  assert.equal(result[0].allocatedCost, 30)
  assert.equal(result[1].allocatedCost, 70)
})

test('采购成本分摊：数量为 0 不分摊', () => {
  assert.equal(allocateLandedCost([{ id: 1, qty: 0, amount: 0 }], 100)[0].allocatedCost, 0)
})

// 成本重算状态机
test('成本重算状态机：合法流转', () => {
  assert.equal(canTransitionCostJob('PENDING', 'RUNNING'), true)
  assert.equal(canTransitionCostJob('RUNNING', 'DONE'), true)
  assert.equal(canTransitionCostJob('FAILED', 'PENDING'), true)
})

test('成本重算状态机：非法流转', () => {
  assert.equal(canTransitionCostJob('PENDING', 'DONE'), false)
  assert.equal(canTransitionCostJob('DONE', 'RUNNING'), false)
})

// 资产盘点
test('资产盘点差异', () => {
  assert.equal(assetStocktakeDiff(10, 12), 2)
  assert.equal(assetStocktakeDiff(10, 8), -2)
})
