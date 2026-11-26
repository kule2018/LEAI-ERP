import test from 'node:test'
import assert from 'node:assert/strict'
import { applyHeaderMapping, buildImportPreview } from '../apps/server/dist/modules/io/io-engine.js'

const config = {
  code: 'customer',
  name: '客户',
  entity: 'customer',
  fields: [
    { key: 'customerName', header: '客户名称', required: true, type: 'string' },
    { key: 'contactPhone', header: '联系电话', required: false, type: 'string' }
  ],
  uniqueKeys: ['customerName']
}

test('字段映射把上传列名替换为模板表头', () => {
  const csv = '客户全称,电话\r\n上海示例,13800000000\r\n'
  const mapped = applyHeaderMapping(csv, { 客户全称: '客户名称', 电话: '联系电话' })
  const preview = buildImportPreview(config, mapped)
  assert.equal(preview.invalid, 0)
  assert.equal(preview.valid, 1)
  assert.equal(preview.rows[0].customerName, '上海示例')
  assert.equal(preview.rows[0].contactPhone, '13800000000')
})

test('未配置映射的列保持原样（仍缺少必填列）', () => {
  const csv = '客户全称,电话\r\n上海示例,13800000000\r\n'
  const mapped = applyHeaderMapping(csv, { 电话: '联系电话' })
  const preview = buildImportPreview(config, mapped)
  assert.equal(preview.valid, 0)
  assert.ok(preview.issues.some((issue) => issue.message.includes('缺少必填列')))
})

test('字段映射保留空行与带引号字段', () => {
  const csv = '客户全称,电话\r\n"上海, 示例",13800000000\r\n'
  const mapped = applyHeaderMapping(csv, { 客户全称: '客户名称' })
  const preview = buildImportPreview(config, mapped)
  assert.equal(preview.valid, 1)
  assert.equal(preview.rows[0].customerName, '上海, 示例')
})
