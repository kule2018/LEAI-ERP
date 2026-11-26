import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'
import type { ApiResponse } from '@/types/contract'
import { enqueueRequest, listQueuedRequests, removeQueuedRequest, updateQueuedRequest } from './offline-queue'

export const ACCESS_TOKEN_KEY = 'leaierp_access_token'

/** 网络不可用、写请求已暂存到离线队列时抛出，供表单层识别 */
export class OfflineQueuedError extends Error {
  constructor(message = '网络不可用，操作已存入待同步队列，恢复连接后自动重放') {
    super(message)
    this.name = 'OfflineQueuedError'
  }
}

/** 接口错误：保留 HTTP 状态码，供离线表单区分冲突与可重试失败 */
export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message)
    this.name = 'ApiError'
  }
}

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  timeout: 15000
})

const WRITE_METHODS = ['post', 'put', 'patch', 'delete']

/** 生成幂等键：写请求自动携带，避免重复提交产生重复单据 */
function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `k-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

http.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const method = (config.method ?? 'get').toLowerCase()
  if (WRITE_METHODS.includes(method) && !config.headers['Idempotency-Key']) {
    config.headers['Idempotency-Key'] = createIdempotencyKey()
  }
  return config
})

http.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401 || error.response?.status === 431) {
        sessionStorage.removeItem(ACCESS_TOKEN_KEY)
        if (error.response.status === 431 && !location.pathname.startsWith('/login')) {
          location.assign('/login')
        }
        return Promise.reject(new Error(error.response.status === 431 ? '登录信息已更新，请重新登录' : '登录已失效'))
      }
      // 无响应且非取消：网络不可用，写请求暂存到离线队列，恢复后按原幂等键重放
      if (!error.response && !axios.isCancel(error)) {
        const queued = enqueueRequest(error.config ?? {}, error.config?.offlineMeta)
        if (queued) {
          return Promise.reject(new OfflineQueuedError())
        }
      }
      const data = error.response?.data as ApiResponse<unknown> | undefined
      return Promise.reject(new ApiError(data?.message || error.message || '请求失败', error.response?.status))
    }
    return Promise.reject(error)
  }
)

export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await http.request<ApiResponse<T>>(config)
  const payload = response.data
  if (payload.code !== 0) {
    throw new Error(payload.message || '请求失败')
  }
  return payload.data
}

/** 下载文件（CSV 等二进制响应），返回 Blob 供浏览器保存 */
export async function requestBlob(config: AxiosRequestConfig): Promise<Blob> {
  const response = await http.request<Blob>({ ...config, responseType: 'blob' })
  return response.data
}

/**
 * SSE 流式请求：以 fetch + ReadableStream 消费服务端 SSE（需携带 Authorization 头）。
 * onMessage 收到每个 data 负载；流结束或出错时返回 Promise。
 */
export async function streamSse(
  url: string,
  params: Record<string, string | number | undefined>,
  onMessage: (payload: Record<string, unknown>) => void
): Promise<void> {
  const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.append(key, String(value))
  }
  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY)
  const response = await fetch(`${baseURL}${url}${search.toString() ? `?${search}` : ''}`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' } : { Accept: 'text/event-stream' }
  })
  if (!response.ok || !response.body) {
    throw new Error(`流式请求失败(${response.status})`)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const raw = trimmed.slice(5).trim()
      if (!raw || raw === '[DONE]') continue
      try {
        onMessage(JSON.parse(raw) as Record<string, unknown>)
      } catch {
        onMessage({ delta: raw })
      }
    }
  }
}

/**
 * 重放离线暂存队列：按原幂等键提交，服务端回放首次执行结果，避免重复建单。
 * 成功即出队；409 冲突（疑似已提交）标记为待人工核对，不再自动重试；
 * 其他可重试错误保留在队列等待下一次网络恢复。
 */
export async function flushOfflineQueue(): Promise<{ replayed: number; failed: number; conflicted: number }> {
  const items = listQueuedRequests()
  if (items.length === 0) return { replayed: 0, failed: 0, conflicted: 0 }
  let replayed = 0
  let failed = 0
  let conflicted = 0
  for (const item of items) {
    if (item.status !== 'pending') {
      conflicted += 1
      continue
    }
    try {
      await http.request({
        method: item.method as AxiosRequestConfig['method'],
        url: item.url,
        data: item.data,
        params: item.params as AxiosRequestConfig['params'],
        headers: { 'Idempotency-Key': item.idempotencyKey }
      })
      removeQueuedRequest(item.idempotencyKey)
      replayed += 1
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined
      const data = axios.isAxiosError(error)
        ? (error.response?.data as ApiResponse<unknown> | undefined)
        : undefined
      const message = data?.message || (error instanceof Error ? error.message : '同步失败')
      if (status === 409) {
        updateQueuedRequest(item.idempotencyKey, {
          status: 'conflict',
          attempts: item.attempts + 1,
          lastError: message
        })
        conflicted += 1
      } else if (status && status >= 400 && status < 500) {
        updateQueuedRequest(item.idempotencyKey, {
          status: 'failed',
          attempts: item.attempts + 1,
          lastError: message
        })
        failed += 1
      } else {
        updateQueuedRequest(item.idempotencyKey, {
          attempts: item.attempts + 1,
          lastError: message
        })
        failed += 1
      }
    }
  }
  return { replayed, failed, conflicted }
}

/** 监听网络恢复事件并自动重放队列 */
export function watchOfflineQueue(): () => void {
  const handler = (): void => {
    void flushOfflineQueue()
  }
  window.addEventListener('online', handler)
  return () => window.removeEventListener('online', handler)
}
