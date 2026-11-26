/**
 * 零依赖 CSV 编解码器。
 * 支持 RFC 4180 引号转义、字段内逗号/换行/双引号、BOM、CRLF/LF。
 * 导入导出框架与文件服务共用，避免引入 xlsx/exceljs 等外部依赖。
 */

/** 将单行字段编码为 CSV 文本（不含行尾换行） */
export function encodeCsvRow(fields: Array<string | number | boolean | null | undefined>): string {
  return fields
    .map((value) => {
      const text = value == null ? '' : String(value)
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    })
    .join(',')
}

/** 将多行数据编码为完整 CSV 文本，可带 UTF-8 BOM 以便 Excel 正确识别中文 */
export function encodeCsv(rows: Array<Array<string | number | boolean | null | undefined>>, options: { bom?: boolean } = {}): string {
  const body = rows.map(encodeCsvRow).join('\r\n')
  return options.bom ? `\uFEFF${body}` : body
}

/**
 * 解析 CSV 文本为二维字符串数组。
 * 逐字符状态机处理引号内的逗号与换行，容忍首尾空白行。
 */
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  const pushField = () => {
    row.push(field)
    field = ''
  }
  const pushRow = () => {
    pushField()
    if (row.length === 1 && row[0] === '' && rows.length === 0) {
      row = []
      return
    }
    rows.push(row)
    row = []
  }

  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }

    if (ch === '"' && field === '') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      pushField()
      i++
      continue
    }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      pushRow()
      i++
      continue
    }
    field += ch
    i++
  }

  if (field.length > 0 || row.length > 0) {
    pushRow()
  }
  return rows
}

export interface ParsedTable {
  headers: string[]
  rows: Array<Record<string, string>>
}

/** 将 CSV 解析为对象数组，首行为表头；空行被忽略 */
export function parseCsvTable(input: string): ParsedTable {
  const matrix = parseCsv(input).filter((line) => line.some((cell) => cell.trim() !== ''))
  if (matrix.length === 0) return { headers: [], rows: [] }
  const headers = matrix[0].map((h) => h.trim())
  const rows = matrix.slice(1).map((cells) => {
    const record: Record<string, string> = {}
    headers.forEach((header, index) => {
      record[header] = cells[index] ?? ''
    })
    return record
  })
  return { headers, rows }
}
