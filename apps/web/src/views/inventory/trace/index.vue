<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchLedger,
  recallFreeze,
  traceBatch,
  type BatchTrace,
  type InventoryQuery,
  type StockLedger
} from '@/api/inventory'

const rows = ref<StockLedger[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<InventoryQuery>({ page: 1, pageSize: 20, keyword: '' })
const batchNo = ref('')
const trace = ref<BatchTrace | null>(null)
const tracing = ref(false)
const recallForm = reactive({ productId: 0, qty: '0' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  query.value.batchNo = batchNo.value || undefined
  try {
    const result = await fetchLedger(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}

async function loadTrace(): Promise<void> {
  if (!batchNo.value.trim()) {
    ElMessage.warning('请输入批次号')
    return
  }
  tracing.value = true
  try {
    trace.value = await traceBatch(batchNo.value.trim())
    const first = trace.value.sources[0]
    if (first && !recallForm.productId) recallForm.productId = first.productId
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '追溯查询失败')
  } finally {
    tracing.value = false
  }
}

async function handleRecall(): Promise<void> {
  if (!recallForm.productId || Number(recallForm.qty) <= 0) {
    ElMessage.warning('请填写产品 ID 与冻结数量')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认冻结批次 ${batchNo.value} 中产品 ${recallForm.productId} 的 ${recallForm.qty} 库存？`,
      '批次召回冻结',
      { type: 'warning' }
    )
  } catch {
    return
  }
  try {
    await recallFreeze({ productId: recallForm.productId, batchNo: batchNo.value.trim(), qty: String(recallForm.qty) })
    ElMessage.success('已冻结该批次库存')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '召回冻结失败')
  }
}

function handlePage(value: number): void { query.value.page = value; void load() }
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>批次追溯</h2><p>按批次号查看正向和反向库存流水，可追溯来源凭证并发起召回冻结。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-input v-model="batchNo" placeholder="输入批次号" clearable @keyup.enter="load" />
        <el-button type="primary" @click="load">查询流水</el-button>
        <el-button :loading="tracing" v-perm="'inventory:ledger:view'" @click="loadTrace">追溯树</el-button>
      </div>

      <div v-if="trace" class="trace-blocks">
        <section class="trace-block">
          <h4>正向来源（{{ trace.sources.length }}）</h4>
          <el-table :data="trace.sources" size="small" border>
            <el-table-column prop="voucherType" label="凭证类型" width="120" />
            <el-table-column prop="voucherId" label="凭证号" width="90" />
            <el-table-column prop="productId" label="产品" width="90" />
            <el-table-column prop="qty" label="数量" width="90" />
            <el-table-column prop="occurredAt" label="发生时间" min-width="150" />
          </el-table>
        </section>
        <section class="trace-block">
          <h4>反向去向（{{ trace.destinations.length }}）</h4>
          <el-table :data="trace.destinations" size="small" border>
            <el-table-column prop="voucherType" label="凭证类型" width="120" />
            <el-table-column prop="voucherId" label="凭证号" width="90" />
            <el-table-column prop="productId" label="产品" width="90" />
            <el-table-column prop="qty" label="数量" width="90" />
            <el-table-column prop="occurredAt" label="发生时间" min-width="150" />
          </el-table>
        </section>
        <section class="trace-block">
          <h4>召回清单（{{ trace.recall.length }}）</h4>
          <el-table :data="trace.recall" size="small" border>
            <el-table-column prop="voucherType" label="凭证类型" width="120" />
            <el-table-column prop="voucherId" label="凭证号" width="90" />
          </el-table>
          <div class="recall-form">
            <el-input-number v-model="recallForm.productId" :min="1" placeholder="产品 ID" />
            <el-input v-model="recallForm.qty" placeholder="冻结数量" style="width: 140px" />
            <el-button type="danger" v-perm="'inventory:stocktake:approve'" @click="handleRecall">召回冻结</el-button>
          </div>
        </section>
      </div>

      <el-timeline v-loading="loading">
        <el-timeline-item v-for="row in rows" :key="row.id" :timestamp="row.occurredAt" placement="top">
          <el-card shadow="hover">
            <div class="trace-head">{{ row.voucherType }} · 凭证 {{ row.voucherId }} · 产品 {{ row.productId }}</div>
            <div>入库 {{ row.qtyIn }} / 出库 {{ row.qtyOut }} / 结存 {{ row.balanceQty }}</div>
            <div class="trace-remark">{{ row.remark || '—' }}</div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
    </article>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.trace-head { font-weight: 600; margin-bottom: 6px; }
.trace-remark { color: #646a73; font-size: 12px; }
.trace-blocks { display: grid; gap: 16px; margin-bottom: 16px; }
.trace-block h4 { margin: 0 0 8px; }
.recall-form { display: flex; gap: 8px; margin-top: 12px; align-items: center; }
</style>
