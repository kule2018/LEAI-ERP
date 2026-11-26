<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  completeWork, fetchWorkOrders, issueMaterial, reportWork, type ManufacturingQuery, type WorkOrder
} from '@/api/manufacturing'

const orders = ref<WorkOrder[]>([])
const selected = ref<WorkOrder | null>(null)
const query = ref<ManufacturingQuery>({ page: 1, pageSize: 200, keyword: '' })
const loading = ref(false)
const issueForm = reactive({ issueType: 'PICK', materialId: 0, qty: '1', batchNo: '' })
const reportForm = reactive({ operationId: 0, qty: '1', defectQty: '0' })
const completeForm = reactive({ qty: '1', qcResult: 'PENDING' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchWorkOrders(query.value)
    if (current !== seq) return
    orders.value = result.list.filter((order) => ['APPROVED', 'RUNNING', 'PARTIAL'].includes(order.status))
    if (!selected.value && orders.value.length > 0) selected.value = orders.value[0]
  } finally { if (current === seq) loading.value = false }
}
watch(selected, (value) => {
  if (value) completeForm.qty = value.qty
})
function selectRow(row: unknown): void { selected.value = row as WorkOrder }

async function handleIssue(): Promise<void> {
  if (!selected.value) return
  try {
    await issueMaterial(selected.value.id, { ...issueForm })
    ElMessage.success('领退料已过账')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '操作失败') }
}
async function handleReport(): Promise<void> {
  if (!selected.value) return
  try {
    await reportWork(selected.value.id, { ...reportForm })
    ElMessage.success('报工成功')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '报工失败') }
}
async function handleComplete(): Promise<void> {
  if (!selected.value) return
  try {
    await completeWork(selected.value.id, { ...completeForm })
    ElMessage.success('完工入库已过账')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '完工失败') }
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>工单执行</h2><p>领料、退料、报工和完工入库均在此执行；库存影响自动过账。</p></header>
    <div class="exec-layout">
      <article class="panel">
        <h3>可生产工单</h3>
        <el-table v-loading="loading" :data="orders" row-key="id" highlight-current-row @row-click="selectRow" size="small">
          <el-table-column prop="orderNo" label="工单号" width="160" />
          <el-table-column prop="productId" label="产品ID" width="100" />
          <el-table-column prop="qty" label="计划量" width="100" />
          <el-table-column prop="producedQty" label="已报工" width="100" />
          <el-table-column prop="status" label="状态" width="100" />
        </el-table>
      </article>
      <article class="panel">
        <h3>执行面板 · {{ selected?.orderNo ?? '未选择' }}</h3>
        <el-descriptions v-if="selected" :column="3" border class="summary">
          <el-descriptions-item label="计划量">{{ selected.qty }}</el-descriptions-item>
          <el-descriptions-item label="已报工">{{ selected.producedQty }}</el-descriptions-item>
          <el-descriptions-item label="已完工">{{ selected.actualQty }}</el-descriptions-item>
        </el-descriptions>
        <el-divider content-position="left">领料 / 退料</el-divider>
        <el-form inline>
          <el-form-item label="类型"><el-select v-model="issueForm.issueType"><el-option label="领料" value="PICK" /><el-option label="退料" value="RETURN" /></el-select></el-form-item>
          <el-form-item label="物料ID"><el-input-number v-model="issueForm.materialId" :min="1" /></el-form-item>
          <el-form-item label="数量"><el-input v-model="issueForm.qty" /></el-form-item>
          <el-form-item label="批次"><el-input v-model="issueForm.batchNo" /></el-form-item>
          <el-button type="primary" :disabled="!selected" v-perm="'mfg:issue:create'" @click="handleIssue">过账</el-button>
        </el-form>
        <el-divider content-position="left">报工</el-divider>
        <el-form inline>
          <el-form-item label="工序ID"><el-input-number v-model="reportForm.operationId" :min="0" /></el-form-item>
          <el-form-item label="合格量"><el-input v-model="reportForm.qty" /></el-form-item>
          <el-form-item label="不良量"><el-input v-model="reportForm.defectQty" /></el-form-item>
          <el-button type="primary" :disabled="!selected" v-perm="'mfg:report:create'" @click="handleReport">报工</el-button>
        </el-form>
        <el-divider content-position="left">完工入库</el-divider>
        <el-form inline>
          <el-form-item label="完工量"><el-input v-model="completeForm.qty" /></el-form-item>
          <el-form-item label="质检">
            <el-select v-model="completeForm.qcResult"><el-option label="待检" value="PENDING" /><el-option label="合格" value="PASS" /><el-option label="不合格" value="FAIL" /></el-select>
          </el-form-item>
          <el-button type="primary" :disabled="!selected" v-perm="'mfg:complete:create'" @click="handleComplete">完工过账</el-button>
        </el-form>
      </article>
    </div>
  </section>
</template>

<style scoped>
.exec-layout { display: grid; grid-template-columns: minmax(420px, 0.9fr) minmax(580px, 1.1fr); gap: 16px; }
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel h3 { margin: 0 0 16px; }
.summary { margin-bottom: 16px; }
@media (max-width: 1200px) { .exec-layout { grid-template-columns: 1fr; } }
</style>
