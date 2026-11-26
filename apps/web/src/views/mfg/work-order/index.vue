<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  approveWorkOrder, createWorkOrder, fetchWorkOrderDetail, fetchWorkOrders,
  submitWorkOrder, type ManufacturingQuery, type WorkOrder
} from '@/api/manufacturing'

const rows = ref<WorkOrder[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<ManufacturingQuery>({ page: 1, pageSize: 20, keyword: '' })
const selected = ref<WorkOrder | null>(null)
const detail = ref<Record<string, unknown> | null>(null)
const visible = ref(false)
const form = reactive({ productId: 0, bomId: 0, routingId: 0, warehouseId: 0, qty: '1' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchWorkOrders(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
async function openDetail(row: unknown): Promise<void> {
  const order = row as WorkOrder
  selected.value = order
  try { detail.value = await fetchWorkOrderDetail(order.id) }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '详情加载失败') }
}
function openAdd(): void { Object.assign(form, { productId: 0, bomId: 0, routingId: 0, warehouseId: 0, qty: '1' }); visible.value = true }
async function save(): Promise<void> {
  try {
    await createWorkOrder({ ...form, bomId: form.bomId || undefined, routingId: form.routingId || undefined })
    visible.value = false
    ElMessage.success('工单已创建')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
async function submit(row: unknown): Promise<void> {
  const order = row as WorkOrder
  try { await submitWorkOrder(order.id); ElMessage.success('已提交'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '提交失败') }
}
async function approve(row: unknown): Promise<void> {
  const order = row as WorkOrder
  try { await approveWorkOrder(order.id); ElMessage.success('已审核'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '审核失败') }
}
function isDraft(row: unknown): boolean { return (row as WorkOrder).status === 'DRAFT' }
function isSubmitted(row: unknown): boolean { return (row as WorkOrder).status === 'SUBMITTED' }
function handlePage(value: number): void { query.value.page = value; void load() }
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>生产工单</h2><p>工单状态机驱动领料、报工和完工入库。</p></header>
    <div class="wo-layout">
      <article class="panel">
        <div class="toolbar">
          <el-button type="primary" v-perm="'mfg:work-order:create'" @click="openAdd">新建工单</el-button>
          <el-button @click="load">刷新</el-button>
        </div>
        <el-table v-loading="loading" :data="rows" row-key="id" highlight-current-row @row-click="openDetail">
          <el-table-column prop="orderNo" label="工单号" width="170" />
          <el-table-column prop="productId" label="产品ID" width="100" />
          <el-table-column prop="qty" label="计划量" width="110" />
          <el-table-column prop="producedQty" label="已报工" width="110" />
          <el-table-column prop="actualQty" label="已完工" width="110" />
          <el-table-column prop="status" label="状态" width="110" />
          <el-table-column label="操作" width="150">
            <template #default="{ row }">
              <el-button link type="primary" :disabled="!isDraft(row)" @click.stop="submit(row)">提交</el-button>
              <el-button link type="success" :disabled="!isSubmitted(row)" @click.stop="approve(row)">审核</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
      </article>
      <article class="panel">
        <h3>工单详情</h3>
        <el-descriptions v-if="selected" :column="2" border>
          <el-descriptions-item label="工单号">{{ selected.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="产品ID">{{ selected.productId }}</el-descriptions-item>
          <el-descriptions-item label="计划量">{{ selected.qty }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ selected.status }}</el-descriptions-item>
        </el-descriptions>
        <el-empty v-if="!selected" description="请选择左侧工单" />
      </article>
    </div>
    <el-dialog v-model="visible" title="新建生产工单" width="560px">
      <el-form label-width="90px">
        <el-form-item label="产品ID"><el-input-number v-model="form.productId" :min="1" /></el-form-item>
        <el-form-item label="BOM ID"><el-input-number v-model="form.bomId" :min="0" /></el-form-item>
        <el-form-item label="工艺ID"><el-input-number v-model="form.routingId" :min="0" /></el-form-item>
        <el-form-item label="仓库ID"><el-input-number v-model="form.warehouseId" :min="1" /></el-form-item>
        <el-form-item label="数量"><el-input v-model="form.qty" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.wo-layout { display: grid; grid-template-columns: minmax(520px, 1.2fr) minmax(320px, 0.8fr); gap: 16px; }
.panel { min-width: 0; padding: 16px; background: #fff; border-radius: 8px; }
.panel h3 { margin: 0 0 16px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
@media (max-width: 1200px) { .wo-layout { grid-template-columns: 1fr; } }
</style>
