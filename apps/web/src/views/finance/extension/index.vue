<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  addVoucherAttachment, allocateExpenseClaim, approveExpenseClaim, approveProvision, applyVoucherTemplate,
  confirmBankMatch, createCashflowCalendarItem, createCashflowScenario, createCollectionPlan, createExpenseClaim,
  createExpensePolicy, createVoucherTemplate, fetchAgingRisk, fetchBankMatches, fetchBudgetOccupations,
  fetchCashflowCalendar, fetchCashflowScenarios,
  fetchCollectionPlans, fetchExpenseClaims, fetchExpensePolicies, fetchFinanceDashboard, fetchPeriodChecks,
  fetchProvisionSuggestion, fetchProvisions, fetchStatementComparison, fetchSubjectSuggestions,
  fetchTrialBalanceAnalysis, fetchVoucherAttachments, fetchVoucherTemplates, ocrReceipt, occupyBudget,
  payExpenseClaim, releaseBudget, reopenPeriod, rollbackCostJob, runBankMatch, runPeriodChecks, simulateCashflow,
  submitProvision, validateVoucherEntries
} from '@/api/finance-extension'
import { createCostJob, executeCostJob, fetchCostJobs, retryCostJob, type CostJob } from '@/api/finance'
import AiFileUpload from '@/components/AiFileUpload.vue'

type Row = Record<string, unknown>

const tab = ref('template')

/* 凭证模板与科目建议 */
const templates = ref<Row[]>([])
const templateForm = reactive({ templateCode: '', templateName: '', bizType: 'GENERAL', itemsText: '[{"subjectCode":"1001","direction":"DEBIT","ratio":1}]' })
const applyForm = reactive({ templateId: undefined as number | undefined, amount: '100', summary: '' })
const appliedTemplate = ref<Row>({})
const keyword = ref('')
const suggestions = ref<Row[]>([])
const validateForm = reactive({ entriesText: '[{"subjectId":1,"debit":"100","credit":"0"}]' })
const validateResult = ref<Row>({})
const attachments = ref<Row[]>([])
const attachmentForm = reactive({ voucherId: 1, fileName: '', fileUrl: '', attachmentType: 'INVOICE' })

/* 试算平衡与报表 */
const trialBalance = ref<Row>({})
const statement = ref<Row>({})
const period = ref(new Date().toISOString().slice(0, 7))

/* 费用政策与 OCR */
const policies = ref<Row[]>([])
const policyForm = reactive({ policyCode: '', policyName: '', category: '', maxAmount: '', requireInvoice: false, requireApproval: false })
const claims = ref<Row[]>([])
const ocrText = ref('2026-03-05 收到货款 1200.50 元 对方：某某公司')
const ocrResult = ref<Row>({})
const claimForm = reactive({ amount: '', direction: 'OUT', summary: '', category: '', hasInvoice: false })
const claimActionForm = reactive({ remark: '', deptId: 1, supplierId: undefined as number | undefined, accountId: undefined as number | undefined })

/* 账龄催收与坏账计提 */
const agingRisk = ref<Row>({})
const collectionPlans = ref<Row[]>([])
const collectionForm = reactive({ customerId: 1, customerName: '', amount: '100', overdueDays: 45, plannedAt: '' })
const provisions = ref<Row[]>([])
const provisionSuggestion = ref<Row>({})
const provisionForm = reactive({ period: new Date().toISOString().slice(0, 7), customerId: 1, customerName: '', agingBucket: 'D31', receivableAmount: '1000', provisionRate: '5', reason: '' })

/* 银行流水匹配 */
const bankMatches = ref<Row[]>([])
const bankMatchForm = reactive({ threshold: 60 })
const bankMatchResult = ref<Row>({})
const confirmForm = reactive({ transactionId: undefined as number | undefined, bizType: 'RECEIPT', bizId: 1 })

/* 现金流 */
const scenarios = ref<Row[]>([])
const scenarioForm = reactive({ scenarioName: '', scenarioType: 'OPTIMISTIC', inflowFactor: 1.2, outflowFactor: 0.9, oneOff: 0 })
const calendar = ref<Row>({})
const calendarForm = reactive({ bizDate: new Date().toISOString().slice(0, 10), direction: 'IN', amount: '1000', summary: '' })
const simulation = ref<Row>({})
const simulateForm = reactive({ scenarioType: 'BASE', inflowFactor: 1, outflowFactor: 1, oneOff: 0, openingBalance: 10000 })

/* 成本回滚、月结与预算 */
const costJobId = ref<number | undefined>(undefined)
/* 成本重算任务 */
const costJobs = ref<CostJob[]>([])
const costJobPeriod = ref(new Date().toISOString().slice(0, 7))
const rollbackResult = ref<Row>({})
const periodChecks = ref<Row[]>([])
const checkPeriod = ref(new Date().toISOString().slice(0, 7))
const checkResult = ref<Row>({})
const reopenForm = reactive({ period: new Date().toISOString().slice(0, 7), reason: '' })
const occupations = ref<Row[]>([])
const occupyForm = reactive({ period: new Date().toISOString().slice(0, 7), deptId: undefined as number | undefined, subjectId: undefined as number | undefined, amount: '1000', bizType: 'PURCHASE' })
const dashboard = ref<Row>({})

function fail(cause: unknown): void {
  ElMessage.error(cause instanceof Error ? cause.message : '操作失败')
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('JSON 格式不正确')
  }
}

async function loadTemplates(): Promise<void> {
  try {
    const result = await fetchVoucherTemplates({ page: 1, pageSize: 100 })
    templates.value = (result.list ?? []) as unknown as Row[]
  } catch (cause) {
    fail(cause)
  }
}

