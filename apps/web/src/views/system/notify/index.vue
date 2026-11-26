<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createNotification, fetchNotifications, markNotificationRead, type Notification, type NotificationQuery } from '@/api/notify'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()
const rows = ref<Notification[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<NotificationQuery>({ page: 1, pageSize: 20, keyword: '', readFlag: '', channel: '' })
const dialogVisible = ref(false)
const form = reactive({ title: '', content: '', channel: 'INMAIL', receiverId: 0 })
const channelOptions = [
  { label: '站内信', value: 'INMAIL' },
  { label: '邮件', value: 'EMAIL' },
  { label: '短信', value: 'SMS' },
  { label: '企业微信', value: 'WECOM' },
  { label: '钉钉', value: 'DINGTALK' }
]

let requestSeq = 0

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchNotifications(query.value)
    if (seq !== requestSeq) return
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    if (seq === requestSeq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function openCreate(): void {
  form.title = ''
  form.content = ''
  form.channel = 'INMAIL'
  form.receiverId = userStore.profile?.id ?? 0
  dialogVisible.value = true
}

async function handleCreate(): Promise<void> {
  try {
    await createNotification({
      title: form.title,
      content: form.content,
      channel: form.channel,
      receiverId: form.receiverId
    })
    dialogVisible.value = false
    ElMessage.success('通知已创建')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '创建失败')
  }
}

function isRead(row: unknown): boolean {
  return (row as Notification).readFlag === 'YES'
}

function statusLabel(row: unknown): string {
  return isRead(row) ? '已读' : '未读'
}

async function handleRead(row: unknown): Promise<void> {
  const notification = row as Notification
  if (notification.readFlag === 'YES') return
  try {
    await markNotificationRead(notification.id)
    ElMessage.success('已标记为已读')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '操作失败')
  }
}

async function handleQuery(): Promise<void> {
  query.value.page = 1
  await load()
}

onMounted(load)
onUnmounted(() => {
  requestSeq += 1
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>通知中心</h2>
      <p>站内信、邮件、短信、企业微信和钉钉消息入口；当前页面只展示当前登录人的通知。</p>
    </header>

    <article class="notify-panel">
      <div class="filter-bar">
        <el-input v-model="query.keyword" placeholder="搜索标题" clearable @keyup.enter="handleQuery" />
        <el-select v-model="query.readFlag" placeholder="阅读状态" clearable style="width: 140px">
          <el-option label="未读" value="NO" />
          <el-option label="已读" value="YES" />
        </el-select>
        <el-select v-model="query.channel" placeholder="通道" clearable style="width: 160px">
          <el-option v-for="option in channelOptions" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
        <el-button type="primary" @click="handleQuery">查询</el-button>
        <el-button v-perm="'system:notify:create'" @click="openCreate">新建通知</el-button>
      </div>

      <div v-if="error" class="error-banner">{{ error }}</div>

      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="notifyNo" label="通知单号" width="200" />
        <el-table-column prop="title" label="标题" min-width="180" />
        <el-table-column prop="channel" label="通道" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="isRead(row) ? 'info' : 'success'">{{ statusLabel(row) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="时间" width="180" />
        <el-table-column label="操作" width="100" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleRead(row)">标记已读</el-button>
          </template>
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

    <el-dialog v-model="dialogVisible" title="新建通知" width="560px">
      <el-form label-width="90px">
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="内容"><el-input v-model="form.content" type="textarea" :rows="4" /></el-form-item>
        <el-form-item label="通道">
          <el-select v-model="form.channel">
            <el-option v-for="option in channelOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="接收人"><el-input-number v-model="form.receiverId" :min="1" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCreate">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.notify-panel {
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
