import test from 'node:test'
import assert from 'node:assert/strict'
import {
  allocateBudgetOccupation, applyVoucherTemplate, buildAgingRisk, buildDashboardMetrics, buildStatementNotes,
  canReopenPeriod, checkBudgetOccupation, compareStatements, evaluateCostRollback, evaluateExpensePolicy,
  evaluatePeriodChecklist, evaluateTrialBalance, evaluateVoucherBalances, matchBankTransactions,
  parseReceiptText, simulateCashFlow, suggestBadDebtProvision, suggestSubjects, validateSubjectUsage
} from '../apps/server/dist/common/finance-extension-engine.js'

const subjects = [
  { id: 1, subjectCode: '1001', subjectName: '库存现金', category: 'ASSET', auxType: null, isLeaf: true, status: 'ENABLED' },
  { id: 2, subjectCode: '1122', subjectName: '应收账款', category: 'ASSET', auxType: 'CUSTOMER', isLeaf: true, status: 'ENABLED' },
  { id: 3, subjectCode: '6602', subjectName: '管理费用', category: 'EXPENSE', auxType: 'DEPARTMENT', isLeaf: true, status: 'ENABLED' },
  { id: 4, subjectCode: '6603', subjectName: '财务费用', category: 'EXPENSE', auxType: null, isLeaf: true, status: 'DISABLED' },
  { id: 5, subjectCode: '1000', subjectName: '资产类', category: 'ASSET', auxType: null, isLeaf: false, status: 'ENABLED' }
]

test('科目停用校验拦截停用科目与非末级科目', () => {
  const result = validateSubjectUsage(subjects, [
    { subjectId: 4, debit: 100, credit: 0 },
    { subjectId: 5, debit: 0, credit: 100 }
  ])
  assert.equal(result.ok, false)
  assert.equal(result.disabledCount, 1)
  assert.ok(result.issues.some((item) => item.type === 'DISABLED'))
  assert.ok(result.issues.some((item) => item.type === 'NOT_LEAF'))
})

test('辅助核算必填与类型一致性校验', () => {
  const missing = validateSubjectUsage(subjects, [{ subjectId: 2, debit: 100, credit: 0 }])
  assert.equal(missing.auxMissingCount, 1)
  assert.ok(missing.issues.some((item) => item.type === 'AUX_MISSING'))

  const mismatch = validateSubjectUsage(subjects, [{ subjectId: 2, debit: 100, credit: 0, auxType: 'SUPPLIER', auxId: '9' }])
  assert.ok(mismatch.issues.some((item) => item.type === 'AUX_MISMATCH'))

  const ok = validateSubjectUsage(subjects, [{ subjectId: 2, debit: 100, credit: 0, auxType: 'CUSTOMER', auxId: '3' }])
  assert.equal(ok.ok, true)
})

test('凭证分录金额不可同时为零', () => {
  const result = validateSubjectUsage(subjects, [{ subjectId: 1, debit: 0, credit: 0 }])
  assert.ok(result.issues.some((item) => item.type === 'EMPTY_AMOUNT'))
})

test('凭证模板套用生成借贷分录草稿', () => {
  const result = applyVoucherTemplate(
    {
      templateCode: 'TPL-001',
      templateName: '采购入库',
      items: [
        { subjectCode: '1122', direction: 'DEBIT', ratio: 1 },
        { subjectCode: '1001', direction: 'CREDIT', ratio: 1 }
      ]
    },
    { amount: 500, subjectMap: { '1122': 2, '1001': 1 } }
  )
  assert.equal(result.balanced, true)
  assert.equal(result.totalDebit, 500)
  assert.equal(result.totalCredit, 500)
  assert.equal(result.entries.length, 2)
})

test('凭证模板借贷比例失衡时给出警告', () => {
  const result = applyVoucherTemplate(
    { templateCode: 'TPL-002', templateName: '失衡模板', items: [{ subjectCode: '1122', direction: 'DEBIT', ratio: 1 }] },
    { amount: 100, subjectMap: { '1122': 2 } }
  )
  assert.equal(result.balanced, false)
  assert.equal(result.difference, 100)
  assert.ok(result.warnings.some((item) => item.includes('借贷不平衡')))
})

test('AI 科目建议结合历史频次与关键词排序', () => {
  const suggestions = suggestSubjects(
    [
      { subjectId: 2, subjectCode: '1122', subjectName: '应收账款', summary: '收到货款', amount: 100 },
      { subjectId: 2, subjectCode: '1122', subjectName: '应收账款', summary: '收到货款', amount: 200 },
      { subjectId: 3, subjectCode: '6602', subjectName: '管理费用', summary: '办公费用报销', amount: 50 }
    ],
    '货款',
    subjects,
    2
  )
  assert.ok(suggestions.length > 0)
  assert.equal(suggestions[0].subjectCode, '1122')
  assert.ok(suggestions[0].score > 0)
})

