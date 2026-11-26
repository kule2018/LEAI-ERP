import { ApiError, OfflineQueuedError, request } from './http'
import {
  listQueuedRequests,
  removeQueuedRequest,
  updateQueuedRequest,
  type QueuedRequest
} from './offline-queue'

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** 离线暂存时的业务上下文：表单类型、标题与本地单号 */
    offlineMeta?: { formType: string; label: string; localNo: string }
  }
}

export type OfflineFormStatus = 'success' | 'queued' | 'conflict' | 'failed'

export interface OfflineFormOptions {
  /** 业务表单类型：POS / STOCKTAKE / WAVE_PICK / RECEIPT ... */
  formType: string
  /** 表单标题，用于待同步清单展示 */
  label: string
  url: string
  method: 'post' | 'put' | 'patch' | 'delete'
  data: Record<string, unknown>
  params?: Record<string, unknown>
}

export interface OfflineFormResult<T> {
  status: OfflineFormStatus
  data?: T
  /** 本地单号：离线期间生成，用于线下核对 */
  localNo: string
  message?: string
}

const FORM_PREFIX: Record<string, string> = {
  POS: 'POS',
  STOCKTAKE: 'STK',
  WAVE_PICK: 'WPK',
  RECEIPT: 'RCP',
  SALES_ORDER: 'SO',
  OUTBOUND: 'OUT'
}

/** 生成本地单号：业务前缀 + 日期 + 时分秒 + 随机序列 */
export function buildLocalNo(formType: string): string {
  const prefix = FORM_PREFIX[formType] ?? formType.slice(0, 3).toUpperCase()
  const now = new Date()
  const pad = (value: number, size = 2): string => String(value).padStart(size, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const serial = pad(Math.floor(Math.random() * 1000), 3)
  return `${prefix}-${stamp}-${serial}`
}

/**
 * 统一的离线表单提交：
 * 在线直接提交；网络不可用时暂存到离线队列并返回本地单号；
 * 服务端返回 409 视为「疑似已提交」，提示人工核对而不重复建单。
 */
export async function submitOfflineForm<T>(options: OfflineFormOptions): Promise<OfflineFormResult<T>> {
  const localNo = buildLocalNo(options.formType)
  const idempotencyKey = `${options.formType}:${localNo}`
  try {
    const data = await request<T>({
      url: options.url,
      method: options.method,
      data: options.data,
      params: options.params,
      headers: { 'Idempotency-Key': idempotencyKey },
      offlineMeta: { formType: options.formType, label: options.label, localNo }
    })
    return { status: 'success', data, localNo }
  } catch (error) {
    if (error instanceof OfflineQueuedError) {
      return { status: 'queued', localNo, message: error.message }
    }
    if (error instanceof ApiError && error.status === 409) {
      return { status: 'conflict', localNo, message: error.message }
    }
    return {
      status: 'failed',
      localNo,
      message: error instanceof Error ? error.message : '提交失败'
    }
  }
}

/** 待同步表单清单 */
export function listOfflineForms(): QueuedRequest[] {
  return listQueuedRequests()
}

/** 手动重试一条暂存表单 */
export async function retryOfflineForm(idempotencyKey: string): Promise<OfflineFormStatus> {
  const item = listQueuedRequests().find((entry) => entry.idempotencyKey === idempotencyKey)
  if (!item) return 'failed'
  updateQueuedRequest(idempotencyKey, { status: 'pending', attempts: item.attempts + 1, lastError: undefined })
  const { flushOfflineQueue } = await import('./http')
  const result = await flushOfflineQueue()
  const refreshed = listQueuedRequests().find((entry) => entry.idempotencyKey === idempotencyKey)
  if (!refreshed) return 'success'
  if (refreshed.status === 'conflict') return 'conflict'
  return result.failed > 0 ? 'failed' : 'queued'
}

/** 放弃一条暂存表单（确认单据未生成或已线下处理） */
export function discardOfflineForm(idempotencyKey: string): void {
  removeQueuedRequest(idempotencyKey)
}

/** 待同步数量统计 */
export function offlineFormSummary(): { total: number; pending: number; conflict: number; failed: number } {
  const items = listQueuedRequests()
  return {
    total: items.length,
    pending: items.filter((item) => item.status === 'pending').length,
    conflict: items.filter((item) => item.status === 'conflict').length,
    failed: items.filter((item) => item.status === 'failed').length
  }
}
