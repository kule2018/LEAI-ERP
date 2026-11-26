<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createInvoice, fetchInvoices, type FinanceQuery, type Invoice } from '@/api/finance'

const rows = ref<Invoice[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<FinanceQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const form = reactive({ invoiceNo: '', invoiceType: 'VAT', amount: '0', taxAmount: '0' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchInvoices(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void { Object.assign(form, { invoiceNo: '', invoiceType: 'VAT', amount: '0', taxAmount: '0' }); visible.value = true }
async function save(): Promise<void> {
  try { await createInvoice({ ...form }); visible.value = false; ElMessage.success('发票已保存'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>发票税务</h2><p>开票、认证、勾稽和红字发票入口。</p></header>
    <article class="panel">
      <div class="toolbar"><el-button type="primary" v-perm="'finance:invoice:create'" @click="openAdd">新增发票</el-button><el-button @click="load">刷新</el-button></div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="invoiceNo" label="发票号" width="200" />
        <el-table-column prop="invoiceType" label="类型" width="120" />
        <el-table-column prop="amount" label="金额" width="150" />
        <el-table-column prop="taxAmount" label="税额" width="140" />
        <el-table-column prop="status" label="状态" width="110" />
      </el-table>
    </article>
    <el-dialog v-model="visible" title="新增发票" width="520px">
      <el-form label-width="90px">
        <el-form-item label="发票号"><el-input v-model="form.invoiceNo" /></el-form-item>
        <el-form-item label="类型"><el-input v-model="form.invoiceType" /></el-form-item>
        <el-form-item label="金额"><el-input v-model="form.amount" /></el-form-item>
        <el-form-item label="税额"><el-input v-model="form.taxAmount" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
