import { portalRequest } from '@/utils/portal-http'
import { request } from '@/utils/http'
import type { PageResult } from '@/types/contract'

const base = '/purchase/external/portal'

export interface PortalProfile {
  portalUserId: number
  tenantId: number
  supplierId: number
  supplierName: string
  username: string
  displayName: string
  phone: string | null
  email: string | null
}

export interface PortalSummary {
  supplierId: number
  orderCount: number
  pendingConfirmCount: number
  orderAmount: string
  statementCount: number
  unpaidAmount: string
  receiptCount: number
  invoiceCount: number
}

export interface PortalAccount {
  id: number
  tenantId: number
  supplierId: number
  username: string
  displayName: string
  phone: string | null
  email: string | null
  status: string
  failedLoginCount: number
  lastLoginAt: string | null
  createdAt: string
}

/** 门户登录（外部供应商账号，独立于内部员工体系） */
export function portalLogin(data: { tenantCode?: string; username: string; password: string }) {
  return portalRequest<{ accessToken: string; expiresIn: string; profile: PortalProfile }>({
    url: `${base}/auth/login`,
    method: 'post',
    data
  })
}

export function portalLogout() {
  return portalRequest<{ loggedOut: boolean }>({ url: `${base}/auth/logout`, method: 'post' })
}

export function fetchPortalProfile() {
  return portalRequest<PortalProfile>({ url: `${base}/auth/profile`, method: 'get' })
}

export function fetchPortalSummary() {
  return portalRequest<PortalSummary>({ url: `${base}/summary`, method: 'get' })
}

export function fetchPortalOrders(params: { page?: number; pageSize?: number; status?: string }) {
  return portalRequest<PageResult<Record<string, unknown>>>({ url: `${base}/orders`, method: 'get', params })
}

export function fetchPortalOrderDetail(id: number) {
  return portalRequest<{ order: Record<string, unknown>; lines: Record<string, unknown>[]; receipts: Record<string, unknown>[] }>({
    url: `${base}/orders/${id}`,
    method: 'get'
  })
}

export function portalConfirmOrder(id: number) {
  return portalRequest<Record<string, unknown>>({ url: `${base}/orders/${id}/confirm`, method: 'post' })
}

export function fetchPortalStatements(params: { page?: number; pageSize?: number; status?: string }) {
  return portalRequest<PageResult<Record<string, unknown>>>({ url: `${base}/statements`, method: 'get', params })
}

export function portalConfirmStatement(id: number) {
  return portalRequest<Record<string, unknown>>({ url: `${base}/statements/${id}/confirm`, method: 'post' })
}

export function fetchPortalShipments(params: { page?: number; pageSize?: number; status?: string }) {
  return portalRequest<PageResult<Record<string, unknown>>>({ url: `${base}/shipments`, method: 'get', params })
}

export function portalCreateShipment(data: {
  waybillNo: string
  carrierId: number
  sourceType?: string
  sourceId?: number
  freightAmount?: string
}) {
  return portalRequest<Record<string, unknown>>({ url: `${base}/shipments`, method: 'post', data })
}

export function fetchPortalInvoices(params: { page?: number; pageSize?: number; status?: string }) {
  return portalRequest<PageResult<Record<string, unknown>>>({ url: `${base}/invoices`, method: 'get', params })
}

export function portalCreateInvoice(data: { invoiceNo: string; amount: string; taxAmount?: string; receiptId?: number }) {
  return portalRequest<Record<string, unknown>>({ url: `${base}/invoices`, method: 'post', data })
}

export function fetchPortalActions(params: { page?: number; pageSize?: number }) {
  return portalRequest<PageResult<Record<string, unknown>>>({ url: `${base}/actions`, method: 'get', params })
}

// ------------------------------------------------------------ 内部账号管理

const accountBase = '/purchase/portal/accounts'

export function fetchPortalAccounts(params: { page?: number; pageSize?: number; supplierId?: number }) {
  return request<PageResult<PortalAccount>>({ url: accountBase, method: 'get', params })
}

export function createPortalAccount(data: {
  supplierId: number
  username: string
  password: string
  displayName?: string
  phone?: string
  email?: string
}) {
  return request<PortalAccount>({ url: accountBase, method: 'post', data })
}

export function updatePortalAccountStatus(id: number, status: 'ACTIVE' | 'DISABLED') {
  return request<PortalAccount>({ url: `${accountBase}/${id}/status`, method: 'patch', data: { status } })
}

export function resetPortalAccountPassword(id: number, password: string) {
  return request<{ reset: boolean }>({ url: `${accountBase}/${id}/reset-password`, method: 'post', data: { password } })
}
