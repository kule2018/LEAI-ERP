import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface DataScopeRule {
  id: number
  scopeCode: string
  scopeName: string
  bizType: string
  orgField: string
  scopeLevel: string
  priority: number
  status: string
}

export interface CreateDataScopeRule {
  scopeCode: string
  scopeName: string
  bizType?: string
  orgField?: string
  scopeLevel: string
  priority?: number
}

export const DATA_SCOPE_OPTIONS = [
  { label: '仅本人', value: 'SELF' },
  { label: '本部门', value: 'DEPT' },
  { label: '本部门及下级', value: 'DEPT_AND_CHILD' },
  { label: '本组织', value: 'ORG' },
  { label: '全部', value: 'ALL' }
]

const baseUrl = '/system/data-scope'

export function fetchDataScopes(params: PageQuery) {
  return request<PageResult<DataScopeRule>>({ url: baseUrl, method: 'get', params })
}

export function createDataScope(data: CreateDataScopeRule) {
  return request<DataScopeRule>({ url: baseUrl, method: 'post', data })
}

export function previewDataScope(bizType: string) {
  return request<{ bizType: string; level: string; orgField: string; matched?: string }>({
    url: `${baseUrl}/preview/${encodeURIComponent(bizType)}`,
    method: 'get'
  })
}
