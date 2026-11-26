import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface Notification {
  id: number
  notifyNo: string
  title: string
  content: string | null
  channel: string
  readFlag: string
  createdAt: string
}

export interface NotificationQuery extends PageQuery {
  readFlag?: string
  channel?: string
}

export interface CreateNotification {
  title: string
  content?: string
  channel: string
  receiverId: number
  bizType?: string
  bizId?: number
}

export function fetchNotifications(params: NotificationQuery) {
  return request<PageResult<Notification>>({ url: '/system/notify', method: 'get', params })
}

export function createNotification(data: CreateNotification) {
  return request<Notification>({ url: '/system/notify', method: 'post', data })
}

export function markNotificationRead(id: number) {
  return request<Notification>({ url: `/system/notify/${id}/read`, method: 'put', data: { readFlag: 'YES' } })
}

export interface NotifyTemplate {
  id: number
  code: string
  name: string
  title: string
  content: string
  channels: string
  status: string
  createdAt: string
  variables: string[]
}

export interface NotifyTemplateInput {
  code?: string
  name: string
  title: string
  content: string
  channels?: string
}

export interface NotifySendRecord {
  id: number
  notifyNo: string
  title: string
  channel: string
  templateCode: string | null
  receiverId: number
  targetAddress: string | null
  sendStatus: string
  retryCount: number
  lastError: string | null
  deliveredAt: string | null
  createdAt: string
}

export interface NotifySendRecordQuery extends PageQuery {
  sendStatus?: string
  channel?: string
  templateCode?: string
}

/** 通知模板列表（含变量清单与启停状态） */
export function fetchNotifyTemplates() {
  return request<NotifyTemplate[]>({ url: '/system/notify/templates', method: 'get' })
}

/** 新建通知模板 */
export function createNotifyTemplate(data: NotifyTemplateInput) {
  return request<NotifyTemplate>({ url: '/system/notify/templates', method: 'post', data })
}

/** 更新通知模板（含启停） */
export function updateNotifyTemplate(id: number, data: Partial<NotifyTemplateInput> & { status?: string }) {
  return request<NotifyTemplate>({ url: `/system/notify/templates/${id}`, method: 'put', data })
}

/** 按模板发送通知（需提供模板变量） */
export function sendNotifyByTemplate(code: string, data: {
  receiverId: number
  variables: Record<string, unknown>
  level?: string
  bizType?: string
  bizId?: number
}) {
  return request<NotifySendRecord[]>({ url: `/system/notify/send/${encodeURIComponent(code)}`, method: 'post', data })
}

/** 渠道连通性测试 */
export function testNotifyChannel(data: { channel: string; target?: string }) {
  return request<{ ok: boolean; reason: string | null; gatewayUrl: string | null }>({
    url: '/system/notify/channels/test',
    method: 'post',
    data
  })
}

/** 失败通知重试 */
export function retryNotify(id: number) {
  return request<NotifySendRecord>({ url: `/system/notify/${id}/retry`, method: 'post' })
}

/** 通知发送记录查询 */
export function fetchNotifySendRecords(params: NotifySendRecordQuery) {
  return request<PageResult<NotifySendRecord>>({ url: '/system/notify/send-records', method: 'get', params })
}
