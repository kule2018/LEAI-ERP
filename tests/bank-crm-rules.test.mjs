import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BANK_CONNECTOR_TYPES,
  matchBankTransactions,
  parseBankStatement,
  parseJsonStatement,
  parseXmlStatement
} from '../apps/server/dist/common/bank-connection-rules.js'
import {
  buildCommissionAccrualPlan,
  buildVisitPlan,
  evaluateComplaintReopen,
  evaluateCommissionRuleConflict,
  summarizeVisitCoverage
} from '../apps/server/dist/common/sales-crm-extension-rules.js'
import {
  buildDemandSummary,
  evaluateMaterialReturn
} from '../apps/server/dist/common/manufacturing-demand-rules.js'

test('银企直连适配器注册包含多渠道', () => {
  assert.deepEqual([...BANK_CONNECTOR_TYPES], ['MOCK', 'CSV', 'JSON', 'XML'])
})

test('网银 JSON 报文解析', () => {
  const payload = JSON.stringify({
    transactions: [
      { externalNo: 'J001', direction: 'IN', amount: 1000, txDate: '2026-01-05', summary: '货款' },
      { externalNo: 'J002', direction: 'OUT', amount: 300, txDate: '2026-01-06', summary: '付款' },
      { externalNo: '', amount: 50 }
    ]
  })
  const result = parseJsonStatement(payload)
  assert.equal(result.rows.length, 2)
  assert.equal(result.rows[0].direction, 'IN')
  assert.equal(result.rows[1].direction, 'OUT')
  assert.equal(result.errors.length, 1)
})

test('网银 XML 报文解析', () => {
  const payload = '<response><transaction><externalNo>X001</externalNo><amount>500</amount><direction>借</direction><txDate>2026-02-01</txDate><summary>采购付款</summary></transaction></response>'
  const result = parseXmlStatement(payload)
  assert.equal(result.rows.length, 1)
  assert.equal(result.rows[0].externalNo, 'X001')
  assert.equal(result.rows[0].direction, 'OUT')
})

test('适配器注册表按渠道解析', () => {
  const csv = parseBankStatement('CSV', { content: 'externalNo,direction,amount\nC001,IN,200' })
  assert.equal(csv.rows.length, 1)
  const mock = parseBankStatement('MOCK', { balance: 100, count: 2 })
  assert.equal(mock.rows.length, 2)
  const invalid = parseBankStatement('UNKNOWN', {})
  assert.equal(invalid.errors.length, 1)
})

test('流水对账匹配：金额方向一致自动匹配并输出差异', () => {
  const result = matchBankTransactions(
    [
      { id: 1, direction: 'IN', amount: 1000, date: '2026-01-05', summary: '货款回款' },
      { id: 2, direction: 'OUT', amount: 99, date: '2026-01-06', summary: '手续费' }
    ],
    [
      { id: 10, direction: 'IN', amount: 1000, date: '2026-01-05', summary: '客户回款' },
      { id: 11, direction: 'OUT', amount: 300, date: '2026-01-06', summary: '供应商付款' }
    ]
  )
  assert.equal(result.summary.matchedCount, 1)
  assert.equal(result.matches[0].matched, true)
  assert.ok(result.matches[0].score >= 100)
  assert.deepEqual(result.unmatchedTransactions, [2])
  assert.deepEqual(result.unmatchedCandidates, [11])
  assert.equal(result.summary.unmatchedBankAmount, 99)
})

test('佣金规则冲突：同销售员有效期重叠拒绝', () => {
  const existing = [{ id: 1, salesRepId: 3, effectiveFrom: '2026-01-01', effectiveTo: '2026-06-30', status: 'ACTIVE' }]
  assert.equal(evaluateCommissionRuleConflict(existing, { salesRepId: 3, effectiveFrom: '2026-03-01', effectiveTo: '2026-09-30', status: 'ACTIVE' }).ok, false)
  assert.equal(evaluateCommissionRuleConflict(existing, { salesRepId: 3, effectiveFrom: '2026-07-01', effectiveTo: '2026-09-30', status: 'ACTIVE' }).ok, true)
  assert.equal(evaluateCommissionRuleConflict(existing, { salesRepId: 4, effectiveFrom: '2026-03-01', effectiveTo: '2026-09-30', status: 'ACTIVE' }).ok, true)
})

test('佣金批量计提计划跳过已计提组合', () => {
  const items = [
    { ruleId: 1, orderId: 10, orderNo: 'SO1', salesRepId: null, orderAmount: 100, returnAmount: 0, period: '2026-01' },
    { ruleId: 1, orderId: 11, orderNo: 'SO2', salesRepId: null, orderAmount: 200, returnAmount: 0, period: '2026-01' }
  ]
  const plan = buildCommissionAccrualPlan(items, ['1-10'])
  assert.equal(plan.length, 1)
  assert.equal(plan[0].orderId, 11)
})

test('回访计划与覆盖率统计', () => {
  const now = new Date('2026-03-01T00:00:00.000Z')
  const plans = buildVisitPlan([
    { customerId: 1, salesRepId: null, intervalDays: 30, lastVisitAt: '2026-01-01T00:00:00.000Z' },
    { customerId: 2, salesRepId: null, intervalDays: 30, lastVisitAt: null }
  ], now)
  assert.equal(plans[0].overdueDays > 0, true)
  assert.equal(plans[1].reason, '新客户首次回访')
  const summary = summarizeVisitCoverage([
    { status: 'DONE', visitDate: '2026-02-01', satisfaction: 5 },
    { status: 'PLANNED', visitDate: '2026-01-01' }
  ], now)
  assert.equal(summary.done, 1)
  assert.equal(summary.overdue, 1)
  assert.equal(summary.avgSatisfaction, 5)
})

test('投诉重开校验', () => {
  assert.equal(evaluateComplaintReopen({ status: 'CLOSED', reopenCount: 0 }).allowed, true)
  assert.equal(evaluateComplaintReopen({ status: 'PROCESSING', reopenCount: 0 }).allowed, false)
  assert.equal(evaluateComplaintReopen({ status: 'CLOSED', reopenCount: 3 }).allowed, false)
})

test('生产退料量校验', () => {
  assert.equal(evaluateMaterialReturn({ issuedQty: 100, returningQty: 30, alreadyReturnedQty: 20 }).ok, true)
  assert.equal(evaluateMaterialReturn({ issuedQty: 100, returningQty: 90, alreadyReturnedQty: 20 }).ok, false)
  assert.equal(evaluateMaterialReturn({ issuedQty: 100, returningQty: 0, alreadyReturnedQty: 0 }).ok, false)
})

test('需求汇总：按产品聚合净需求', () => {
  const rows = buildDemandSummary([
    { productId: 1, grossDemand: 100, onHand: 30, inTransit: 10 },
    { productId: 1, grossDemand: 50, onHand: 0, inTransit: 0 },
    { productId: 2, grossDemand: 20, onHand: 50, inTransit: 0 }
  ])
  assert.equal(rows.length, 2)
  assert.equal(rows[0].grossDemand, 150)
  assert.equal(rows[0].netDemand, 110)
  assert.equal(rows[1].netDemand, 0)
  assert.equal(rows[1].suggestedQty, 0)
})
