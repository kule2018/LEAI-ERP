import { request } from '@/utils/http'

export interface ExchangeRate {
  id: number
  fromCurrency: string
  toCurrency: string
  rate: string
  effectiveDate: string
  source: string | null
}

export function fetchRates() {
  return request<ExchangeRate[]>({ url: '/currency/rates', method: 'get' })
}

export function setRate(data: { fromCurrency: string; toCurrency: string; rate: number; effectiveDate: string; reason?: string }) {
  return request<ExchangeRate>({ url: '/currency/rates', method: 'post', data })
}

/** 从外部汇率源同步（ECB / Frankfurter） */
export function syncExternalRates(base = 'CNY') {
  return request<{ source: string; base: string; date: string; synced: number; rates: Record<string, number> }>({
    url: '/currency/rates/sync', method: 'post', params: { base }
  })
}

export function convertCurrency(data: { amount: number; from: string; to: string; date?: string }) {
  return request<{ amount: number; rate: number; converted: number; fromCurrency: string; toCurrency: string; date: string }>({
    url: '/currency/convert', method: 'post', data
  })
}
