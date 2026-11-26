<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchFinanceDashboard, type FinanceDashboard } from '@/api/finance'

const data = ref<FinanceDashboard | null>(null)
const loading = ref(false)

const budget = computed(() => data.value?.budgetExecution)
const risk = computed(() => data.value?.riskMetrics)
const ratePercent = computed(() => `${((budget.value?.executionRate ?? 0) * 100).toFixed(2)}%`)

onMounted(async () => {
  loading.value = true
  try { data.value = await fetchFinanceDashboard() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '加载失败') }
  finally { loading.value = false }
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>财务仪表盘</h2>
      <p>应收、应付、资金余额、预算执行与风险指标概览。</p>
    </header>

    <div v-loading="loading">
      <div class="kpi-grid">
        <article class="kpi-card"><span>应收余额</span><strong>¥ {{ data?.receivableAmount ?? '0.0000' }}</strong></article>
        <article class="kpi-card"><span>应付余额</span><strong>¥ {{ data?.payableAmount ?? '0.0000' }}</strong></article>
        <article class="kpi-card"><span>资金余额</span><strong>¥ {{ data?.fundBalance ?? '0.0000' }}</strong></article>
        <article class="kpi-card"><span>凭证数 / 已过账</span><strong>{{ data?.voucherCount ?? 0 }} / {{ data?.postedCount ?? 0 }}</strong></article>
      </div>

      <article class="panel">
        <h3>预算执行</h3>
        <div class="kpi-grid four">
          <article class="kpi-card"><span>预算总额</span><strong>¥ {{ budget?.budgetAmount ?? '0.0000' }}</strong></article>
          <article class="kpi-card"><span>已使用</span><strong>¥ {{ budget?.usedAmount ?? '0.0000' }}</strong></article>
          <article class="kpi-card"><span>已占用</span><strong>¥ {{ budget?.occupiedAmount ?? '0.0000' }}</strong></article>
          <article class="kpi-card">
            <span>执行率</span>
            <strong>{{ ratePercent }}</strong>
            <el-progress
              :percentage="Math.min(100, Math.round((budget?.executionRate ?? 0) * 100))"
              :status="(budget?.overBudgetCount ?? 0) > 0 ? 'exception' : undefined"
            />
          </article>
        </div>
        <p class="hint">
          控制方式：{{ budget?.controlRules?.join('、') || '—' }}；超支预算项 {{ budget?.overBudgetCount ?? 0 }} 个
        </p>
      </article>

      <article class="panel">
        <h3>风险指标</h3>
        <div class="kpi-grid four">
          <article class="kpi-card danger">
            <span>逾期应收</span>
            <strong>¥ {{ risk?.overdueReceivableAmount ?? '0.0000' }}</strong>
            <small>{{ risk?.overdueReceivableCount ?? 0 }} 笔</small>
          </article>
          <article class="kpi-card danger">
            <span>逾期应付</span>
            <strong>¥ {{ risk?.overduePayableAmount ?? '0.0000' }}</strong>
            <small>{{ risk?.overduePayableCount ?? 0 }} 笔</small>
          </article>
          <article class="kpi-card warn">
            <span>高风险应收</span>
            <strong>{{ risk?.highRiskReceivableCount ?? 0 }} 笔</strong>
            <small>坏账计提 ¥ {{ risk?.provisionAmount ?? '0.0000' }}</small>
          </article>
          <article class="kpi-card warn">
            <span>未过账凭证</span>
            <strong>{{ risk?.unpostedVoucherCount ?? 0 }} 张</strong>
            <small>需及时审核入账</small>
          </article>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }
.kpi-card { padding: 16px; background: #fff; border-radius: 8px; }
.kpi-card span { display: block; margin-bottom: 8px; color: #646a73; }
.kpi-card strong { font-size: 22px; }
.kpi-card small { display: block; margin-top: 6px; color: #8f959e; }
.kpi-card.danger strong { color: #d93026; }
.kpi-card.warn strong { color: #d48806; }
.panel { padding: 16px; background: #fff; border-radius: 8px; margin-bottom: 16px; }
.panel h3 { margin: 0 0 16px; }
.panel .kpi-grid { margin-bottom: 0; }
.hint { margin: 12px 0 0; color: #646a73; font-size: 13px; }
@media (max-width: 1000px) { .kpi-grid { grid-template-columns: 1fr; } }
</style>
