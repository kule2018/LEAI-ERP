import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateCondition, selectConditionalNodes } from '../apps/server/dist/common/condition-engine.js'

test('空表达式默认匹配', () => {
  assert.equal(evaluateCondition(null, {}).matched, true)
  assert.equal(evaluateCondition('  ', {}).matched, true)
})

test('相等/不等比较', () => {
  assert.equal(evaluateCondition("status == 'SUBMITTED'", { status: 'SUBMITTED' }).matched, true)
  assert.equal(evaluateCondition("status != 'DRAFT'", { status: 'SUBMITTED' }).matched, true)
  assert.equal(evaluateCondition("status == 'DRAFT'", { status: 'SUBMITTED' }).matched, false)
})

test('数值比较', () => {
  assert.equal(evaluateCondition('amount >= 1000', { amount: 1500 }).matched, true)
  assert.equal(evaluateCondition('amount < 1000', { amount: 1500 }).matched, false)
  assert.equal(evaluateCondition('qty > 10 && price <= 50', { qty: 20, price: 40 }).matched, true)
})

test('contains / in', () => {
  assert.equal(evaluateCondition("region contains '华'", { region: '华东' }).matched, true)
  assert.equal(evaluateCondition("level in ['A','B']", { level: 'B' }).matched, true)
})

test('|| 或组合', () => {
  assert.equal(evaluateCondition("amount > 5000 || level == 'VIP'", { amount: 100, level: 'VIP' }).matched, true)
  assert.equal(evaluateCondition("amount > 5000 || level == 'VIP'", { amount: 100, level: 'NORMAL' }).matched, false)
})

test('字段缺失返回错误', () => {
  const result = evaluateCondition('amount > 100', {})
  assert.equal(result.matched, false)
  assert.ok(result.error?.includes('不存在'))
})

test('条件节点筛选：兜底节点始终返回', () => {
  const nodes = [
    { code: 'high', conditionExpr: 'amount >= 1000' },
    { code: 'vip', conditionExpr: "level == 'VIP'" },
    { code: 'default', conditionExpr: null }
  ]
  const selected = selectConditionalNodes(nodes, { amount: 1500, level: 'NORMAL' })
  assert.deepEqual(selected.map((n) => n.code), ['high', 'default'])
})
