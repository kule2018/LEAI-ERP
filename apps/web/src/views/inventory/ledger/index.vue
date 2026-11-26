<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { exportLedger, fetchLedger, type InventoryQuery, type StockLedger } from '@/api/inventory'

const rows = ref<StockLedger[]>([])
const total = ref(0)
const loading = ref(false)
const exporting = ref(false)
const query = ref<InventoryQuery>({ page: 1, pageSize: 20, keyword: '' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  query.value.voucherType = query.value.keyword || undefined
  try {
    const result = await fetchLedger(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function handlePage(value: number): void { query.value.page = value; void load() }

/** 导出库存流水 CSV（带水印与导出审计，仅当前数据权限范围） */
async function handleExport(): Promise<void> {
  exporting.value = true
  try {
    const blob = await exportLedger({ ...query.value, page: 1, pageSize: 5000 })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `inventory-ledger-${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '导出失败')
  } finally {
    exporting.value = false
  }
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>库存流水</h2><p>只追加流水，记录来源凭证、数量变化、结存和成本。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-input v-model="query.keyword" placeholder="凭证类型，如 SALE_OUT" clearable @keyup.enter="load" />
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="load">刷新</el-button>
        <el-button v-perm="'inventory:ledger:export'" :loading="exporting" @click="handleExport">导出</el-button>
      </div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="occurredAt" label="时间" width="180" />
        <el-table-column prop="voucherType" label="凭证类型" width="150" />
        <el-table-column prop="voucherId" label="凭证ID" width="110" />
        <el-table-column prop="warehouseId" label="仓库ID" width="100" />
        <el-table-column prop="productId" label="产品ID" width="100" />
        <el-table-column prop="batchNo" label="批次" width="130" />
        <el-table-column prop="qtyIn" label="入库量" width="110" />
        <el-table-column prop="qtyOut" label="出库量" width="110" />
        <el-table-column prop="balanceQty" label="结存" width="110" />
        <el-table-column prop="cost" label="成本" width="110" />
        <el-table-column prop="remark" label="备注" min-width="180" />
      </el-table>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
    </article>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
