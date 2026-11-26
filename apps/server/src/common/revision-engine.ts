/**
 * 通用单据版本快照纯逻辑引擎：快照比对、版本号推进与变更摘要。
 * 与持久层解耦，便于各业务域复用同一套版本机制。
 */

export const REVISION_CHANGE_TYPE = {
  ADDED: 'ADDED',
  REMOVED: 'REMOVED',
  CHANGED: 'CHANGED'
} as const

export type RevisionChangeType = (typeof REVISION_CHANGE_TYPE)[keyof typeof REVISION_CHANGE_TYPE]

export interface RevisionDiffEntry {
  field: string
  type: RevisionChangeType
  before: unknown
  after: unknown
}

export interface RevisionDiffOptions {
  ignoreKeys?: string[]
}

export interface RevisionDiffSummary {
  added: number
  removed: number
  changed: number
  total: number
}

/** 默认忽略的技术字段：时间戳与租户字段不计入业务变更 */
export const DEFAULT_REVISION_IGNORE_KEYS = ['createdAt', 'updatedAt', 'tenantId', 'id']

/** 值比较：数值按容差比较，对象按序列化结果比较 */
export function isSameRevisionValue(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (left === null || left === undefined || right === null || right === undefined) return false
  if (typeof left === 'number' && typeof right === 'number') return Math.abs(left - right) < 1e-9
  if (typeof left === 'object' || typeof right === 'object') {
    return JSON.stringify(left) === JSON.stringify(right)
  }
  return String(left) === String(right)
}

/** 快照比对：输出新增、删除与变更三类差异 */
export function diffSnapshots(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  options: RevisionDiffOptions = {}
): RevisionDiffEntry[] {
  const ignore = new Set([...(options.ignoreKeys ?? []), ...DEFAULT_REVISION_IGNORE_KEYS])
  const left = before ?? {}
  const right = after ?? {}
  const keys = new Set([...Object.keys(left), ...Object.keys(right)])
  const entries: RevisionDiffEntry[] = []
  for (const key of keys) {
    if (ignore.has(key)) continue
    const hasLeft = Object.prototype.hasOwnProperty.call(left, key)
    const hasRight = Object.prototype.hasOwnProperty.call(right, key)
    if (!hasLeft) {
      entries.push({ field: key, type: REVISION_CHANGE_TYPE.ADDED, before: null, after: right[key] })
      continue
    }
    if (!hasRight) {
      entries.push({ field: key, type: REVISION_CHANGE_TYPE.REMOVED, before: left[key], after: null })
      continue
    }
    if (!isSameRevisionValue(left[key], right[key])) {
      entries.push({ field: key, type: REVISION_CHANGE_TYPE.CHANGED, before: left[key], after: right[key] })
    }
  }
  return entries.sort((leftEntry, rightEntry) => leftEntry.field.localeCompare(rightEntry.field))
}

/** 版本号推进：首次为 1，之后逐次递增 */
export function nextRevisionVersion(current?: number | null): number {
  const base = Number.isFinite(current) ? Number(current) : 0
  return base + 1
}

/** 变更摘要 */
export function summarizeRevisionDiff(entries: RevisionDiffEntry[]): RevisionDiffSummary {
  const summary: RevisionDiffSummary = { added: 0, removed: 0, changed: 0, total: entries.length }
  for (const entry of entries) {
    if (entry.type === REVISION_CHANGE_TYPE.ADDED) summary.added += 1
    else if (entry.type === REVISION_CHANGE_TYPE.REMOVED) summary.removed += 1
    else summary.changed += 1
  }
  return summary
}

/** 快照载荷：仅保留可序列化的业务数据，避免把实体元数据带入快照 */
export function buildRevisionPayload(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== 'object') return { value: data ?? null }
  return JSON.parse(JSON.stringify(data)) as Record<string, unknown>
}
