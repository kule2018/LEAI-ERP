<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  cancelAdjustment, createAdjustment, fetchAdjustments, fetchAdjustmentDetail, postAdjustment,
  type InventoryQuery, type StockAdjustment, type StockAdjustmentLine
} from '@/api/inventory'
import { fetchProducts, fetchWarehouses } from '@/api/master-data'

interface ProductOption { id: number; productCode: string; productName: string }
interface WarehouseOption { id: number; warehouseCode: string; warehouseName: string }

const rows = ref<StockAdjustment[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<InventoryQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const detailVisible = ref(false)
const products = ref<ProductOption[]>([])
const warehouses = ref<WarehouseOption[]>([])
const detail = ref<{ adjustment: StockAdjustment; lines: StockAdjustmentLine[] } | null>(null)
const form = reactive({ adjustType: 'GAIN', warehouseId: 0, reason: '' })
const lines = ref([{ productId: 0, variantId: 0, batchNo: '', qty: '0', cost: '', reason: '' }])
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchAdjustments(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
async function loadOptions(): Promise<void> {
  try {
    const [productResult, warehouseResult] = await Promise.all([
      fetchProducts({ page: 1, pageSize: 200, keyword: '' }),
      fetchWarehouses({ page: 1, pageSize: 100, keyword: '' })
    ])
    products.value = productResult.list as unknown as ProductOption[]
    warehouses.value = warehouseResult.list as unknown as WarehouseOption[]
  } catch { products.value = []; warehouses.value = [] }
}
function openAdd(): void {
  Object.assign(form, { adjustType: 'GAIN', warehouseId: warehouses.value[0]?.id ?? 0, reason: '' })
  lines.value = [{ productId: 0, variantId: 0, batchNo: '', qty: '0', cost: '', reason: '' }]
  visible.value = true
}
function addLine(): void {
  lines.value.push({ productId: 0, variantId: 0, batchNo: '', qty: '0', cost: '', reason: '' })
}
function removeLine(index: number): void {
  if (lines.value.length <= 1) return
  lines.value.splice(index, 1)
}
async function save(): Promise<void> {
  const payload = lines.value.filter((item) => item.productId > 0 && Number(item.qty) !== 0)
  if (!form.warehouseId) { ElMessage.warning('请选择仓库'); return }
  if (payload.length === 0) { ElMessage.warning('请至少填写一行有效调整明细'); return }
  try {
    await createAdjustment({
      adjustType: form.adjustType,
      warehouseId: form.warehouseId,
      reason: form.reason || undefined,
      lines: payload.map((item) => ({
        productId: item.productId,
        variantId: item.variantId || undefined,
        batchNo: item.batchNo || undefined,
        qty: item.qty,
        cost: item.cost === '' ? undefined : item.cost,
        reason: item.reason || undefined
      }))
    })
    visible.value = false
    ElMessage.success('调整单已创建')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
async function openDetail(row: StockAdjustment): Promise<void> {
  try { detail.value = await fetchAdjustmentDetail(row.id); detailVisible.value = true }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '加载失败') }
}
async function handlePost(row: StockAdjustment): Promise<void> {
  try { await postAdjustment(row.id); ElMessage.success('调整单已过账'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '过账失败') }
}
async function handleCancel(row: StockAdjustment): Promise<void> {
  try { await cancelAdjustment(row.id, { reason: '手工作废' }); ElMessage.success('调整单已作废'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '作废失败') }
}
function handlePage(value: number): void { query.value.page = value; void load() }
onMounted(async () => { await load(); await loadOptions() })
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>库存调整</h2>
      <p>盘盈、盘亏与系统差异修正单据；过账后写入库存流水并更新结存成本。</p>
    </header>
    <article class="panel">
      <div class="toolbar">
        <el-button type="primary" v-perm="'inventory:adjustment:create'" @click="openAdd">新建调整单</el-button>
        <el-button @click="load">刷新</el-button>
        <span class="hint">共 {{ total }} 张单据</span>
      </div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="adjustNo" label="调整单号" width="180" />
        <el-table-column prop="adjustType" label="类型" width="110" />
        <el-table-column prop="warehouseId" label="仓库ID" width="100" />
        <el-table-column prop="totalQtyIn" label="盘盈数量" width="130" />
        <el-table-column prop="totalQtyOut" label="盘亏数量" width="130" />
        <el-table-column prop="totalAmount" label="金额" width="150" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="scope">
            <el-button link type="primary" @click="openDetail(scope.row)">明细</el-button>
            <el-button v-if="scope.row.status === 'DRAFT'" link type="primary" v-perm="'inventory:adjustment:post'" @click="handlePost(scope.row)">过账</el-button>
            <el-button v-if="scope.row.status === 'DRAFT'" link type="danger" v-perm="'inventory:adjustment:post'" @click="handleCancel(scope.row)">作废</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination v-model:current-page="query.page" v-model:page-size="query.pageSize" layout="total, sizes, prev, pager, next" :total="total" @current-change="handlePage" />
    </article>
    <el-dialog v-model="visible" title="新建库存调整单" width="900px">
      <el-form label-width="90px">
        <el-form-item label="调整类型">
          <el-select v-model="form.adjustType">
            <el-option label="盘盈" value="GAIN" />
            <el-option label="盘亏" value="LOSS" />
            <el-option label="系统差异" value="SYSTEM" />
          </el-select>
        </el-form-item>
        <el-form-item label="仓库">
          <el-select v-model="form.warehouseId" placeholder="选择仓库" filterable style="width: 240px">
            <el-option v-for="item in warehouses" :key="item.id" :label="`${item.warehouseCode} ${item.warehouseName}`" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="原因"><el-input v-model="form.reason" placeholder="盘盈盘亏原因说明" /></el-form-item>
      </el-form>
      <el-table :data="lines" size="small">
        <el-table-column label="商品" min-width="200">
          <template #default="scope">
            <el-select v-model="scope.row.productId" filterable placeholder="选择商品" size="small" style="width: 100%">
              <el-option v-for="item in products" :key="item.id" :label="`${item.productCode} ${item.productName}`" :value="item.id" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="批次号" width="140">
          <template #default="scope"><el-input v-model="scope.row.batchNo" size="small" /></template>
        </el-table-column>
        <el-table-column label="调整数量（正盈负亏）" width="180">
          <template #default="scope"><el-input v-model="scope.row.qty" size="small" placeholder="如 5 或 -2" /></template>
        </el-table-column>
        <el-table-column label="单位成本" width="140">
          <template #default="scope"><el-input v-model="scope.row.cost" size="small" placeholder="盘盈必填" /></template>
        </el-table-column>
        <el-table-column label="备注" min-width="140">
          <template #default="scope"><el-input v-model="scope.row.reason" size="small" /></template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="scope"><el-button link type="danger" @click="removeLine(scope.$index)">删除</el-button></template>
        </el-table-column>
      </el-table>
      <el-button class="add-line" @click="addLine">增加明细</el-button>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="save">保存草稿</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="detailVisible" title="调整明细" width="760px">
      <el-table :data="detail?.lines ?? []" size="small">
        <el-table-column prop="productId" label="商品ID" width="100" />
        <el-table-column prop="batchNo" label="批次" width="120" />
        <el-table-column prop="qty" label="数量" width="120" />
        <el-table-column prop="cost" label="成本" width="120" />
        <el-table-column prop="amount" label="金额" width="140" />
        <el-table-column prop="reason" label="备注" min-width="160" />
      </el-table>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; align-items: center; }
.hint { color: #646a73; font-size: 13px; }
.add-line { margin-top: 10px; }
.el-pagination { margin-top: 12px; justify-content: flex-end; }
</style>
