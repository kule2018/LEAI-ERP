import { request } from '@/utils/http'
import type { PageResult } from '@/types/contract'

const base = '/mfg'

export interface MaterialReturn {
  id: number
  returnNo: string
  workOrderId: number
  warehouseId: number | null
  status: string
  totalQty: string
  reason: string | null
  postedAt: string | null
  createdAt: string
}

export interface MaterialReturnLine {
  id: number
  returnId: number
  materialId: number
  qty: string
  batchNo: string | null
  remark: string | null
}

export interface DemandSummaryRow {
  productId: number
  productCode?: string
  productName?: string
  grossDemand: number
  onHand: number
  inTransit: number
  netDemand: number
  suggestedQty: number
}

export function fetchMaterialReturns(params: Record<string, unknown>) {
  return request<PageResult<MaterialReturn>>({ url: `${base}/material-returns`, method: 'get', params })
}

export function fetchMaterialReturnDetail(id: number) {
  return request<{ order: MaterialReturn; lines: MaterialReturnLine[] }>({ url: `${base}/material-returns/${id}/detail`, method: 'get' })
}

export function createMaterialReturn(data: {
  workOrderId: number
  warehouseId?: number
  lines: Array<{ materialId: number; qty: string; batchNo?: string; remark?: string }>
  reason?: string
}) {
  return request<MaterialReturn>({ url: `${base}/material-returns`, method: 'post', data })
}

export function postMaterialReturn(id: number) {
  return request<MaterialReturn>({ url: `${base}/material-returns/${id}/post`, method: 'post' })
}

export function cancelMaterialReturn(id: number) {
  return request<MaterialReturn>({ url: `${base}/material-returns/${id}/cancel`, method: 'post' })
}

export function fetchDemandSummary() {
  return request<{
    runId: number | null
    rows: DemandSummaryRow[]
    totalNetDemand: number
    totalSuggestedQty: number
  }>({ url: `${base}/demand/summary`, method: 'get' })
}
