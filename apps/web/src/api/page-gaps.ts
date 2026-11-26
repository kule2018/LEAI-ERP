import { request } from '@/utils/http'

export function fetchQuotationTemplates(): Promise<any[]> {
  return request({ url: '/sales/p1/quotation-templates', method: 'get' })
}

export function createQuotationTemplate(data: Record<string, unknown>): Promise<unknown> {
  return request({ url: '/sales/p1/quotation-templates', method: 'post', data })
}

export function applyQuotationTemplate(id: number): Promise<unknown> {
  return request({ url: '/sales/p1/quotation-templates/apply', method: 'post', data: { id } })
}

export function fetchDictOptions(dictType: string): Promise<any[]> {
  return request({ url: `/system/dict/options/${dictType}`, method: 'get' })
}
