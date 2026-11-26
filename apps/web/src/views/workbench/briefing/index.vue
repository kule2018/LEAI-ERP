<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  confirmBriefingRead, createBriefing, dispatchSubscriptions, fetchBriefingPdf, fetchBriefings,
  fetchSubscriptions, publishBriefing, removeSubscription, saveSubscription,
  type Briefing, type Subscription
} from '@/api/workbench'

const rows = ref<Briefing[]>([])
const total = ref(0)
const loading = ref(false)
const query = reactive({ page: 1, pageSize: 20, type: '' })
const detail = ref<Briefing | null>(null)
const detailVisible = ref(false)

/** 我的订阅 */
const subscriptions = ref<Subscription[]>([])
const subForm = reactive({ resource: 'briefing', frequency: 'DAILY', channel: 'INBOX' })
const dispatching = ref(false)

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchBriefings({ page: query.page, pageSize: query.pageSize, type: query.type || undefined })
    rows.value = result.list ?? result.items ?? []
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载简报失败')
  } finally {
    loading.value = false
  }
}

async function generate(type: 'WEEK' | 'MONTH' | 'DAILY'): Promise<void> {
  try {
    await createBriefing({ type })
    ElMessage.success(type === 'WEEK' ? '经营周报已生成' : type === 'MONTH' ? '经营月报已生成' : '经营日报已生成')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '生成简报失败')
  }
}

async function loadSubscriptions(): Promise<void> {
  try {
    subscriptions.value = await fetchSubscriptions()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '订阅加载失败')
  }
}

async function addSubscription(): Promise<void> {
  try {
    await saveSubscription({ resource: subForm.resource, frequency: subForm.frequency, channel: subForm.channel, enabled: 1 })
    ElMessage.success('订阅已保存')
    await loadSubscriptions()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '订阅保存失败')
  }
}

async function removeSub(row: Subscription): Promise<void> {
  try {
    await removeSubscription(row.id)
    ElMessage.success('订阅已删除')
    await loadSubscriptions()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '订阅删除失败')
  }
}

async function dispatchNow(): Promise<void> {
  dispatching.value = true
  try {
    const result = await dispatchSubscriptions()
    ElMessage.success(`已推送 ${result.pushed} 条，跳过 ${result.skipped} 条`)
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '推送失败')
  } finally {
    dispatching.value = false
  }
}

async function publish(row: Briefing): Promise<void> {
  try {
    await publishBriefing(row.id)
    ElMessage.success('简报已发布，PDF 内容已生成')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '发布失败')
  }
}

async function read(row: Briefing): Promise<void> {
  try {
    await confirmBriefingRead(row.id)
    ElMessage.success('阅读已确认')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '确认失败')
  }
}

function openDetail(row: Briefing): void {
  detail.value = row
  detailVisible.value = true
}

async function exportPdf(row: Briefing): Promise<void> {
  try {
    const html = await fetchBriefingPdf(row.id)
    const win = window.open('', '_blank')
    if (!win) {
      ElMessage.warning('请允许弹出窗口后重试')
      return
    }
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '打开 PDF 失败')
  }
}

