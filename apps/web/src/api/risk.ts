import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface RiskAlert {
  id: number
  riskKey: string
  riskType: string
  bizType: string
  bizId: number
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  message: string
  evidence: Record<string, unknown> | null
  suggestion: string | null
  status: 'OPEN' | 'ASSIGNED' | 'CLOSED'
  assigneeId: number | null
  closedBy: number | null
  closeReason: string | null
  closedAt: string | null
  createdAt: string
}

export interface RiskQuery extends PageQuery {
  riskType?: string
  severity?: string
  status?: string
}

export function fetchRisks(params: RiskQuery) {
  return request<PageResult<RiskAlert>>({ url: '/risk', method: 'get', params })
}

export function scanRisks() {
  return request<{ found: number; created: number; reopened: number }>({ url: '/risk/scan', method: 'post' })
}

export function assignRisk(id: number, assigneeId: number) {
  return request<RiskAlert>({ url: `/risk/${id}/assign`, method: 'post', data: { assigneeId } })
}

export function closeRisk(id: number, reason: string) {
  return request<RiskAlert>({ url: `/risk/${id}/close`, method: 'post', data: { reason } })
}
