import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface PrintTemplate {
  id: number
  code: string
  name: string
  bizType: string
  paper: string
  schema: Record<string, unknown> | null
  version: number
  isDefault: number
  isActive: number
  status?: string
  updatedAt?: string
}

export interface PrintRecord {
  id: number
  bizType: string
  bizId: number
  bizNo: string | null
  templateCode: string
  copies: number
  channel: string
  printedBy: number
  printedAt: string
  pdfUrl: string | null
  watermark: string | null
}

export interface CreatePrintTemplate {
  code: string
  name: string
  bizType: string
  paper?: string
  schema?: Record<string, unknown>
}

export interface CreatePrintJob {
  bizType: string
  bizId: number
  bizNo?: string
  templateCode?: string
  copies?: number
  channel?: string
}

const baseUrl = '/print'

/** 打印模板可用字段（通用 + 业务 + 自定义字段） */
export interface PrintFieldItem {
  key: string
  label: string
  group: 'common' | 'biz' | 'custom'
  type?: string
  options?: string[]
}

/** 读取指定业务类型的打印字段目录 */
export function fetchPrintFields(bizType: string) {
  return request<PrintFieldItem[]>({ url: `${baseUrl}/fields/${bizType}`, method: 'get' })
}

export function fetchTemplates(params: PageQuery) {
  return request<PageResult<PrintTemplate>>({ url: `${baseUrl}/templates`, method: 'get', params })
}

export function createTemplate(data: CreatePrintTemplate) {
  return request<PrintTemplate>({ url: `${baseUrl}/templates`, method: 'post', data })
}

export function publishTemplate(id: number) {
  return request<PrintTemplate>({ url: `${baseUrl}/templates/${id}/publish`, method: 'post' })
}

export function copyTemplate(id: number) {
  return request<PrintTemplate>({ url: `${baseUrl}/templates/${id}/copy`, method: 'post' })
}

/** 模板版本时间线 */
export function fetchTemplateVersions(code: string) {
  return request<PrintTemplate[]>({ url: `${baseUrl}/templates/versions/${code}`, method: 'get' })
}

export function fetchPrintRecords(params: PageQuery & { bizType?: string }) {
  return request<PageResult<PrintRecord>>({ url: `${baseUrl}/records`, method: 'get', params })
}

export function createPrintJob(data: CreatePrintJob) {
  return request<PrintRecord>({ url: `${baseUrl}/jobs`, method: 'post', data })
}

export interface PrintJob {
  id: number
  jobNo: string
  bizType: string
  bizId: number
  templateId: number
  copies: number
  channel: string
  status: string
  recordId: number | null
  errorText: string | null
  createdAt: string
  finishedAt: string | null
}

export interface PrintLabelTemplate {
  id: number
  labelCode: string
  labelName: string
  barcodeType: string
  paperSize: string
  schema: Record<string, unknown> | null
  version: number
  isActive: number
  createdAt: string
}

export interface CreatePrintLabel {
  labelCode: string
  labelName: string
  barcodeType?: string
  paperSize?: string
  schema?: Record<string, unknown>
}

export function fetchPrintJobs(params: PageQuery & { status?: string }) {
  return request<PageResult<PrintJob>>({ url: `${baseUrl}/jobs`, method: 'get', params })
}

export function retryPrintJob(id: number) {
  return request<PrintJob>({ url: `${baseUrl}/jobs/${id}/retry`, method: 'post' })
}

/** 模板预览（返回预览 HTML / 字段绑定结果） */
export function previewPrintTemplate(id: number): Promise<unknown> {
  return request({ url: `${baseUrl}/templates/${id}/preview`, method: 'get' })
}

/** 批量创建打印任务 */
export function batchPrintJobs(data: CreatePrintJob[]): Promise<PrintJob[]> {
  return request({ url: `${baseUrl}/jobs/batch`, method: 'post', data })
}

/** 补打记录 */
export function reprintPrintRecord(id: number): Promise<PrintRecord> {
  return request({ url: `${baseUrl}/records/${id}/reprint`, method: 'post' })
}

/** 获取打印 PDF */
export function fetchPrintPdf(id: number): Promise<Blob> {
  return request({ url: `${baseUrl}/records/${id}/pdf`, method: 'get', responseType: 'blob' })
}

/** 静默打印：走专用端点，由本地打印客户端拉取执行 */
export function createSilentPrintJob(data: CreatePrintJob): Promise<PrintRecord> {
  return request({ url: `${baseUrl}/jobs/silent`, method: 'post', data })
}

export function fetchPrintLabels(params: PageQuery) {
  return request<PageResult<PrintLabelTemplate>>({ url: `${baseUrl}/labels`, method: 'get', params })
}

export function createPrintLabel(data: CreatePrintLabel) {
  return request<PrintLabelTemplate>({ url: `${baseUrl}/labels`, method: 'post', data })
}
