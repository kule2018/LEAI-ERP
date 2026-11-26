import '../apps/server/node_modules/reflect-metadata/Reflect.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { PrintService } from '../apps/server/dist/modules/print/print.service.js'

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

test('打印记录可生成 PDF 缓冲区', async () => {
  const recordRepo = {
    findOne: async () => ({
      id: 1,
      tenantId: 1,
      bizType: 'SALE_ORDER',
      bizNo: 'SO-001',
      templateId: 1,
      templateCode: 'SALE_A4',
      copies: 1,
      printedBy: 1,
      printedAt: new Date('2026-11-22T10:00:00Z'),
      watermark: 'user-1',
      isDeleted: 0
    }),
    save: async (entity) => entity
  }
  const templateRepo = {
    findOne: async () => ({ id: 1, tenantId: 1, name: 'Sale Order', paper: 'A4', version: 1 })
  }
  const stubRepo = { findOne: async () => null, save: async (entity) => entity, findAndCount: async () => [[], 0] }
  const service = new PrintService(templateRepo, recordRepo, stubRepo, stubRepo, { record: async () => ({}) })
  const buffer = await service.renderRecordPdf(1, user)
  assert.ok(Buffer.isBuffer(buffer))
  assert.equal(buffer.subarray(0, 4).toString(), '%PDF')
})
