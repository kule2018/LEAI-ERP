<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  downloadFinanceReport, fetchDetailLedger, fetchReportDrilldown, fetchStatements, fetchSubjectBalance,
  fetchSubjects, fetchVoucherDetail, type DetailLedgerResult, type FinanceQuery, type StatementData,
  type Subject, type SubjectBalanceResult, type Voucher, type VoucherEntry
} from '@/api/finance'

const tab = ref<'statements' | 'balance' | 'ledger'>('statements')
const data = ref<StatementData | null>(null)
const balance = ref<SubjectBalanceResult | null>(null)
const ledger = ref<DetailLedgerResult | null>(null)
const subjects = ref<Subject[]>([])
const ledgerSubjectId = ref<number | undefined>(undefined)
const ledgerSubjectIds = ref<number[]>([])
const ledgerFilter = reactive({ beginDate: '', endDate: '', voucherNo: '' })
const query = ref<FinanceQuery>({ page: 1, pageSize: 20, period: new Date().toISOString().slice(0, 7) })
const drilldown = ref<{
  key: string; label: string; period: string; subjectIds: number[]; side: string
  rows: Array<{ subjectId: number; subjectCode: string; subjectName: string; amount: number }>
  total: number
} | null>(null)
const voucherDetail = ref<{ voucher: Voucher; entries: VoucherEntry[] } | null>(null)
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  try { const result = await fetchStatements(query.value); if (current === seq) data.value = result }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '加载失败') }
}
async function loadBalance(): Promise<void> {
  const current = ++seq
  try { const result = await fetchSubjectBalance(query.value); if (current === seq) balance.value = result }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '加载科目余额失败') }
}
async function loadLedger(): Promise<void> {
  const multi = ledgerSubjectIds.value.length > 0
  if (!multi && !ledgerSubjectId.value) { ElMessage.warning('请先选择科目'); return }
  const current = ++seq
  try {
    const result = await fetchDetailLedger({
      ...query.value,
      subjectId: multi ? undefined : ledgerSubjectId.value,
      subjectIds: multi ? ledgerSubjectIds.value : undefined,
      beginDate: ledgerFilter.beginDate || undefined,
      endDate: ledgerFilter.endDate || undefined,
      voucherNo: ledgerFilter.voucherNo || undefined
    })
    if (current === seq) ledger.value = result
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '加载明细账失败') }
}
async function loadSubjects(): Promise<void> {
  try {
    const result = await fetchSubjects({ page: 1, pageSize: 200, keyword: '' })
    subjects.value = result.list
  } catch { subjects.value = [] }
}
async function doDrilldown(key: string): Promise<void> {
  try { drilldown.value = await fetchReportDrilldown(key, query.value.period ?? '') }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '下钻失败') }
}

async function drillToLedger(subjectId: number): Promise<void> {
  ledgerSubjectId.value = subjectId
  ledgerSubjectIds.value = []
  drilldown.value = null
  tab.value = 'ledger'
  await loadLedger()
}

async function showVoucher(row: unknown): Promise<void> {
  const voucherId = Number((row as Record<string, unknown>).voucherId)
  if (!voucherId) return
  try { voucherDetail.value = await fetchVoucherDetail(voucherId) }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '加载凭证失败') }
}

