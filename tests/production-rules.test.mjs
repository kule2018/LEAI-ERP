import test from 'node:test'
import assert from 'node:assert/strict'
import { computeStocktakeLines, rollupBomCost, validateRouting, computeBackflush } from '../apps/server/dist/common/production-rules.js'

// 盲盘/复盘
test('盲盘：账面量隐藏，差异仍按实际计算', () => {
  const result = computeStocktakeLines([{ productId: 1, bookQty: 100, actualQty: 95 }], true)
  assert.equal(result[0].displayBookQty, null)
  assert.equal(result[0].diffQty, -5)
  assert.equal(result[0].needRecount, true)
})

test('非盲盘：显示账面量，无复盘要求', () => {
  const result = computeStocktakeLines([{ productId: 1, bookQty: 100, actualQty: 95 }], false)
  assert.equal(result[0].displayBookQty, 100)
  assert.equal(result[0].needRecount, false)
})

test('复盘：以复盘数量为准计算差异', () => {
  const result = computeStocktakeLines([{ productId: 1, bookQty: 100, actualQty: 95, recountQty: 98 }], true)
  assert.equal(result[0].diffQty, -2)
  assert.equal(result[0].needRecount, false)
})

// BOM 成本卷算
test('BOM 成本卷算：多层累加', () => {
  const edges = [
    { parentId: 1, childId: 2, qtyPerUnit: 2, childCost: 10 },
    { parentId: 2, childId: 3, qtyPerUnit: 3, childCost: 5 }
  ]
  assert.equal(rollupBomCost(1, edges), 20 + 2 * 15)
})

test('BOM 成本卷算：循环防护（截断回边，保留直接边）', () => {
  const edges = [
    { parentId: 1, childId: 2, qtyPerUnit: 1, childCost: 10 },
    { parentId: 2, childId: 1, qtyPerUnit: 1, childCost: 5 }
  ]
  assert.equal(rollupBomCost(1, edges), 15)
})

// 工艺顺序
test('工艺顺序校验：合法', () => {
  assert.equal(validateRouting([{ sortNo: 1, standardMinutes: 30 }, { sortNo: 2, standardMinutes: 20 }]).ok, true)
})

test('工艺顺序校验：序号重复/非法/负工时', () => {
  assert.equal(validateRouting([{ sortNo: 1, standardMinutes: 10 }, { sortNo: 1, standardMinutes: 20 }]).ok, false)
  assert.equal(validateRouting([{ sortNo: 0, standardMinutes: 10 }]).ok, false)
  assert.equal(validateRouting([{ sortNo: 1, standardMinutes: -5 }]).ok, false)
})

// 倒冲
test('倒冲：应耗减已领，判断库存是否充足', () => {
  const result = computeBackflush([
    { materialId: 1, requiredQty: 100, alreadyIssuedQty: 30, availableQty: 100 },
    { materialId: 2, requiredQty: 50, alreadyIssuedQty: 60, availableQty: 0 }
  ])
  assert.equal(result[0].qty, 70)
  assert.equal(result[0].sufficient, true)
  assert.equal(result[1].qty, 0)
  assert.equal(result[1].sufficient, true)
})

test('倒冲：库存不足标记', () => {
  const result = computeBackflush([{ materialId: 1, requiredQty: 100, alreadyIssuedQty: 0, availableQty: 50 }])
  assert.equal(result[0].qty, 100)
  assert.equal(result[0].sufficient, false)
})
