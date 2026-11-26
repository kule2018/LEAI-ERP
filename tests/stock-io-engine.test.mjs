import assert from 'node:assert/strict'
import test from 'node:test'

/** 优先使用编译产物，未编译时回退到 TypeScript 源码（Node 原生类型擦除） */
const engine = await import('../apps/server/dist/common/stock-io-engine.js')
  .catch(() => import('../apps/server/src/common/stock-io-engine.ts'))

const {
  buildReversalLines,
  canTransition,
  checkProvisionalSettlement,
  getIoTypeMeta,
  IO_TYPE_META,
  resolveIoDirection,
  validateIoDocument
} = engine

test('单据类型元数据完整且编码唯一', () => {
  assert.ok(IO_TYPE_META.length >= 8)
  const codes = IO_TYPE_META.map((item) => item.code)
  assert.equal(new Set(codes).size, codes.length)
  assert.equal(getIoTypeMeta('PURCHASE_IN').direction, 'IN')
  assert.equal(getIoTypeMeta('UNKNOWN_TYPE'), null)
})

test('方向解析：固定类型与双向类型', () => {
  assert.equal(resolveIoDirection(getIoTypeMeta('SALE_OUT'), [{ qtyOut: 2 }]), 'OUT')
  assert.equal(resolveIoDirection(getIoTypeMeta('ADJUST'), [{ qtyIn: 2 }]), 'IN')
  assert.equal(resolveIoDirection(getIoTypeMeta('ADJUST'), [{ qtyIn: 1, qtyOut: 1 }]), 'MIXED')
})

test('过账校验：类型方向不符被拦截', () => {
  const result = validateIoDocument({
    ioType: 'SALE_OUT',
    status: 'DRAFT',
    lines: [{ qtyIn: 3, unitCost: 10 }]
  })
  assert.equal(result.ok, false)
  assert.ok(result.reasons.some((item) => item.includes('方向不符')))
})

test('过账校验：数量必须大于零且不可同时入出', () => {
  const zero = validateIoDocument({ ioType: 'PURCHASE_IN', status: 'DRAFT', lines: [{ qtyIn: 0 }] })
  assert.equal(zero.ok, false)
  const both = validateIoDocument({ ioType: 'ADJUST', status: 'DRAFT', lines: [{ qtyIn: 1, qtyOut: 1 }] })
  assert.equal(both.ok, false)
})

test('暂估规则：仅允许暂估的类型可标记暂估行且需暂估金额', () => {
  const ok = validateIoDocument({
    ioType: 'PURCHASE_IN',
    status: 'DRAFT',
    lines: [{ qtyIn: 5, unitCost: 2, isProvisional: true }],
    provisionalAmount: 10
  })
  assert.equal(ok.ok, true)
  const noAmount = validateIoDocument({
    ioType: 'PURCHASE_IN',
    status: 'DRAFT',
    lines: [{ qtyIn: 5, unitCost: 2, isProvisional: true }]
  })
  assert.equal(noAmount.ok, false)
  const unsupported = validateIoDocument({
    ioType: 'SALE_OUT',
    status: 'DRAFT',
    lines: [{ qtyOut: 5, unitCost: 2, isProvisional: true }]
  })
  assert.equal(unsupported.ok, false)
})

test('成本必填规则：销售出库必须填写成本', () => {
  const result = validateIoDocument({ ioType: 'SALE_OUT', status: 'DRAFT', lines: [{ qtyOut: 4 }] })
  assert.equal(result.ok, false)
  assert.ok(result.reasons.some((item) => item.includes('必须填写成本')))
})

test('附件必填规则：退货类单据过账前需附件', () => {
  const missing = validateIoDocument({
    ioType: 'RETURN_IN',
    status: 'DRAFT',
    lines: [{ qtyIn: 1, unitCost: 5 }],
    attachmentCount: 0
  })
  assert.equal(missing.ok, false)
  const provided = validateIoDocument({
    ioType: 'RETURN_IN',
    status: 'DRAFT',
    lines: [{ qtyIn: 1, unitCost: 5 }],
    attachmentCount: 1
  })
  assert.equal(provided.ok, true)
})

test('状态机：草稿可过账、已过账可冲销、不可重复冲销', () => {
  assert.equal(canTransition('DRAFT', 'POST').ok, true)
  assert.equal(canTransition('POSTED', 'POST').ok, false)
  assert.equal(canTransition('POSTED', 'REVERSE').ok, true)
  assert.equal(canTransition('REVERSED', 'REVERSE').ok, false)
  assert.equal(canTransition('DRAFT', 'REVERSE').ok, false)
})

test('冲销明细方向取反且成本保持', () => {
  const reversed = buildReversalLines([{ qtyIn: 5, unitCost: 3, isProvisional: true }])
  assert.equal(reversed[0].qtyOut, 5)
  assert.equal(reversed[0].qtyIn, 0)
  assert.equal(reversed[0].unitCost, 3)
  assert.equal(reversed[0].isProvisional, false)
})

test('暂估结算差异容差校验', () => {
  const inside = checkProvisionalSettlement({ estimateAmount: 1000, actualAmount: 1005 })
  assert.equal(inside.allowed, true)
  const outside = checkProvisionalSettlement({ estimateAmount: 1000, actualAmount: 1200 })
  assert.equal(outside.allowed, false)
  assert.equal(outside.diff, 200)
})
