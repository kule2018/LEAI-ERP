import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'
import type { ApiResponse } from '@/types/contract'

export const PORTAL_TOKEN_KEY = 'leaierp_portal_token'
export const PORTAL_PROFILE_KEY = 'leaierp_portal_profile'

/**
 * 供应商门户独立请求实例：
 * 只携带门户令牌，不复用内部员工令牌，避免两类身份互相越权。
 */
const portalHttp = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  timeout: 15000
})

portalHttp.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(PORTAL_TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const method = (config.method ?? 'get').toLowerCase()
  if (['post', 'put', 'patch', 'delete'].includes(method) && !config.headers['Idempotency-Key']) {
    config.headers['Idempotency-Key'] =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `k-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
  return config
})

portalHttp.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        sessionStorage.removeItem(PORTAL_TOKEN_KEY)
        sessionStorage.removeItem(PORTAL_PROFILE_KEY)
        return Promise.reject(new Error('门户登录已失效，请重新登录'))
      }
      const data = error.response?.data as ApiResponse<unknown> | undefined
      return Promise.reject(new Error(data?.message || error.message || '请求失败'))
    }
    return Promise.reject(error)
  }
)

export async function portalRequest<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await portalHttp.request<ApiResponse<T>>(config)
  const payload = response.data
  if (payload.code !== 0) {
    throw new Error(payload.message || '请求失败')
  }
  return payload.data
}

export function getPortalToken(): string {
  return sessionStorage.getItem(PORTAL_TOKEN_KEY) ?? ''
}

export function setPortalSession(token: string, profile: unknown): void {
  sessionStorage.setItem(PORTAL_TOKEN_KEY, token)
  sessionStorage.setItem(PORTAL_PROFILE_KEY, JSON.stringify(profile))
}

export function clearPortalSession(): void {
  sessionStorage.removeItem(PORTAL_TOKEN_KEY)
  sessionStorage.removeItem(PORTAL_PROFILE_KEY)
}
