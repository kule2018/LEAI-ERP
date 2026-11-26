<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  accrueCommission, assignComplaint, calculateCommission, closeComplaint, completeVisit,
  confirmCommission, createComplaint, createCommissionRule, createVisit, fetchCommissionRecords,
  fetchCommissionRules, fetchCommissionSummary, fetchComplaints, fetchComplaintDetail,
  fetchReturnRate, fetchUnshippedList, fetchVisitSummary, fetchVisits, payCommission,
  planVisits, previewCommission, reopenComplaint, resolveComplaint, updateCommissionRule,
  type CommissionPreview, type CommissionRecord, type CommissionRule, type Complaint,
  type ComplaintDetail, type ReturnRateReport, type UnshippedRow, type Visit, type VisitSummary
} from '@/api/sales-crm-extension'

const tab = ref('rule')

/* ------------------------------ 佣金规则 ------------------------------ */
const rules = ref<CommissionRule[]>([])
const ruleForm = reactive({
  ruleCode: '', ruleName: '', ruleType: 'RATE', rate: '0.01', fixedAmount: '100',
  tiersText: '', salesRepId: undefined as number | undefined, effectiveFrom: '', effectiveTo: ''
})

async function loadRules(): Promise<void> {
  const res = await fetchCommissionRules({ page: 1, pageSize: 50 })
  rules.value = res.list
}

async function saveRule(): Promise<void> {
  const payload: Record<string, unknown> = {
    ruleCode: ruleForm.ruleCode,
    ruleName: ruleForm.ruleName,
    ruleType: ruleForm.ruleType
  }
  if (ruleForm.ruleType === 'RATE') payload.rate = ruleForm.rate
  if (ruleForm.ruleType === 'FIXED') payload.fixedAmount = ruleForm.fixedAmount
  if (ruleForm.ruleType === 'TIER') {
    payload.tiers = ruleForm.tiersText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [min, rate] = line.split(',').map((part) => Number(part.trim()))
        return { min, rate }
      })
  }
  if (ruleForm.salesRepId) payload.salesRepId = ruleForm.salesRepId
  if (ruleForm.effectiveFrom) payload.effectiveFrom = ruleForm.effectiveFrom
  if (ruleForm.effectiveTo) payload.effectiveTo = ruleForm.effectiveTo
  await createCommissionRule(payload)
  ElMessage.success('佣金规则已创建')
  await loadRules()
}

async function toggleRule(row: CommissionRule): Promise<void> {
  await updateCommissionRule(row.id, { status: row.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })
  ElMessage.success('规则状态已更新')
  await loadRules()
}

/* ------------------------------ 佣金核算 ------------------------------ */
const records = ref<CommissionRecord[]>([])
const summary = ref<{ period: string; totalAmount: number; totalCount: number; bySalesRep: Array<{ salesRepId: number | null; amount: number; count: number }> } | null>(null)
const calcForm = reactive({ ruleId: undefined as number | undefined, orderId: undefined as number | undefined, period: '' })
const preview = ref<CommissionPreview | null>(null)
const accrueForm = reactive({ period: new Date().toISOString().slice(0, 7), ruleId: undefined as number | undefined })
const accrueResult = ref<{ created: number; skipped: number; totalAmount: number } | null>(null)

async function loadRecords(): Promise<void> {
  const res = await fetchCommissionRecords({ page: 1, pageSize: 50 })
  records.value = res.list
  summary.value = await fetchCommissionSummary()
}

async function doPreview(): Promise<void> {
  if (!calcForm.ruleId || !calcForm.orderId) {
    ElMessage.warning('请先选择规则与销售单')
    return
  }
  preview.value = await previewCommission(calcForm.ruleId, calcForm.orderId)
}

async function doCalculate(): Promise<void> {
  if (!calcForm.ruleId || !calcForm.orderId) {
    ElMessage.warning('请先选择规则与销售单')
    return
  }
  await calculateCommission({ ruleId: calcForm.ruleId, orderId: calcForm.orderId, period: calcForm.period || undefined })
  ElMessage.success('佣金已核算')
  await loadRecords()
}

