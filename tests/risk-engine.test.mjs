import test from 'node:test'
import assert from 'node:assert/strict'
import {
  RISK_TYPE, RISK_SEVERITY, detectApprovalTimeout, detectArRisk, detectCreditRisk,
  detectStockRisk, detectSyncRisk, riskKey, severityWeight
} from '../apps/server/dist/common/risk-engine.js'

test('信用超限：未超限不产生风险', () => {
  assert.equal(detectCreditRisk({ customerId: 1, customerName: 'A', creditLimit: 1000, creditUsed: 800 }), null)
})

test('信用超限：超限时按超出比例定级', () => {
  const low = detectCreditRisk({ customerId: 1, customerName: 'A', creditLimit: 1000, creditUsed: 1100 })
  assert.equal(low.type, RISK_TYPE.CREDIT_OVER_LIMIT)
  assert.equal(low.severity, RISK_SEVERITY.MEDIUM)
  assert.equal(low.evidence.over, 100)
  const high = detectCreditRisk({ customerId: 1, customerName: 'A', creditLimit: 1000, creditUsed: 1300 })
  assert.equal(high.severity, RISK_SEVERITY.HIGH)
})

test('信用超限：支持额外占用预览', () => {
  const risk = detectCreditRisk({ customerId: 1, customerName: 'A', creditLimit: 1000, creditUsed: 950 }, 100)
  assert.ok(risk)
  assert.equal(risk.evidence.over, 50)
})

test('库存不足：安全库存为 0 不产生风险', () => {
  assert.equal(detectStockRisk({ productId: 1, warehouseId: 1, currentQty: 0, thresholdQty: 0 }), null)
})

test('库存不足：低于一半定高危', () => {
  const risk = detectStockRisk({ productId: 2, warehouseId: 1, currentQty: 30, thresholdQty: 100 })
  assert.equal(risk.type, RISK_TYPE.STOCK_LOW)
  assert.equal(risk.severity, RISK_SEVERITY.HIGH)
})

test('应收逾期：无到期日或未到期不产生风险', () => {
  const now = new Date('2026-06-01T00:00:00Z')
  assert.equal(detectArRisk({ receivableId: 1, customerId: 1, amount: 100, receivedAmount: 0, dueDate: null }, now), null)
  assert.equal(detectArRisk({ receivableId: 1, customerId: 1, amount: 100, receivedAmount: 0, dueDate: '2026-06-15' }, now), null)
})

test('应收逾期：已结清不产生风险', () => {
  const now = new Date('2026-06-01T00:00:00Z')
  assert.equal(detectArRisk({ receivableId: 1, customerId: 1, amount: 100, receivedAmount: 100, dueDate: '2026-05-01' }, now), null)
})

test('应收逾期：按逾期天数定级', () => {
  const now = new Date('2026-06-01T00:00:00Z')
  const low = detectArRisk({ receivableId: 1, customerId: 1, amount: 500, receivedAmount: 100, dueDate: '2026-05-28' }, now)
  assert.equal(low.severity, RISK_SEVERITY.LOW)
  assert.equal(low.evidence.balance, 400)
  const high = detectArRisk({ receivableId: 2, customerId: 1, amount: 500, receivedAmount: 0, dueDate: '2026-04-01' }, now)
  assert.equal(high.severity, RISK_SEVERITY.HIGH)
})

test('审批超时：无截止期、未超时、已升级均不产生风险', () => {
  const now = new Date('2026-06-01T00:00:00Z')
  assert.equal(detectApprovalTimeout({ instanceId: 1, bizType: 'sale_order', bizId: 1, dueAt: null }, now), null)
  assert.equal(detectApprovalTimeout({ instanceId: 1, bizType: 'sale_order', bizId: 1, dueAt: new Date('2026-06-02T00:00:00Z') }, now), null)
  assert.equal(detectApprovalTimeout({ instanceId: 1, bizType: 'sale_order', bizId: 1, dueAt: new Date('2026-05-01T00:00:00Z'), escalated: 1 }, now), null)
})

test('审批超时：超时产生中危风险', () => {
  const now = new Date('2026-06-01T00:00:00Z')
  const risk = detectApprovalTimeout({ instanceId: 3, bizType: 'sale_order', bizId: 9, dueAt: new Date('2026-05-31T00:00:00Z') }, now)
  assert.equal(risk.type, RISK_TYPE.APPROVAL_TIMEOUT)
  assert.equal(risk.severity, RISK_SEVERITY.MEDIUM)
})

test('同步失败：失败结果产生风险，成功不产生', () => {
  assert.equal(detectSyncRisk({ logId: 1, storeId: 1, bizType: 'order', result: 'SUCCESS' }), null)
  const risk = detectSyncRisk({ logId: 2, storeId: 1, bizType: 'order', result: 'FAILED', errorText: '授权过期' })
  assert.equal(risk.type, RISK_TYPE.SYNC_FAILED)
  assert.equal(risk.message, '授权过期')
})

test('去重键与严重度排序', () => {
  const risk = detectStockRisk({ productId: 2, warehouseId: 1, currentQty: 30, thresholdQty: 100 })
  assert.equal(riskKey(risk), 'STOCK_LOW:product:2')
  assert.ok(severityWeight(RISK_SEVERITY.HIGH) > severityWeight(RISK_SEVERITY.MEDIUM))
  assert.ok(severityWeight(RISK_SEVERITY.MEDIUM) > severityWeight(RISK_SEVERITY.LOW))
})
