<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createVendorStatement, fetchVendorStatements, settleVendorStatement, type VendorStatement } from '@/api/purchase'
import type { PageQuery } from '@/types/contract'

const rows = ref<VendorStatement[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const createVisible = ref(false)
const settleVisible = ref(false)
const selected = ref<VendorStatement | null>(null)
const form = reactive({ supplierId: 0, period: '', amount: '0' })
const settleForm = reactive({ amount: '' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchVendorStatements(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } catch (cause) { if (current === seq) error.value = cause instanceof Error ? cause.message : '加载失败' }
  finally { if (current === seq) loading.value = false }
}
function openCreate(): void {
  form.supplierId = 0
  form.period = new Date().toISOString().slice(0, 7)
  form.amount = '0'
  createVisible.value = true
}
async function save(): Promise<void> {
  try {
    await createVendorStatement({ ...form })
    createVisible.value = false
    ElMessage.success('账单已生成')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
function openSettle(row: unknown): void {
  const statement = row as VendorStatement
  selected.value = statement
  settleForm.amount = String(Math.max(0, Number(statement.amount) - Number(statement.settledAmount)))
  settleVisible.value = true
}
async function handleSettle(): Promise<void> {
  if (!selected.value) return
  try {
    await settleVendorStatement(selected.value.id, settleForm.amount)
    settleVisible.value = false
    ElMessage.success('核销成功')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '核销失败') }
}
function progress(row: unknown): number {
  const statement = row as VendorStatement
  const amount = Number(statement.amount)
  return amount > 0 ? Math.round((Number(statement.settledAmount) / amount) * 100) : 0
}
function handlePage(value: number): void { query.value.page = value; void load() }
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>供应商对账</h2><p>按供应商期间生成应付账单，支持部分核销。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-input v-model="query.keyword" placeholder="搜索账单" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'purchase:statement:create'" @click="openCreate">生成账单</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <div v-if="error" class="error">{{ error }}</div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="statementNo" label="账单号" width="170" />
        <el-table-column prop="supplierId" label="供应商ID" width="110" />
        <el-table-column prop="period" label="期间" width="110" />
        <el-table-column prop="amount" label="金额" width="140" />
        <el-table-column prop="settledAmount" label="已核销" width="140" />
        <el-table-column label="进度" min-width="180"><template #default="{ row }"><el-progress :percentage="progress(row)" /></template></el-table-column>
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column label="操作" width="90"><template #default="{ row }"><el-button link type="primary" v-perm="'purchase:statement:settle'" @click="openSettle(row)">核销</el-button></template></el-table-column>
      </el-table>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
    </article>
    <el-dialog v-model="createVisible" title="生成供应商账单" width="500px">
      <el-form label-width="90px">
        <el-form-item label="供应商ID"><el-input-number v-model="form.supplierId" :min="1" /></el-form-item>
        <el-form-item label="期间"><el-date-picker v-model="form.period" type="month" value-format="YYYY-MM" placeholder="YYYY-MM"  /></el-form-item>
        <el-form-item label="金额"><el-input v-model="form.amount" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="createVisible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
    <el-dialog v-model="settleVisible" title="核销账单" width="460px">
      <el-form label-width="90px"><el-form-item label="核销金额"><el-input v-model="settleForm.amount" /></el-form-item></el-form>
      <template #footer><el-button @click="settleVisible = false">取消</el-button><el-button type="primary" @click="handleSettle">确认</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.error { color: #f5222d; margin-bottom: 12px; }
</style>
