import test from 'node:test'
import assert from 'node:assert/strict'
import {
  bucketByMonth,
  buildRollingForecast,
  computeBaseline,
  nextMonths
} from '../apps/server/dist/common/cashflow-rolling-forecast-rules.js'

test('滚动预测：基线月之后按月生成连续月份', () => {
  assert.deepEqual(nextMonths('2026-01', 3), ['2026-02', '2026-03', '2026-04'])
  assert.deepEqual(nextMonths('2026-11', 3), ['2026-12', '2027-01', '2027-02'])
  assert.deepEqual(nextMonths('2026-12', 2), ['2027-01', '2027-02'])
})

test('滚动预测：基线取最近 N 个月实际均值', () => {
  const baseline = computeBaseline([
    { month: '2026-01', inflow: 100, outflow: 40 },
    { month: '2026-02', inflow: 200, outflow: 60 },
    { month: '2026-03', inflow: 300, outflow: 80 }
  ], 2)
  assert.equal(baseline.months, 2)
  assert.equal(baseline.inflow, 250)
  assert.equal(baseline.outflow, 70)
})

test('滚动预测：无计划月份按基线推算并逐月滚动余额', () => {
  const result = buildRollingForecast({
    actuals: [
      { month: '2026-01', inflow: 100, outflow: 40 },
      { month: '2026-02', inflow: 200, outflow: 60 }
    ],
    plans: [],
    options: {
      months: 2,
      baseMonth: '2026-02',
      openingBalance: 500,
      inflowFactor: 1,
      outflowFactor: 1,
      baselineMonths: 2
    }
  })
  assert.equal(result.rows.length, 2)
  assert.equal(result.rows[0].month, '2026-03')
  assert.equal(result.rows[0].source, 'BASELINE')
  assert.equal(result.rows[0].inflow, 150)
  assert.equal(result.rows[0].outflow, 50)
  assert.equal(result.rows[0].net, 100)
  assert.equal(result.rows[0].endingBalance, 600)
  assert.equal(result.rows[1].openingBalance, 600)
  assert.equal(result.rows[1].endingBalance, 700)
  assert.equal(result.endingBalance, 700)
  assert.equal(result.minEndingBalance, 600)
})

test('滚动预测：已登记计划的月份以计划金额为准', () => {
  const result = buildRollingForecast({
    actuals: [{ month: '2026-01', inflow: 100, outflow: 40 }],
    plans: [{ month: '2026-03', inflow: 500, outflow: 200 }],
    options: {
      months: 2,
      baseMonth: '2026-02',
      openingBalance: 0,
      inflowFactor: 1,
      outflowFactor: 1,
      baselineMonths: 3
    }
  })
  assert.equal(result.rows[0].source, 'PLAN')
  assert.equal(result.rows[0].confidence, 0.9)
  assert.equal(result.rows[0].inflow, 500)
  assert.equal(result.rows[0].outflow, 200)
  assert.equal(result.rows[1].source, 'BASELINE')
})

test('滚动预测：情景系数影响流入流出与期末余额', () => {
  const result = buildRollingForecast({
    actuals: [{ month: '2026-01', inflow: 100, outflow: 40 }],
    plans: [],
    options: {
      months: 1,
      baseMonth: '2026-01',
      openingBalance: 0,
      inflowFactor: 1.2,
      outflowFactor: 0.5,
      baselineMonths: 3
    }
  })
  assert.equal(result.rows[0].inflow, 120)
  assert.equal(result.rows[0].outflow, 20)
  assert.equal(result.rows[0].endingBalance, 100)
})

test('滚动预测：余额转负时给出预警', () => {
  const result = buildRollingForecast({
    actuals: [{ month: '2026-01', inflow: 0, outflow: 100 }],
    plans: [],
    options: {
      months: 1,
      baseMonth: '2026-01',
      openingBalance: 50,
      inflowFactor: 1,
      outflowFactor: 1,
      baselineMonths: 3
    }
  })
  assert.ok(result.warning)
  assert.match(result.warning, /负数/)
})

test('滚动预测：缺少历史实际时提示零基线', () => {
  const result = buildRollingForecast({
    actuals: [],
    plans: [],
    options: {
      months: 1,
      baseMonth: '2026-01',
      openingBalance: 0,
      inflowFactor: 1,
      outflowFactor: 1,
      baselineMonths: 3
    }
  })
  assert.equal(result.rows[0].confidence, 0.3)
  assert.match(result.warning, /零基线/)
})

test('滚动预测：现金流日历按月汇总为收支桶', () => {
  const buckets = bucketByMonth([
    { bizDate: '2026-01-05', direction: 'IN', amount: 100 },
    { bizDate: '2026-01-20', direction: 'IN', amount: 50 },
    { bizDate: '2026-01-10', direction: 'OUT', amount: 30 },
    { bizDate: '2026-02-01', direction: 'OUT', amount: 20 },
    { bizDate: 'invalid', direction: 'IN', amount: 99 }
  ])
  assert.equal(buckets.length, 2)
  assert.equal(buckets[0].month, '2026-01')
  assert.equal(buckets[0].inflow, 150)
  assert.equal(buckets[0].outflow, 30)
  assert.equal(buckets[1].month, '2026-02')
  assert.equal(buckets[1].outflow, 20)
})
