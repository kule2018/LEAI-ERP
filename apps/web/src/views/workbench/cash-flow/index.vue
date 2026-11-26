<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import { ElMessage } from 'element-plus'
import { fetchCashFlow, type CashFlowResult } from '@/api/workbench'

const scenario = ref('BASE')
const data = ref<CashFlowResult | null>(null)
const loading = ref(false)
const chartElement = ref<HTMLDivElement | null>(null)
let chart: ECharts | null = null

function money(value: number): string {
  return `¥ ${Number(value ?? 0).toFixed(2)}`
}

function handleResize(): void {
  chart?.resize()
}

function renderChart(): void {
  if (!chart) return
  const rows = data.value?.projected ?? []
  chart.setOption({
    grid: { left: 56, right: 56, top: 40, bottom: 32 },
    tooltip: { trigger: 'axis' },
    legend: { data: ['流入', '流出', '净额', '累计'] },
    xAxis: { type: 'category', data: rows.map((item) => `W${item.week}`) },
    yAxis: [
      { type: 'value', name: '金额' },
      { type: 'value', name: '累计' }
    ],
    series: [
      { name: '流入', type: 'bar', data: rows.map((item) => item.inflow) },
      { name: '流出', type: 'bar', data: rows.map((item) => item.outflow) },
      { name: '净额', type: 'line', smooth: true, data: rows.map((item) => item.net) },
      { name: '累计', type: 'line', yAxisIndex: 1, smooth: true, data: rows.map((item) => item.cumulative) }
    ]
  })
}

async function load(): Promise<void> {
  loading.value = true
  try {
    data.value = await fetchCashFlow(scenario.value)
    await nextTick()
    if (chartElement.value) {
      chart ??= echarts.init(chartElement.value)
      renderChart()
    }
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载现金流预测失败')
  } finally {
    loading.value = false
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
      <h2>资金收支趋势</h2>
      <p>基于未结应收应付到期日的 13 周滚动预测，支持情景模拟与资金缺口预警。</p>
    </header>

    <div class="toolbar">
      <el-radio-group v-model="scenario" @change="load">
        <el-radio-button value="BASE">基准</el-radio-button>
        <el-radio-button value="OPTIMISTIC">乐观</el-radio-button>
        <el-radio-button value="PESSIMISTIC">悲观</el-radio-button>
      </el-radio-group>
      <el-alert
        v-if="data?.projectedGaps?.length"
        :title="`资金缺口预警：第 ${data.projectedGaps.join('、')} 周累计现金流为负`"
        type="warning"
        show-icon
        class="gap-alert"
      />
      <el-alert v-else title="未来 13 周无资金缺口" type="success" show-icon class="gap-alert" />
    </div>

    <article class="panel">
      <h3>滚动现金流预测</h3>
      <div ref="chartElement" class="chart-element"></div>
    </article>

    <article class="panel">
      <h3>13 周日历视图</h3>
      <div class="week-grid">
        <article
          v-for="row in data?.projected ?? []"
          :key="row.week"
          class="week-cell"
          :class="{ gap: data?.projectedGaps?.includes(row.week) }"
        >
          <strong>第 {{ row.week }} 周</strong>
          <span>流入 {{ money(row.inflow) }}</span>
          <span>流出 {{ money(row.outflow) }}</span>
          <span>净额 {{ money(row.net) }}</span>
          <span>累计 {{ money(row.cumulative) }}</span>
        </article>
      </div>
    </article>

    <article class="panel">
      <h3>预测假设</h3>
      <ul>
        <li v-for="item in data?.assumptions ?? []" :key="item">{{ item }}</li>
      </ul>
    </article>
  </section>
</template>

<style scoped>
.toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 16px; }
.gap-alert { flex: 1; min-width: 280px; }
.panel { padding: 16px; background: #fff; border-radius: 8px; margin-bottom: 16px; }
.panel h3 { margin: 0 0 12px; font-size: 16px; }
.chart-element { width: 100%; height: 320px; }
.week-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
.week-cell { display: flex; flex-direction: column; gap: 4px; padding: 10px; border: 1px solid #e8e8e8; border-radius: 6px; font-size: 12px; }
.week-cell.gap { border-color: #f5222d; background: #fff1f0; }
.week-cell strong { font-size: 13px; margin-bottom: 4px; }
.panel ul { margin: 0; padding-left: 20px; color: #595959; font-size: 13px; line-height: 1.9; }
@media (max-width: 960px) { .week-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
</style>
