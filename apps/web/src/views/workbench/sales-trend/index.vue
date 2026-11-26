<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import { ElMessage } from 'element-plus'
import { fetchSalesTrend, saveSubscription, type SalesTrend } from '@/api/workbench'

const year = ref(new Date().getFullYear())
const data = ref<SalesTrend | null>(null)
const loading = ref(false)
const contributionTab = ref<'customer' | 'product'>('customer')
const chartElement = ref<HTMLDivElement | null>(null)
let chart: ECharts | null = null

function money(value: number): string {
  return `¥ ${Number(value ?? 0).toFixed(2)}`
}

function formatAmount(row: { amount: number }): string {
  return money(row.amount)
}

function handleResize(): void {
  chart?.resize()
}

function renderChart(): void {
  if (!chart) return
  const points = data.value?.trend ?? []
  chart.setOption({
    grid: { left: 56, right: 24, top: 40, bottom: 32 },
    tooltip: { trigger: 'axis' },
    legend: { data: ['销售额', '毛利', '同比'] },
    xAxis: { type: 'category', data: points.map((item) => item.period) },
    yAxis: [
      { type: 'value', name: '金额' },
      { type: 'value', name: '同比%', axisLabel: { formatter: '{value}%' } }
    ],
    series: [
      { name: '销售额', type: 'bar', data: points.map((item) => item.amount) },
      { name: '毛利', type: 'bar', data: points.map((item) => item.grossProfit) },
      { name: '同比', type: 'line', yAxisIndex: 1, smooth: true, data: points.map((item) => item.yoy) }
    ]
  })
}

async function load(): Promise<void> {
  loading.value = true
  try {
    data.value = await fetchSalesTrend(year.value)
    await nextTick()
    if (chartElement.value) {
      chart ??= echarts.init(chartElement.value)
      renderChart()
    }
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载销售趋势失败')
  } finally {
    loading.value = false
  }
}

async function subscribe(): Promise<void> {
  try {
    await saveSubscription({ resource: 'SALES_TREND', frequency: 'DAILY', channel: 'INBOX' })
    ElMessage.success('已订阅销售趋势日报')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '订阅失败')
  }
}

onMounted(async () => {
  await load()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
  chart = null
})
</script>

<template>
  <section class="page-container" v-loading="loading">
    <header class="page-header">
      <h2>销售趋势</h2>
      <p>同环比、毛利拆解、客户/产品贡献度与业务员排行；毛利按当前用户数据权限脱敏。</p>
    </header>

    <div class="toolbar">
      <el-select v-model="year" style="width: 120px" @change="load">
        <el-option v-for="item in [year - 1, year, year + 1]" :key="item" :label="`${item} 年`" :value="item" />
      </el-select>
      <el-button v-perm="'dashboard:view'" @click="subscribe">订阅日报</el-button>
    </div>

    <div class="stat-grid">
      <article class="stat-card"><span>销售总额</span><strong>{{ money(data?.totalAmount ?? 0) }}</strong></article>
      <article class="stat-card"><span>同比增长</span><strong :class="(data?.yoy ?? 0) >= 0 ? 'up' : 'down'">{{ (data?.yoy ?? 0) >= 0 ? '+' : '' }}{{ data?.yoy ?? 0 }}%</strong></article>
      <article class="stat-card"><span>毛利</span><strong>{{ money(data?.grossProfit ?? 0) }}</strong></article>
      <article class="stat-card"><span>毛利率</span><strong>{{ data?.margin ?? 0 }}%</strong></article>
    </div>

    <article class="panel">
      <h3>月度趋势与毛利拆解</h3>
      <div ref="chartElement" class="chart-element"></div>
    </article>

    <div class="split">
      <article class="panel">
        <div class="panel-head">
          <h3>贡献度</h3>
          <el-radio-group v-model="contributionTab" size="small">
            <el-radio-button value="customer">客户</el-radio-button>
            <el-radio-button value="product">产品</el-radio-button>
          </el-radio-group>
        </div>
        <el-table :data="data?.contribution?.[contributionTab] ?? []" size="small" max-height="360">
          <el-table-column prop="name" label="名称" />
          <el-table-column prop="amount" label="金额" :formatter="formatAmount" />
          <el-table-column prop="share" label="占比%">
            <template #default="{ row }"><el-progress :percentage="row.share" /></template>
          </el-table-column>
        </el-table>
      </article>
      <article class="panel">
        <h3>业务员排行</h3>
        <el-table :data="data?.salesRanking ?? []" size="small" max-height="360">
          <el-table-column prop="rank" label="名次" width="70" />
          <el-table-column prop="name" label="业务员" />
          <el-table-column prop="amount" label="销售额" :formatter="formatAmount" />
        </el-table>
      </article>
    </div>
  </section>
</template>

<style scoped>
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; margin-bottom: 16px; }
.stat-card { padding: 16px; background: #fff; border-radius: 8px; }
.stat-card span { display: block; color: #8c8c8c; font-size: 12px; }
.stat-card strong { display: block; margin-top: 6px; font-size: 20px; }
.up { color: #52c41a; }
.down { color: #f5222d; }
.panel { padding: 16px; background: #fff; border-radius: 8px; margin-bottom: 16px; }
.panel h3, .panel-head h3 { margin: 0 0 12px; font-size: 16px; }
.panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.chart-element { width: 100%; height: 320px; }
.split { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
@media (max-width: 960px) { .split { grid-template-columns: 1fr; } }
</style>