async function doCreateTemplate(): Promise<void> {
  try {
    await createVoucherTemplate({
      templateCode: templateForm.templateCode,
      templateName: templateForm.templateName,
      bizType: templateForm.bizType,
      items: parseJson(templateForm.itemsText)
    })
    ElMessage.success('凭证模板已创建')
    await loadTemplates()
  } catch (cause) {
    fail(cause)
  }
}

async function doApplyTemplate(): Promise<void> {
  try {
    appliedTemplate.value = await applyVoucherTemplate(applyForm.templateId as number, { amount: applyForm.amount, summary: applyForm.summary })
    ElMessage.success('模板已套用')
  } catch (cause) {
    fail(cause)
  }
}

async function doSuggest(): Promise<void> {
  try {
    const result = await fetchSubjectSuggestions({ keyword: keyword.value, limit: 5 })
    suggestions.value = (result.suggestions ?? []) as unknown as Row[]
  } catch (cause) {
    fail(cause)
  }
}

async function doValidate(): Promise<void> {
  try {
    validateResult.value = await validateVoucherEntries({ entries: parseJson(validateForm.entriesText) as Array<Record<string, unknown>> })
    ElMessage.success('校验完成')
  } catch (cause) {
    fail(cause)
  }
}

async function loadAttachments(): Promise<void> {
  try {
    attachments.value = (await fetchVoucherAttachments(attachmentForm.voucherId)) as unknown as Row[]
  } catch (cause) {
    fail(cause)
  }
}

async function doAddAttachment(): Promise<void> {
  try {
    await addVoucherAttachment({ ...attachmentForm })
    ElMessage.success('附件已上传')
    await loadAttachments()
  } catch (cause) {
    fail(cause)
  }
}

async function loadTrialBalance(): Promise<void> {
  try {
    trialBalance.value = await fetchTrialBalanceAnalysis({ period: period.value })
  } catch (cause) {
    fail(cause)
  }
}

async function loadStatement(): Promise<void> {
  try {
    statement.value = await fetchStatementComparison({ period: period.value })
  } catch (cause) {
    fail(cause)
  }
}

async function loadPolicies(): Promise<void> {
  try {
    const result = await fetchExpensePolicies({ page: 1, pageSize: 100 })
    policies.value = (result.list ?? []) as unknown as Row[]
  } catch (cause) {
    fail(cause)
  }
}

async function doCreatePolicy(): Promise<void> {
  try {
    await createExpensePolicy({
      policyCode: policyForm.policyCode,
      policyName: policyForm.policyName,
      category: policyForm.category || undefined,
      maxAmount: policyForm.maxAmount || undefined,
      requireInvoice: policyForm.requireInvoice,
      requireApproval: policyForm.requireApproval
    })
    ElMessage.success('费用政策已创建')
    await loadPolicies()
  } catch (cause) {
    fail(cause)
  }
}

async function doOcr(): Promise<void> {
  try {
    ocrResult.value = await ocrReceipt(ocrText.value)
  } catch (cause) {
    fail(cause)
  }
}

async function loadClaims(): Promise<void> {
  try {
    const result = await fetchExpenseClaims({ page: 1, pageSize: 100 })
    claims.value = (result.list ?? []) as unknown as Row[]
  } catch (cause) {
    fail(cause)
  }
}

async function doCreateClaim(): Promise<void> {
  try {
    const result = await createExpenseClaim({
      amount: claimForm.amount || undefined,
      direction: claimForm.direction,
      summary: claimForm.summary || undefined,
      category: claimForm.category || undefined,
      hasInvoice: claimForm.hasInvoice,
      sourceText: ocrText.value
    })
    ElMessage.success(`费用单已提交，政策判定：${(result.policy as Row)?.level ?? 'PASS'}`)
    await loadClaims()
  } catch (cause) {
    fail(cause)
  }
}

async function doApproveClaim(row: Row): Promise<void> {
  try {
    const result = await approveExpenseClaim(Number(row.id), { status: 'APPROVED', remark: claimActionForm.remark || undefined })
    ElMessage.success(`报销单已审批：${String((result.evaluation as Row)?.reason ?? '')}`)
    await loadClaims()
  } catch (cause) { fail(cause) }
}

async function doAllocateClaim(row: Row): Promise<void> {
  try {
    await allocateExpenseClaim(Number(row.id), [{ deptId: claimActionForm.deptId, ratio: 1 }])
    ElMessage.success('已分摊至部门')
  } catch (cause) { fail(cause) }
}

async function doPayClaim(row: Row): Promise<void> {
  if (!claimActionForm.supplierId || !claimActionForm.accountId) {
    ElMessage.warning('请填写收款方 ID 与付款账户 ID')
    return
  }
  try {
    await payExpenseClaim(Number(row.id), { supplierId: claimActionForm.supplierId, accountId: claimActionForm.accountId })
    ElMessage.success('报销单已付款并生成付款单')
    await loadClaims()
  } catch (cause) { fail(cause) }
}

async function loadAging(): Promise<void> {
  try {
    agingRisk.value = await fetchAgingRisk({})
  } catch (cause) {
    fail(cause)
  }
}

async function loadCollectionPlans(): Promise<void> {
  try {
    const result = await fetchCollectionPlans({ page: 1, pageSize: 100 })
    collectionPlans.value = (result.list ?? []) as unknown as Row[]
  } catch (cause) {
    fail(cause)
  }
}

async function doCreateCollectionPlan(): Promise<void> {
  try {
    await createCollectionPlan({ ...collectionForm })
    ElMessage.success('催收计划已创建')
    await loadCollectionPlans()
  } catch (cause) {
    fail(cause)
  }
}

async function loadProvisions(): Promise<void> {
  try {
    const result = await fetchProvisions({ page: 1, pageSize: 100 })
    provisions.value = (result.list ?? []) as unknown as Row[]
  } catch (cause) {
    fail(cause)
  }
}

