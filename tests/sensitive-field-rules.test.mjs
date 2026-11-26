import test from 'node:test'
import assert from 'node:assert/strict'
import { isSensitiveField, maskSensitiveValue } from '../apps/server/src/common/export-guard-engine.ts'

test('供应商银行账号相关字段按敏感字段识别', () => {
  assert.equal(isSensitiveField('bankAccount'), true)
  assert.equal(isSensitiveField('bankAccountEncrypted'), true)
  assert.equal(isSensitiveField('bank_account_mask'), true)
  assert.equal(isSensitiveField('accountNo'), true)
  assert.equal(isSensitiveField('accountNoEncrypted'), true)
})

test('普通业务字段不被误判为敏感字段', () => {
  assert.equal(isSensitiveField('supplierName'), false)
  assert.equal(isSensitiveField('bankName'), false)
  assert.equal(isSensitiveField('accountName'), false)
})

test('敏感值掩码保留首尾片段且不泄露完整内容', () => {
  assert.equal(maskSensitiveValue('6222021234567890123'), '6222****0123')
  assert.equal(maskSensitiveValue('110101199001011234'), '110101********1234')
  assert.equal(maskSensitiveValue('enc:v1:abc'), 'enc:v1:****')
})
