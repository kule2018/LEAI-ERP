import test from 'node:test'
import assert from 'node:assert/strict'
import {
  checkDepreciationCompleteness,
  isAssetDepreciableInPeriod,
  periodEndDate
} from '../apps/server/src/common/finance-closure-rules.ts'

const asset = (over = {}) => ({
  assetNo: 'FA-001',
  status: 'ACTIVE',
  usefulMonths: 60,
  purchaseDate: '2026-01-01',
  disposeDate: null,
  depreciated: false,
  ...over
})

test('期间末日期上限按字典序比较', () => {
  assert.equal(periodEndDate('2026-02'), '2026-02-31')
})

test('在用资产在期间内应计提折旧', () => {
  assert.equal(isAssetDepreciableInPeriod(asset(), '2026-03'), true)
})

test('已计提、停用、已处置或未到购置期的资产不计提', () => {
  assert.equal(isAssetDepreciableInPeriod(asset({ depreciated: true }), '2026-03'), false)
  assert.equal(isAssetDepreciableInPeriod(asset({ status: 'DISABLED' }), '2026-03'), false)
  assert.equal(isAssetDepreciableInPeriod(asset({ disposeDate: '2026-03-10' }), '2026-03'), false)
  assert.equal(isAssetDepreciableInPeriod(asset({ purchaseDate: '2026-05-01' }), '2026-03'), false)
  assert.equal(isAssetDepreciableInPeriod(asset({ usefulMonths: 0 }), '2026-03'), false)
})

test('折旧完整性检查返回缺失资产清单', () => {
  const result = checkDepreciationCompleteness([
    asset({ assetNo: 'FA-001' }),
    asset({ assetNo: 'FA-002', depreciated: true }),
    asset({ assetNo: 'FA-003', purchaseDate: '2026-06-01' })
  ], '2026-03')
  assert.equal(result.complete, false)
  assert.deepEqual(result.missing, ['FA-001'])
})

test('全部资产已计提时完整性通过', () => {
  const result = checkDepreciationCompleteness([asset({ depreciated: true })], '2026-03')
  assert.equal(result.complete, true)
  assert.deepEqual(result.missing, [])
})
