import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildWipBoard, canTransitionEquipment, computeCapacityLoad, computeProductionMetrics, computeStopLineImpact,
  detectScheduleConflicts, diffBomVersions, evaluateOverIssue, evaluateQcItems, parseScanCode, rankMrpDemands,
  splitWorkOrder
} from '../apps/server/dist/common/manufacturing-extension-engine.js'

test('BOM 版本对比输出新增、删除与变更子件', () => {
  const diff = diffBomVersions(
    [
      { materialId: 1, qty: 2, lossRate: 0 },
      { materialId: 2, qty: 5, lossRate: 1 },
      { materialId: 3, qty: 1, lossRate: 0 }
    ],
    [
      { materialId: 1, qty: 2, lossRate: 0 },
      { materialId: 2, qty: 8, lossRate: 1 },
      { materialId: 4, qty: 3, lossRate: 0 }
    ]
  )
  assert.deepEqual(diff.added.map((item) => item.materialId), [4])
  assert.deepEqual(diff.removed.map((item) => item.materialId), [3])
  assert.equal(diff.changed.length, 1)
  assert.equal(diff.changed[0].materialId, 2)
  assert.equal(diff.changed[0].before.qty, 5)
  assert.equal(diff.changed[0].after.qty, 8)
  assert.equal(diff.unchangedCount, 1)
})

test('BOM 版本对比识别替代料变更', () => {
  const diff = diffBomVersions(
    [{ materialId: 1, qty: 1, substituteMaterialId: null }],
    [{ materialId: 1, qty: 1, substituteMaterialId: 9 }]
  )
  assert.equal(diff.changedCount, 1)
  assert.equal(diff.changed[0].after.substituteMaterialId, 9)
})

test('排产冲突检测识别工作中心与工单时间重叠', () => {
  const conflicts = detectScheduleConflicts([
    { id: 1, workOrderId: 10, workCenterId: 2, startAt: '2026-03-01T08:00:00Z', endAt: '2026-03-01T12:00:00Z', status: 'PLANNED' },
    { id: 2, workOrderId: 11, workCenterId: 2, startAt: '2026-03-01T10:00:00Z', endAt: '2026-03-01T14:00:00Z', status: 'PLANNED' },
    { id: 3, workOrderId: 10, workCenterId: 3, startAt: '2026-03-01T09:00:00Z', endAt: '2026-03-01T11:00:00Z', status: 'PLANNED' }
  ])
  assert.equal(conflicts.length, 2)
  assert.ok(conflicts.some((item) => item.type === 'CENTER_OVERLAP'))
  assert.ok(conflicts.some((item) => item.type === 'ORDER_OVERLAP'))
})

test('排产冲突检测忽略已取消任务', () => {
  const conflicts = detectScheduleConflicts([
    { id: 1, workCenterId: 2, startAt: '2026-03-01T08:00:00Z', endAt: '2026-03-01T12:00:00Z', status: 'CANCELLED' },
    { id: 2, workCenterId: 2, startAt: '2026-03-01T10:00:00Z', endAt: '2026-03-01T14:00:00Z', status: 'PLANNED' }
  ])
  assert.equal(conflicts.length, 0)
})

test('产能负荷按标准产能计算负荷率并标记超载', () => {
  const loads = computeCapacityLoad(
    [{ id: 1, workCenterId: 2, startAt: '2026-03-01T08:00:00Z', endAt: '2026-03-01T20:00:00Z' }],
    [{ id: 2, centerName: '一号产线', standardCapacity: 10, shiftHours: 8 }],
    1
  )
  assert.equal(loads[0].loadHours, 12)
  assert.equal(loads[0].capacityHours, 80)
  assert.equal(loads[0].loadRate, 15)
  assert.equal(loads[0].overloaded, false)
})

test('超额领料判定需审批并给出超额比例', () => {
  const ok = evaluateOverIssue(100, 100)
  assert.equal(ok.over, false)
  assert.equal(ok.needApproval, false)
  const over = evaluateOverIssue(120, 100)
  assert.equal(over.over, true)
  assert.equal(over.overQty, 20)
  assert.equal(over.ratio, 1.2)
  assert.equal(over.needApproval, true)
})

test('生产指标计算良率、效率与达成率', () => {
  const metrics = computeProductionMetrics({
    plannedQty: 100,
    outputQty: 100,
    defectQty: 5,
    standardHours: 80,
    actualHours: 100,
    completedOnTime: 8,
    totalOrders: 10
  })
  assert.equal(metrics.yieldRate, 95)
  assert.equal(metrics.efficiencyRate, 80)
  assert.equal(metrics.achievementRate, 80)
  assert.equal(metrics.actualHours, 100)
})

