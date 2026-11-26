import test from 'node:test'
import assert from 'node:assert/strict'
import { MetricsService } from '../apps/server/dist/modules/ops/metrics.service.js'

test('指标服务输出 Prometheus 文本格式', () => {
  const service = new MetricsService()
  service.record('GET', 200)
  service.record('POST', 500)
  const text = service.prometheus()
  assert.ok(text.includes('# TYPE leaierp_requests_total counter'))
  assert.ok(text.includes('leaierp_requests_total 2'))
  assert.ok(text.includes('leaierp_errors_total 1'))
  assert.ok(text.includes('leaierp_requests_by_method_total{method="POST"} 1'))
  assert.ok(text.includes('leaierp_process_memory_bytes{type="rss"}'))
})
