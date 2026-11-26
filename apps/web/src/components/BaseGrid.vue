<script setup lang="ts">
import { computed } from 'vue'
import type { GridColumn, GridDensity } from '@/types/contract'

export interface GridRow {
  id: number
  status?: string
}

const props = withDefaults(
  defineProps<{
    columns: GridColumn[]
    rows: GridRow[]
    loading: boolean
    error: string
    total: number
    page: number
    pageSize: number
    permPrefix: string
    /** 行密度：紧凑 / 默认 / 宽松 */
    density?: GridDensity
    /** 是否展示批量选择列 */
    selectable?: boolean
    /** 加载时是否展示骨架屏 */
    skeleton?: boolean
  }>(),
  {
    density: 'default',
    selectable: false,
    skeleton: true
  }
)

const emit = defineEmits<{
  refresh: []
  add: []
  edit: [row: GridRow]
  delete: [row: GridRow]
  action: [payload: { action: string; row: GridRow }]
  'row-click': [row: GridRow]
  'selection-change': [rows: GridRow[]]
  'update:page': [value: number]
  'update:page-size': [value: number]
}>()

const actions = ['submit', 'approve', 'partial', 'done', 'cancel']
const actionLabels: Record<string, string> = {
  submit: '提交',
  approve: '审批',
  partial: '部分完成',
  done: '完成',
  cancel: '作废'
}
const statusActions: Record<string, string[]> = {
  DRAFT: ['submit', 'cancel'],
  SUBMITTED: ['approve', 'cancel'],
  APPROVED: ['done', 'cancel'],
  PARTIAL: ['done', 'cancel'],
  DONE: [],
  CANCELLED: []
}
const showEmpty = computed(() => !props.loading && !props.error && props.rows.length === 0)
const showSkeleton = computed(() => props.loading && props.skeleton && props.rows.length === 0)
const densityClass = computed(() => `grid-density-${props.density}`)

function toGridRow(row: unknown): GridRow {
  return row as GridRow
}

function handleRowClick(row: unknown): void {
  emit('row-click', toGridRow(row))
}

function handleEdit(row: unknown): void {
  emit('edit', toGridRow(row))
}

function handleDelete(row: unknown): void {
  emit('delete', toGridRow(row))
}

function handleAction(action: string, row: unknown): void {
  emit('action', { action, row: toGridRow(row) })
}

function visibleActions(row: GridRow): string[] {
  const status = String(row.status ?? '').toUpperCase()
  return statusActions[status] ?? actions
}

function primaryActions(row: GridRow): string[] {
  return visibleActions(row).slice(0, 2)
}

function moreActions(row: GridRow): string[] {
  return visibleActions(row).slice(2)
}

function handleSelectionChange(selection: unknown[]): void {
  emit('selection-change', selection.map((item) => toGridRow(item)))
}

function handlePageChange(value: number): void {
  emit('update:page', value)
}

function handlePageSizeChange(value: number): void {
  emit('update:page-size', value)
}
</script>

<template>
  <section class="base-grid">
    <div class="grid-toolbar">
      <slot name="toolbar" />
      <el-button v-perm="props.permPrefix + ':create'" type="primary" @click="emit('add')">新增</el-button>
      <el-button @click="emit('refresh')">刷新</el-button>
    </div>

    <div v-if="props.error" class="grid-state grid-error">
      <p>加载失败：{{ props.error }}</p>
      <el-button type="primary" @click="emit('refresh')">重试</el-button>
    </div>

    <div v-else-if="showEmpty" class="grid-state">
      <el-empty description="暂无数据" />
    </div>

    <div v-else-if="showSkeleton" class="grid-skeleton">
      <el-skeleton :rows="6" animated />
    </div>

    <template v-else>
      <el-table
        v-loading="props.loading"
        :data="props.rows"
        :class="densityClass"
        row-key="id"
        border
        stripe
        @row-click="handleRowClick"
        @selection-change="handleSelectionChange"
      >
        <el-table-column v-if="props.selectable" type="selection" width="46" :reserve-selection="true" />
        <el-table-column
          v-for="column in props.columns"
          :key="column.prop"
          :prop="column.prop"
          :label="column.label"
          :width="column.width"
          :fixed="column.fixed"
          :align="column.align ?? 'left'"
          show-overflow-tooltip
        >
          <template #default="scope">
            <slot name="cell" :column="column" :row="scope.row" :value="scope.row[column.prop]">
              {{ scope.row[column.prop] }}
            </slot>
          </template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="240" align="center">
          <template #default="{ row }">
            <div class="row-actions">
              <el-button link type="primary" v-perm="props.permPrefix + ':update'" @click.stop="handleEdit(row)">
                编辑
              </el-button>
              <el-button
                v-for="action in primaryActions(row)"
                :key="action"
                link
                type="primary"
                v-perm="props.permPrefix + ':' + action"
                @click.stop="handleAction(action, row)"
              >
                {{ actionLabels[action] }}
              </el-button>
              <el-dropdown v-if="moreActions(row).length" trigger="click" @click.stop>
                <el-button link type="primary">更多 ▾</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-for="action in moreActions(row)"
                      :key="action"
                      v-perm="props.permPrefix + ':' + action"
                      @click="handleAction(action, row)"
                    >
                      {{ actionLabels[action] }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <slot name="row-extra" :row="row" />
              <el-button link type="danger" v-perm="props.permPrefix + ':delete'" @click.stop="handleDelete(row)">
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="grid-pagination">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="props.total"
          :current-page="props.page"
          :page-size="props.pageSize"
          :page-sizes="[20, 50, 100, 200]"
          @current-change="handlePageChange"
          @size-change="handlePageSizeChange"
        />
      </div>
    </template>
  </section>
</template>

<style scoped>
.base-grid {
  padding: var(--erp-space-4);
  background: #fff;
  border-radius: var(--erp-radius-base);
}

.grid-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--erp-space-2);
  margin-bottom: var(--erp-space-4);
}

.grid-state {
  min-height: 240px;
  padding: var(--erp-space-6);
  text-align: center;
}

.grid-error p {
  margin: 0 0 var(--erp-space-4);
  color: #f5222d;
}

.grid-skeleton {
  min-height: 240px;
  padding: var(--erp-space-4);
}

.grid-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--erp-space-4);
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--erp-space-1);
}

/* 行密度 */
:deep(.grid-density-compact .el-table__cell) {
  padding: 4px 0;
}

:deep(.grid-density-loose .el-table__cell) {
  padding: 14px 0;
}
</style>
