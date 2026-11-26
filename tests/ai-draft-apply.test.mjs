import test from 'node:test'
import assert from 'node:assert/strict'
import { AiDraftApplierRegistry } from '../apps/server/dist/modules/ai/ai-draft-applier.js'
import { checkApplyPermission, checkDraftCompleteness, checkConfirmState, extractDraft } from '../apps/server/dist/modules/ai/ai-draft-apply.js'

const user = (overrides = {}) => ({
  userId: 1, tenantId: 1, username: 'u', realName: 'U', orgId: null,
  roles: [], permissions: [], isSuperAdmin: false, dataScopeLevel: 'ORG', ...overrides
})

const applier = { targetType: 'SALE_ORDER', requiredPerm: 'sales:order:create', apply: async () => ({}) }

test('注册表：注册、查找、列出处理器', () => {
  const registry = new AiDraftApplierRegistry()
  assert.equal(registry.get('SALE_ORDER'), undefined)
  registry.register(applier)
  assert.equal(registry.get('SALE_ORDER'), applier)
  assert.deepEqual(registry.list(), [{ targetType: 'SALE_ORDER', requiredPerm: 'sales:order:create' }])
})

test('注册表：同类型后注册覆盖先注册', () => {
  const registry = new AiDraftApplierRegistry()
  const second = { ...applier, requiredPerm: 'sales:order:admin' }
  registry.register(applier)
  registry.register(second)
  assert.equal(registry.get('SALE_ORDER'), second)
})

test('权限二次校验：超管放行，普通用户需有权限码', () => {
  assert.equal(checkApplyPermission(applier, user({ isSuperAdmin: true })).ok, true)
  assert.equal(checkApplyPermission(applier, user()).ok, false)
  assert.equal(checkApplyPermission(applier, user({ permissions: ['sales:order:create'] })).ok, true)
})

test('草稿完整性校验：必填字段缺失被拦截', () => {
  assert.equal(checkDraftCompleteness({ customerName: '张三' }, ['customerName', 'lines']).ok, false)
  assert.equal(checkDraftCompleteness({ customerName: '   ', lines: [] }, ['customerName']).ok, false)
  assert.equal(checkDraftCompleteness({ customerName: '张三', lines: [{}] }, ['customerName', 'lines']).ok, true)
})

test('幂等状态校验：已处理或已写回不可重复确认', () => {
  assert.equal(checkConfirmState('PENDING', null).ok, true)
  assert.equal(checkConfirmState('YES', null).ok, false)
  assert.equal(checkConfirmState('PENDING', 42).ok, false)
})

test('从审计响应中提取草稿，缺字段返回空对象', () => {
  assert.deepEqual(extractDraft('{"targetType":"SALE_ORDER","draft":{"customerName":"张三"}}'), { customerName: '张三' })
  assert.deepEqual(extractDraft('{"targetType":"SALE_ORDER"}'), {})
  assert.deepEqual(extractDraft('not json'), {})
  assert.deepEqual(extractDraft(null), {})
})
