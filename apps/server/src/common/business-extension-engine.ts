import { resolveRuntimeScope, type DataScopeRuleInput } from './role-inherit-engine'
import type { DataScopeLevel } from './contracts'

export function assertApprovalFieldsUnchanged(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[]
): string[] {
  return fields.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
}

export function previewScope(
  bizType: string,
  roleLevel: DataScopeLevel,
  rules: DataScopeRuleInput[]
): { bizType: string; level: DataScopeLevel; orgField: string; matched?: string } {
  const result = resolveRuntimeScope({
    bizType,
    declaredLevel: 'ORG',
    roleLevel,
    rules
  })
  return {
    bizType,
    level: result.level,
    orgField: result.orgField,
    ...(result.rule ? { matched: `${result.rule.bizType}:${result.rule.priority}` } : {})
  }
}

export function buildActivityCalendar(
  items: Array<{ code: string; startTime: Date | string; endTime: Date | string }>
): Array<Record<string, unknown>> {
  const groups = new Map<string, Array<Record<string, unknown>>>()
  for (const item of items) {
    const key = new Date(item.startTime).toISOString().slice(0, 10)
    const list = groups.get(key) ?? []
    list.push({ code: item.code, start: item.startTime, end: item.endTime })
    groups.set(key, list)
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, activities]) => ({ date, activities }))
}

export function generateWaybillNo(carrier: string, seed: string | number): string {
  const prefix: Record<string, string> = { SF: 'SF', YT: 'YT', YTO: 'YT', ZTO: 'ZTO', JD: 'JD', EMS: 'EMS' }
  const code = prefix[carrier.toUpperCase()] ?? 'WL'
  let hash = 0
  for (const char of String(seed)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return `${code}${String(hash).padStart(10, '0')}`
}

export function quickReply(text: string, templates: Array<{ code: string; keywords: string[]; content: string }>): Array<Record<string, unknown>> {
  const lower = text.toLowerCase()
  return templates.map((template) => ({
    code: template.code,
    content: template.content,
    matched: template.keywords.some((keyword) => lower.includes(keyword.toLowerCase()))
  })).sort((a, b) => Number(b.matched) - Number(a.matched))
}

export function buildCollectionPlan(
  items: Array<{ id: number; amount: string; dueDate: Date | string; level?: string }>
): Array<Record<string, unknown>> {
  return items.map((item) => {
    const overdueDays = Math.max(0, Math.floor((Date.now() - new Date(item.dueDate).getTime()) / 86400000))
    const level = overdueDays > 60 ? 'LEGAL' : overdueDays > 30 ? 'MANAGER' : overdueDays > 7 ? 'COLLECTOR' : 'REMINDER'
    return {
      ...item,
      overdueDays,
      actionDate: new Date(Date.now() + (overdueDays > 30 ? 1 : 7) * 86400000).toISOString(),
      level: item.level ?? level
    }
  })
}

export function todoPriority(task: { dueAt?: Date | string | null; createdAt?: Date | string }): 'URGENT' | 'HIGH' | 'NORMAL' {
  const now = Date.now()
  const due = task.dueAt ? new Date(task.dueAt).getTime() : Number.POSITIVE_INFINITY
  if (due < now) return 'URGENT'
  if (due - now <= 4 * 3600000) return 'HIGH'
  return 'NORMAL'
}

export function sortTodos<T extends { dueAt?: Date | string | null; createdAt?: Date | string }>(tasks: T[]): T[] {
  const rank = { URGENT: 0, HIGH: 1, NORMAL: 2 }
  return [...tasks].sort((a, b) => rank[todoPriority(a)] - rank[todoPriority(b)] || new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime())
}

export function smartWriteoffSuggestion(amount: string, settledAmount: string, availableCredit: number): number {
  const remaining = Math.max(0, Number(amount) - Number(settledAmount))
  return Math.min(remaining, Math.max(0, availableCredit), remaining)
}

export function collectionLetter(customer: string, amount: string, overdueDays: number): string {
  return `致 ${customer}：截至今日，逾期款项 ${amount} 元已逾期 ${overdueDays} 天，请于 3 个工作日内完成付款或联系客户经理制定还款计划。`
}

export function serialLabels(prefix: string, start: number, count: number): string[] {
  if (!Number.isFinite(start) || !Number.isFinite(count) || count <= 0 || count > 10000) return []
  return Array.from({ length: count }, (_, index) => `${prefix}${String(start + index).padStart(6, '0')}`)
}
