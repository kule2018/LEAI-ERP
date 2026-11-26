<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchAging, type Aging } from '@/api/finance'

const type = ref<'RECEIVABLE' | 'PAYABLE'>('RECEIVABLE')
const data = ref<Aging | null>(null)

async function load(): Promise<void> {
  try { data.value = await fetchAging(type.value) }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '加载失败') }
}
onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>账龄分析</h2><p>按到期日划分 30 天以内、31-60 天、61-90 天和 90 天以上。</p></header>
    <div class="toolbar">
      <el-radio-group v-model="type" @change="load"><el-radio-button value="RECEIVABLE">应收账龄</el-radio-button><el-radio-button value="PAYABLE">应付账龄</el-radio-button></el-radio-group>
      <el-button @click="load">刷新</el-button>
    </div>
    <div class="kpi-grid">
      <article class="kpi-card"><span>未到期/30天内</span><strong>{{ data?.current ?? '0.0000' }}</strong></article>
      <article class="kpi-card"><span>31-60天</span><strong>{{ data?.days31 ?? '0.0000' }}</strong></article>
      <article class="kpi-card"><span>61-90天</span><strong>{{ data?.days61 ?? '0.0000' }}</strong></article>
      <article class="kpi-card"><span>90天以上</span><strong>{{ data?.days91 ?? '0.0000' }}</strong></article>
    </div>
  </section>
</template>

<style scoped>
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.kpi-card { padding: 16px; background: #fff; border-radius: 8px; }
.kpi-card span { display: block; margin-bottom: 8px; color: #646a73; }
.kpi-card strong { font-size: 22px; }
@media (max-width: 1000px) { .kpi-grid { grid-template-columns: 1fr; } }
</style>
