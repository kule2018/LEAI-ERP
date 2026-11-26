import test from 'node:test'
import assert from 'node:assert/strict'
import { isAgreementEffective, tierPrice, resolveAgreementPrice, checkFloorPrice } from '../apps/server/dist/common/pricing-engine.js'
import { computeNetDemand, explodeBom, mrpExceptions } from '../apps/server/dist/common/mrp-engine.js'
import { traceForward, traceBackward, recallList, traceSerial } from '../apps/server/dist/common/trace-engine.js'

// ---- 定价引擎 ----
const agreement = (overrides = {}) => ({ id: 1, customerId: 1, productId: 10, price: 100, ...overrides })

test('协议生效区间判断', () => {
  assert.equal(isAgreementEffective(agreement(), '2026-06-01'), true)
  assert.equal(isAgreementEffective(agreement({ effectiveFrom: '2026-07-01' }), '2026-06-01'), false)
  assert.equal(isAgreementEffective(agreement({ effectiveTo: '2026-05-01' }), '2026-06-01'), false)
  assert.equal(isAgreementEffective(agreement({ status: 'DISABLED' }), '2026-06-01'), false)
})

test('阶梯价按数量匹配最高档', () => {
  const a = agreement({ price: 100, tiers: [{ minQty: 100, price: 80 }, { minQty: 10, price: 90 }] })
  assert.equal(tierPrice(a, 5), 100)
  assert.equal(tierPrice(a, 20), 90)
  assert.equal(tierPrice(a, 200), 80)
})

test('最适用协议：客户专属优先，同类取最低价', () => {
  const list = [
    agreement({ id: 1, customerId: 0, productId: 10, price: 95 }),
    agreement({ id: 2, customerId: 1, productId: 10, price: 90 }),
    agreement({ id: 3, customerId: 1, productId: 10, price: 85 })
  ]
  const result = resolveAgreementPrice(list, 10, null, 1, '2026-06-01')
  assert.equal(result.agreementId, 3)
  assert.equal(result.unitPrice, 85)
})

test('无可生效协议返回 null', () => {
  assert.equal(resolveAgreementPrice([agreement({ effectiveTo: '2020-01-01' })], 10, null, 1, '2026-06-01'), null)
})

test('底价权限：低于底价需审批', () => {
  assert.deepEqual(checkFloorPrice(80, 90), { ok: false, needsApproval: true })
  assert.deepEqual(checkFloorPrice(95, 90), { ok: true, needsApproval: false })
  assert.deepEqual(checkFloorPrice(10, null), { ok: true, needsApproval: false })
})

// ---- MRP 引擎 ----
test('净需求公式', () => {
  const result = computeNetDemand({ productId: 1, grossQty: 100, safetyQty: 10, availableQty: 30, onWayQty: 20, allocatedQty: 5 })
  assert.equal(result.netQty, 65)
  assert.equal(result.exception, 'SHORTAGE')
})

test('净需求不为负', () => {
  const result = computeNetDemand({ productId: 1, grossQty: 10, availableQty: 50 })
  assert.equal(result.netQty, 0)
  assert.equal(result.exception, 'EXCESS')
})

test('BOM 缺料树逐层展开', () => {
  const edges = [
    { parentId: 1, childId: 2, qtyPerUnit: 2 },
    { parentId: 1, childId: 3, qtyPerUnit: 1 },
    { parentId: 2, childId: 4, qtyPerUnit: 3 }
  ]
  const tree = explodeBom(1, 10, edges)
  assert.equal(tree.get(2), 20)
  assert.equal(tree.get(3), 10)
  assert.equal(tree.get(4), 60)
})

test('BOM 循环被终止', () => {
  const edges = [
    { parentId: 1, childId: 2, qtyPerUnit: 1 },
    { parentId: 2, childId: 1, qtyPerUnit: 1 }
  ]
  const tree = explodeBom(1, 5, edges)
  assert.equal(tree.get(2), 5)
})

test('MRP 例外消息', () => {
  const exceptions = mrpExceptions([
    { productId: 1, grossQty: 100, netQty: 20, exception: 'SHORTAGE' },
    { productId: 2, grossQty: 10, netQty: 0, exception: 'NONE' }
  ])
  assert.equal(exceptions.length, 1)
  assert.match(exceptions[0], /产品 1 缺料 20/)
})

// ---- 追溯引擎 ----
const entries = [
  { id: 1, batchNo: 'B001', voucherType: 'PURCHASE_IN', voucherId: 100, direction: 'IN', qty: 100, productId: 10 },
  { id: 2, batchNo: 'B001', voucherType: 'SALE_OUT', voucherId: 200, direction: 'OUT', qty: 30, productId: 10 },
  { id: 4, batchNo: 'B001', voucherType: 'SALE_OUT', voucherId: 300, direction: 'OUT', qty: 20, productId: 10 },
  { id: 5, batchNo: 'B001', voucherType: 'SALE_OUT', voucherId: 400, direction: 'OUT', qty: 10, productId: 10 }
]

test('反向追溯：批次来源入库流水', () => {
  const sources = traceBackward(entries, 'B001')
  assert.equal(sources.length, 1)
  assert.equal(sources[0].voucherType, 'PURCHASE_IN')
})

test('正向追溯：批次出库去向', () => {
  const destinations = traceForward(entries, 'B001')
  assert.equal(destinations.length, 3)
  assert.equal(destinations[0].voucherId, 200)
})

test('召回清单去重', () => {
  const list = recallList(entries, 'B001')
  assert.equal(list.length, 3)
  assert.ok(list.some((x) => x.voucherId === 200))
  assert.ok(list.some((x) => x.voucherId === 300))
  assert.ok(list.some((x) => x.voucherId === 400))
})

test('序列号精确追溯', () => {
  const withSerial = [{ ...entries[0], serialNo: 'S001' }, { ...entries[1], serialNo: 'S002' }]
  assert.equal(traceSerial(withSerial, 'S001').length, 1)
})
