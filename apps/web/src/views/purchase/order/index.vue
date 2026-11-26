<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  approvePurchaseOrder, createPurchaseOrder, fetchPurchaseOrderDetail, fetchPurchaseOrders,
  submitPurchaseOrder, type PurchaseOrder, type PurchaseOrderLine
} from '@/api/purchase'
import type { PageQuery } from '@/types/contract'

interface LineDraft { productId: number; qty: string; unitPrice: string }
const rows = ref<PurchaseOrder[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const selected = ref<PurchaseOrder | null>(null)
const detail = ref<PurchaseOrderLine[]>([])
const visible = ref(false)
const submitting = ref(false)
const form = reactive({ supplierId: 0, warehouseId: 0, orderDate: '' })
const lines = ref<LineDraft[]>([{ productId: 0, qty: '1', unitPrice: '0' }])
let seq = 0

function lineValue(row: unknown, key: keyof LineDraft): string | number { const line = row as LineDraft; return line[key] }
function setLineValue(row: unknown, key: keyof LineDraft, value: string): void {
  const line = row as LineDraft
  if (key === 'productId') line.productId = Number(value) || 0
  else line[key] = value
}
async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchPurchaseOrders(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } catch (cause) { if (current === seq) error.value = cause instanceof Error ? cause.message : '加载失败' }
  finally { if (current === seq) loading.value = false }
}
async function openDetail(row: unknown): Promise<void> {
  const order = row as PurchaseOrder
  selected.value = order
  try { detail.value = (await fetchPurchaseOrderDetail(order.id)).lines }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '明细加载失败') }
}
function openAdd(): void {
  form.supplierId = 0
  form.warehouseId = 0
  form.orderDate = new Date().toISOString().slice(0, 10)
  lines.value = [{ productId: 0, qty: '1', unitPrice: '0' }]
  visible.value = true
}
async function save(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  try {
    await createPurchaseOrder({ supplierId: form.supplierId, warehouseId: form.warehouseId || undefined, orderDate: form.orderDate, lines: lines.value })
    visible.value = false
    ElMessage.success('采购订单已创建')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
  finally { submitting.value = false }
}
async function handleSubmit(row: unknown): Promise<void> {
  const order = row as PurchaseOrder
  try { await submitPurchaseOrder(order.id); ElMessage.success('已提交'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '提交失败') }
}
async function handleApprove(row: unknown): Promise<void> {
  const order = row as PurchaseOrder
  try { await approvePurchaseOrder(order.id); ElMessage.success('审核通过'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '审核失败') }
}
function isDraft(row: unknown): boolean { return (row as PurchaseOrder).status === 'DRAFT' }
function isSubmitted(row: unknown): boolean { return (row as PurchaseOrder).status === 'SUBMITTED' }
function handlePage(value: number): void { query.value.page = value; void load() }
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>采购订单</h2><p>下单前校验黑名单和资质；审核通过后进入收货状态。</p></header>
    <div class="workbench">
      <article class="panel">
        <div class="toolbar">
          <el-input v-model="query.keyword" placeholder="搜索采购单号" clearable @keyup.enter="load" />
          <el-button type="primary" v-perm="'purchase:order:create'" @click="openAdd">新建采购单</el-button>
          <el-button @click="load">刷新</el-button>
        </div>
        <div v-if="error" class="error">{{ error }}</div>
        <el-table v-loading="loading" :data="rows" row-key="id" highlight-current-row @row-click="openDetail">
          <el-table-column prop="orderNo" label="单号" width="170" />
          <el-table-column prop="supplierId" label="供应商ID" width="110" />
          <el-table-column prop="orderDate" label="日期" width="120" />
          <el-table-column prop="totalAmount" label="金额" width="140" />
          <el-table-column prop="status" label="状态" width="110" />
          <el-table-column label="操作" width="150">
            <template #default="{ row }">
              <el-button link type="primary" v-perm="'purchase:order:submit'" :disabled="!isDraft(row)" @click.stop="handleSubmit(row)">提交</el-button>
              <el-button link type="success" v-perm="'purchase:order:approve'" :disabled="!isSubmitted(row)" @click.stop="handleApprove(row)">审核</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
      </article>
      <article class="panel">
        <h3>订单明细</h3>
        <el-descriptions v-if="selected" :column="2" border>
          <el-descriptions-item label="单号">{{ selected.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="供应商ID">{{ selected.supplierId }}</el-descriptions-item>
          <el-descriptions-item label="金额">{{ selected.totalAmount }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ selected.status }}</el-descriptions-item>
        </el-descriptions>
        <el-table v-if="selected" :data="detail" size="small" class="detail-table">
          <el-table-column prop="productId" label="产品ID" />
          <el-table-column prop="qty" label="数量" />
          <el-table-column prop="unitPrice" label="单价" />
          <el-table-column prop="amount" label="金额" />
          <el-table-column prop="receivedQty" label="已收数量" />
        </el-table>
        <el-empty v-if="!selected" description="请选择左侧采购单" />
      </article>
    </div>
    <el-dialog v-model="visible" title="新建采购单" width="860px">
      <el-form label-width="90px">
        <el-form-item label="供应商ID"><el-input-number v-model="form.supplierId" :min="1" /></el-form-item>
        <el-form-item label="仓库ID"><el-input-number v-model="form.warehouseId" :min="0" /></el-form-item>
        <el-form-item label="订单日期"><el-date-picker v-model="form.orderDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
      </el-form>
      <el-table :data="lines" size="small">
        <el-table-column label="产品ID" width="130"><template #default="{ row }"><el-input :model-value="lineValue(row, 'productId')" @update:model-value="setLineValue(row, 'productId', $event)" /></template></el-table-column>
        <el-table-column label="数量" width="130"><template #default="{ row }"><el-input :model-value="lineValue(row, 'qty')" @update:model-value="setLineValue(row, 'qty', $event)" /></template></el-table-column>
        <el-table-column label="单价"><template #default="{ row }"><el-input :model-value="lineValue(row, 'unitPrice')" @update:model-value="setLineValue(row, 'unitPrice', $event)" /></template></el-table-column>
        <el-table-column width="70"><template #default><el-button link type="danger" :disabled="lines.length <= 1" @click="lines.pop()">删</el-button></template></el-table-column>
      </el-table>
      <el-button class="add-line" @click="lines.push({ productId: 0, qty: '1', unitPrice: '0' })">加行</el-button>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.workbench { display: grid; grid-template-columns: minmax(500px, 1.2fr) minmax(360px, 0.8fr); gap: 16px; }
.panel { min-width: 0; padding: 16px; background: #fff; border-radius: 8px; }
.panel h3 { margin: 0 0 16px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.error { color: #f5222d; margin-bottom: 12px; }
.detail-table { margin-top: 16px; }
.add-line { margin-top: 12px; }
@media (max-width: 1200px) { .workbench { grid-template-columns: 1fr; } }
</style>
