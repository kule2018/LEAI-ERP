import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildContractReminder,
  canRenewContract,
  canTerminateContract,
  deriveExpiryDate,
  evaluateContract,
  isContractType,
  summarizeContractExpiry
} from '../apps/server/dist/common/labor-contract-rules.js'

const base = {
  id: 1,
  contractNo: 'HT2026-001',
  employeeId: 9,
  employeeName: '张三',
  contractType: 'FIXED',
  expiryDate: '2026-12-31',
  status: 'EFFECTIVE',
  effectiveDate: '2024-01-01'
}

test('合同类型校验：仅接受受支持的类型', () => {
  assert.equal(isContractType('FIXED'), true)
  assert.equal(isContractType('UNKNOWN'), false)
})

test('到期日推导：固定期限按年数', () => {
  assert.equal(deriveExpiryDate('FIXED', '2024-01-01', 3), '2027-01-01')
})

test('到期日推导：无固定期限返回空', () => {
  assert.equal(deriveExpiryDate('OPEN_ENDED', '2024-01-01', null), null)
})

test('到期日推导：外包按月数', () => {
  assert.equal(deriveExpiryDate('OUTSOURCE', '2024-01-01', 6), '2024-07-01')
})

test('状态评估：临近到期标记为到期', () => {
  const at = new Date('2026-12-20T00:00:00Z')
  const result = evaluateContract({ status: 'EFFECTIVE', effectiveDate: '2024-01-01', expiryDate: '2026-12-31' }, at, 30)
  assert.equal(result.expired, false)
  assert.equal(result.expiring, true)
  assert.equal(result.suggestStatus, 'EFFECTIVE')
})

test('状态评估：已过期建议状态为 EXPIRED', () => {
  const at = new Date('2027-01-05T00:00:00Z')
  const result = evaluateContract({ status: 'EFFECTIVE', effectiveDate: '2024-01-01', expiryDate: '2026-12-31' }, at, 30)
  assert.equal(result.expired, true)
  assert.equal(result.suggestStatus, 'EXPIRED')
})

test('续签校验：已续签或已解除的合同不可重复续签', () => {
  assert.equal(canRenewContract({ status: 'RENEWED' }).allowed, false)
  assert.equal(canRenewContract({ status: 'TERMINATED' }).allowed, false)
  assert.equal(canRenewContract({ status: 'EFFECTIVE' }).allowed, true)
})

test('解除校验：草稿合同不可解除', () => {
  assert.equal(canTerminateContract({ status: 'DRAFT' }).allowed, false)
  assert.equal(canTerminateContract({ status: 'EFFECTIVE' }).allowed, true)
})

test('到期提醒：进入提醒窗口生成提醒条目', () => {
  const at = new Date('2026-12-20T00:00:00Z')
  const reminder = buildContractReminder(base, at, 30)
  assert.ok(reminder)
  assert.equal(reminder.contractNo, 'HT2026-001')
  assert.equal(reminder.level, 'WARNING')
})

test('到期提醒：不在提醒窗口不生成条目', () => {
  const at = new Date('2026-01-05T00:00:00Z')
  assert.equal(buildContractReminder(base, at, 30), null)
})

test('到期汇总：统计紧急与已到期合同数', () => {
  const at = new Date('2026-12-20T00:00:00Z')
  const urgent = buildContractReminder(base, at, 30)
  const expired = buildContractReminder({ ...base, id: 2, expiryDate: '2026-12-01' }, at, 30)
  const list = [urgent, expired].filter((item) => item !== null)
  const summary = summarizeContractExpiry(list)
  assert.equal(summary.expiringCount, 1)
  assert.equal(summary.expiredCount, 1)
  assert.equal(summary.employeeCount, 1)
})