onMounted(() => {
  void load()
  void loadSubscriptions()
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>经营简报</h2>
      <p>周报/月报模板、数据快照、AI 摘要标注来源，支持 PDF 推送与阅读确认。</p>
    </header>

    <article class="panel">
      <div class="toolbar">
        <el-button type="primary" v-perm="'workbench:briefing:create'" @click="generate('DAILY')">生成日报</el-button>
        <el-button v-perm="'workbench:briefing:create'" @click="generate('WEEK')">生成周报</el-button>
        <el-button v-perm="'workbench:briefing:create'" @click="generate('MONTH')">生成月报</el-button>
        <el-select v-model="query.type" placeholder="全部类型" clearable style="width: 140px" @change="load">
          <el-option label="日报" value="DAILY" />
          <el-option label="周报" value="WEEK" />
          <el-option label="月报" value="MONTH" />
        </el-select>
      </div>

      <div class="subscription-box">
        <div class="sub-title">我的订阅（按频率自动生成简报并推送）</div>
        <div class="sub-form">
          <el-input v-model="subForm.resource" placeholder="订阅资源" style="width: 160px" />
          <el-select v-model="subForm.frequency" style="width: 120px">
            <el-option label="每日" value="DAILY" />
            <el-option label="每周" value="WEEKLY" />
            <el-option label="每月" value="MONTHLY" />
          </el-select>
          <el-select v-model="subForm.channel" style="width: 130px">
            <el-option label="站内信" value="INBOX" />
            <el-option label="邮件" value="EMAIL" />
          </el-select>
          <el-button type="primary" v-perm="'workbench:subscription:update'" @click="addSubscription">添加订阅</el-button>
          <el-button :loading="dispatching" v-perm="'workbench:subscription:update'" @click="dispatchNow">立即推送</el-button>
        </div>
        <el-table :data="subscriptions" size="small" border>
          <el-table-column prop="resource" label="资源" min-width="140" />
          <el-table-column prop="frequency" label="频率" width="100" />
          <el-table-column prop="channel" label="渠道" width="110" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '启用' : '停用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="90">
            <template #default="{ row }">
              <el-button link type="danger" v-perm="'workbench:subscription:update'" @click="removeSub(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <el-table :data="rows" v-loading="loading" size="small">
        <el-table-column prop="period" label="周期" width="120" />
        <el-table-column prop="title" label="标题" min-width="180" />
        <el-table-column prop="type" label="类型" width="80">
          <template #default="{ row }">{{ row.type === 'WEEK' ? '周报' : row.type === 'DAILY' ? '日报' : '月报' }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'PUBLISHED' ? 'success' : 'info'" size="small">
              {{ row.status === 'PUBLISHED' ? '已发布' : '草稿' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="summary" label="AI 摘要" min-width="240" show-overflow-tooltip />
        <el-table-column label="来源" min-width="160">
          <template #default="{ row }">{{ (row.sourceRefs ?? []).join('、') }}</template>
        </el-table-column>
        <el-table-column label="阅读" width="90">
          <template #default="{ row }">{{ row.readBy?.length ?? 0 }} 人</template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情</el-button>
            <el-button link type="primary" v-perm="'workbench:briefing:publish'" :disabled="row.status === 'PUBLISHED'" @click="publish(row)">发布</el-button>
            <el-button link type="primary" @click="exportPdf(row)">PDF</el-button>
            <el-button link type="success" v-perm="'workbench:briefing:view'" @click="read(row)">确认阅读</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="pagination"
        layout="total, prev, pager, next"
        :total="total"
        v-model:current-page="query.page"
        :page-size="query.pageSize"
        @current-change="load"
      />
    </article>

    <el-dialog v-model="detailVisible" :title="detail?.title ?? '简报详情'" width="70%">
      <template v-if="detail">
        <h4>AI 摘要</h4>
        <pre class="summary">{{ detail.summary }}</pre>
        <h4>数据快照</h4>
        <pre class="snapshot">{{ JSON.stringify(detail.snapshot ?? {}, null, 2) }}</pre>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.subscription-box { margin-bottom: 16px; padding: 12px; border: 1px solid #e5e6eb; border-radius: 6px; background: #fafbfc; }
.sub-title { font-size: 13px; font-weight: 600; margin-bottom: 10px; }
.sub-form { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
.pagination { margin-top: 16px; justify-content: flex-end; }
.summary { white-space: pre-wrap; font-family: inherit; font-size: 13px; line-height: 1.8; }
.snapshot { max-height: 320px; overflow: auto; font-size: 12px; background: #fafafa; padding: 12px; }
h4 { margin: 12px 0 8px; font-size: 14px; }
</style>
