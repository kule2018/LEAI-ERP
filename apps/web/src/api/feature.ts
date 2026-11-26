import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface FeatureFlag {
  id: number
  code: string
  name: string
  module: string
  status: 'ON' | 'OFF' | 'GRAY'
  grayUsers: number[] | null
  grayRoles: string[] | null
  grayPercent: number
  updatedAt: string | null
}

interface FeatureQuery extends PageQuery {
  module?: string
  status?: string
}

export function fetchFeatures(params: FeatureQuery) {
  return request<PageResult<FeatureFlag>>({ url: '/system/features', method: 'get', params })
}

export function createFeature(data: Record<string, unknown>) {
  return request<FeatureFlag>({ url: '/system/features', method: 'post', data })
}

export function updateFeature(id: number, data: Record<string, unknown>) {
  return request<FeatureFlag>({ url: `/system/features/${id}`, method: 'put', data })
}

export function removeFeature(id: number) {
  return request<void>({ url: `/system/features/${id}`, method: 'delete' })
}
