import { encodeCsv } from './csv'

export interface OcrFieldState {
  key: string
  value?: string | null
  confidence?: number
}

export interface OcrCorrectionResult {
  fields: OcrFieldState[]
  corrected: string[]
  confidence: number
}

export interface ParsedDocument {
  format: string
  text: string
  lines: Array<Record<string, unknown>>
  warnings: string[]
}

export interface GrayModelConfig {
  code: string
  capability: string
  grayPercent: number
  status: string
  isDefault: number
}

export interface ReportMetrics {
  revenue?: number
  previousRevenue?: number
  cost?: number
  overdueAmount?: number
}

function stableHash(value: string): number {
  let result = 2166136261
  for (let i = 0; i < value.length; i++) {
    result ^= value.charCodeAt(i)
    result = Math.imul(result, 16777619)
  }
  return result >>> 0
}

export function applyOcrCorrections(fields: OcrFieldState[], corrections: Record<string, string>): OcrCorrectionResult {
  const corrected: string[] = []
  const result = fields.map((field) => {
    const value = corrections[field.key]
    if (value !== undefined && value !== field.value) {
      corrected.push(field.key)
      return { ...field, value, confidence: 1 }
    }
    return { ...field }
  })
  const valued = result.filter((field) => Boolean(field.value))
  const confidence = valued.length ? valued.reduce((sum, field) => sum + (field.confidence ?? 0), 0) / valued.length : 0.1
  return { fields: result, corrected, confidence }
}

export function parseDocumentFile(fileName: string, mimeType: string | undefined, text: string): ParsedDocument {
  const lowerName = fileName.toLowerCase()
  const isCsv = lowerName.endsWith('.csv') || mimeType === 'text/csv'
  const isExcel = /\.(xlsx|xls)$/.test(lowerName) || (mimeType ?? '').includes('spreadsheet')
  const isPdf = lowerName.endsWith('.pdf') || mimeType === 'application/pdf'
  const isImage = /\.(png|jpe?g|webp)$/.test(lowerName) || (mimeType ?? '').startsWith('image/')
  const warnings: string[] = []
  if (isPdf) warnings.push('PDF 仅解析已提取文本层，扫描件需 OCR 重识别')
  if (isImage) warnings.push('图片仅使用传入的识别文本，原始像素需 OCR 服务解析')
  if (isExcel) warnings.push('Excel 按已导出的 CSV 文本解析，复杂公式不在本地计算')
  if (!isCsv && !isExcel && !isPdf && !isImage) warnings.push('未知文件类型，按纯文本解析')

  if (isCsv || isExcel) {
    const lines = text.split(/\r?\n/).filter((line) => line.trim())
    const headers = (lines.shift() ?? '').split(',').map((item) => item.trim())
    return {
      format: isCsv ? 'CSV' : 'EXCEL',
      text,
      lines: lines.map((line) => {
        const cells = line.split(',')
        return headers.reduce<Record<string, unknown>>((record, header, index) => {
          record[header] = cells[index]?.trim() ?? ''
          return record
        }, {})
      }),
      warnings
    }
  }
  return {
    format: isPdf ? 'PDF' : isImage ? 'IMAGE' : 'TEXT',
    text,
    lines: text.split(/\r?\n/).filter((line) => line.trim()).map((line) => ({ content: line.trim() })),
    warnings
  }
}

export function selectGrayModel(configs: GrayModelConfig[], capability: string, seed: string): GrayModelConfig | null {
  const candidates = configs.filter((config) => config.capability === capability && config.status === 'ENABLED')
  if (candidates.length === 0) return null
  const bucket = stableHash(seed) % 100
  for (const config of [...candidates].sort((a, b) => b.grayPercent - a.grayPercent)) {
    if (config.grayPercent >= 100) return config
    if (bucket < config.grayPercent) return config
  }
  return candidates.find((config) => config.isDefault === 1) ?? candidates[0] ?? null
}

export function buildReportExport(diagnoses: string[], citations: Array<Record<string, unknown>>, metrics: ReportMetrics): string {
  const rows: Array<Array<string | number>> = [
    ['类型', '内容', '来源', '指标值'],
    ...diagnoses.map((item) => ['诊断', item, '', '']),
    ...citations.map((item) => ['引用', String(item.field ?? ''), String(item.source ?? ''), String(item.value ?? '')]),
    ['指标', '收入', '', String(metrics.revenue ?? 0)],
    ['指标', '成本', '', String(metrics.cost ?? 0)],
    ['指标', '逾期金额', '', String(metrics.overdueAmount ?? 0)]
  ]
  return encodeCsv(rows, { bom: true })
}

export function buildAttributionDrill(metrics: ReportMetrics, dimension: string): Array<Record<string, unknown>> {
  const revenue = Number(metrics.revenue ?? 0)
  const cost = Number(metrics.cost ?? 0)
  const overdue = Number(metrics.overdueAmount ?? 0)
  const items = [
    { name: '毛利贡献', value: revenue - cost, ratio: revenue > 0 ? (revenue - cost) / revenue : 0 },
    { name: '逾期风险', value: overdue, ratio: revenue > 0 ? overdue / revenue : 0 },
    { name: '成本结构', value: cost, ratio: revenue > 0 ? cost / revenue : 0 }
  ]
  return items.map((item) => ({ dimension, ...item }))
}
