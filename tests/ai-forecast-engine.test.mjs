import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildModelProbeRequest,
  buildReplenishmentSuggestion,
  checkSuggestionState,
  evaluateForecastAccuracy,
  evaluateModelEndpoint,
  roundToLot
} from '../apps/server/dist/common/ai-forecast-engine.js'

test('补货建议按提前期与安全库存计算净需求', () => {
  const suggestion = buildReplenishmentSuggestion({
    avgQty: 300,
    trendRate: 0,
    availableQty: 100,
    safetyStock: 50,
    leadTimeDays: 30
  })
  assert.equal(suggestion.demandQty, 350)
  assert.equal(suggestion.netQty, 250)
  assert.equal(suggestion.suggestQty, 250)
  assert.equal(suggestion.coverDays, 10)
})

test('可用量充足时不给补货建议', () => {
  const suggestion = buildReplenishmentSuggestion({
    avgQty: 100,
    availableQty: 5000,
    safetyStock: 0,
    leadTimeDays: 30
  })
  assert.equal(suggestion.suggestQty, 0)
  assert.equal(suggestion.level, 'LOW')
  assert.match(suggestion.reason, /暂无补货需求/)
})

test('可用量低于采购提前期时判定为紧急', () => {
  const suggestion = buildReplenishmentSuggestion({
    avgQty: 300,
    availableQty: 150,
    leadTimeDays: 30
  })
  assert.equal(suggestion.level, 'URGENT')
  assert.ok(suggestion.suggestQty > 0)
})

test('补货量按批量倍数向上取整并满足最小起订量', () => {
  assert.equal(roundToLot(11, 10), 20)
  assert.equal(roundToLot(11, 10, 25), 30)
  assert.equal(roundToLot(0, 10, 25), 0)
  const suggestion = buildReplenishmentSuggestion({
    avgQty: 100,
    availableQty: 0,
    leadTimeDays: 30,
    lotSize: 12,
    minOrderQty: 50
  })
  assert.equal(suggestion.suggestQty % 12, 0)
  assert.ok(suggestion.suggestQty >= 50)
})

test('趋势上升时补货量高于趋势为零', () => {
  const flat = buildReplenishmentSuggestion({ avgQty: 300, trendRate: 0, availableQty: 0, leadTimeDays: 30 })
  const rising = buildReplenishmentSuggestion({ avgQty: 300, trendRate: 0.5, availableQty: 0, leadTimeDays: 30 })
  assert.ok(rising.suggestQty > flat.suggestQty)
  assert.ok(rising.confidence < flat.confidence)
})

test('预测准确率按 MAPE 换算并分级', () => {
  const perfect = evaluateForecastAccuracy([100, 200, 300], [100, 200, 300])
  assert.equal(perfect.mape, 0)
  assert.equal(perfect.accuracy, 1)
  assert.equal(perfect.level, 'GOOD')

  const off = evaluateForecastAccuracy([100, 200, 300], [200, 300, 100])
  assert.ok(off.mape > 0)
  assert.ok(off.accuracy < 1)

  const empty = evaluateForecastAccuracy([], [])
  assert.equal(empty.sampleSize, 0)
  assert.equal(empty.level, 'POOR')
})

test('无有效样本时准确率降级为低可信', () => {
  const result = evaluateForecastAccuracy([0, 0], [10, 10])
  assert.equal(result.sampleSize, 0)
  assert.equal(result.level, 'POOR')
})

test('补货建议状态机仅允许待确认状态操作', () => {
  assert.equal(checkSuggestionState('PENDING').ok, true)
  const confirmed = checkSuggestionState('CONFIRMED', 12)
  assert.equal(confirmed.ok, false)
  assert.match(confirmed.reason, /已确认/)
  assert.equal(checkSuggestionState('REJECTED').ok, false)
  assert.equal(checkSuggestionState('UNKNOWN').ok, false)
})

test('外部模型服务接入配置校验', () => {
  assert.equal(evaluateModelEndpoint({}).ok, false)
  assert.equal(evaluateModelEndpoint({ endpoint: 'not-a-url', model: 'gpt' }).ok, false)
  assert.equal(evaluateModelEndpoint({ endpoint: 'ftp://x/y', model: 'gpt' }).ok, false)
  assert.equal(evaluateModelEndpoint({ endpoint: 'https://api.example.com/v1/chat', model: 'gpt' }).ok, true)
  assert.equal(evaluateModelEndpoint({ endpoint: 'https://api.example.com/v1/chat' }).ok, false)
})

test('模型探测请求携带鉴权头且超时时间受限', () => {
  const probe = buildModelProbeRequest({
    endpoint: 'https://api.example.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    apiKey: 'sk-1234567890',
    timeoutMs: 999999
  })
  assert.ok(probe)
  assert.equal(probe.method, 'POST')
  assert.equal(probe.headers.authorization, 'Bearer sk-1234567890')
  assert.equal(probe.body.model, 'gpt-4o-mini')

  const validation = evaluateModelEndpoint({
    endpoint: 'https://api.example.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    timeoutMs: 999999
  })
  assert.equal(validation.timeoutMs, 30000)
  assert.equal(buildModelProbeRequest({ endpoint: '', model: '' }), null)
})
