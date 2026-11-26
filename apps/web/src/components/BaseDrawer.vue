<script setup lang="ts">
import type { FieldDef } from '@/types/contract'

const props = defineProps<{
  modelValue: boolean
  title: string
  fields: FieldDef[]
  form: Record<string, unknown>
  loading: boolean
  submitPerm: string
  isEdit?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:form': [value: Record<string, unknown>]
  submit: []
}>()

function handleVisibleChange(value: boolean): void {
  emit('update:modelValue', value)
}

function updateField(key: string, value: unknown): void {
  emit('update:form', { ...props.form, [key]: value })
}

function stringValue(key: string): string {
  const value = props.form[key]
  return value === undefined || value === null ? '' : String(value)
}

function numberValue(key: string): number {
  const value = props.form[key]
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
</script>

<template>
  <el-drawer
    :model-value="props.modelValue"
    :title="props.title"
    size="560px"
    @update:model-value="handleVisibleChange"
  >
    <el-form label-width="110px">
      <el-form-item
        v-for="field in props.fields"
        :key="field.key"
        :label="field.label"
        :required="field.required === true"
      >
        <el-select
          v-if="field.type === 'select'"
          :model-value="stringValue(field.key)"
          placeholder="请选择"
          @update:model-value="updateField(field.key, $event)"
        >
          <el-option
            v-for="option in field.options ?? []"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>

        <el-input
          v-else-if="field.type === 'textarea'"
          :model-value="stringValue(field.key)"
          type="textarea"
          :rows="4"
          :maxlength="field.maxlength"
          @update:model-value="updateField(field.key, $event)"
        />

        <el-input-number
          v-else-if="field.type === 'int' || field.type === 'decimal'"
          :model-value="numberValue(field.key)"
          :precision="field.type === 'decimal' ? 4 : 0"
          controls-position="right"
          @update:model-value="updateField(field.key, $event ?? 0)"
        />

        <el-input
          v-else
          :model-value="stringValue(field.key)"
          :maxlength="field.maxlength"
          @update:model-value="updateField(field.key, $event)"
        />
      </el-form-item>
    </el-form>

    <slot name="extra" />

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="handleVisibleChange(false)">取消</el-button>
        <el-button v-perm="props.submitPerm" type="primary" :loading="props.loading" @click="emit('submit')">
          保存
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--erp-space-2);
}
</style>
