import test from 'node:test'
import assert from 'node:assert/strict'
import {
  contractExpiryWarning, detectAttendanceAnomaly, calculatePayroll, calibratePerformance,
  trainingCertification, assetTransition, vehicleConflict, offerApproval
} from '../apps/server/dist/common/hr-extension-engine.js'

const at = new Date('2026-12-01T09:00:00Z')

test('合同到期30天内预警', () => {
  assert.equal(contractExpiryWarning({ startDate: '2026-01-01', endDate: '2026-12-20' }, at).expiring, true)
  assert.equal(contractExpiryWarning({ startDate: '2026-01-01', endDate: '2027-03-01' }, at).expiring, false)
})

test('迟到检测', () => {
  const reasons = detectAttendanceAnomaly([{ punchTime: '2026-12-01T09:30:00Z' }], '09:00', at)
  assert.equal(reasons.some((item) => item.includes('迟到')), true)
  assert.deepEqual(detectAttendanceAnomaly([{ punchTime: '2026-12-01T08:50:00Z' }], '09:00', at), [])
})

test('薪酬按社保与个税计算净额', () => {
  const result = calculatePayroll({ gross: 20000 })
  assert.equal(result.social, 2100)
  assert.equal(result.tax, 1170)
  assert.equal(result.net, 16730)
})

test('绩效加权校准并分级', () => {
  const result = calibratePerformance({ kpiScore: 90, peerScore: 80, calibration: 5 })
  assert.equal(result.score, 79.5)
  assert.equal(result.level, 'C')
})

test('培训考试合格发证', () => {
  assert.equal(trainingCertification(75).passed, true)
  assert.equal(trainingCertification(50).certificateNo, null)
})

test('行政资产状态流转', () => {
  assert.equal(assetTransition('IDLE', 'ISSUE'), 'IN_USE')
  assert.equal(assetTransition('IN_USE', 'RETURN'), 'IDLE')
  assert.equal(assetTransition('IN_USE', 'ISSUE'), null)
})

test('用车时段冲突检测', () => {
  const existing = [{ startTime: '2026-12-01T10:00:00Z', endTime: '2026-12-01T12:00:00Z' }]
  assert.equal(vehicleConflict(existing, { startTime: '2026-12-01T11:00:00Z', endTime: '2026-12-01T13:00:00Z' }), true)
  assert.equal(vehicleConflict(existing, { startTime: '2026-12-01T13:00:00Z', endTime: '2026-12-01T14:00:00Z' }), false)
})

test('Offer 薪资不得超预算', () => {
  assert.equal(offerApproval(12000, 15000), true)
  assert.equal(offerApproval(16000, 15000), false)
})
