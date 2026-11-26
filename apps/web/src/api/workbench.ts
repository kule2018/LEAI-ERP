import { request } from '@/utils/http'

export interface WorkbenchKpi {
  code: string
  name: string
  source: string
  roles: string[]
  value: string
  yoy?: number
}

export interface WorkbenchAlert {
  id: number
  title: string
  severity: string
  riskType: string
  bizType: string
  bizId: number
}

export interface Digest {
  summary: string
  sources: string[]
  generatedAt: string
}

export interface Overview {
  kpis: WorkbenchKpi[]
  alerts: WorkbenchAlert[]
  digest: Digest
  generatedAt: string
}

export interface DrillResult {
  code: string
  title: string
  rows: Array<Record<string, unknown>>
}

export interface TrendPoint {
  period: string
  amount: number
  cost: number
  yoy: number
  grossProfit: number
  margin: number
}

export interface SalesTrend {
  year: number
  trend: TrendPoint[]
  totalAmount: number
  yoy: number
  grossProfit: number
  margin: number
  contribution: {
    customer: Array<{ name: string; amount: number; share: number }>
    product: Array<{ name: string; amount: number; share: number }>
  }
  salesRanking: Array<{ name: string; amount: number; rank: number }>
}

export interface CashRow {
  week: number
  inflow: number
  outflow: number
  net: number
  cumulative: number
}

export interface CashFlowResult {
  scenario: string
  base: CashRow[]
  projected: CashRow[]
  gaps: number[]
  projectedGaps: number[]
  assumptions: string[]
  generatedAt: string
}

export interface Subscription {
  id: number
  resource: string
  frequency: string
  channel: string
  enabled: number
}

export interface Briefing {
  id: number
  type: string
  period: string
  title: string
  template: string | null
  snapshot: Record<string, unknown> | null
  summary: string | null
  sourceRefs: string[] | null
  status: string
  pdfContent: string | null
  readBy: number[] | null
  createdBy: number | null
  createdAt: string
}

export interface BriefingPage {
  list: Briefing[]
  items?: Briefing[]
  total: number
  page: number
  pageSize: number
}

export function fetchOverview() {
  return request<Overview>({ url: '/workbench/overview', method: 'get' })
}

export function fetchKpis() {
  return request<WorkbenchKpi[]>({ url: '/workbench/kpis', method: 'get' })
}

export function saveKpi(data: { code: string; name: string; source: string; roles?: string[]; sortNo?: number; enabled?: number }) {
  return request<unknown>({ url: '/workbench/kpis', method: 'post', data })
}

export function removeKpi(code: string) {
  return request<unknown>({ url: `/workbench/kpis/${encodeURIComponent(code)}`, method: 'delete' })
}

export function drillKpi(code: string) {
  return request<DrillResult>({ url: `/workbench/drill/${encodeURIComponent(code)}`, method: 'get' })
}

export function fetchSalesTrend(year?: number) {
  return request<SalesTrend>({ url: `/workbench/sales-trend${year ? `?year=${year}` : ''}`, method: 'get' })
}

export function fetchCashFlow(scenario?: string) {
  return request<CashFlowResult>({ url: `/workbench/cash-flow${scenario ? `?scenario=${scenario}` : ''}`, method: 'get' })
}

export function fetchSubscriptions() {
  return request<Subscription[]>({ url: '/workbench/subscriptions', method: 'get' })
}

export function saveSubscription(data: { resource: string; frequency?: string; channel?: string; enabled?: number }) {
  return request<Subscription>({ url: '/workbench/subscriptions', method: 'post', data })
}

export function removeSubscription(id: number) {
  return request<unknown>({ url: `/workbench/subscriptions/${id}`, method: 'delete' })
}

export function fetchBriefings(params: { page: number; pageSize: number; type?: string }) {
  const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) })
  if (params.type) query.set('type', params.type)
  return request<BriefingPage>({ url: `/workbench/briefings?${query.toString()}`, method: 'get' })
}

export function createBriefing(data: { type: 'WEEK' | 'MONTH' | 'DAILY'; template?: string; title?: string }) {
  return request<Briefing>({ url: '/workbench/briefings', method: 'post', data })
}

/** 立即执行一次订阅到期推送 */
export function dispatchSubscriptions() {
  return request<{ pushed: number; skipped: number }>({ url: '/workbench/subscriptions/dispatch', method: 'post' })
}

export function publishBriefing(id: number) {
  return request<Briefing>({ url: `/workbench/briefings/${id}/publish`, method: 'post' })
}

export function confirmBriefingRead(id: number) {
  return request<Briefing>({ url: `/workbench/briefings/${id}/read`, method: 'post' })
}

export function fetchBriefingPdf(id: number) {
  return request<string>({ url: `/workbench/briefings/${id}/pdf`, method: 'get' })
}
