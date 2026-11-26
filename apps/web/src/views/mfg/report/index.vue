<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchManufacturingSummary, type ManufacturingSummary } from '@/api/manufacturing'

const summary = ref<ManufacturingSummary | null>(null)
onMounted(async () => {
  try { summary.value = await fetchManufacturingSummary() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '加载失败') }
})
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>生产报表</h2><p>工单完成情况、报工量、完工量、不良量和未关闭异常。</p></header>
    <div class="kpi-grid">
      <article class="kpi-card"><span>工单数</span><strong>{{ summary?.workOrderCount ?? 0 }}</strong></article>
      <article class="kpi-card"><span>已完成</span><strong>{{ summary?.doneCount ?? 0 }}</strong></article>
      <article class="kpi-card"><span>已报工量</span><strong>{{ summary?.producedQty ?? '0.000' }}</strong></article>
      <article class="kpi-card"><span>已完工量</span><strong>{{ summary?.actualQty ?? '0.000' }}</strong></article>
      <article class="kpi-card"><span>不良量</span><strong>{{ summary?.defectQty ?? '0.000' }}</strong></article>
      <article class="kpi-card"><span>未关闭异常</span><strong>{{ summary?.openExceptions ?? 0 }}</strong></article>
    </div>
  </section>
</template>

<style scoped>
.kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.kpi-card { padding: 16px; background: #fff; border-radius: 8px; }
.kpi-card span { display: block; margin-bottom: 8px; color: #646a73; }
.kpi-card strong { font-size: 22px; }
@media (max-width: 1000px) { .kpi-grid { grid-template-columns: 1fr; } }
</style>
