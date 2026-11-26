import test from 'node:test'
import assert from 'node:assert/strict'
import {
  aggregateSlowSql,
  buildNotifyDeliveryPayload,
  buildSlowSqlEntry,
  evaluateDeliveryResponse,
  evaluateDuplicatePrint,
  evaluateNotifyChannelConfig,
  evaluateUnauthorizedAttempt,
  isExternalChannel,
  isSlowSql,
  nextPermissionVersion,
  permissionVersionChanged,
  NOTIFY_CHANNELS
} from '../apps/server/dist/common/platform-guard-engine.js'

test('通知渠道清单包含站内信与外部渠道', () => {
  assert.deepEqual([...NOTIFY_CHANNELS], ['INMAIL', 'EMAIL', 'SMS', 'WECOM', 'DINGTALK'])
  assert.equal(isExternalChannel('INMAIL'), false)
  assert.equal(isExternalChannel('EMAIL'), true)
})

test('外部渠道未配置网关时判定为不可投递', () => {
  const result = evaluateNotifyChannelConfig('EMAIL', {})
  assert.equal(result.ok, false)
  assert.ok(result.reason.includes('未配置投递网关'))
})

test('站内信渠道无需网关即可投递', () => {
  const result = evaluateNotifyChannelConfig('INMAIL', {})
  assert.equal(result.ok, true)
  assert.equal(result.gatewayUrl, null)
})

test('未知渠道被拒绝', () => {
  const result = evaluateNotifyChannelConfig('WECHAT', { gatewayUrl: 'http://x' })
  assert.equal(result.ok, false)
  assert.ok(result.reason.includes('不支持'))
})

test('渠道投递报文包含必要字段', () => {
  const payload = buildNotifyDeliveryPayload('SMS', '13800000000', '标题', '内容', { a: 1 })
  assert.equal(payload.channel, 'SMS')
  assert.equal(payload.target, '13800000000')
  assert.equal(payload.title, '标题')
  assert.deepEqual(payload.variables, { a: 1 })
})

test('渠道网关响应状态判定成功与失败', () => {
  assert.equal(evaluateDeliveryResponse(200).success, true)
  assert.equal(evaluateDeliveryResponse(500).success, false)
  assert.ok(evaluateDeliveryResponse(404).message.includes('404'))
})

test('越权访问累计次数达到阈值升级为高危告警', () => {
  assert.equal(evaluateUnauthorizedAttempt(1).alert, false)
  const medium = evaluateUnauthorizedAttempt(3)
  assert.equal(medium.alert, true)
  assert.equal(medium.level, 'LOW')
  const high = evaluateUnauthorizedAttempt(6)
  assert.equal(high.level, 'HIGH')
  assert.ok(high.reason.includes('越权访问'))
})

test('权限版本自增与令牌版本比对', () => {
  assert.equal(nextPermissionVersion(0), 1)
  assert.equal(nextPermissionVersion(3), 4)
  assert.equal(permissionVersionChanged(2, 1), true)
  assert.equal(permissionVersionChanged(2, 2), false)
  assert.equal(permissionVersionChanged(2, undefined), false)
})

test('慢 SQL 阈值判定与条目构造', () => {
  assert.equal(isSlowSql(100, 500), false)
  assert.equal(isSlowSql(800, 500), true)
  const entry = buildSlowSqlEntry('SELECT   *\n FROM t', 800, 12, 500, new Date('2026-01-01T00:00:00.000Z'))
  assert.equal(entry.sql, 'SELECT * FROM t')
  assert.equal(entry.durationMs, 800)
  assert.equal(entry.capturedAt, '2026-01-01T00:00:00.000Z')
})

test('慢 SQL 聚合按语句归并并按总耗时倒序', () => {
  const entries = [
    buildSlowSqlEntry('SELECT 1', 100, 1),
    buildSlowSqlEntry('SELECT 1', 300, 1),
    buildSlowSqlEntry('SELECT 2', 50, 1)
  ]
  const result = aggregateSlowSql(entries)
  assert.equal(result[0].sql, 'SELECT 1')
  assert.equal(result[0].count, 2)
  assert.equal(result[0].totalMs, 400)
  assert.equal(result[0].avgMs, 200)
  assert.equal(result[0].maxMs, 300)
})

test('重复打印提示在时间窗内命中并给出最近打印时间', () => {
  const now = new Date('2026-03-05T10:00:00.000Z')
  const records = [
    { bizType: 'SALES_ORDER', bizId: 1, printedAt: new Date('2026-03-05T09:50:00.000Z') },
    { bizType: 'SALES_ORDER', bizId: 2, printedAt: new Date('2026-03-05T09:55:00.000Z') }
  ]
  const result = evaluateDuplicatePrint(records, 'SALES_ORDER', 1, 30, now)
  assert.equal(result.duplicated, true)
  assert.equal(result.count, 1)
  assert.ok(result.message.includes('重复打印'))

  const missed = evaluateDuplicatePrint(records, 'SALES_ORDER', 1, 5, now)
  assert.equal(missed.duplicated, false)
  assert.equal(missed.message, null)
})
