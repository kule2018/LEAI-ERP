import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyOcrCorrections, parseDocumentFile, selectGrayModel, buildReportExport, buildAttributionDrill
} from '../apps/server/dist/common/ai-extension-engine.js'

test('OCR 人工修正覆盖字段并提升置信度', () => {
  const result = applyOcrCorrections([
    { key: 'amount', value: '100', confidence: 0.8 },
    { key: 'invoiceNo', value: 'A001', confidence: 0.9 }
  ], { amount: '120' })
  assert.deepEqual(result.corrected, ['amount'])
  assert.equal(result.fields[0].value, '120')
  assert.equal(result.fields[0].confidence, 1)
  assert.equal(result.confidence, 0.95)
})

test('CSV/Excel 文本解析为明细行', () => {
  const result = parseDocumentFile('order.csv', 'text/csv', '产品,数量\nA,2\nB,3')
  assert.equal(result.format, 'CSV')
  assert.deepEqual(result.lines, [{ 产品: 'A', 数量: '2' }, { 产品: 'B', 数量: '3' }])
})

test('PDF 与图片提示需要 OCR', () => {
  const pdf = parseDocumentFile('a.pdf', 'application/pdf', '扫描文本')
  assert.equal(pdf.format, 'PDF')
  assert.match(pdf.warnings[0], /OCR/)
  const image = parseDocumentFile('a.png', 'image/png', '识别文本')
  assert.equal(image.format, 'IMAGE')
})

test('模型灰度按稳定哈希分流且全量优先', () => {
  const configs = [
    { code: 'BASE', capability: 'ai.forecast', grayPercent: 0, status: 'ENABLED', isDefault: 1 },
    { code: 'NEW', capability: 'ai.forecast', grayPercent: 100, status: 'ENABLED', isDefault: 0 }
  ]
  assert.equal(selectGrayModel(configs, 'ai.forecast', 'user-1').code, 'NEW')
  assert.equal(selectGrayModel([configs[0]], 'ai.ocr', 'user-1'), null)
})

test('报表导出包含诊断、引用与指标', () => {
  const csv = buildReportExport(['收入下降'], [{ field: 'revenue', source: 'sales', value: 100 }], { revenue: 100, cost: 80 })
  assert.match(csv, /收入下降/)
  assert.match(csv, /revenue/)
  assert.match(csv, /100/)
})

test('归因下钻输出维度贡献与风险', () => {
  const result = buildAttributionDrill({ revenue: 200, cost: 150, overdueAmount: 20 }, 'customer')
  assert.equal(result.length, 3)
  assert.equal(result[0].dimension, 'customer')
  assert.equal(result[0].value, 50)
})
