<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import type { MenuItem } from '@/types/contract'
import {
  drillKpi, fetchOverview, fetchSalesTrend,
  type DrillResult, type Overview, type SalesTrend, type WorkbenchKpi
} from '@/api/workbench'

const userStore = useUserStore()
const router = useRouter()
const loading = ref(false)

interface Shortcut { path: string; title: string; icon?: string }
const SHORTCUT_KEY = 'leaierp_dashboard_shortcuts'
const shortcutEditing = ref(false)
const newShortcutPath = ref('')
const shortcuts = ref<Shortcut[]>([])
const flatMenus = computed<MenuItem[]>(() => {
  const result: MenuItem[] = []
  const walk = (items: MenuItem[]) => {
    for (const item of items) {
      if (item.path && !item.hidden) result.push(item)
      walk(item.children ?? [])
    }
  }
  walk(userStore.menus ?? [])
  return result
})
function loadShortcuts(): void {
  try { shortcuts.value = JSON.parse(localStorage.getItem(SHORTCUT_KEY) ?? '[]') as Shortcut[] }
  catch { shortcuts.value = [] }
}
function saveShortcuts(): void {
  localStorage.setItem(SHORTCUT_KEY, JSON.stringify(shortcuts.value))
}
function goShortcut(item: Shortcut): void {
  if (shortcutEditing.value) return
  void router.push(item.path)
}
function addShortcut(path: string): void {
  const menu = flatMenus.value.find((item) => item.path === path)
  if (!menu || shortcuts.value.some((item) => item.path === path)) return
  shortcuts.value.push({ path, title: menu.title, icon: menu.icon || undefined })
  saveShortcuts()
  newShortcutPath.value = ''
}
function removeShortcut(path: string): void {
  shortcuts.value = shortcuts.value.filter((item) => item.path !== path)
  saveShortcuts()
}
const overview = ref<Overview | null>(null)
const trend = ref<SalesTrend | null>(null)
const chartElement = ref<HTMLDivElement | null>(null)
const drawerVisible = ref(false)
const drillResult = ref<DrillResult | null>(null)
const drillLoading = ref(false)
let chart: ECharts | null = null

const drillColumns = computed(() => {
  const rows = drillResult.value?.rows ?? []
  return rows.length ? Object.keys(rows[0]) : []
})

function money(value: string | number | undefined): string {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? `¥ ${parsed.toFixed(2)}` : '¥ 0.00'
}

function formatKpi(kpi: WorkbenchKpi): string {
  const numeric = Number(kpi.value)
  if (!Number.isFinite(numeric)) return kpi.value
  return ['SALES', 'PURCHASE', 'AR', 'AP'].includes(kpi.source) ? money(numeric) : String(numeric)
}

function kpiColor(source: string): string {
  const colors: Record<string, string> = {
    SALES: '#1677ff', PURCHASE: '#52c41a', AR: '#36cfc9', AP: '#9254de', RISK: '#fa8c16', TODO: '#f5222d'
  }
  return colors[source] ?? '#1677ff'
}

function severityType(severity: string): 'danger' | 'warning' | 'info' {
  if (severity === 'HIGH' || severity === 'CRITICAL') return 'danger'
  return severity === 'MEDIUM' ? 'warning' : 'info'
}

function handleResize(): void {
  chart?.resize()
}

function renderChart(): void {
  if (!chart) return
  const points = trend.value?.trend ?? []
  chart.setOption({
    grid: { left: 56, right: 24, top: 40, bottom: 32 },
    tooltip: { trigger: 'axis' },
    legend: { data: ['销售额', '毛利'] },
    xAxis: { type: 'category', data: points.map((item) => item.period) },
    yAxis: { type: 'value' },
    series: [
      { name: '销售额', type: 'line', smooth: true, areaStyle: { opacity: 0.12 }, data: points.map((item) => item.amount) },
      { name: '毛利', type: 'line', smooth: true, data: points.map((item) => item.grossProfit) }
    ]
  })
}

