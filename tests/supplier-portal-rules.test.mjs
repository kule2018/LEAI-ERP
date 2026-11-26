import test from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluatePortalAccountStatus,
  evaluatePortalLogin,
  evaluatePortalLoginFailure,
  evaluateSupplierOwnership,
  PORTAL_MAX_FAILED_ATTEMPTS
} from '../apps/server/dist/common/supplier-portal-rules.js'

test('门户账号停用时拒绝登录', () => {
  const decision = evaluatePortalLogin({ status: 'DISABLED', failedLoginCount: 0 })
  assert.equal(decision.allowed, false)
  assert.match(decision.reason, /已停用/)
  assert.equal(decision.countFailure, false)
})

test('门户账号锁定期内拒绝登录', () => {
  const now = new Date('2026-11-23T10:00:00Z')
  const decision = evaluatePortalLogin(
    { status: 'ACTIVE', failedLoginCount: 5, lockUntil: new Date('2026-11-23T10:05:00Z') },
    now
  )
  assert.equal(decision.allowed, false)
  assert.match(decision.reason, /锁定/)
})

test('门户账号正常时允许登录', () => {
  const decision = evaluatePortalLogin({ status: 'ACTIVE', failedLoginCount: 0 })
  assert.equal(decision.allowed, true)
  assert.equal(decision.reason, '')
})

test('连续登录失败达到阈值触发锁定', () => {
  let decision = evaluatePortalLoginFailure(PORTAL_MAX_FAILED_ATTEMPTS - 1)
  assert.equal(decision.shouldLock, true)
  decision = evaluatePortalLoginFailure(0)
  assert.equal(decision.shouldLock, false)
  assert.equal(decision.countFailure, true)
})

test('门户数据按供应商隔离，跨供应商访问被拒绝', () => {
  assert.equal(evaluateSupplierOwnership(7, 7).allowed, true)
  const denied = evaluateSupplierOwnership(8, 7)
  assert.equal(denied.allowed, false)
  assert.match(denied.reason, /不属于当前供应商/)
  assert.equal(evaluateSupplierOwnership(null, 7).allowed, false)
})

test('门户账号状态流转仅允许启用与停用', () => {
  assert.equal(evaluatePortalAccountStatus('ACTIVE').allowed, true)
  assert.equal(evaluatePortalAccountStatus('DISABLED').allowed, true)
  assert.equal(evaluatePortalAccountStatus('LOCKED').allowed, false)
})
