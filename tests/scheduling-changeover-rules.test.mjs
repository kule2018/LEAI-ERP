import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cascadeAfterMove,
  computeGanttRows,
  detectTaskOverlaps,
  matchChangeoverMinutes,
  toTime
} from '../apps/server/dist/common/scheduling-changeover-rules.js'

const task = (over) => ({
  id: 0,
  taskName: 'task',
  workCenterId: 1,
  workOrderId: 1,
  productId: 1,
  startAt: '2026-01-01T08:00:00.000Z',
  endAt: '2026-01-01T10:00:00.000Z',
  locked: false,
  status: 'PLANNED',
  ...over
})

test('换线规则：优先命中工作中心+产品对的精确规则', () => {
  const rules = [
    { id: 1, workCenterId: null, fromProductId: null, toProductId: null, minutes: 10 },
    { id: 2, workCenterId: 1, fromProductId: null, toProductId: null, minutes: 20 },
    { id: 3, workCenterId: 1, fromProductId: 1, toProductId: 2, minutes: 35 }
  ]
  const minutes = matchChangeoverMinutes(rules, { workCenterId: 1, fromProductId: 1, toProductId: 2 })
  assert.equal(minutes, 35)
})

test('换线规则：同产品切换不产生换线时间', () => {
  const minutes = matchChangeoverMinutes(
    [{ id: 1, workCenterId: 1, fromProductId: 2, toProductId: 2, minutes: 40 }],
    { workCenterId: 1, fromProductId: 2, toProductId: 2 }
  )
  assert.equal(minutes, 0)
})

test('换线规则：无匹配时使用兜底时间', () => {
  const minutes = matchChangeoverMinutes([], { workCenterId: 1, fromProductId: 1, toProductId: 2 }, 15)
  assert.equal(minutes, 15)
})

test('甘特：后一任务自动累加换线时间', () => {
  const rows = computeGanttRows([
    task({ id: 1, productId: 1, startAt: '2026-01-01T08:00:00.000Z', endAt: '2026-01-01T10:00:00.000Z' }),
    task({ id: 2, productId: 2, startAt: '2026-01-01T10:00:00.000Z', endAt: '2026-01-01T12:00:00.000Z' })
  ], [{ id: 1, workCenterId: 1, fromProductId: 1, toProductId: 2, minutes: 30 }])
  assert.equal(rows[1].changeoverMinutes, 30)
  assert.equal(toTime(rows[1].startAt) - toTime(rows[0].endAt), 30 * 60000)
})

test('甘特：同工作中心时间重叠标记为冲突', () => {
  const rows = computeGanttRows([
    task({ id: 1, startAt: '2026-01-01T08:00:00.000Z', endAt: '2026-01-01T10:00:00.000Z' }),
    task({ id: 2, startAt: '2026-01-01T09:00:00.000Z', endAt: '2026-01-01T11:00:00.000Z' })
  ])
  assert.equal(rows[0].conflict, true)
  assert.equal(rows[1].conflict, true)
})

test('冲突检测：不同工作中心之间不判冲突', () => {
  const overlaps = detectTaskOverlaps([
    task({ id: 1, workCenterId: 1, startAt: '2026-01-01T08:00:00.000Z', endAt: '2026-01-01T10:00:00.000Z' }),
    task({ id: 2, workCenterId: 2, startAt: '2026-01-01T09:00:00.000Z', endAt: '2026-01-01T11:00:00.000Z' })
  ])
  assert.equal(overlaps.length, 0)
})

test('拖拽改期：同工作中心后续任务级联顺延', () => {
  const tasks = [
    task({ id: 1, startAt: '2026-01-01T08:00:00.000Z', endAt: '2026-01-01T10:00:00.000Z' }),
    task({ id: 2, startAt: '2026-01-01T10:00:00.000Z', endAt: '2026-01-01T12:00:00.000Z' })
  ]
  const result = cascadeAfterMove(tasks, 1, '2026-01-01T09:00:00.000Z', '2026-01-01T11:00:00.000Z')
  assert.equal(result.shifted.length, 1)
  assert.equal(result.shifted[0].id, 2)
  assert.equal(result.shifted[0].deltaMinutes, 60)
})

test('拖拽改期：锁定任务不参与顺延', () => {
  const tasks = [
    task({ id: 1, startAt: '2026-01-01T08:00:00.000Z', endAt: '2026-01-01T10:00:00.000Z' }),
    task({ id: 2, locked: true, startAt: '2026-01-01T10:00:00.000Z', endAt: '2026-01-01T12:00:00.000Z' })
  ]
  const result = cascadeAfterMove(tasks, 1, '2026-01-01T09:00:00.000Z', '2026-01-01T11:00:00.000Z')
  assert.equal(result.shifted.length, 0)
})
