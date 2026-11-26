import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildBankSyncPlan,
  buildMockStatement,
  isBankConnectorType,
  maskConnectionCredentials,
  parseCsvStatement,
  validateBankConnection
} from '../apps/server/dist/common/bank-connection-rules.js'

test('银企直连：CSV 流水解析并忽略非法行', () => {
  const { rows, errors } = parseCsvStatement([
    'externalNo,direction,amount,txDate,summary',
    'B001,IN,1000,2026-01-05,货款回款',
    'B002,OUT,300.5,2026-01-06,支付供应商',
    'B003,IN,-5,2026-01-07,金额非法',
    ',IN,10,2026-01-08,缺少流水号'
  ].join('\n'))
  assert.equal(rows.length, 2)
  assert.equal(rows[0].externalNo, 'B001')
  assert.equal(rows[0].direction, 'IN')
  assert.equal(rows[0].amount, 1000)
  assert.equal(rows[1].direction, 'OUT')
  assert.equal(rows[1].amount, 300.5)
  assert.equal(errors.length, 2)
})

test('银企直连：CSV 缺少必要列时返回错误', () => {
  const { rows, errors } = parseCsvStatement('date,amount\n2026-01-05,100')
  assert.equal(rows.length, 0)
  assert.match(errors[0], /externalNo|amount/)
})

test('银企直连：同步计划统计收支并推算期末余额', () => {
  const plan = buildBankSyncPlan({
    transactions: [
      { externalNo: 'B001', direction: 'IN', amount: 1000 },
      { externalNo: 'B002', direction: 'OUT', amount: 300 }
    ],
    bookBalance: 500
  })
  assert.equal(plan.inflow, 1000)
  assert.equal(plan.outflow, 300)
  assert.equal(plan.net, 700)
  assert.equal(plan.endingBalance, 1200)
  assert.equal(plan.difference, null)
  assert.equal(plan.matched, true)
})

test('银企直连：银行余额与账面余额比对差异', () => {
  const plan = buildBankSyncPlan({ transactions: [], bookBalance: 500, bankBalance: 480 })
  assert.equal(plan.difference, -20)
  assert.equal(plan.matched, false)
})

test('银企直连：模拟流水生成稳定流水号', () => {
  const rows = buildMockStatement({ accountNo: '622200001234', balance: 3000, count: 3, date: '2026-01-05' })
  assert.equal(rows.length, 3)
  assert.match(rows[0].externalNo, /^MOCK1234/)
  assert.equal(rows[0].txDate, '2026-01-05')
})

test('银企直连：连接参数校验与凭证掩码', () => {
  assert.equal(validateBankConnection({ accountId: 1, bankName: '招商银行', connector: 'MOCK' }).ok, true)
  assert.equal(validateBankConnection({ accountId: 0, bankName: '招商银行', connector: 'MOCK' }).ok, false)
  assert.equal(validateBankConnection({ accountId: 1, bankName: '', connector: 'MOCK' }).ok, false)
  assert.equal(validateBankConnection({ accountId: 1, bankName: '招商银行', connector: 'XYZ' }).ok, false)
  assert.equal(isBankConnectorType('CSV'), true)
  assert.equal(isBankConnectorType('XYZ'), false)
  const masked = maskConnectionCredentials({ userName: 'admin', password: '123456' })
  assert.equal(masked.userName, 'admin')
  assert.match(masked.password, /\*\*\*\*/)
})
