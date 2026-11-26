<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import BaseGrid from '@/components/BaseGrid.vue'
import ColumnSetting from '@/components/ColumnSetting.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import {
  createExportTask,
  exportTaskContentUrl,
  fetchExportTasks,
  retryExportTask,
  type ExportTask
} from '@/api/export-task'
import { fetchImportConfigs, type ImportConfigItem } from '@/api/io'
import { useViewConfig } from '@/utils/view-config'
import type { GridColumn } from '@/types/contract'

const PAGE_KEY = 'system-export-task'

const allColumns: GridColumn[] = [
  { prop: 'id', label: '任务 ID', width: 100 },
  { prop: 'code', label: '资源', width: 150 },
  { prop: 'bizType', label: '业务域', width: 130 },
  { prop: 'status', label: '状态', width: 110 },
  { prop: 'rowCount', label: '数据行数', width: 110 },
  { prop: 'fileName', label: '文件名', width: 180 },
  { prop: 'createdAt', label: '创建时间', width: 180 },
  { prop: 'finishedAt', label: '完成时间', width: 180 }
]

const view = useViewConfig(PAGE_KEY, allColumns)

const rows = ref<ExportTask[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const page = ref(1)
const pageSize = ref(20)
const statusFilter = ref('')
const keyword = ref('')

const resources = ref<ImportConfigItem[]>([])
const createVisible = ref(false)
const creating = ref(false)
const form = ref({ code: '', bizType: '', params: '' })

let requestSeq = 0
let pollTimer: number | undefined

const statusLabel: Record<string, string> = {
  PENDING: '排队中',
  RUNNING: '执行中',
  DONE: '已完成',
  FAILED: '失败'
}

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchExportTasks({
      page: page.value,
      pageSize: pageSize.value,
      status: statusFilter.value || undefined,
      code: keyword.value.trim() || undefined
    })
    if (seq !== requestSeq) return
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    if (seq === requestSeq) error.value = cause instanceof Error ? cause.message : '加载导出任务失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

async function loadResources(): Promise<void> {
  try {
    resources.value = await fetchImportConfigs()
  } catch {
    resources.value = []
  }
}

function openCreate(): void {
  form.value = { code: resources.value[0]?.code ?? '', bizType: '', params: '' }
  createVisible.value = true
}

async function submitCreate(): Promise<void> {
  if (!form.value.code) {
    ElMessage.warning('请选择导出资源')
    return
  }
  creating.value = true
  try {
    let params: Record<string, unknown> | undefined
    if (form.value.params.trim()) {
      try {
        params = JSON.parse(form.value.params) as Record<string, unknown>
      } catch {
        ElMessage.warning('附加参数不是合法的 JSON')
        return
      }
    }
    await createExportTask({ code: form.value.code, bizType: form.value.bizType || undefined, params })
    ElMessage.success('导出任务已创建，正在后台执行')
    createVisible.value = false
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '创建导出任务失败')
  } finally {
    creating.value = false
  }
}

async function handleRetry(row: unknown): Promise<void> {
  const task = row as ExportTask
  try {
    await retryExportTask(task.id)
    ElMessage.success('已重新提交导出任务')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '重新执行失败')
  }
}

function handleMove(payload: { prop: string; offset: number }): void {
  const order = [...view.state.value.columns]
  const index = order.indexOf(payload.prop)
  if (index === -1) return
  const target = index + payload.offset
  if (target < 0 || target >= order.length) return
  order.splice(index, 1)
  order.splice(target, 0, payload.prop)
  void view.save({ columns: order })
}

function handleDensityChange(value: 'compact' | 'default' | 'loose'): void {
  void view.setDensity(value)
}

function handleWidthChange(payload: { prop: string; width: number }): void {
  void view.setWidth(payload.prop, payload.width)
}

function handleReset(): void {
  void view.reset()
}

function handlePage(value: number): void {
  page.value = value
  void load()
}

function handlePageSize(value: number): void {
  pageSize.value = value
  page.value = 1
  void load()
}

onMounted(async () => {
  await view.load()
  await loadResources()
  await load()
  // 有任务在执行时轮询刷新
  pollTimer = window.setInterval(() => {
    if (rows.value.some((item) => item.status === 'PENDING' || item.status === 'RUNNING')) {
      void load()
    }
  }, 5000)
})

onUnmounted(() => {
  requestSeq += 1
  if (pollTimer) window.clearInterval(pollTimer)
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>导出任务</h2>
      <p>大数据量导出交由后台队列异步执行，完成后可直接下载 CSV 文件。</p>
    </header>

    <div class="export-task-toolbar">
      <el-input v-model="keyword" placeholder="资源编码" clearable style="width: 180px" @keyup.enter="load" />
      <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 140px">
        <el-option v-for="(label, value) in statusLabel" :key="value" :label="label" :value="value" />
      </el-select>
      <el-button @click="load">查询</el-button>
      <div class="export-task-toolbar-right">
        <ColumnSetting
          :page-key="PAGE_KEY"
          :columns="allColumns"
          v-model="view.visibleProps.value"
          :density="view.density.value"
          :widths="view.widths.value"
          :state="view.state.value"
          @move="handleMove"
          @density-change="handleDensityChange"
          @width-change="handleWidthChange"
          @reset="handleReset"
        />
        <FavoriteButton target-key="system-export-task" title="导出任务" route="/system/export-task" />
        <el-button type="primary" @click="openCreate">新建导出任务</el-button>
      </div>
    </div>

    <BaseGrid
      :columns="view.visibleColumns.value"
      :rows="rows"
      :loading="loading"
      :error="error"
      :total="total"
      :page="page"
      :page-size="pageSize"
      perm-prefix="system:export-task"
      :density="view.density.value"
      @refresh="load"
      @add="openCreate"
      @update:page="handlePage"
      @update:page-size="handlePageSize"
    >
      <template #cell="{ column, row }">
        <template v-if="column.prop === 'status'">
          <el-tag :type="row.status === 'DONE' ? 'success' : row.status === 'FAILED' ? 'danger' : 'warning'">
            {{ statusLabel[row.status] ?? row.status }}
          </el-tag>
        </template>
        <template v-else-if="column.prop === 'fileName'">
          <a v-if="row.status === 'DONE'" :href="exportTaskContentUrl(row.id)" target="_blank">{{ row.fileName ?? '下载' }}</a>
          <span v-else>{{ row.fileName ?? '-' }}</span>
        </template>
        <template v-else-if="column.prop === 'rowCount'">
          {{ row.rowCount ?? 0 }}
        </template>
        <template v-else>{{ row[column.prop] ?? '-' }}</template>
      </template>
      <template #row-extra="{ row }">
        <el-button link type="primary" @click.stop="handleRetry(row)">重试</el-button>
      </template>
    </BaseGrid>

    <el-dialog v-model="createVisible" title="新建导出任务" width="520px">
      <el-form label-width="90px">
        <el-form-item label="导出资源">
          <el-select v-model="form.code" placeholder="选择资源" style="width: 100%">
            <el-option v-for="item in resources" :key="item.code" :label="`${item.name}（${item.code}）`" :value="item.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="业务域">
          <el-input v-model="form.bizType" placeholder="可选，如 SALES / PURCHASE" />
        </el-form-item>
        <el-form-item label="附加参数">
          <el-input v-model="form.params" type="textarea" :rows="3" placeholder="可选，JSON 格式的筛选条件" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="submitCreate">提交任务</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.export-task-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--erp-space-2);
  margin-bottom: var(--erp-space-3);
}

.export-task-toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--erp-space-2);
  margin-left: auto;
}
</style>
