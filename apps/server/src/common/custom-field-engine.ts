/**
 * 自定义字段/表单纯逻辑引擎：字段规范化、类型转换、条件显隐、默认值与校验。
 * 与持久层解耦，便于单元测试与前端渲染层复用。
 */

export const CUSTOM_FIELD_TYPE = {
  TEXT: 'TEXT',
  NUMBER: 'NUMBER',
  DATE: 'DATE',
  DATETIME: 'DATETIME',
  SELECT: 'SELECT',
  MULTI_SELECT: 'MULTI_SELECT',
  BOOLEAN: 'BOOLEAN',
  REFERENCE: 'REFERENCE'
} as const

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPE)[keyof typeof CUSTOM_FIELD_TYPE]

export const CUSTOM_CONDITION_OPERATOR = {
  EQ: 'EQ',
  NE: 'NE',
  GT: 'GT',
  GTE: 'GTE',
  LT: 'LT',
  LTE: 'LTE',
  IN: 'IN',
  CONTAINS: 'CONTAINS'
} as const

export type CustomConditionOperator = (typeof CUSTOM_CONDITION_OPERATOR)[keyof typeof CUSTOM_CONDITION_OPERATOR]

/**
 * 业务类型（bizType）与自定义字段实体编码（entityCode）的映射：
 * 列表动态列、导入导出、打印渲染统一据此找到对应的自定义字段定义。
 */
export const CUSTOM_ENTITY_BY_BIZ_TYPE: Record<string, string> = {
  customer: 'CUSTOMER',
  product: 'PRODUCT',
  supplier: 'SUPPLIER',
  stock_io: 'STOCK_IO',
  sale_order: 'SALE_ORDER',
  purchase_order: 'PURCHASE_ORDER',
  goods_receipt: 'PURCHASE_RECEIPT',
  work_order: 'WORK_ORDER',
  voucher: 'FIN_VOUCHER',
  sales_order: 'SALE_ORDER'
}

/** 自定义字段取值在打印/导出中的键前缀 */
export const CUSTOM_VALUE_KEY_PREFIX = 'custom.'

export interface CustomFieldOption {
  label: string
  value: string
}

export interface CustomFieldCondition {
  fieldKey: string
  operator: CustomConditionOperator | string
  value?: unknown
}

export interface CustomFieldDefinition {
  fieldKey: string
  fieldLabel: string
  fieldType: CustomFieldType | string
  required?: boolean
  options?: CustomFieldOption[]
  defaultValue?: unknown
  visibleInList?: boolean
  allowFilter?: boolean
  maxLength?: number
  min?: number
  max?: number
  pattern?: string
  groupName?: string
  displayOrder?: number
  referenceType?: string
  condition?: CustomFieldCondition | null
}

export interface CustomFieldValidationError {
  fieldKey: string
  fieldLabel: string
  message: string
}

export interface CustomFormField extends CustomFieldDefinition {
  visible: boolean
  groupName: string
  displayOrder: number
}

export interface CustomFormGroup {
  groupName: string
  fields: CustomFormField[]
}

/** 规范化后的字段定义：关键属性均已补齐默认值 */
export interface NormalizedCustomField extends CustomFieldDefinition {
  fieldType: CustomFieldType | string
  required: boolean
  visibleInList: boolean
  allowFilter: boolean
  options: CustomFieldOption[]
  groupName: string
  displayOrder: number
}

const FIELD_TYPES: string[] = Object.values(CUSTOM_FIELD_TYPE)

/** 字段规范化：补齐默认值、统一类型枚举 */
export function normalizeCustomField(field: CustomFieldDefinition): NormalizedCustomField {
  const fieldKey = String(field?.fieldKey ?? '').trim()
  const fieldType = FIELD_TYPES.includes(String(field?.fieldType)) ? String(field.fieldType) : CUSTOM_FIELD_TYPE.TEXT
  return {
    ...field,
    fieldKey,
    fieldLabel: String(field?.fieldLabel ?? '').trim() || fieldKey,
    fieldType,
    required: field?.required === true,
    visibleInList: field?.visibleInList !== false,
    allowFilter: field?.allowFilter === true,
    options: Array.isArray(field?.options) ? field.options : [],
    groupName: String(field?.groupName ?? '').trim() || '基础信息',
    displayOrder: Number.isFinite(field?.displayOrder) ? Number(field.displayOrder) : 0,
    maxLength: Number.isFinite(field?.maxLength) ? Number(field.maxLength) : undefined,
    min: Number.isFinite(field?.min) ? Number(field.min) : undefined,
    max: Number.isFinite(field?.max) ? Number(field.max) : undefined
  }
}

