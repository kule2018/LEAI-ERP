import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPageResult } from '../apps/server/dist/common/contracts.js'

test('分页结果同时输出 list 与兼容字段 items', () => {
  const result = buildPageResult([{ id: 1 }, { id: 2 }], 12, 1, 2)
  assert.equal(result.list.length, 2)
  assert.equal(result.items.length, 2)
  assert.equal(result.total, 12)
  assert.equal(result.page, 1)
  assert.equal(result.pageSize, 2)
})
