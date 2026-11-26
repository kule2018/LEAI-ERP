import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface SequenceRule {
  id: number
  bizCode: string
  bizName: string
  numberPrefix: string
  dateFormat: string
  stepValue: number
  currentSeq: number
  resetCycle: string
  docNo: string
}

export interface CreateSequenceRule {
  bizCode: string
  bizName?: string
  numberPrefix: string
  dateFormat?: string
  stepValue?: number
  resetCycle?: string
  remark?: string
}

export interface UpdateSequenceRule {
  bizName?: string
  numberPrefix?: string
  dateFormat?: string
  stepValue?: number
  resetCycle?: string
  remark?: string
}

const baseUrl = '/system/sequence'

export function fetchSequences(params: PageQuery) {
  return request<PageResult<SequenceRule>>({ url: baseUrl, method: 'get', params })
}

export function createSequence(data: CreateSequenceRule) {
  return request<SequenceRule>({ url: baseUrl, method: 'post', data })
}

export function updateSequence(id: number, data: UpdateSequenceRule) {
  return request<SequenceRule>({ url: `${baseUrl}/${id}`, method: 'put', data })
}

export function deleteSequence(id: number) {
  return request<null>({ url: `${baseUrl}/${id}`, method: 'delete' })
}

export function nextSequence(bizCode: string) {
  return request<{ docNo: string; seq: number; redisKey: string }>({
    url: `${baseUrl}/next`,
    method: 'post',
    data: { bizCode }
  })
}
