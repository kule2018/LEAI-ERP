import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildStatementAiSuggestion,
  buildStatementDiff,
  buildTrackingTimeline,
  buildWaveReviewPlan,
  checkExceptionInput,
  checkExchangeAllowed,
  checkWaveShippable,
  computeShiftClose,
  exceptionSeverity,
  matchPromotionBundles,
  selectPromotionBundles
} from '../apps/server/dist/common/sales-delivery-engine.js'

test('波次未拣完时不允许复核', () => {
  const plan = buildWaveReviewPlan({
    waveNo: 'W1',
    status: 'PICKING',
    tasks: [
      { id: 1, productId: 10, qty: 5, pickedQty: 5, status: 'DONE' },
      { id: 2, productId: 11, qty: 3, pickedQty: 1, status: 'PICKING' }
    ]
  })
  assert.equal(plan.ready, false)
  assert.equal(plan.shortPicked, 1)
})

test('波次未复核时禁止发货，复核后放行', () => {
  const tasks = [{ id: 1, productId: 10, qty: 5, pickedQty: 5, status: 'DONE' }]
  assert.equal(checkWaveShippable({ waveNo: 'W1', status: 'PICKING', tasks }).allowed, false)
  assert.equal(checkWaveShippable({ waveNo: 'W1', status: 'REVIEWED', tasks }).allowed, true)
  assert.equal(checkWaveShippable({ waveNo: 'W1', status: 'DONE', tasks }).allowed, true)
})

test('交班现金核对：无差异为 OK', () => {
  const result = computeShiftClose({
    openingCash: 1000,
    cashReceived: 500,
    otherIncome: 0,
    actualCash: 1500,
    orderCount: 6,
    orderAmount: 1500
  })
  assert.equal(result.expectedCash, 1500)
  assert.equal(result.difference, 0)
  assert.equal(result.level, 'OK')
})

test('交班现金差异超阈值需主管审批', () => {
  const result = computeShiftClose({
    openingCash: 1000,
    cashReceived: 500,
    otherIncome: 0,
    actualCash: 1400,
    orderCount: 6,
    orderAmount: 1500
  })
  assert.equal(result.difference, -100)
  assert.equal(result.level, 'ALARM')
  assert.equal(result.requireApproval, true)
})

test('套装促销需成分齐套且套装价低于标准合计', () => {
  const rules = [{
    id: 1,
    code: 'B1',
    name: '办公套装',
    type: 'COMBO',
    items: [{ productId: 10, qty: 1 }, { productId: 11, qty: 1 }],
    comboPrice: 150,
    priority: 10,
    status: 'ENABLED'
  }]
  const matched = matchPromotionBundles([
    { productId: 10, qty: 1, unitPrice: 100 },
    { productId: 11, qty: 1, unitPrice: 100 }
  ], rules, '2026-01-10')
  assert.equal(matched.length, 1)
  assert.equal(matched[0].discountAmount, 50)
  assert.equal(matchPromotionBundles([{ productId: 10, qty: 1, unitPrice: 100 }], rules, '2026-01-10').length, 0)
})

test('满减促销按整单门槛生效', () => {
  const rules = [{
    id: 2,
    code: 'F1',
    name: '满 500 减 50',
    type: 'FULL_REDUCTION',
    items: [],
    thresholdAmount: 500,
    discountAmount: 50,
    priority: 5,
    status: 'ENABLED'
  }]
  assert.equal(matchPromotionBundles([{ productId: 1, qty: 1, unitPrice: 600 }], rules, '2026-01-10')[0].discountAmount, 50)
  assert.equal(matchPromotionBundles([{ productId: 1, qty: 1, unitPrice: 300 }], rules, '2026-01-10').length, 0)
})

test('促销商品行重叠时不重复优惠', () => {
  const rules = [
    {
      id: 1, code: 'B1', name: '套装', type: 'COMBO',
      items: [{ productId: 10, qty: 1 }], comboPrice: 80, priority: 10, status: 'ENABLED'
    },
    {
      id: 2, code: 'F1', name: '满减', type: 'FULL_REDUCTION',
      items: [], thresholdAmount: 100, discountAmount: 30, priority: 5, status: 'ENABLED'
    }
  ]
  const selected = selectPromotionBundles([{ productId: 10, qty: 1, unitPrice: 100 }], rules, '2026-01-10')
  assert.equal(selected.applied.length, 1)
  assert.equal(selected.totalDiscount, 20)
})

