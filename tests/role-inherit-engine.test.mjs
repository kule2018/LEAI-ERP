import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildRoleClosure, effectiveRoleIds, detectRoleConflict, resolveRuntimeScope
} from '../apps/server/dist/common/role-inherit-engine.js'

const roles = [
  { id: 1, parentId: null },
  { id: 2, parentId: 1 },
  { id: 3, parentId: 2 },
  { id: 4, parentId: 4 }
]

test('角色闭包包含所有祖先', () => {
  const closure = buildRoleClosure(roles)
  assert.deepEqual(closure.get(3), [2, 1])
  assert.deepEqual(closure.get(1), [])
})

test('有效角色 ID 合并直系与祖先', () => {
  const closure = buildRoleClosure(roles)
  assert.deepEqual(effectiveRoleIds([3, 2], closure).sort(), [1, 2, 3])
})

test('检测自环与继承循环', () => {
  assert.match(detectRoleConflict(1, 1, roles), /自身/)
  assert.match(detectRoleConflict(1, 3, roles), /循环/)
  assert.equal(detectRoleConflict(1, 99, roles), '父角色不存在')
  assert.equal(detectRoleConflict(5, 1, roles), '角色不存在')
})

test('数据权限规则按优先级匹配单据类型', () => {
  const result = resolveRuntimeScope({
    bizType: 'SALES_ORDER',
    declaredLevel: 'ORG',
    roleLevel: 'ALL',
    rules: [
      { bizType: 'ALL', orgField: 'dept_id', scopeLevel: 'ORG', priority: 1, status: 'ENABLED' },
      { bizType: 'SALES_ORDER', orgField: 'org_id', scopeLevel: 'DEPT', priority: 9, status: 'ENABLED' }
    ]
  })
  assert.equal(result.level, 'DEPT')
  assert.equal(result.orgField, 'org_id')
})

test('运行时规则与角色级别取更严格值', () => {
  const result = resolveRuntimeScope({
    bizType: 'PURCHASE_ORDER',
    declaredLevel: 'ORG',
    roleLevel: 'DEPT',
    rules: [
      { bizType: 'PURCHASE_ORDER', orgField: 'dept_id', scopeLevel: 'ALL', priority: 5, status: 'ENABLED' }
    ]
  })
  assert.equal(result.level, 'DEPT')
})
