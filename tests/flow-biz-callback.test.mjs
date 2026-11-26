import test from 'node:test'
import assert from 'node:assert/strict'
import { FlowBizCallbackRegistry } from '../apps/server/dist/modules/collaboration/flow-biz-callback.js'

const user = { userId: 1, tenantId: 1, username: 'u', realName: 'U', orgId: null, roles: [], permissions: [], isSuperAdmin: false, dataScopeLevel: 'ORG' }
const instance = { id: 9, bizType: 'sale_order', bizId: 5, tenantId: 1, status: 'APPROVED' }

test('注册表：注册、查找、列出业务类型', () => {
  const registry = new FlowBizCallbackRegistry()
  assert.equal(registry.get('sale_order'), undefined)
  const cb = {
    bizType: 'sale_order',
    onApproved: async () => {},
    onRejected: async () => {}
  }
  registry.register(cb)
  assert.equal(registry.get('sale_order'), cb)
  assert.deepEqual(registry.list(), ['sale_order'])
})

test('审批通过回调被调用并传递上下文', async () => {
  const registry = new FlowBizCallbackRegistry()
  let received = null
  registry.register({
    bizType: 'sale_order',
    onApproved: async (ctx) => { received = ctx },
    onRejected: async () => { throw new Error('不应调用') }
  })
  await registry.get('sale_order').onApproved({ instance, bizId: 5, user, comment: '同意' })
  assert.equal(received.bizId, 5)
  assert.equal(received.comment, '同意')
  assert.equal(received.instance.status, 'APPROVED')
})

test('驳回回调被调用并携带驳回原因', async () => {
  const registry = new FlowBizCallbackRegistry()
  let reason = null
  registry.register({
    bizType: 'sale_order',
    onApproved: async () => { throw new Error('不应调用') },
    onRejected: async (ctx) => { reason = ctx.comment }
  })
  await registry.get('sale_order').onRejected({ instance, bizId: 5, user, comment: '信用不足' })
  assert.equal(reason, '信用不足')
})

test('未注册的业务类型不触发回调', () => {
  const registry = new FlowBizCallbackRegistry()
  assert.equal(registry.get('purchase_order'), undefined)
})
