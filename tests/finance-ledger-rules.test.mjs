import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildGroupedDetailLedger,
  buildSubjectCarryForwardPlan,
  evaluateCarryForwardReversal,
  mergeOpeningBalances
} from '../apps/server/dist/common/finance-period-rules.js'

const subjects = [
  { id: 1, subjectCode: '1001', subjectName: '库存现金', category: 'ASSET', direction: 'DEBIT' },
  { id: 2, subjectCode: '1002', subjectName: '银行存款', category: 'ASSET', direction: 'DEBIT' },
  { id: 3, subjectCode: '2202', subjectName: '应付账款', category: 'LIABILITY', direction: 'CREDIT' }
]

const entries = [
  { subjectId: 1, voucherId: 11, voucherNo: 'V001', voucherDate: '2026-01-05', period: '2026-01', summary: '收入现金', debit: 100, credit: 0 },
  { subjectId: 1, voucherId: 12, voucherNo: 'V002', voucherDate: '2026-01-08', period: '2026-01', summary: '支付费用', debit: 0, credit: 30 },
  { subjectId: 2, voucherId: 13, voucherNo: 'V003', voucherDate: '2026-01-10', period: '2026-01', summary: '回款', debit: 200, credit: 0 }
]

test('期初余额：期初余额表优先于历史分录倒推', () => {
  const merged = mergeOpeningBalances(
    new Map([[1, 500]]),
    new Map([[1, 200], [2, 80]])
  )
  assert.equal(merged.get(1), 500)
  assert.equal(merged.get(2), 80)
})

test('明细账：多科目分组并逐笔累计余额', () => {
  const groups = buildGroupedDetailLedger(entries, subjects, {
    openingBalances: new Map([[1, 1000], [2, 0]]),
    subjectIds: [1, 2]
  })
  assert.equal(groups.length, 2)
  const cash = groups[0]
  assert.equal(cash.subjectCode, '1001')
  assert.equal(cash.openingBalance, 1000)
  assert.equal(cash.rows.length, 2)
  assert.equal(cash.rows[0].runningBalance, 1100)
  assert.equal(cash.rows[1].runningBalance, 1070)
  assert.equal(cash.periodDebit, 100)
  assert.equal(cash.periodCredit, 30)
  assert.equal(cash.closingBalance, 1070)
  const bank = groups[1]
  assert.equal(bank.closingBalance, 200)
})

test('明细账：支持日期区间与凭证号过滤', () => {
  const byDate = buildGroupedDetailLedger(entries, subjects, { subjectIds: [1], beginDate: '2026-01-06' })
  assert.equal(byDate[0].rows.length, 1)
  assert.equal(byDate[0].rows[0].voucherNo, 'V002')
  const byVoucher = buildGroupedDetailLedger(entries, subjects, { subjectIds: [1], voucherNo: 'V001' })
  assert.equal(byVoucher[0].rows.length, 1)
})

test('期末结转：指定科目按余额方向结转到目标科目', () => {
  const plan = buildSubjectCarryForwardPlan(
    [
      { subjectId: 1, subjectCode: '1001', subjectName: '库存现金', category: 'ASSET', balance: 300 },
      { subjectId: 3, subjectCode: '2202', subjectName: '应付账款', category: 'LIABILITY', balance: -200 }
    ],
    { targetSubjectId: 9 }
  )
  assert.equal(plan.balanced, true)
  assert.equal(plan.entries.length, 4)
  const debitStock = plan.entries.find((item) => item.subjectId === 1 && item.debit > 0)
  assert.equal(debitStock.debit, 300)
  const creditPayable = plan.entries.find((item) => item.subjectId === 3 && item.credit > 0)
  assert.equal(creditPayable.credit, 200)
  assert.equal(plan.totalDebit, 500)
  assert.equal(plan.totalCredit, 500)
})

test('期末结转：无余额科目不产生分录', () => {
  const plan = buildSubjectCarryForwardPlan(
    [{ subjectId: 1, subjectCode: '1001', subjectName: '库存现金', category: 'ASSET', balance: 0 }],
    { targetSubjectId: 9 }
  )
  assert.equal(plan.entries.length, 0)
  assert.match(plan.warnings[0], /无余额/)
})

test('反结转：结转未完成或期间已结账时禁止', () => {
  assert.equal(evaluateCarryForwardReversal({ carryStatus: 'DONE', periodStatus: 'OPEN', voucherStatus: 'POSTED' }).ok, true)
  assert.equal(evaluateCarryForwardReversal({ carryStatus: 'PENDING', periodStatus: 'OPEN' }).ok, false)
  assert.equal(evaluateCarryForwardReversal({ carryStatus: 'DONE', periodStatus: 'CLOSED' }).ok, false)
  assert.equal(evaluateCarryForwardReversal({ carryStatus: 'DONE', periodStatus: 'OPEN', voucherStatus: 'DRAFT' }).ok, false)
})
