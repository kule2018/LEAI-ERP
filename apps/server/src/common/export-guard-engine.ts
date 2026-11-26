export interface WatermarkUser {
  tenantId: number
  userId: number
  username?: string
}

export interface CsvWatermark {
  code: string
  username: string
  exportedAt: string
}

export const SENSITIVE_FIELD_PATTERN = /(^|_)(phone|mobile|contact_phone|bank_account|account_no|id_card|secret|password|token|api_key)(_|$)/i

export function isSensitiveField(field: string): boolean {
  const normalized = field.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
  return SENSITIVE_FIELD_PATTERN.test(normalized)
}

export function buildCsvWatermark(user: WatermarkUser, at = new Date()): CsvWatermark {
  return {
    code: `tenant-${user.tenantId}-user-${user.userId}-${at.getTime()}`,
    username: user.username ?? `user-${user.userId}`,
    exportedAt: at.toISOString()
  }
}

export interface WatermarkOptions {
  /** 是否附加水印块，默认开启 */
  enabled?: boolean
  /** 附加水印说明文案（租户级可配置） */
  extraText?: string | null
}

export function appendWatermark(
  rows: Array<Array<string | number | boolean | null | undefined>>,
  watermark: CsvWatermark,
  options: WatermarkOptions = {}
): Array<Array<string | number | boolean | null | undefined>> {
  if (options.enabled === false) return [...rows]
  const block: Array<Array<string | number | boolean | null | undefined>> = [
    [],
    ['水印编码', watermark.code],
    ['导出人', watermark.username],
    ['导出时间', watermark.exportedAt]
  ]
  const extraText = options.extraText?.trim()
  if (extraText) block.push(['水印说明', extraText])
  return [...rows, ...block]
}

export function maskSensitiveValue(value: unknown): string {
  if (value == null) return ''
  const text = String(value)
  if (/^\d{17}[\dXx]$/.test(text)) return `${text.slice(0, 6)}********${text.slice(-4)}`
  if (/^\d{16,19}$/.test(text)) return `${text.slice(0, 4)}****${text.slice(-4)}`
  if (/^1\d{10}$/.test(text)) return `${text.slice(0, 3)}****${text.slice(-4)}`
  if (text.startsWith('enc:v1:')) return 'enc:v1:****'
  return text
}

export function sanitizeExportRow(row: Array<string | number | boolean | null | undefined>): Array<string | number | boolean | null | undefined> {
  return row.map((value) => maskSensitiveValue(value))
}

export function maskSensitiveText(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .replace(/\b1\d{10}\b/g, (value) => `${value.slice(0, 3)}****${value.slice(-4)}`)
    .replace(/\b\d{17}[\dXx]\b/g, (value) => `${value.slice(0, 6)}********${value.slice(-4)}`)
    .replace(/\b\d{16,19}\b/g, (value) => `${value.slice(0, 4)}****${value.slice(-4)}`)
}
