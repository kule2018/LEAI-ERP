import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canApproveStocktakeDiff,
  canRejectStocktakeDiff,
  canSubmitStocktakeApproval,
  evaluateStocktakeApproval,
  summarizeStocktakeDiff
} from '../apps/server/dist/common/stocktake-approval-rules.js'

const lines = [
  { productId: 1, bookQty: 10, actualQty: 12, recountQty: null, diffQty: 2, unitCost: 5 },
  { productId: 2, bookQty: 20, actualQty: 18, recountQty: null, diffQty: -2, unitCost: 3 },
  { productId: 3, bookQty: 5, actualQty: 5, recountQty: null, diffQty: 0, unitCost: 2 }
]

test('盘点差异：汇总盘盈盘亏数量与金额', () => {
  const summary = summarizeStocktakeDiff(lines)
  assert.equal(summary.totalLines, 3)
  assert.equal(summary.diffLines, 2)
  assert.equal(summary.gainQty, 2)
  assert.equal(summary.lossQty, 2)
  assert.equal(summary.gainAmount, 10)
  assert.equal(summary.lossAmount, 6)
  assert.equal(summary.netQty, 0)
  assert.equal(summary.netAmount, 4)
  assert.equal(summary.maxAbsDiffQty, 2)
})

test('盘点差异：容差内的差异不计入差异行', () => {
  const summary = summarizeStocktakeDiff(
    [{ productId: 1, bookQty: 10, actualQty: 10.5, recountQty: null, diffQty: 0.5, unitCost: 4 }],
    1
  )
  assert.equal(summary.diffLines, 0)
  assert.equal(summary.gainQty, 0)
})

test('盘点差异：无差异时无需审批可直接过账', () => {
  const evaluation = evaluateStocktakeApproval({
    status: 'COUNTING',
    blindMode: false,
    lines: [{ productId: 1, bookQty: 5, actualQty: 5, recountQty: null, diffQty: 0 }]
  })
  assert.equal(evaluation.ok, true)
  assert.equal(evaluation.needApproval, false)
})

test('盘点差异：存在差异时必须提交审批', () => {
  const evaluation = evaluateStocktakeApproval({ status: 'COUNTING', blindMode: false, lines })
  assert.equal(evaluation.ok, true)
  assert.equal(evaluation.needApproval, true)
  assert.equal(evaluation.summary.diffLines, 2)
})

test('盘点差异：盲盘未复盘不允许提交审批', () => {
  const evaluation = evaluateStocktakeApproval({ status: 'COUNTING', blindMode: true, lines })
  assert.equal(evaluation.ok, false)
  assert.match(evaluation.reason, /复盘/)
})

test('盘点差异：审批中/已过账状态不允许再次提交审批', () => {
  assert.equal(canSubmitStocktakeApproval('PENDING_APPROVAL'), false)
  assert.equal(canSubmitStocktakeApproval('DONE'), false)
  assert.equal(canSubmitStocktakeApproval('REJECTED'), true)
  assert.equal(canApproveStocktakeDiff('PENDING_APPROVAL'), true)
  assert.equal(canApproveStocktakeDiff('COUNTING'), false)
  assert.equal(canRejectStocktakeDiff('PENDING_APPROVAL'), true)
  assert.equal(canRejectStocktakeDiff('DONE'), false)
})

test('盘点差异：无明细不允许提交审批', () => {
  const evaluation = evaluateStocktakeApproval({ status: 'DRAFT', blindMode: false, lines: [] })
  assert.equal(evaluation.ok, false)
  assert.match(evaluation.reason, /明细/)
})
