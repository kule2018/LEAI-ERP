import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildRecalculationPlan,
  canExecuteCostJob,
  canRetryCostJob,
  evaluateJobProgress,
  recalculateProductCost,
  resolveJobError,
  summarizeRecalculation
} from '../apps/server/dist/common/cost-recalculation-rules.js'

test('成本重算：移动加权按期初金额加发生额计算期末成本', () => {
  const result = recalculateProductCost({
    productId: 1,
    method: 'MOVING_WEIGHTED',
    openingQty: 10,
    openingAmount: 50,
    closingQty: 12,
    movements: [
      { qtyIn: 5, qtyOut: 0, unitCost: 6 },
      { qtyIn: 0, qtyOut: 3, unitCost: 6 }
    ],
    bookAmount: 50
  })
  assert.equal(result.inQty, 5)
  assert.equal(result.outQty, 3)
  assert.equal(result.inAmount, 30)
  assert.equal(result.outAmount, 18)
  assert.equal(result.closingQty, 12)
  assert.equal(result.closingAmount, 62)
  assert.equal(result.unitCost, 5.1667)
  assert.equal(result.diffAmount, 12)
  assert.equal(result.changed, true)
})

test('成本重算：先进先出按成本层消耗出库成本', () => {
  const result = recalculateProductCost({
    productId: 2,
    method: 'FIFO',
    openingQty: 0,
    openingAmount: 0,
    closingQty: 4,
    movements: [{ qtyIn: 10, qtyOut: 6, unitCost: 0 }],
    layers: [
      { id: 1, qtyAvailable: 10, unitCost: 4, occurredAt: '2026-01-01T00:00:00.000Z' },
      { id: 2, qtyAvailable: 0, unitCost: 9, occurredAt: '2026-01-02T00:00:00.000Z' }
    ]
  })
  assert.equal(result.outAmount, 24)
  assert.equal(result.inAmount, 0)
  assert.equal(result.closingAmount, -24)
})

test('成本重算：与账面一致时标记无差异', () => {
  const result = recalculateProductCost({
    productId: 3,
    method: 'MOVING_WEIGHTED',
    openingQty: 10,
    openingAmount: 50,
    closingQty: 10,
    movements: [],
    bookAmount: 50
  })
  assert.equal(result.diffAmount, 0)
  assert.equal(result.changed, false)
})

test('成本重算：批量重算返回全部产品结果', () => {
  const plan = buildRecalculationPlan([
    { productId: 1, method: 'MOVING_WEIGHTED', openingQty: 1, openingAmount: 10, closingQty: 1, movements: [] },
    { productId: 2, method: 'MOVING_WEIGHTED', openingQty: 2, openingAmount: 20, closingQty: 2, movements: [] }
  ])
  assert.equal(plan.length, 2)
  assert.equal(plan[1].closingAmount, 20)
})

test('成本重算：进度按处理项占比计算', () => {
  assert.equal(evaluateJobProgress(0, 10), 0)
  assert.equal(evaluateJobProgress(5, 10), 50)
  assert.equal(evaluateJobProgress(10, 10), 100)
  assert.equal(evaluateJobProgress(3, 0), 100)
})

test('成本重算：仅待执行任务可执行、仅失败任务可重试', () => {
  assert.equal(canExecuteCostJob('PENDING'), true)
  assert.equal(canExecuteCostJob('DONE'), false)
  assert.equal(canRetryCostJob('FAILED'), true)
  assert.equal(canRetryCostJob('PENDING'), false)
})

test('成本重算：失败信息截断到 1000 字符', () => {
  const message = resolveJobError(new Error('x'.repeat(1200)))
  assert.equal(message.length, 1000)
  assert.equal(resolveJobError(new Error('boom')), 'boom')
})

test('成本重算：汇总差异产品数量与金额', () => {
  const results = [
    recalculateProductCost({ productId: 1, method: 'MOVING_WEIGHTED', openingQty: 1, openingAmount: 10, closingQty: 1, movements: [], bookAmount: 8 }),
    recalculateProductCost({ productId: 2, method: 'MOVING_WEIGHTED', openingQty: 1, openingAmount: 10, closingQty: 1, movements: [], bookAmount: 10 })
  ]
  const summary = summarizeRecalculation(results)
  assert.equal(summary.productCount, 2)
  assert.equal(summary.changedCount, 1)
  assert.equal(summary.totalDiffAmount, 2)
})
