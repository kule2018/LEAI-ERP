<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchCashFlowReport, fetchCashFlowReports, fetchCashFlowStatement, fetchStatements,
  issueCashFlowReport, voidCashFlowReport,
  type CashFlowReport, type FinanceQuery, type StatementData
} from '@/api/finance'

const data = ref<StatementData | null>(null)
const cashFlow = ref<Record<string, unknown> | null>(null)
const reports = ref<CashFlowReport[]>([])
const detail = ref<CashFlowReport | null>(null)
const detailVisible = ref(false)
const issuing = ref(false)
const query = ref<FinanceQuery>({ page: 1, pageSize: 20, period: new Date().toISOString().slice(0, 7) })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  try {
    const result = await fetchStatements(query.value)
    if (current !== seq) return
    data.value = result
    if (query.value.period) {
      cashFlow.value = await fetchCashFlowStatement(query.value.period)
      reports.value = await fetchCashFlowReports(query.value.period)
    }
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '加载失败') }
}

/** 出具正式报表：期间未结账时后端拒绝，可用预览模式出具 */
async function issue(type: 'OFFICIAL' | 'PREVIEW'): Promise<void> {
  if (!query.value.period) { ElMessage.warning('请先选择会计期间'); return }
  issuing.value = true
  try {
    const saved = await issueCashFlowReport({ period: query.value.period, reportType: type })
    ElMessage.success(`已出具 ${saved.reportNo}`)
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '出具失败')
  } finally {
    issuing.value = false
  }
}

async function openDetail(row: CashFlowReport): Promise<void> {
  try {
    detail.value = await fetchCashFlowReport(row.id)
    detailVisible.value = true
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载出具详情失败')
  }
}

async function revoke(row: CashFlowReport): Promise<void> {
  try {
    const { value } = await ElMessageBox.prompt('请填写作废原因', '作废正式现金流量表', {
      inputValidator: (input: string) => (input && input.trim().length > 0 ? true : '请输入作废原因')
    })
    await voidCashFlowReport(row.id, value)
    ElMessage.success('已作废')
    await load()
  } catch (cause) {
    if (cause instanceof Error) ElMessage.error(cause.message)
  }
}

onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>三大报表</h2><p>利润表、资产负债表和现金流量表，数据来自已过账凭证。</p></header>
    <div class="toolbar">
      <el-date-picker v-model="query.period" type="month" value-format="YYYY-MM" placeholder="YYYY-MM"  />
      <el-button type="primary" @click="load">查询</el-button>
      <el-button :loading="issuing" v-perm="'finance:report:export'" @click="issue('OFFICIAL')">出具正式现金流量表</el-button>
      <el-button :loading="issuing" v-perm="'finance:report:export'" @click="issue('PREVIEW')">出具预览版</el-button>
    </div>
    <div class="report-grid">
      <article class="panel">
        <h3>利润表</h3>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="收入">{{ data?.incomeStatement.income ?? '0.0000' }}</el-descriptions-item>
          <el-descriptions-item label="费用">{{ data?.incomeStatement.expense ?? '0.0000' }}</el-descriptions-item>
          <el-descriptions-item label="利润">{{ data?.incomeStatement.profit ?? '0.0000' }}</el-descriptions-item>
        </el-descriptions>
      </article>
      <article class="panel">
        <h3>资产负债表</h3>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="资产">{{ data?.balanceSheet.assets ?? '0.0000' }}</el-descriptions-item>
          <el-descriptions-item label="负债">{{ data?.balanceSheet.liabilities ?? '0.0000' }}</el-descriptions-item>
          <el-descriptions-item label="权益">{{ data?.balanceSheet.equity ?? '0.0000' }}</el-descriptions-item>
          <el-descriptions-item label="平衡">{{ data?.balanceSheet.balanced ? '是' : '否' }}</el-descriptions-item>
        </el-descriptions>
      </article>
      <article class="panel">
        <h3>现金流量表</h3>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="期初余额">{{ cashFlow?.openingBalance ?? '0.0000' }}</el-descriptions-item>
          <el-descriptions-item label="本期净增">{{ cashFlow?.netIncrease ?? '0.0000' }}</el-descriptions-item>
          <el-descriptions-item label="期末余额">{{ cashFlow?.endingBalance ?? '0.0000' }}</el-descriptions-item>
        </el-descriptions>
        <el-table :data="(cashFlow?.sections as Array<Record<string, unknown>>) ?? []" size="small" style="margin-top: 12px">
          <el-table-column prop="label" label="活动类别" width="120" />
          <el-table-column prop="inflow" label="流入" width="120" />
          <el-table-column prop="outflow" label="流出" width="120" />
          <el-table-column prop="net" label="净额" width="120" />
          <el-table-column prop="count" label="笔数" width="90" />
        </el-table>
      </article>
    </div>

    <article class="panel issued">
      <h3>现金流量表出具记录</h3>
      <el-table :data="reports" size="small" border>
        <el-table-column prop="reportNo" label="报表编号" width="160" />
        <el-table-column prop="period" label="期间" width="110" />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.reportType === 'OFFICIAL' ? 'success' : 'info'" size="small">
              {{ row.reportType === 'OFFICIAL' ? '正式' : '预览' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ISSUED' ? 'success' : 'danger'" size="small">
              {{ row.status === 'ISSUED' ? '已出具' : '已作废' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="issuedAt" label="出具时间" width="180" />
        <el-table-column prop="remark" label="备注" min-width="160" />
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">查看快照</el-button>
            <el-button v-if="row.status === 'ISSUED'" link type="danger" v-perm="'finance:report:export'" @click="revoke(row)">作废</el-button>
          </template>
        </el-table-column>
      </el-table>
    </article>

    <el-dialog v-model="detailVisible" title="现金流量表出具快照" width="720px">
      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item label="报表编号">{{ detail.reportNo }}</el-descriptions-item>
        <el-descriptions-item label="期间">{{ detail.period }}</el-descriptions-item>
        <el-descriptions-item label="期初余额">{{ (detail.snapshot?.openingBalance as number) ?? '0' }}</el-descriptions-item>
        <el-descriptions-item label="期末余额">{{ (detail.snapshot?.endingBalance as number) ?? '0' }}</el-descriptions-item>
        <el-descriptions-item label="本期净增">{{ (detail.snapshot?.netIncrease as number) ?? '0' }}</el-descriptions-item>
        <el-descriptions-item label="出具时间">{{ detail.issuedAt }}</el-descriptions-item>
      </el-descriptions>
      <el-table
        v-if="detail"
        :data="(detail.snapshot?.sections as Array<Record<string, unknown>>) ?? []"
        size="small"
        border
        style="margin-top: 12px"
      >
        <el-table-column prop="category" label="活动类别" width="120" />
        <el-table-column prop="inflow" label="流入" width="120" />
        <el-table-column prop="outflow" label="流出" width="120" />
        <el-table-column prop="net" label="净额" width="120" />
        <el-table-column prop="count" label="笔数" width="80" />
      </el-table>
    </el-dialog>
  </section>
</template>

<style scoped>
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.report-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel h3 { margin: 0 0 16px; }
.issued { margin-top: 16px; }
@media (max-width: 1100px) { .report-grid { grid-template-columns: 1fr; } }
</style>
