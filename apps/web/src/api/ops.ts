import { request } from '@/utils/http'

export interface HealthResult {
  status: string
  database: string
  redis: string
  checkedAt: string
}

export interface MetricsResult {
  uptimeSeconds: number
  startedAt: string
  requests: {
    total: number
    errors: number
    byMethod: Record<string, number>
    byStatus: Record<string, number>
  }
  process: {
    memoryRssMb: number
    memoryHeapMb: number
    nodeVersion: string
  }
}

export function fetchHealth() {
  return request<HealthResult>({ url: '/health', method: 'get' })
}

export function fetchMetrics() {
  return request<MetricsResult>({ url: '/metrics', method: 'get' })
}

export interface SchedulerTask {
  code: string
  name: string
  enabled: boolean
  lastRunAt: string | null
  intervalMinutes: number
  status: string
}

export function fetchSchedulers() {
  return request<SchedulerTask[]>({ url: '/system/scheduler', method: 'get' })
}
export function tickSchedulers() {
  return request<{ executed: string[] }>({ url: '/system/scheduler/tick', method: 'post' })
}
export function runScheduler(code: string) {
  return request<{ code: string; result: string }>({ url: `/system/scheduler/${code}/run`, method: 'post' })
}
