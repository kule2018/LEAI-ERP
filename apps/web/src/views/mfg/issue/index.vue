<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchWorkOrders, issueMaterial, type ManufacturingQuery, type WorkOrder } from '@/api/manufacturing'

const orders = ref<WorkOrder[]>([])
const query = ref<ManufacturingQuery>({ page: 1, pageSize: 200, keyword: '' })
const loading = ref(false)
const form = reactive({ issueType: 'PICK', materialId: 0, qty: '1', batchNo: '' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchWorkOrders(query.value)
    if (current !== seq) return
    orders.value = result.list.filter((order) => ['APPROVED', 'RUNNING', 'PARTIAL'].includes(order.status))
  } finally { if (current === seq) loading.value = false }
}
async function handleIssue(row: unknown): Promise<void> {
  const order = row as WorkOrder
  try { await issueMaterial(order.id, { ...form }); ElMessage.success('领退料已过账'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '操作失败') }
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>领料 / 退料</h2><p>领料生成 MFG_PICK 出库流水，退料生成 MFG_RETURN 入库流水。</p></header>
    <article class="panel">
      <el-form inline class="form-bar">
        <el-form-item label="类型"><el-select v-model="form.issueType"><el-option label="领料" value="PICK" /><el-option label="退料" value="RETURN" /></el-select></el-form-item>
        <el-form-item label="物料ID"><el-input-number v-model="form.materialId" :min="1" /></el-form-item>
        <el-form-item label="数量"><el-input v-model="form.qty" /></el-form-item>
        <el-form-item label="批次"><el-input v-model="form.batchNo" /></el-form-item>
      </el-form>
      <el-table v-loading="loading" :data="orders" row-key="id" size="small">
        <el-table-column prop="orderNo" label="工单号" width="180" />
        <el-table-column prop="productId" label="产品ID" width="110" />
        <el-table-column prop="qty" label="计划量" width="120" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column label="操作" width="100"><template #default="{ row }"><el-button link type="primary" v-perm="'mfg:issue:create'" @click="handleIssue(row)">过账</el-button></template></el-table-column>
      </el-table>
    </article>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.form-bar { margin-bottom: 16px; }
</style>
