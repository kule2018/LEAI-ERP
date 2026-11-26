<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchTrialBalance, type FinanceQuery, type TrialRow } from '@/api/finance'
import { fetchTrialBalanceAnalysis } from '@/api/finance-extension'

const rows = ref<TrialRow[]>([])
const auxRows = ref<Array<Record<string, unknown>>>([])
const auxDimensions = ref<string[]>([])
const loading = ref(false)
const query = ref<FinanceQuery>({ page: 1, pageSize: 20, period: new Date().toISOString().slice(0, 7) })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchTrialBalance(query.value)
    if (current !== seq) return
    rows.value = result
    const analysis = await fetchTrialBalanceAnalysis({ period: query.value.period })
    if (current !== seq) return
    auxRows.value = (analysis.auxRows ?? []) as Array<Record<string, unknown>>
    auxDimensions.value = (analysis.auxDimensions ?? []) as string[]
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '加载失败') }
  finally { if (current === seq) loading.value = false }
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>试算平衡表</h2><p>按期间汇总已过账凭证的科目借贷发生额。</p></header>
    <article class="panel">
      <div class="toolbar"><el-date-picker v-model="query.period" type="month" value-format="YYYY-MM" placeholder="YYYY-MM"  /><el-button type="primary" @click="load">查询</el-button></div>
      <el-table v-loading="loading" :data="rows" row-key="subjectId" size="small" show-summary :summary-method="() => ['合计', '', rows.reduce((s,r)=>s+Number(r.debit),0).toFixed(4), rows.reduce((s,r)=>s+Number(r.credit),0).toFixed(4), rows.reduce((s,r)=>s+Number(r.balance),0).toFixed(4)]">
        <el-table-column prop="subjectCode" label="科目编码" width="150" />
        <el-table-column prop="subjectName" label="科目名称" min-width="180" />
        <el-table-column prop="debit" label="借方发生额" width="150" />
        <el-table-column prop="credit" label="贷方发生额" width="150" />
        <el-table-column prop="balance" label="余额" width="150" />
      </el-table>
    </article>
    <article class="panel">
      <h3>辅助核算维度展开</h3>
      <p class="hint">已识别维度：{{ auxDimensions.length ? auxDimensions.join('、') : '无' }}（数据来自凭证分录的辅助核算项）</p>
      <el-table :data="auxRows" size="small">
        <el-table-column prop="subjectCode" label="科目编码" width="130" />
        <el-table-column prop="subjectName" label="科目名称" min-width="160" />
        <el-table-column prop="auxType" label="维度类型" width="120" />
        <el-table-column prop="auxId" label="维度值" width="120" />
        <el-table-column prop="debit" label="借方" width="130" />
        <el-table-column prop="credit" label="贷方" width="130" />
        <el-table-column prop="balance" label="余额" width="130" />
      </el-table>
    </article>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.hint { color: #646a73; font-size: 13px; }
</style>
