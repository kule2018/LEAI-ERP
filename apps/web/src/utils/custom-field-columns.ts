import { computed, ref } from 'vue'
import { fetchCustomFormSchema, fetchCustomValuesBatch } from '@/api/custom-field'
import type { GridColumn } from '@/types/contract'

/**
 * 自定义字段的列表列支持：
 * 列表页按实体编码加载自定义字段定义，生成动态列并批量回填取值，
 * 保证自定义字段在「表单 / 列表 / 导入导出 / 打印」各层口径一致。
 */
export interface CustomFieldColumnItem {
  fieldKey: string
  fieldLabel: string
  fieldType: string
  options: Array<{ label: string; value: string }> | null
}

export function useCustomFieldColumns(entityCode: string) {
  const fields = ref<CustomFieldColumnItem[]>([])
  const valueMap = ref<Record<string, Record<string, unknown>>>({})
  const loaded = ref(false)

  /** 动态列：列 prop 指向 customValues.<字段标识> */
  const customColumns = computed<GridColumn[]>(() =>
    fields.value.map((field) => ({
      prop: `customValues.${field.fieldKey}`,
      label: field.fieldLabel,
      width: 140
    }))
  )

  /** 加载自定义字段定义 */
  async function loadFields(): Promise<void> {
    try {
      const schema = await fetchCustomFormSchema(entityCode)
      fields.value = (schema.fields ?? [])
        .filter((field) => field.visibleInList === 1 && field.status === 'ENABLED')
        .map((field) => ({
          fieldKey: field.fieldKey,
          fieldLabel: field.fieldLabel,
          fieldType: field.fieldType,
          options: field.options ?? null
        }))
    } catch {
      fields.value = []
    } finally {
      loaded.value = true
    }
  }

  /** 批量回填取值：把结果挂到行对象的 customValues 上 */
  async function loadValues(rows: Array<{ id?: number }>): Promise<void> {
    const ids = rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0)
    if (!ids.length) {
      valueMap.value = {}
      return
    }
    try {
      const values = await fetchCustomValuesBatch(entityCode, ids)
      valueMap.value = values as Record<string, Record<string, unknown>>
      for (const row of rows) {
        const id = String(row.id ?? '')
        ;(row as Record<string, unknown>).customValues = valueMap.value[id] ?? {}
      }
    } catch {
      valueMap.value = {}
    }
  }

  /** 取某个行的自定义字段值 */
  function valueOf(row: Record<string, unknown>, fieldKey: string): unknown {
    const values = (row.customValues ?? {}) as Record<string, unknown>
    return values[fieldKey]
  }

  /** 展示用文本：选项字段按 label 展示 */
  function displayText(row: Record<string, unknown>, field: CustomFieldColumnItem): string {
    const value = valueOf(row, field.fieldKey)
    if (value === null || value === undefined || value === '') return ''
    if (field.options?.length) {
      const hit = field.options.find((option) => option.value === String(value))
      return hit?.label ?? String(value)
    }
    if (Array.isArray(value)) return value.join(',')
    return String(value)
  }

  return { fields, customColumns, loaded, loadFields, loadValues, valueOf, displayText }
}
