import test from 'node:test'
import assert from 'node:assert/strict'
import {
  dateText, nextDayText, resolveRenewPeriod, resolveRenewTitle, shiftMonthsText
} from '../apps/server/dist/modules/sales/sales-contract-engine.js'

test('续签起始日为原合同到期次日', () => {
  assert.equal(nextDayText('2026-01-31'), '2026-02-01')
  assert.equal(nextDayText('2026-12-31'), '2027-01-01')
})

test('续签到期日按月数平移', () => {
  assert.equal(shiftMonthsText('2026-01-31', 12), '2027-01-31')
  assert.equal(shiftMonthsText('2026-03-31', 6), '2026-09-30')
})

test('续签期间可被显式起止日覆盖', () => {
  const period = resolveRenewPeriod('2026-01-31', 12, '2026-02-01', '2027-01-31')
  assert.equal(period.startDate, '2026-02-01')
  assert.equal(period.endDate, '2027-01-31')
})

test('原合同无到期日时仅保留显式期间', () => {
  const period = resolveRenewPeriod(null, 12, '2026-03-01', '2027-02-28')
  assert.equal(period.startDate, '2026-03-01')
  assert.equal(period.endDate, '2027-02-28')
})

test('续签标题默认标注续签且可覆盖', () => {
  assert.equal(resolveRenewTitle('年度框架合同'), '年度框架合同（续签）')
  assert.equal(resolveRenewTitle('年度框架合同', '二期合同'), '二期合同')
})

test('日期格式化补零', () => {
  assert.equal(dateText(new Date(2026, 0, 5)), '2026-01-05')
})
