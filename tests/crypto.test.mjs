import test from 'node:test'
import assert from 'node:assert/strict'
import { maskSecret, sealSecret, unsealSecret } from '../apps/server/dist/common/utils/crypto.util.js'

test('密钥加密后可还原且掩码不泄露原文', () => {
  const secret = 'whsec_abcdefghijklmnop'
  const encrypted = sealSecret(secret)
  assert.notEqual(encrypted, secret)
  assert.equal(unsealSecret(encrypted), secret)
  assert.equal(unsealSecret('invalid'), null)
  const masked = maskSecret(secret)
  assert.ok(!masked.includes(secret))
  assert.ok(masked.includes('****'))
})
