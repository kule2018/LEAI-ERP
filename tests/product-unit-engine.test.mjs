import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildUnitOptions,
  convertQuantity,
  convertToBaseQty,
  resolveBaseRate,
  validateConversionSet
} from '../apps/server/dist/common/product-unit-engine.js'

test('单位换算：基准单位唯一且换算率为 1', () => {
  const issues = validateConversionSet([
    { unitId: 1, conversionRate: 1, isBase: true },
    { unitId: 2, conversionRate: 12, isBase: false }
  ])
  assert.deepEqual(issues, [])
})

test('单位换算：缺少基准单位报错', () => {
  const issues = validateConversionSet([{ unitId: 2, conversionRate: 12, isBase: false }])
  assert.equal(issues.length, 1)
  assert.match(issues[0], /基准单位/)
})

test('单位换算：多个基准单位报错', () => {
  const issues = validateConversionSet([
    { unitId: 1, conversionRate: 1, isBase: true },
    { unitId: 2, conversionRate: 1, isBase: true }
  ])
  assert.equal(issues.length, 1)
  assert.match(issues[0], /只能存在一个基准单位/)
})

test('单位换算：非正换算率与重复单位报错', () => {
  const issues = validateConversionSet([
    { unitId: 1, conversionRate: 0, isBase: true },
    { unitId: 2, conversionRate: 3, isBase: false },
    { unitId: 2, conversionRate: 3, isBase: false }
  ])
  assert.equal(issues.length, 3)
  assert.match(issues[0], /换算率必须大于 0/)
  assert.match(issues[1], /基准单位 1 的换算率必须为 1/)
  assert.match(issues[2], /重复配置/)
})

test('单位换算：空配置提示至少一个单位', () => {
  const issues = validateConversionSet([])
  assert.equal(issues.length, 1)
  assert.match(issues[0], /至少需要配置一个计量单位/)
})

test('数量换算：按基准单位比例折算', () => {
  assert.equal(convertQuantity(2, 12, 1), 24)
  assert.equal(convertQuantity(1, 1, 12), 0.083333)
  assert.equal(convertQuantity(5, 0, 1), 0)
  assert.equal(convertQuantity(Number.NaN, 1, 1), 0)
})

test('基准单位解析：优先取显式基准，无基准时取首行', () => {
  assert.equal(resolveBaseRate([
    { unitId: 1, conversionRate: 6, isBase: false },
    { unitId: 2, conversionRate: 1, isBase: true }
  ]), 1)
  assert.equal(resolveBaseRate([{ unitId: 1, conversionRate: 6, isBase: false }]), 6)
  assert.equal(resolveBaseRate([]), 1)
})

test('单位下拉选项包含折合基准数量', () => {
  const options = buildUnitOptions([
    { unitId: 1, unitCode: 'PCS', unitName: '件', conversionRate: 1, isBase: true },
    { unitId: 2, unitCode: 'BOX', unitName: '箱', conversionRate: 12, isBase: false }
  ])
  assert.equal(options.length, 2)
  assert.equal(options[0].baseQty, 1)
  assert.equal(options[1].baseQty, 12)
  assert.equal(options[1].isBase, false)
})

test('折算基准数量：未知单位返回 0', () => {
  const rows = [
    { unitId: 1, conversionRate: 1, isBase: true },
    { unitId: 2, conversionRate: 12, isBase: false }
  ]
  assert.equal(convertToBaseQty(3, 2, rows), 36)
  assert.equal(convertToBaseQty(3, 99, rows), 0)
})
