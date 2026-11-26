import test from 'node:test'
import assert from 'node:assert/strict'
import {
  scoreLead, isDuplicateLead, opportunityGate, checkQuotationValidity,
  checkCustomerMerge, isIdempotent, targetProgress,
  buildCustomerProfile360, churnRisk, quotationVersionDiff,
  posMemberPrice, posPaymentSplit, salesTargetAlert, buildRedInvoice,
  checkStatementReverse
} from '../apps/server/dist/common/sales-extension-engine.js'

test('线索评分按来源预算与跟进加权', () => {
  assert.ok(scoreLead({ source: 'WEBSITE', budget: 120000, industry: '制造', followers: 2 }) >= 90)
  assert.equal(scoreLead({}), 20)
})

test('重复线索按姓名或手机识别', () => {
  const lead = { id: 2, name: '张三', phone: '13800138000' }
  const existing = [{ id: 1, name: '张 三', phone: '13900139000' }]
  assert.equal(isDuplicateLead(lead, existing), true)
})

test('商机阶段门禁按阶段要求必填项', () => {
  assert.deepEqual(opportunityGate({ stage: 'PROSPECT' }), [])
  assert.deepEqual(opportunityGate({ stage: 'NEGOTIATION', expectedAmount: 100 }), ['closeDate'])
})

test('过期报价不可转单', () => {
  assert.equal(checkQuotationValidity('2020-01-01').expired, true)
  assert.equal(checkQuotationValidity('2099-01-01').valid, true)
})

test('客户合并需审批且无未结单据', () => {
  assert.equal(checkCustomerMerge(0, 0, false, true).allowed, true)
  assert.equal(checkCustomerMerge(0, 0, true, true).allowed, false)
  assert.equal(checkCustomerMerge(100, 100, false, true).allowed, false)
  assert.equal(checkCustomerMerge(0, 0, false, false).allowed, false)
})

test('POS 幂等键防重', () => {
  assert.equal(isIdempotent(['POS-1'], 'POS-1'), true)
  assert.equal(isIdempotent(['POS-1'], 'POS-2'), false)
})

test('目标达成率低于70%预警', () => {
  assert.deepEqual(targetProgress(60, 100), { rate: 60, warning: true })
  assert.deepEqual(targetProgress(80, 100), { rate: 80, warning: false })
})

test('客户360画像按订单数与金额分级', () => {
  const profile = buildCustomerProfile360({
    contactCount: 2,
    orderCount: 12,
    totalAmount: 200000,
    lastOrderDate: '2026-01-01',
    overdueAmount: 0,
    followCount: 5,
    at: '2026-03-01'
  })
  assert.equal(profile.level, 'A')
  assert.equal(profile.avgAmount, Math.round((200000 / 12) * 100) / 100)
  assert.equal(profile.daysSinceLastOrder, 59)
  assert.equal(buildCustomerProfile360({
    contactCount: 0, orderCount: 0, totalAmount: 0,
    lastOrderDate: null, overdueAmount: 0, followCount: 0, at: '2026-03-01'
  }).level, 'C')
})

test('流失预警按无成交、逾期与跟进不足累加评分', () => {
  const profile = buildCustomerProfile360({
    contactCount: 0, orderCount: 0, totalAmount: 0,
    lastOrderDate: null, overdueAmount: 5000, followCount: 1, at: '2026-03-01'
  })
  const risk = churnRisk(profile)
  assert.equal(risk.level, 'HIGH')
  assert.ok(risk.score >= 60)
  assert.ok(risk.reasons.includes('暂无成交记录'))
  assert.ok(risk.actions.length > 0)
})

test('流失预警在活跃且无逾期时为低风险', () => {
  const profile = buildCustomerProfile360({
    contactCount: 3, orderCount: 8, totalAmount: 80000,
    lastOrderDate: '2026-02-20', overdueAmount: 0, followCount: 9, at: '2026-03-01'
  })
  assert.equal(churnRisk(profile).level, 'LOW')
})

