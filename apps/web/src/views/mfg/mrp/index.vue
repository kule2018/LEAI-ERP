<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchMrpRuns, fetchMrpSuggests, runMrp, type ManufacturingQuery, type MrpRun, type MrpSuggest } from '@/api/manufacturing'

const runs = ref<MrpRun[]>([])
const suggests = ref<MrpSuggest[]>([])
const total = ref(0)
const loading = ref(false)
const running = ref(false)
const query = ref<ManufacturingQuery>({ page: 1, pageSize: 20, keyword: '' })
const selected = ref<MrpRun | null>(null)
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchMrpRuns(query.value)
    if (current !== seq) return
    runs.value = result.list
    total.value = result.total
    if (!selected.value && result.list.length > 0) {
      selected.value = result.list[0]
      suggests.value = await fetchMrpSuggests(selected.value.id)
    }
  } finally { if (current === seq) loading.value = false }
}
async function handleRun(): Promise<void> {
  running.value = true
  try {
    const run = await runMrp({})
    selected.value = run
    suggests.value = await fetchMrpSuggests(run.id)
    ElMessage.success('MRP 运算完成')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '运算失败') }
  finally { running.value = false }
}
async function selectRun(run: MrpRun): Promise<void> {
  selected.value = run
  suggests.value = await fetchMrpSuggests(run.id)
}
function handlePage(value: number): void { query.value.page = value; void load() }
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>MRP 运算</h2><p>净需求 = 需求 + 安全库存 - 可用库存 - 在途量 + 已分配量。</p></header>
    <div class="mrp-layout">
      <article class="panel">
        <div class="toolbar"><el-button type="primary" :loading="running" v-perm="'mfg:mrp:run'" @click="handleRun">执行 MRP</el-button><el-button @click="load">刷新</el-button></div>
        <el-table v-loading="loading" :data="runs" row-key="id" highlight-current-row @row-click="selectRun">
          <el-table-column prop="runNo" label="运算单号" width="180" />
          <el-table-column prop="planDate" label="计划日期" width="130" />
          <el-table-column prop="status" label="状态" width="110" />
          <el-table-column prop="createdAt" label="创建时间" width="180" />
        </el-table>
        <el-pagination background layout="prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
      </article>
      <article class="panel">
        <h3>运算建议 · {{ selected?.runNo ?? '未选择' }}</h3>
        <el-table :data="suggests" row-key="id" size="small">
          <el-table-column prop="productId" label="产品ID" width="100" />
          <el-table-column prop="demandQty" label="需求" width="110" />
          <el-table-column prop="availableQty" label="可用" width="110" />
          <el-table-column prop="onwayQty" label="在途" width="110" />
          <el-table-column prop="allocatedQty" label="已分配" width="110" />
          <el-table-column prop="netQty" label="净需求" width="110" />
          <el-table-column prop="suggestType" label="建议" width="110" />
        </el-table>
      </article>
    </div>
  </section>
</template>

<style scoped>
.mrp-layout { display: grid; grid-template-columns: minmax(380px, 0.9fr) minmax(520px, 1.1fr); gap: 16px; }
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel h3 { margin: 0 0 16px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
@media (max-width: 1100px) { .mrp-layout { grid-template-columns: 1fr; } }
</style>
