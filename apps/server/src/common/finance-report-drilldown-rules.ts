/**
 * 财务报表下钻与导出规则（纯函数）：
 * 报表指标 → 科目类别 → 科目余额 → 明细账 → 凭证 的下钻链，以及带水印的 CSV 导出。
 */

import { appendWatermark, buildCsvWatermark, sanitizeExportRow, type WatermarkUser } from './export-guard-engine'

/** 报表指标键 */
export type ReportMetricKey =
  | 'income' | 'expense' | 'profit'
  | 'assets' | 'liabilities' | 'equity'
  | 'operatingIn' | 'operatingOut' | 'investingIn' | 'investingOut' | 'financingIn' | 'financingOut'

/** 报表指标下钻配置 */
export interface ReportDrilldownConfig {
  label: string
  /** 对应科目类别 */
  categories: string[]
  /** 借贷方向：报表指标取哪一侧 */
  side: 'DEBIT' | 'CREDIT' | 'BOTH'
}

export const REPORT_DRILLDOWN_CONFIG: Record<ReportMetricKey, ReportDrilldownConfig> = {
  income: { label: '收入', categories: ['INCOME'], side: 'CREDIT' },
  expense: { label: '费用', categories: ['EXPENSE'], side: 'DEBIT' },
  profit: { label: '利润', categories: ['INCOME', 'EXPENSE'], side: 'BOTH' },
  assets: { label: '资产', categories: ['ASSET'], side: 'DEBIT' },
  liabilities: { label: '负债', categories: ['LIABILITY'], side: 'CREDIT' },
  equity: { label: '权益', categories: ['EQUITY'], side: 'CREDIT' },
  operatingIn: { label: '经营活动流入', categories: ['INCOME', 'RECEIVABLE'], side: 'CREDIT' },
  operatingOut: { label: '经营活动流出', categories: ['EXPENSE', 'PAYABLE'], side: 'DEBIT' },
  investingIn: { label: '投资活动流入', categories: ['ASSET'], side: 'CREDIT' },
  investingOut: { label: '投资活动流出', categories: ['ASSET'], side: 'DEBIT' },
  financingIn: { label: '筹资活动流入', categories: ['EQUITY', 'LIABILITY'], side: 'CREDIT' },
  financingOut: { label: '筹资活动流出', categories: ['LIABILITY', 'EQUITY'], side: 'DEBIT' }
}

/** 报表指标 → 明细账下钻参数 */
export function buildDrilldownQuery(
  key: ReportMetricKey,
  period: string,
  subjectIds: number[]
): { key: ReportMetricKey; label: string; period: string; subjectIds: number[]; side: 'DEBIT' | 'CREDIT' | 'BOTH' } {
  const config = REPORT_DRILLDOWN_CONFIG[key]
  if (!config) throw new Error(`未知的报表指标：${key}`)
  return { key, label: config.label, period, subjectIds, side: config.side }
}

/** 下钻结果：科目余额按借贷方向取数汇总 */
export function summarizeDrilldownRows(
  rows: Array<{ subjectId: number; subjectCode: string; subjectName: string; debit: number; credit: number }>,
  side: 'DEBIT' | 'CREDIT' | 'BOTH'
): { rows: Array<{ subjectId: number; subjectCode: string; subjectName: string; amount: number }>; total: number } {
  const mapped = rows.map((row) => ({
    subjectId: row.subjectId,
    subjectCode: row.subjectCode,
    subjectName: row.subjectName,
    amount: Number((side === 'DEBIT' ? row.debit - row.credit : side === 'CREDIT' ? row.credit - row.debit : row.debit + Number(row.credit)).toFixed(4))
  })).filter((row) => row.amount > 0.00001)
  return {
    rows: mapped,
    total: Number(mapped.reduce((sum, row) => sum + row.amount, 0).toFixed(4))
  }
}

/** CSV 字段转义：逗号、引号、换行 */
export function escapeCsvCell(value: unknown): string {
  if (value == null) return ''
  const text = String(value)
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

/** 生成带水印与敏感字段脱敏的 CSV 文本 */
export function buildFinanceCsv(
  header: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>,
  user: WatermarkUser,
  options?: { watermarkText?: string | null }
): string {
  const safeRows = [header, ...rows.map((row) => sanitizeExportRow(row))]
  const withWatermark = appendWatermark(safeRows, buildCsvWatermark(user), { extraText: options?.watermarkText })
  return withWatermark.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')
}
