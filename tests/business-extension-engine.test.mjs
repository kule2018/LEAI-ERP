import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertApprovalFieldsUnchanged, previewScope, buildActivityCalendar, generateWaybillNo,
  quickReply, buildCollectionPlan, serialLabels, todoPriority, sortTodos,
  smartWriteoffSuggestion, collectionLetter
} from '../apps/server/dist/common/business-extension-engine.js'
import { assertRejectReason, assertBizEditable } from '../apps/server/dist/common/approval-guard.js'

test('审批中关键字段变更被识别', () => {
  assert.deepEqual(assertApprovalFieldsUnchanged(
    { amount: '100', customerId: 1 }, { amount: '120', customerId: 1 }, ['amount', 'customerId']
  ), ['amount'])
})

test('全局规则：驳回必须填写原因', () => {
  assert.throws(() => assertRejectReason('REJECT', '  '), /驳回必须填写原因/)
  assert.doesNotThrow(() => assertRejectReason('REJECT', '信用不足'))
  assert.doesNotThrow(() => assertRejectReason('APPROVE', undefined))
})

test('全局规则：审批中禁止修改关键字段，未传可选字段不误判', () => {
  const before = { status: 'SUBMITTED', customerId: 7, totalAmount: '100' }
  assert.doesNotThrow(() => assertBizEditable(before, { remark: '补充说明' }, ['status', 'customerId', 'totalAmount'], { status: 'SUBMITTED' }))
  assert.throws(
    () => assertBizEditable(before, { customerId: 8 }, ['status', 'customerId', 'totalAmount'], { status: 'SUBMITTED' }),
    /禁止修改关键字段/
  )
  assert.doesNotThrow(() => assertBizEditable(before, { customerId: 8 }, ['customerId'], { status: 'DRAFT' }))
})

test('数据权限预览返回命中规则与最终等级', () => {
  const result = previewScope('SALES_ORDER', 'ALL', [
    { bizType: 'SALES_ORDER', orgField: 'dept_id', scopeLevel: 'DEPT', priority: 9, status: 'ENABLED' }
  ])
  assert.equal(result.level, 'DEPT')
  assert.equal(result.orgField, 'dept_id')
  assert.equal(result.matched, 'SALES_ORDER:9')
})

test('活动日历按开始日期分组排序', () => {
  const result = buildActivityCalendar([
    { code: 'B', startTime: '2026-12-02T10:00:00Z', endTime: '2026-12-02T12:00:00Z' },
    { code: 'A', startTime: '2026-12-01T10:00:00Z', endTime: '2026-12-01T12:00:00Z' }
  ])
  assert.equal(result[0].date, '2026-12-01')
  assert.equal(result[0].activities[0].code, 'A')
})

test('电子面单号按承运商生成唯一前缀', () => {
  assert.match(generateWaybillNo('SF', 'order-1'), /^SF\d{10}$/)
  assert.match(generateWaybillNo('YT', 'order-1'), /^YT\d{10}$/)
})

test('快捷回复按关键词匹配排序', () => {
  const result = quickReply('我要退款', [
    { code: 'A', keywords: ['退款'], content: '请提供订单号' },
    { code: 'B', keywords: ['物流'], content: '请稍等' }
  ])
  assert.equal(result[0].code, 'A')
  assert.equal(result[0].matched, true)
})

test('催收计划按逾期天数分级', () => {
  const old = new Date(Date.now() - 40 * 86400000).toISOString()
  const result = buildCollectionPlan([{ id: 1, amount: '100', dueDate: old }])
  assert.equal(result[0].level, 'MANAGER')
})

test('序列号标签批量生成', () => {
  assert.deepEqual(serialLabels('SKU', 1, 2), ['SKU000001', 'SKU000002'])
  assert.deepEqual(serialLabels('SKU', 1, 0), [])
})

test('待办按到期时间分级并排序', () => {
  const past = new Date(Date.now() - 3600000).toISOString()
  const soon = new Date(Date.now() + 3600000).toISOString()
  assert.equal(todoPriority({ dueAt: past }), 'URGENT')
  assert.equal(todoPriority({ dueAt: soon }), 'HIGH')
  const sorted = sortTodos([{ id: 1, dueAt: soon }, { id: 2, dueAt: past }])
  assert.equal(sorted[0].id, 2)
})

test('智能核销建议不超过账单余额与可用额度', () => {
  assert.equal(smartWriteoffSuggestion('100', '40', 30), 30)
  assert.equal(smartWriteoffSuggestion('100', '40', 100), 60)
})

test('催收函包含客户、金额与逾期天数', () => {
  assert.match(collectionLetter('甲公司', '1000', 45), /甲公司.*1000.*45/)
})
