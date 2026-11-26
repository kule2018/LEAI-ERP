<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchPurchaseSummary, type PurchaseSummary } from '@/api/purchase'

const summary = ref<PurchaseSummary | null>(null)
const loading = ref(false)

const onTimePercent = computed(() => `${((summary.value?.onTimeRate ?? 0) * 100).toFixed(2)}%`)
const qualityPercent = computed(() => `${((summary.value?.qualityPassRate ?? 0) * 100).toFixed(2)}%`)

onMounted(async () => {
  loading.value = true
  try { summary.value = await fetchPurchaseSummary() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '加载失败') }
  finally { loading.value = false }
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>采购报表</h2>
      <p>订单量、收货量、采购金额、到货及时率、质量合格率与供应商排行。</p>
    </header>
    <div v-loading="loading">
      <div class="kpi-grid">
        <article class="kpi-card"><span>采购订单数</span><strong>{{ summary?.orderCount ?? 0 }}</strong></article>
        <article class="kpi-card"><span>收货单数</span><strong>{{ summary?.receiptCount ?? 0 }}</strong></article>
        <article class="kpi-card"><span>采购总额</span><strong>¥ {{ summary?.totalAmount ?? '0.0000' }}</strong></article>
        <article class="kpi-card"><span>累计收货量</span><strong>{{ summary?.receivedQty ?? '0.0000' }}</strong></article>
      </div>

      <div class="kpi-grid">
        <article class="kpi-card">
          <span>到货及时率</span>
          <strong>{{ onTimePercent }}</strong>
          <el-progress :percentage="Math.min(100, Math.round((summary?.onTimeRate ?? 0) * 100))" />
          <small>统计样本 {{ summary?.onTimeSampleCount ?? 0 }} 单（以订单期望到货日为准）</small>
        </article>
        <article class="kpi-card">
          <span>质量合格率</span>
          <strong>{{ qualityPercent }}</strong>
          <el-progress :percentage="Math.min(100, Math.round((summary?.qualityPassRate ?? 0) * 100))" status="success" />
          <small>已质检行 {{ summary?.inspectedLineCount ?? 0 }} 行</small>
        </article>
      </div>

      <article class="panel">
        <h3>供应商采购排行</h3>
        <el-table :data="summary?.supplierRanking ?? []" row-key="name" size="small">
          <el-table-column type="index" label="名次" width="80" />
          <el-table-column prop="name" label="供应商" min-width="200" />
          <el-table-column prop="amount" label="采购金额" width="180" />
        </el-table>
      </article>

      <article class="panel">
        <h3>供应商采购分布</h3>
        <el-table :data="summary?.bySupplier ?? []" row-key="name" size="small">
          <el-table-column prop="name" label="供应商" min-width="200" />
          <el-table-column prop="amount" label="采购金额" width="180" />
        </el-table>
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
.panel { padding: 16px; background: #fff; border-radius: 8px; margin-bottom: 16px; }
.panel h3 { margin: 0 0 16px; }
@media (max-width: 1000px) { .kpi-grid { grid-template-columns: 1fr; } }
</style>