test('试算平衡分析高亮不平衡科目并给出凭证下钻', () => {
  const analysis = evaluateTrialBalance(
    [
      { subjectId: 1, subjectCode: '1001', subjectName: '库存现金', debit: 100, credit: 0, voucherIds: [10] },
      { subjectId: 2, subjectCode: '1122', subjectName: '应收账款', debit: 0, credit: 100, voucherIds: [11] }
    ],
    [10]
  )
  assert.equal(analysis.balanced, true)
  assert.deepEqual(analysis.highlightedSubjectIds, [1])
  assert.equal(analysis.drilldowns.length, 2)
})

test('凭证借贷不平衡判定输出异常凭证', () => {
  const result = evaluateVoucherBalances([
    { voucherId: 1, voucherNo: 'V1', debit: 100, credit: 100 },
    { voucherId: 2, voucherNo: 'V2', debit: 100, credit: 80 }
  ])
  assert.equal(result.balanced, false)
  assert.equal(result.unbalanced.length, 1)
  assert.equal(result.unbalanced[0].voucherNo, 'V2')
})

test('报表同环比计算金额、比率与方向', () => {
  const comparisons = compareStatements(
    [{ key: 'income', label: '营业收入', current: 120 }],
    [{ key: 'income', label: '营业收入', current: 100 }]
  )
  assert.equal(comparisons[0].changeAmount, 20)
  assert.equal(comparisons[0].changeRate, 20)
  assert.equal(comparisons[0].direction, 'UP')
})

test('报表附注在波动超过阈值时生成说明', () => {
  const comparisons = compareStatements(
    [{ key: 'expense', label: '费用', current: 150 }],
    [{ key: 'expense', label: '费用', current: 100 }]
  )
  const notes = buildStatementNotes(comparisons, 20)
  assert.equal(notes.length, 1)
  assert.ok(notes[0].includes('费用'))
})

test('收支 OCR 识别金额、日期、方向与对方单位', () => {
  const result = parseReceiptText('2026-03-05 收到货款 1200.50 元 对方：某某公司')
  assert.equal(result.ok, true)
  assert.equal(result.amount, 1200.5)
  assert.equal(result.date, '2026-03-05')
  assert.equal(result.direction, 'IN')
  assert.equal(result.counterparty, '某某公司')
})

test('收支 OCR 无法识别金额时返回失败原因', () => {
  const result = parseReceiptText('一张没有金额的收据')
  assert.equal(result.ok, false)
  assert.ok(result.reason)
})

test('费用政策超限驳回、缺发票驳回、缺审批告警', () => {
  const policy = { policyCode: 'P-1', policyName: '差旅', maxAmount: 1000, requireInvoice: true, requireApproval: true }
  const exceeded = evaluateExpensePolicy(1500, policy, { hasInvoice: true, approved: true })
  assert.equal(exceeded.level, 'REJECT')

  const noInvoice = evaluateExpensePolicy(100, policy, { hasInvoice: false, approved: true })
  assert.equal(noInvoice.level, 'REJECT')

  const noApproval = evaluateExpensePolicy(100, policy, { hasInvoice: true, approved: false })
  assert.equal(noApproval.level, 'WARN')

  const pass = evaluateExpensePolicy(100, policy, { hasInvoice: true, approved: true })
  assert.equal(pass.level, 'PASS')
})

test('账龄风险分级与催收建议', () => {
  const risks = buildAgingRisk(
    [
      { customerId: 1, customerName: '甲公司', amount: 1000, receivedAmount: 0, dueDate: '2025-11-01' },
      { customerId: 2, customerName: '乙公司', amount: 500, receivedAmount: 0, dueDate: '2026-11-01' }
    ],
    '2026-03-01'
  )
  const first = risks.find((item) => item.customerId === 1)
  assert.equal(first.bucket, 'D91')
  assert.equal(first.level, 'HIGH')
  assert.ok(first.suggestion.includes('法务'))
  const second = risks.find((item) => item.customerId === 2)
  assert.equal(second.level, 'NORMAL')
})

test('坏账计提建议按账龄比例汇总', () => {
  const risks = buildAgingRisk(
    [{ customerId: 1, customerName: '甲公司', amount: 1000, receivedAmount: 0, dueDate: '2025-11-01' }],
    '2026-03-01'
  )
  const provision = suggestBadDebtProvision(risks, { current: 0, days31: 0.05, days61: 0.1, days91: 0.3 })
  assert.equal(provision.total, 300)
  assert.equal(provision.rows[0].rate, 0.3)
})

test('银行流水按金额与日期匹配到候选单据', () => {
  const results = matchBankTransactions(
    [{ id: 1, externalNo: 'BNK001', direction: 'IN', amount: 1000, txDate: '2026-03-05', summary: '货款到账' }],
    [{ bizType: 'RECEIPT', bizId: 5, amount: 1000, date: '2026-03-05', counterparty: '甲公司', refNo: 'BNK001' }]
  )
  assert.equal(results[0].matched, true)
  assert.equal(results[0].bizType, 'RECEIPT')
  assert.equal(results[0].bizId, 5)
})

