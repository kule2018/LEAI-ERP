<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchCustomFormSchema,
  fetchCustomValues,
  saveCustomValues,
  type CustomField
} from '@/api/custom-field'
import {
  applyCustomDefaults,
  coerceCustomValue,
  groupCustomFields,
  validateCustomValues,
  CUSTOM_FIELD_TYPE
} from '@/utils/custom-field'

const props = withDefaults(
  defineProps<{
    entityCode: string
    bizId?: number | null
    modelValue?: Record<string, unknown>
    savable?: boolean
  }>(),
  { bizId: null, modelValue: () => ({}), savable: true }
)

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>]
  saved: [value: Record<string, unknown>]
}>()

const fields = ref<CustomField[]>([])
const values = ref<Record<string, unknown>>({ ...props.modelValue })
const loading = ref(false)
const saving = ref(false)
const error = ref('')

const groups = computed(() => groupCustomFields(fields.value, values.value))
const hasFields = computed(() => fields.value.length > 0)

function setValue(key: string, value: unknown): void {
  values.value = { ...values.value, [key]: value }
  emit('update:modelValue', values.value)
}

function stringValue(key: string): string {
  const value = values.value[key]
  return value === undefined || value === null ? '' : String(value)
}

function numberValue(key: string): number {
  const parsed = Number(values.value[key])
  return Number.isFinite(parsed) ? parsed : 0
}

function booleanValue(key: string): boolean {
  return values.value[key] === true || values.value[key] === 'true' || values.value[key] === 1
}

function arrayValue(key: string): string[] {
  const value = values.value[key]
  if (Array.isArray(value)) return value.map((item) => String(item))
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

async function loadSchema(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const schema = await fetchCustomFormSchema(props.entityCode)
    fields.value = schema.fields ?? []
    let loaded: Record<string, unknown> = { ...props.modelValue }
    if (props.bizId) {
      loaded = { ...loaded, ...(await fetchCustomValues(props.entityCode, props.bizId)) }
    }
    values.value = applyCustomDefaults(fields.value, loaded)
    emit('update:modelValue', values.value)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '自定义字段加载失败'
    fields.value = []
  } finally {
    loading.value = false
  }
}

async function handleSave(): Promise<void> {
  if (!props.bizId || saving.value) return
  saving.value = true
  try {
    const payload: Record<string, unknown> = {}
    for (const field of fields.value) {
      const value = values.value[field.fieldKey]
      if (value === undefined) continue
      payload[field.fieldKey] = coerceCustomValue(field, value)
    }
    const validation = validateCustomValues(fields.value, payload)
    if (!validation.ok) {
      ElMessage.error(validation.errors.map((item) => `${item.fieldLabel}：${item.message}`).join('；'))
      return
    }
    const saved = await saveCustomValues(props.entityCode, props.bizId, payload)
    values.value = saved
    emit('update:modelValue', saved)
    emit('saved', saved)
    ElMessage.success('自定义字段已保存')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  } finally {
    saving.value = false
  }
}

watch(
  () => props.modelValue,
  (value) => {
    values.value = { ...value }
  }
)

watch(
  () => props.bizId,
  () => {
    void loadSchema()
  }
)

onMounted(loadSchema)
</script>

<template>
  <section v-loading="loading" class="custom-field-panel">
    <p v-if="error" class="custom-field-error">{{ error }}</p>
    <template v-else-if="hasFields">
      <div v-for="group in groups" :key="group.groupName" class="custom-field-group">
        <p class="custom-field-group-title">{{ group.groupName }}</p>
        <el-form label-width="120px">
          <el-form-item
            v-for="field in group.fields"
            :key="field.fieldKey"
            :label="field.fieldLabel"
            :required="field.required === 1"
          >
            <el-select
              v-if="field.fieldType === CUSTOM_FIELD_TYPE.SELECT"
              :model-value="stringValue(field.fieldKey)"
              placeholder="请选择"
              clearable
              @update:model-value="setValue(field.fieldKey, $event)"
            >
              <el-option
                v-for="option in field.options ?? []"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>

            <el-select
              v-else-if="field.fieldType === CUSTOM_FIELD_TYPE.MULTI_SELECT"
              :model-value="arrayValue(field.fieldKey)"
              multiple
              placeholder="请选择"
              @update:model-value="setValue(field.fieldKey, $event)"
            >
              <el-option
                v-for="option in field.options ?? []"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>

            <el-switch
              v-else-if="field.fieldType === CUSTOM_FIELD_TYPE.BOOLEAN"
              :model-value="booleanValue(field.fieldKey)"
              @update:model-value="setValue(field.fieldKey, $event)"
            />

            <el-input-number
              v-else-if="field.fieldType === CUSTOM_FIELD_TYPE.NUMBER"
              :model-value="numberValue(field.fieldKey)"
              :min="field.minValue === null ? undefined : Number(field.minValue)"
              :max="field.maxValue === null ? undefined : Number(field.maxValue)"
              controls-position="right"
              @update:model-value="setValue(field.fieldKey, $event ?? 0)"
            />

            <el-input
              v-else-if="field.fieldType === CUSTOM_FIELD_TYPE.DATE"
              :model-value="stringValue(field.fieldKey)"
              type="date"
              @update:model-value="setValue(field.fieldKey, $event)"
            />

            <el-input
              v-else-if="field.fieldType === CUSTOM_FIELD_TYPE.DATETIME"
              :model-value="stringValue(field.fieldKey)"
              type="datetime"
              @update:model-value="setValue(field.fieldKey, $event)"
            />

            <el-input
              v-else
              :model-value="stringValue(field.fieldKey)"
              :maxlength="field.maxLength ?? undefined"
              @update:model-value="setValue(field.fieldKey, $event)"
            />
          </el-form-item>
        </el-form>
      </div>
      <div v-if="props.savable && props.bizId" class="custom-field-actions">
        <el-button type="primary" :loading="saving" @click="handleSave">保存自定义字段</el-button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.custom-field-panel {
  margin-top: var(--erp-space-4);
  padding-top: var(--erp-space-3);
  border-top: 1px dashed #e4e7ed;
}

.custom-field-group-title {
  margin: 0 0 var(--erp-space-2);
  font-size: 13px;
  font-weight: 600;
  color: #646a73;
}

.custom-field-error {
  margin: 0;
  color: #f5222d;
}

.custom-field-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
