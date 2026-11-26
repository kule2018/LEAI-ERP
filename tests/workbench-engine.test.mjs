import test from 'node:test'
import assert from 'node:assert/strict'
import { visibleKpis, growthRate, enrichTrend, forecastCashFlow, cashGapWarnings, applyScenario, contribution, ranking, dailyDigest } from '../apps/server/dist/common/workbench-engine.js'

test('角色 KPI 可见性', () => {
  const configs = [
    { code: 'sales', name: '销售', source: 'SALES', roles: [] },
    { code: 'purchase', name: '采购', source: 'PURCHASE', roles: ['PURCHASE_MGR'] }
  ]
  assert.deepEqual(visibleKpis(configs, ['SALES_MGR']).map((k) => k.code), ['sales'])
  assert.deepEqual(visibleKpis(configs, ['PURCHASE_MGR']).map((k) => k.code), ['sales', 'purchase'])
})

test('同比增长率', () => {
  assert.equal(growthRate(120, 100), 20)
  assert.equal(growthRate(80, 100), -20)
  assert.equal(growthRate(100, 0), 100)
})

test('趋势毛利与同比', () => {
  const current = [{ period: '2026-01', amount: 120, cost: 80 }]
  const previous = [{ period: '2026-01', amount: 100 }]
  const result = enrichTrend(current, previous)
  assert.equal(result[0].yoy, 20)
  assert.equal(result[0].grossProfit, 40)
  assert.equal(result[0].margin, 33.33)
})

test('13 周现金流预测按周聚合', () => {
  const items = [
    { amount: 100, daysFromNow: 0, direction: 'IN' },
    { amount: 30, daysFromNow: 3, direction: 'OUT' },
    { amount: 50, daysFromNow: 8, direction: 'IN' }
  ]
  const forecast = forecastCashFlow(items)
  assert.equal(forecast.length, 13)
  assert.equal(forecast[0].inflow, 100)
  assert.equal(forecast[0].net, 70)
  assert.equal(forecast[1].inflow, 50)
  assert.equal(forecast[1].cumulative, 120)
})

test('资金缺口预警', () => {
  const forecast = [
    { week: 1, cumulative: 100 },
    { week: 2, cumulative: -20 },
    { week: 3, cumulative: 30 }
  ]
  assert.deepEqual(cashGapWarnings(forecast), [2])
})

test('现金流情景模拟', () => {
  const base = [{ week: 1, inflow: 100, outflow: 60, net: 40, cumulative: 40 }]
  const optimistic = applyScenario(base, 'OPTIMISTIC')
  assert.equal(optimistic[0].inflow, 110)
  assert.equal(optimistic[0].outflow, 54)
  const pessimistic = applyScenario(base, 'PESSIMISTIC')
  assert.ok(pessimistic[0].cumulative < base[0].cumulative)
})

test('贡献度与排行', () => {
  const rows = contribution([{ name: 'A', amount: 30 }, { name: 'B', amount: 70 }])
  assert.equal(rows[0].name, 'B')
  assert.equal(rows[0].share, 70)
  const ranked = ranking([{ name: 'A', amount: 30 }, { name: 'B', amount: 70 }])
  assert.deepEqual(ranked.map((row) => row.rank), [1, 2])
})

test('AI 日报摘要标注来源', () => {
  const digest = dailyDigest(
    [{ name: '累计销售', value: '100', yoy: 20 }],
    [{ title: '库存呆滞', severity: 'HIGH' }]
  )
  assert.match(digest.summary, /累计销售 100，同比 \+20%/)
  assert.match(digest.summary, /高风险 1 条/)
  assert.ok(digest.sources.includes('风险预警中心'))
})
