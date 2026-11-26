import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface RevisionDiffEntry {
  field: string
  type: 'ADDED' | 'REMOVED' | 'CHANGED'
  before: unknown
  after: unknown
}

export interface RevisionSnapshot {
  id: number
  entityCode: string
  bizId: number
  versionNo: number
  action: string
  snapshot: Record<string, unknown>
  diff: RevisionDiffEntry[] | null
  operatorId: number
  operatorName: string | null
  source: string
  remark: string | null
  createdAt: string
}

export interface RevisionQuery extends PageQuery {
  entityCode?: string
  bizId?: number
  action?: string
}

export interface RevisionDiffResult {
  entityCode: string
  bizId: number
  from: { id: number; versionNo: number; createdAt: string }
  to: { id: number; versionNo: number; createdAt: string }
  diff: RevisionDiffEntry[]
  summary: { added: number; removed: number; changed: number; total: number }
}

export function fetchRevisionSnapshots(params: RevisionQuery) {
  return request<PageResult<RevisionSnapshot>>({ url: '/revision/snapshots', method: 'get', params })
}

export function fetchRevisionSnapshot(id: number) {
  return request<RevisionSnapshot>({ url: `/revision/snapshots/${id}`, method: 'get' })
}

export function fetchRevisionDiff(fromId: number, toId: number) {
  return request<RevisionDiffResult>({ url: `/revision/snapshots/${fromId}/diff/${toId}`, method: 'get' })
}

export function fetchRevisionHistory(entityCode: string, bizId: number) {
  return request<RevisionSnapshot[]>({ url: `/revision/history/${entityCode}/${bizId}`, method: 'get' })
}
