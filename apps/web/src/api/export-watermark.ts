import { request, requestBlob } from '@/utils/http'

export interface ExportWatermarkPolicy {
  enabled: boolean
  extraText: string | null
}

/** 读取导出水印策略 */
export function fetchExportWatermarkPolicy() {
  return request<ExportWatermarkPolicy>({ url: '/system/export-watermark', method: 'get' })
}

/** 保存导出水印开关 */
export function saveExportWatermarkEnabled(enabled: boolean) {
  return request<ExportWatermarkPolicy>({
    url: '/system/export-watermark',
    method: 'post',
    data: {
      configKey: 'security.export.watermark.enabled',
      configValue: enabled ? 'true' : 'false',
      valueType: 'BOOLEAN',
      category: 'security',
      remark: '导出文件是否附加水印'
    }
  })
}

/** 保存导出水印说明文案 */
export function saveExportWatermarkText(text: string) {
  return request<ExportWatermarkPolicy>({
    url: '/system/export-watermark',
    method: 'post',
    data: {
      configKey: 'security.export.watermark.text',
      configValue: text,
      valueType: 'STRING',
      category: 'security',
      remark: '导出文件水印说明文案'
    }
  })
}

/** 导出带水印的审计日志 CSV */
export function downloadAuditExportCsv() {
  return requestBlob({ url: '/system/audit/export', method: 'get' })
}

/** 导出任务 CSV 内容（已带水印） */
export function downloadIoJobContent(jobId: number) {
  return requestBlob({ url: `/system/io/jobs/${jobId}/content`, method: 'get' })
}
