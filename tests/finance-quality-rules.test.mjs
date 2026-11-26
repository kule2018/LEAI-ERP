import test from 'node:test'
import assert from 'node:assert/strict'
import {
  samplingPlan, judgeSampling, canConcession, reconcileBalance, matchInvoice, evaluateCloseChecks
} from '../apps/server/dist/common/finance-quality-rules.js'

// 抽样
test('抽样计划：批量分段', () => {
  assert.equal(samplingPlan(0).sampleQty, 0)
  assert.equal(samplingPlan(50).sampleQty, 5)
  assert.equal(samplingPlan(100).sampleQty, 20)
  assert.equal(samplingPlan(1000).sampleQty, 50)
})

test('抽样计划：加严放宽', () => {
  assert.ok(samplingPlan(100, 'STRICT').sampleQty > samplingPlan(100, 'NORMAL').sampleQty)
  assert.ok(samplingPlan(100, 'LOOSE').sampleQty < samplingPlan(100, 'NORMAL').sampleQty)
})

test('抽检判定：不良数在允收内通过', () => {
  assert.equal(judgeSampling(1, 1), 'PASS')
  assert.equal(judgeSampling(2, 1), 'FAIL')
})

// 让步接收
test('让步接收：仅不合格且需审批人', () => {
  assert.equal(canConcession('PASS', 1, false).ok, false)
  assert.equal(canConcession('FAIL', null, false).ok, false)
  assert.equal(canConcession('FAIL', 1, true).ok, false)
  assert.equal(canConcession('FAIL', 1, false).ok, true)
})

// 余额调节
test('余额调节：未达账项调节后平衡', () => {
  const result = reconcileBalance(1000, 1100, 200, 100)
  assert.equal(result.adjustedBook, 1100)
  assert.equal(result.balanced, true)
})

test('余额调节：差额不为零', () => {
  assert.equal(reconcileBalance(1000, 1100, 0, 0).balanced, false)
})

// 发票勾稽
test('发票勾稽：含税金额一致通过', () => {
  assert.equal(matchInvoice(100, 13, 113).matched, true)
})

test('发票勾稽：金额不符', () => {
  const result = matchInvoice(100, 13, 120)
  assert.equal(result.matched, false)
  assert.equal(result.difference, -7)
})

// 月结检查
test('月结检查：全部通过', () => {
  assert.deepEqual(evaluateCloseChecks([
    { name: '无未过账凭证', passed: true },
    { name: '试算平衡', passed: true }
  ]), { ok: true, failures: [] })
})

test('月结检查：列出失败项', () => {
  const result = evaluateCloseChecks([
    { name: '无未过账凭证', passed: false, detail: '3 张草稿' },
    { name: '试算平衡', passed: true }
  ])
  assert.equal(result.ok, false)
  assert.equal(result.failures[0], '无未过账凭证：3 张草稿')
})