async function doAccrue(): Promise<void> {
  const result = await accrueCommission({ period: accrueForm.period, ruleId: accrueForm.ruleId })
  accrueResult.value = { created: result.created, skipped: result.skipped, totalAmount: result.totalAmount }
  ElMessage.success(`批量计提完成：新增 ${result.created} 笔，跳过 ${result.skipped} 笔`)
  await loadRecords()
}

async function confirmRecord(row: CommissionRecord): Promise<void> {
  await confirmCommission(row.id)
  ElMessage.success('佣金已确认')
  await loadRecords()
}

async function payRecord(row: CommissionRecord): Promise<void> {
  try {
    const { value } = await ElMessageBox.prompt('请输入收款方（供应商）ID，留空则不生成应付单', `发放佣金 #${row.id}`, {
      inputPlaceholder: '如：12',
      inputPattern: /^\d*$/,
      inputErrorMessage: '请输入数字 ID'
    })
    const supplierId = value ? Number(value) : undefined
    await payCommission(row.id, undefined, supplierId)
    ElMessage.success(supplierId ? '佣金已发放并生成应付单' : '佣金已发放')
    await loadRecords()
  } catch (cause) {
    if (cause === 'cancel' || cause === 'close') return
    throw cause
  }
}

/* ------------------------------ 投诉工单 ------------------------------ */
const complaints = ref<Complaint[]>([])
const slaSummary = ref<{ total: number; overdue: number }>({ total: 0, overdue: 0 })
const complaintDetail = ref<ComplaintDetail | null>(null)
const complaintDetailVisible = computed({
  get: () => complaintDetail.value !== null,
  set: (value: boolean) => { if (!value) complaintDetail.value = null }
})
const complaintForm = reactive({
  customerId: undefined as number | undefined, orderId: undefined as number | undefined,
  complaintType: 'SERVICE', title: '', description: '', severity: 'MEDIUM'
})

async function loadComplaints(): Promise<void> {
  const res = await fetchComplaints({ page: 1, pageSize: 50 })
  complaints.value = res.list
  slaSummary.value = res.slaSummary
}

async function addComplaint(): Promise<void> {
  if (!complaintForm.customerId) {
    ElMessage.warning('请填写客户 ID')
    return
  }
  await createComplaint({ ...complaintForm, orderId: complaintForm.orderId || undefined })
  ElMessage.success('投诉工单已创建')
  await loadComplaints()
}

async function handleComplaint(row: Complaint): Promise<void> {
  if (row.status === 'OPEN') {
    await assignComplaint(row.id, row.assigneeId ?? 1)
    ElMessage.success('已派单')
  } else if (row.status === 'PROCESSING') {
    await resolveComplaint(row.id, '已与客户沟通并达成处理方案')
    ElMessage.success('已处理完成')
  } else if (row.status === 'RESOLVED') {
    await closeComplaint(row.id)
    ElMessage.success('已归档关闭')
  } else if (row.status === 'CLOSED') {
    try {
      const { value } = await ElMessageBox.prompt('请输入重开原因', `重开工单 ${row.complaintNo}`, { inputPlaceholder: '如：客户反馈问题未解决' })
      await reopenComplaint(row.id, value)
      ElMessage.success('工单已重开')
    } catch (cause) {
      if (cause === 'cancel' || cause === 'close') return
      throw cause
    }
  }
  await loadComplaints()
}

async function showComplaintLogs(row: Complaint): Promise<void> {
  complaintDetail.value = await fetchComplaintDetail(row.id)
}

/* ------------------------------ 客户回访 ------------------------------ */
const visits = ref<Visit[]>([])
const visitSummary = ref<VisitSummary | null>(null)
const visitForm = reactive({
  customerId: undefined as number | undefined, salesRepId: undefined as number | undefined,
  visitDate: '', channel: 'PHONE', content: '', feedback: '', nextVisitAt: '', satisfaction: undefined as number | undefined
})
const planForm = reactive({ intervalDays: 30, salesRepId: undefined as number | undefined })

