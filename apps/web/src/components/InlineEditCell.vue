<script setup lang="ts">
import { ref, watch } from 'vue'

/**
 * 行内编辑单元格：双击进入编辑，Enter 保存，Esc 取消。
 * 用于列表页的轻量字段快速修改（状态、备注、负责人等）。
 */
const props = withDefaults(
  defineProps<{
    modelValue: string | number | null | undefined
    /** 是否可编辑 */
    editable?: boolean
    /** 是否为下拉选择 */
    options?: Array<{ label: string; value: string | number }>
    placeholder?: string
  }>(),
  {
    editable: true,
    options: () => [],
    placeholder: '请输入'
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null]
  save: [value: string | number | null]
  cancel: []
}>()

const editing = ref(false)
const draft = ref<string>('')

watch(
  () => props.modelValue,
  (value) => {
    if (!editing.value) draft.value = value === null || value === undefined ? '' : String(value)
  },
  { immediate: true }
)

function startEdit(): void {
  if (!props.editable) return
  draft.value = props.modelValue === null || props.modelValue === undefined ? '' : String(props.modelValue)
  editing.value = true
}

function cancel(): void {
  editing.value = false
  emit('cancel')
}

function commit(): void {
  const next = props.options.length
    ? (props.options.find((option) => String(option.value) === draft.value)?.value ?? draft.value)
    : draft.value
  editing.value = false
  emit('update:modelValue', next)
  emit('save', next)
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    event.preventDefault()
    commit()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancel()
  }
}
</script>

<template>
  <div class="inline-cell">
    <template v-if="editing">
      <el-select
        v-if="props.options.length"
        v-model="draft"
        size="small"
        filterable
        default-first-option
        style="width: 100%"
        @keydown="handleKeydown"
      >
        <el-option v-for="option in props.options" :key="String(option.value)" :label="option.label" :value="String(option.value)" />
      </el-select>
      <el-input
        v-else
        v-model="draft"
        size="small"
        :placeholder="props.placeholder"
        @keydown="handleKeydown"
        @blur="commit"
      />
    </template>
    <span v-else class="inline-cell-text" :class="{ 'inline-cell-editable': props.editable }" @dblclick="startEdit">
      {{ props.modelValue === null || props.modelValue === undefined || props.modelValue === '' ? '—' : props.modelValue }}
    </span>
  </div>
</template>

<style scoped>
.inline-cell-text {
  display: inline-block;
  min-height: 20px;
  padding: 0 4px;
  line-height: 20px;
}

.inline-cell-editable:hover {
  color: #3370ff;
  cursor: text;
  background: #f2f3f5;
  border-radius: 4px;
}
</style>
