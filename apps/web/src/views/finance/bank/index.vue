<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createBankConnection, fetchAccounts, fetchBankConnections, fetchBankTransactions, reconcileBankTransactions,
  removeBankConnection, syncBankBalance, syncBankConnection,
  type BankConnection, type BankReconcileResult, type BankTransaction, type FinanceQuery, type FinAccount
} from '@/api/finance'

const connections = ref<BankConnection[]>([])
const transactions = ref<BankTransaction[]>([])
const accounts = ref<FinAccount[]>([])
const total = ref(0)
const loading = ref(false)
const dialogVisible = ref(false)
const csvVisible = ref(false)
const csvForm = reactive({ connectionId: 0, csvContent: '', date: '', count: 2, reconcile: true })
const reconcileResult = ref<BankReconcileResult | null>(null)
const form = reactive({ accountId: undefined as number | undefined, bankName: '', accountNo: '', connector: 'MOCK' })
const query = ref<FinanceQuery & { direction?: string; externalNo?: string }>({ page: 1, pageSize: 20, keyword: '', direction: undefined, externalNo: '' })

async function loadConnections(): Promise<void> {
  try { connections.value = await fetchBankConnections() }
  catch { connections.value = [] }
}
async function loadAccounts(): Promise<void> {
  try {
    const result = await fetchAccounts({ page: 1, pageSize: 100, keyword: '' })
    accounts.value = result.list
  } catch { accounts.value = [] }
}
async function loadTransactions(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchBankTransactions({ ...query.value, direction: query.value.direction || undefined, externalNo: query.value.externalNo || undefined })
    transactions.value = result.list
    total.value = result.total
  } catch { transactions.value = []; total.value = 0 }
  finally { loading.value = false }
}
function openCreate(): void {
  Object.assign(form, { accountId: undefined, bankName: '', accountNo: '', connector: 'MOCK' })
  dialogVisible.value = true
}
async function submitCreate(): Promise<void> {
  if (!form.accountId || !form.bankName) { ElMessage.warning('请选择资金账户并填写开户银行'); return }
  try {
    await createBankConnection({ ...form })
    dialogVisible.value = false
    ElMessage.success('银行连接已创建')
    await loadConnections()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '创建失败') }
}
async function handleSync(row: unknown): Promise<void> {
  const connection = row as BankConnection
  try {
    const result = await syncBankConnection(connection.id, { count: 2 })
    ElMessage.success(`同步完成：导入 ${result.imported} 笔，跳过 ${result.skipped} 笔`)
    await loadConnections()
    await loadTransactions()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '同步失败') }
}
function openCsv(row: unknown): void {
  const connection = row as BankConnection
  csvForm.connectionId = connection.id
  csvForm.csvContent = 'externalNo,direction,amount,txDate,summary\nBANK001,IN,1000,2026-01-05,货款回款\nBANK002,OUT,300,2026-01-06,支付供应商'
  csvForm.date = ''
  csvForm.count = 2
  csvForm.reconcile = true
  csvVisible.value = true
}
async function submitCsv(): Promise<void> {
  try {
    const connector = connections.value.find((item) => item.id === csvForm.connectionId)?.connector
    const data = connector === 'CSV'
      ? { csvContent: csvForm.csvContent, reconcile: csvForm.reconcile }
      : { payload: csvForm.csvContent, reconcile: csvForm.reconcile }
    const result = await syncBankConnection(csvForm.connectionId, data)
    csvVisible.value = false
    reconcileResult.value = result.reconcile
    ElMessage.success(`导入 ${result.imported} 笔，跳过 ${result.skipped} 笔${result.reconcile ? `，自动匹配 ${result.reconcile.summary.matchedCount} 笔` : ''}`)
    await loadConnections()
    await loadTransactions()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '导入失败') }
}
async function doReconcile(row: unknown): Promise<void> {
  const connection = row as BankConnection
  try {
    const result = await reconcileBankTransactions(connection.id)
    reconcileResult.value = result
    ElMessage.success(`匹配 ${result.summary.matchedCount} 笔，银行侧未匹配 ${result.summary.unmatchedBankCount} 笔，账面未匹配 ${result.summary.unmatchedBookCount} 笔`)
    await loadTransactions()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '对账失败') }
}
async function handleSyncBalance(row: unknown): Promise<void> {
  const connection = row as BankConnection
  try {
    const { value } = await ElMessageBox.prompt('请输入银行账户余额', '余额同步', {
      inputValue: connection.lastBalance ?? '0',
      inputPattern: /^-?\d+(\.\d+)?$/,
      inputErrorMessage: '请输入合法金额'
    })
    const result = await syncBankBalance(connection.id, Number(value))
    ElMessage[result.matched ? 'success' : 'warning'](result.matched ? '余额已同步' : `余额已同步，与账面差异 ${result.difference ?? 0}`)
    await loadConnections()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '余额同步失败') }
}
async function handleRemove(row: unknown): Promise<void> {
  const connection = row as BankConnection
  try {
    await ElMessageBox.confirm(`确认删除银行连接「${connection.bankName}」？`, '提示', { type: 'warning' })
  } catch { return }
  try {
    await removeBankConnection(connection.id)
    ElMessage.success('已删除')
    await loadConnections()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '删除失败') }
}
onMounted(async () => { await loadConnections(); await loadAccounts(); await loadTransactions() })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>银企直连</h2><p>配置银行连接，按适配器同步流水与余额，并与账面余额比对。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-button type="primary" v-perm="'finance:bank:manage'" @click="openCreate">新增连接</el-button>
        <el-button @click="loadConnections">刷新</el-button>
      </div>
      <el-table :data="connections" row-key="id">
        <el-table-column prop="bankName" label="开户银行" min-width="160" />
        <el-table-column prop="accountNo" label="银行账号" min-width="160" />
        <el-table-column prop="connectorLabel" label="适配器" width="130" />
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column prop="lastBalance" label="最近同步余额" width="150" />
        <el-table-column prop="lastSyncAt" label="最近同步时间" width="190" />
        <el-table-column prop="lastResult" label="同步结果" min-width="220" />
        <el-table-column label="操作" width="260">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'finance:bank:sync'" @click="handleSync(row)">同步流水</el-button>
            <el-button link type="primary" v-perm="'finance:bank:sync'" @click="openCsv(row)">报文导入</el-button>
            <el-button link type="success" v-perm="'finance:bank:sync'" @click="doReconcile(row)">流水对账</el-button>
            <el-button link type="warning" v-perm="'finance:bank:sync'" @click="handleSyncBalance(row)">同步余额</el-button>
            <el-button link type="danger" v-perm="'finance:bank:manage'" @click="handleRemove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </article>
    <article class="panel">
      <h3>银行流水</h3>
      <div class="toolbar">
        <el-select v-model="query.direction" clearable placeholder="收支方向" style="width: 140px">
          <el-option label="收入" value="IN" />
          <el-option label="支出" value="OUT" />
        </el-select>
        <el-input v-model="query.externalNo" placeholder="银行流水号" style="width: 200px" />
        <el-button @click="loadTransactions">查询</el-button>
      </div>
      <el-table v-loading="loading" :data="transactions" row-key="id">
        <el-table-column prop="txDate" label="交易日期" width="130" />
        <el-table-column prop="externalNo" label="银行流水号" min-width="180" />
        <el-table-column prop="direction" label="方向" width="90" />
        <el-table-column prop="amount" label="金额" width="150" />
        <el-table-column prop="summary" label="摘要" min-width="200" />
        <el-table-column label="对账" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.matched === 1" type="success">已匹配</el-tag>
            <el-tag v-else type="warning">未匹配</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <el-alert v-if="reconcileResult" type="info" :closable="false" style="margin-top: 12px"
        :title="`对账差异：匹配 ${reconcileResult.summary.matchedCount} 笔（${reconcileResult.summary.matchedAmount}），银行侧未匹配 ${reconcileResult.summary.unmatchedBankCount} 笔（${reconcileResult.summary.unmatchedBankAmount}），账面未匹配 ${reconcileResult.summary.unmatchedBookCount} 笔（${reconcileResult.summary.unmatchedBookAmount}）`" />
      <el-pagination
        style="margin-top: 12px"
        layout="total, prev, pager, next"
        :total="total"
        :page-size="query.pageSize"
        :current-page="query.page"
        @current-change="(value: number) => { query.page = value; loadTransactions() }"
      />
    </article>
    <el-dialog v-model="dialogVisible" title="新增银行连接" width="520px">
      <el-form label-width="100px">
        <el-form-item label="资金账户">
          <el-select v-model="form.accountId" filterable placeholder="选择账户" style="width: 100%">
            <el-option v-for="item in accounts" :key="item.id" :label="`${item.accountCode} ${item.accountName}`" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="开户银行"><el-input v-model="form.bankName" placeholder="如：招商银行" /></el-form-item>
        <el-form-item label="银行账号"><el-input v-model="form.accountNo" placeholder="选填" /></el-form-item>
        <el-form-item label="直连适配器">
          <el-select v-model="form.connector" style="width: 100%">
            <el-option label="模拟直连" value="MOCK" />
            <el-option label="CSV 流水文件" value="CSV" />
            <el-option label="网银 JSON 直连" value="JSON" />
            <el-option label="网银 XML 直连" value="XML" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible = false">取消</el-button><el-button type="primary" @click="submitCreate">保存</el-button></template>
    </el-dialog>
    <el-dialog v-model="csvVisible" title="银行流水报文导入" width="640px">
      <el-form label-width="100px">
        <el-form-item label="报文内容">
          <el-input v-model="csvForm.csvContent" type="textarea" :rows="8" placeholder="按适配器填写 CSV / JSON / XML 报文" />
        </el-form-item>
        <el-form-item label="导入后对账">
          <el-switch v-model="csvForm.reconcile" />
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="csvVisible = false">取消</el-button><el-button type="primary" @click="submitCsv">导入</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; margin-bottom: 16px; }
.panel h3 { margin: 0 0 12px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
