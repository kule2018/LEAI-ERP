<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { flushOfflineQueue } from '@/utils/http'
import {
  discardOfflineForm,
  listOfflineForms,
  offlineFormSummary,
  retryOfflineForm
} from '@/utils/offline-form'
import type { QueuedRequest } from '@/utils/offline-queue'

const items = ref<QueuedRequest[]>([])
const summary = ref({ total: 0, pending: 0, conflict: 0, failed: 0 })
const loading = ref(false)

const statusText: Record<string, string> = {
  pending: '待同步',
  conflict: '待核对',
  failed: '提交失败'
}

const statusTag: Record<string, 'warning' | 'danger' | 'info'> = {
  pending: 'warning',
  conflict: 'danger',
  failed: 'info'
}

const empty = computed(() => items.value.length === 0)

function formatTime(value: number): string {
  return new Date(value).toLocaleString()
}

async function refresh(): Promise<void> {
  loading.value = true
  try {
    items.value = listOfflineForms()
    summary.value = offlineFormSummary()
  } finally {
    loading.value = false
  }
}

async function syncAll(): Promise<void> {
  loading.value = true
  try {
    const result = await flushOfflineQueue()
    await refresh()
    if (result.conflicted > 0) {
      ElMessage.warning(`同步完成，${result.conflicted} 条需要人工核对`)
    } else {
      ElMessage.success(`同步完成，成功 ${result.replayed} 条`)
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '同步失败')
  } finally {
    loading.value = false
  }
}

async function retry(row: QueuedRequest): Promise<void> {
  const status = await retryOfflineForm(row.idempotencyKey)
  await refresh()
  if (status === 'success') ElMessage.success('已同步成功')
  else if (status === 'conflict') ElMessage.warning('该表单疑似已提交，请到对应单据核对')
  else ElMessage.error('同步仍未成功，请检查网络或表单内容')
}

async function discard(row: QueuedRequest): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `放弃后该表单不会补录到系统，请确认单据已线下处理或确认未生成。确认放弃「${row.label}」？`,
      '放弃暂存表单',
      { type: 'warning' }
    )
  } catch { return }
  discardOfflineForm(row.idempotencyKey)
  ElMessage.success('已放弃该暂存表单')
  await refresh()
}

onMounted(refresh)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>待同步表单</h2>
      <p>断网期间的现场单据（POS 收银、扫码盘点、波次拣货、采购收货）暂存在本机，恢复网络后按同一幂等键补录；冲突项需人工核对，避免重复建单。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-button @click="refresh">刷新</el-button>
        <el-button type="primary" :loading="loading" @click="syncAll">立即同步</el-button>
      </div>

      <div class="metric-grid">
        <article class="metric-card"><span>暂存总数</span><strong>{{ summary.total }}</strong></article>
        <article class="metric-card"><span>待同步</span><strong>{{ summary.pending }}</strong></article>
        <article class="metric-card"><span>待核对</span><strong>{{ summary.conflict }}</strong></article>
        <article class="metric-card"><span>提交失败</span><strong>{{ summary.failed }}</strong></article>
      </div>

      <el-empty v-if="empty" description="暂无待同步表单" />
      <el-table v-else :data="items" row-key="id" size="small" v-loading="loading">
        <el-table-column prop="formType" label="表单类型" width="120" />
        <el-table-column prop="label" label="表单说明" min-width="240" />
        <el-table-column prop="localNo" label="本地单号" width="200" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTag[row.status] ?? 'info'">{{ statusText[row.status] ?? row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="attempts" label="重试次数" width="90" />
        <el-table-column prop="lastError" label="最近失败原因" min-width="220" />
        <el-table-column label="暂存时间" width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button link type="primary" @click="retry(row)">重试</el-button>
            <el-button link type="danger" @click="discard(row)">放弃</el-button>
          </template>
        </el-table-column>
      </el-table>
    </article>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.metric-card { padding: 14px; background: #f7f8fa; border-radius: 8px; }
.metric-card span { display: block; color: #646a73; font-size: 12px; }
.metric-card strong { display: block; margin-top: 6px; font-size: 18px; }
</style>