test('报价版本对比输出数量单价差异与增删行', () => {
  const diff = quotationVersionDiff(
    [{ productId: 1, qty: 2, unitPrice: 10 }, { productId: 2, qty: 1, unitPrice: 5 }],
    [{ productId: 1, qty: 3, unitPrice: 10 }, { productId: 3, qty: 1, unitPrice: 8 }]
  )
  assert.equal(diff.changed.length, 1)
  assert.equal(diff.changed[0].field, 'qty')
  assert.equal(diff.added.length, 1)
  assert.equal(diff.removed.length, 1)
  assert.equal(diff.totalBefore, 25)
  assert.equal(diff.totalAfter, 38)
  assert.equal(diff.totalDiff, 13)
})

test('POS会员价不高于原价时取会员价', () => {
  assert.equal(posMemberPrice(100, 80), 80)
  assert.equal(posMemberPrice(100, 120), 100)
  assert.equal(posMemberPrice(100, null), 100)
  assert.equal(posMemberPrice(100, 0), 100)
})

test('POS多支付校验合计与应收一致', () => {
  const ok = posPaymentSplit(100, [{ payType: 'CASH', amount: 60 }, { payType: 'WECHAT', amount: 40 }])
  assert.equal(ok.valid, true)
  assert.equal(ok.paidAmount, 100)
  assert.equal(ok.remainder, 0)
  const bad = posPaymentSplit(100, [{ payType: 'CASH', amount: 50 }])
  assert.equal(bad.valid, false)
  assert.equal(bad.reason, '支付金额与应收不一致')
  assert.equal(posPaymentSplit(100, []).valid, false)
})

test('销售目标预警按达成率分级', () => {
  assert.equal(salesTargetAlert(100, 120).level, 'EXCEED')
  assert.equal(salesTargetAlert(100, 80).level, 'NORMAL')
  assert.equal(salesTargetAlert(100, 55).level, 'WARNING')
  assert.equal(salesTargetAlert(100, 20).level, 'CRITICAL')
  assert.equal(salesTargetAlert(0, 20).message, '未设置销售目标')
})

test('红字发票按原发票号冲红生成', () => {
  const invoice = buildRedInvoice({ invoiceNo: 'INV-001', amount: 100, taxAmount: 13 })
  assert.equal(invoice.invoiceNo, 'RED-INV-001')
  assert.equal(invoice.invoiceType, 'RED')
  assert.equal(invoice.amount, 100)
  assert.equal(invoice.taxAmount, 13)
  assert.equal(buildRedInvoice({ invoiceNo: 'INV-002', amount: 10 }).reason, '退货红字发票')
})

// 客户对账单红冲
test('对账单红冲：正常放行', () => {
  const result = checkStatementReverse({ amount: 100, statementAmount: 1000, settledAmount: 200, reversedAmount: 0, status: 'PARTIAL', reason: '发票作废' })
  assert.equal(result.allowed, true)
})

test('对账单红冲：原因必填', () => {
  const result = checkStatementReverse({ amount: 100, statementAmount: 1000, settledAmount: 0, reversedAmount: 0, status: 'PARTIAL', reason: ' ' })
  assert.equal(result.allowed, false)
})

test('对账单红冲：金额超限被拦截', () => {
  const result = checkStatementReverse({ amount: 900, statementAmount: 1000, settledAmount: 200, reversedAmount: 0, status: 'PARTIAL', reason: '作废' })
  assert.equal(result.allowed, false)
  assert.match(result.reason, /超过账单金额/)
})

test('对账单红冲：终态与已红冲不可再红冲', () => {
  assert.equal(checkStatementReverse({ amount: 10, statementAmount: 100, settledAmount: 0, reversedAmount: 0, status: 'REVERSED', reason: 'x' }).allowed, false)
  assert.equal(checkStatementReverse({ amount: 10, statementAmount: 100, settledAmount: 0, reversedAmount: 0, status: 'PARTIAL', reason: 'x' }).allowed, true)
})
