import test from 'node:test'
import assert from 'node:assert/strict'
import {
  daysUntil,
  evaluateBatchExpiry,
  evaluateSafetyStock,
  evaluateSlowMoving,
  mergeAlertState,
  resolveExpiryLevel,
  resolvePolicy
} from '../apps/server/dist/common/inventory-alert-engine.js'

const NOW = new Date('2026-06-01T00:00:00.000Z')

function daysFromNow(days) {
  return new Date(NOW.getTime() + days * 86400000).toISOString()
}

test('剩余天数计算：过期为负', () => {
  assert.equal(daysUntil(daysFromNow(10), NOW), 10)
  assert.equal(daysUntil(daysFromNow(-2), NOW), -2)
  assert.equal(daysUntil(null), Number.POSITIVE_INFINITY)
})

test('临期巡检：已过期 / 紧急 / 预警三级', () => {
  const alerts = evaluateBatchExpiry([
    { productId: 1, batchNo: 'B1', expiryDate: daysFromNow(-1), qty: 5 },
    { productId: 2, batchNo: 'B2', expiryDate: daysFromNow(3), qty: 8 },
    { productId: 3, batchNo: 'B3', expiryDate: daysFromNow(20), qty: 2 },
    { productId: 4, batchNo: 'B4', expiryDate: daysFromNow(90), qty: 1 },
    { productId: 5, batchNo: 'B5', expiryDate: null, qty: 1 }
  ], 30, 7, NOW)
  assert.equal(alerts.length, 3)
  assert.equal(alerts[0].level, 'EXPIRED')
  assert.equal(alerts[1].level, 'URGENT')
  assert.equal(alerts[2].level, 'WARNING')
})

test('安全库存：低于阈值产生缺口与建议补货量', () => {
  const alerts = evaluateSafetyStock([
    { productId: 1, warehouseId: 1, onHand: 5, safetyStock: 20 },
    { productId: 2, warehouseId: 1, onHand: 30, safetyStock: 20 },
    { productId: 3, warehouseId: 1, onHand: 1, safetyStock: 0 }
  ])
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0].shortage, 15)
  assert.equal(alerts[0].suggestQty, 15)
})

test('呆滞库存：超过天数阈值且有库存才预警', () => {
  const alerts = evaluateSlowMoving([
    { productId: 1, warehouseId: 1, qty: 10, lastOutboundDays: 120, thresholdDays: 90 },
    { productId: 2, warehouseId: 1, qty: 10, lastOutboundDays: 30, thresholdDays: 90 },
    { productId: 3, warehouseId: 1, qty: 0, lastOutboundDays: 200, thresholdDays: 90 }
  ])
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0].productId, 1)
})

test('自然日差：当天到期剩余 0 天，不因时分秒判为过期', () => {
  assert.equal(daysUntil('2026-06-01T23:59:59.000Z', NOW), 0)
  assert.equal(daysUntil('2026-06-02T00:00:00.000Z', NOW), 1)
  assert.equal(daysUntil('2026-05-31T00:00:00.000Z', NOW), -1)
})

test('临期级别解析：过期/紧急/预警/正常', () => {
  assert.equal(resolveExpiryLevel(-1, 30, 7), 'EXPIRED')
  assert.equal(resolveExpiryLevel(3, 30, 7), 'URGENT')
  assert.equal(resolveExpiryLevel(20, 30, 7), 'WARNING')
  assert.equal(resolveExpiryLevel(31, 30, 7), null)
})

test('预警策略解析：产品+仓库 > 产品 > 全局默认', () => {
  const policies = [
    { productId: 0, warehouseId: 0, warnDays: 60, urgentDays: 10, safetyStock: 5, slowMovingDays: 90 },
    { productId: 7, warehouseId: 0, warnDays: 45, urgentDays: 9, safetyStock: 20, slowMovingDays: 60 }
  ]
  const global = resolvePolicy(policies, 99, 0)
  assert.equal(global.warnDays, 60)
  const product = resolvePolicy(policies, 7, 0)
  assert.equal(product.warnDays, 45)
  assert.equal(product.safetyStock, 20)
})

test('预警生命周期：无历史新建、已关闭重开、级别变化更新、无变化跳过', () => {
  assert.equal(mergeAlertState(null, 'WARNING', 10), 'CREATE')
  assert.equal(mergeAlertState({ alertLevel: 'WARNING', status: 'CLOSED', thresholdQty: '10' }, 'WARNING', 10), 'REOPEN')
  assert.equal(mergeAlertState({ alertLevel: 'WARNING', status: 'OPEN', thresholdQty: '10' }, 'URGENT', 5), 'UPDATE')
  assert.equal(mergeAlertState({ alertLevel: 'WARNING', status: 'OPEN', thresholdQty: '10' }, 'WARNING', 10), 'SKIP')
})
