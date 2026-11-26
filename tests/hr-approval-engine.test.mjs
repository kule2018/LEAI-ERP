import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assetStocktakeDiff, calibrationDistribution, detectVehicleConflict, evaluateAssetIssueReturn,
  evaluateHrApproval, leaveDurationDays, performanceCompositeScore, performanceLevel,
  socialInsuranceBreakdown, vehicleFuelConsumption
} from '../apps/server/dist/common/hr-approval-engine.js'

test('人事审批仅待审批状态可通过', () => {
  assert.deepEqual(evaluateHrApproval('PENDING', 'APPROVE'), { ok: true, reason: null })
  assert.equal(evaluateHrApproval('APPROVED', 'APPROVE').ok, false)
  assert.equal(evaluateHrApproval('REJECTED', 'REJECT').ok, false)
})

test('社保公积金明细分摊：个人合计 10.5% 并单列公积金', () => {
  const breakdown = socialInsuranceBreakdown(10000)
  assert.equal(breakdown.personalTotal, 1050)
  assert.equal(breakdown.companyTotal, 2670)
  const housing = breakdown.items.find((item) => item.itemCode === 'HOUSING_FUND')
  assert.equal(housing.personalAmount, 500)
  assert.equal(housing.companyAmount, 500)
})

test('社保明细缴费基数可单项覆盖', () => {
  const breakdown = socialInsuranceBreakdown(10000, [
    { itemCode: 'PENSION', itemName: '养老保险', companyRate: 0.16, personalRate: 0.08, baseAmount: 20000 }
  ], null)
  assert.equal(breakdown.items[0].baseAmount, 20000)
  assert.equal(breakdown.items[0].personalAmount, 1600)
})

test('资产盘点差异识别状态差异、持有人差异与盘亏', () => {
  const diffs = assetStocktakeDiff(
    [
      { assetId: 1, status: 'IDLE', holderId: null },
      { assetId: 2, status: 'IN_USE', holderId: 10 },
      { assetId: 3, status: 'IDLE', holderId: null }
    ],
    [
      { assetId: 1, status: 'IN_USE', holderId: 20 },
      { assetId: 2, status: 'IN_USE', holderId: 11 },
      { assetId: 4, status: 'IDLE', holderId: null }
    ]
  )
  const byId = new Map(diffs.map((item) => [item.assetId, item]))
  assert.equal(byId.get(1).difference, 'STATUS_DIFF')
  assert.equal(byId.get(2).difference, 'HOLDER_DIFF')
  assert.equal(byId.get(3).difference, 'MISSING')
  assert.equal(byId.get(4).difference, 'STATUS_DIFF')
})

test('资产领用必须指定持有人，归还必须有在册持有人', () => {
  assert.equal(evaluateAssetIssueReturn('ISSUE', null).ok, false)
  assert.equal(evaluateAssetIssueReturn('ISSUE', 5).ok, true)
  assert.equal(evaluateAssetIssueReturn('RETURN', null).ok, false)
  assert.equal(evaluateAssetIssueReturn('RETURN', 5).ok, true)
})

test('绩效综合得分按 KPI/360/校准加权并给出等级', () => {
  const result = performanceCompositeScore({ kpiScore: 90, feedbackScore: 80, calibration: 100 })
  assert.equal(result.score, 88)
  assert.equal(result.level, 'B')
  assert.equal(performanceLevel(95), 'A')
  assert.equal(performanceLevel(75), 'C')
  assert.equal(performanceLevel(60), 'D')
})

test('绩效综合得分缺少 360 反馈时以 KPI 兜底', () => {
  const result = performanceCompositeScore({ kpiScore: 100 })
  assert.equal(result.score, 100)
})

test('绩效校准按强制分布切分并输出偏差', () => {
  const rows = calibrationDistribution([95, 92, 88, 85, 82, 78, 75, 60])
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  assert.equal(total, 8)
  assert.equal(rows[0].level, 'A')
  assert.equal(rows[0].count, 2)
  assert.equal(rows[3].level, 'D')
})

test('车辆油耗按百公里折算并对超标告警', () => {
  const normal = vehicleFuelConsumption(50, 500)
  assert.equal(normal.per100km, 10)
  assert.equal(normal.warning, false)
  const over = vehicleFuelConsumption(80, 500)
  assert.equal(over.per100km, 16)
  assert.equal(over.warning, true)
  assert.equal(vehicleFuelConsumption(10, 0).per100km, 0)
})

test('车队冲突校验识别同车占用与申请人重复用车', () => {
  const existing = [
    { id: 1, vehicleId: 7, applyUserId: 100, startTime: '2026-12-01T09:00:00Z', endTime: '2026-12-01T12:00:00Z' }
  ]
  const sameVehicle = detectVehicleConflict(existing, {
    vehicleId: 7, applyUserId: 200, startTime: '2026-12-01T11:00:00Z', endTime: '2026-12-01T14:00:00Z'
  })
  assert.equal(sameVehicle.conflict, true)
  assert.deepEqual(sameVehicle.types, ['SAME_VEHICLE'])

  const sameUser = detectVehicleConflict(existing, {
    vehicleId: 8, applyUserId: 100, startTime: '2026-12-01T11:00:00Z', endTime: '2026-12-01T14:00:00Z'
  })
  assert.equal(sameUser.conflict, true)
  assert.deepEqual(sameUser.types, ['SAME_APPLICANT'])

  const free = detectVehicleConflict(existing, {
    vehicleId: 8, applyUserId: 200, startTime: '2026-12-02T09:00:00Z', endTime: '2026-12-02T14:00:00Z'
  })
  assert.equal(free.conflict, false)
  assert.deepEqual(free.types, [])
})

test('请假天数按自然日计算且最少计一天', () => {
  assert.equal(leaveDurationDays('2026-12-01T00:00:00Z', '2026-12-03T00:00:00Z'), 2)
  assert.equal(leaveDurationDays('2026-12-01T00:00:00Z', '2026-12-01T08:00:00Z'), 1)
  assert.equal(leaveDurationDays('2026-12-03T00:00:00Z', '2026-12-01T00:00:00Z'), 0)
})
