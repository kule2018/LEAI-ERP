<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createTransfer, fetchTransfers, receiveTransfer, type InventoryQuery, type StockTransfer } from '@/api/inventory'

const rows = ref<StockTransfer[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<InventoryQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const form = reactive({ fromWarehouseId: 0, toWarehouseId: 0 })
const lines = ref([{ productId: 0, qty: '1' }])
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchTransfers(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void { Object.assign(form, { fromWarehouseId: 0, toWarehouseId: 0 }); lines.value = [{ productId: 0, qty: '1' }]; visible.value = true }
async function save(): Promise<void> {
  try {
    await createTransfer({ ...form, lines: lines.value })
    visible.value = false
    ElMessage.success('调拨单已创建')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
async function receive(row: unknown): Promise<void> {
  const transfer = row as StockTransfer
  try { await receiveTransfer(transfer.id); ElMessage.success('调拨已过账'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '过账失败') }
}
function handlePage(value: number): void { query.value.page = value; void load() }
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>库存调拨</h2><p>调出仓扣减、调入仓增加，两笔流水使用同一调拨凭证。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-button type="primary" v-perm="'inventory:transfer:create'" @click="openAdd">新建调拨</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="transferNo" label="调拨单号" width="170" />
        <el-table-column prop="fromWarehouseId" label="调出仓" width="120" />
        <el-table-column prop="toWarehouseId" label="调入仓" width="120" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column label="操作" width="100"><template #default="{ row }"><el-button link type="primary" v-perm="'inventory:transfer:receive'" @click="receive(row)">收货过账</el-button></template></el-table-column>
      </el-table>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
    </article>
    <el-dialog v-model="visible" title="新建调拨" width="720px">
      <el-form label-width="100px">
        <el-form-item label="调出仓ID"><el-input-number v-model="form.fromWarehouseId" :min="1" /></el-form-item>
        <el-form-item label="调入仓ID"><el-input-number v-model="form.toWarehouseId" :min="1" /></el-form-item>
      </el-form>
      <el-table :data="lines" size="small">
        <el-table-column label="产品ID" width="150"><template #default="{ row }"><el-input v-model="row.productId" /></template></el-table-column>
        <el-table-column label="数量"><template #default="{ row }"><el-input v-model="row.qty" /></template></el-table-column>
        <el-table-column width="70"><template #default><el-button link type="danger" :disabled="lines.length <= 1" @click="lines.pop()">删</el-button></template></el-table-column>
      </el-table>
      <el-button class="add-line" @click="lines.push({ productId: 0, qty: '1' })">加行</el-button>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.add-line { margin-top: 12px; }
</style>
