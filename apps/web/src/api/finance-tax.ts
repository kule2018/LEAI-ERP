import { request } from '@/utils/http'

const base = '/finance'

export interface TaxCode {
  id: number
  taxCode: string
  taxName: string
  taxType: string
  rate: string
  direction: string
  subjectId: number | null
  status: string
}

export interface TaxDeclaration {
  id: number
  period: string
  declarationNo: string
  totalOutputTax: string
  totalInputTax: string
  taxPayable: string
  details: Array<{ taxCode: string; taxName: string; outputTax: number; inputTax: number; netTax: number }> | null
  declaredAt: string | null
  status: string
}

export interface Category {
  id: number
  categoryType: string
  categoryCode: string
  categoryName: string
  parentCode: string | null
  subjectId: number | null
  sortNo: number
  status: string
}

export function fetchTaxCodes() { return request<TaxCode[]>({ url: `${base}/tax/codes`, method: 'get' }) }
export function createTaxCode(data: Record<string, unknown>) {
  return request<TaxCode>({ url: `${base}/tax/codes`, method: 'post', data })
}
export function buildTaxDeclaration(data: { period: string; declare?: boolean }) {
  return request<TaxDeclaration>({ url: `${base}/tax/declaration`, method: 'post', data })
}
export function calcTax(data: { amount: number; rate: number; inclusive?: boolean }) {
  return request<{ netAmount: number; taxAmount: number; grossAmount: number }>({ url: `${base}/tax/calc`, method: 'post', data })
}

export function fetchCategories(categoryType?: string) {
  return request<Category[]>({ url: `${base}/categories`, method: 'get', params: categoryType ? { categoryType } : undefined })
}
export function createCategory(data: Record<string, unknown>) {
  return request<Category>({ url: `${base}/categories`, method: 'post', data })
}