test('过期促销不参与匹配', () => {
  const rules = [{
    id: 1, code: 'B1', name: '套装', type: 'COMBO',
    items: [{ productId: 10, qty: 1 }], comboPrice: 80, priority: 1, status: 'ENABLED',
    startDate: '2026-01-01', endDate: '2026-01-31'
  }]
  assert.equal(matchPromotionBundles([{ productId: 10, qty: 1, unitPrice: 100 }], rules, '2026-02-10').length, 0)
})

test('换货需退货审批通过且质检合格', () => {
  assert.equal(checkExchangeAllowed({ returnStatus: 'DRAFT', approved: false, qcPassed: true, returnQty: 2, exchangeQty: 1 }).allowed, false)
  assert.equal(checkExchangeAllowed({ returnStatus: 'APPROVED', approved: true, qcPassed: false, returnQty: 2, exchangeQty: 1 }).allowed, false)
  assert.equal(checkExchangeAllowed({ returnStatus: 'APPROVED', approved: true, qcPassed: true, returnQty: 2, exchangeQty: 3 }).allowed, false)
  assert.equal(checkExchangeAllowed({ returnStatus: 'APPROVED', approved: true, qcPassed: true, returnQty: 2, exchangeQty: 1 }).allowed, true)
})

test('对账差异标记区分一般与重大差异', () => {
  const ok = buildStatementDiff({ statementAmount: 1000, orderAmount: 1000, settledAmount: 0, reversedAmount: 0, itemCount: 3 })
  assert.equal(ok.flag, 'NO')
  const minor = buildStatementDiff({ statementAmount: 1020, orderAmount: 1000, settledAmount: 0, reversedAmount: 0, itemCount: 3 })
  assert.equal(minor.flag, 'MINOR')
  const major = buildStatementDiff({ statementAmount: 2000, orderAmount: 1000, settledAmount: 0, reversedAmount: 0, itemCount: 3 })
  assert.equal(major.flag, 'MAJOR')
  const over = buildStatementDiff({ statementAmount: 1000, orderAmount: 1000, settledAmount: 1200, reversedAmount: 0, itemCount: 3 })
  assert.equal(over.flag, 'MAJOR')
})

test('AI 对账建议带依据与置信度', () => {
  const diff = buildStatementDiff({ statementAmount: 1200, orderAmount: 1000, settledAmount: 0, reversedAmount: 0, itemCount: 2 })
  const suggestions = buildStatementAiSuggestion(diff, {
    statementAmount: 1200, orderAmount: 1000, settledAmount: 0, reversedAmount: 0, itemCount: 2
  })
  assert.ok(suggestions.length > 0)
  for (const item of suggestions) {
    assert.ok(item.confidence > 0 && item.confidence <= 1)
    assert.ok(item.evidence.length > 0)
    assert.ok(item.action.length > 0)
  }
})

test('物流轨迹按时间排序并标记当前节点', () => {
  const timeline = buildTrackingTimeline([
    { nodeCode: 'SHIPPED', nodeName: '已发运', nodeTime: '2026-01-02T10:00:00.000Z' },
    { nodeCode: 'CREATED', nodeName: '已创建', nodeTime: '2026-01-01T10:00:00.000Z' }
  ])
  assert.equal(timeline[0].nodeCode, 'CREATED')
  assert.equal(timeline[1].isCurrent, true)
  assert.equal(timeline[0].step, 1)
})

test('异常回单必须填写描述与凭证照片', () => {
  assert.equal(checkExceptionInput({ type: 'LOST', description: '' }).allowed, false)
  assert.equal(checkExceptionInput({ type: 'LOST', description: '货物丢失', evidenceUrls: [] }).allowed, false)
  assert.equal(checkExceptionInput({ type: 'LOST', description: '货物丢失', evidenceUrls: ['a.png'] }).allowed, true)
  assert.equal(checkExceptionInput({ type: 'UNKNOWN', description: 'x', evidenceUrls: ['a.png'] }).allowed, false)
})

test('异常严重度按类型判定', () => {
  assert.equal(exceptionSeverity('LOST'), 'HIGH')
  assert.equal(exceptionSeverity('DAMAGED'), 'HIGH')
  assert.equal(exceptionSeverity('REJECTED'), 'MEDIUM')
  assert.equal(exceptionSeverity('OTHER'), 'LOW')
})
