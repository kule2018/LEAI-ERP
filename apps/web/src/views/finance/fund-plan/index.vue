<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchAccounts, fetchStatements, type FinanceQuery, type FinAccount, type StatementData } from '@/api/finance'
import { rollingForecast, type RollingForecast } from '@/api/finance-extension'

const accounts = ref<FinAccount[]>([])
const statements = ref<StatementData | null>(null)
const query = ref<FinanceQuery>({ page: 1, pageSize: 100, period: new Date().toISOString().slice(0, 7) })
const forecastMonths = ref(6)
const forecast = ref<RollingForecast | null>(null)
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  try {
    const [accountResult, statementData] = await Promise.all([fetchAccounts(query.value), fetchStatements(query.value)])
    if (current !== seq) return
    accounts.value = accountResult.list
    statements.value = statementData
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '加载失败') }
}

async function loadForecast(): Promise<void> {
  try {
    forecast.value = await rollingForecast({ months: forecastMonths.value })
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '滚动预测失败') }
}

onMounted(() => { void load(); void loadForecast() })
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>资金计划</h2><p>账户余额、期间现金流概览与滚动预测。</p></header>
    <div class="toolbar"><el-date-picker v-model="query.period" type="month" value-format="YYYY-MM" placeholder="YYYY-MM"  /><el-button type="primary" @click="load">查询</el-button></div>
    <div class="kpi-grid">
      <article class="kpi-card"><span>账户余额合计</span><strong>{{ accounts.reduce((sum, item) => sum + Number(item.balance), 0).toFixed(4) }}</strong></article>
      <article class="kpi-card"><span>期间流入</span><strong>{{ statements?.cashFlow.inflow ?? '0.0000' }}</strong></article>
      <article class="kpi-card"><span>期间流出</span><strong>{{ statements?.cashFlow.outflow ?? '0.0000' }}</strong></article>
      <article class="kpi-card"><span>净流量</span><strong>{{ ((Number(statements?.cashFlow.inflow ?? 0)) - (Number(statements?.cashFlow.outflow ?? 0))).toFixed(4) }}</strong></article>
    </div>
    <article class="panel">
      <h3>账户余额</h3>
      <el-table :data="accounts" size="small" row-key="id">
        <el-table-column prop="accountName" label="账户" />
        <el-table-column prop="accountType" label="类型" width="120" />
        <el-table-column prop="balance" label="余额" width="160" />
      </el-table>
    </article>
    <article class="panel">
      <h3>滚动预测</h3>
      <div class="toolbar">
        <span>预测月数</span>
        <el-input-number v-model="forecastMonths" :min="1" :max="24" controls-position="right" style="width: 120px" />
        <el-button type="primary" @click="loadForecast">生成滚动预测</el-button>
      </div>
      <el-alert v-if="forecast?.warning" type="warning" :closable="false" :title="forecast.warning" style="margin-bottom: 12px" />
      <div class="kpi-grid" v-if="forecast">
        <article class="kpi-card"><span>基线月流入</span><strong>{{ forecast.baseline.inflow.toFixed(4) }}</strong></article>
        <article class="kpi-card"><span>基线月流出</span><strong>{{ forecast.baseline.outflow.toFixed(4) }}</strong></article>
        <article class="kpi-card"><span>预测期末余额</span><strong>{{ forecast.endingBalance.toFixed(4) }}</strong></article>
        <article class="kpi-card"><span>最低期末余额</span><strong>{{ forecast.minEndingBalance.toFixed(4) }}</strong></article>
      </div>
      <el-table :data="forecast?.rows ?? []" size="small">
        <el-table-column prop="month" label="月份" width="100" />
        <el-table-column label="期初余额" width="150"><template #default="{ row }">{{ Number(row.openingBalance).toFixed(4) }}</template></el-table-column>
        <el-table-column label="预测流入" width="150"><template #default="{ row }">{{ Number(row.inflow).toFixed(4) }}</template></el-table-column>
        <el-table-column label="预测流出" width="150"><template #default="{ row }">{{ Number(row.outflow).toFixed(4) }}</template></el-table-column>
        <el-table-column label="净流量" width="150"><template #default="{ row }">{{ Number(row.net).toFixed(4) }}</template></el-table-column>
        <el-table-column label="期末余额" width="150"><template #default="{ row }">{{ Number(row.endingBalance).toFixed(4) }}</template></el-table-column>
        <el-table-column label="数据来源" width="120">
          <template #default="{ row }">
            <el-tag :type="row.source === 'PLAN' ? 'success' : 'info'">{{ row.source === 'PLAN' ? '计划' : '基线' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="置信度" width="100"><template #default="{ row }">{{ (Number(row.confidence) * 100).toFixed(0) }}%</template></el-table-column>
      </el-table>
    </article>
  </section>
</template>

<style scoped>
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; align-items: center; }
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }
.kpi-card { padding: 16px; background: #fff; border-radius: 8px; }
.kpi-card span { display: block; margin-bottom: 8px; color: #646a73; }
.kpi-card strong { font-size: 22px; }
.panel { padding: 16px; background: #fff; border-radius: 8px; margin-bottom: 16px; }
.panel h3 { margin: 0 0 16px; }
@media (max-width: 1000px) { .kpi-grid { grid-template-columns: 1fr; } }
</style>
