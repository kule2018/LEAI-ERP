<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createReceivable, fetchReceivables, reverseReceivable, type FinanceQuery, type Receivable } from '@/api/finance'

const rows = ref<Receivable[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<FinanceQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const form = reactive({ customerId: 0, amount: '0', sourceNo: '', dueDate: '' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchReceivables(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void { Object.assign(form, { customerId: 0, amount: '0', sourceNo: '', dueDate: '' }); visible.value = true }
async function save(): Promise<void> {
  try {
    await createReceivable({ ...form, dueDate: form.dueDate || undefined })
    visible.value = false
    ElMessage.success('应收单已创建')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
function progress(row: unknown): number {
  const item = row as Receivable
  const amount = Number(item.amount)
  return amount > 0 ? Math.round((Number(item.receivedAmount) / amount) * 100) : 0
}
async function handleReverse(row: unknown): Promise<void> {
  const item = row as Receivable
  try {
    const { value } = await ElMessageBox.prompt('请输入红冲原因', `红冲应收单 #${item.id}`, { inputPlaceholder: '如：退货冲销' })
    const result = await reverseReceivable(item.id, { reason: value })
    ElMessage.success(`已红冲，释放核销 ${result.releasedWriteoffAmount}`)
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
    <header class="page-header"><h2>应收账款</h2><p>销售审核自动生成的应收单，也支持手工登记。</p></header>
    <article class="panel">
      <div class="toolbar"><el-button type="primary" v-perm="'finance:receivable:create'" @click="openAdd">新增应收</el-button><el-button @click="load">刷新</el-button></div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="customerId" label="客户ID" width="110" />
        <el-table-column prop="sourceNo" label="来源单号" width="180" />
        <el-table-column prop="amount" label="金额" width="140" />
        <el-table-column prop="receivedAmount" label="已收金额" width="140" />
        <el-table-column label="收款进度" min-width="180"><template #default="{ row }"><el-progress :percentage="progress(row)" /></template></el-table-column>
        <el-table-column prop="dueDate" label="到期日" width="130" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column label="操作" width="110">
          <template #default="{ row }">
            <el-button link type="danger" :disabled="row.status === 'REVERSED' || row.status === 'RED'" v-perm="'finance:receivable:reverse'" @click="handleReverse(row)">红冲</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
    </article>
    <el-dialog v-model="visible" title="新增应收单" width="520px">
      <el-form label-width="90px">
        <el-form-item label="客户ID"><el-input-number v-model="form.customerId" :min="1" /></el-form-item>
        <el-form-item label="金额"><el-input v-model="form.amount" /></el-form-item>
        <el-form-item label="来源单号"><el-input v-model="form.sourceNo" /></el-form-item>
        <el-form-item label="到期日"><el-date-picker v-model="form.dueDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
