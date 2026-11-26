import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface NotifyRule {
  id: number
  ruleCode: string
  ruleName: string
  eventType: string
  bizType: string
  templateCode: string
  channels: string | null
  level: string
  receiverType: string
  receiverIds: number[] | null
  priority: number
  enabled: number
  description: string | null
  createdAt: string
}

export interface NotifyRuleQuery extends PageQuery {
  eventType?: string
  bizType?: string
  enabled?: boolean
}

export interface NotifyRulePayload {
  ruleCode?: string
  ruleName?: string
  eventType?: string
  bizType?: string
  templateCode?: string
  channels?: string
  level?: string
  receiverType?: string
  receiverIds?: number[]
  priority?: number
  enabled?: boolean
  description?: string
}

export function fetchNotifyRules(params: NotifyRuleQuery) {
  return request<PageResult<NotifyRule>>({ url: '/system/notify/rules', method: 'get', params })
}

export function createNotifyRule(data: NotifyRulePayload) {
  return request<NotifyRule>({ url: '/system/notify/rules', method: 'post', data })
}

export function updateNotifyRule(id: number, data: NotifyRulePayload) {
  return request<NotifyRule>({ url: `/system/notify/rules/${id}`, method: 'put', data })
}

export function deleteNotifyRule(id: number) {
  return request<{ id: number }>({ url: `/system/notify/rules/${id}`, method: 'delete' })
}
