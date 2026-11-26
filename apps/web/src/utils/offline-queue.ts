import type { AxiosRequestConfig } from 'axios'

/** 离线暂存条目状态：pending 待同步、conflict 需人工核对、failed 服务端拒绝 */
export type OfflineFormStatus = 'pending' | 'conflict' | 'failed'

/** 离线暂存队列条目：网络不可用时暂存写请求，恢复后按原幂等键重放 */
export interface QueuedRequest {
  id: string
  method: string
  url: string
  data: unknown
  params?: unknown
  idempotencyKey: string
  createdAt: number
  /** 业务表单类型：POS / STOCKTAKE / WAVE_PICK / RECEIPT ... */
  formType: string
  /** 表单标题，供待同步清单展示 */
  label: string
  /** 本地单号：离线期间生成的业务单据号，便于线下核对 */
  localNo: string
  status: OfflineFormStatus
  /** 已重放次数 */
  attempts: number
  /** 最近一次失败原因 */
  lastError?: string
}

const QUEUE_KEY = 'leaierp_offline_queue'
const MAX_QUEUE = 50

export interface EnqueueMeta {
  formType?: string
  label?: string
  localNo?: string
}

function read(): QueuedRequest[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as QueuedRequest[]
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => ({
      ...item,
      formType: item.formType ?? 'UNKNOWN',
      label: item.label ?? item.url,
      localNo: item.localNo ?? '',
      status: item.status ?? 'pending',
      attempts: item.attempts ?? 0
    }))
  } catch {
    return []
  }
}

function write(items: QueuedRequest[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(0, MAX_QUEUE)))
  } catch {
    // 存储不可用时忽略，队列仅做尽力而为
  }
}

/** 入队一条待同步写请求 */
export function enqueueRequest(config: AxiosRequestConfig, meta: EnqueueMeta = {}): QueuedRequest | null {
  const method = (config.method ?? 'get').toLowerCase()
  if (method === 'get') return null
  const headers = (config.headers ?? {}) as Record<string, string | undefined>
  const idempotencyKey = headers['Idempotency-Key'] ?? ''
  if (!idempotencyKey) return null
  const item: QueuedRequest = {
    id: `${idempotencyKey}`,
    method,
    url: String(config.url ?? ''),
    data: config.data ?? null,
    params: config.params ?? null,
    idempotencyKey,
    createdAt: Date.now(),
    formType: meta.formType ?? 'UNKNOWN',
    label: meta.label ?? String(config.url ?? ''),
    localNo: meta.localNo ?? '',
    status: 'pending',
    attempts: 0
  }
  const items = read().filter((entry) => entry.idempotencyKey !== idempotencyKey)
  items.unshift(item)
  write(items)
  return item
}

/** 读取队列 */
export function listQueuedRequests(): QueuedRequest[] {
  return read()
}

/** 更新队列条目状态（冲突提示、重试计数等） */
export function updateQueuedRequest(idempotencyKey: string, patch: Partial<QueuedRequest>): void {
  write(read().map((item) => (item.idempotencyKey === idempotencyKey ? { ...item, ...patch } : item)))
}

/** 移除队列条目 */
export function removeQueuedRequest(idempotencyKey: string): void {
  write(read().filter((item) => item.idempotencyKey !== idempotencyKey))
}

/** 清空队列 */
export function clearQueuedRequests(): void {
  write([])
}

/** 队列长度 */
export function queuedRequestCount(): number {
  return read().length
}

/** 需人工核对的条目数量 */
export function conflictedRequestCount(): number {
  return read().filter((item) => item.status !== 'pending').length
}
