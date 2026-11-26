import { request, requestBlob } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface DictType {
  id: number
  dictType: string
  dictName: string
  status: string
  remark: string | null
}

export interface DictItem {
  id: number
  dictType: string
  itemCode: string
  itemLabel: string
  itemValue: string | null
  sortNo: number
  status: string
}

export interface CreateDictType {
  dictType: string
  dictName: string
  remark?: string
}

export interface UpdateDictType {
  dictName?: string
  status?: string
  remark?: string
}

export interface CreateDictItem {
  dictType: string
  itemCode: string
  itemLabel: string
  itemValue?: string
  sortNo?: number
}

export interface UpdateDictItem {
  itemLabel?: string
  itemValue?: string
  sortNo?: number
  status?: string
}

const baseUrl = '/system/dict'

export function fetchDictTypes(params: PageQuery) {
  return request<PageResult<DictType>>({ url: baseUrl, method: 'get', params })
}

export function createDictType(data: CreateDictType) {
  return request<DictType>({ url: baseUrl, method: 'post', data })
}

export function updateDictType(id: number, data: UpdateDictType) {
  return request<DictType>({ url: `${baseUrl}/${id}`, method: 'put', data })
}

export function deleteDictType(id: number) {
  return request<null>({ url: `${baseUrl}/${id}`, method: 'delete' })
}

export interface DictItemQuery extends PageQuery {
  dictType: string
}

export function fetchDictItems(params: DictItemQuery) {
  return request<PageResult<DictItem>>({ url: `${baseUrl}/items`, method: 'get', params })
}

export function createDictItem(data: CreateDictItem) {
  return request<DictItem>({ url: `${baseUrl}/items`, method: 'post', data })
}

export function updateDictItem(id: number, data: UpdateDictItem) {
  return request<DictItem>({ url: `${baseUrl}/items/${id}`, method: 'put', data })
}

export function deleteDictItem(id: number) {
  return request<null>({ url: `${baseUrl}/items/${id}`, method: 'delete' })
}

export interface DictImportResult {
  dryRun: boolean
  total: number
  createdTypes: number
  createdItems: number
  updatedItems: number
  errors: string[]
  summary: { total: number; newDicts: number; newItems: number; duplicateInFile: number }
}

export function downloadDictCsv() {
  return requestBlob({ url: `${baseUrl}/export`, method: 'get' })
}
export function importDictCsv(content: string, dryRun = false) {
  return request<DictImportResult>({ url: `${baseUrl}/import`, method: 'post', data: { content, dryRun } })
}
