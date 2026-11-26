import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface AdviceSupplier {
  name: string
  inquiryNo: string
  sourceType: string
}

export interface AdviceQuote {
  supplier: string
  sourceType: string
  fileName: string
  unitPrice: number
  moq: number
  leadTimeDays: number
  ruleOk: boolean
  evidence: string
}

export interface AdviceSuggestion {
  winner: string
  reason: string
  ruleCitations: string[]
  ranking: Array<{ supplier: string; score: number; reason: string }>
}

export interface AdviceTask {
  id: number
  taskNo: string
  productName: string
  shortageQty: string
  ruleText: string | null
  suppliers: AdviceSupplier[] | null
  quotes: AdviceQuote[] | null
  suggestion: AdviceSuggestion | null
  status: string
  progress: string
  resumeCount: number
  remindCount: number
  draftNo: string | null
  evaluation: Record<string, unknown> | null
  createdAt: string
}

export function fetchAdviceList(params: PageQuery & { status?: string }): Promise<PageResult<AdviceTask>> {
  return request({ url: '/procurement-advice', method: 'get', params })
}

export function fetchAdviceDetail(id: number): Promise<AdviceTask> {
  return request({ url: `/procurement-advice/${id}`, method: 'get' })
}

export function startAdvice(data: { productName: string; shortageQty: number; suppliers: string[]; ruleText?: string }): Promise<AdviceTask> {
  return request({ url: '/procurement-advice', method: 'post', data })
}

export function pauseAdvice(id: number): Promise<AdviceTask> {
  return request({ url: `/procurement-advice/${id}/pause`, method: 'post' })
}

export function resumeAdvice(id: number): Promise<AdviceTask> {
  return request({ url: `/procurement-advice/${id}/resume`, method: 'post' })
}

export function remindAdvice(id: number): Promise<AdviceTask> {
  return request({ url: `/procurement-advice/${id}/remind`, method: 'post' })
}

export function addAdviceQuote(id: number, data: AdviceQuote): Promise<AdviceTask> {
  return request({ url: `/procurement-advice/${id}/quotes`, method: 'post', data })
}

export function confirmAdvice(id: number, data: { decision: 'CONFIRM' | 'REJECT'; note?: string }): Promise<AdviceTask> {
  return request({ url: `/procurement-advice/${id}/confirm`, method: 'post', data })
}

export function fetchAdviceMetrics(): Promise<{ note: string; rows: Array<Record<string, string>> }> {
  return request({ url: '/procurement-advice/metrics', method: 'get' })
}
