import test from 'node:test'
import assert from 'node:assert/strict'
import { encodeCsv, encodeCsvRow, parseCsv, parseCsvTable } from '../apps/server/dist/common/csv.js'
import { buildImportPreview, buildTemplateCsv } from '../apps/server/dist/modules/io/io-engine.js'

const customerConfig = {
  code: 'customer',
  name: '客户',
  uniqueKeys: ['customerCode'],
  fields: [
    { header: '客户编码', key: 'customerCode', required: true, maxLength: 50 },
    { header: '客户名称', key: 'customerName', required: true, maxLength: 10 },
    { header: '信用额度', key: 'creditLimit', type: 'decimal' },
    { header: '状态', key: 'status', transform: (v) => (v.toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') }
  ]
}

test('CSV 编码解码保留逗号、引号与换行', () => {
  const rows = [['a,b', '说"你好"', 'line1\nline2'], ['普通', 42, '']]
  const text = encodeCsv(rows)
  assert.deepEqual(parseCsv(text), rows.map((r) => r.map(String)))
})

test('CSV 带 BOM 可被正确解析', () => {
  const text = encodeCsv([['客户编码', '客户名称'], ['C001', '张三']], { bom: true })
  assert.equal(text.charCodeAt(0), 0xfeff)
  const table = parseCsvTable(text)
  assert.deepEqual(table.headers, ['客户编码', '客户名称'])
  assert.equal(table.rows[0].客户名称, '张三')
})

test('模板只含表头且带 BOM', () => {
  const text = buildTemplateCsv(customerConfig)
  assert.equal(text.charCodeAt(0), 0xfeff)
  assert.deepEqual(parseCsvTable(text).headers, ['客户编码', '客户名称', '信用额度', '状态'])
})

test('合法行被映射并应用 transform', () => {
  const csv = '客户编码,客户名称,信用额度,状态\r\nC001,张三,1000,inactive\r\n'
  const preview = buildImportPreview(customerConfig, csv)
  assert.equal(preview.total, 1)
  assert.equal(preview.valid, 1)
  assert.equal(preview.invalid, 0)
  assert.equal(preview.rows[0].creditLimit, '1000')
  assert.equal(preview.rows[0].status, 'INACTIVE')
})

test('必填缺失与长度超限被标记为错误行且不进入有效集', () => {
  const csv = '客户编码,客户名称,信用额度,状态\r\n,张三,100,ACTIVE\r\nC002,超长超长超长超长超长超长超长超长超长超长,100,ACTIVE\r\n'
  const preview = buildImportPreview(customerConfig, csv)
  assert.equal(preview.total, 2)
  assert.equal(preview.valid, 0)
  assert.equal(preview.invalid, 2)
  assert.ok(preview.issues.some((i) => i.field === '客户编码' && /不能为空/.test(i.message)))
  assert.ok(preview.issues.some((i) => i.field === '客户名称' && /超过/.test(i.message)))
})

test('非法数值被拦截', () => {
  const csv = '客户编码,客户名称,信用额度,状态\r\nC003,李四,abc,ACTIVE\r\n'
  const preview = buildImportPreview(customerConfig, csv)
  assert.equal(preview.invalid, 1)
  assert.ok(preview.issues.some((i) => i.field === '信用额度' && /数值/.test(i.message)))
})

test('批次内唯一键重复被拦截，重复行不落库', () => {
  const csv = '客户编码,客户名称,信用额度,状态\r\nC001,张三,100,ACTIVE\r\nC001,张三副本,200,ACTIVE\r\nC002,李四,300,ACTIVE\r\n'
  const preview = buildImportPreview(customerConfig, csv)
  assert.equal(preview.total, 3)
  assert.equal(preview.valid, 2)
  assert.equal(preview.invalid, 1)
  assert.ok(preview.issues.some((i) => /批次内重复/.test(i.message)))
})

test('缺少必要表头时在 issues 中报告', () => {
  const csv = '客户编码,信用额度\r\nC001,100\r\n'
  const preview = buildImportPreview(customerConfig, csv)
  assert.ok(preview.issues.some((i) => i.row === 0 && /缺少必填列：客户名称/.test(i.message)))
})

test('单行编码特殊字符', () => {
  assert.equal(encodeCsvRow(['a', null, 'x"y']), 'a,,"x""y"')
})
