<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createAccount, fetchAccounts, fetchAccountTransfers, fetchSubjects, transferAccount,
  type AccountTransfer, type FinanceQuery, type FinAccount, type Subject
} from '@/api/finance'

const rows = ref<FinAccount[]>([])
const transfers = ref<AccountTransfer[]>([])
const subjects = ref<Subject[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<FinanceQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const form = reactive({ accountCode: '', accountName: '', accountType: 'BANK', balance: '0' })
const transferVisible = ref(false)
const transferForm = reactive({
  fromAccountId: undefined as number | undefined,
  toAccountId: undefined as number | undefined,
  amount: '0',
  transferDate: new Date().toISOString().slice(0, 10),
  bankSubjectId: undefined as number | undefined,
  customEntries: false,
  entries: [] as Array<{ subjectId: number | undefined; summary: string; debit: string; credit: string }>,
  remark: ''
})
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchAccounts(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
async function loadTransfers(): Promise<void> {
  try { const result = await fetchAccountTransfers({ page: 1, pageSize: 50, keyword: '' }); transfers.value = result.list }
  catch { transfers.value = [] }
}
async function loadSubjects(): Promise<void> {
  try {
    const result = await fetchSubjects({ page: 1, pageSize: 200, keyword: '' })
    subjects.value = result.list.filter((item) => item.category === 'ASSET' || item.category === 'BANK')
  } catch { subjects.value = [] }
}
function openAdd(): void { Object.assign(form, { accountCode: '', accountName: '', accountType: 'BANK', balance: '0' }); visible.value = true }
async function save(): Promise<void> {
  try { await createAccount({ ...form }); visible.value = false; ElMessage.success('账户已创建'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
function openTransfer(): void {
  Object.assign(transferForm, {
    fromAccountId: undefined, toAccountId: undefined, amount: '0',
    transferDate: new Date().toISOString().slice(0, 10), bankSubjectId: undefined, customEntries: false,
    entries: [{ subjectId: undefined, summary: '', debit: '0', credit: '0' }], remark: ''
  })
  transferVisible.value = true
}
function addEntry(): void {
  transferForm.entries.push({ subjectId: undefined, summary: '', debit: '0', credit: '0' })
}
function removeEntry(index: number): void {
  transferForm.entries.splice(index, 1)
}
async function submitTransfer(): Promise<void> {
  if (!transferForm.fromAccountId || !transferForm.toAccountId) { ElMessage.warning('请选择转出与转入账户'); return }
  const entries = transferForm.customEntries
    ? transferForm.entries
      .filter((item) => item.subjectId && (Number(item.debit) !== 0 || Number(item.credit) !== 0))
      .map((item) => ({
        subjectId: item.subjectId as number,
        summary: item.summary || undefined,
        debit: item.debit,
        credit: item.credit
      }))
    : undefined
  const customEntries = entries ?? []
  if (transferForm.customEntries && customEntries.length === 0) { ElMessage.warning('请至少填写一条有效分录'); return }
  try {
    const result = await transferAccount({
      fromAccountId: transferForm.fromAccountId,
      toAccountId: transferForm.toAccountId,
      amount: transferForm.amount,
      transferDate: transferForm.transferDate,
      bankSubjectId: transferForm.customEntries ? undefined : transferForm.bankSubjectId,
      entries,
      remark: transferForm.remark || undefined
    })
    transferVisible.value = false
    ElMessage.success(`转账成功，凭证 ${result.voucherId ?? '未生成'}`)
    await load()
    await loadTransfers()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '转账失败') }
}
onMounted(async () => { await load(); await loadTransfers(); await loadSubjects() })
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>资金账户</h2><p>银行账户、现金账户、余额调节与账户间转账。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-button type="primary" v-perm="'finance:account:create'" @click="openAdd">新增账户</el-button>
        <el-button v-perm="'finance:account:update'" @click="openTransfer">账户间转账</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="accountCode" label="账户编码" width="150" />
        <el-table-column prop="accountName" label="账户名称" min-width="180" />
        <el-table-column prop="accountType" label="类型" width="120" />
        <el-table-column prop="balance" label="余额" width="160" />
        <el-table-column prop="status" label="状态" width="110" />
      </el-table>
    </article>
    <article class="panel">
      <h3>转账流水</h3>
      <el-table :data="transfers" row-key="id">
        <el-table-column prop="transferNo" label="转账单号" width="180" />
        <el-table-column prop="fromAccountId" label="转出账户ID" width="120" />
        <el-table-column prop="toAccountId" label="转入账户ID" width="120" />
        <el-table-column prop="amount" label="金额" width="150" />
        <el-table-column prop="transferDate" label="转账日期" width="130" />
        <el-table-column prop="voucherId" label="凭证ID" width="110" />
        <el-table-column prop="remark" label="备注" min-width="160" />
      </el-table>
    </article>
    <el-dialog v-model="visible" title="新增资金账户" width="520px">
      <el-form label-width="90px">
        <el-form-item label="编码"><el-input v-model="form.accountCode" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.accountName" /></el-form-item>
        <el-form-item label="类型"><el-select v-model="form.accountType"><el-option label="银行" value="BANK" /><el-option label="现金" value="CASH" /><el-option label="第三方" value="THIRD_PARTY" /></el-select></el-form-item>
        <el-form-item label="期初余额"><el-input v-model="form.balance" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
    <el-dialog v-model="transferVisible" title="账户间转账" width="560px">
      <el-form label-width="110px">
        <el-form-item label="转出账户">
          <el-select v-model="transferForm.fromAccountId" placeholder="选择账户" filterable style="width: 100%">
            <el-option v-for="item in rows" :key="item.id" :label="`${item.accountCode} ${item.accountName}`" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="转入账户">
          <el-select v-model="transferForm.toAccountId" placeholder="选择账户" filterable style="width: 100%">
            <el-option v-for="item in rows" :key="item.id" :label="`${item.accountCode} ${item.accountName}`" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="金额"><el-input v-model="transferForm.amount" /></el-form-item>
        <el-form-item label="转账日期"><el-date-picker v-model="transferForm.transferDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
        <el-form-item label="银行存款科目">
          <el-select v-model="transferForm.bankSubjectId" placeholder="可选，填写后生成凭证" filterable clearable style="width: 100%" :disabled="transferForm.customEntries">
            <el-option v-for="item in subjects" :key="item.id" :label="`${item.subjectCode} ${item.subjectName}`" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="自定义分录">
          <el-switch v-model="transferForm.customEntries" />
          <span style="margin-left: 8px; color: #909399">开启后可按科目拆分的借贷分录生成转账凭证</span>
        </el-form-item>
        <el-form-item v-if="transferForm.customEntries" label="凭证分录">
          <el-table :data="transferForm.entries" size="small" style="width: 100%">
            <el-table-column label="科目" min-width="180">
              <template #default="{ row }">
                <el-select v-model="row.subjectId" filterable placeholder="选择科目" style="width: 100%">
                  <el-option v-for="item in subjects" :key="item.id" :label="`${item.subjectCode} ${item.subjectName}`" :value="item.id" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="摘要" min-width="140">
              <template #default="{ row }"><el-input v-model="row.summary" /></template>
            </el-table-column>
            <el-table-column label="借方" width="120">
              <template #default="{ row }"><el-input v-model="row.debit" /></template>
            </el-table-column>
            <el-table-column label="贷方" width="120">
              <template #default="{ row }"><el-input v-model="row.credit" /></template>
            </el-table-column>
            <el-table-column label="操作" width="70">
              <template #default="{ $index }"><el-button link type="danger" @click="removeEntry($index)">删除</el-button></template>
            </el-table-column>
          </el-table>
          <el-button style="margin-top: 8px" @click="addEntry">新增分录</el-button>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="transferForm.remark" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="transferVisible = false">取消</el-button><el-button type="primary" @click="submitTransfer">确认转账</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; margin-bottom: 16px; }
.panel h3 { margin: 0 0 12px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
