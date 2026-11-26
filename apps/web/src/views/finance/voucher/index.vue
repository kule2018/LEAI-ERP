<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createVoucher, fetchVoucherDetail, fetchVouchers, postVoucher, reverseVoucher, unpostVoucher, voidVoucher, type FinanceQuery, type Voucher } from '@/api/finance'

const rows = ref<Voucher[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<FinanceQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const detailVisible = ref(false)
const detail = ref<Array<Record<string, unknown>>>([])
const form = reactive({ voucherDate: '', period: '', remark: '' })
const entries = ref([{ subjectId: 0, summary: '', debit: '0', credit: '0' }])
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchVouchers(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void {
  const now = new Date().toISOString().slice(0, 10)
  Object.assign(form, { voucherDate: now, period: now.slice(0, 7), remark: '' })
  entries.value = [{ subjectId: 0, summary: '', debit: '0', credit: '0' }, { subjectId: 0, summary: '', debit: '0', credit: '0' }]
  visible.value = true
}
async function save(): Promise<void> {
  try {
    await createVoucher({ ...form, entries: entries.value })
    visible.value = false
    ElMessage.success('凭证已保存')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
async function openDetail(row: unknown): Promise<void> {
  const voucher = row as Voucher
  try {
    const result = await fetchVoucherDetail(voucher.id)
    detail.value = result.entries as unknown as Array<Record<string, unknown>>
    detailVisible.value = true
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '详情加载失败') }
}
async function handlePost(row: unknown): Promise<void> {
  const voucher = row as Voucher
  try { await postVoucher(voucher.id); ElMessage.success('已过账'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '过账失败') }
}
async function handleReverse(row: unknown): Promise<void> {
  const voucher = row as Voucher
  try { await reverseVoucher(voucher.id); ElMessage.success('已红冲'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '红冲失败') }
}
async function handleUnpost(row: unknown): Promise<void> {
  const voucher = row as Voucher
  try { await unpostVoucher(voucher.id); ElMessage.success('已反审核'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '反审核失败') }
}
async function handleVoid(row: unknown): Promise<void> {
  const voucher = row as Voucher
  try { await voidVoucher(voucher.id); ElMessage.success('已作废'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '作废失败') }
}
function handlePage(value: number): void { query.value.page = value; void load() }
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>凭证</h2><p>借贷分录必须平衡；过账后不可直接修改，只能红冲。</p></header>
    <article class="panel">
      <div class="toolbar"><el-button type="primary" v-perm="'finance:voucher:create'" @click="openAdd">新增凭证</el-button><el-button @click="load">刷新</el-button></div>
      <el-table v-loading="loading" :data="rows" row-key="id" @row-click="openDetail">
        <el-table-column prop="voucherNo" label="凭证号" width="170" />
        <el-table-column prop="voucherDate" label="日期" width="130" />
        <el-table-column prop="period" label="期间" width="110" />
        <el-table-column prop="totalDebit" label="借方合计" width="140" />
        <el-table-column prop="totalCredit" label="贷方合计" width="140" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column label="操作" width="230">
          <template #default="{ row }">
            <el-button link type="success" :disabled="row.status !== 'DRAFT'" v-perm="'finance:voucher:post'" @click.stop="handlePost(row)">过账</el-button>
            <el-button link type="warning" :disabled="row.status !== 'POSTED'" v-perm="'finance:voucher:reverse'" @click.stop="handleUnpost(row)">反审核</el-button>
            <el-button link type="danger" :disabled="row.status !== 'POSTED'" v-perm="'finance:voucher:reverse'" @click.stop="handleReverse(row)">红冲</el-button>
            <el-button link type="info" :disabled="row.status !== 'DRAFT'" v-perm="'finance:voucher:void'" @click.stop="handleVoid(row)">作废</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
    </article>
    <el-dialog v-model="visible" title="新增凭证" width="900px">
      <el-form label-width="90px" inline>
        <el-form-item label="日期"><el-date-picker v-model="form.voucherDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
        <el-form-item label="期间"><el-date-picker v-model="form.period" type="month" value-format="YYYY-MM" placeholder="YYYY-MM"  /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" /></el-form-item>
      </el-form>
      <el-table :data="entries" size="small">
        <el-table-column label="科目ID" width="140"><template #default="{ row }"><el-input v-model="row.subjectId" /></template></el-table-column>
        <el-table-column label="摘要" min-width="180"><template #default="{ row }"><el-input v-model="row.summary" /></template></el-table-column>
        <el-table-column label="借方" width="130"><template #default="{ row }"><el-input v-model="row.debit" /></template></el-table-column>
        <el-table-column label="贷方" width="130"><template #default="{ row }"><el-input v-model="row.credit" /></template></el-table-column>
        <el-table-column width="70"><template #default><el-button link type="danger" :disabled="entries.length <= 2" @click="entries.pop()">删</el-button></template></el-table-column>
      </el-table>
      <el-button class="add-line" @click="entries.push({ subjectId: 0, summary: '', debit: '0', credit: '0' })">加行</el-button>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
    <el-dialog v-model="detailVisible" title="凭证明细" width="780px">
      <el-table :data="detail" size="small">
        <el-table-column prop="subjectId" label="科目ID" width="120" />
        <el-table-column prop="summary" label="摘要" min-width="200" />
        <el-table-column prop="debit" label="借方" width="130" />
        <el-table-column prop="credit" label="贷方" width="130" />
      </el-table>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.add-line { margin-top: 12px; }
</style>
