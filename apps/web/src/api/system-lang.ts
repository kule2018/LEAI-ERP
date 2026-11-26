import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface SystemLangItem {
  id: number
  langCode: string
  localeName: string
  resourceKey: string
  resourceValue: string
  fallbackLang: string | null
  status: string
  remark?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface LangQuery extends PageQuery {
  langCode?: string
}

export interface LangEntry {
  langCode: string
  resourceKey: string
  resourceValue: string
  fallbackLang?: string
  localeName?: string
}

export interface LanguagePackage {
  langCode: string
  localeName: string
  values: Record<string, string>
  updatedAt?: string | null
}

export interface LangDiffResult {
  added: string[]
  updated: string[]
  removed: string[]
  changedKeys: string[]
}

const baseUrl = '/system/lang'

export function fetchLangEntries(params: LangQuery) {
  return request<PageResult<SystemLangItem>>({ url: `${baseUrl}/list`, method: 'get', params })
}

export function fetchLangPackages() {
  return request<LanguagePackage[]>({ url: `${baseUrl}/packages`, method: 'get' })
}

export function upsertLangEntries(entries: LangEntry[]) {
  return request<{ created: number; updated: number; total: number }>({
    url: `${baseUrl}/upsert`,
    method: 'post',
    data: { entries }
  })
}

export function diffLangPackage(langCode: string, values: Record<string, string>) {
  return request<LangDiffResult>({ url: `${baseUrl}/diff`, method: 'post', data: { langCode, values } })
}

export function deleteLangEntry(id: number) {
  return request<null>({ url: `${baseUrl}/${id}`, method: 'delete' })
}
