import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDemandsFromMrp, filterStockByFactories, mergeDemandRows, validateMrpFactoryFilter
} from '../apps/server/dist/common/mrp-factory-rules.js'
import {
  canApproveFine, canTransitionCrossDock, validateCrossDock, validateFineDeduction
} from '../apps/server/dist/common/purchase-p1-rules.js'

test('MRP 工厂过滤校验', () => {
  assert.deepEqual(validateMrpFactoryFilter({ warehouseIds: [1, 2, 2, 0] }).factoryWarehouseIds, [1, 2])
  assert.equal(validateMrpFactoryFilter({ factoryId: -1 }).ok, false)
})

test('按工厂仓库过滤库存', () => {
  const rows = [
    { productId: 1, warehouseId: 1, qtyOnHand: 100 },
    { productId: 1, warehouseId: 2, qtyOnHand: 50 },
    { productId: 1, warehouseId: 3, qtyOnHand: 20 }
  ]
  const filtered = filterStockByFactories(rows, [1, 3])
  assert.equal(filtered.length, 2)
  assert.equal(filtered.reduce((sum, row) => sum + row.qtyOnHand, 0), 120)
  assert.equal(filterStockByFactories(rows, []).length, 3)
})

test('MRP 建议生成采购需求', () => {
  const rows = buildDemandsFromMrp([
    { productId: 1, netQty: 100, suggestType: 'PURCHASE' },
    { productId: 2, netQty: 0, suggestType: 'PURCHASE' },
    { productId: 3, netQty: 50, suggestType: 'NONE' }
  ])
  assert.equal(rows.length, 1)
  assert.equal(rows[0].productId, 1)
  const merged = mergeDemandRows([{ productId: 1, qty: 30 }, { productId: 1, qty: 20 }, { productId: 2, qty: 10 }])
  assert.equal(merged.length, 2)
  assert.equal(merged[0].qty, 50)
})

test('越库状态机与数量校验', () => {
  assert.equal(canTransitionCrossDock('PENDING', 'SHIPPED').allowed, true)
  assert.equal(canTransitionCrossDock('SHIPPED', 'COMPLETED').allowed, true)
  assert.equal(canTransitionCrossDock('COMPLETED', 'SHIPPED').allowed, false)
  const base = { orderQty: 100, receivedQty: 80, alreadyCrossDockedQty: 30 }
  assert.equal(validateCrossDock({ ...base, requestQty: 40 }).ok, true)
  assert.equal(validateCrossDock({ ...base, requestQty: 60 }).ok, false)
  assert.equal(validateCrossDock({ ...base, requestQty: 0 }).ok, false)
})

test('罚款审批与扣款校验', () => {
  assert.equal(canApproveFine('PENDING').allowed, true)
  assert.equal(canApproveFine('APPROVED').allowed, false)
  assert.equal(validateFineDeduction(1000, 300, 500).ok, true)
  assert.equal(validateFineDeduction(1000, 300, 800).ok, false)
  assert.equal(validateFineDeduction(1000, 300, 0).ok, false)
})
