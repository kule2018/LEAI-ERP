<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { fetchBalances, type InventoryQuery, type StockBalance } from '@/api/inventory'

const rows = ref<StockBalance[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<InventoryQuery>({ page: 1, pageSize: 20, keyword: '' })
const warehouseId = ref(0)
const productId = ref(0)
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  error.value = ''
  query.value.warehouseId = warehouseId.value || undefined
  query.value.productId = productId.value || undefined
  try {
    const result = await fetchBalances(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } catch (cause) { if (current === seq) error.value = cause instanceof Error ? cause.message : '加载失败' }
  finally { if (current === seq) loading.value = false }
}
function available(row: unknown): string {
  const item = row as StockBalance
  return (Number(item.qtyOnHand) - Number(item.qtyOccupied) - Number(item.qtyFrozen)).toFixed(3)
}
function handlePage(value: number): void { query.value.page = value; void load() }
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>库存查询</h2><p>可用量 = 实物量 - 锁定量 - 冻结量，按仓库、库位、SKU、批次展示。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-input-number v-model="warehouseId" :min="0" placeholder="仓库ID" />
        <el-input-number v-model="productId" :min="0" placeholder="产品ID" />
        <el-button type="primary" @click="load">查询</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <div v-if="error" class="error">{{ error }}</div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="warehouseId" label="仓库ID" width="100" />
        <el-table-column prop="locationId" label="库位ID" width="100" />
        <el-table-column prop="productId" label="产品ID" width="100" />
        <el-table-column prop="variantId" label="SKU ID" width="100" />
        <el-table-column prop="batchNo" label="批次" width="140" />
        <el-table-column prop="qtyOnHand" label="实物量" width="120" />
        <el-table-column label="可用量" width="120"><template #default="{ row }">{{ available(row) }}</template></el-table-column>
        <el-table-column prop="qtyOccupied" label="锁定量" width="120" />
        <el-table-column prop="qtyFrozen" label="冻结量" width="120" />
        <el-table-column prop="avgCost" label="移动平均成本" width="140" />
      </el-table>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
    </article>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.error { color: #f5222d; margin-bottom: 12px; }
</style>
