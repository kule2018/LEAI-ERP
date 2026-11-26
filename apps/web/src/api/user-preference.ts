import { request } from '@/utils/http'

export interface UserFavorite {
  id: number
  targetType: string
  targetKey: string
  title: string
  route: string | null
  bizType: string | null
  bizId: number | null
  remark: string | null
  sortNo: number
  createdAt: string
}

export interface FavoritePayload {
  targetType?: string
  targetKey: string
  title: string
  route?: string
  bizType?: string
  bizId?: number
  remark?: string
}

export function fetchViewConfig(pageKey: string) {
  return request<Record<string, unknown>>({ url: `/user-preference/view-config/${pageKey}`, method: 'get' })
}

export function saveViewConfig(pageKey: string, config: Record<string, unknown>) {
  return request<Record<string, unknown>>({
    url: `/user-preference/view-config/${pageKey}`,
    method: 'put',
    data: { config }
  })
}

export function fetchFavorites(params?: { targetType?: string }) {
  return request<UserFavorite[]>({ url: '/user-preference/favorites', method: 'get', params })
}

export function addFavorite(data: FavoritePayload) {
  return request<UserFavorite>({ url: '/user-preference/favorites', method: 'post', data })
}

export function toggleFavorite(data: FavoritePayload) {
  return request<{ favorited: boolean; id?: number }>({
    url: '/user-preference/favorites/toggle',
    method: 'post',
    data
  })
}

export function removeFavorite(id: number) {
  return request<{ id: number }>({ url: `/user-preference/favorites/${id}`, method: 'delete' })
}

/** 快捷搜索历史条目 */
export interface QuickSearchLog {
  id: number
  keyword: string
  count: number
  lastUsedAt: string
}

/** 记录快捷搜索关键词 */
export function recordSearchKeyword(keyword: string) {
  return request<QuickSearchLog>({
    url: '/user-preference/search-history',
    method: 'post',
    data: { keyword }
  })
}

/** 读取快捷搜索历史 */
export function fetchSearchHistory(limit = 10) {
  return request<QuickSearchLog[]>({ url: '/user-preference/search-history', method: 'get', params: { limit } })
}

/** 清空快捷搜索历史 */
export function clearSearchHistory() {
  return request<{ cleared: number }>({ url: '/user-preference/search-history', method: 'delete' })
}

/** 读取草稿 */
export function fetchDraft(draftKey: string) {
  return request<{ id: number; draftKey: string; content: Record<string, unknown> | null } | null>({
    url: `/user-preference/drafts/${encodeURIComponent(draftKey)}`,
    method: 'get'
  })
}

/** 保存草稿 */
export function saveDraft(draftKey: string, content: Record<string, unknown>) {
  return request<{ id: number }>({
    url: `/user-preference/drafts/${encodeURIComponent(draftKey)}`,
    method: 'put',
    data: { content }
  })
}

/** 删除草稿 */
export function deleteDraft(draftKey: string) {
  return request<{ deleted: boolean }>({
    url: `/user-preference/drafts/${encodeURIComponent(draftKey)}`,
    method: 'delete'
  })
}
