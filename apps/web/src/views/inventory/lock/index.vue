<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchLocks, lockStock, unlockStock, type InventoryQuery, type StockLock } from '@/api/inventory'

const rows = ref<StockLock[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<InventoryQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const form = reactive({ sourceType: 'SALE_ORDER', sourceId: 0, warehouseId: 0, productId: 0, qty: '1' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchLocks(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void { Object.assign(form, { sourceType: 'SALE_ORDER', sourceId: 0, warehouseId: 0, productId: 0, qty: '1' }); visible.value = true }
async function save(): Promise<void> {
  try { await lockStock({ ...form }); visible.value = false; ElMessage.success('库存已锁定'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '锁定失败') }
}
async function unlock(row: unknown): Promise<void> {
  const lock = row as StockLock
  try { await unlockStock({ sourceType: lock.sourceType, sourceId: lock.sourceId }); ElMessage.success('已释放'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '释放失败') }
}
function handlePage(value: number): void { query.value.page = value; void load() }
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>库存锁定</h2><p>销售预占、生产预留或手工锁定；锁定与释放均保留记录。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-button type="primary" v-perm="'inventory:balance:update'" @click="openAdd">锁定库存</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="sourceType" label="来源" width="140" />
        <el-table-column prop="sourceId" label="来源ID" width="110" />
        <el-table-column prop="warehouseId" label="仓库ID" width="110" />
        <el-table-column prop="productId" label="产品ID" width="110" />
        <el-table-column prop="lockedQty" label="锁定量" width="120" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column label="操作" width="100"><template #default="{ row }"><el-button link type="primary" :disabled="row.status === 'RELEASED'" @click="unlock(row)">释放</el-button></template></el-table-column>
      </el-table>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
    </article>
    <el-dialog v-model="visible" title="锁定库存" width="520px">
      <el-form label-width="90px">
        <el-form-item label="来源"><el-input v-model="form.sourceType" /></el-form-item>
        <el-form-item label="来源ID"><el-input-number v-model="form.sourceId" :min="1" /></el-form-item>
        <el-form-item label="仓库ID"><el-input-number v-model="form.warehouseId" :min="1" /></el-form-item>
        <el-form-item label="产品ID"><el-input-number v-model="form.productId" :min="1" /></el-form-item>
        <el-form-item label="锁定量"><el-input v-model="form.qty" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">锁定</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
