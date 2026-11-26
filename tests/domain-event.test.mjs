import test from 'node:test'
import assert from 'node:assert/strict'
import { DomainEventBus, createDomainEvent } from '../apps/server/dist/modules/events/domain-event.module.js'

const user = {
  userId: 1,
  tenantId: 1,
  username: 'tester',
  realName: '测试',
  orgId: null,
  roles: [],
  permissions: [],
  isSuperAdmin: false,
  dataScopeLevel: 'ORG'
}

test('领域事件按订阅顺序派发', async () => {
  const bus = new DomainEventBus()
  const seen = []
  bus.subscribe((event) => seen.push(`first:${event.type}`))
  bus.subscribe((event) => seen.push(`second:${event.type}`))
  await bus.emit(createDomainEvent('sales.order.created', user, 'sale_order', 1))
  assert.deepEqual(seen, ['first:sales.order.created', 'second:sales.order.created'])
})

test('订阅异常不会阻断后续订阅和主流程', async () => {
  const bus = new DomainEventBus()
  let reached = false
  bus.subscribe(() => { throw new Error('subscriber failed') })
  bus.subscribe(() => { reached = true })
  await bus.emit(createDomainEvent('inventory.moved', user, 'stock_ledger', 1))
  assert.equal(reached, true)
})
