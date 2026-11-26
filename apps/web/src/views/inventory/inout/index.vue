<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createMovement, fetchLedger, type InventoryQuery, type StockLedger } from '@/api/inventory'

const rows = ref<StockLedger[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<InventoryQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const form = reactive({
  voucherType: 'ADJUST',
  warehouseId: 0, locationId: 0, productId: 0, variantId: 0, batchNo: '',
  qtyIn: '0', qtyOut: '0', cost: '0', remark: ''
})
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchLedger(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void {
  Object.assign(form, { voucherType: 'ADJUST', warehouseId: 0, locationId: 0, productId: 0, variantId: 0, batchNo: '', qtyIn: '0', qtyOut: '0', cost: '0', remark: '' })
  visible.value = true
}
async function save(): Promise<void> {
  try {
    await createMovement({ ...form, voucherId: 0 })
    visible.value = false
    ElMessage.success('库存流水已生成')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '过账失败') }
}
function handlePage(value: number): void { query.value.page = value; void load() }
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>手工出入库</h2><p>用于调整、样品、报废等非业务单据库存变动；所有变动必须留流水。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-button type="primary" v-perm="'inventory:inout:create'" @click="openAdd">新建出入库</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="voucherType" label="类型" width="140" />
        <el-table-column prop="warehouseId" label="仓库ID" width="100" />
        <el-table-column prop="productId" label="产品ID" width="100" />
        <el-table-column prop="qtyIn" label="入库量" width="110" />
        <el-table-column prop="qtyOut" label="出库量" width="110" />
        <el-table-column prop="balanceQty" label="结存" width="110" />
        <el-table-column prop="remark" label="备注" min-width="180" />
      </el-table>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
    </article>
    <el-dialog v-model="visible" title="手工出入库" width="560px">
      <el-form label-width="90px">
        <el-form-item label="类型"><el-select v-model="form.voucherType"><el-option label="调整" value="ADJUST" /><el-option label="报损" value="SCRAP" /><el-option label="样品" value="SAMPLE" /></el-select></el-form-item>
        <el-form-item label="仓库ID"><el-input-number v-model="form.warehouseId" :min="1" /></el-form-item>
        <el-form-item label="产品ID"><el-input-number v-model="form.productId" :min="1" /></el-form-item>
        <el-form-item label="库位ID"><el-input-number v-model="form.locationId" :min="0" /></el-form-item>
        <el-form-item label="SKU ID"><el-input-number v-model="form.variantId" :min="0" /></el-form-item>
        <el-form-item label="批次"><el-input v-model="form.batchNo" /></el-form-item>
        <el-form-item label="入库量"><el-input v-model="form.qtyIn" /></el-form-item>
        <el-form-item label="出库量"><el-input v-model="form.qtyOut" /></el-form-item>
        <el-form-item label="成本"><el-input v-model="form.cost" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">过账</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
