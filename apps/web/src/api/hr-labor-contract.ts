import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

const base = '/hr/contracts'

export interface LaborContractRow {
  id: number
  employeeId: number
  contractNo: string
  contractType: string
  partyA: string | null
  signDate: string | null
  effectiveDate: string
  expiryDate: string | null
  remindDays: number
  status: string
  renewedFromId: number | null
  terminateDate: string | null
  terminateReason: string | null
  salary: string
  remark: string | null
}

export interface ContractReminderRow {
  contractId: number
  contractNo: string
  employeeId: number
  employeeName: string
  contractType: string
  expiryDate: string
  daysLeft: number
  level: 'URGENT' | 'WARNING' | 'NORMAL'
  message: string
}

export interface ContractExpirySummary {
  expiringCount: number
  expiredCount: number
  urgentCount: number
  employeeCount: number
}

export interface LaborContractQuery extends PageQuery {
  status?: string
  contractType?: string
  employeeId?: number
  expiringOnly?: string
}

export function fetchLaborContracts(params: LaborContractQuery) {
  return request<PageResult<LaborContractRow>>({ url: base, method: 'get', params })
}

export function fetchExpiringContracts(params: Partial<LaborContractQuery>) {
  return request<{ list: ContractReminderRow[]; summary: ContractExpirySummary }>({
    url: `${base}/expiring`, method: 'get', params
  })
}

export function createLaborContract(data: Record<string, unknown>) {
  return request<LaborContractRow>({ url: base, method: 'post', data })
}

export function renewLaborContract(id: number, data: Record<string, unknown>) {
  return request<LaborContractRow>({ url: `${base}/${id}/renew`, method: 'post', data })
}

export function terminateLaborContract(id: number, data: { terminateDate: string; reason: string }) {
  return request<LaborContractRow>({ url: `${base}/${id}/terminate`, method: 'post', data })
}

export function refreshLaborContractStatus() {
  return request<{ updated: number }>({ url: `${base}/refresh-status`, method: 'post' })
}
