import { request } from '@/utils/http'

export interface ApiEndpointDoc {
  method: string
  path: string
  perm: string
  description: string
}

export interface ApiGroupDoc {
  module: string
  description: string
  endpoints: ApiEndpointDoc[]
}

export function fetchApiDocs() {
  return request<ApiGroupDoc[]>({ url: '/docs/api', method: 'get' })
}

export function fetchPermissionCodes() {
  return request<string[]>({ url: '/docs/permissions', method: 'get' })
}
