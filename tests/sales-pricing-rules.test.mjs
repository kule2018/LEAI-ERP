import test from 'node:test'
import assert from 'node:assert/strict'
import {
  checkSubstituteCategory, checkSplitSelection
} from '../apps/server/dist/common/sales-pricing-rules.js'
import { checkFloorPrice } from '../apps/server/dist/common/pricing-engine.js'

test('单价高于底价时无需价格权限', () => {
  const result = checkFloorPrice(120, 100)
  assert.equal(result.ok, true)
  assert.equal(result.needsApproval, false)
})

test('未设底价（0 或空）时不拦截', () => {
  assert.equal(checkFloorPrice(1, 0).ok, true)
  assert.equal(checkFloorPrice(1, null).ok, true)
})

test('低于底价时标记需审批', () => {
  const result = checkFloorPrice(80, 100)
  assert.equal(result.ok, false)
  assert.equal(result.needsApproval, true)
})

test('替代品必须与原产品同品类', () => {
  assert.equal(checkSubstituteCategory('产品A', 3, '产品B', 3), '')
  assert.match(checkSubstituteCategory('产品A', 3, '产品B', 5), /品类不一致/)
  assert.match(checkSubstituteCategory('产品A', null, '产品B', 5), /缺少品类/)
})

test('拆单需选中至少一行且原单保留一行', () => {
  assert.match(checkSplitSelection(0, 3), /未选择/)
  assert.match(checkSplitSelection(3, 3), /不能拆出全部/)
  assert.equal(checkSplitSelection(1, 3), '')
})
