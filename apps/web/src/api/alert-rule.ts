import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface AlertRule {
  id: number
  ruleCode: string
  ruleName: string
  bizType: string
  metric: string
  comparator: string
  threshold: string
  windowMinutes: number
  severity: string
  notifyChannels: string[] | null
  enabled: number
  description: string | null
  createdAt: string
}

export interface AlertRuleQuery extends PageQuery {
  bizType?: string
  metric?: string
  enabled?: boolean
}

export interface AlertRulePayload {
  ruleCode?: string
  ruleName?: string
  bizType?: string
  metric?: string
  comparator?: string
  threshold?: number
  windowMinutes?: number
  severity?: string
  notifyChannels?: string[]
  enabled?: boolean
  description?: string
}

export function fetchAlertRules(params: AlertRuleQuery) {
  return request<PageResult<AlertRule>>({ url: '/alert/rules', method: 'get', params })
}

export function createAlertRule(data: AlertRulePayload) {
  return request<AlertRule>({ url: '/alert/rules', method: 'post', data })
}

export function updateAlertRule(id: number, data: AlertRulePayload) {
  return request<AlertRule>({ url: `/alert/rules/${id}`, method: 'put', data })
}

export function deleteAlertRule(id: number) {
  return request<{ id: number }>({ url: `/alert/rules/${id}`, method: 'delete' })
}

export function fetchAlertThresholds(bizType?: string) {
  return request<{ bizType: string | null; thresholds: Record<string, number> }>({
    url: '/alert/rules/thresholds',
    method: 'get',
    params: bizType ? { bizType } : undefined
  })
}
