import test from 'node:test'
import assert from 'node:assert/strict'
import {
  dedupeBankTransactions, evaluateSupplierAdmission, checkBudget, resolveSubstitute, isRoutingEffective
} from '../apps/server/dist/common/procurement-rules.js'

// 流水去重
test('资金流水去重：按外部流水号', () => {
  const rows = [
    { externalNo: 'TX001', amount: 100 },
    { externalNo: 'TX001', amount: 100 },
    { externalNo: 'TX002', amount: 200 },
    { externalNo: '  ', amount: 50 }
  ]
  const result = dedupeBankTransactions(rows)
  assert.equal(result.unique.length, 2)
  assert.equal(result.duplicates.length, 2)
})

// 供应商准入
test('供应商准入：资质齐全且评分达标', () => {
  assert.equal(evaluateSupplierAdmission({ hasBusinessLicense: true, hasQualification: true, blacklisted: false, score: 80 }).ok, true)
})

test('供应商准入：黑名单/缺资质/低分拒绝', () => {
  assert.equal(evaluateSupplierAdmission({ hasBusinessLicense: true, hasQualification: true, blacklisted: true, score: 90 }).ok, false)
  assert.equal(evaluateSupplierAdmission({ hasBusinessLicense: true, hasQualification: false, blacklisted: false, score: 90 }).ok, false)
  assert.equal(evaluateSupplierAdmission({ hasBusinessLicense: true, hasQualification: true, blacklisted: false, score: 50 }).ok, false)
})

// 预算控制
test('预算控制：WARN 放行但警告', () => {
  const result = checkBudget(1000, 900, 200, 'WARN')
  assert.equal(result.allowed, true)
  assert.equal(result.warning, true)
  assert.equal(result.overAmount, 100)
})

test('预算控制：STRICT 超额拦截', () => {
  const result = checkBudget(1000, 900, 200, 'STRICT')
  assert.equal(result.allowed, false)
  assert.equal(result.overAmount, 100)
})

test('预算控制：NONE 不控制', () => {
  assert.equal(checkBudget(1000, 900, 5000, 'NONE').allowed, true)
})

// 替代料
test('替代料：主料充足不替代', () => {
  const result = resolveSubstitute(1, 100, 50, { materialId: 2, availableQty: 100, ratio: 1 })
  assert.equal(result.usedSubstitute, false)
  assert.equal(result.materialId, 1)
})

test('替代料：主料不足按比例替代', () => {
  const result = resolveSubstitute(1, 30, 100, { materialId: 2, availableQty: 200, ratio: 0.5 })
  assert.equal(result.usedSubstitute, true)
  assert.equal(result.materialId, 2)
  assert.equal(result.qty, 140)
})

test('替代料：库存不足返回 null', () => {
  assert.equal(resolveSubstitute(1, 0, 100, { materialId: 2, availableQty: 10, ratio: 1 }), null)
  assert.equal(resolveSubstitute(1, 0, 100, null), null)
})

// 工艺版本生效
test('工艺版本生效区间', () => {
  assert.equal(isRoutingEffective('2026-01-01', '2026-12-31', '2026-06-01'), true)
  assert.equal(isRoutingEffective('2026-07-01', null, '2026-06-01'), false)
  assert.equal(isRoutingEffective(null, '2026-05-01', '2026-06-01'), false)
})
