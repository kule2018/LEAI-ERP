import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface ImportConfigItem {
  code: string
  name: string
  headers: string[]
}

export interface RowIssue {
  row: number
  field: string
  message: string
}

export interface ImportPreview {
  code: string
  name: string
  headers: string[]
  total: number
  valid: number
  invalid: number
  issues: RowIssue[]
  rows: Array<Record<string, unknown>>
}

export interface ImportResult {
  code: string
  total: number
  imported: number
  skipped: number
  issues: RowIssue[]
}

export interface IoJob {
  id: number
  code: string
  type: string
  status: string
  resultUrl: string | null
  errorMessage: string | null
  createdAt: string
  finishedAt: string | null
}

export function fetchImportConfigs() {
  return request<ImportConfigItem[]>({ url: '/system/io/configs', method: 'get' })
}

export function previewImport(code: string, content: string) {
  return request<ImportPreview>({ url: '/system/io/preview', method: 'post', data: { code, content } })
}

export function commitImport(code: string, content: string) {
  return request<ImportResult>({ url: '/system/io/import', method: 'post', data: { code, content } })
}

export function createExportJob(code: string) {
  return request<IoJob>({ url: '/system/io/export', method: 'post', data: { code } })
}

export function fetchIoJobs(params: PageQuery) {
  return request<PageResult<IoJob>>({ url: '/system/io/jobs', method: 'get', params })
}

export function templateUrl(code: string) {
  return `/api/v1/system/io/template/${code}`
}

export interface ImportMapping {
  sourceHeader: string
  targetHeader: string
}

export interface ImportMappingInfo {
  code: string
  headers: string[]
  mappings: ImportMapping[]
}

export function fetchImportMappings(code: string) {
  return request<ImportMappingInfo>({ url: `/system/io/imports/${code}/mappings`, method: 'get' })
}

export function saveImportMappings(code: string, mappings: ImportMapping[]) {
  return request<{ code: string; mappings: ImportMapping[] }>({
    url: `/system/io/imports/${code}/mappings`, method: 'put', data: { mappings }
  })
}