/** 类型转换：按字段类型把原始输入转换为可存储值 */
export function coerceCustomValue(field: CustomFieldDefinition, raw: unknown): unknown {
  if (raw === null || raw === undefined) return raw
  if (field.fieldType === CUSTOM_FIELD_TYPE.NUMBER) {
    const num = Number(raw)
    return Number.isFinite(num) ? num : raw
  }
  if (field.fieldType === CUSTOM_FIELD_TYPE.BOOLEAN) {
    if (typeof raw === 'boolean') return raw
    if (raw === 'true' || raw === 1 || raw === '1') return true
    if (raw === 'false' || raw === 0 || raw === '0') return false
    return raw
  }
  if (field.fieldType === CUSTOM_FIELD_TYPE.MULTI_SELECT) {
    if (Array.isArray(raw)) return raw.map((item) => String(item))
    return String(raw)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return typeof raw === 'string' ? raw : String(raw)
}

/** 条件显隐判定：字段配置的显示条件成立才可见 */
export function evaluateCustomCondition(
  condition: CustomFieldCondition | null | undefined,
  values: Record<string, unknown> = {}
): boolean {
  if (!condition || !condition.fieldKey) return true
  const actual = values?.[condition.fieldKey]
  const expected = condition.value
  switch (condition.operator) {
    case CUSTOM_CONDITION_OPERATOR.EQ:
      return String(actual ?? '') === String(expected ?? '')
    case CUSTOM_CONDITION_OPERATOR.NE:
      return String(actual ?? '') !== String(expected ?? '')
    case CUSTOM_CONDITION_OPERATOR.GT:
      return Number(actual) > Number(expected)
    case CUSTOM_CONDITION_OPERATOR.GTE:
      return Number(actual) >= Number(expected)
    case CUSTOM_CONDITION_OPERATOR.LT:
      return Number(actual) < Number(expected)
    case CUSTOM_CONDITION_OPERATOR.LTE:
      return Number(actual) <= Number(expected)
    case CUSTOM_CONDITION_OPERATOR.IN: {
      const candidates = Array.isArray(expected)
        ? expected.map((item) => String(item))
        : String(expected ?? '')
            .split(',')
            .map((item) => item.trim())
      return candidates.includes(String(actual ?? ''))
    }
    case CUSTOM_CONDITION_OPERATOR.CONTAINS:
      return String(actual ?? '').includes(String(expected ?? ''))
    default:
      return true
  }
}

/** 表单结构组装：按分组聚合，并依据当前值计算可见性 */
export function buildCustomFormSchema(
  fields: CustomFieldDefinition[],
  values: Record<string, unknown> = {}
): CustomFormGroup[] {
  const normalized = fields
    .map(normalizeCustomField)
    .sort((left, right) => left.displayOrder - right.displayOrder)
  const groups = new Map<string, CustomFormField[]>()
  for (const field of normalized) {
    const item: CustomFormField = { ...field, visible: evaluateCustomCondition(field.condition, values) }
    const list = groups.get(field.groupName) ?? []
    list.push(item)
    groups.set(field.groupName, list)
  }
  return [...groups.entries()].map(([groupName, groupFields]) => ({ groupName, fields: groupFields }))
}

/** 默认值填充：未填写的字段使用配置的默认值 */
export function applyCustomDefaults(
  fields: CustomFieldDefinition[],
  values: Record<string, unknown> = {}
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...values }
  for (const field of fields.map(normalizeCustomField)) {
    const current = result[field.fieldKey]
    const empty = current === undefined || current === null || current === ''
    if (empty && field.defaultValue !== undefined && field.defaultValue !== null) {
      result[field.fieldKey] = coerceCustomValue(field, field.defaultValue)
    }
  }
  return result
}

/** 值清洗：仅保留已定义字段并按类型转换，防止脏字段入库 */
export function sanitizeCustomValues(
  fields: CustomFieldDefinition[],
  values: Record<string, unknown> = {}
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const field of fields.map(normalizeCustomField)) {
    if (!field.fieldKey) continue
    const raw = values?.[field.fieldKey]
    if (raw === undefined) continue
    result[field.fieldKey] = coerceCustomValue(field, raw)
  }
  return result
}

/** 值校验：必填、数值区间、长度、正则与候选项 */
export function validateCustomValues(
  fields: CustomFieldDefinition[],
  values: Record<string, unknown> = {}
): { ok: boolean; errors: CustomFieldValidationError[] } {
  const errors: CustomFieldValidationError[] = []
  for (const field of fields.map(normalizeCustomField)) {
    const value = values?.[field.fieldKey]
    const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
    if (field.required && empty) {
      errors.push({ fieldKey: field.fieldKey, fieldLabel: field.fieldLabel, message: '必填项不能为空' })
      continue
    }
    if (empty) continue
    if (field.fieldType === CUSTOM_FIELD_TYPE.NUMBER) {
      const num = Number(value)
      if (!Number.isFinite(num)) {
        errors.push({ fieldKey: field.fieldKey, fieldLabel: field.fieldLabel, message: '必须为数字' })
        continue
      }
      if (field.min !== undefined && num < field.min) {
        errors.push({ fieldKey: field.fieldKey, fieldLabel: field.fieldLabel, message: `不得小于 ${field.min}` })
        continue
      }
      if (field.max !== undefined && num > field.max) {
        errors.push({ fieldKey: field.fieldKey, fieldLabel: field.fieldLabel, message: `不得大于 ${field.max}` })
        continue
      }
    }
    if (field.maxLength !== undefined && String(value).length > field.maxLength) {
      errors.push({ fieldKey: field.fieldKey, fieldLabel: field.fieldLabel, message: `长度不得超过 ${field.maxLength}` })
      continue
    }
    if (field.pattern) {
      let matched = true
      try {
        matched = new RegExp(field.pattern).test(String(value))
      } catch {
        matched = true
      }
      if (!matched) {
        errors.push({ fieldKey: field.fieldKey, fieldLabel: field.fieldLabel, message: '格式不符合要求' })
        continue
      }
    }
    if (field.fieldType === CUSTOM_FIELD_TYPE.SELECT && field.options.length > 0) {
      if (!field.options.some((option) => option.value === String(value))) {
        errors.push({ fieldKey: field.fieldKey, fieldLabel: field.fieldLabel, message: '取值不在候选范围内' })
      }
    }
  }
  return { ok: errors.length === 0, errors }
}