test('停线影响按天折算交期顺延天数与影响产量', () => {
  const impact = computeStopLineImpact({
    startAt: '2026-03-01T08:00:00Z',
    endAt: '2026-03-02T08:00:00Z',
    planEnd: '2026-03-05T00:00:00Z',
    dailyCapacity: 20
  })
  assert.equal(impact.downtimeMinutes, 1440)
  assert.equal(impact.delayDays, 1)
  assert.equal(impact.affectedQty, 20)
  assert.ok(String(impact.newPlanEnd).startsWith('2026-03-06'))
})

test('设备状态机禁止故障直接复机', () => {
  assert.equal(canTransitionEquipment('RUNNING', 'FAULT').ok, true)
  assert.equal(canTransitionEquipment('FAULT', 'IDLE').ok, false)
  assert.equal(canTransitionEquipment('FAULT', 'MAINTENANCE').ok, true)
  assert.equal(canTransitionEquipment('MAINTENANCE', 'IDLE').ok, true)
  assert.equal(canTransitionEquipment('UNKNOWN', 'IDLE').ok, false)
})

test('在制看板统计在制数量并标记逾期工单', () => {
  const rows = buildWipBoard([
    { id: 1, orderNo: 'WO1', productId: 10, status: 'RUNNING', qty: 100, producedQty: 30, actualQty: 30, planEnd: '2026-12-31T00:00:00Z' },
    { id: 2, orderNo: 'WO2', productId: 11, status: 'RUNNING', qty: 50, producedQty: 0, actualQty: 0, planEnd: '2020-01-01T00:00:00Z' }
  ], '2026-03-01T00:00:00Z')
  assert.equal(rows[0].wipQty, 70)
  assert.equal(rows[0].progress, 30)
  assert.equal(rows[0].overdue, false)
  assert.equal(rows[1].wipQty, 50)
  assert.equal(rows[1].overdue, true)
})

test('MRP 需求按交期与净需求排序并分级', () => {
  const rows = rankMrpDemands([
    { productId: 1, netQty: 10, demandQty: 10, dueDate: '2026-03-05T00:00:00Z' },
    { productId: 2, netQty: 100, demandQty: 100, dueDate: '2026-06-01T00:00:00Z' },
    { productId: 3, netQty: 50, demandQty: 50, dueDate: '2026-03-02T00:00:00Z', abcClass: 'A' }
  ], '2026-03-01T00:00:00Z')
  assert.equal(rows[0].productId, 3)
  assert.equal(rows[0].priority, 1)
  assert.equal(rows[0].priorityLabel, 'HIGH')
  assert.equal(rows[1].priority, 2)
  assert.equal(rows[2].priority, 3)
  assert.ok(rows[2].score < rows[0].score)
})

test('检验项判定按上下限识别不合格并汇总结论', () => {
  const result = evaluateQcItems([
    { itemCode: 'A', itemName: '长度', measuredValue: 10, upperLimit: 11, lowerLimit: 9 },
    { itemCode: 'B', itemName: '外观', measuredValue: 20, upperLimit: 11 }
  ])
  assert.equal(result.result, 'FAIL')
  assert.equal(result.passed, 1)
  assert.equal(result.failed, 1)
  assert.ok(result.items[1].reason.includes('超出上限'))
})

test('工单拆分校验已开工工单不可拆分', () => {
  const ok = splitWorkOrder({ qty: 100, producedQty: 0, actualQty: 0, status: 'DRAFT', splitQty: 30 })
  assert.equal(ok.ok, true)
  assert.equal(ok.remainingQty, 70)
  const started = splitWorkOrder({ qty: 100, producedQty: 10, actualQty: 10, status: 'RUNNING', splitQty: 30 })
  assert.equal(started.ok, false)
  const tooMuch = splitWorkOrder({ qty: 100, producedQty: 0, actualQty: 0, status: 'DRAFT', splitQty: 100 })
  assert.equal(tooMuch.ok, false)
})

test('扫码条码解析支持分隔格式与纯产品 ID', () => {
  const parsed = parseScanCode('1001,B20260301,SN001,5')
  assert.equal(parsed.ok, true)
  assert.equal(parsed.productId, 1001)
  assert.equal(parsed.batchNo, 'B20260301')
  assert.equal(parsed.serialNo, 'SN001')
  assert.equal(parsed.qty, 5)
  const simple = parseScanCode('2002')
  assert.equal(simple.productId, 2002)
  assert.equal(simple.batchNo, null)
  const bad = parseScanCode('ABC')
  assert.equal(bad.ok, false)
})
