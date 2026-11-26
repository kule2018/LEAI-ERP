import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isSensitiveField, buildCsvWatermark, appendWatermark, maskSensitiveValue,
  sanitizeExportRow, maskSensitiveText
} from '../apps/server/dist/common/export-guard-engine.js'

test('识别敏感字段名', () => {
  assert.equal(isSensitiveField('contactPhone'), true)
  assert.equal(isSensitiveField('bank_account'), true)
  assert.equal(isSensitiveField('apiKey'), true)
  assert.equal(isSensitiveField('customerName'), false)
})

test('水印包含租户用户与时间', () => {
  const watermark = buildCsvWatermark({ tenantId: 3, userId: 9, username: 'admin' }, new Date('2026-01-01T00:00:00Z'))
  assert.equal(watermark.code, 'tenant-3-user-9-1767225600000')
  assert.equal(watermark.username, 'admin')
})

test('水印追加在数据行之后不破坏表头', () => {
  const rows = appendWatermark([['姓名', '手机'], ['张三', '13800138000']], {
    code: 'W1', username: 'admin', exportedAt: '2026-01-01T00:00:00.000Z'
  })
  assert.deepEqual(rows[0], ['姓名', '手机'])
  assert.deepEqual(rows[rows.length - 3], ['水印编码', 'W1'])
})

test('按值形态掩码手机银行卡身份证与密文', () => {
  assert.equal(maskSensitiveValue('13800138000'), '138****8000')
  assert.equal(maskSensitiveValue('6222021234567890123'), '6222****0123')
  assert.equal(maskSensitiveValue('110101199001011234'), '110101********1234')
  assert.equal(maskSensitiveValue('enc:v1:abc'), 'enc:v1:****')
})

test('整行脱敏不影响普通字段', () => {
  assert.deepEqual(sanitizeExportRow(['张三', '13800138000']), ['张三', '138****8000'])
})

test('JSON 文本中的敏感号码也被掩码', () => {
  const text = maskSensitiveText('{"phone":"13800138000","bankAccount":"6222021234567890123"}')
  assert.match(text, /138\*\*\*\*8000/)
  assert.match(text, /6222\*\*\*\*0123/)
})

test('水印开关关闭时不追加水印块', () => {
  const rows = appendWatermark([['姓名']], { code: 'W1', username: 'admin', exportedAt: 'T' }, { enabled: false })
  assert.deepEqual(rows, [['姓名']])
})

test('水印说明文案作为附加行写入', () => {
  const rows = appendWatermark([['姓名']], { code: 'W1', username: 'admin', exportedAt: 'T' }, { extraText: '内部资料' })
  assert.deepEqual(rows[rows.length - 1], ['水印说明', '内部资料'])
})
