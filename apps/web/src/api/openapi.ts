import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface ApiKey {
  id: number
  keyId: string
  name: string
  scopes: string[]
  status: string
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
}

export interface CreatedApiKey extends ApiKey {
  secret: string
}

export interface Webhook {
  id: number
  name: string
  url: string
  eventTypes: string[]
  secretMask: string | null
  status: string
  retryLimit: number
  createdAt: string
}

export interface WebhookDelivery {
  id: number
  webhookId: number
  eventType: string
  payload: Record<string, unknown>
  status: string
  attemptCount: number
  responseText: string | null
  nextRetryAt: string | null
  createdAt: string
  deliveredAt: string | null
}

export interface PublishResult {
  eventType: string
  deliveries: WebhookDelivery[]
}

interface OpenApiQuery extends PageQuery {
  status?: string
}

export function fetchApiKeys(params: OpenApiQuery) {
  return request<PageResult<ApiKey>>({ url: '/openapi/keys', method: 'get', params })
}

export function createApiKey(data: { name: string; scopes: string[]; expiresAt?: string; status?: string }) {
  return request<CreatedApiKey>({ url: '/openapi/keys', method: 'post', data })
}

export function rotateApiKey(id: number) {
  return request<CreatedApiKey>({ url: `/openapi/keys/${id}/rotate`, method: 'post' })
}

export function setApiKeyStatus(id: number, status: 'ACTIVE' | 'DISABLED') {
  return request<ApiKey>({ url: `/openapi/keys/${id}/status`, method: 'put', data: { status } })
}

export function removeApiKey(id: number) {
  return request<void>({ url: `/openapi/keys/${id}`, method: 'delete' })
}

export function fetchWebhooks(params: OpenApiQuery) {
  return request<PageResult<Webhook>>({ url: '/openapi/webhooks', method: 'get', params })
}

export function createWebhook(data: Record<string, unknown>) {
  return request<Webhook>({ url: '/openapi/webhooks', method: 'post', data })
}

export function updateWebhook(id: number, data: Record<string, unknown>) {
  return request<Webhook>({ url: `/openapi/webhooks/${id}`, method: 'put', data })
}

export function removeWebhook(id: number) {
  return request<void>({ url: `/openapi/webhooks/${id}`, method: 'delete' })
}

export function fetchDeliveries(params: OpenApiQuery) {
  return request<PageResult<WebhookDelivery>>({ url: '/openapi/deliveries', method: 'get', params })
}

export function retryDelivery(id: number) {
  return request<WebhookDelivery>({ url: `/openapi/deliveries/${id}/retry`, method: 'post' })
}

export function publishEvent(data: { eventType: string; payload: Record<string, unknown> }) {
  return request<PublishResult>({ url: '/openapi/events/publish', method: 'post', data })
}
