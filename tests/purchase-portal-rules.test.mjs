import test from 'node:test'
import assert from 'node:assert/strict'
import {
  checkPortalDuplicate,
  checkPortalOrderConfirm,
  checkPortalStatementConfirm
} from '../apps/server/dist/modules/purchase/purchase-portal-rules.js'

test('供应商订单确认：可确认状态放行', () => {
  assert.equal(checkPortalOrderConfirm('SUBMITTED', false).allowed, true)
  assert.equal(checkPortalOrderConfirm('APPROVED', false).allowed, true)
  assert.equal(checkPortalOrderConfirm('PARTIAL', false).allowed, true)
})

test('供应商订单确认：草稿与终态拒绝', () => {
  assert.equal(checkPortalOrderConfirm('DRAFT', false).allowed, false)
  assert.equal(checkPortalOrderConfirm('CANCELLED', false).allowed, false)
})

test('供应商订单确认：重复确认被拦截', () => {
  const result = checkPortalOrderConfirm('APPROVED', true)
  assert.equal(result.allowed, false)
  assert.match(result.reason ?? '', /重复填报/)
})

test('供应商对账确认：正常状态放行', () => {
  assert.equal(checkPortalStatementConfirm('PARTIAL', false).allowed, true)
  assert.equal(checkPortalStatementConfirm('PENDING', false).allowed, true)
})

test('供应商对账确认：结清与红冲拒绝', () => {
  assert.equal(checkPortalStatementConfirm('DONE', false).allowed, false)
  assert.equal(checkPortalStatementConfirm('REVERSED', false).allowed, false)
})

test('供应商对账确认：重复确认被拦截', () => {
  assert.equal(checkPortalStatementConfirm('PARTIAL', true).allowed, false)
})

test('自助填报单据号重复校验', () => {
  assert.equal(checkPortalDuplicate('WAYBILL', false).allowed, true)
  assert.match(checkPortalDuplicate('WAYBILL', true).reason ?? '', /运单号/)
  assert.match(checkPortalDuplicate('INVOICE', true).reason ?? '', /发票号/)
})
