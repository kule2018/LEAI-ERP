/**
 * 字典导入导出规则：CSV 列映射、行校验、差异统计。
 */

import { encodeCsv, parseCsv } from './csv'

export interface DictRow {
  dictCode: string
  dictName: string
  itemCode: string
  itemLabel: string
  itemValue: string
  sortNo?: number
  status?: string
}

export const DICT_EXPORT_HEADER = ['字典编码', '字典名称', '项编码', '项名称', '项值', '排序', '状态']

/** 导出字典为 CSV */
export function exportDictCsv(rows: DictRow[]): string {
  return encodeCsv([
    DICT_EXPORT_HEADER,
    ...rows.map((row) => [
      row.dictCode, row.dictName, row.itemCode, row.itemLabel, row.itemValue,
      row.sortNo ?? 0, row.status ?? 'ENABLED'
    ])
  ], { bom: true })
}

/** 导入校验结果 */
export interface DictImportRowResult {
  row: DictRow | null
  error: string | null
}

/** 解析并校验导入 CSV */
export function parseDictCsv(content: string): { rows: DictRow[]; errors: string[] } {
  const table = parseCsv(content)
  const rows: DictRow[] = []
  const errors: string[] = []
  if (table.length === 0) return { rows, errors: ['文件为空'] }
  const header = table[0].map((item) => item.trim())
  const idx = (name: string) => header.indexOf(name)
  const iCode = idx('字典编码')
  const iName = idx('字典名称')
  const iItemCode = idx('项编码')
  const iItemLabel = idx('项名称')
  const iItemValue = idx('项值')
  const iSort = idx('排序')
  const iStatus = idx('状态')
  if ([iCode, iName, iItemCode, iItemLabel].some((index) => index < 0)) {
    return { rows, errors: ['表头缺少必要列：字典编码/字典名称/项编码/项名称'] }
  }
  for (let i = 1; i < table.length; i++) {
    const line = table[i]
    const cell = (index: number) => (index >= 0 ? String(line[index] ?? '').trim() : '')
    const dictCode = cell(iCode)
    const itemCode = cell(iItemCode)
    if (!dictCode || !itemCode) {
      errors.push(`第 ${i + 1} 行缺少字典编码或项编码`)
      continue
    }
    rows.push({
      dictCode,
      dictName: cell(iName) || dictCode,
      itemCode,
      itemLabel: cell(iItemLabel),
      itemValue: cell(iItemValue),
      sortNo: Number(cell(iSort)) || 0,
      status: cell(iStatus) || 'ENABLED'
    })
  }
  return { rows, errors }
}

/** 导入预览统计 */
export function summarizeDictImport(rows: DictRow[], existingCodes: Set<string>): {
  total: number
  newDicts: number
  newItems: number
  duplicateInFile: number
} {
  const fileDicts = new Set<string>()
  let duplicateInFile = 0
  for (const row of rows) {
    if (fileDicts.has(row.dictCode)) duplicateInFile++
    fileDicts.add(row.dictCode)
  }
  return {
    total: rows.length,
    newDicts: [...fileDicts].filter((code) => !existingCodes.has(code)).length,
    newItems: rows.length,
    duplicateInFile
  }
}
