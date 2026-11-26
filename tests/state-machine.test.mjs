import test from 'node:test'
import assert from 'node:assert/strict'
import { assertTransition, canTransition } from '../apps/server/dist/common/state-machine.js'

test('销售单允许草稿到提交再到审批', () => {
  assert.equal(canTransition('sale_order', 'DRAFT', 'SUBMITTED'), true)
  assert.equal(canTransition('sale_order', 'SUBMITTED', 'APPROVED'), true)
})

test('销售单禁止跳过提交直接审批', () => {
  assert.equal(canTransition('sale_order', 'DRAFT', 'APPROVED'), false)
  assert.throws(() => assertTransition('sale_order', 'DRAFT', 'APPROVED'), /不允许从 DRAFT 流转到 APPROVED/)
})

test('未知业务类型禁止流转', () => {
  assert.equal(canTransition('unknown', 'DRAFT', 'SUBMITTED'), false)
})
