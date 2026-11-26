import test from 'node:test'
import assert from 'node:assert/strict'
import {
  allocateClaimToDepartments, buildCashFlowStatement, buildDepreciationVoucherEntries,
  canRunDepreciation, canTransitionClaim, classifyCashFlow, computeMonthlyDepreciation,
  evaluateClaimApproval
} from '../apps/server/dist/common/finance-closure-rules.js'

test('平均年限法折旧：原值减残值均摊', () => {
  const result = computeMonthlyDepreciation({
    originalValue: 120000, residualRate: 0.05, usefulMonths: 60, alreadyDepreciated: 0, method: 'STRAIGHT_LINE'
  })
  assert.equal(result.method, 'STRAIGHT_LINE')
  assert.equal(result.amount, 1900)
  assert.equal(result.remainingValue, 118100)
})

test('双倍余额递减法：前期加速、末期转直线', () => {
  const early = computeMonthlyDepreciation({
    originalValue: 120000, residualRate: 0, usefulMonths: 60, alreadyDepreciated: 0, method: 'DOUBLE_DECLINING'
  })
  const late = computeMonthlyDepreciation({
    originalValue: 120000, residualRate: 0, usefulMonths: 60, alreadyDepreciated: 115000, method: 'DOUBLE_DECLINING'
  })
  assert.equal(early.amount, 4000)
  assert.ok(late.amount > 166.6667, '末期应转直线并高于双倍递减额')
  assert.match(late.reason, /直线/)
})

test('折旧提足后不再计提', () => {
  const result = computeMonthlyDepreciation({
    originalValue: 10000, residualRate: 0.1, usefulMonths: 12, alreadyDepreciated: 9000
  })
  assert.equal(result.amount, 0)
  assert.match(result.reason, /残值/)
})

test('折旧凭证分录借贷平衡', () => {
  const entries = buildDepreciationVoucherEntries({
    expenseSubjectId: 1, accumulatedSubjectId: 2, amount: 1234.5678, summary: '计提折旧'
  })
  assert.equal(entries.length, 2)
  assert.equal(entries[0].debit, '1234.5678')
  assert.equal(entries[1].credit, '1234.5678')
  assert.equal(entries[0].credit, '0.0000')
})

test('折旧前置校验拦截停用/重复/结账', () => {
  assert.equal(canRunDepreciation({ status: 'ACTIVE', isDeleted: 0, periodClosed: false, alreadyPosted: false }).ok, true)
  assert.equal(canRunDepreciation({ status: 'DISPOSED', isDeleted: 0, periodClosed: false, alreadyPosted: false }).ok, false)
  assert.equal(canRunDepreciation({ status: 'ACTIVE', isDeleted: 0, periodClosed: false, alreadyPosted: true }).ok, false)
  assert.equal(canRunDepreciation({ status: 'ACTIVE', isDeleted: 0, periodClosed: true, alreadyPosted: false }).ok, false)
})

test('报销审批：政策拒绝、无发票、超额需说明', () => {
  const base = { amount: 100, policyLevel: 'PASS', hasInvoice: true }
  assert.equal(evaluateClaimApproval(base).approved, true)
  assert.equal(evaluateClaimApproval({ ...base, policyLevel: 'REJECT' }).approved, false)
  assert.equal(evaluateClaimApproval({ ...base, hasInvoice: false, policyRequiresInvoice: true }).approved, false)
  assert.equal(evaluateClaimApproval({ ...base, policyLimit: 50 }).approved, false)
  assert.equal(evaluateClaimApproval({ ...base, policyLimit: 50, approveRemark: '业务需要' }).approved, true)
})

test('报销状态机与部门分摊', () => {
  assert.equal(canTransitionClaim('SUBMITTED', 'APPROVED').allowed, true)
  assert.equal(canTransitionClaim('PAID', 'APPROVED').allowed, false)
  assert.equal(canTransitionClaim('REJECTED', 'PAID').allowed, false)
  const rows = allocateClaimToDepartments(1000, [
    { deptId: 1, ratio: 0.6 }, { deptId: 2, ratio: 0.4 }
  ])
  assert.equal(rows[0].amount, 600)
  assert.equal(rows[1].amount, 400)
  assert.throws(() => allocateClaimToDepartments(100, [{ deptId: 1, ratio: 0.5 }]))
})

test('现金流量表按三大活动分类', () => {
  assert.equal(classifyCashFlow('RECEIPT'), 'OPERATING')
  assert.equal(classifyCashFlow('ASSET_DISPOSAL'), 'INVESTING')
  assert.equal(classifyCashFlow('BANK_LOAN'), 'FINANCING')
  const result = buildCashFlowStatement({
    period: '2026-03',
    openingBalance: 1000,
    transactions: [
      { id: 1, sourceType: 'RECEIPT', amount: 500, date: '2026-03-01', direction: 'IN' },
      { id: 2, sourceType: 'PAYMENT', amount: 200, date: '2026-03-02', direction: 'OUT' },
      { id: 3, sourceType: 'ASSET_DISPOSAL', amount: 300, date: '2026-03-03', direction: 'IN' },
      { id: 4, sourceType: 'BANK_LOAN', amount: 100, date: '2026-03-04', direction: 'OUT' }
    ]
  })
  const operating = result.sections.find((item) => item.category === 'OPERATING')
  const investing = result.sections.find((item) => item.category === 'INVESTING')
  const financing = result.sections.find((item) => item.category === 'FINANCING')
  assert.equal(operating.net, 300)
  assert.equal(investing.net, 300)
  assert.equal(financing.net, -100)
  assert.equal(result.netIncrease, 500)
  assert.equal(result.endingBalance, 1500)
})
