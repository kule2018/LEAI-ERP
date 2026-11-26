export type FieldType = 'string' | 'number' | 'decimal' | 'boolean'

export interface ImportField<T = Record<string, unknown>> {
  /** CSV 表头（与模板一致） */
  header: string
  /** 实体属性名 */
  key: keyof T & string
  /** 是否必填 */
  required?: boolean
  /** 值类型，默认 string */
  type?: FieldType
  /** 最大值长度（string 生效） */
  maxLength?: number
  /** 自定义校验，返回错误文案或 null */
  validate?: (value: string, row: Record<string, string>) => string | null
  /** 值转换（如数字、枚举映射） */
  transform?: (value: string) => unknown
}

export interface ImportConfig<T = Record<string, unknown>> {
  code: string
  name: string
  fields: Array<ImportField<T>>
  /** 业务唯一键字段（用于去重与已存在判断），复合键用数组 */
  uniqueKeys?: Array<keyof T & string>
  /** 已存在时是否更新，默认 false（跳过） */
  upsert?: boolean
  /** 关联的自定义字段实体编码：用于把该实体的自定义字段并入导入模板与导出列 */
  entityCode?: string
}

export interface RowIssue {
  row: number
  field: string
  message: string
}

export interface ImportPreview {
  code: string
  name: string
  headers: string[]
  total: number
  valid: number
  invalid: number
  issues: RowIssue[]
  /** 校验通过、已映射转换后的行 */
  rows: Array<Record<string, unknown>>
}

export interface ExportField<T = Record<string, unknown>> {
  header: string
  key: keyof T & string
  format?: (value: unknown, row: T) => string | number
}

export interface ExportConfig<T = Record<string, unknown>> {
  code: string
  name: string
  fields: Array<ExportField<T>>
}
