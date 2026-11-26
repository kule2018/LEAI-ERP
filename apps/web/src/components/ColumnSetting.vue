<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { saveViewConfig } from '@/api/user-preference'
import type { GridColumn, GridDensity, ViewConfigState } from '@/types/contract'

const props = defineProps<{
  pageKey: string
  columns: GridColumn[]
  modelValue: string[]
  /** 当前行密度 */
  density?: GridDensity
  /** 各列已保存的宽度 */
  widths?: Record<string, number>
  /** 完整视图配置（保存时整体覆盖，避免丢失列宽/密度/排序） */
  state?: ViewConfigState
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
  'move': [payload: { prop: string; offset: number }]
  'density-change': [value: GridDensity]
  'width-change': [payload: { prop: string; width: number }]
  'reset': []
}>()

const visible = ref(false)
const selected = ref<string[]>([...props.modelValue])
const density = ref<GridDensity>(props.density ?? 'default')
const widthDraft = ref<Record<string, number>>({ ...(props.widths ?? {}) })

watch(
  () => props.modelValue,
  (value) => {
    selected.value = [...value]
  }
)

watch(
  () => props.density,
  (value) => {
    if (value) density.value = value
  }
)

watch(
  () => props.widths,
  (value) => {
    widthDraft.value = { ...(value ?? {}) }
  }
)

/** 可见列在全部列中的序号，用于上移/下移 */
function columnIndex(prop: string): number {
  return props.columns.findIndex((column) => column.prop === prop)
}

function handleMove(prop: string, offset: number): void {
  emit('move', { prop, offset })
}

function handleDensityChange(value: GridDensity): void {
  density.value = value
  emit('density-change', value)
}

function handleWidthBlur(prop: string): void {
  const width = Number(widthDraft.value[prop])
  if (!Number.isFinite(width) || width <= 0) return
  emit('width-change', { prop, width })
}

async function handleApply(): Promise<void> {
  await saveViewConfig(props.pageKey, { ...(props.state ?? {}), columns: [...selected.value] })
  emit('update:modelValue', [...selected.value])
  visible.value = false
  ElMessage.success('视图配置已保存')
}

async function handleReset(): Promise<void> {
  selected.value = props.columns.map((column) => column.prop)
  widthDraft.value = {}
  await saveViewConfig(props.pageKey, { ...(props.state ?? {}), columns: [...selected.value], widths: {}, sort: null })
  emit('update:modelValue', [...selected.value])
  emit('reset')
  visible.value = false
  ElMessage.success('已恢复默认列')
}
</script>

<template>
  <el-popover v-model:visible="visible" trigger="click" width="320" placement="bottom-start">
    <template #reference>
      <el-button>列设置</el-button>
    </template>
    <div class="column-setting">
      <p class="column-setting-title">显示列</p>
      <el-checkbox-group v-model="selected" class="column-setting-list">
        <el-checkbox v-for="column in props.columns" :key="column.prop" :value="column.prop">
          {{ column.label }}
        </el-checkbox>
      </el-checkbox-group>

      <p class="column-setting-title">列顺序</p>
      <ul class="column-order">
        <li v-for="column in props.columns" :key="column.prop" class="column-order-item">
          <span class="column-order-label">{{ column.label }}</span>
          <span class="column-order-ops">
            <el-button link size="small" :disabled="columnIndex(column.prop) <= 0" @click="handleMove(column.prop, -1)">
              上移
            </el-button>
            <el-button
              link
              size="small"
              :disabled="columnIndex(column.prop) >= props.columns.length - 1"
              @click="handleMove(column.prop, 1)"
            >
              下移
            </el-button>
          </span>
        </li>
      </ul>

      <p class="column-setting-title">行密度</p>
      <el-radio-group :model-value="density" size="small" @update:model-value="handleDensityChange">
        <el-radio-button value="compact">紧凑</el-radio-button>
        <el-radio-button value="default">默认</el-radio-button>
        <el-radio-button value="loose">宽松</el-radio-button>
      </el-radio-group>

      <p class="column-setting-title">列宽</p>
      <div class="column-widths">
        <div v-for="column in props.columns" :key="column.prop" class="column-width-item">
          <span class="column-order-label">{{ column.label }}</span>
          <el-input-number
            :model-value="widthDraft[column.prop] ?? column.width ?? 120"
            :min="60"
            :max="600"
            :step="10"
            size="small"
            controls-position="right"
            @update:model-value="(value: number | undefined) => (widthDraft[column.prop] = value ?? 0)"
            @blur="handleWidthBlur(column.prop)"
          />
        </div>
      </div>

      <div class="column-setting-actions">
        <el-button link @click="handleReset">恢复默认</el-button>
        <el-button link type="primary" @click="handleApply">保存</el-button>
      </div>
    </div>
  </el-popover>
</template>

<style scoped>
.column-setting-title {
  margin: 12px 0 8px;
  font-size: 13px;
  color: #646a73;
}

.column-setting-title:first-child {
  margin-top: 0;
}

.column-setting-list {
  display: flex;
  flex-direction: column;
  max-height: 180px;
  overflow-y: auto;
}

.column-order {
  max-height: 150px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.column-order-item,
.column-width-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 0;
}

.column-order-label {
  overflow: hidden;
  font-size: 13px;
  color: #1f2329;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.column-order-ops {
  display: flex;
  flex-shrink: 0;
}

.column-widths {
  max-height: 150px;
  overflow-y: auto;
}

.column-setting-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}
</style>
