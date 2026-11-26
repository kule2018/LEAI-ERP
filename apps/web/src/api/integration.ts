import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface IntegrationConfig {
  id: number
  channel: string
  name: string
  webhookUrl: string
  secretMask: string | null
  status: string
  createdAt: string
}

export interface IntegrationMessage {
  id: number
  channel: string
  title: string
  content: string | null
  status: string
  responseText: string | null
  createdAt: string
}

interface IntegrationQuery extends PageQuery {
  channel?: string
  status?: string
}

export function fetchIntegrationConfigs(params: IntegrationQuery) {
  return request<PageResult<IntegrationConfig>>({ url: '/integration/configs', method: 'get', params })
}

export function upsertIntegrationConfig(data: Record<string, unknown>) {
  return request<IntegrationConfig>({ url: '/integration/configs', method: 'post', data })
}

export function updateIntegrationConfig(id: number, data: Record<string, unknown>) {
  return request<IntegrationConfig>({ url: `/integration/configs/${id}`, method: 'put', data })
}

export function removeIntegrationConfig(id: number) {
  return request<void>({ url: `/integration/configs/${id}`, method: 'delete' })
}

export function fetchIntegrationMessages(params: IntegrationQuery) {
  return request<PageResult<IntegrationMessage>>({ url: '/integration/messages', method: 'get', params })
}

export function sendTodo(channel: 'WECHAT' | 'DINGTALK', data: Record<string, unknown>) {
  return request<IntegrationMessage>({ url: `/integration/todos/${channel}`, method: 'post', data })
}
