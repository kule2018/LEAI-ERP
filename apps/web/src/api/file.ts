import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface FileRecord {
  id: number
  fileName: string
  objectKey: string
  mimeType: string | null
  sizeBytes: number
  storageDriver: string
  url: string | null
  createdAt: string
}

export function fetchFiles(params: PageQuery) {
  return request<PageResult<FileRecord>>({ url: '/system/file', method: 'get', params })
}

export function uploadFile(file: File): Promise<FileRecord> {
  const formData = new FormData()
  formData.append('file', file)
  return request<FileRecord>({ url: '/system/file/upload', method: 'post', data: formData })
}
