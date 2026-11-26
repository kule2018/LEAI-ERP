<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { completeWork, fetchWorkOrders, type ManufacturingQuery, type WorkOrder } from '@/api/manufacturing'

const orders = ref<WorkOrder[]>([])
const query = ref<ManufacturingQuery>({ page: 1, pageSize: 200, keyword: '' })
const loading = ref(false)
const form = reactive({ qty: '1', qcResult: 'PENDING' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchWorkOrders(query.value)
    if (current !== seq) return
    orders.value = result.list.filter((order) => ['RUNNING', 'PARTIAL'].includes(order.status))
  } finally { if (current === seq) loading.value = false }
}
async function handleComplete(row: unknown): Promise<void> {
  const order = row as WorkOrder
  try {
    await completeWork(order.id, { qty: form.qty || order.qty, qcResult: form.qcResult })
    ElMessage.success('完工入库已过账')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '完工失败') }
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>完工入库</h2><p>按已报工数量完工，生成 FINISH_IN 库存流水。</p></header>
    <article class="panel">
      <el-form inline class="form-bar">
        <el-form-item label="默认完工量"><el-input v-model="form.qty" /></el-form-item>
        <el-form-item label="质检结果">
          <el-select v-model="form.qcResult"><el-option label="待检" value="PENDING" /><el-option label="合格" value="PASS" /><el-option label="不合格" value="FAIL" /></el-select>
        </el-form-item>
      </el-form>
      <el-table v-loading="loading" :data="orders" row-key="id" size="small">
        <el-table-column prop="orderNo" label="工单号" width="180" />
        <el-table-column prop="productId" label="产品ID" width="110" />
        <el-table-column prop="qty" label="计划量" width="120" />
        <el-table-column prop="producedQty" label="已报工" width="120" />
        <el-table-column prop="actualQty" label="已完工" width="120" />
        <el-table-column label="操作" width="100"><template #default="{ row }"><el-button link type="primary" v-perm="'mfg:complete:create'" @click="handleComplete(row)">完工</el-button></template></el-table-column>
      </el-table>
    </article>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.form-bar { margin-bottom: 16px; }
</style>
