<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  approveSupplierFine, createSupplierFine, deductSupplierFine, fetchSupplierFines, type SupplierFine
} from '@/api/purchase-p1'

const rows = ref<SupplierFine[]>([])
const form = reactive({
  supplierId: undefined as number | undefined,
  purchaseOrderId: undefined as number | undefined,
  fineType: 'QUALITY',
  amount: '',
  reason: ''
})

async function load(): Promise<void> {
  const result = await fetchSupplierFines({ page: 1, pageSize: 50 })
  rows.value = result.list
}

async function submit(): Promise<void> {
  if (!form.supplierId || !form.amount) {
    ElMessage.warning('请填写供应商与罚款金额')
    return
  }
  await createSupplierFine({
    ...form,
    purchaseOrderId: form.purchaseOrderId || undefined
  })
  ElMessage.success('罚款单已创建')
  await load()
}

async function approve(row: SupplierFine): Promise<void> {
  await approveSupplierFine(row.id)
  ElMessage.success('罚款单已审批')
  await load()
}

async function deduct(row: SupplierFine): Promise<void> {
  try {
    const { value } = await ElMessageBox.prompt(`可扣款余额 ${Number(row.amount) - Number(row.deductedAmount)}`, `扣款 ${row.fineNo}`, {
      inputPattern: /^\d+(\.\d{1,4})?$/,
      inputErrorMessage: '请输入合法金额'
    })
    await deductSupplierFine(row.id, Number(value))
    ElMessage.success('扣款已登记')
    await load()
  } catch (cause) {
    if (cause === 'cancel' || cause === 'close') return
    throw cause
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>供应商罚款</h2>
      <p>登记质量/交期等罚款，审批后登记扣款，累计扣款不得超过罚款金额。</p>
    </header>
    <article class="panel form-panel">
      <el-form :inline="true">
        <el-form-item label="供应商ID"><el-input-number v-model="form.supplierId" :min="1" /></el-form-item>
        <el-form-item label="采购单ID"><el-input-number v-model="form.purchaseOrderId" :min="1" /></el-form-item>
        <el-form-item label="罚款类型">
          <el-select v-model="form.fineType" style="width: 130px">
            <el-option label="质量罚款" value="QUALITY" />
            <el-option label="交期罚款" value="DELAY" />
            <el-option label="其他" value="OTHER" />
          </el-select>
        </el-form-item>
        <el-form-item label="金额"><el-input v-model="form.amount" /></el-form-item>
        <el-form-item label="原因"><el-input v-model="form.reason" /></el-form-item>
        <el-form-item><el-button type="primary" v-perm="'purchase:fine:create'" @click="submit">登记罚款</el-button></el-form-item>
      </el-form>
    </article>
    <article class="panel">
      <el-table :data="rows" size="small">
        <el-table-column prop="fineNo" label="罚款单号" width="170" />
        <el-table-column prop="supplierId" label="供应商" width="110" />
        <el-table-column prop="fineType" label="类型" width="110" />
        <el-table-column prop="amount" label="罚款金额" width="130" />
        <el-table-column prop="deductedAmount" label="已扣款" width="130" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column prop="reason" label="原因" min-width="180" />
        <el-table-column label="操作" width="170">
          <template #default="{ row }">
            <el-button link type="success" :disabled="row.status !== 'PENDING'" v-perm="'purchase:fine:approve'" @click="approve(row)">审批</el-button>
            <el-button link type="warning" :disabled="row.status === 'PENDING' || row.status === 'DEDUCTED'" v-perm="'purchase:fine:approve'" @click="deduct(row)">扣款</el-button>
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
