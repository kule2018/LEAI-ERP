import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface ExportTask {
  id: number
  code: string
  bizType: string | null
  status: string
  fileName: string | null
  rowCount: number
  resultUrl: string | null
  errorMessage: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

export interface ExportTaskQuery extends PageQuery {
  status?: string
  code?: string
}

/** 导出任务列表 */
export function fetchExportTasks(params: ExportTaskQuery) {
  return request<PageResult<ExportTask>>({ url: '/system/export-task', method: 'get', params })
}

/** 创建异步导出任务 */
export function createExportTask(data: { code: string; bizType?: string; params?: Record<string, unknown> }) {
  return request<ExportTask>({ url: '/system/export-task', method: 'post', data })
}

/** 重新执行导出任务 */
export function retryExportTask(id: number) {
  return request<ExportTask>({ url: `/system/export-task/${id}/retry`, method: 'post' })
}

/** 导出文件下载地址 */
export function exportTaskContentUrl(id: number): string {
  return `/api/v1/system/export-task/${id}/content`
}
