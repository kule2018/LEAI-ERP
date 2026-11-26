import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validatePrintTemplate, expandPrintLoops, barcodeSvg, renderPrintFields
} from '../apps/server/dist/common/print-template-engine.js'

test('模板发布校验检查正文、循环区与字段绑定', () => {
  assert.equal(validatePrintTemplate({ body: '<p>{{order.no}}</p>' }).valid, true)
  const result = validatePrintTemplate({
    body: '',
    loops: [{ key: '', itemTemplate: '' }],
    fieldBindings: [{ key: 'a', source: '' }],
    barcodeFields: [{ key: 'code', type: 'INVALID' }],
    logoUrl: 'javascript:alert(1)'
  })
  assert.equal(result.valid, false)
  assert.ok(result.errors.length >= 4)
})

test('循环区按数组数据展开', () => {
  const html = '<ul>{{#each lines}}<li>{{lines.name}}</li>{{/each}}</ul>'
  const result = expandPrintLoops(html, [{ key: 'lines', itemTemplate: '<li>{{lines.name}}</li>' }], {
    lines: [{ name: 'A' }, { name: 'B' }]
  })
  assert.equal(result, '<ul><li>A</li><li>B</li></ul>')
})

test('条码与二维码生成 SVG', () => {
  assert.match(barcodeSvg('123456', 'CODE128'), /<svg/)
  assert.match(barcodeSvg('123456', 'QR'), /<rect/)
})

test('字段绑定、LOGO与码图占位符一起渲染', () => {
  const schema = {
    body: '{{logo}}{{bind:customer}}{{barcode:code}}',
    fieldBindings: [{ key: 'customer', source: 'customerName' }],
    logoUrl: '/uploads/logo.png',
    barcodeFields: [{ key: 'code', type: 'QR' }]
  }
  const result = renderPrintFields(schema.body, schema, { customerName: '张三', code: 'CODE1' })
  assert.match(result, /logo\.png/)
  assert.match(result, /张三/)
  assert.match(result, /<svg/)
})
