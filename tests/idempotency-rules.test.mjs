import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveIdempotentRecord } from '../apps/server/dist/common/idempotency-rules.js'

test('幂等记录已完成时回放首次执行结果', () => {
  const decision = resolveIdempotentRecord(JSON.stringify({ status: 'DONE', payload: { id: 12, orderNo: 'SO-1' } }))
  assert.equal(decision.action, 'replay')
  assert.deepEqual(decision.payload, { id: 12, orderNo: 'SO-1' })
})

test('幂等记录已完成但无结果时提示人工核对', () => {
  const decision = resolveIdempotentRecord(JSON.stringify({ status: 'DONE' }))
  assert.equal(decision.action, 'conflict')
  assert.match(decision.message, /此前已提交/)
})

test('幂等记录处理中时提示稍后确认', () => {
  const decision = resolveIdempotentRecord(JSON.stringify({ status: 'PENDING' }))
  assert.equal(decision.action, 'processing')
  assert.match(decision.message, /处理中/)
})

test('幂等记录缺失或非法时按重复提交处理', () => {
  assert.equal(resolveIdempotentRecord(null).action, 'conflict')
  assert.equal(resolveIdempotentRecord('not-json').action, 'conflict')
})
