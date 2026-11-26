declare const require: (id: string) => any

type Labels = Record<string, string | number>

export interface CounterMetric {
  inc(value?: number, labels?: Labels): void
}

export interface GaugeMetric {
  set(value: number, labels?: Labels): void
}

interface MetricState {
  name: string
  help: string
  type: 'counter' | 'gauge'
  labelNames: string[]
  values: Map<string, number>
}

function labelKey(labels: Labels = {}): string {
  return Object.keys(labels).sort().map((key) => `${key}=${labels[key]}`).join(',')
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

/** 无 prom-client 时的最小 Prometheus 文本实现，保证接口契约一致 */
class FallbackRegistry {
  private readonly states: MetricState[] = []

  counter(name: string, help: string, labelNames: string[]): CounterMetric {
    return this.metric({ name, help, type: 'counter', labelNames, values: new Map() })
  }

  gauge(name: string, help: string, labelNames: string[]): GaugeMetric {
    return this.metric({ name, help, type: 'gauge', labelNames, values: new Map() })
  }

  private metric<T>(state: MetricState): T {
    this.states.push(state)
    if (state.labelNames.length === 0) state.values.set('', 0)
    return {
      inc: (value = 1, labels: Labels = {}) => {
        const key = labelKey(labels)
        state.values.set(key, (state.values.get(key) ?? 0) + value)
      },
      set: (value: number, labels: Labels = {}) => {
        state.values.set(labelKey(labels), value)
      }
    } as T
  }

  render(): string {
    const lines: string[] = []
    for (const state of this.states) {
      lines.push(`# HELP ${state.name} ${state.help}`)
      lines.push(`# TYPE ${state.name} ${state.type}`)
      for (const [key, value] of state.values) {
        const labels = key
          ? `{${key.split(',').map((part) => {
              const [name, ...rest] = part.split('=')
              return `${name}="${escapeLabel(rest.join('='))}"`
            }).join(',')}}`
          : ''
        lines.push(`${state.name}${labels} ${value}`)
      }
    }
    return `${lines.join('\n')}\n`
  }
}

/**
 * 优先使用 prom-client（安装依赖后自动启用）；未安装时降级到内建实现，
 * 保证 /metrics/prometheus 始终可用。
 */
export class PrometheusAdapter {
  private readonly client: any
  private readonly registry: any
  readonly usingPromClient: boolean

  constructor() {
    try {
      this.client = require('prom-client')
      this.registry = new this.client.Registry()
      this.client.collectDefaultMetrics({ register: this.registry })
      this.usingPromClient = true
    } catch {
      this.client = null
      this.registry = new FallbackRegistry()
      this.usingPromClient = false
    }
  }

  counter(name: string, help: string, labelNames: string[] = []): CounterMetric {
    if (this.client) {
      const metric = new this.client.Counter({ name, help, labelNames })
      this.registry.registerMetric(metric)
      return metric as CounterMetric
    }
    return this.registry.counter(name, help, labelNames)
  }

  gauge(name: string, help: string, labelNames: string[] = []): GaugeMetric {
    if (this.client) {
      const metric = new this.client.Gauge({ name, help, labelNames })
      this.registry.registerMetric(metric)
      return metric as GaugeMetric
    }
    return this.registry.gauge(name, help, labelNames)
  }

  async render(): Promise<string> {
    return this.usingPromClient
      ? this.registry.metrics()
      : this.registry.render()
  }
}