async function loadVisits(): Promise<void> {
  const res = await fetchVisits({ page: 1, pageSize: 50 })
  visits.value = res.list
  visitSummary.value = await fetchVisitSummary()
}

async function addVisit(): Promise<void> {
  if (!visitForm.customerId) {
    ElMessage.warning('请填写客户 ID')
    return
  }
  await createVisit({
    ...visitForm,
    visitDate: visitForm.visitDate || undefined,
    nextVisitAt: visitForm.nextVisitAt || undefined,
    satisfaction: visitForm.satisfaction
  })
  ElMessage.success('回访记录已保存')
  await loadVisits()
}

async function doCompleteVisit(row: Visit): Promise<void> {
  try {
    const { value } = await ElMessageBox.prompt('请输入满意度评分（1-5）', `完成回访 ${row.visitNo}`, {
      inputPattern: /^[1-5]$/,
      inputErrorMessage: '请输入 1 到 5 的数字'
    })
    await completeVisit(row.id, { satisfaction: Number(value), content: row.content ?? undefined, feedback: row.feedback ?? undefined })
    ElMessage.success('回访已完成')
    await loadVisits()
  } catch (cause) {
    if (cause === 'cancel' || cause === 'close') return
    throw cause
  }
}

async function doPlanVisits(): Promise<void> {
  const result = await planVisits({ intervalDays: planForm.intervalDays, salesRepId: planForm.salesRepId })
  ElMessage.success(`已生成 ${result.created} 条回访计划`)
  await loadVisits()
}

/* ------------------------------ 未发货 / 退货率 ------------------------------ */
const unshipped = ref<UnshippedRow[]>([])
const unshippedSummary = ref<{ totalRows: number; overdueRows: number; totalUnshippedQty: number }>({
  totalRows: 0, overdueRows: 0, totalUnshippedQty: 0
})
const onlyOverdue = ref(false)
const returnRate = ref<ReturnRateReport | null>(null)

async function loadUnshipped(): Promise<void> {
  const res = await fetchUnshippedList(onlyOverdue.value ? { overdueOnly: 'true' } : {})
  unshipped.value = res.list
  unshippedSummary.value = res.summary
}

async function loadReturnRate(): Promise<void> {
  returnRate.value = await fetchReturnRate({})
}

function severityTag(severity: string): string {
  if (severity === 'URGENT') return 'danger'
  if (severity === 'HIGH') return 'warning'
  if (severity === 'MEDIUM') return 'primary'
  return 'info'
}

function complaintStatusTag(status: string): string {
  if (status === 'OPEN') return 'danger'
  if (status === 'PROCESSING') return 'warning'
  if (status === 'RESOLVED') return 'success'
  return 'info'
}

