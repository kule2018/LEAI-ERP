import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

const base = '/hr'

export function fetchEmployeeRecords(params: PageQuery) {
  return request<PageResult<Record<string, unknown>>>({ url: `${base}/employee-records`, method: 'get', params })
}

export function createEmployeeRecord(data: Record<string, unknown>) {
  return request<{ record: Record<string, unknown>; expiryWarning: { expiring: boolean; days: number } | null }>({
    url: `${base}/employee-records`, method: 'post', data
  })
}

export function approveEmployeeRecord(id: number, data: { status: string; note?: string }) {
  return request<Record<string, unknown>>({ url: `${base}/employee-records/${id}/approve`, method: 'post', data })
}

export function createOffer(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/offers`, method: 'post', data })
}

export function createPayrollDetail(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/payroll-details`, method: 'post', data })
}

export function reviewPayroll(id: number, status: string) {
  return request<Record<string, unknown>>({ url: `${base}/payroll-details/${id}/review`, method: 'post', data: { status } })
}

export function createPerformanceReview(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/performance-reviews`, method: 'post', data })
}

export function appealPerformance(id: number, reason: string) {
  return request<Record<string, unknown>>({ url: `${base}/performance-reviews/${id}/appeal`, method: 'post', data: { reason } })
}

export function createTrainingRecord(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/training-records`, method: 'post', data })
}

export function assetAction(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/asset-actions`, method: 'post', data })
}
