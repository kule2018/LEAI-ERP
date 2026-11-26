import { request } from '@/utils/http'
import type { PageResult } from '@/types/contract'

export interface CommissionRule {
  id: number
  ruleCode: string
  ruleName: string
  ruleType: string
  rate: string | null
  fixedAmount: string | null
  tiers: Array<{ min: number; rate: number }> | null
  salesRepId: number | null
  effectiveFrom: string | null
  effectiveTo: string | null
  status: string
}

export interface CommissionRecord {
  id: number
  ruleId: number
  orderId: number | null
  orderNo: string | null
  salesRepId: number | null
  orderAmount: string
  returnAmount: string
  commissionAmount: string
  period: string
  status: string
  payableId: number | null
  payableNo: string | null
  paidAt: string | null
  remark: string | null
}

export interface CommissionAccrueResult {
  period: string
  created: number
  skipped: number
  totalAmount: number
  records: CommissionRecord[]
}

export interface CommissionPreview {
  ruleId: number
  ruleName: string
  orderId: number
  orderNo: string
  orderAmount: number
  returnAmount: number
  accumulatedAmount: number
  period: string
  result: { commissionAmount: number; matchedTier: { min: number; rate: number } | null; reason: string }
}

export interface Complaint {
  id: number
  complaintNo: string
  customerId: number
  orderId: number | null
  complaintType: string
  title: string
  description: string | null
  severity: string
  status: string
  assigneeId: number | null
  resolution: string | null
  resolvedAt: string | null
  reopenCount: number
  lastActionAt: string | null
  createdAt: string
}

export interface ComplaintLog {
  id: number
  complaintId: number
  action: string
  fromStatus: string
  toStatus: string
  operatorName: string
  remark: string | null
  createdAt: string
}

export interface ComplaintDetail {
  complaint: Complaint
  sla: { dueHours: number; overdue: boolean; overdueHours: number; closed: boolean }
  order: unknown | null
  logs: ComplaintLog[]
}

export interface Visit {
  id: number
  visitNo: string
  customerId: number
  salesRepId: number | null
  visitDate: string
  channel: string
  content: string | null
  feedback: string | null
  nextVisitAt: string | null
  status: string
  satisfaction: number | null
  completedAt: string | null
}

export interface VisitSummary {
  total: number
  planned: number
  done: number
  overdue: number
  rate: number
  avgSatisfaction: number
}

export interface UnshippedRow {
  orderId: number
  orderNo: string
  customerId: number
  customerName: string
  productId: number
  productName: string
  orderedQty: number
  shippedQty: number
  unshippedQty: number
  orderDate: string
  promisedDate: string | null
  overdue: boolean
}

export interface ReturnRateReport {
  salesAmount: number
  returnAmount: number
  rate: number
  percent: string
  orderCount: number
  returnCount: number
  byCustomer: Array<{ customerId: number; customerName: string; salesAmount: number; returnAmount: number; percent: string }>
}

const base = '/sales'

export function fetchCommissionRules(params: Record<string, unknown>) {
  return request<PageResult<CommissionRule>>({ url: `${base}/commissions/rules`, method: 'get', params })
}

export function createCommissionRule(data: Record<string, unknown>) {
  return request<CommissionRule>({ url: `${base}/commissions/rules`, method: 'post', data })
}

export function updateCommissionRule(id: number, data: Record<string, unknown>) {
  return request<CommissionRule>({ url: `${base}/commissions/rules/${id}`, method: 'put', data })
}

export function fetchCommissionRecords(params: Record<string, unknown>) {
  return request<PageResult<CommissionRecord>>({ url: `${base}/commissions/records`, method: 'get', params })
}

export function fetchCommissionSummary(period?: string) {
  return request<{ period: string; totalAmount: number; totalCount: number; bySalesRep: Array<{ salesRepId: number | null; amount: number; count: number }> }>({
    url: `${base}/commissions/records/summary`,
    method: 'get',
    params: period ? { period } : undefined
  })
}

export function previewCommission(ruleId: number, orderId: number) {
  return request<CommissionPreview>({ url: `${base}/commissions/preview`, method: 'get', params: { ruleId, orderId } })
}

export function calculateCommission(data: Record<string, unknown>) {
  return request<CommissionRecord>({ url: `${base}/commissions/calculate`, method: 'post', data })
}

export function accrueCommission(data: { period: string; ruleId?: number }) {
  return request<CommissionAccrueResult>({ url: `${base}/commissions/accrue`, method: 'post', data })
}

export function confirmCommission(id: number, remark?: string) {
  return request<CommissionRecord>({ url: `${base}/commissions/records/${id}/confirm`, method: 'post', data: { remark } })
}

export function payCommission(id: number, remark?: string, supplierId?: number) {
  return request<CommissionRecord>({ url: `${base}/commissions/records/${id}/pay`, method: 'post', data: { remark, supplierId } })
}

export function fetchComplaints(params: Record<string, unknown>) {
  return request<PageResult<Complaint> & { slaSummary: { total: number; overdue: number } }>({
    url: `${base}/complaints`,
    method: 'get',
    params
  })
}

export function createComplaint(data: Record<string, unknown>) {
  return request<Complaint>({ url: `${base}/complaints`, method: 'post', data })
}

export function assignComplaint(id: number, assigneeId: number) {
  return request<Complaint>({ url: `${base}/complaints/${id}/assign`, method: 'post', data: { assigneeId } })
}

export function resolveComplaint(id: number, resolution: string) {
  return request<Complaint>({ url: `${base}/complaints/${id}/resolve`, method: 'post', data: { resolution } })
}

export function closeComplaint(id: number) {
  return request<Complaint>({ url: `${base}/complaints/${id}/close`, method: 'post', data: {} })
}

export function reopenComplaint(id: number, reason: string) {
  return request<Complaint>({ url: `${base}/complaints/${id}/reopen`, method: 'post', data: { reason } })
}

export function fetchComplaintDetail(id: number) {
  return request<ComplaintDetail>({ url: `${base}/complaints/${id}`, method: 'get' })
}

export function fetchVisits(params: Record<string, unknown>) {
  return request<PageResult<Visit>>({ url: `${base}/visits`, method: 'get', params })
}

export function fetchVisitSummary() {
  return request<VisitSummary>({ url: `${base}/visits/summary`, method: 'get' })
}

export function createVisit(data: Record<string, unknown>) {
  return request<Visit>({ url: `${base}/visits`, method: 'post', data })
}

export function planVisit(id: number, nextVisitAt: string) {
  return request<Visit>({ url: `${base}/visits/${id}/plan`, method: 'post', data: { nextVisitAt } })
}

export function planVisits(data: { customerIds?: number[]; intervalDays?: number; salesRepId?: number; channel?: string }) {
  return request<{ created: number; plans: Array<Record<string, unknown>> }>({ url: `${base}/visits/plans`, method: 'post', data })
}

export function completeVisit(id: number, data: { content?: string; feedback?: string; satisfaction?: number; nextVisitAt?: string }) {
  return request<Visit>({ url: `${base}/visits/${id}/complete`, method: 'post', data })
}

export function fetchUnshippedList(params: Record<string, unknown>) {
  return request<{ list: UnshippedRow[]; summary: { totalRows: number; overdueRows: number; totalUnshippedQty: number } }>({
    url: `${base}/reports/unshipped`,
    method: 'get',
    params
  })
}

export function fetchReturnRate(params: Record<string, unknown>) {
  return request<ReturnRateReport>({ url: `${base}/reports/return-rate`, method: 'get', params })
}
