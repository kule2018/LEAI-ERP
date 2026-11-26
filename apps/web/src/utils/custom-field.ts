import type { CustomField, CustomFieldCondition } from '@/api/custom-field'

/**
 * 自定义字段渲染层纯逻辑：条件显隐、类型转换、默认值与校验。
 * 与服务端 common/custom-field-engine.ts 保持同口径，便于前端即时反馈。
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

/** 条件显隐判定：字段配置的显示条件成立才可见 */
export function evaluateCustomCondition(
  condition: CustomFieldCondition | null | undefined,
  values: Record<string, unknown> = {}
): boolean {
  if (!condition || !condition.fieldKey) return true
  const actual = values?.[condition.fieldKey]
  const expected = condition.value
  switch (condition.operator) {
    case 'EQ':
      return String(actual ?? '') === String(expected ?? '')
    case 'NE':
      return String(actual ?? '') !== String(expected ?? '')
    case 'GT':
      return Number(actual) > Number(expected)
    case 'GTE':
      return Number(actual) >= Number(expected)
    case 'LT':
      return Number(actual) < Number(expected)
    case 'LTE':
      return Number(actual) <= Number(expected)
    case 'IN': {
      const candidates = Array.isArray(expected)
        ? expected.map((item) => String(item))
        : String(expected ?? '')
            .split(',')
            .map((item) => item.trim())
      return candidates.includes(String(actual ?? ''))
    }
    case 'CONTAINS':
      return String(actual ?? '').includes(String(expected ?? ''))
    default:
      return true
  }
}

/** 类型转换：按字段类型把原始输入转换为可存储值 */
export function coerceCustomValue(field: CustomField, raw: unknown): unknown {
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

/** 默认值填充：未填写的字段使用配置的默认值 */
export function applyCustomDefaults(
  fields: CustomField[],
  values: Record<string, unknown> = {}
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...values }
  for (const field of fields) {
    const current = result[field.fieldKey]
    const empty = current === undefined || current === null || current === ''
    if (empty && field.defaultValue !== null && field.defaultValue !== undefined) {
      result[field.fieldKey] = coerceCustomValue(field, field.defaultValue)
    }
  }
  return result
}

/** 值校验：必填、数值区间、长度、正则与候选项 */
export function validateCustomValues(
  fields: CustomField[],
  values: Record<string, unknown> = {}
): { ok: boolean; errors: Array<{ fieldKey: string; fieldLabel: string; message: string }> } {
  const errors: Array<{ fieldKey: string; fieldLabel: string; message: string }> = []
  for (const field of fields) {
    const value = values?.[field.fieldKey]
    const empty =
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    if (field.required === 1 && empty) {
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
      const min = field.minValue === null ? null : Number(field.minValue)
      const max = field.maxValue === null ? null : Number(field.maxValue)
      if (min !== null && Number.isFinite(min) && num < min) {
        errors.push({ fieldKey: field.fieldKey, fieldLabel: field.fieldLabel, message: `不得小于 ${min}` })
        continue
      }
      if (max !== null && Number.isFinite(max) && num > max) {
        errors.push({ fieldKey: field.fieldKey, fieldLabel: field.fieldLabel, message: `不得大于 ${max}` })
        continue
      }
    }
    if (field.maxLength !== null && String(value).length > field.maxLength) {
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
    const options = field.options ?? []
    if (field.fieldType === CUSTOM_FIELD_TYPE.SELECT && options.length > 0) {
      if (!options.some((option) => option.value === String(value))) {
        errors.push({ fieldKey: field.fieldKey, fieldLabel: field.fieldLabel, message: '取值不在候选范围内' })
      }
    }
  }
  return { ok: errors.length === 0, errors }
}

/** 按分组聚合字段，并依据当前值计算可见性 */
export function groupCustomFields(
  fields: CustomField[],
  values: Record<string, unknown> = {}
): Array<{ groupName: string; fields: CustomField[] }> {
  const groups = new Map<string, CustomField[]>()
  for (const field of [...fields].sort((a, b) => a.displayOrder - b.displayOrder)) {
    if (!evaluateCustomCondition(field.condition, values)) continue
    const list = groups.get(field.groupName) ?? []
    list.push(field)
    groups.set(field.groupName, list)
  }
  return [...groups.entries()].map(([groupName, groupFields]) => ({ groupName, fields: groupFields }))
}