async function loadProvisionSuggestion(): Promise<void> {
  try {
    provisionSuggestion.value = await fetchProvisionSuggestion(provisionForm.period)
  } catch (cause) {
    fail(cause)
  }
}

async function doSubmitProvision(): Promise<void> {
  try {
    await submitProvision({ ...provisionForm })
    ElMessage.success('坏账计提已提交')
    await loadProvisions()
  } catch (cause) {
    fail(cause)
  }
}

async function doApproveProvision(id: number, approved: boolean): Promise<void> {
  try {
    await approveProvision(id, { approved })
    ElMessage.success(approved ? '已通过' : '已驳回')
    await loadProvisions()
  } catch (cause) {
    fail(cause)
  }
}

async function loadBankMatches(): Promise<void> {
  try {
    const result = await fetchBankMatches({ page: 1, pageSize: 100 })
    bankMatches.value = (result.list ?? []) as unknown as Row[]
  } catch (cause) {
    fail(cause)
  }
}

async function doRunBankMatch(): Promise<void> {
  try {
    bankMatchResult.value = await runBankMatch({ threshold: bankMatchForm.threshold })
    ElMessage.success('银行流水匹配完成')
    await loadBankMatches()
  } catch (cause) {
    fail(cause)
  }
}

async function doConfirmBankMatch(): Promise<void> {
  try {
    await confirmBankMatch({ transactionId: confirmForm.transactionId as number, bizType: confirmForm.bizType, bizId: confirmForm.bizId })
    ElMessage.success('匹配已确认')
    await loadBankMatches()
  } catch (cause) {
    fail(cause)
  }
}

async function loadScenarios(): Promise<void> {
  try {
    const result = await fetchCashflowScenarios({ page: 1, pageSize: 100 })
    scenarios.value = (result.list ?? []) as unknown as Row[]
  } catch (cause) {
    fail(cause)
  }
}

async function doCreateScenario(): Promise<void> {
  try {
    await createCashflowScenario({ ...scenarioForm })
    ElMessage.success('情景已创建')
    await loadScenarios()
  } catch (cause) {
    fail(cause)
  }
}

async function loadCalendar(): Promise<void> {
  try {
    calendar.value = await fetchCashflowCalendar({ period: period.value })
  } catch (cause) {
    fail(cause)
  }
}

async function doCreateCalendarItem(): Promise<void> {
  try {
    await createCashflowCalendarItem({ ...calendarForm })
    ElMessage.success('现金流条目已新增')
    await loadCalendar()
  } catch (cause) {
    fail(cause)
  }
}

async function doSimulate(): Promise<void> {
  try {
    simulation.value = await simulateCashflow({ ...simulateForm })
  } catch (cause) {
    fail(cause)
  }
}

async function doRollbackCost(): Promise<void> {
  try {
    rollbackResult.value = await rollbackCostJob(costJobId.value as number)
    ElMessage.success('成本任务已回滚')
  } catch (cause) {
    fail(cause)
  }
}

async function loadCostJobs(): Promise<void> {
  try {
    const res = await fetchCostJobs({ page: 1, pageSize: 50, period: costJobPeriod.value })
    costJobs.value = res.list ?? []
  } catch (cause) {
    fail(cause)
  }
}

async function doCreateCostJob(): Promise<void> {
  try {
    await createCostJob(costJobPeriod.value)
    ElMessage.success('已创建成本重算任务')
    await loadCostJobs()
  } catch (cause) {
    fail(cause)
  }
}

async function doExecuteCostJob(row: CostJob): Promise<void> {
  try {
    await executeCostJob(row.id)
    ElMessage.success('成本重算已执行完成')
    await loadCostJobs()
  } catch (cause) {
    fail(cause)
    await loadCostJobs()
  }
}

async function doRetryCostJob(row: CostJob): Promise<void> {
  try {
    await retryCostJob(row.id)
    ElMessage.success('成本重算已重试')
    await loadCostJobs()
  } catch (cause) {
    fail(cause)
    await loadCostJobs()
  }
}

async function loadPeriodChecks(): Promise<void> {
  try {
    periodChecks.value = (await fetchPeriodChecks({ period: checkPeriod.value })) as unknown as Row[]
  } catch (cause) {
    fail(cause)
  }
}

async function doRunChecks(): Promise<void> {
  try {
    checkResult.value = await runPeriodChecks(checkPeriod.value)
    await loadPeriodChecks()
  } catch (cause) {
    fail(cause)
  }
}

async function doReopen(): Promise<void> {
  try {
    await reopenPeriod({ ...reopenForm })
    ElMessage.success('期间已反结账')
  } catch (cause) {
    fail(cause)
  }
}

async function loadOccupations(): Promise<void> {
  try {
    const result = await fetchBudgetOccupations({ page: 1, pageSize: 100 })
    occupations.value = (result.list ?? []) as unknown as Row[]
  } catch (cause) {
    fail(cause)
  }
}

async function doOccupy(): Promise<void> {
  try {
    const result = await occupyBudget({ ...occupyForm })
    ElMessage.success(`预算已占用（${(result as Row)?.level ?? 'PASS'}）`)
    await loadOccupations()
  } catch (cause) {
    fail(cause)
  }
}

async function doRelease(id: number): Promise<void> {
  try {
    await releaseBudget(id)
    ElMessage.success('占用已释放')
    await loadOccupations()
  } catch (cause) {
    fail(cause)
  }
}

async function loadDashboard(): Promise<void> {
  try {
    dashboard.value = await fetchFinanceDashboard()
  } catch (cause) {
    fail(cause)
  }
}

