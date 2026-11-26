import test from 'node:test'
import assert from 'node:assert/strict'
import {
  abcAnalysis, buildPutawayRules, inTransitSummary, inventoryAging, optimizePickPath,
  putawayStrategyMatch, stockInOutReport
} from '../apps/server/dist/common/inventory-extension-engine.js'

test('上架策略规则构建器按优先级编译规则集', () => {
  const rules = buildPutawayRules({
    mixedBatch: false, temperatureControlled: true, bigItemFirst: true,
    fastTurnoverFirst: true, weightThreshold: 100, zone: 'FAST'
  })
  assert.equal(rules[0].ruleType, 'TEMPERATURE')
  assert.equal(rules[1].ruleType, 'BATCH')
  assert.equal(rules[2].ruleType, 'ZONE')
  assert.ok(rules.length >= 6)
  assert.deepEqual(rules.map((r) => r.priority), rules.map((_, index) => index + 1))
})

test('上架策略未配置时默认放行', () => {
  const decision = putawayStrategyMatch([], { location: { locationId: 9 } })
  assert.equal(decision.matched, true)
  assert.equal(decision.ruleType, null)
})

test('上架策略温区不匹配时拒绝上架', () => {
  const rules = buildPutawayRules({ temperatureControlled: true })
  const decision = putawayStrategyMatch(rules, {
    temperatureZone: 'COLD',
    location: { locationId: 3, temperatureZone: 'NORMAL' }
  })
  assert.equal(decision.matched, false)
  assert.ok(decision.reason.includes('温区'))
})

test('上架策略批次隔离要求空库位', () => {
  const rules = buildPutawayRules({ mixedBatch: false })
  const ok = putawayStrategyMatch(rules, { location: { locationId: 3, occupied: 0 } })
  assert.equal(ok.matched, true)
  assert.equal(ok.ruleType, 'BATCH')
  const busy = putawayStrategyMatch(rules, { location: { locationId: 3, occupied: 5 } })
  assert.equal(busy.matched, false)
})

test('拣货路径优化按蛇形排序并给出节省比例', () => {
  const result = optimizePickPath([
    { taskId: 1, locationCode: 'A-03-01', qty: 2 },
    { taskId: 2, locationCode: 'A-01-01', qty: 1 },
    { taskId: 3, locationCode: 'B-02-01', qty: 3 },
    { taskId: 4, locationCode: 'B-05-01', qty: 1 }
  ])
  assert.equal(result.order.length, 4)
  assert.equal(result.order[0].taskId, 2)
  assert.equal(result.order[1].taskId, 1)
  assert.equal(result.order[2].aisle, 'B')
  assert.ok(result.savedRatio >= 0)
  assert.equal(result.order[3].step, 4)
})

test('库存库龄分析落入区间桶', () => {
  const result = inventoryAging(
    [
      { productId: 1, qty: 10, amount: 100, firstInDate: '2026-02-01' },
      { productId: 2, qty: 5, amount: 50, firstInDate: '2025-01-01' }
    ],
    '2026-03-01'
  )
  assert.equal(result.rows.length, 2)
  assert.equal(result.rows[0].ageDays, 28)
  assert.equal(result.rows[0].bucket, '0-30天')
  assert.equal(result.rows[1].bucket, '365天以上')
  assert.equal(result.totals.length, 6)
})

test('ABC 分类按金额累计占比划分 A/B/C', () => {
  const result = abcAnalysis([
    { productId: 1, qty: 10, amount: 600 },
    { productId: 2, qty: 5, amount: 300 },
    { productId: 3, qty: 2, amount: 100 }
  ])
  assert.equal(result.rows[0].category, 'A')
  assert.equal(result.rows[1].category, 'B')
  assert.equal(result.rows[2].category, 'C')
  assert.equal(result.summary.A.count, 1)
  assert.equal(result.summary.A.amount, 600)
})

test('收发存报表按期间聚合净变动', () => {
  const result = stockInOutReport(
    [
      { productId: 1, qtyIn: 10, qtyOut: 0, occurredAt: '2026-01-10T00:00:00Z' },
      { productId: 1, qtyIn: 0, qtyOut: 4, occurredAt: '2026-02-10T00:00:00Z' },
      { productId: 1, qtyIn: 5, qtyOut: 0, occurredAt: '2026-05-10T00:00:00Z' }
    ],
    '2026-01-01',
    '2026-03-01'
  )
  assert.equal(result.rows.length, 1)
  assert.equal(result.rows[0].qtyIn, 10)
  assert.equal(result.rows[0].qtyOut, 4)
  assert.equal(result.rows[0].net, 6)
  assert.equal(result.totals.net, 6)
})

test('在途量汇总排除已收货并统计超期数量', () => {
  const result = inTransitSummary(
    [
      { productId: 1, qty: 10, etaDate: '2026-02-01', status: 'SHIPPED' },
      { productId: 1, qty: 5, etaDate: '2026-04-01', status: 'SHIPPED' },
      { productId: 2, qty: 8, etaDate: null, status: 'SHIPPED' },
      { productId: 3, qty: 4, etaDate: '2026-01-01', status: 'RECEIVED' }
    ],
    '2026-03-01'
  )
  assert.equal(result.rows.length, 2)
  assert.equal(result.totals.qty, 23)
  assert.equal(result.totals.overdueQty, 10)
})
