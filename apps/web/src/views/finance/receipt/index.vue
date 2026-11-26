<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createReceipt, fetchReceipts, fetchReceivables, reverseReceipt, type FinanceQuery, type Receipt, type Receivable } from '@/api/finance'

const rows = ref<Receipt[]>([])
const ars = ref<Receivable[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<FinanceQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const form = reactive({ customerId: 0, accountId: 0, amount: '0', receivedAt: '', arId: 0, writeoffAmount: '0' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const [receiptResult, arResult] = await Promise.all([fetchReceipts(query.value), fetchReceivables({ page: 1, pageSize: 200 })])
    if (current !== seq) return
    rows.value = receiptResult.list
    total.value = receiptResult.total
    ars.value = arResult.list.filter((item) => item.status !== 'CLOSED')
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void {
  Object.assign(form, { customerId: 0, accountId: 0, amount: '0', receivedAt: new Date().toISOString().slice(0, 10), arId: 0, writeoffAmount: '0' })
  visible.value = true
}
async function save(): Promise<void> {
  try {
    await createReceipt({
      customerId: form.customerId,
      accountId: form.accountId,
      amount: form.amount,
      receivedAt: form.receivedAt,
      writeoffs: form.arId ? [{ bizType: 'RECEIVABLE', bizId: form.arId, amount: form.writeoffAmount }] : []
    })
    visible.value = false
    ElMessage.success('收款单已保存')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
async function handleReverse(row: unknown): Promise<void> {
  const item = row as Receipt
  try {
    const { value } = await ElMessageBox.prompt('请输入红冲原因', `红冲收款单 ${item.receiptNo}`, { inputPlaceholder: '如：收款退回' })
    const result = await reverseReceipt(item.id, { reason: value })
    ElMessage.success(`已红冲，账户余额 ${result.accountBalance ?? '-'}，释放核销 ${result.releasedWriteoffAmount}`)
    await load()
  } catch (cause) {
    if (cause === 'cancel' || cause === 'close') return
    ElMessage.error(cause instanceof Error ? cause.message : '红冲失败')
  }
}
function handlePage(value: number): void { query.value.page = value; void load() }
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>收款单</h2><p>收款更新资金账户余额，并可核销指定应收单。</p></header>
    <article class="panel">
      <div class="toolbar"><el-button type="primary" v-perm="'finance:receipt:create'" @click="openAdd">新增收款</el-button><el-button @click="load">刷新</el-button></div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="receiptNo" label="收款单号" width="180" />
        <el-table-column prop="customerId" label="客户ID" width="110" />
        <el-table-column prop="accountId" label="账户ID" width="110" />
        <el-table-column prop="amount" label="金额" width="140" />
        <el-table-column prop="receivedAt" label="收款日期" width="130" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column label="操作" width="110">
          <template #default="{ row }">
            <el-button link type="danger" :disabled="row.status === 'REVERSED' || row.status === 'RED'" v-perm="'finance:receipt:reverse'" @click="handleReverse(row)">红冲</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
    </article>
    <el-dialog v-model="visible" title="新增收款" width="560px">
      <el-form label-width="90px">
        <el-form-item label="客户ID"><el-input-number v-model="form.customerId" :min="1" /></el-form-item>
        <el-form-item label="账户ID"><el-input-number v-model="form.accountId" :min="1" /></el-form-item>
        <el-form-item label="收款金额"><el-input v-model="form.amount" /></el-form-item>
        <el-form-item label="收款日期"><el-input v-model="form.receivedAt" /></el-form-item>
        <el-form-item label="核销应收">
          <el-select v-model="form.arId" clearable>
            <el-option v-for="item in ars" :key="item.id" :label="`#${item.id} ${item.sourceNo || ''} ${item.amount}`" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="核销金额"><el-input v-model="form.writeoffAmount" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
