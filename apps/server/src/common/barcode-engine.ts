/**
 * 条码/标签编码规则引擎（纯函数）：编码规则校验、序列号拼装、重复打印提示。
 */

export type BarcodeResetCycle = 'NONE' | 'DAILY' | 'MONTHLY' | 'YEARLY'

export interface BarcodeRuleInput {
  prefix?: string
  dateFormat?: string
  seqLength?: number
  resetCycle?: BarcodeResetCycle | string
  barcodeType?: string
}

export const BARCODE_TYPES = ['CODE128', 'EAN13', 'QR', 'DATAMATRIX'] as const

function pad(value: number, length: number): string {
  return String(value).padStart(Math.max(1, length), '0')
}

/** 日期片段格式化：支持 yyyy MM dd HH mm ss 组合 */
export function formatDateSegment(format: string, date: Date): string {
  const map: Record<string, string> = {
    yyyy: String(date.getFullYear()),
    MM: pad(date.getMonth() + 1, 2),
    dd: pad(date.getDate(), 2),
    HH: pad(date.getHours(), 2),
    mm: pad(date.getMinutes(), 2),
    ss: pad(date.getSeconds(), 2)
  }
  return format.replace(/yyyy|MM|dd|HH|mm|ss/g, (token) => map[token] ?? token)
}

/** 流水周期键：决定序号在何时归零 */
export function buildCycleKey(rule: BarcodeRuleInput, date: Date): string {
  const cycle = (rule.resetCycle ?? 'NONE') as BarcodeResetCycle
  if (cycle === 'DAILY') return formatDateSegment('yyyyMMdd', date)
  if (cycle === 'MONTHLY') return formatDateSegment('yyyyMM', date)
  if (cycle === 'YEARLY') return formatDateSegment('yyyy', date)
  return 'TOTAL'
}

/** 序列号拼装：前缀 + 日期片段 + 补零流水 */
export function buildSerial(rule: BarcodeRuleInput, date: Date, seq: number): string {
  const prefix = rule.prefix ?? ''
  const datePart = rule.dateFormat ? formatDateSegment(rule.dateFormat, date) : ''
  const length = Math.max(1, rule.seqLength ?? 6)
  return `${prefix}${datePart}${pad(seq, length)}`
}

/** 编码规则校验 */
export function evaluateBarcodeRule(rule: BarcodeRuleInput): { ok: boolean; reason: string | null } {
  if (!rule.prefix || !/^[A-Za-z0-9\-_]*$/.test(rule.prefix)) {
    return { ok: false, reason: '前缀只能包含字母、数字、- 和 _' }
  }
  if (rule.dateFormat && !/^(yyyy|MM|dd|HH|mm|ss)+$/.test(rule.dateFormat)) {
    return { ok: false, reason: '日期片段格式仅支持 yyyy/MM/dd/HH/mm/ss 组合' }
  }
  if (rule.seqLength !== undefined && (rule.seqLength < 1 || rule.seqLength > 12)) {
    return { ok: false, reason: '流水号位数需在 1~12 之间' }
  }
  if (rule.barcodeType && !BARCODE_TYPES.includes(rule.barcodeType as (typeof BARCODE_TYPES)[number])) {
    return { ok: false, reason: `不支持的条码类型：${rule.barcodeType}` }
  }
  return { ok: true, reason: null }
}

/** 批量序列号查重：与库中已有序列号比对 */
export function detectDuplicateSerials(candidates: string[], existing: Set<string>): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const candidate of candidates) {
    if (existing.has(candidate) || seen.has(candidate)) duplicates.add(candidate)
    seen.add(candidate)
  }
  return [...duplicates]
}

/** 重复打印提示：同一标签已打印过则提示但不阻断 */
export function evaluateLabelPrintRepeat(printCount: number, threshold = 1): { warn: boolean; message: string | null } {
  if (printCount < threshold) return { warn: false, message: null }
  return {
    warn: true,
    message: `该标签已打印 ${printCount} 次，重复打印请确认条码是否已作废`
  }
}
