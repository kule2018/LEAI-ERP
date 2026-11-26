import '../apps/server/node_modules/reflect-metadata/Reflect.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { SalesService } from '../apps/server/dist/modules/sales/sales.service.js'

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

function createService(order) {
  const repo = {
    findOne: async () => ({ ...order }),
    save: async (entity) => ({ ...entity })
  }
  const audit = { record: async () => ({}) }
  const eventBus = { emit: async () => undefined }
  const inventory = {}
  const finance = {}
  const revisionService = { record: async () => ({}) }
  return new SalesService(
    ...Array.from({ length: 26 }, () => repo),
    audit,
    inventory,
    finance,
    eventBus,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    revisionService
  )
}

test('销售单草稿可以提交', async () => {
  const service = createService({ id: 1, tenantId: 1, status: 'DRAFT', orderNo: 'SO-1' })
  const result = await service.submitOrder(1, user)
  assert.equal(result.status, 'SUBMITTED')
})

test('销售单非法状态禁止提交', async () => {
  const service = createService({ id: 1, tenantId: 1, status: 'APPROVED', orderNo: 'SO-1' })
  await assert.rejects(() => service.submitOrder(1, user), /只有草稿单据可以提交/)
})
