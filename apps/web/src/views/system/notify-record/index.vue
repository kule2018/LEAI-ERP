<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchNotifySendRecords, retryNotify, type NotifySendRecord, type NotifySendRecordQuery } from '@/api/notify'

const rows = ref<NotifySendRecord[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<NotifySendRecordQuery>({
  page: 1,
  pageSize: 20,
  keyword: '',
  sendStatus: '',
  channel: '',
  templateCode: ''
})

const channelOptions = [
  { label: '站内信', value: 'INMAIL' },
  { label: '邮件', value: 'EMAIL' },
  { label: '短信', value: 'SMS' },
  { label: '企业微信', value: 'WECOM' },
  { label: '钉钉', value: 'DINGTALK' }
]

const statusOptions = [
  { label: '成功', value: 'SUCCESS' },
  { label: '待投递', value: 'PENDING' },
  { label: '失败', value: 'FAILED' }
]

function statusType(status: string): 'success' | 'warning' | 'danger' {
  if (status === 'SUCCESS') return 'success'
  if (status === 'PENDING') return 'warning'
  return 'danger'
}

function statusLabel(status: string): string {
  return statusOptions.find((item) => item.value === status)?.label ?? status
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const result = await fetchNotifySendRecords({
      page: query.value.page,
      pageSize: query.value.pageSize,
      keyword: query.value.keyword || undefined,
      sendStatus: query.value.sendStatus || undefined,
      channel: query.value.channel || undefined,
      templateCode: query.value.templateCode || undefined
    })
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    loading.value = false
  }
}

async function handleRetry(row: NotifySendRecord): Promise<void> {
  try {
    await retryNotify(row.id)
    ElMessage.success('已重新投递')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '重试失败')
  }
}

async function retryAllFailed(): Promise<void> {
  const failed = rows.value.filter((row) => row.sendStatus === 'FAILED')
  if (!failed.length) {
    ElMessage.warning('当前页没有失败的发送记录')
    return
  }
  for (const row of failed) {
    await handleRetry(row)
  }
}

function handleQuery(): void {
  query.value.page = 1
  void load()
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>通知发送记录</h2>
      <p>记录通知模板触发的每次投递：渠道、状态、重试次数与失败原因；失败记录可发起重试。</p>
    </header>

    <article class="record-panel">
      <div class="filter-bar">
        <el-input v-model="query.keyword" placeholder="搜索标题" clearable style="width: 200px" @keyup.enter="handleQuery" />
        <el-select v-model="query.channel" placeholder="渠道" clearable style="width: 140px">
          <el-option v-for="option in channelOptions" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
        <el-select v-model="query.sendStatus" placeholder="发送状态" clearable style="width: 140px">
          <el-option v-for="option in statusOptions" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
        <el-input v-model="query.templateCode" placeholder="来源模板编码" clearable style="width: 180px" />
        <el-button type="primary" @click="handleQuery">查询</el-button>
        <el-button v-perm="'system:notify:update'" @click="retryAllFailed">重试全部失败</el-button>
      </div>

      <div v-if="error" class="error-banner">{{ error }}</div>

      <el-table v-loading="loading" :data="rows" row-key="id" border stripe>
        <el-table-column prop="notifyNo" label="通知单号" width="200" />
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="channel" label="渠道" width="110" />
        <el-table-column prop="templateCode" label="来源模板" width="150" />
        <el-table-column prop="targetAddress" label="投递地址" width="180" />
        <el-table-column label="发送状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusType(row.sendStatus)">{{ statusLabel(row.sendStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="retryCount" label="重试次数" width="100" />
        <el-table-column prop="lastError" label="失败原因" min-width="200" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column label="操作" width="100" align="center">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'system:notify:update'" @click="handleRetry(row)">重试</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next"
          :total="total"
          :current-page="query.page"
          :page-size="query.pageSize"
          :page-sizes="[20, 50, 100]"
          @current-change="(value: number) => { query.page = value; void load() }"
          @size-change="(value: number) => { query.pageSize = value; void load() }"
        />
      </div>
    </article>
  </section>
</template>

<style scoped>
.record-panel {
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
