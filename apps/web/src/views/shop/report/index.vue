<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { reportInsight, type AiExecution } from '@/api/ai'
import { fetchShopLogs, fetchShopReport, type ShopLog, type ShopReport } from '@/api/shop'
import type { PageQuery } from '@/types/contract'

const report = ref<ShopReport | null>(null)
const logs = ref<ShopLog[]>([])
const total = ref(0)
const loading = ref(false)
const insight = ref('')
const query = reactive<PageQuery>({ page: 1, pageSize: 20, keyword: '' })

async function load(): Promise<void> {
  loading.value = true
  try {
    const [reportResult, logResult] = await Promise.all([fetchShopReport(), fetchShopLogs(query)])
    report.value = reportResult
    logs.value = logResult.list
    total.value = logResult.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载渠道报表失败')
  } finally {
    loading.value = false
  }
}

async function explain(): Promise<void> {
  if (!report.value) return
  try {
    const result: AiExecution<Record<string, unknown>> = await reportInsight({
      reportType: 'SHOP_CHANNEL',
      metrics: {
        revenue: report.value.orderAmount,
        storeCount: report.value.storeCount,
        orderCount: report.value.orderCount,
        syncedCount: report.value.syncedCount,
        shippedCount: report.value.shippedCount
      }
    })
    const diagnoses = result.result.diagnoses
    insight.value = Array.isArray(diagnoses) ? diagnoses.join('\n') : '未生成解读'
    ElMessage.success('AI 解读已生成')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '解读失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>渠道报表</h2>
      <p>汇总店铺、订单、同步与发货数据，并可生成带数据快照的 AI 解读。</p>
    </header>

    <div class="metric-grid">
      <article class="metric-card"><span>店铺数</span><strong>{{ report?.storeCount ?? 0 }}</strong></article>
      <article class="metric-card"><span>订单数</span><strong>{{ report?.orderCount ?? 0 }}</strong></article>
      <article class="metric-card"><span>已同步</span><strong>{{ report?.syncedCount ?? 0 }}</strong></article>
      <article class="metric-card"><span>已发货</span><strong>{{ report?.shippedCount ?? 0 }}</strong></article>
      <article class="metric-card"><span>订单金额</span><strong>{{ report?.orderAmount ?? '0.0000' }}</strong></article>
    </div>

    <article class="panel">
      <div class="panel-toolbar">
        <el-button type="primary" v-perm="'ai:report'" @click="explain">AI 解读</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-alert v-if="insight" :closable="false" type="info" :title="insight" class="insight" />
      <el-table v-loading="loading" :data="logs" row-key="id">
        <el-table-column prop="storeId" label="店铺 ID" width="100" />
        <el-table-column prop="bizType" label="业务类型" width="130" />
        <el-table-column prop="bizId" label="业务 ID" width="110" />
        <el-table-column prop="idempotentKey" label="幂等键" min-width="200" />
        <el-table-column prop="result" label="结果" width="110" />
        <el-table-column prop="errorText" label="错误" min-width="200" />
        <el-table-column prop="createdAt" label="时间" min-width="170" />
      </el-table>
      <div class="pagination">
        <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
      </div>
    </article>
  </section>
</template>

<style scoped>
.metric-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 16px; }
.metric-card { padding: 16px; background: #fff; border-radius: 8px; }
.metric-card span { display: block; color: #646a73; font-size: 13px; }
.metric-card strong { display: block; margin-top: 8px; font-size: 22px; }
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
.insight { margin-bottom: 16px; white-space: pre-wrap; }
</style>
