import test from 'node:test'
import assert from 'node:assert/strict'
import {
  detectCarrier, sortTrackingEvents, detectLogisticsException, scoreCsQuality
} from '../apps/server/dist/common/shop-service-engine.js'

const at = new Date('2026-11-22T12:00:00Z')

test('按运单号识别承运商', () => {
  assert.equal(detectCarrier('SF123456'), '顺丰速运')
  assert.equal(detectCarrier('yt123456'), '圆通速递')
  assert.equal(detectCarrier('unknown'), '其他')
})

test('物流轨迹按时间倒序', () => {
  const result = sortTrackingEvents([
    { status: 'CREATED', eventAt: '2026-11-20T10:00:00Z' },
    { status: 'DELIVERED', eventAt: '2026-11-21T10:00:00Z' }
  ])
  assert.equal(result[0].status, 'DELIVERED')
})

test('超过48小时未更新或异常状态触发预警', () => {
  assert.equal(detectLogisticsException([{ status: 'IN_TRANSIT', eventAt: '2026-11-20T10:00:00Z' }], at).exception, true)
  assert.equal(detectLogisticsException([{ status: 'EXCEPTION', eventAt: '2026-11-22T10:00:00Z' }], at).exception, true)
  assert.equal(detectLogisticsException([{ status: 'IN_TRANSIT', eventAt: '2026-11-22T10:00:00Z' }], at).exception, false)
})

test('客服质检按响应、解决与态度评分', () => {
  assert.deepEqual(scoreCsQuality({ responseMinutes: 5, resolved: true, politeness: 5 }), {
    score: 100, result: 'PASS', reasons: []
  })
  const poor = scoreCsQuality({ responseMinutes: 60, resolved: false, politeness: 2 })
  assert.equal(poor.result, 'FAIL')
  assert.equal(poor.reasons.length, 3)
})