onMounted(() => {
  void loadTemplates()
  void loadTrialBalance()
  void loadStatement()
  void loadPolicies()
  void loadClaims()
  void loadAging()
  void loadCollectionPlans()
  void loadProvisions()
  void loadBankMatches()
  void loadScenarios()
  void loadCalendar()
  void loadPeriodChecks()
  void loadOccupations()
  void loadCostJobs()
  void loadDashboard()
})
</script>

<template>
  <section class="page">
    <header class="page-head">
      <h2>财务结算扩展</h2>
      <p>凭证模板与科目建议、科目停用校验、试算平衡高亮与报表同环比、收支 OCR 与费用政策、账龄催收与坏账计提、银行流水自动匹配、现金流情景模拟、成本重算回滚、月结检查与反结账、预算编制控制占用。</p>
    </header>

    <el-tabs v-model="tab">
      <el-tab-pane label="凭证模板与科目建议" name="template">
        <el-card shadow="never">
          <el-form :inline="true">
            <el-form-item label="模板编码"><el-input v-model="templateForm.templateCode" style="width: 160px" /></el-form-item>
            <el-form-item label="模板名称"><el-input v-model="templateForm.templateName" style="width: 180px" /></el-form-item>
            <el-form-item label="业务类型"><el-input v-model="templateForm.bizType" style="width: 120px" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doCreateTemplate">创建模板</el-button></el-form-item>
          </el-form>
          <el-form :inline="true">
            <el-form-item label="分录定义(JSON)"><el-input v-model="templateForm.itemsText" style="width: 420px" /></el-form-item>
          </el-form>
          <el-table :data="templates" size="small">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="templateCode" label="编码" width="140" />
            <el-table-column prop="templateName" label="名称" min-width="180" />
            <el-table-column prop="bizType" label="业务类型" width="120" />
            <el-table-column prop="status" label="状态" width="100" />
          </el-table>

          <el-divider content-position="left">套用模板生成凭证草稿</el-divider>
          <el-form :inline="true">
            <el-form-item label="模板 ID"><el-input-number v-model="applyForm.templateId" :min="1" /></el-form-item>
            <el-form-item label="金额"><el-input v-model="applyForm.amount" style="width: 140px" /></el-form-item>
            <el-form-item label="摘要"><el-input v-model="applyForm.summary" style="width: 200px" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doApplyTemplate">套用</el-button></el-form-item>
          </el-form>
          <el-descriptions v-if="appliedTemplate" :column="3" border>
            <el-descriptions-item label="借方合计">{{ appliedTemplate.totalDebit ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="贷方合计">{{ appliedTemplate.totalCredit ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="差额">{{ appliedTemplate.difference ?? 0 }}</el-descriptions-item>
          </el-descriptions>
          <el-table v-if="appliedTemplate" :data="(appliedTemplate.entries as Row[]) ?? []" size="small" style="margin-top: 12px">
            <el-table-column prop="subjectCode" label="科目编码" width="140" />
            <el-table-column prop="summary" label="摘要" min-width="200" />
            <el-table-column prop="debit" label="借方" width="120" />
            <el-table-column prop="credit" label="贷方" width="120" />
          </el-table>
          <el-alert v-for="item in ((appliedTemplate.warnings as string[]) ?? [])" :key="item" :title="item" type="warning" :closable="false" show-icon style="margin-top: 8px" />

          <el-divider content-position="left">AI 科目建议</el-divider>
          <el-form :inline="true">
            <el-form-item label="业务关键词"><el-input v-model="keyword" style="width: 220px" placeholder="如：运费 办公" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doSuggest">获取建议</el-button></el-form-item>
          </el-form>
          <el-table :data="suggestions" size="small">
            <el-table-column prop="subjectCode" label="科目编码" width="140" />
            <el-table-column prop="subjectName" label="科目名称" min-width="160" />
            <el-table-column prop="score" label="得分" width="100" />
            <el-table-column prop="reason" label="推荐理由" min-width="220" />
          </el-table>

          <el-divider content-position="left">科目停用与辅助核算校验</el-divider>
          <el-form :inline="true">
            <el-form-item label="分录(JSON)"><el-input v-model="validateForm.entriesText" style="width: 420px" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doValidate">校验</el-button></el-form-item>
          </el-form>
          <el-alert v-if="validateResult.issues" :title="`校验结论：${validateResult.ok ? '通过' : '存在 ' + ((validateResult.issues as Row[]) ?? []).length + ' 项问题'}`" :type="validateResult.ok ? 'success' : 'error'" :closable="false" show-icon />
          <el-table v-if="validateResult.issues" :data="(validateResult.issues as Row[]) ?? []" size="small" style="margin-top: 8px">
            <el-table-column prop="lineNo" label="行号" width="80" />
            <el-table-column prop="type" label="问题类型" width="140" />
            <el-table-column prop="message" label="说明" min-width="320" />
          </el-table>

          <el-divider content-position="left">凭证附件</el-divider>
          <el-form :inline="true">
            <el-form-item label="凭证 ID"><el-input-number v-model="attachmentForm.voucherId" :min="1" /></el-form-item>
            <el-form-item label="文件名">
              <AiFileUpload v-model="attachmentForm.fileName" v-model:file-url="attachmentForm.fileUrl" placeholder="上传凭证附件" />
            </el-form-item>
            <el-form-item label="文件地址"><el-input v-model="attachmentForm.fileUrl" readonly style="width: 220px" /></el-form-item>
            <el-form-item label="类型"><el-input v-model="attachmentForm.attachmentType" style="width: 120px" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doAddAttachment">上传</el-button><el-button @click="loadAttachments">查询</el-button></el-form-item>
          </el-form>
          <el-table :data="attachments" size="small">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="fileName" label="文件名" min-width="200" />
            <el-table-column prop="attachmentType" label="类型" width="120" />
            <el-table-column prop="fileSize" label="大小" width="120" />
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="试算平衡与报表下钻" name="report">
        <el-card shadow="never">
          <el-form :inline="true">
            <el-form-item label="期间"><el-input v-model="period" style="width: 140px" placeholder="2026-03" /></el-form-item>
            <el-form-item><el-button type="primary" @click="loadTrialBalance">试算分析</el-button><el-button @click="loadStatement">报表同环比</el-button></el-form-item>
          </el-form>
          <el-descriptions :column="4" border>
            <el-descriptions-item label="借方合计">{{ trialBalance.totalDebit ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="贷方合计">{{ trialBalance.totalCredit ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="差额">{{ trialBalance.difference ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="是否平衡">{{ trialBalance.balanced ? '平衡' : '不平衡' }}</el-descriptions-item>
          </el-descriptions>
          <el-table :data="(trialBalance.rows as Row[]) ?? []" size="small" style="margin-top: 12px">
            <el-table-column prop="subjectCode" label="科目编码" width="140" />
            <el-table-column prop="subjectName" label="科目名称" min-width="160" />
            <el-table-column prop="debit" label="借方" width="120" />
            <el-table-column prop="credit" label="贷方" width="120" />
            <el-table-column prop="balance" label="余额" width="120" />
            <el-table-column label="高亮" width="90">
              <template #default="{ row }">
                <el-tag v-if="row.highlighted" type="danger">借贷不平</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="下钻凭证" min-width="200">
              <template #default="{ row }">{{ ((row.voucherIds as number[]) ?? []).join(', ') }}</template>
            </el-table-column>
          </el-table>

          <el-divider content-position="left">三大报表同环比</el-divider>
          <el-table :data="(statement.comparisons as Row[]) ?? []" size="small">
            <el-table-column prop="label" label="指标" width="150" />
            <el-table-column prop="current" label="本期" width="140" />
            <el-table-column prop="previous" label="上期" width="140" />
            <el-table-column prop="changeAmount" label="环比金额" width="140" />
            <el-table-column prop="changeRate" label="环比率(%)" width="120" />
            <el-table-column prop="direction" label="方向" width="100" />
          </el-table>
          <el-alert v-for="note in ((statement.notes as string[]) ?? [])" :key="note" :title="note" type="info" :closable="false" show-icon style="margin-top: 8px" />
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="费用政策与 OCR" name="expense">
        <el-card shadow="never">
          <el-form :inline="true">
            <el-form-item label="政策编码"><el-input v-model="policyForm.policyCode" style="width: 140px" /></el-form-item>
            <el-form-item label="政策名称"><el-input v-model="policyForm.policyName" style="width: 180px" /></el-form-item>
            <el-form-item label="费用类别"><el-input v-model="policyForm.category" style="width: 120px" /></el-form-item>
            <el-form-item label="单笔上限"><el-input v-model="policyForm.maxAmount" style="width: 120px" /></el-form-item>
            <el-form-item label="需发票"><el-switch v-model="policyForm.requireInvoice" /></el-form-item>
            <el-form-item label="需审批"><el-switch v-model="policyForm.requireApproval" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doCreatePolicy">新增政策</el-button></el-form-item>
          </el-form>
          <el-table :data="policies" size="small">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="policyCode" label="编码" width="140" />
            <el-table-column prop="policyName" label="名称" min-width="160" />
            <el-table-column prop="category" label="类别" width="120" />
            <el-table-column prop="maxAmount" label="单笔上限" width="120" />
            <el-table-column label="需发票" width="90">
              <template #default="{ row }">{{ row.requireInvoice ? '是' : '否' }}</template>
            </el-table-column>
            <el-table-column label="需审批" width="90">
              <template #default="{ row }">{{ row.requireApproval ? '是' : '否' }}</template>
            </el-table-column>
          </el-table>

          <el-divider content-position="left">收支 OCR 解析</el-divider>
          <el-form :inline="true">
            <el-form-item label="单据文本"><el-input v-model="ocrText" style="width: 460px" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doOcr">识别</el-button></el-form-item>
          </el-form>
          <el-descriptions v-if="ocrResult.amount" :column="4" border>
            <el-descriptions-item label="金额">{{ ocrResult.amount }}</el-descriptions-item>
            <el-descriptions-item label="日期">{{ ocrResult.date ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="方向">{{ ocrResult.direction ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="对方单位">{{ ocrResult.counterparty ?? '-' }}</el-descriptions-item>
          </el-descriptions>

          <el-divider content-position="left">提交费用单</el-divider>
          <el-form :inline="true">
            <el-form-item label="金额"><el-input v-model="claimForm.amount" style="width: 140px" /></el-form-item>
            <el-form-item label="方向">
              <el-select v-model="claimForm.direction">
                <el-option label="支出" value="OUT" />
                <el-option label="收入" value="IN" />
              </el-select>
            </el-form-item>
            <el-form-item label="费用类别"><el-input v-model="claimForm.category" style="width: 120px" /></el-form-item>
            <el-form-item label="摘要"><el-input v-model="claimForm.summary" style="width: 200px" /></el-form-item>
            <el-form-item label="已有发票"><el-switch v-model="claimForm.hasInvoice" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doCreateClaim">提交</el-button></el-form-item>
          </el-form>
          <el-table :data="claims" size="small">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="claimNo" label="单号" width="180" />
            <el-table-column prop="direction" label="方向" width="90" />
            <el-table-column prop="amount" label="金额" width="130" />
            <el-table-column prop="summary" label="摘要" min-width="200" />
            <el-table-column prop="policyLevel" label="政策判定" width="120" />
            <el-table-column prop="status" label="状态" width="120" />
            <el-table-column label="操作" width="230">
              <template #default="{ row }">
                <el-button link type="success" :disabled="row.status !== 'SUBMITTED'" @click="doApproveClaim(row)">审批</el-button>
                <el-button link :disabled="row.status !== 'APPROVED'" @click="doAllocateClaim(row)">分摊</el-button>
                <el-button link type="warning" :disabled="row.status !== 'APPROVED'" @click="doPayClaim(row)">付款</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-form :inline="true" style="margin-top: 12px">
            <el-form-item label="审批说明"><el-input v-model="claimActionForm.remark" style="width: 200px" /></el-form-item>
            <el-form-item label="分摊部门"><el-input-number v-model="claimActionForm.deptId" :min="1" style="width: 120px" /></el-form-item>
            <el-form-item label="收款方"><el-input-number v-model="claimActionForm.supplierId" :min="1" style="width: 130px" /></el-form-item>
            <el-form-item label="付款账户"><el-input-number v-model="claimActionForm.accountId" :min="1" style="width: 130px" /></el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="账龄催收与坏账计提" name="aging">
        <el-card shadow="never">
          <el-form :inline="true">
            <el-form-item><el-button type="primary" @click="loadAging">账龄风险分析</el-button></el-form-item>
          </el-form>
          <el-table :data="(agingRisk.risks as Row[]) ?? []" size="small">
            <el-table-column prop="customerName" label="客户" width="160" />
            <el-table-column prop="remain" label="未收金额" width="140" />
            <el-table-column prop="overdueDays" label="逾期天数" width="120" />
            <el-table-column prop="bucket" label="账龄区间" width="120" />
            <el-table-column prop="level" label="风险等级" width="120" />
            <el-table-column prop="suggestion" label="催收建议" min-width="260" />
            <el-table-column prop="action" label="建议动作" width="180" />
          </el-table>
          <el-descriptions v-if="agingRisk.provision" :column="2" border style="margin-top: 12px">
            <el-descriptions-item label="建议计提合计">{{ (agingRisk.provision as Row)?.total ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="计提行数">{{ ((agingRisk.provision as Row)?.rows as Row[])?.length ?? 0 }}</el-descriptions-item>
          </el-descriptions>

          <el-divider content-position="left">催收计划</el-divider>
          <el-form :inline="true">
            <el-form-item label="客户 ID"><el-input-number v-model="collectionForm.customerId" :min="1" /></el-form-item>
            <el-form-item label="客户名称"><el-input v-model="collectionForm.customerName" style="width: 160px" /></el-form-item>
            <el-form-item label="金额"><el-input v-model="collectionForm.amount" style="width: 130px" /></el-form-item>
            <el-form-item label="逾期天数"><el-input-number v-model="collectionForm.overdueDays" :min="0" /></el-form-item>
            <el-form-item label="计划日期"><el-input v-model="collectionForm.plannedAt" style="width: 140px" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doCreateCollectionPlan">创建计划</el-button></el-form-item>
          </el-form>
          <el-table :data="collectionPlans" size="small">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="customerName" label="客户" width="160" />
            <el-table-column prop="amount" label="金额" width="130" />
            <el-table-column prop="overdueDays" label="逾期天数" width="110" />
            <el-table-column prop="riskLevel" label="风险" width="100" />
            <el-table-column prop="suggestion" label="建议" min-width="240" />
          </el-table>

          <el-divider content-position="left">坏账计提</el-divider>
          <el-form :inline="true">
            <el-form-item label="期间"><el-input v-model="provisionForm.period" style="width: 120px" /></el-form-item>
            <el-form-item label="客户 ID"><el-input-number v-model="provisionForm.customerId" :min="1" /></el-form-item>
            <el-form-item label="客户名称"><el-input v-model="provisionForm.customerName" style="width: 150px" /></el-form-item>
            <el-form-item label="账龄区间">
              <el-select v-model="provisionForm.agingBucket">
                <el-option label="30 天内" value="CURRENT" />
                <el-option label="31-60 天" value="D31" />
                <el-option label="61-90 天" value="D61" />
                <el-option label="90 天以上" value="D91" />
              </el-select>
            </el-form-item>
            <el-form-item label="应收金额"><el-input v-model="provisionForm.receivableAmount" style="width: 130px" /></el-form-item>
            <el-form-item label="计提比例(%)"><el-input v-model="provisionForm.provisionRate" style="width: 110px" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doSubmitProvision">提交计提</el-button><el-button @click="loadProvisionSuggestion">计提建议</el-button></el-form-item>
          </el-form>
          <el-table :data="provisions" size="small">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="period" label="期间" width="110" />
            <el-table-column prop="customerName" label="客户" width="150" />
            <el-table-column prop="agingBucket" label="账龄" width="110" />
            <el-table-column prop="receivableAmount" label="应收金额" width="130" />
            <el-table-column prop="provisionRate" label="比例" width="100" />
            <el-table-column prop="provisionAmount" label="计提金额" width="130" />
            <el-table-column prop="status" label="状态" width="110" />
            <el-table-column label="操作" width="170">
              <template #default="{ row }">
                <el-button size="small" type="primary" @click="doApproveProvision(row.id as number, true)">通过</el-button>
                <el-button size="small" @click="doApproveProvision(row.id as number, false)">驳回</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="银行流水匹配" name="bank">
        <el-card shadow="never">
          <el-form :inline="true">
            <el-form-item label="匹配阈值"><el-input-number v-model="bankMatchForm.threshold" :min="1" :max="200" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doRunBankMatch">自动匹配</el-button><el-button @click="loadBankMatches">刷新</el-button></el-form-item>
          </el-form>
          <el-descriptions v-if="bankMatchResult.total" :column="3" border>
            <el-descriptions-item label="流水数">{{ bankMatchResult.total }}</el-descriptions-item>
            <el-descriptions-item label="已匹配">{{ bankMatchResult.matched }}</el-descriptions-item>
            <el-descriptions-item label="未匹配">{{ bankMatchResult.unmatched }}</el-descriptions-item>
          </el-descriptions>
          <el-table :data="(bankMatchResult.results as Row[]) ?? []" size="small" style="margin-top: 12px">
            <el-table-column prop="externalNo" label="流水号" width="180" />
            <el-table-column prop="matched" label="是否匹配" width="100" />
            <el-table-column prop="bizType" label="匹配类型" width="120" />
            <el-table-column prop="bizId" label="单据 ID" width="110" />
            <el-table-column prop="score" label="得分" width="90" />
            <el-table-column prop="difference" label="差额" width="120" />
            <el-table-column prop="reason" label="匹配依据" min-width="240" />
          </el-table>

          <el-divider content-position="left">人工确认匹配</el-divider>
          <el-form :inline="true">
            <el-form-item label="流水 ID"><el-input-number v-model="confirmForm.transactionId" :min="1" /></el-form-item>
            <el-form-item label="单据类型">
              <el-select v-model="confirmForm.bizType">
                <el-option label="应收单" value="RECEIVABLE" />
                <el-option label="应付单" value="PAYABLE" />
                <el-option label="收款单" value="RECEIPT" />
                <el-option label="付款单" value="PAYMENT" />
              </el-select>
            </el-form-item>
            <el-form-item label="单据 ID"><el-input-number v-model="confirmForm.bizId" :min="1" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doConfirmBankMatch">确认</el-button></el-form-item>
          </el-form>
          <el-table :data="bankMatches" size="small">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="externalNo" label="流水号" width="180" />
            <el-table-column prop="bizType" label="类型" width="120" />
            <el-table-column prop="bizId" label="单据 ID" width="110" />
            <el-table-column prop="score" label="得分" width="90" />
            <el-table-column prop="status" label="状态" width="120" />
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="现金流日历与情景" name="cashflow">
        <el-card shadow="never">
          <el-form :inline="true">
            <el-form-item label="情景名称"><el-input v-model="scenarioForm.scenarioName" style="width: 170px" /></el-form-item>
            <el-form-item label="情景类型">
              <el-select v-model="scenarioForm.scenarioType">
                <el-option label="基准" value="BASE" />
                <el-option label="乐观" value="OPTIMISTIC" />
                <el-option label="悲观" value="PESSIMISTIC" />
              </el-select>
            </el-form-item>
            <el-form-item label="收入系数"><el-input-number v-model="scenarioForm.inflowFactor" :min="0" :step="0.1" /></el-form-item>
            <el-form-item label="支出系数"><el-input-number v-model="scenarioForm.outflowFactor" :min="0" :step="0.1" /></el-form-item>
            <el-form-item label="一次性调整"><el-input-number v-model="scenarioForm.oneOff" :step="100" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doCreateScenario">新增情景</el-button></el-form-item>
          </el-form>
          <el-table :data="scenarios" size="small">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="scenarioName" label="情景" min-width="160" />
            <el-table-column prop="scenarioType" label="类型" width="110" />
            <el-table-column prop="inflowFactor" label="收入系数" width="110" />
            <el-table-column prop="outflowFactor" label="支出系数" width="110" />
            <el-table-column prop="oneOff" label="一次性" width="120" />
          </el-table>

          <el-divider content-position="left">现金流日历</el-divider>
          <el-form :inline="true">
            <el-form-item label="日期"><el-input v-model="calendarForm.bizDate" style="width: 140px" /></el-form-item>
            <el-form-item label="方向">
              <el-select v-model="calendarForm.direction">
                <el-option label="流入" value="IN" />
                <el-option label="流出" value="OUT" />
              </el-select>
            </el-form-item>
            <el-form-item label="金额"><el-input v-model="calendarForm.amount" style="width: 140px" /></el-form-item>
            <el-form-item label="摘要"><el-input v-model="calendarForm.summary" style="width: 200px" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doCreateCalendarItem">新增</el-button><el-button @click="loadCalendar">刷新</el-button></el-form-item>
          </el-form>
          <el-table :data="(calendar.rows as Row[]) ?? []" size="small">
            <el-table-column prop="date" label="日期" width="140" />
            <el-table-column prop="inflow" label="流入" width="140" />
            <el-table-column prop="outflow" label="流出" width="140" />
            <el-table-column prop="net" label="净额" width="140" />
          </el-table>

          <el-divider content-position="left">情景模拟</el-divider>
          <el-form :inline="true">
            <el-form-item label="情景">
              <el-select v-model="simulateForm.scenarioType">
                <el-option label="基准" value="BASE" />
                <el-option label="乐观" value="OPTIMISTIC" />
                <el-option label="悲观" value="PESSIMISTIC" />
              </el-select>
            </el-form-item>
            <el-form-item label="收入系数"><el-input-number v-model="simulateForm.inflowFactor" :min="0" :step="0.1" /></el-form-item>
            <el-form-item label="支出系数"><el-input-number v-model="simulateForm.outflowFactor" :min="0" :step="0.1" /></el-form-item>
            <el-form-item label="期初余额"><el-input-number v-model="simulateForm.openingBalance" :step="1000" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doSimulate">模拟</el-button></el-form-item>
          </el-form>
          <el-descriptions v-if="simulation.totalInflow" :column="4" border>
            <el-descriptions-item label="总流入">{{ simulation.totalInflow }}</el-descriptions-item>
            <el-descriptions-item label="总流出">{{ simulation.totalOutflow }}</el-descriptions-item>
            <el-descriptions-item label="期末余额">{{ simulation.endingBalance }}</el-descriptions-item>
            <el-descriptions-item label="最低余额">{{ simulation.minBalance }}</el-descriptions-item>
          </el-descriptions>
          <el-alert v-if="simulation.warning" :title="String(simulation.warning)" type="warning" :closable="false" show-icon style="margin-top: 8px" />
          <el-table v-if="simulation.rows" :data="(simulation.rows as Row[]) ?? []" size="small" style="margin-top: 12px">
            <el-table-column prop="date" label="日期" width="140" />
            <el-table-column prop="inflow" label="流入" width="140" />
            <el-table-column prop="outflow" label="流出" width="140" />
            <el-table-column prop="net" label="净额" width="140" />
            <el-table-column prop="endingBalance" label="期末余额" width="140" />
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="月结检查与预算占用" name="period">
        <el-card shadow="never">
          <el-form :inline="true">
            <el-form-item label="期间"><el-input v-model="checkPeriod" style="width: 140px" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doRunChecks">生成月结检查清单</el-button><el-button @click="loadPeriodChecks">刷新</el-button></el-form-item>
          </el-form>
          <el-alert v-if="checkResult.blocking" :title="`结账阻断项：${((checkResult.blocking as string[]) ?? []).join('；')}`" type="error" :closable="false" show-icon />
          <el-alert v-if="checkResult.warnings" :title="`提示项：${((checkResult.warnings as string[]) ?? []).join('；')}`" type="warning" :closable="false" show-icon style="margin-top: 8px" />
          <el-table :data="periodChecks" size="small" style="margin-top: 8px">
            <el-table-column prop="checkCode" label="检查项编码" width="180" />
            <el-table-column prop="checkName" label="检查项" min-width="200" />
            <el-table-column label="结果" width="100">
              <template #default="{ row }">
                <el-tag :type="row.passed ? 'success' : 'danger'">{{ row.passed ? '通过' : '未通过' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="severity" label="级别" width="100" />
            <el-table-column prop="detail" label="详情" min-width="220" />
          </el-table>

          <el-divider content-position="left">反结账</el-divider>
          <el-form :inline="true">
            <el-form-item label="期间"><el-input v-model="reopenForm.period" style="width: 140px" /></el-form-item>
            <el-form-item label="原因"><el-input v-model="reopenForm.reason" style="width: 240px" /></el-form-item>
            <el-form-item><el-button type="danger" @click="doReopen">反结账</el-button></el-form-item>
          </el-form>

          <el-divider content-position="left">成本重算任务</el-divider>
          <el-form :inline="true">
            <el-form-item label="期间"><el-input v-model="costJobPeriod" style="width: 140px" /></el-form-item>
            <el-form-item>
              <el-button type="primary" @click="doCreateCostJob">发起成本重算</el-button>
              <el-button @click="loadCostJobs">刷新</el-button>
            </el-form-item>
          </el-form>
          <el-table :data="costJobs" size="small">
            <el-table-column prop="id" label="任务 ID" width="90" />
            <el-table-column prop="period" label="期间" width="110" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'DONE' ? 'success' : row.status === 'FAILED' ? 'danger' : 'warning'">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="进度" width="160">
              <template #default="{ row }">
                <el-progress :percentage="Number(row.progress ?? 0)" :stroke-width="12" />
              </template>
            </el-table-column>
            <el-table-column prop="totalItems" label="重算项数" width="100" />
            <el-table-column prop="errorMessage" label="失败原因" min-width="200" show-overflow-tooltip />
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" v-perm="'finance:cost:execute'" :disabled="row.status !== 'PENDING'" @click="doExecuteCostJob(row)">执行</el-button>
                <el-button link type="warning" v-perm="'finance:cost:execute'" :disabled="row.status !== 'FAILED'" @click="doRetryCostJob(row)">重试</el-button>
                <el-button link type="danger" @click="costJobId = row.id; doRollbackCost()">回滚</el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-divider content-position="left">成本重算回滚</el-divider>
          <el-form :inline="true">
            <el-form-item label="成本任务 ID"><el-input-number v-model="costJobId" :min="1" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doRollbackCost">回滚</el-button></el-form-item>
          </el-form>
          <el-descriptions v-if="rollbackResult.restored" :column="3" border>
            <el-descriptions-item label="期间">{{ rollbackResult.period }}</el-descriptions-item>
            <el-descriptions-item label="还原成本行数">{{ rollbackResult.restored }}</el-descriptions-item>
            <el-descriptions-item label="状态">{{ rollbackResult.rollbackStatus }}</el-descriptions-item>
          </el-descriptions>

          <el-divider content-position="left">预算占用</el-divider>
          <el-form :inline="true">
            <el-form-item label="期间"><el-input v-model="occupyForm.period" style="width: 120px" /></el-form-item>
            <el-form-item label="部门 ID"><el-input-number v-model="occupyForm.deptId" :min="1" /></el-form-item>
            <el-form-item label="科目 ID"><el-input-number v-model="occupyForm.subjectId" :min="1" /></el-form-item>
            <el-form-item label="金额"><el-input v-model="occupyForm.amount" style="width: 130px" /></el-form-item>
            <el-form-item label="业务类型"><el-input v-model="occupyForm.bizType" style="width: 120px" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doOccupy">占用预算</el-button></el-form-item>
          </el-form>
          <el-table :data="occupations" size="small">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="budgetId" label="预算 ID" width="110" />
            <el-table-column prop="period" label="期间" width="110" />
            <el-table-column prop="amount" label="占用金额" width="140" />
            <el-table-column prop="bizType" label="业务类型" width="120" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">{{ row.released ? '已释放' : '占用中' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button size="small" @click="doRelease(row.id as number)">释放</el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-divider content-position="left">财务仪表盘</el-divider>
          <el-table :data="(dashboard.metrics as Row[]) ?? []" size="small">
            <el-table-column prop="label" label="指标" width="160" />
            <el-table-column prop="value" label="数值" width="160" />
            <el-table-column prop="unit" label="单位" width="90" />
            <el-table-column prop="status" label="健康度" width="110" />
            <el-table-column prop="drillKey" label="下钻目标" min-width="180" />
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

