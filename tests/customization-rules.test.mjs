import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyCustomDefaults,
  buildCustomFormSchema,
  coerceCustomValue,
  evaluateCustomCondition,
  normalizeCustomField,
  sanitizeCustomValues,
  validateCustomValues
} from '../apps/server/dist/common/custom-field-engine.js'
import {
  buildRevisionPayload,
  diffSnapshots,
  nextRevisionVersion,
  summarizeRevisionDiff
} from '../apps/server/dist/common/revision-engine.js'
import {
  ALERT_DEFAULT_THRESHOLDS,
  alertSeverityWeight,
  collectAlertRules,
  compareAlertValue,
  matchAlertRule,
  resolveAlertThreshold,
  resolveAlertThresholds
} from '../apps/server/dist/common/alert-rule-engine.js'
import {
  matchNotifyRules,
  requiresExplicitReceiver,
  resolveRuleChannels
} from '../apps/server/dist/common/notify-rule-engine.js'

const FIELDS = [
  { fieldKey: 'level', fieldLabel: '等级', fieldType: 'SELECT', options: [{ label: 'A', value: 'A' }], required: true },
  { fieldKey: 'amount', fieldLabel: '金额', fieldType: 'NUMBER', min: 0, max: 100 },
  { fieldKey: 'remark', fieldLabel: '备注', fieldType: 'TEXT', maxLength: 5 },
  { fieldKey: 'code', fieldLabel: '编码', fieldType: 'TEXT', pattern: '^[A-Z]{2}$' },
  { fieldKey: 'vipLevel', fieldLabel: 'VIP等级', fieldType: 'TEXT', condition: { fieldKey: 'level', operator: 'EQ', value: 'A' } }
]

test('自定义字段规范化补齐默认值', () => {
  const field = normalizeCustomField({ fieldKey: 'a', fieldLabel: '', fieldType: 'UNKNOWN' })
  assert.equal(field.fieldType, 'TEXT')
  assert.equal(field.groupName, '基础信息')
  assert.equal(field.required, false)
  assert.equal(field.visibleInList, true)
})

test('自定义字段类型转换', () => {
  assert.equal(coerceCustomValue({ fieldType: 'NUMBER' }, '12'), 12)
  assert.equal(coerceCustomValue({ fieldType: 'BOOLEAN' }, '1'), true)
  assert.deepEqual(coerceCustomValue({ fieldType: 'MULTI_SELECT' }, 'a, b'), ['a', 'b'])
  assert.equal(coerceCustomValue({ fieldType: 'TEXT' }, 5), '5')
})

test('自定义字段条件显隐', () => {
  assert.equal(evaluateCustomCondition(null, {}), true)
  assert.equal(evaluateCustomCondition({ fieldKey: 'level', operator: 'EQ', value: 'A' }, { level: 'A' }), true)
  assert.equal(evaluateCustomCondition({ fieldKey: 'level', operator: 'EQ', value: 'A' }, { level: 'B' }), false)
  assert.equal(evaluateCustomCondition({ fieldKey: 'n', operator: 'GTE', value: 10 }, { n: 12 }), true)
  assert.equal(evaluateCustomCondition({ fieldKey: 's', operator: 'IN', value: 'x,y' }, { s: 'y' }), true)
})

test('自定义字段表单结构按分组聚合并标记可见性', () => {
  const groups = buildCustomFormSchema(FIELDS, { level: 'A' })
  const names = groups.map((group) => group.groupName)
  assert.ok(names.length >= 1)
  const all = groups.flatMap((group) => group.fields)
  const vip = all.find((field) => field.fieldKey === 'vipLevel')
  assert.equal(vip.visible, true)
  const hidden = buildCustomFormSchema(FIELDS, { level: 'B' }).flatMap((g) => g.fields).find((f) => f.fieldKey === 'vipLevel')
  assert.equal(hidden.visible, false)
})

test('自定义字段默认值填充与脏值清洗', () => {
  const filled = applyCustomDefaults([{ fieldKey: 'a', fieldType: 'NUMBER', defaultValue: '3' }], {})
  assert.equal(filled.a, 3)
  const sanitized = sanitizeCustomValues(FIELDS, { level: 'A', unknown: 'x', amount: '7' })
  assert.equal(sanitized.unknown, undefined)
  assert.equal(sanitized.amount, 7)
})

test('自定义字段校验覆盖必填、区间、长度、正则与候选', () => {
  const result = validateCustomValues(FIELDS, { level: '', amount: 200, remark: 'abcdefg', code: 'ab' })
  assert.equal(result.ok, false)
  const keys = result.errors.map((item) => item.fieldKey)
  assert.ok(keys.includes('level'))
  assert.ok(keys.includes('amount'))
  assert.ok(keys.includes('remark'))
  assert.ok(keys.includes('code'))
  assert.equal(validateCustomValues(FIELDS, { level: 'A', amount: 10, remark: 'abc', code: 'AB' }).ok, true)
})

test('快照比对输出新增、删除与变更', () => {
  const entries = diffSnapshots({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 })
  const types = entries.map((item) => `${item.field}:${item.type}`)
  assert.ok(types.includes('b:CHANGED'))
  assert.ok(types.includes('c:ADDED'))
})