async function exportReport(type: 'statements' | 'balance' | 'ledger'): Promise<void> {
  try {
    const blob = await downloadFinanceReport(type, query.value.period ?? '', ledgerSubjectId.value)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `finance-${type}-${query.value.period}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    ElMessage.success('报表已导出（含水印）')
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '导出失败') }
}

onMounted(async () => { await load(); await loadSubjects() })
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>财务报表</h2><p>损益、资产负债、现金流、科目余额表与明细账。</p></header>
    <div class="toolbar">
      <el-date-picker v-model="query.period" type="month" value-format="YYYY-MM" placeholder="YYYY-MM"  />
      <el-button type="primary" @click="load">查询</el-button>
      <el-divider direction="vertical" />
      <el-button v-perm="'finance:report:export'" @click="exportReport('statements')">导出三大报表</el-button>
      <el-button v-perm="'finance:report:export'" @click="exportReport('balance')">导出余额表</el-button>
      <el-button v-perm="'finance:report:export'" @click="exportReport('ledger')">导出明细账</el-button>
    </div>
    <el-tabs v-model="tab">
      <el-tab-pane label="三大报表" name="statements">
        <div class="kpi-grid">
          <article class="kpi-card clickable" @click="doDrilldown('income')"><span>收入（点击下钻）</span><strong>{{ data?.incomeStatement.income ?? '0.0000' }}</strong></article>
          <article class="kpi-card clickable" @click="doDrilldown('expense')"><span>费用（点击下钻）</span><strong>{{ data?.incomeStatement.expense ?? '0.0000' }}</strong></article>
          <article class="kpi-card clickable" @click="doDrilldown('profit')"><span>利润（点击下钻）</span><strong>{{ data?.incomeStatement.profit ?? '0.0000' }}</strong></article>
          <article class="kpi-card"><span>平衡校验</span><strong>{{ data?.balanceSheet.balanced ? '通过' : '未通过' }}</strong></article>
        </div>
        <article class="panel">
          <h3>资产负债表</h3>
          <el-descriptions :column="3" border>
            <el-descriptions-item label="资产"><el-link type="primary" @click="doDrilldown('assets')">{{ data?.balanceSheet.assets ?? '0.0000' }}</el-link></el-descriptions-item>
            <el-descriptions-item label="负债"><el-link type="primary" @click="doDrilldown('liabilities')">{{ data?.balanceSheet.liabilities ?? '0.0000' }}</el-link></el-descriptions-item>
            <el-descriptions-item label="权益"><el-link type="primary" @click="doDrilldown('equity')">{{ data?.balanceSheet.equity ?? '0.0000' }}</el-link></el-descriptions-item>
          </el-descriptions>
        </article>
        <el-dialog
          :model-value="drilldown !== null"
          :title="`下钻：${drilldown?.label ?? ''}（点击科目继续查明细账）`"
          width="720px"
          @update:model-value="drilldown = null"
        >
          <el-table :data="drilldown?.rows ?? []" size="small">
            <el-table-column prop="subjectCode" label="科目编码" width="140" />
            <el-table-column prop="subjectName" label="科目名称" min-width="180" />
            <el-table-column prop="amount" label="金额" width="150" />
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button link type="primary" @click="drillToLedger(Number(row.subjectId))">查明细账</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div style="margin-top: 12px; text-align: right">合计：{{ drilldown?.total ?? 0 }}</div>
        </el-dialog>
      </el-tab-pane>
      <el-tab-pane label="科目余额表" name="balance">
        <article class="panel">
          <div class="toolbar">
            <el-button type="primary" @click="loadBalance">查询余额表</el-button>
            <span class="hint">期初 {{ balance?.beginPeriod ?? '-' }}，本期 {{ balance?.period ?? '-' }}</span>
          </div>
          <el-table :data="balance?.rows ?? []" row-key="subjectId">
            <el-table-column prop="subjectCode" label="科目编码" width="150" />
            <el-table-column prop="subjectName" label="科目名称" min-width="160" />
            <el-table-column prop="openingBalance" label="期初余额" width="150" />
            <el-table-column prop="periodDebit" label="本期借方" width="150" />
            <el-table-column prop="periodCredit" label="本期贷方" width="150" />
            <el-table-column prop="closingBalance" label="期末余额" width="150" />
            <el-table-column prop="balanceDirection" label="方向" width="100" />
          </el-table>
          <div class="toolbar totals">
            <span>合计：期初 {{ balance?.totals.openingBalance ?? '0' }} / 借 {{ balance?.totals.periodDebit ?? '0' }} / 贷 {{ balance?.totals.periodCredit ?? '0' }} / 期末 {{ balance?.totals.closingBalance ?? '0' }}</span>
          </div>
        </article>
      </el-tab-pane>
      <el-tab-pane label="明细账" name="ledger">
        <article class="panel">
          <div class="toolbar">
            <el-select v-model="ledgerSubjectId" placeholder="选择科目" filterable clearable style="width: 260px" :disabled="ledgerSubjectIds.length > 0">
              <el-option v-for="item in subjects" :key="item.id" :label="`${item.subjectCode} ${item.subjectName}`" :value="item.id" />
            </el-select>
            <el-select v-model="ledgerSubjectIds" multiple placeholder="多科目明细账" filterable clearable style="width: 320px">
              <el-option v-for="item in subjects" :key="item.id" :label="`${item.subjectCode} ${item.subjectName}`" :value="item.id" />
            </el-select>
            <el-input v-model="ledgerFilter.beginDate" placeholder="起始日期" style="width: 130px" />
            <el-input v-model="ledgerFilter.endDate" placeholder="截止日期" style="width: 130px" />
            <el-input v-model="ledgerFilter.voucherNo" placeholder="凭证号" style="width: 140px" />
            <el-button type="primary" @click="loadLedger">查询明细账</el-button>
            <span class="hint" v-if="ledger">期末 {{ ledger.totals.closingBalance }}</span>
          </div>
          <template v-if="ledger?.groups && ledger.groups.length > 0">
            <div v-for="group in ledger.groups" :key="group.subjectId" style="margin-bottom: 20px">
              <h3>{{ group.subjectCode }} {{ group.subjectName }}（期初 {{ group.openingBalance }} / 期末 {{ group.closingBalance }}）</h3>
              <el-table :data="group.rows" row-key="voucherId">
                <el-table-column prop="date" label="日期" width="120" />
                <el-table-column prop="voucherNo" label="凭证号" width="160">
                  <template #default="{ row }">
                    <el-link type="primary" @click="showVoucher(row)">{{ row.voucherNo }}</el-link>
                  </template>
                </el-table-column>
                <el-table-column prop="summary" label="摘要" min-width="200" />
                <el-table-column prop="debit" label="借方" width="140" />
                <el-table-column prop="credit" label="贷方" width="140" />
                <el-table-column prop="runningBalance" label="累计余额" width="150" />
              </el-table>
            </div>
          </template>
          <el-table :data="ledger?.rows ?? []" row-key="voucherId">
            <el-table-column prop="date" label="日期" width="120" />
            <el-table-column prop="voucherNo" label="凭证号" width="160">
              <template #default="{ row }">
                <el-link type="primary" @click="showVoucher(row)">{{ row.voucherNo }}</el-link>
              </template>
            </el-table-column>
            <el-table-column prop="summary" label="摘要" min-width="200" />
            <el-table-column prop="debit" label="借方" width="140" />
            <el-table-column prop="credit" label="贷方" width="140" />
            <el-table-column prop="runningBalance" label="累计余额" width="150" />
          </el-table>
          <el-dialog
            :model-value="voucherDetail !== null"
            title="凭证明细"
            width="720px"
            @update:model-value="voucherDetail = null"
          >
            <template v-if="voucherDetail">
              <el-descriptions :column="3" border size="small">
                <el-descriptions-item label="凭证号">{{ voucherDetail.voucher.voucherNo }}</el-descriptions-item>
                <el-descriptions-item label="日期">{{ voucherDetail.voucher.voucherDate }}</el-descriptions-item>
                <el-descriptions-item label="期间">{{ voucherDetail.voucher.period }}</el-descriptions-item>
              </el-descriptions>
              <el-table :data="voucherDetail.entries" size="small" style="margin-top: 12px">
                <el-table-column prop="summary" label="摘要" min-width="180" />
                <el-table-column prop="debit" label="借方" width="140" />
                <el-table-column prop="credit" label="贷方" width="140" />
              </el-table>
            </template>
          </el-dialog>
        </article>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<style scoped>
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; align-items: center; }
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }
.kpi-card { padding: 16px; background: #fff; border-radius: 8px; }
.kpi-card.clickable { cursor: pointer; }
.kpi-card.clickable:hover { box-shadow: 0 2px 12px rgba(0, 0, 0, .12); }
.kpi-card span { display: block; margin-bottom: 8px; color: #646a73; }
.kpi-card strong { font-size: 22px; }
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel h3 { margin: 0 0 16px; }
.hint { color: #646a73; font-size: 13px; }
.totals { margin-top: 12px; margin-bottom: 0; }
@media (max-width: 1000px) { .kpi-grid { grid-template-columns: 1fr; } }
</style>
