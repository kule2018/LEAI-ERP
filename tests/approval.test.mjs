import test from 'node:test'
import assert from 'node:assert/strict'
import {
  APPROVAL_MODE, TASK_DECISION, buildFlowSnapshot, canActOnTask, computeDueAt, evaluateNodeDecision, isOverdue
} from '../apps/server/dist/common/approval.js'

const A = TASK_DECISION.APPROVED
const R = TASK_DECISION.REJECTED

test('或签：任一同意即通过', () => {
  const decisions = [{ assigneeId: 1, decision: A }, { assigneeId: 2, decision: 'PENDING' }]
  assert.equal(evaluateNodeDecision(APPROVAL_MODE.ANY, decisions, [1, 2]), 'APPROVED')
})

test('或签：全部未处理时保持待处理', () => {
  assert.equal(evaluateNodeDecision(APPROVAL_MODE.ANY, [], [1, 2]), 'PENDING')
})

test('会签：需全部同意才通过', () => {
  const partial = [{ assigneeId: 1, decision: A }]
  assert.equal(evaluateNodeDecision(APPROVAL_MODE.ALL, partial, [1, 2]), 'PENDING')
  const full = [{ assigneeId: 1, decision: A }, { assigneeId: 2, decision: A }]
  assert.equal(evaluateNodeDecision(APPROVAL_MODE.ALL, full, [1, 2]), 'APPROVED')
})

test('顺序审批：需全部同意，与会签同语义', () => {
  const full = [{ assigneeId: 1, decision: A }, { assigneeId: 2, decision: A }]
  assert.equal(evaluateNodeDecision(APPROVAL_MODE.SEQUENTIAL, full, [1, 2]), 'APPROVED')
})

test('任一驳回立即驳回节点（会签/或签均如此）', () => {
  const decisions = [{ assigneeId: 1, decision: A }, { assigneeId: 2, decision: R }]
  assert.equal(evaluateNodeDecision(APPROVAL_MODE.ANY, decisions, [1, 2]), 'REJECTED')
  assert.equal(evaluateNodeDecision(APPROVAL_MODE.ALL, decisions, [1, 2]), 'REJECTED')
})

test('委托权限：本人或受托人可处理，其他人不可', () => {
  assert.equal(canActOnTask(1, null, 1), true)
  assert.equal(canActOnTask(1, 2, 2), true)
  assert.equal(canActOnTask(1, 2, 3), false)
  assert.equal(canActOnTask(1, null, 2), false)
})

test('流程快照固化节点模式与超时配置', () => {
  const snapshot = buildFlowSnapshot([
    { id: 5, nodeCode: 'n1', sortNo: 1, mode: 'ALL', timeoutHours: 24 }
  ])
  assert.equal(snapshot.nodes[0].mode, 'ALL')
  assert.equal(snapshot.nodes[0].timeoutHours, 24)
  assert.ok(snapshot.capturedAt)
})

test('超时时间计算与判定', () => {
  const start = new Date('2026-01-01T00:00:00Z')
  const due = computeDueAt(24, start)
  assert.equal(due.toISOString(), '2026-01-02T00:00:00.000Z')
  assert.equal(isOverdue(due, new Date('2026-01-03T00:00:00Z')), true)
  assert.equal(isOverdue(due, new Date('2026-01-01T12:00:00Z')), false)
})

test('未配置超时返回 null 且永不过期', () => {
  const due = computeDueAt(null, new Date())
  assert.equal(due, null)
  assert.equal(isOverdue(due), false)
})

test('零或负超时视为不设置', () => {
  assert.equal(computeDueAt(0, new Date()), null)
  assert.equal(computeDueAt(-1, new Date()), null)
})
