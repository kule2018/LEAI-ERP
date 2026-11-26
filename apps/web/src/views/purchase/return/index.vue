<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createPurchaseReturn, fetchPurchaseReturns } from '@/api/purchase'
import type { PageQuery } from '@/types/contract'

const rows = ref<Array<Record<string, unknown>>>([])
const total = ref(0)
const loading = ref(false)
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const form = reactive({ supplierId: 0, receiptId: 0, reason: '' })
const lines = ref([{ productId: 0, qty: '1', amount: '0' }])
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchPurchaseReturns(query.value)
    if (current !== seq) return
    rows.value = result.list as unknown as Array<Record<string, unknown>>
    total.value = result.total
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '加载失败') }
  finally { if (current === seq) loading.value = false }
}
function openAdd(): void {
  Object.assign(form, { supplierId: 0, receiptId: 0, reason: '' })
  lines.value = [{ productId: 0, qty: '1', amount: '0' }]
  visible.value = true
}
async function save(): Promise<void> {
  try {
    await createPurchaseReturn({ supplierId: form.supplierId, receiptId: form.receiptId || undefined, reason: form.reason, lines: lines.value })
    visible.value = false
    ElMessage.success('退货单已创建')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>采购退货</h2><p>退货给供应商并冲减应付金额，库存回补将在库存阶段联动。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-input v-model="query.keyword" placeholder="搜索退货单" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'purchase:return:create'" @click="openAdd">新建退货</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="returnNo" label="退货单号" width="170" />
        <el-table-column prop="supplierId" label="供应商ID" width="110" />
        <el-table-column prop="receiptId" label="收货单ID" width="110" />
        <el-table-column prop="reason" label="原因" min-width="180" />
        <el-table-column prop="refundAmount" label="退款金额" width="140" />
        <el-table-column prop="status" label="状态" width="110" />
      </el-table>
    </article>
    <el-dialog v-model="visible" title="新建采购退货" width="760px">
      <el-form label-width="90px">
        <el-form-item label="供应商ID"><el-input-number v-model="form.supplierId" :min="1" /></el-form-item>
        <el-form-item label="收货单ID"><el-input-number v-model="form.receiptId" :min="0" /></el-form-item>
        <el-form-item label="退货原因"><el-input v-model="form.reason" /></el-form-item>
      </el-form>
      <el-table :data="lines" size="small">
        <el-table-column label="产品ID" width="130"><template #default="{ row }"><el-input v-model="row.productId" /></template></el-table-column>
        <el-table-column label="数量" width="120"><template #default="{ row }"><el-input v-model="row.qty" /></template></el-table-column>
        <el-table-column label="金额"><template #default="{ row }"><el-input v-model="row.amount" /></template></el-table-column>
        <el-table-column width="70"><template #default><el-button link type="danger" :disabled="lines.length <= 1" @click="lines.pop()">删</el-button></template></el-table-column>
      </el-table>
      <el-button class="add-line" @click="lines.push({ productId: 0, qty: '1', amount: '0' })">加行</el-button>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.add-line { margin-top: 12px; }
</style>
