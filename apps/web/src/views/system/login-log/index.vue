<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { fetchLoginLogs, type LoginLog, type LoginLogQuery } from '@/api/system-config'

const logs = ref<LoginLog[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<LoginLogQuery>({ page: 1, pageSize: 20, username: '', loginResult: '' })
const dateRange = ref<string[]>([])

let requestSeq = 0

function search(): void {
  query.value.page = 1
  query.value.startDate = dateRange.value[0]
  query.value.endDate = dateRange.value[1]
  void load()
}

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchLoginLogs(query.value)
    if (seq !== requestSeq) return
    logs.value = result.list
    total.value = result.total
  } catch (cause) {
    if (seq === requestSeq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function reset(): void {
  dateRange.value = []
  query.value = { page: 1, pageSize: 20, username: '', loginResult: '' }
  void load()
}

function resultText(value: string): string {
  if (value === 'SUCCESS') return '成功'
  if (value === 'LOCKED') return '锁定'
  return '失败'
}

function resultTag(value: string): 'success' | 'danger' | 'warning' {
  if (value === 'SUCCESS') return 'success'
  if (value === 'LOCKED') return 'warning'
  return 'danger'
}

onMounted(load)
onUnmounted(() => {
  requestSeq += 1
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>登录日志</h2>
      <p>记录登录成功、失败与锁定，含来源 IP、终端 UA 与失败原因。</p>
    </header>

    <article class="log-panel">
      <div class="filter-bar">
        <el-input v-model="query.username" placeholder="用户名" clearable />
        <el-select v-model="query.loginResult" placeholder="结果" clearable style="width: 140px">
          <el-option label="成功" value="SUCCESS" />
          <el-option label="失败" value="FAIL" />
          <el-option label="锁定" value="LOCKED" />
        </el-select>
        <el-date-picker v-model="dateRange" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" />
        <el-button type="primary" @click="search">查询</el-button>
        <el-button @click="reset">重置</el-button>
      </div>

      <div v-if="error" class="error-banner">{{ error }}</div>

      <el-table v-loading="loading" :data="logs" row-key="id">
        <el-table-column prop="loginAt" label="时间" width="180" />
        <el-table-column prop="username" label="用户名" width="140" />
        <el-table-column label="结果" width="100">
          <template #default="{ row }">
            <el-tag :type="resultTag(row.loginResult)">{{ resultText(row.loginResult) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="loginIp" label="来源 IP" width="140" />
        <el-table-column prop="failReason" label="失败原因" min-width="180" />
        <el-table-column prop="userAgent" label="终端" min-width="220" show-overflow-tooltip />
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
  </section>
</template>

<style scoped>
.log-panel {
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
</style>
