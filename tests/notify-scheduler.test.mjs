import test from 'node:test'
import assert from 'node:assert/strict'
import {
  renderTemplate, selectChannels, shouldRetry, isTaskDue, isSlowRequest, shouldAlertOnErrors,
  extractTemplateVariables
} from '../apps/server/dist/common/notify-scheduler-rules.js'

// 模板渲染
test('模板变量渲染', () => {
  assert.equal(renderTemplate('销售单 {{orderNo}} 金额 {{amount}}', { orderNo: 'SO-1', amount: 100 }), '销售单 SO-1 金额 100')
})

test('未提供的变量保留原样', () => {
  assert.equal(renderTemplate('{{missing}} 已处理', {}), '{{missing}} 已处理')
})

// 渠道选择
test('渠道选择：高危事件强制加站内信', () => {
  assert.deepEqual(selectChannels(['EMAIL'], 'HIGH'), ['EMAIL', 'INMAIL'])
  assert.deepEqual(selectChannels(['EMAIL'], 'LOW'), ['EMAIL'])
})

test('渠道选择：去重', () => {
  assert.deepEqual(selectChannels(['INMAIL', 'EMAIL'], 'CRITICAL'), ['INMAIL', 'EMAIL'])
})

// 重试判定
test('失败重试：未达上限可重试', () => {
  assert.equal(shouldRetry('FAILED', 0), true)
  assert.equal(shouldRetry('FAILED', 2), true)
  assert.equal(shouldRetry('FAILED', 3), false)
  assert.equal(shouldRetry('SUCCESS', 0), false)
})

// 任务到期
test('任务到期：从未执行立即到期', () => {
  assert.equal(isTaskDue({ lastRunAt: null, intervalMinutes: 60, enabled: true }), true)
})

test('任务到期：间隔未到不执行', () => {
  const lastRunAt = new Date('2026-06-01T10:00:00Z')
  const now = new Date('2026-06-01T10:30:00Z')
  assert.equal(isTaskDue({ lastRunAt, intervalMinutes: 60, enabled: true }, now), false)
  assert.equal(isTaskDue({ lastRunAt, intervalMinutes: 20, enabled: true }, now), true)
})

test('任务到期：禁用或间隔无效不执行', () => {
  assert.equal(isTaskDue({ lastRunAt: null, intervalMinutes: 60, enabled: false }), false)
  assert.equal(isTaskDue({ lastRunAt: null, intervalMinutes: 0, enabled: true }), false)
})

// 慢查询
test('慢查询判定', () => {
  assert.equal(isSlowRequest(2000, 1000), true)
  assert.equal(isSlowRequest(500, 1000), false)
})

// 错误率告警
test('错误率告警：样本不足或比例未超阈值不告警', () => {
  assert.equal(shouldAlertOnErrors(9, 9), false)
  assert.equal(shouldAlertOnErrors(1, 100), false)
})

test('错误率告警：超阈值告警', () => {
  assert.equal(shouldAlertOnErrors(20, 100), true)
})

// 模板变量提取
test('提取模板变量并去重', () => {
  assert.deepEqual(extractTemplateVariables('订单 {{orderNo}} 金额 {{ amount }} {{orderNo}}'), ['orderNo', 'amount'])
})

test('模板无变量时返回空数组', () => {
  assert.deepEqual(extractTemplateVariables('无变量文本'), [])
  assert.deepEqual(extractTemplateVariables(null), [])
})
