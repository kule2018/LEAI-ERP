import { parseCsvTable } from '../../common/csv'
import type { ImportConfig, ImportPreview, RowIssue } from './io.types'

/** 根据字段类型把字符串转换为实体可用的值，返回 errorMessage 或转换结果 */
function coerce(raw: string, type: string | undefined): { ok: boolean; value: unknown; error?: string } {
  const value = raw.trim()
  if (value === '') return { ok: true, value: '' }
  switch (type) {
    case 'number': {
      const num = Number(value)
      return Number.isFinite(num) ? { ok: true, value: num } : { ok: false, value, error: '必须为数字' }
    }
    case 'decimal': {
      if (!/^-?\d+(\.\d+)?$/.test(value)) return { ok: false, value, error: '必须为数值' }
      return { ok: true, value }
    }
    case 'boolean': {
      if (/^(是|true|1|Y|yes)$/i.test(value)) return { ok: true, value: 1 }
      if (/^(否|false|0|N|no)$/i.test(value)) return { ok: true, value: 0 }
      return { ok: false, value, error: '必须为是/否' }
    }
    default:
      return { ok: true, value }
  }
}

/**
 * 解析并校验导入数据，生成预览。错误行会被标记且不进入有效 rows。
 * 该函数为纯逻辑，便于单元测试与复用。
 */
export function buildImportPreview<T extends Record<string, unknown>>(
  config: ImportConfig<T>,
  csvText: string
): ImportPreview {
  const table = parseCsvTable(csvText)
  const issues: RowIssue[] = []
  const validRows: Array<Record<string, unknown>> = []

  for (const f of config.fields) {
    if (!table.headers.includes(f.header)) {
      issues.push({ row: 0, field: f.header, message: `缺少必填列：${f.header}` })
    }
  }

  table.rows.forEach((cells, index) => {
    const rowNumber = index + 2
    const mapped: Record<string, unknown> = {}
    let rowValid = true

    for (const field of config.fields) {
      const raw = cells[field.header] ?? ''
      const trimmed = raw.trim()
      if (field.required && trimmed === '') {
        issues.push({ row: rowNumber, field: field.header, message: `${field.header} 不能为空` })
        rowValid = false
        continue
      }
      if (field.maxLength && trimmed.length > field.maxLength) {
        issues.push({ row: rowNumber, field: field.header, message: `${field.header} 超过 ${field.maxLength} 字符` })
        rowValid = false
        continue
      }
      const result = coerce(trimmed, field.type)
      if (!result.ok) {
        issues.push({ row: rowNumber, field: field.header, message: `${field.header} ${result.error}` })
        rowValid = false
        continue
      }
      if (field.validate && trimmed !== '') {
        const message = field.validate(trimmed, cells)
        if (message) {
          issues.push({ row: rowNumber, field: field.header, message })
          rowValid = false
          continue
        }
      }
      if (trimmed !== '') {
        mapped[field.key] = field.transform ? field.transform(trimmed) : result.value
      }
    }

    // 批次内唯一键去重校验
    if (rowValid && config.uniqueKeys?.length) {
      const composite = config.uniqueKeys.map((k) => String(mapped[k] ?? '')).join('|')
      const duplicate = validRows.some(
        (existing) => config.uniqueKeys!.map((k) => String(existing[k] ?? '')).join('|') === composite
      )
      if (duplicate) {
        issues.push({
          row: rowNumber,
          field: config.uniqueKeys.join('+'),
          message: `批次内重复：${composite}`
        })
        rowValid = false
      }
    }

    if (rowValid) validRows.push(mapped)
  })

  return {
    code: config.code,
    name: config.name,
    headers: config.fields.map((f) => f.header),
    total: table.rows.length,
    valid: validRows.length,
    invalid: table.rows.length - validRows.length,
    issues,
    rows: validRows
  }
}

/** 生成导入模板 CSV（仅表头 + 一行示例空值） */
export function buildTemplateCsv<T extends Record<string, unknown>>(config: ImportConfig<T>): string {
  return '\uFEFF' + config.fields.map((f) => f.header).join(',') + '\r\n'
}

/** headerToField 供字段映射 UI 使用 */
export function getHeaderMap<T extends Record<string, unknown>>(config: ImportConfig<T>): Map<string, string> {
  return new Map(config.fields.map((f) => [f.header, f.key]))
}

/**
 * 应用字段映射：把上传文件的列名替换为标准模板表头。
 * mapping 为 { 上传列名: 标准表头 }；未命中映射的列保持原样。
 */
export function applyHeaderMapping(csvText: string, mapping: Record<string, string>): string {
  const table = parseCsvTable(csvText)
  if (table.headers.length === 0) return csvText
  const headers = table.headers.map((header) => mapping[header] ?? header)
  const escape = (value: string): string => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)
  const lines = [
    headers.map(escape).join(','),
    // 列顺序不变，仅重命名表头
    ...table.rows.map((cells) => Object.values(cells).map((value) => escape(String(value ?? ''))).join(','))
  ]
  return '\uFEFF' + lines.join('\r\n')
}
