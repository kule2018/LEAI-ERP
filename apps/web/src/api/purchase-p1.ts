import { request } from '@/utils/http'
import type { PageResult } from '@/types/contract'

export interface CrossDock {
  id: number
  crossdockNo: string
  supplierId: number
  customerId: number | null
  purchaseOrderId: number | null
  productId: number
  qty: string
  status: string
  createdAt: string
}

export interface SupplierFine {
  id: number
  fineNo: string
  supplierId: number
  fineType: string
  amount: string
  deductedAmount: string
  reason: string | null
  status: string
  createdAt: string
}

export function fetchCrossDocks(params: Record<string, unknown>) {
  return request<PageResult<CrossDock>>({ url: '/purchase/crossdocks', method: 'get', params })
}
export function createCrossDock(data: Record<string, unknown>) {
  return request<CrossDock>({ url: '/purchase/crossdocks', method: 'post', data })
}
export function transitionCrossDock(id: number, action: string) {
  return request<CrossDock>({ url: `/purchase/crossdocks/${id}/${action}`, method: 'post' })
}
export function fetchSupplierFines(params: Record<string, unknown>) {
  return request<PageResult<SupplierFine>>({ url: '/purchase/fines', method: 'get', params })
}
export function createSupplierFine(data: Record<string, unknown>) {
  return request<SupplierFine>({ url: '/purchase/fines', method: 'post', data })
}
export function approveSupplierFine(id: number) {
  return request<SupplierFine>({ url: `/purchase/fines/${id}/approve`, method: 'post' })
}
export function deductSupplierFine(id: number, amount: number) {
  return request<SupplierFine>({ url: `/purchase/fines/${id}/deduct`, method: 'post', data: { amount } })
}
