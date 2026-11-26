import test from 'node:test'
import assert from 'node:assert/strict'
import { clearScope, currentScope, enterScope, scopeWhere } from '../apps/server/dist/common/data-scope-context.js'

const baseUser = {
  userId: 7,
  tenantId: 1,
  username: 'u7',
  realName: 'U7',
  orgId: 31,
  roles: [],
  permissions: [],
  isSuperAdmin: false,
  dataScopeLevel: 'SELF'
}

test('未声明过滤字段时保持基础条件（台账/主数据实体安全降级）', () => {
  clearScope()
  const where = scopeWhere({ tenantId: 1 }, { ...baseUser, dataScopeLevel: 'SELF' })
  assert.deepEqual(where, { tenantId: 1 })
})

test('SELF 级别按显式创建人字段过滤', () => {
  clearScope()
  const where = scopeWhere({ tenantId: 1 }, { ...baseUser, dataScopeLevel: 'SELF' }, { ownerField: 'createdBy' })
  assert.equal(where.createdBy, 7)
})

test('SELF 级别可指定负责人字段', () => {
  clearScope()
  const where = scopeWhere({ tenantId: 1 }, baseUser, { ownerField: 'ownerUserId' })
  assert.equal(where.ownerUserId, 7)
})

test('DEPT 级别按组织字段过滤', () => {
  clearScope()
  const where = scopeWhere({ tenantId: 1 }, { ...baseUser, dataScopeLevel: 'DEPT' }, { orgField: 'orgId' })
  assert.equal(where.orgId, 31)
})

test('DEPT 级别无组织字段时降级为显式创建人过滤', () => {
  clearScope()
  const where = scopeWhere({ tenantId: 1 }, { ...baseUser, dataScopeLevel: 'DEPT' }, { ownerField: 'createdBy' })
  assert.equal(where.createdBy, 7)
  const unsafe = scopeWhere({ tenantId: 1 }, { ...baseUser, dataScopeLevel: 'DEPT' })
  assert.deepEqual(unsafe, { tenantId: 1 })
})

test('DEPT_AND_CHILD 包含当前组织与子组织', () => {
  clearScope()
  const where = scopeWhere({ tenantId: 1 }, { ...baseUser, dataScopeLevel: 'DEPT_AND_CHILD' }, { orgField: 'orgId', childOrgIds: [32, 33] })
  assert.equal(where.orgId.type, 'in')
  assert.deepEqual(where.orgId.value, [31, 32, 33])
})

test('ALL 级别与超管不追加过滤', () => {
  clearScope()
  const all = scopeWhere({ tenantId: 1 }, { ...baseUser, dataScopeLevel: 'ALL' }, { ownerField: 'createdBy' })
  const admin = scopeWhere({ tenantId: 1 }, { ...baseUser, isSuperAdmin: true }, { ownerField: 'createdBy' })
  assert.deepEqual(all, { tenantId: 1 })
  assert.deepEqual(admin, { tenantId: 1 })
})

test('上下文作用域优先于用户角色级别', () => {
  clearScope()
  enterScope({ org: 'dept', level: 'SELF', orgId: 31 })
  assert.equal(currentScope()?.level, 'SELF')
  const where = scopeWhere({ tenantId: 1 }, { ...baseUser, dataScopeLevel: 'ALL' }, { ownerField: 'ownerUserId' })
  assert.equal(where.ownerUserId, 7)
  clearScope()
  assert.equal(currentScope(), undefined)
})

test('基础查询条件被保留', () => {
  clearScope()
  const where = scopeWhere({ tenantId: 1, status: 'DRAFT' }, baseUser, { ownerField: 'createdBy' })
  assert.equal(where.tenantId, 1)
  assert.equal(where.status, 'DRAFT')
})