async function openDrill(code: string): Promise<void> {
  drawerVisible.value = true
  drillLoading.value = true
  try {
    drillResult.value = await drillKpi(code)
  } catch (cause) {
    drillResult.value = null
    ElMessage.error(cause instanceof Error ? cause.message : '下钻失败')
  } finally {
    drillLoading.value = false
  }
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const [overviewResult, trendResult] = await Promise.allSettled([fetchOverview(), fetchSalesTrend()])
    if (overviewResult.status === 'fulfilled') overview.value = overviewResult.value
    if (trendResult.status === 'fulfilled') trend.value = trendResult.value
    await nextTick()
    if (chartElement.value) {
      chart ??= echarts.init(chartElement.value)
      renderChart()
    }
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  loadShortcuts()
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
      <h2>工作台</h2>
      <p>欢迎回来，{{ userStore.profile?.realName ?? userStore.profile?.username ?? '用户' }}。KPI 按角色配置，点击卡片可下钻到明细。</p>
    </header>

    <article class="panel shortcuts-panel">
      <div class="panel-head">
        <h3>常用功能</h3>
        <el-button link type="primary" @click="shortcutEditing = !shortcutEditing">
          {{ shortcutEditing ? '完成' : '编辑' }}
        </el-button>
      </div>
      <div class="shortcut-grid">
        <div v-for="item in shortcuts" :key="item.path" class="shortcut-item" @click="goShortcut(item)">
          <el-icon><component :is="item.icon || 'Star'" /></el-icon>
          <span>{{ item.title }}</span>
          <el-button v-if="shortcutEditing" link type="danger" @click.stop="removeShortcut(item.path)">移除</el-button>
        </div>
        <el-select v-if="shortcutEditing" v-model="newShortcutPath" filterable placeholder="添加常用功能" style="width: 240px" @change="addShortcut">
          <el-option v-for="menu in flatMenus" :key="menu.path" :label="menu.title" :value="menu.path" />
        </el-select>
      </div>
    </article>

    <article class="panel digest-panel" v-if="overview?.digest">
      <div class="panel-head">
        <h3>AI 日报摘要</h3>
        <span class="meta">{{ overview.digest.generatedAt }}</span>
      </div>
      <pre class="digest-text">{{ overview.digest.summary }}</pre>
      <div class="source-row">
        <span class="meta">数据来源：</span>
        <el-tag v-for="source in overview.digest.sources" :key="source" size="small" type="info">{{ source }}</el-tag>
      </div>
    </article>

    <div class="kpi-grid">
      <article
        v-for="kpi in overview?.kpis ?? []"
        :key="kpi.code"
        class="kpi-card"
        @click="openDrill(kpi.code)"
      >
        <span class="kpi-label">{{ kpi.name }}</span>
        <strong class="kpi-value" :style="{ color: kpiColor(kpi.source) }">{{ formatKpi(kpi) }}</strong>
        <span v-if="typeof kpi.yoy === 'number'" class="kpi-yoy" :class="kpi.yoy >= 0 ? 'up' : 'down'">
          同比 {{ kpi.yoy >= 0 ? '+' : '' }}{{ kpi.yoy }}%
        </span>
        <span class="kpi-drill">下钻 →</span>
      </article>
    </div>

    <article class="panel" v-if="overview?.alerts?.length">
      <div class="panel-head"><h3>异常预警</h3><el-tag size="small" type="danger">{{ overview.alerts.length }} 条未关闭</el-tag></div>
      <el-table :data="overview.alerts" size="small" max-height="260">
        <el-table-column prop="riskType" label="类型" width="140" />
        <el-table-column prop="title" label="预警内容" />
        <el-table-column prop="severity" label="级别" width="100">
          <template #default="{ row }"><el-tag :type="severityType(row.severity)" size="small">{{ row.severity }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="bizType" label="业务类型" width="120" />
      </el-table>
    </article>

    <article class="panel">
      <div class="panel-head">
        <h3>销售月度趋势</h3>
        <span class="meta" v-if="trend">同比 {{ trend.yoy >= 0 ? '+' : '' }}{{ trend.yoy }}% · 毛利率 {{ trend.margin }}%</span>
      </div>
      <div ref="chartElement" class="chart-element"></div>
    </article>

    <el-drawer v-model="drawerVisible" :title="drillResult?.title ?? '明细'" size="60%">
      <el-table :data="drillResult?.rows ?? []" size="small" v-loading="drillLoading" max-height="70vh">
        <el-table-column v-for="column in drillColumns" :key="column" :prop="column" :label="column" min-width="120" show-overflow-tooltip />
      </el-table>
    </el-drawer>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; margin-bottom: 16px; }
.panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.panel-head h3 { margin: 0; font-size: 16px; }
.meta { color: #8c8c8c; font-size: 12px; }
.digest-panel { border-left: 3px solid #1677ff; }
.shortcut-grid { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.shortcut-item { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid #f0f0f0; border-radius: 6px; cursor: pointer; font-size: 13px; }
.shortcut-item:hover { border-color: #1677ff; color: #1677ff; }
.digest-text { margin: 0; font-family: inherit; font-size: 13px; line-height: 1.8; white-space: pre-wrap; }
.source-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 10px; }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 16px; margin-bottom: 16px; }
.kpi-card { position: relative; min-height: 112px; padding: 16px; background: #fff; border-radius: 8px; cursor: pointer; box-shadow: 0 1px 2px rgb(18 22 31 / 6%); }
.kpi-card:hover { box-shadow: 0 4px 12px rgb(18 22 31 / 12%); }
.kpi-label { display: block; margin-bottom: 8px; color: #8c8c8c; }
.kpi-value { font-size: 24px; line-height: 32px; }
.kpi-yoy { display: block; margin-top: 4px; font-size: 12px; }
.kpi-yoy.up { color: #52c41a; }
.kpi-yoy.down { color: #f5222d; }
.kpi-drill { position: absolute; right: 12px; bottom: 12px; font-size: 12px; color: #1677ff; }
.chart-element { width: 100%; height: 320px; }
</style>
