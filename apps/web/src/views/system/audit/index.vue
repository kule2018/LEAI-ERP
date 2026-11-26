<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { fetchAuditLogs, type AuditLog, type AuditQuery } from '@/api/audit'

const logs = ref<AuditLog[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<AuditQuery>({ page: 1, pageSize: 20, keyword: '', bizType: '', action: '' })
const detail = ref<AuditLog | null>(null)
const detailVisible = ref(false)

let requestSeq = 0

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchAuditLogs(query.value)
    if (seq !== requestSeq) return
    logs.value = result.list
    total.value = result.total
  } catch (cause) {
    if (seq === requestSeq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function openDetail(row: unknown): void {
  detail.value = row as AuditLog
  detailVisible.value = true
}

function beforeValue(row: unknown): string {
  return formatValue((row as AuditLog).beforeValue)
}

function afterValue(row: unknown): string {
  return formatValue((row as AuditLog).afterValue)
}

function formatValue(value: string | null): string {
  if (!value) return '—'
  if (value.length <= 120) return value
  return `${value.slice(0, 120)}…`
}

onMounted(load)
onUnmounted(() => {
  requestSeq += 1
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>审计日志</h2>
      <p>只追加日志，覆盖登录、操作、字段变更、导出、打印和 AI 调用。</p>
    </header>

    <article class="audit-panel">
      <div class="filter-bar">
        <el-input v-model="query.keyword" placeholder="操作人" clearable />
        <el-input v-model="query.bizType" placeholder="业务类型" clearable />
        <el-input v-model="query.action" placeholder="动作" clearable />
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="load">刷新</el-button>
      </div>

      <div v-if="error" class="error-banner">{{ error }}</div>

      <el-table v-loading="loading" :data="logs" row-key="id" @row-click="openDetail">
        <el-table-column prop="createdAt" label="时间" width="180" />
        <el-table-column prop="bizType" label="业务类型" width="150" />
        <el-table-column prop="bizId" label="业务ID" width="110" />
        <el-table-column prop="action" label="动作" width="180" />
        <el-table-column prop="operatorName" label="操作人" width="140" />
        <el-table-column label="变更前" min-width="160">
          <template #default="{ row }">{{ beforeValue(row) }}</template>
        </el-table-column>
        <el-table-column label="变更后" min-width="160">
          <template #default="{ row }">{{ afterValue(row) }}</template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          background
          layout="total, prev, pager, next"
          :total="total"
          :current-page="query.page"
          :page-size="query.pageSize"
          @current-change="(value: number) => { query.page = value; void load() }"
        />
      </div>
    </article>

    <el-dialog v-model="detailVisible" :title="`审计详情 #${detail?.id ?? ''}`" width="720px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="业务类型">{{ detail?.bizType }}</el-descriptions-item>
        <el-descriptions-item label="业务ID">{{ detail?.bizId }}</el-descriptions-item>
        <el-descriptions-item label="动作">{{ detail?.action }}</el-descriptions-item>
        <el-descriptions-item label="操作人">{{ detail?.operatorName }}</el-descriptions-item>
      </el-descriptions>
      <h4>变更前</h4>
      <pre>{{ detail?.beforeValue || '—' }}</pre>
      <h4>变更后</h4>
      <pre>{{ detail?.afterValue || '—' }}</pre>
    </el-dialog>
  </section>
</template>

<style scoped>
.audit-panel {
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.error-banner {
  margin-bottom: 16px;
  padding: 12px 16px;
  color: #f5222d;
  background: #fff1f0;
  border-radius: 8px;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

pre {
  max-height: 240px;
  padding: 12px;
  overflow: auto;
  background: #f5f7fa;
  border-radius: 6px;
}
</style>