onMounted(async () => {
  await Promise.all([loadRules(), loadRecords(), loadComplaints(), loadVisits(), loadUnshipped(), loadReturnRate()])
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>佣金与客户运营</h2>
      <p>销售佣金规则与核算、客户投诉工单 SLA、客户回访记录、未发货清单与退货率分析。</p>
    </header>
    <el-tabs v-model="tab" type="card">
      <el-tab-pane label="佣金规则" name="rule">
        <article class="panel form-panel">
          <el-form label-width="110px">
            <el-form-item label="规则编码"><el-input v-model="ruleForm.ruleCode" placeholder="如 RULE-001" /></el-form-item>
            <el-form-item label="规则名称"><el-input v-model="ruleForm.ruleName" /></el-form-item>
            <el-form-item label="计提方式">
              <el-select v-model="ruleForm.ruleType">
                <el-option label="按比例" value="RATE" />
                <el-option label="固定金额" value="FIXED" />
                <el-option label="阶梯" value="TIER" />
              </el-select>
            </el-form-item>
            <el-form-item v-if="ruleForm.ruleType === 'RATE'" label="比例">
              <el-input v-model="ruleForm.rate" placeholder="0.01 表示 1%" />
            </el-form-item>
            <el-form-item v-if="ruleForm.ruleType === 'FIXED'" label="固定金额"><el-input v-model="ruleForm.fixedAmount" /></el-form-item>
            <el-form-item v-if="ruleForm.ruleType === 'TIER'" label="阶梯配置">
              <el-input v-model="ruleForm.tiersText" type="textarea" :rows="3" placeholder="每行一档：门槛,比例，如 100000,0.02" />
            </el-form-item>
            <el-form-item label="业务员 ID"><el-input-number v-model="ruleForm.salesRepId" :min="1" /></el-form-item>
            <el-form-item label="生效起"><el-date-picker v-model="ruleForm.effectiveFrom" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
            <el-form-item label="生效止"><el-date-picker v-model="ruleForm.effectiveTo" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
          </el-form>
          <el-button type="primary" v-perm="'sales:commission:manage'" @click="saveRule">新增规则</el-button>
        </article>

        <article class="panel">
          <el-table :data="rules" size="small">
            <el-table-column prop="ruleCode" label="编码" width="130" />
            <el-table-column prop="ruleName" label="名称" min-width="160" />
            <el-table-column prop="ruleType" label="方式" width="90" />
            <el-table-column prop="rate" label="比例" width="90" />
            <el-table-column prop="fixedAmount" label="固定金额" width="110" />
            <el-table-column prop="salesRepId" label="业务员" width="90" />
            <el-table-column prop="status" label="状态" width="90" />
            <el-table-column label="操作" width="110">
              <template #default="{ row }">
                <el-button size="small" v-perm="'sales:commission:manage'" @click="toggleRule(row)">
                  {{ row.status === 'ACTIVE' ? '停用' : '启用' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </article>
      </el-tab-pane>

      <el-tab-pane label="佣金核算" name="commission">
        <article class="panel form-panel">
          <el-form label-width="110px">
            <el-form-item label="规则 ID"><el-input-number v-model="calcForm.ruleId" :min="1" /></el-form-item>
            <el-form-item label="销售单 ID"><el-input-number v-model="calcForm.orderId" :min="1" /></el-form-item>
            <el-form-item label="核算期间"><el-date-picker v-model="calcForm.period" type="month" value-format="YYYY-MM" placeholder="YYYY-MM，默认取订单月份"  /></el-form-item>
          </el-form>
          <el-button v-perm="'sales:commission:view'" @click="doPreview">试算</el-button>
          <el-button type="primary" v-perm="'sales:commission:calculate'" @click="doCalculate">生成核算记录</el-button>
          <el-divider direction="vertical" />
          <el-date-picker v-model="accrueForm.period" type="month" value-format="YYYY-MM" placeholder="计提期间 YYYY-MM" style="width: 170px"  />
          <el-input-number v-model="accrueForm.ruleId" :min="1" placeholder="规则ID(可选)" style="width: 160px" />
          <el-button v-perm="'sales:commission:calculate'" @click="doAccrue">批量计提</el-button>
          <el-alert v-if="accrueResult" type="success" :closable="false" style="margin-top: 12px"
            :title="`本次新增 ${accrueResult.created} 笔，跳过 ${accrueResult.skipped} 笔，合计 ${accrueResult.totalAmount}`" />

          <el-descriptions v-if="preview" :column="3" border style="margin-top: 16px">
            <el-descriptions-item label="销售单">{{ preview.orderNo }}</el-descriptions-item>
            <el-descriptions-item label="订单金额">{{ preview.orderAmount }}</el-descriptions-item>
            <el-descriptions-item label="退货冲减">{{ preview.returnAmount }}</el-descriptions-item>
            <el-descriptions-item label="累计销售额">{{ preview.accumulatedAmount }}</el-descriptions-item>
            <el-descriptions-item label="计提金额">{{ preview.result.commissionAmount }}</el-descriptions-item>
            <el-descriptions-item label="计提依据">{{ preview.result.reason }}</el-descriptions-item>
          </el-descriptions>
        </article>

        <article v-if="summary" class="panel">
          <el-descriptions :column="3" border>
            <el-descriptions-item label="期间">{{ summary.period }}</el-descriptions-item>
            <el-descriptions-item label="佣金合计">{{ summary.totalAmount }}</el-descriptions-item>
            <el-descriptions-item label="核算笔数">{{ summary.totalCount }}</el-descriptions-item>
          </el-descriptions>
          <el-table :data="summary.bySalesRep" size="small" style="margin-top: 12px">
            <el-table-column prop="salesRepId" label="业务员 ID" width="120" />
            <el-table-column prop="amount" label="佣金合计" width="140" />
            <el-table-column prop="count" label="笔数" width="100" />
          </el-table>
        </article>

        <article class="panel">
          <el-table :data="records" size="small">
            <el-table-column prop="orderNo" label="销售单" width="150" />
            <el-table-column prop="period" label="期间" width="110" />
            <el-table-column prop="orderAmount" label="订单金额" width="130" />
            <el-table-column prop="returnAmount" label="退货冲减" width="130" />
            <el-table-column prop="commissionAmount" label="佣金" width="130" />
            <el-table-column prop="payableNo" label="应付单" width="130" />
            <el-table-column prop="status" label="状态" width="110" />
            <el-table-column label="操作" width="180">
              <template #default="{ row }">
                <el-button size="small" v-perm="'sales:commission:confirm'" @click="confirmRecord(row)">确认</el-button>
                <el-button size="small" v-perm="'sales:commission:pay'" @click="payRecord(row)">发放</el-button>
              </template>
            </el-table-column>
          </el-table>
        </article>
      </el-tab-pane>
      <el-tab-pane label="投诉工单" name="complaint">
        <article class="panel form-panel">
          <el-form label-width="110px">
            <el-form-item label="客户 ID"><el-input-number v-model="complaintForm.customerId" :min="1" /></el-form-item>
            <el-form-item label="销售单 ID"><el-input-number v-model="complaintForm.orderId" :min="1" /></el-form-item>
            <el-form-item label="投诉类型">
              <el-select v-model="complaintForm.complaintType">
                <el-option label="质量" value="QUALITY" />
                <el-option label="交付" value="DELIVERY" />
                <el-option label="服务" value="SERVICE" />
                <el-option label="价格" value="PRICE" />
              </el-select>
            </el-form-item>
            <el-form-item label="严重级别">
              <el-select v-model="complaintForm.severity">
                <el-option label="低" value="LOW" />
                <el-option label="中" value="MEDIUM" />
                <el-option label="高" value="HIGH" />
                <el-option label="紧急" value="URGENT" />
              </el-select>
            </el-form-item>
            <el-form-item label="标题"><el-input v-model="complaintForm.title" /></el-form-item>
            <el-form-item label="描述"><el-input v-model="complaintForm.description" type="textarea" :rows="3" /></el-form-item>
          </el-form>
          <el-button type="primary" v-perm="'sales:complaint:create'" @click="addComplaint">登记投诉</el-button>
        </article>

        <article class="panel">
          <el-alert
            type="warning"
            :closable="false"
            :title="`在办工单 ${slaSummary.total} 件，其中超时 ${slaSummary.overdue} 件（时效按严重级别 72/48/24/8 小时）`"
            style="margin-bottom: 12px"
          />
          <el-table :data="complaints" size="small">
            <el-table-column prop="complaintNo" label="工单号" width="150" />
            <el-table-column prop="customerId" label="客户 ID" width="100" />
            <el-table-column prop="title" label="标题" min-width="160" />
            <el-table-column prop="severity" label="级别" width="90">
              <template #default="{ row }"><el-tag :type="severityTag(row.severity)">{{ row.severity }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="110">
              <template #default="{ row }"><el-tag :type="complaintStatusTag(row.status)">{{ row.status }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="assigneeId" label="处理人" width="90" />
            <el-table-column prop="reopenCount" label="重开次数" width="100" />
            <el-table-column label="操作" width="180">
              <template #default="{ row }">
                <el-button size="small" v-perm="'sales:complaint:handle'" @click="handleComplaint(row)">
                  {{ row.status === 'OPEN' ? '派单' : row.status === 'PROCESSING' ? '处理' : row.status === 'RESOLVED' ? '关闭' : '重开' }}
                </el-button>
                <el-button size="small" v-perm="'sales:complaint:view'" @click="showComplaintLogs(row)">轨迹</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-dialog v-model="complaintDetailVisible" title="投诉工单流转轨迹" width="720px">
            <template v-if="complaintDetail">
              <el-descriptions :column="3" border size="small">
                <el-descriptions-item label="工单">{{ complaintDetail.complaint.complaintNo }}</el-descriptions-item>
                <el-descriptions-item label="状态">{{ complaintDetail.complaint.status }}</el-descriptions-item>
                <el-descriptions-item label="超时">{{ complaintDetail.sla.overdue ? `${complaintDetail.sla.overdueHours} 小时` : '否' }}</el-descriptions-item>
              </el-descriptions>
              <el-timeline style="margin-top: 16px">
                <el-timeline-item v-for="log in complaintDetail.logs" :key="log.id" :timestamp="log.createdAt">
                  {{ log.action }}：{{ log.fromStatus || '-' }} → {{ log.toStatus }}（{{ log.operatorName }}）{{ log.remark }}
                </el-timeline-item>
              </el-timeline>
            </template>
          </el-dialog>
        </article>
      </el-tab-pane>

      <el-tab-pane label="客户回访" name="visit">
        <article class="panel form-panel">
          <el-form label-width="110px">
            <el-form-item label="客户 ID"><el-input-number v-model="visitForm.customerId" :min="1" /></el-form-item>
            <el-form-item label="业务员 ID"><el-input-number v-model="visitForm.salesRepId" :min="1" /></el-form-item>
            <el-form-item label="回访日期"><el-date-picker v-model="visitForm.visitDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
            <el-form-item label="回访方式">
              <el-select v-model="visitForm.channel">
                <el-option label="电话" value="PHONE" />
                <el-option label="到店" value="VISIT" />
                <el-option label="在线" value="ONLINE" />
                <el-option label="售后" value="AFTER_SALE" />
              </el-select>
            </el-form-item>
            <el-form-item label="回访内容"><el-input v-model="visitForm.content" type="textarea" :rows="3" /></el-form-item>
            <el-form-item label="客户反馈"><el-input v-model="visitForm.feedback" /></el-form-item>
            <el-form-item label="满意度">
              <el-rate v-model="visitForm.satisfaction" :max="5" />
            </el-form-item>
            <el-form-item label="下次回访"><el-date-picker v-model="visitForm.nextVisitAt" type="datetime" value-format="YYYY-MM-DD HH:mm" placeholder="YYYY-MM-DD HH:mm"  /></el-form-item>
          </el-form>
          <el-button type="primary" v-perm="'sales:visit:create'" @click="addVisit">保存回访</el-button>
        </article>

        <article v-if="visitSummary" class="panel">
          <el-descriptions :column="4" border>
            <el-descriptions-item label="回访总数">{{ visitSummary.total }}</el-descriptions-item>
            <el-descriptions-item label="已完成">{{ visitSummary.done }}</el-descriptions-item>
            <el-descriptions-item label="计划中 / 超期">{{ visitSummary.planned }} / {{ visitSummary.overdue }}</el-descriptions-item>
            <el-descriptions-item label="完成率 / 满意度">{{ visitSummary.rate }}% / {{ visitSummary.avgSatisfaction }}</el-descriptions-item>
          </el-descriptions>
        </article>

        <article class="panel">
          <div class="panel-toolbar">
            <span>回访周期（天）</span>
            <el-input-number v-model="planForm.intervalDays" :min="1" style="width: 140px" />
            <el-button v-perm="'sales:visit:create'" @click="doPlanVisits">批量生成回访计划</el-button>
          </div>
          <el-table :data="visits" size="small">
            <el-table-column prop="visitNo" label="回访单号" width="150" />
            <el-table-column prop="customerId" label="客户 ID" width="100" />
            <el-table-column prop="visitDate" label="回访日期" width="120" />
            <el-table-column prop="channel" label="方式" width="100" />
            <el-table-column prop="content" label="内容" min-width="180" />
            <el-table-column prop="satisfaction" label="满意度" width="110">
              <template #default="{ row }">
                <el-rate :model-value="row.satisfaction ?? 0" disabled :max="5" />
              </template>
            </el-table-column>
            <el-table-column prop="nextVisitAt" label="下次回访" width="150" />
            <el-table-column prop="status" label="状态" width="100" />
            <el-table-column label="操作" width="110">
              <template #default="{ row }">
                <el-button size="small" :disabled="row.status === 'DONE'" v-perm="'sales:visit:create'" @click="doCompleteVisit(row)">完成</el-button>
              </template>
            </el-table-column>
          </el-table>
        </article>
      </el-tab-pane>

      <el-tab-pane label="未发货清单" name="unshipped">
        <article class="panel">
          <el-descriptions :column="3" border>
            <el-descriptions-item label="未发货行数">{{ unshippedSummary.totalRows }}</el-descriptions-item>
            <el-descriptions-item label="逾期行数">{{ unshippedSummary.overdueRows }}</el-descriptions-item>
            <el-descriptions-item label="未发货数量">{{ unshippedSummary.totalUnshippedQty }}</el-descriptions-item>
          </el-descriptions>
          <el-checkbox v-model="onlyOverdue" style="margin: 12px 0" @change="loadUnshipped">仅看逾期</el-checkbox>
          <el-table :data="unshipped" size="small">
            <el-table-column prop="orderNo" label="销售单" width="150" />
            <el-table-column prop="customerName" label="客户" min-width="140" />
            <el-table-column prop="productName" label="商品" min-width="150" />
            <el-table-column prop="orderedQty" label="订单数量" width="110" />
            <el-table-column prop="shippedQty" label="已发货" width="100" />
            <el-table-column prop="unshippedQty" label="未发货" width="100" />
            <el-table-column prop="orderDate" label="下单日期" width="120" />
            <el-table-column prop="promisedDate" label="承诺交期" width="120" />
            <el-table-column prop="overdue" label="逾期" width="90">
              <template #default="{ row }">
                <el-tag v-if="row.overdue" type="danger">逾期</el-tag>
                <span v-else>-</span>
              </template>
            </el-table-column>
          </el-table>
        </article>
      </el-tab-pane>

      <el-tab-pane label="退货率" name="return-rate">
        <article v-if="returnRate" class="panel">
          <el-descriptions :column="3" border>
            <el-descriptions-item label="销售金额">{{ returnRate.salesAmount }}</el-descriptions-item>
            <el-descriptions-item label="退货金额">{{ returnRate.returnAmount }}</el-descriptions-item>
            <el-descriptions-item label="退货率">{{ returnRate.percent }}</el-descriptions-item>
            <el-descriptions-item label="销售单数">{{ returnRate.orderCount }}</el-descriptions-item>
            <el-descriptions-item label="退货单数">{{ returnRate.returnCount }}</el-descriptions-item>
          </el-descriptions>
          <el-table :data="returnRate.byCustomer" size="small" style="margin-top: 12px">
            <el-table-column prop="customerName" label="客户" min-width="160" />
            <el-table-column prop="salesAmount" label="销售金额" width="140" />
            <el-table-column prop="returnAmount" label="退货金额" width="140" />
            <el-table-column prop="percent" label="退货率" width="110" />
          </el-table>
        </article>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; margin-bottom: 16px; }
.form-panel { max-width: 720px; }
</style>
