import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAssetChangeDiff,
  buildCarryForwardPlan,
  buildDetailLedger,
  buildSubjectBalanceTable,
  validateAccountTransfer
} from '../apps/server/dist/common/finance-period-rules.js'

const subjects = [
  { id: 1, subjectCode: '1001', subjectName: '库存现金', category: 'ASSET', direction: 'DEBIT' },
  { id: 2, subjectCode: '6001', subjectName: '主营业务收入', category: 'INCOME', direction: 'CREDIT' },
  { id: 3, subjectCode: '6601', subjectName: '管理费用', category: 'EXPENSE', direction: 'DEBIT' },
  { id: 4, subjectCode: '3101', subjectName: '本年利润', category: 'EQUITY', direction: 'CREDIT' }
]

test('科目余额表：期初 + 本期借贷 = 期末', () => {
  const rows = buildSubjectBalanceTable(
    subjects,
    [
      { subjectId: 2, voucherId: 1, voucherNo: 'V1', voucherDate: '2026-11-05', period: '2026-11', summary: '销售', debit: 0, credit: 1000 },
      { subjectId: 3, voucherId: 1, voucherNo: 'V1', voucherDate: '2026-11-05', period: '2026-11', summary: '费用', debit: 200, credit: 0 },
      { subjectId: 1, voucherId: 2, voucherNo: 'V2', voucherDate: '2026-11-08', period: '2026-11', summary: '收款', debit: 500, credit: 0 }
    ],
    new Map([[2, -300]])
  )
  const income = rows.find((row) => row.subjectId === 2)
  assert.equal(income.openingBalance, -300)
  assert.equal(income.periodCredit, 1000)
  assert.equal(income.closingBalance, -1300)
  assert.equal(income.balanceDirection, 'CREDIT')
  const expense = rows.find((row) => row.subjectId === 3)
  assert.equal(expense.closingBalance, 200)
  assert.equal(expense.balanceDirection, 'DEBIT')
})

test('明细账：按凭证顺序累计并带入期初余额', () => {
  const rows = buildDetailLedger(
    [
      { subjectId: 2, voucherId: 2, voucherNo: 'V2', voucherDate: '2026-11-08', period: '2026-11', summary: '销售', debit: 0, credit: 100 },
      { subjectId: 2, voucherId: 1, voucherNo: 'V1', voucherDate: '2026-11-05', period: '2026-11', summary: '销售', debit: 0, credit: 50 }
    ],
    -20,
    'CREDIT'
  )
  assert.equal(rows.length, 2)
  assert.equal(rows[0].voucherNo, 'V1')
  assert.equal(rows[0].runningBalance, -70)
  assert.equal(rows[1].runningBalance, -170)
  assert.equal(rows[0].direction, 'CREDIT')
})

test('期末结转：收入费用冲平并结转到本年利润，借贷平衡', () => {
  const plan = buildCarryForwardPlan(
    [
      { subjectId: 2, subjectCode: '6001', subjectName: '主营业务收入', category: 'INCOME', balance: -1000 },
      { subjectId: 3, subjectCode: '6601', subjectName: '管理费用', category: 'EXPENSE', balance: 300 },
      { subjectId: 4, subjectCode: '3101', subjectName: '本年利润', category: 'EQUITY', balance: 0 }
    ],
    { profitSubjectId: 4 }
  )
  assert.equal(plan.balanced, true)
  assert.equal(plan.totalDebit, 1300)
  assert.equal(plan.totalCredit, 1300)
  assert.equal(plan.profit, 700)
  const incomeEntry = plan.entries.find((entry) => entry.subjectId === 2)
  assert.equal(incomeEntry.debit, 1000)
  assert.equal(incomeEntry.credit, 0)
  const profitDebit = plan.entries.filter((entry) => entry.subjectId === 4).reduce((sum, entry) => sum + entry.debit, 0)
  assert.equal(profitDebit, 300)
})

test('期末结转：无损益发生额时给出提示', () => {
  const plan = buildCarryForwardPlan(
    [{ subjectId: 4, subjectCode: '3101', subjectName: '本年利润', category: 'EQUITY', balance: 0 }],
    { profitSubjectId: 4 }
  )
  assert.equal(plan.entries.length, 0)
  assert.equal(plan.balanced, true)
  assert.ok(plan.warnings.length > 0)
})

test('资金转账校验：同账户、金额、余额不足、停用账户均拦截', () => {
  assert.equal(validateAccountTransfer({ fromAccountId: 1, toAccountId: 1, amount: 100, fromBalance: 500 }).ok, false)
  assert.equal(validateAccountTransfer({ fromAccountId: 1, toAccountId: 2, amount: 0, fromBalance: 500 }).ok, false)
  assert.equal(validateAccountTransfer({ fromAccountId: 1, toAccountId: 2, amount: 600, fromBalance: 500 }).ok, false)
  assert.equal(validateAccountTransfer({ fromAccountId: 1, toAccountId: 2, amount: 100, fromBalance: 500, fromStatus: 'DISABLED' }).ok, false)
  assert.equal(validateAccountTransfer({ fromAccountId: 1, toAccountId: 2, amount: 100, fromBalance: 500, fromStatus: 'ACTIVE', toStatus: 'ACTIVE' }).ok, true)
})

test('资产变更差异只返回发生变化的字段', () => {
  const changes = buildAssetChangeDiff(
    { assetName: '打印机', originalValue: '1000', usefulMonths: 36 },
    { assetName: '打印机', originalValue: '1200', usefulMonths: 36 },
    { assetName: '资产名称', originalValue: '原值', usefulMonths: '使用月数' }
  )
  assert.equal(changes.length, 1)
  assert.equal(changes[0].field, 'originalValue')
  assert.equal(changes[0].before, '1000')
  assert.equal(changes[0].after, '1200')
})