test('快照比对忽略技术字段', () => {
  const entries = diffSnapshots({ id: 1, updatedAt: 'x', total: 10 }, { id: 2, updatedAt: 'y', total: 10 })
  assert.equal(entries.length, 0)
})

test('版本号推进与变更摘要', () => {
  assert.equal(nextRevisionVersion(), 1)
  assert.equal(nextRevisionVersion(3), 4)
  const summary = summarizeRevisionDiff(diffSnapshots({ a: 1 }, { a: 2, b: 3 }))
  assert.equal(summary.changed, 1)
  assert.equal(summary.added, 1)
  assert.equal(summary.total, 2)
})

test('快照载荷剔除不可序列化内容', () => {
  const payload = buildRevisionPayload({ a: 1, b: { c: 2 } })
  assert.deepEqual(payload, { a: 1, b: { c: 2 } })
})

test('告警比较符与规则命中', () => {
  assert.equal(compareAlertValue(5, 'GT', 3), true)
  assert.equal(compareAlertValue(5, 'LT', 3), false)
  assert.equal(matchAlertRule({ enabled: true, comparator: 'GTE', threshold: 5 }, 5), true)
  assert.equal(matchAlertRule({ enabled: false, comparator: 'GTE', threshold: 5 }, 5), false)
})

test('告警阈值优先取启用规则否则回落默认', () => {
  const rules = [{ ruleCode: 'r1', bizType: 'risk', metric: 'AR_HIGH_DAYS', comparator: 'GT', threshold: 60, severity: 'HIGH', enabled: true }]
  assert.equal(resolveAlertThreshold(rules, 'AR_HIGH_DAYS'), 60)
  assert.equal(resolveAlertThreshold([], 'AR_HIGH_DAYS'), ALERT_DEFAULT_THRESHOLDS.AR_HIGH_DAYS)
  assert.equal(resolveAlertThreshold([{ ...rules[0], enabled: false }], 'AR_HIGH_DAYS'), ALERT_DEFAULT_THRESHOLDS.AR_HIGH_DAYS)
})

test('告警规则按业务域筛选并批量解析阈值', () => {
  const rules = [
    { ruleCode: 'r1', bizType: 'risk', metric: 'AR_HIGH_DAYS', comparator: 'GT', threshold: 60, severity: 'HIGH', enabled: true },
    { ruleCode: 'r2', bizType: 'inventory', metric: 'STOCK_CRITICAL_RATIO', comparator: 'GT', threshold: 0.3, severity: 'HIGH', enabled: true }
  ]
  assert.equal(collectAlertRules(rules, 'risk').length, 1)
  const thresholds = resolveAlertThresholds(rules, ['AR_HIGH_DAYS', 'STOCK_CRITICAL_RATIO'])
  assert.equal(thresholds.AR_HIGH_DAYS, 60)
  assert.equal(thresholds.STOCK_CRITICAL_RATIO, 0.3)
})

test('告警严重度权重排序', () => {
  assert.ok(alertSeverityWeight('CRITICAL') > alertSeverityWeight('HIGH'))
  assert.ok(alertSeverityWeight('HIGH') > alertSeverityWeight('LOW'))
})

const NOTIFY_RULES = [
  {
    ruleCode: 'R1', ruleName: '订单提交通知', eventType: 'SALE_ORDER_SUBMIT', bizType: 'sales',
    templateCode: 'T1', channels: ['EMAIL'], level: 'HIGH', receiverType: 'ROLE', receiverIds: [1], priority: 10, enabled: true
  },
  {
    ruleCode: 'R2', ruleName: '库存通知', eventType: 'STOCK_ALERT', bizType: 'inventory',
    templateCode: 'T2', channels: [], level: 'LOW', receiverType: 'ALL', receiverIds: [], priority: 50, enabled: true
  },
  {
    ruleCode: 'R3', ruleName: '停用规则', eventType: 'SALE_ORDER_SUBMIT', bizType: 'sales',
    templateCode: 'T3', channels: [], level: 'LOW', receiverType: 'ALL', receiverIds: [], priority: 1, enabled: false
  }
]

test('通知规则按事件匹配并忽略停用规则', () => {
  const matched = matchNotifyRules(NOTIFY_RULES, 'SALE_ORDER_SUBMIT')
  assert.equal(matched.length, 1)
  assert.equal(matched[0].ruleCode, 'R1')
})

test('通知规则级别门槛过滤', () => {
  const matched = matchNotifyRules(NOTIFY_RULES, 'SALE_ORDER_SUBMIT', 'CRITICAL')
  assert.equal(matched.length, 0)
})

test('通知渠道回落模板渠道且高危级别强制站内信', () => {
  const rule = NOTIFY_RULES[0]
  assert.deepEqual(resolveRuleChannels(rule, ['INMAIL']).sort(), ['EMAIL', 'INMAIL'])
  const low = NOTIFY_RULES[1]
  assert.deepEqual(resolveRuleChannels(low, ['INMAIL']), ['INMAIL'])
})

test('通知规则缺少显式接收人时判定为不完整', () => {
  assert.equal(requiresExplicitReceiver(NOTIFY_RULES[0]), false)
  assert.equal(requiresExplicitReceiver({ ...NOTIFY_RULES[0], receiverIds: [] }), true)
  assert.equal(requiresExplicitReceiver({ ...NOTIFY_RULES[0], receiverType: 'ALL', receiverIds: [] }), false)
})
