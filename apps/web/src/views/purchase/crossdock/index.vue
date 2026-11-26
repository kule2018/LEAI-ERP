<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createCrossDock, fetchCrossDocks, transitionCrossDock, type CrossDock
} from '@/api/purchase-p1'

const rows = ref<CrossDock[]>([])
const form = reactive({
  supplierId: undefined as number | undefined,
  purchaseOrderId: undefined as number | undefined,
  saleOrderId: undefined as number | undefined,
  customerId: undefined as number | undefined,
  productId: undefined as number | undefined,
  qty: '',
  remark: ''
})

async function load(): Promise<void> {
  const result = await fetchCrossDocks({ page: 1, pageSize: 50 })
  rows.value = result.list
}

async function submit(): Promise<void> {
  if (!form.supplierId || !form.productId || !form.qty) {
    ElMessage.warning('请填写供应商、产品与数量')
    return
  }
  await createCrossDock({
    ...form,
    purchaseOrderId: form.purchaseOrderId || undefined,
    saleOrderId: form.saleOrderId || undefined,
    customerId: form.customerId || undefined
  })
  ElMessage.success('越库单已创建')
  await load()
}

async function transition(row: CrossDock, action: string): Promise<void> {
  await transitionCrossDock(row.id, action)
  ElMessage.success(`越库单已${action === 'SHIPPED' ? '发运' : action === 'COMPLETED' ? '完成' : '作废'}`)
  await load()
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>越库直发</h2>
      <p>供应商到货直接转发客户，不入库；数量受采购订单到货量与已越库量约束。</p>
    </header>
    <article class="panel form-panel">
      <el-form :inline="true">
        <el-form-item label="供应商ID"><el-input-number v-model="form.supplierId" :min="1" /></el-form-item>
        <el-form-item label="采购单ID"><el-input-number v-model="form.purchaseOrderId" :min="1" /></el-form-item>
        <el-form-item label="销售单ID"><el-input-number v-model="form.saleOrderId" :min="1" /></el-form-item>
        <el-form-item label="客户ID"><el-input-number v-model="form.customerId" :min="1" /></el-form-item>
        <el-form-item label="产品ID"><el-input-number v-model="form.productId" :min="1" /></el-form-item>
        <el-form-item label="数量"><el-input v-model="form.qty" placeholder="如 100" /></el-form-item>
        <el-form-item><el-button type="primary" v-perm="'purchase:crossdock:create'" @click="submit">创建越库单</el-button></el-form-item>
      </el-form>
    </article>
    <article class="panel">
      <el-table :data="rows" size="small">
        <el-table-column prop="crossdockNo" label="越库单号" width="170" />
        <el-table-column prop="supplierId" label="供应商" width="110" />
        <el-table-column prop="productId" label="产品" width="100" />
        <el-table-column prop="qty" label="数量" width="110" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column label="操作" width="220">
          <template #default="{ row }">
            <el-button link type="primary" :disabled="row.status !== 'PENDING'" v-perm="'purchase:crossdock:create'" @click="transition(row, 'SHIPPED')">发运</el-button>
            <el-button link type="success" :disabled="row.status !== 'SHIPPED'" v-perm="'purchase:crossdock:create'" @click="transition(row, 'COMPLETED')">完成</el-button>
            <el-button link type="danger" :disabled="row.status !== 'PENDING'" v-perm="'purchase:crossdock:create'" @click="transition(row, 'CANCELLED')">作废</el-button>
          </template>
        </el-table-column>
      </el-table>
    </article>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; margin-bottom: 16px; }
.form-panel { max-width: 1100px; }
</style>
