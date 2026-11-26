<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchHealth, fetchMetrics, type HealthResult, type MetricsResult } from '@/api/ops'

const health = ref<HealthResult | null>(null)
const metrics = ref<MetricsResult | null>(null)
const loading = ref(false)

async function load(): Promise<void> {
  loading.value = true
  try {
    const [healthResult, metricsResult] = await Promise.all([fetchHealth(), fetchMetrics()])
    health.value = healthResult
    metrics.value = metricsResult
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载监控数据失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>系统监控</h2>
      <p>健康检查数据库与 Redis 连通性，指标展示请求量、错误数和进程资源占用。</p>
    </header>

    <div class="metric-grid">
      <article class="metric-card"><span>系统状态</span><strong>{{ health?.status ?? '-' }}</strong></article>
      <article class="metric-card"><span>数据库</span><strong>{{ health?.database ?? '-' }}</strong></article>
      <article class="metric-card"><span>Redis</span><strong>{{ health?.redis ?? '-' }}</strong></article>
      <article class="metric-card"><span>请求总数</span><strong>{{ metrics?.requests.total ?? 0 }}</strong></article>
      <article class="metric-card"><span>错误请求</span><strong>{{ metrics?.requests.errors ?? 0 }}</strong></article>
      <article class="metric-card"><span>运行时间</span><strong>{{ metrics?.uptimeSeconds ?? 0 }}s</strong></article>
      <article class="metric-card"><span>堆内存</span><strong>{{ metrics?.process.memoryHeapMb ?? 0 }} MB</strong></article>
      <article class="metric-card"><span>Node 版本</span><strong>{{ metrics?.process.nodeVersion ?? '-' }}</strong></article>
    </div>

    <article class="panel">
      <div class="panel-toolbar">
        <el-button type="primary" :loading="loading" @click="load">刷新</el-button>
        <span class="check-time">检查时间：{{ health?.checkedAt ?? '-' }}</span>
      </div>
      <el-row :gutter="16">
        <el-col :span="12">
          <h3>方法分布</h3>
          <pre class="json">{{ JSON.stringify(metrics?.requests.byMethod ?? {}, null, 2) }}</pre>
        </el-col>
        <el-col :span="12">
          <h3>状态分布</h3>
          <pre class="json">{{ JSON.stringify(metrics?.requests.byStatus ?? {}, null, 2) }}</pre>
        </el-col>
      </el-row>
    </article>
  </section>
</template>

<style scoped>
.metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.metric-card { padding: 16px; background: #fff; border-radius: 8px; }
.metric-card span { display: block; color: #646a73; font-size: 13px; }
.metric-card strong { display: block; margin-top: 8px; font-size: 20px; }
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
.check-time { color: #646a73; font-size: 12px; }
.json { max-height: 280px; padding: 12px; overflow: auto; background: #f7f8fa; border-radius: 6px; font-size: 12px; }
</style>
