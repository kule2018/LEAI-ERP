import test from 'node:test'
import assert from 'node:assert/strict'
import { comparePassword, DEFAULT_PASSWORD_POLICY, hashPassword, validatePasswordPolicy } from '../apps/server/dist/common/utils/password.util.js'

test('密码哈希不可明文存储且可校验', () => {
  const hash = hashPassword('Admin@123456')
  assert.notEqual(hash, 'Admin@123456')
  assert.ok(hash.startsWith('scrypt$'))
  assert.equal(comparePassword('Admin@123456', hash), true)
  assert.equal(comparePassword('wrong-password', hash), false)
})

test('密码策略：过短或缺少复杂度时给出违规项', () => {
  const errors = validatePasswordPolicy('abc')
  assert.ok(errors.length >= 2)
  assert.ok(errors.some((item) => item.includes('长度')))
  assert.ok(errors.some((item) => item.includes('大写')))
  assert.ok(errors.some((item) => item.includes('数字')))
})

test('密码策略：满足默认策略时无违规项', () => {
  assert.deepEqual(validatePasswordPolicy('Admin@123456'), [])
})

test('密码策略：可按租户策略放宽或收紧', () => {
  const relaxed = { ...DEFAULT_PASSWORD_POLICY, minLength: 4, requireUppercase: false, requireDigit: false }
  assert.deepEqual(validatePasswordPolicy('abcd', relaxed), [])
  const strict = { ...DEFAULT_PASSWORD_POLICY, requireSymbol: true }
  const errors = validatePasswordPolicy('Admin123456', strict)
  assert.equal(errors.length, 1)
  assert.ok(errors[0].includes('特殊字符'))
})
