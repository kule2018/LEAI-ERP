import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface AuditLog {
  id: number
  bizType: string
  bizId: number
  action: string
  beforeValue: string | null
  afterValue: string | null
  operator: number
  operatorName: string
  createdAt: string
}

export interface AuditQuery extends PageQuery {
  bizType?: string
  action?: string
}

export function fetchAuditLogs(params: AuditQuery) {
  return request<PageResult<AuditLog>>({ url: '/system/audit', method: 'get', params })
}