test('银行流水金额差异过大时不匹配', () => {
  const results = matchBankTransactions(
    [{ id: 1, externalNo: 'BNK002', direction: 'IN', amount: 1000, txDate: '2026-03-05' }],
    [{ bizType: 'RECEIPT', bizId: 5, amount: 300, date: '2026-03-05' }]
  )
  assert.equal(results[0].matched, false)
  assert.equal(results[0].bizType, null)
})

test('现金流情景模拟推演余额并提示资金缺口', () => {
  const result = simulateCashFlow(
    [
      { date: '2026-03-01', inflow: 1000, outflow: 0 },
      { date: '2026-03-02', inflow: 0, outflow: 2000 }
    ],
    { scenarioType: 'BASE', inflowFactor: 1, outflowFactor: 1 },
    0
  )
  assert.equal(result.totalInflow, 1000)
  assert.equal(result.totalOutflow, 2000)
  assert.equal(result.endingBalance, -1000)
  assert.equal(result.minBalance, -1000)
  assert.ok(result.warning.includes('资金缺口'))
})

test('成本重算任务仅在完成且有快照时可回滚', () => {
  assert.equal(evaluateCostRollback({ id: 1, status: 'RUNNING', period: '2026-03', snapshot: {} }).ok, false)
  assert.equal(evaluateCostRollback({ id: 1, status: 'DONE', period: '2026-03', snapshot: null }).ok, false)
  const ok = evaluateCostRollback({ id: 1, status: 'DONE', period: '2026-03', snapshot: { items: [] } }, 3)
  assert.equal(ok.ok, true)
  assert.equal(ok.restoredItems, 3)
})

test('月结检查清单区分阻断项与提示项', () => {
  const result = evaluatePeriodChecklist([
    { code: 'A', name: '无草稿凭证', passed: true, severity: 'BLOCK' },
    { code: 'B', name: '无待认证发票', passed: false, detail: '2 张', severity: 'WARN' }
  ])
  assert.equal(result.ok, true)
  assert.equal(result.blocking.length, 0)
  assert.equal(result.warnings.length, 1)

  const blocked = evaluatePeriodChecklist([
    { code: 'A', name: '无草稿凭证', passed: false, severity: 'BLOCK' }
  ])
  assert.equal(blocked.ok, false)
  assert.equal(blocked.blocking.length, 1)
})

test('反结账需已结账且无阻断事项', () => {
  assert.equal(canReopenPeriod({ periodStatus: 'OPEN' }).ok, false)
  assert.equal(canReopenPeriod({ periodStatus: 'CLOSED', hasPendingCostJob: true }).ok, false)
  assert.equal(canReopenPeriod({ periodStatus: 'CLOSED', hasUnreversedRedFlush: true }).ok, false)
  assert.equal(canReopenPeriod({ periodStatus: 'CLOSED', hasOccupiedBudget: true }).ok, false)
  assert.equal(canReopenPeriod({ periodStatus: 'CLOSED' }).ok, true)
})

test('预算占用按控制规则判定可用额度', () => {
  const strict = { id: 1, period: '2026-03', budgetAmount: 1000, usedAmount: 800, occupiedAmount: 100, controlRule: 'STRICT' }
  const rejected = checkBudgetOccupation(strict, 200)
  assert.equal(rejected.level, 'REJECT')
  assert.equal(rejected.ok, false)

  const warn = { ...strict, controlRule: 'WARN' }
  assert.equal(checkBudgetOccupation(warn, 200).level, 'WARN')

  const ok = checkBudgetOccupation(strict, 100)
  assert.equal(ok.level, 'PASS')
  assert.equal(ok.remaining, 0)
})

test('预算编制按部门与科目匹配后占用', () => {
  const allocation = allocateBudgetOccupation(
    [
      { id: 1, period: '2026-03', deptId: 5, subjectId: null, budgetAmount: 1000, usedAmount: 0, occupiedAmount: 0, controlRule: 'STRICT' },
      { id: 2, period: '2026-03', deptId: null, subjectId: null, budgetAmount: 5000, usedAmount: 0, occupiedAmount: 0, controlRule: 'STRICT' }
    ],
    { period: '2026-03', deptId: 5, amount: 300 }
  )
  assert.equal(allocation.ok, true)
  assert.equal(allocation.allocations[0].budgetId, 1)
  assert.equal(allocation.total, 300)
})

test('仪表盘指标与目标对比给出健康度', () => {
  const metrics = buildDashboardMetrics([
    { key: 'a', label: '应收余额', value: 90, target: 100, drillKey: 'receivable' },
    { key: 'b', label: '凭证数', value: 10, target: null, drillKey: null }
  ])
  assert.equal(metrics[0].status, 'WARN')
  assert.equal(metrics[0].drillable, true)
  assert.equal(metrics[1].status, 'GOOD')
  assert.equal(metrics[1].drillable, false)
})
