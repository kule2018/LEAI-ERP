import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface SecurityAlert {
  id: number
  userId: number
  username: string | null
  perm: string | null
  path: string | null
  method: string | null
  attempts: number
  level: string
  reason: string | null
  status: string
  occurredAt: string
  confirmedAt: string | null
}

export interface SlowSqlEntry {
  sql: string
  durationMs: number
  rowCount: number
  thresholdMs: number
  capturedAt: string
}

export interface SlowSqlAggregate {
  sql: string
  count: number
  totalMs: number
  maxMs: number
  avgMs: number
}

const base = '/ops'

export function fetchSecurityAlerts(params: PageQuery & { status?: string; level?: string }) {
  return request<PageResult<SecurityAlert>>({ url: `${base}/security/alerts`, method: 'get', params })
}

export function materializeSecurityAlerts() {
  return request<{ count: number }>({ url: `${base}/security/alerts/materialize`, method: 'post' })
}

export function confirmSecurityAlert(id: number, data: { status: 'CONFIRMED' | 'CLOSED'; comment?: string }) {
  return request<SecurityAlert>({ url: `${base}/security/alerts/${id}/confirm`, method: 'put', data })
}

export function fetchSlowSql(limit = 50) {
  return request<{ entries: SlowSqlEntry[]; aggregate: SlowSqlAggregate[] }>({
    url: `${base}/metrics/slow-sql`,
    method: 'get',
    params: { limit }
  })
}

export function fetchSlowSqlHistory(limit = 50) {
  return request<SlowSqlEntry[]>({ url: `${base}/metrics/slow-sql/history`, method: 'get', params: { limit } })
}

export function persistSlowSql() {
  return request<{ count: number }>({ url: `${base}/metrics/slow-sql/persist`, method: 'post' })
}
