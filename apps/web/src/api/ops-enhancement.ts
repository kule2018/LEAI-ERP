import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

/* ---------------- 条码标签与序列号 ---------------- */
export interface LabelInstance {
  id: number
  templateCode: string
  productId: number
  variantId: number
  serialNo: string
  barcodeType: string
  batchNo: string
  printCount: number
  lastPrintedAt: string | null
  status: string
}

export interface BarcodeRule {
  id: number
  ruleCode: string
  prefix: string
  dateFormat: string
  seqLength: number
  resetCycle: string
  barcodeType: string
  status: string
  remark: string | null
}

export function batchGenerateLabels(data: {
  labelTemplateId: number
  productId: number
  variantId?: number
  batchNo?: string
  count: number
  ruleCode?: string
}) {
  return request<LabelInstance[]>({ url: '/print/labels/batch-generate', method: 'post', data })
}

export function fetchLabelInstances(params: PageQuery & { productId?: number; status?: string }) {
  return request<PageResult<LabelInstance>>({ url: '/print/label-instances', method: 'get', params })
}

export function printLabelInstance(id: number) {
  return request<{ instance: LabelInstance; warning: string | null }>({
    url: `/print/label-instances/${id}/print`,
    method: 'post'
  })
}

export function fetchBarcodeRules() {
  return request<BarcodeRule[]>({ url: '/print/barcode-rules', method: 'get' })
}

export function createBarcodeRule(data: Partial<BarcodeRule>) {
  return request<BarcodeRule>({ url: '/print/barcode-rules', method: 'post', data })
}

/* ---------------- 库存作业 ---------------- */
export interface AvailableStockRow {
  productId: number
  variantId: number
  warehouseId: number
  locationId: number
  batchNo: string
  qtyOnHand: number
  qtyOccupied: number
  qtyFrozen: number
  qtyAvailable: number
}

export function fetchAvailableStock(params: { warehouseId?: number; productId?: number }) {
  return request<AvailableStockRow[]>({ url: '/inventory/balances/available', method: 'get', params })
}

export interface MatrixRow {
  productId: number
  warehouseId: number
  totalOnHand: number
  totalOccupied: number
  totalFrozen: number
  totalAvailable: number
  cells: Array<{ locationId: number; batchNo: string; qtyOnHand: number; qtyAvailable: number }>
}

export function fetchBatchLocationMatrix(params: { warehouseId?: number; productId?: number }) {
  return request<MatrixRow[]>({ url: '/inventory/balances/matrix', method: 'get', params })
}

export function scanStocktake(id: number, scans: Array<{ lineId?: number; productId?: number; barcode?: string; batchNo?: string; qty: string }>) {
  return request<{ stocktake: Record<string, unknown>; result: { scannedCount: number; scannedQty: number; blindMode: boolean } }>({
    url: `/inventory/stocktakes/${id}/scan`,
    method: 'post',
    data: { scans }
  })
}

export function receiveTransfer(id: number, lines: Array<{ lineId: number; receivedQty: string }>, remark?: string) {
  return request<Record<string, unknown>>({ url: `/inventory/transfers/${id}/receive`, method: 'post', data: { lines, remark } })
}

/* ---------------- 协同增强 ---------------- */
export function markChatRead(id: number) {
  return request<Record<string, unknown>>({ url: `/collab/chats/${id}/read`, method: 'post' })
}

export function fetchUnreadChatCount() {
  return request<{ unread: number }>({ url: '/collab/chats/unread-count', method: 'get' })
}

export function fetchSensitiveWords() {
  return request<Array<{ id: number; word: string; level: string; enabled: string }>>({
    url: '/collab/sensitive-words',
    method: 'get'
  })
}

export function createSensitiveWord(data: { word: string; level?: string }) {
  return request<Record<string, unknown>>({ url: '/collab/sensitive-words', method: 'post', data })
}

export function removeSensitiveWord(id: number) {
  return request<void>({ url: `/collab/sensitive-words/${id}`, method: 'delete' })
}

export function confirmNotice(id: number) {
  return request<Record<string, unknown>>({ url: `/collab/notices/${id}/confirm`, method: 'post' })
}

export function createMeeting(data: { title: string; projectId?: number; meetingAt?: string; minutes?: string }) {
  return request<{ meeting: Record<string, unknown>; tasks: Array<Record<string, unknown>> }>({
    url: '/collab/meetings',
    method: 'post',
    data
  })
}

/** 批量审批待办 */
export function batchActTasks(ids: number[], action: 'APPROVE' | 'REJECT', comment?: string) {
  return request<{ succeeded: number[]; failed: Array<{ id: number; reason: string }> }>({
    url: '/collab/flows/tasks/batch-act',
    method: 'post',
    data: { ids, action, comment }
  })
}

/* ---------------- 人事增强 ---------------- */
export function fetchPunchRequests(params: PageQuery & { status?: string }) {
  return request<PageResult<{ id: number; employeeId: number; punchDate: string; status: string; reason: string }>>({
    url: '/hr/punch-requests',
    method: 'get',
    params
  })
}

export function createPunchRequest(data: { employeeId: number; punchDate: string; punchType?: string; reason: string }) {
  return request<Record<string, unknown>>({ url: '/hr/punch-requests', method: 'post', data })
}

export function approvePunchRequest(id: number, decision: 'APPROVE' | 'REJECT', comment?: string) {
  return request<Record<string, unknown>>({ url: `/hr/punch-requests/${id}/approve`, method: 'post', data: { decision, comment } })
}

export function approveSalary(id: number, decision: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'PAY', comment?: string) {
  return request<Record<string, unknown>>({ url: `/hr/salaries/${id}/approve`, method: 'post', data: { decision, comment } })
}

export function resolvePerformanceAppeal(id: number, result: 'ACCEPT' | 'REJECT', resolution?: string) {
  return request<Record<string, unknown>>({
    url: `/hr/performance-reviews/${id}/appeal-resolve`,
    method: 'post',
    data: { result, resolution }
  })
}

export function fetchExpiringCertificates(days = 30) {
  return request<Array<{ id: number; employeeId: number; expireDate: string; daysToExpire: number | null; expired: boolean }>>({
    url: '/hr/training-certificates/expiring',
    method: 'get',
    params: { days }
  })
}

export interface VehicleExpense {
  id: number
  vehicleId: number
  expenseType: string
  amount: string
  expenseDate: string
  remark: string | null
  status: string
}

export function fetchVehicleExpenses(params: PageQuery & { status?: string }) {
  return request<PageResult<VehicleExpense>>({ url: '/hr/vehicle-expenses', method: 'get', params })
}

export function createVehicleExpense(data: {
  vehicleId: number
  vehicleUseId?: number
  expenseType?: string
  amount: string
  expenseDate: string
  remark?: string
}) {
  return request<Record<string, unknown>>({ url: '/hr/vehicle-expenses', method: 'post', data })
}

export function fetchVehicleTracks(vehicleId: number) {
  return request<Array<{ id: number; longitude: string; latitude: string; speed: string; trackedAt: string }>>({
    url: '/hr/vehicle-tracks',
    method: 'get',
    params: { vehicleId }
  })
}
