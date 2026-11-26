<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import { fetchSalesSummary, type SalesSummary } from '@/api/sales'

const summary = ref<SalesSummary | null>(null)
const customerChart = ref<HTMLDivElement | null>(null)
const monthChart = ref<HTMLDivElement | null>(null)
let chartA: ECharts | null = null
let chartB: ECharts | null = null

function handleResize(): void {
  chartA?.resize()
  chartB?.resize()
}

async function load(): Promise<void> {
  try {
    summary.value = await fetchSalesSummary()
    await nextTick()
    if (customerChart.value) {
      chartA = echarts.init(customerChart.value)
      chartA.setOption({
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: summary.value?.byCustomer.map((item) => item.name) ?? [] },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', data: summary.value?.byCustomer.map((item) => Number(item.amount)) ?? [] }]
      })
    }
    if (monthChart.value) {
      chartB = echarts.init(monthChart.value)
      chartB.setOption({
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: summary.value?.byMonth.map((item) => item.month) ?? [] },
        yAxis: { type: 'value' },
        series: [{ type: 'line', smooth: true, data: summary.value?.byMonth.map((item) => Number(item.amount)) ?? [] }]
      })
    }
  } catch {
    summary.value = null
  }
}

onMounted(load)
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chartA?.dispose()
  chartB?.dispose()
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>销售报表</h2>
      <p>订单、客户、产品和月度趋势统计，数据来自已审核销售单及其明细。</p>
    </header>
    <div class="kpi-grid">
      <article class="kpi-card"><span>有效订单数</span><strong>{{ summary?.orderCount ?? 0 }}</strong></article>
      <article class="kpi-card"><span>销售总额</span><strong>¥ {{ summary?.totalAmount ?? '0.0000' }}</strong></article>
      <article class="kpi-card"><span>客户数</span><strong>{{ summary?.byCustomer.length ?? 0 }}</strong></article>
      <article class="kpi-card"><span>产品数</span><strong>{{ summary?.byProduct.length ?? 0 }}</strong></article>
    </div>
    <div class="chart-grid">
      <article class="chart-card"><h3>客户贡献</h3><div ref="customerChart" class="chart"></div></article>
      <article class="chart-card"><h3>月度趋势</h3><div ref="monthChart" class="chart"></div></article>
    </div>
  </section>
</template>

<style scoped>
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }
.kpi-card { padding: 16px; background: #fff; border-radius: 8px; }
.kpi-card span { display: block; margin-bottom: 8px; color: #646a73; }
.kpi-card strong { font-size: 22px; }
.chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.chart-card { padding: 16px; background: #fff; border-radius: 8px; }
.chart-card h3 { margin: 0 0 12px; }
.chart { height: 320px; }
@media (max-width: 1000px) { .kpi-grid, .chart-grid { grid-template-columns: 1fr; } }
</style>
