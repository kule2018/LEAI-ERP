import test from 'node:test'
import assert from 'node:assert/strict'
import {
  analyzeFlowBottlenecks,
  analyzeFlowDuration,
  analyzeFlowTimeouts,
  flowInstanceDurationHours
} from '../apps/server/dist/common/flow-monitor-engine.js'

const HOUR = 3600000
const base = new Date('2026-11-23T00:00:00Z').getTime()

test('流程耗时：已完结取结束时长，进行中取当前等待时长', () => {
  const finished = { id: 1, bizType: 'PURCHASE', bizNo: 'PO-1', status: 'DONE', startedAt: base, finishedAt: base + 4 * HOUR, currentNodeId: null }
  assert.equal(flowInstanceDurationHours(finished, base + 10 * HOUR), 4)
  const running = { ...finished, status: 'RUNNING', finishedAt: null }
  assert.equal(flowInstanceDurationHours(running, base + 10 * HOUR), 10)
  assert.equal(flowInstanceDurationHours({ ...finished, startedAt: null }, base), null)
})

test('耗时分析给出整体概览与按类型分布', () => {
  const instances = [
    { id: 1, bizType: 'PURCHASE', bizNo: 'PO-1', status: 'DONE', startedAt: base, finishedAt: base + 2 * HOUR, currentNodeId: null },
    { id: 2, bizType: 'PURCHASE', bizNo: 'PO-2', status: 'DONE', startedAt: base, finishedAt: base + 4 * HOUR, currentNodeId: null },
    { id: 3, bizType: 'SALES', bizNo: 'SO-1', status: 'RUNNING', startedAt: base, finishedAt: null, currentNodeId: 1 }
  ]
  const { summary, byType } = analyzeFlowDuration(instances, base + 10 * HOUR)
  assert.equal(summary.total, 3)
  assert.equal(summary.finished, 2)
  assert.equal(summary.running, 1)
  assert.equal(summary.avgDurationHours, 3)
  assert.equal(summary.maxDurationHours, 4)
  assert.equal(byType[0].bizType, 'PURCHASE')
  assert.equal(byType[0].avgDurationHours, 3)
})

test('瓶颈节点按平均处理耗时倒序排行', () => {
  const tasks = [
    { instanceId: 1, nodeId: 10, assigneeId: 1, status: 'APPROVED', createdAt: base, actedAt: base + 1 * HOUR, dueAt: null },
    { instanceId: 2, nodeId: 10, assigneeId: 2, status: 'APPROVED', createdAt: base, actedAt: base + 3 * HOUR, dueAt: null },
    { instanceId: 3, nodeId: 20, assigneeId: 3, status: 'APPROVED', createdAt: base, actedAt: base + 0.5 * HOUR, dueAt: null }
  ]
  const nodes = [{ id: 10, nodeName: '财务审核', timeoutHours: 24 }, { id: 20, nodeName: '仓库确认', timeoutHours: 8 }]
  const result = analyzeFlowBottlenecks(tasks, nodes)
  assert.equal(result[0].nodeName, '财务审核')
  assert.equal(result[0].taskCount, 2)
  assert.equal(result[0].avgDurationHours, 2)
  assert.equal(result[0].maxDurationHours, 3)
  assert.equal(result[1].nodeName, '仓库确认')
})

test('超时排行：超过节点时限或超过截止时间的待办任务被列出', () => {
  const instances = [{ id: 1, bizType: 'PURCHASE', bizNo: 'PO-9', status: 'RUNNING', startedAt: base, finishedAt: null, currentNodeId: 10 }]
  const tasks = [
    { instanceId: 1, nodeId: 10, assigneeId: 7, status: 'PENDING', createdAt: base, actedAt: null, dueAt: null },
    { instanceId: 1, nodeId: 20, assigneeId: 8, status: 'PENDING', createdAt: base, actedAt: null, dueAt: base + 1 * HOUR },
    { instanceId: 1, nodeId: 30, assigneeId: 9, status: 'APPROVED', createdAt: base, actedAt: base + 1 * HOUR, dueAt: null }
  ]
  const nodes = [
    { id: 10, nodeName: '财务审核', timeoutHours: 4 },
    { id: 20, nodeName: '仓库确认', timeoutHours: 48 },
    { id: 30, nodeName: '已办节点', timeoutHours: 1 }
  ]
  const rows = analyzeFlowTimeouts(instances, tasks, nodes, base + 10 * HOUR)
  assert.equal(rows.length, 2)
  // 按超时时长倒序：超过截止时间的 9 小时排在超过节点时限的 6 小时之前
  assert.equal(rows[0].nodeName, '仓库确认')
  assert.equal(rows[0].overdueHours, 9)
  assert.equal(rows[1].nodeName, '财务审核')
  assert.equal(rows[1].bizNo, 'PO-9')
  assert.equal(rows[1].overdueHours, 6)
})

test('未超时的待办任务不进入超时排行', () => {
  const instances = [{ id: 1, bizType: 'SALES', bizNo: 'SO-1', status: 'RUNNING', startedAt: base, finishedAt: null, currentNodeId: 10 }]
  const tasks = [{ instanceId: 1, nodeId: 10, assigneeId: 7, status: 'PENDING', createdAt: base, actedAt: null, dueAt: null }]
  const nodes = [{ id: 10, nodeName: '审核', timeoutHours: 48 }]
  assert.equal(analyzeFlowTimeouts(instances, tasks, nodes, base + 2 * HOUR).length, 0)
})
