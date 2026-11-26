import { request } from '@/utils/http'

const base = '/sales'

export function smartAssignLead(id: number) {
  return request<Record<string, unknown>>({ url: `${base}/leads/${id}/smart-assign`, method: 'post' })
}

export function duplicateLeads(id: number) {
  return request<Array<Record<string, unknown>>>({ url: `${base}/leads/${id}/duplicates`, method: 'get' })
}

export function advanceOpportunity(id: number, data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/opportunities/${id}/advance`, method: 'post', data })
}

export function approveQuotation(id: number, status: string) {
  return request<Record<string, unknown>>({ url: `${base}/quotations/${id}/approve`, method: 'post', data: { status } })
}

export function convertQuotation(id: number) {
  return request<Record<string, unknown>>({ url: `${base}/quotations/${id}/convert`, method: 'post' })
}

export function createCustomerMerge(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/customer-merges`, method: 'post', data })
}

export function approveCustomerMerge(id: number, status: string) {
  return request<Record<string, unknown>>({ url: `${base}/customer-merges/${id}/approve`, method: 'post', data: { status } })
}

export function hangPosOrder(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/pos-hang`, method: 'post', data })
}

export function resumePosHang(id: number) {
  return request<Record<string, unknown>>({ url: `${base}/pos-hang/${id}/resume`, method: 'post' })
}

export function refreshTarget(id: number) {
  return request<Record<string, unknown>>({ url: `${base}/targets/${id}/refresh`, method: 'post' })
}

/** 客户 360 画像 */
export function fetchCustomerProfile360(customerId: number) {
  return request<Record<string, unknown>>({ url: `${base}/customers/${customerId}/profile-360`, method: 'get' })
}

/** 客户联系人（销售扩展图谱） */
export function fetchCrmContacts(customerId: number) {
  return request<Array<Record<string, unknown>>>({ url: `${base}/customers/${customerId}/contacts`, method: 'get' })
}

export function createCrmContact(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/customers/contacts`, method: 'post', data })
}

/** 客户流失预警 */
export function scanChurnWarnings() {
  return request<Array<Record<string, unknown>>>({ url: `${base}/churn-warnings/scan`, method: 'get' })
}

export function handleChurnWarning(id: number, status: string) {
  return request<Record<string, unknown>>({ url: `${base}/churn-warnings/${id}/handle`, method: 'post', data: { status } })
}

/** 报价版本快照与对比 */
export function saveQuotationVersion(id: number, changeReason?: string) {
  return request<Record<string, unknown>>({ url: `${base}/quotation-versions/${id}/snapshot`, method: 'post', data: { changeReason } })
}

export function compareQuotationVersions(id: number, baseVersion?: number) {
  return request<Record<string, unknown>>({ url: `${base}/quotation-versions/${id}/compare`, method: 'get', params: { baseVersion } })
}

/** POS 多支付与会员价 */
export function posPay(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/pos/payments`, method: 'post', data })
}

export function setMemberPrice(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/pos/member-price`, method: 'post', data })
}

export function fetchMemberPrice(customerId: number, productId: number) {
  return request<Record<string, unknown>>({ url: `${base}/pos/member-price/query`, method: 'get', params: { customerId, productId } })
}

/** 退货红字发票 */
export function createRedInvoice(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/red-invoices`, method: 'post', data })
}

/** 销售目标达成预警 */
export function fetchTargetAlerts() {
  return request<Array<Record<string, unknown>>>({ url: `${base}/targets/alerts`, method: 'get' })
}
