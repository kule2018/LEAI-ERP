import { Injectable } from '@nestjs/common'
import { isSlowRequest, shouldAlertOnErrors } from '../../common/notify-scheduler-rules'
import { PrometheusAdapter, type CounterMetric, type GaugeMetric } from '../../common/observability/prometheus-adapter'

export interface SlowRequest {
  method: string
  url: string
  durationMs: number
  at: string
}

@Injectable()
export class MetricsService {
  private readonly startedAt = Date.now()
  private total = 0
  private errors = 0
  private readonly byMethod: Record<string, number> = {}
  private readonly byStatus: Record<string, number> = {}
  private readonly slowRequests: SlowRequest[] = []
  private slowThresholdMs = 1000
  private readonly registry = new PrometheusAdapter()
  private readonly requestsCounter: CounterMetric
  private readonly errorsCounter: CounterMetric
  private readonly slowCounter: CounterMetric
  private readonly methodCounter: CounterMetric
  private readonly statusCounter: CounterMetric
  private readonly uptimeGauge: GaugeMetric
  private readonly memoryGauge: GaugeMetric

  constructor() {
    this.requestsCounter = this.registry.counter('leaierp_requests_total', 'Total HTTP requests.')
    this.errorsCounter = this.registry.counter('leaierp_errors_total', 'Total failed HTTP requests.')
    this.slowCounter = this.registry.counter('leaierp_slow_requests_total', 'Slow requests count.')
    this.methodCounter = this.registry.counter('leaierp_requests_by_method_total', 'Requests by HTTP method.', ['method'])
    this.statusCounter = this.registry.counter('leaierp_requests_by_status_total', 'Requests by status group.', ['status'])
    this.uptimeGauge = this.registry.gauge('leaierp_uptime_seconds', 'Process uptime in seconds.')
    this.memoryGauge = this.registry.gauge('leaierp_process_memory_bytes', 'Process memory usage.', ['type'])
  }

  record(method: string, status: number, durationMs = 0, url = ''): void {
    this.total += 1
    this.requestsCounter.inc()
    if (status >= 400) {
      this.errors += 1
      this.errorsCounter.inc()
    }
    this.byMethod[method] = (this.byMethod[method] ?? 0) + 1
    this.methodCounter.inc(1, { method })
    const statusGroup = `${Math.floor(status / 100)}xx`
    this.byStatus[statusGroup] = (this.byStatus[statusGroup] ?? 0) + 1
    this.statusCounter.inc(1, { status: statusGroup })
    if (durationMs > 0 && isSlowRequest(durationMs, this.slowThresholdMs)) {
      this.slowCounter.inc()
      this.slowRequests.push({ method, url, durationMs: Number(durationMs.toFixed(2)), at: new Date().toISOString() })
      if (this.slowRequests.length > 100) this.slowRequests.shift()
    }
  }

  /** 慢查询列表（最近 100 条） */
  listSlowRequests(): SlowRequest[] {
    return [...this.slowRequests]
  }

  private readonly acknowledged = new Set<string>()

  /** 告警判定：错误率超阈值或窗口内有慢请求 */
  alerts(): Array<{ type: string; message: string; acknowledged: boolean }> {
    const result: Array<{ type: string; message: string; acknowledged: boolean }> = []
    if (shouldAlertOnErrors(this.errors, this.total)) {
      result.push({
        type: 'HIGH_ERROR_RATE',
        message: `错误率 ${(this.errors / this.total * 100).toFixed(1)}%（${this.errors}/${this.total}）`,
        acknowledged: this.acknowledged.has('HIGH_ERROR_RATE')
      })
    }
    if (this.slowRequests.length > 0) {
      result.push({
        type: 'SLOW_REQUESTS',
        message: `最近有 ${this.slowRequests.length} 个慢请求超过 ${this.slowThresholdMs}ms`,
        acknowledged: this.acknowledged.has('SLOW_REQUESTS')
      })
    }
    return result
  }

  /** 确认告警：记录确认状态，新告警类型出现时仍需重新确认 */
  acknowledge(type: string): { type: string; acknowledged: boolean } {
    this.acknowledged.add(type)
    return { type, acknowledged: true }
  }

  async prometheus(): Promise<string> {
    const memory = process.memoryUsage()
    this.uptimeGauge.set(Math.floor((Date.now() - this.startedAt) / 1000))
    this.memoryGauge.set(memory.rss, { type: 'rss' })
    this.memoryGauge.set(memory.heapUsed, { type: 'heap' })
    this.memoryGauge.set(memory.external, { type: 'external' })
    return this.registry.render()
  }

  snapshot(): Record<string, unknown> {
    const memory = process.memoryUsage()
    return {
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      startedAt: new Date(this.startedAt).toISOString(),
      requests: {
        total: this.total,
        errors: this.errors,
        byMethod: { ...this.byMethod },
        byStatus: { ...this.byStatus },
        slowRequests: this.slowRequests.length
      },
      alerts: this.alerts(),
      process: {
        memoryRssMb: Number((memory.rss / 1024 / 1024).toFixed(2)),
        memoryHeapMb: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
        nodeVersion: process.version
      }
    }
  }
}
