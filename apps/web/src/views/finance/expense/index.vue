<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  allocateExpenseClaim, approveExpenseClaim, createExpenseClaim, fetchExpenseClaims,
  ocrReceipt, payExpenseClaim, type ExpenseClaim
} from '@/api/finance-extension'
import { fetchAccounts, type FinAccount } from '@/api/finance'
import { fetchDepts, type Dept } from '@/api/system-admin'

const rows = ref<ExpenseClaim[]>([])
const total = ref(0)
const loading = ref(false)
const query = reactive({ page: 1, pageSize: 20, status: '' })
const depts = ref<Dept[]>([])
const accounts = ref<FinAccount[]>([])
let seq = 0

/** 新建报销 */
const createVisible = ref(false)
const creating = ref(false)
const form = reactive({
  amount: '0',
  deptId: undefined as number | undefined,
  occurredAt: new Date().toISOString().slice(0, 10),
  summary: '',
  category: 'TRAVEL',
  counterparty: '',
  hasInvoice: true,
  sourceText: ''
})

/** 分摊 */
const allocateVisible = ref(false)
const current = ref<ExpenseClaim | null>(null)
const allocations = ref<Array<{ deptId: number | undefined; ratio: number; subjectId?: number }>>([])

/** 付款 */
const payVisible = ref(false)
const payForm = reactive({ supplierId: undefined as number | undefined, accountId: undefined as number | undefined, amount: '0' })

const deptOptions = computed(() => depts.value.map((item) => ({ label: `${item.deptName}（${item.deptCode}）`, value: item.id })))

async function load(): Promise<void> {
  const currentSeq = ++seq
  loading.value = true
  try {
    const result = await fetchExpenseClaims({ page: query.page, pageSize: query.pageSize, status: query.status || undefined })
    if (currentSeq !== seq) return
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '报销单加载失败')
  } finally {
    if (currentSeq === seq) loading.value = false
  }
}

async function loadOptions(): Promise<void> {
  try {
    const [deptResult, accountResult] = await Promise.all([
      fetchDepts({ page: 1, pageSize: 100 }),
      fetchAccounts({ page: 1, pageSize: 100 })
    ])
    depts.value = deptResult.list
    accounts.value = accountResult.list
  } catch {
    // 基础数据加载失败不阻断报销主流程
  }
}

function openCreate(): void {
  Object.assign(form, {
    amount: '0',
    deptId: depts.value[0]?.id,
    occurredAt: new Date().toISOString().slice(0, 10),
    summary: '',
    category: 'TRAVEL',
    counterparty: '',
    hasInvoice: true,
    sourceText: ''
  })
  createVisible.value = true
}

/** 票据 OCR：解析金额与日期后回填表单 */
async function parseReceipt(): Promise<void> {
  if (!form.sourceText.trim()) { ElMessage.warning('请粘贴票据文本'); return }
  try {
    const result = await ocrReceipt(form.sourceText)
    const data = (result as { result?: Record<string, unknown> }).result ?? result
    const amount = data.amount ?? data.total
    const date = data.date ?? data.occurredAt
    if (amount) form.amount = String(amount)
    if (date) form.occurredAt = String(date).slice(0, 10)
    if (data.summary) form.summary = String(data.summary)
    ElMessage.success('票据已识别，请确认金额与日期')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '识别失败')
  }
}

async function submit(): Promise<void> {
  creating.value = true
  try {
    await createExpenseClaim({
      amount: form.amount,
      deptId: form.deptId,
      occurredAt: form.occurredAt,
      summary: form.summary,
      category: form.category,
      counterparty: form.counterparty,
      hasInvoice: form.hasInvoice,
      sourceText: form.sourceText
    })
    createVisible.value = false
    ElMessage.success('报销单已提交，已占用对应期间预算')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '提交失败')
  } finally {
    creating.value = false
  }
}

async function approve(row: ExpenseClaim, status: 'APPROVED' | 'REJECTED'): Promise<void> {
  try {
    const { value } = await ElMessageBox.prompt(
      status === 'APPROVED' ? '审批意见（可留空）' : '请填写驳回原因',
      status === 'APPROVED' ? '审批通过' : '审批驳回',
      { inputPlaceholder: '备注', inputValue: '' }
    )
    await approveExpenseClaim(row.id, { status, remark: value })
    ElMessage.success(status === 'APPROVED' ? '已通过' : '已驳回，预算占用已释放')
    await load()
  } catch (cause) {
    if (cause instanceof Error) ElMessage.error(cause.message)
  }
}

function openAllocate(row: ExpenseClaim): void {
  current.value = row
  allocations.value = [{ deptId: row.deptId ?? depts.value[0]?.id, ratio: 1 }]
  allocateVisible.value = true
}

function addAllocation(): void {
  allocations.value.push({ deptId: depts.value[0]?.id, ratio: 0 })
}

function removeAllocation(index: number): void {
  allocations.value.splice(index, 1)
}

const ratioTotal = computed(() => allocations.value.reduce((sum, item) => sum + Number(item.ratio || 0), 0))

async function submitAllocation(): Promise<void> {
  if (!current.value) return
  const items = allocations.value
    .filter((item) => item.deptId && Number(item.ratio) > 0)
    .map((item) => ({ deptId: item.deptId as number, ratio: Number(item.ratio), subjectId: item.subjectId }))
  if (items.length === 0) { ElMessage.warning('请至少填写一条分摊明细'); return }
  if (Math.abs(ratioTotal.value - 1) > 0.0001) { ElMessage.warning('分摊比例合计必须为 1'); return }
  try {
    await allocateExpenseClaim(current.value.id, items)
    allocateVisible.value = false
    ElMessage.success('部门分摊已保存，预算占用已按部门重新分配')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '分摊保存失败')
  }
}

function openPay(row: ExpenseClaim): void {
  current.value = row
  Object.assign(payForm, { supplierId: undefined, accountId: accounts.value[0]?.id, amount: row.amount })
  payVisible.value = true
}

async function submitPay(): Promise<void> {
  if (!current.value) return
  if (!payForm.accountId) { ElMessage.warning('请选择付款账户'); return }
  try {
    await payExpenseClaim(current.value.id, {
      supplierId: payForm.supplierId ?? 0,
      accountId: payForm.accountId,
      amount: payForm.amount
    })
    payVisible.value = false
    ElMessage.success('付款完成，预算占用已转为实际使用')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '付款失败')
  }
}

function statusTag(status: string): 'info' | 'success' | 'warning' | 'danger' {
  if (status === 'APPROVED' || status === 'PAID') return 'success'
  if (status === 'REJECTED') return 'danger'
  if (status === 'SUBMITTED') return 'warning'
  return 'info'
}

function statusText(status: string): string {
  const map: Record<string, string> = {
    SUBMITTED: '待审批', APPROVED: '已批准', REJECTED: '已驳回', PAID: '已付款', CANCELLED: '已取消'
  }
  return map[status] ?? status
}

onMounted(() => {
  void load()
  void loadOptions()
})
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>费用报销</h2>
      <p>报销单提交即占用当期预算，驳回/取消自动释放，付款后转为实际使用；支持多部门分摊。</p>
    </header>

    <article class="panel">
      <div class="toolbar">
        <el-button type="primary" v-perm="'finance:expense:create'" @click="openCreate">新建报销</el-button>
        <el-select v-model="query.status" placeholder="全部状态" clearable style="width: 140px" @change="load">
          <el-option label="待审批" value="SUBMITTED" />
          <el-option label="已批准" value="APPROVED" />
          <el-option label="已驳回" value="REJECTED" />
          <el-option label="已付款" value="PAID" />
        </el-select>
        <el-button @click="load">刷新</el-button>
        <span class="total">共 {{ total }} 张</span>
      </div>

      <el-table v-loading="loading" :data="rows" row-key="id" size="small" border>
        <el-table-column prop="claimNo" label="报销单号" width="170" />
        <el-table-column prop="occurredAt" label="发生日期" width="120" />
        <el-table-column prop="amount" label="金额" width="130" />
        <el-table-column prop="summary" label="摘要" min-width="180" />
        <el-table-column prop="counterparty" label="对方单位" width="140" />
        <el-table-column label="政策校验" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="row.policyLevel === 'PASS' ? 'success' : row.policyLevel === 'WARN' ? 'warning' : 'danger'">
              {{ row.policyLevel }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTag(row.status)">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="230">
          <template #default="{ row }">
            <el-button v-if="row.status === 'SUBMITTED'" link type="success" v-perm="'finance:expense:approve'" @click="approve(row, 'APPROVED')">通过</el-button>
            <el-button v-if="row.status === 'SUBMITTED'" link type="danger" v-perm="'finance:expense:approve'" @click="approve(row, 'REJECTED')">驳回</el-button>
            <el-button v-if="row.status === 'APPROVED'" link type="primary" v-perm="'finance:expense:approve'" @click="openAllocate(row)">部门分摊</el-button>
            <el-button v-if="row.status === 'APPROVED'" link type="warning" v-perm="'finance:expense:pay'" @click="openPay(row)">付款</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        layout="total, prev, pager, next"
        style="margin-top: 12px"
        @current-change="load"
      />
    </article>

    <el-dialog v-model="createVisible" title="新建费用报销" width="620px">
      <el-form label-width="110px">
        <el-form-item label="票据文本"><el-input v-model="form.sourceText" type="textarea" :rows="2" placeholder="粘贴票据文本后点击识别" /></el-form-item>
        <el-form-item label="识别票据">
          <el-button size="small" @click="parseReceipt">OCR 识别并回填</el-button>
        </el-form-item>
        <el-form-item label="金额"><el-input v-model="form.amount" placeholder="0.00" /></el-form-item>
        <el-form-item label="申报部门">
          <el-select v-model="form.deptId" placeholder="选择部门" filterable style="width: 100%">
            <el-option v-for="item in deptOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="发生日期"><el-date-picker v-model="form.occurredAt" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
        <el-form-item label="费用类别">
          <el-select v-model="form.category" style="width: 100%">
            <el-option label="差旅" value="TRAVEL" />
            <el-option label="办公" value="OFFICE" />
            <el-option label="招待" value="ENTERTAIN" />
            <el-option label="交通" value="TRANSPORT" />
            <el-option label="其他" value="OTHER" />
          </el-select>
        </el-form-item>
        <el-form-item label="对方单位"><el-input v-model="form.counterparty" /></el-form-item>
        <el-form-item label="摘要"><el-input v-model="form.summary" /></el-form-item>
        <el-form-item label="是否有发票"><el-switch v-model="form.hasInvoice" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="submit">提交报销</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="allocateVisible" title="部门分摊" width="640px">
      <el-table :data="allocations" size="small" border>
        <el-table-column label="部门" min-width="220">
          <template #default="{ row }">
            <el-select v-model="row.deptId" placeholder="选择部门" filterable style="width: 100%">
              <el-option v-for="item in deptOptions" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="分摊比例" width="160">
          <template #default="{ row }">
            <el-input-number v-model="row.ratio" :min="0" :max="1" :step="0.1" :precision="4" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ $index }">
            <el-button link type="danger" @click="removeAllocation($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="alloc-actions">
        <el-button size="small" @click="addAllocation">新增分摊行</el-button>
        <span>比例合计：{{ ratioTotal.toFixed(4) }}</span>
      </div>
      <template #footer>
        <el-button @click="allocateVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAllocation">保存分摊</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="payVisible" title="报销付款" width="520px">
      <el-form label-width="110px">
        <el-form-item label="付款账户">
          <el-select v-model="payForm.accountId" placeholder="选择账户" style="width: 100%">
            <el-option v-for="item in accounts" :key="item.id" :label="`${item.accountName}（${item.balance}）`" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="收款方ID"><el-input-number v-model="payForm.supplierId" :min="0" style="width: 100%" /></el-form-item>
        <el-form-item label="付款金额"><el-input v-model="payForm.amount" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="payVisible = false">取消</el-button>
        <el-button type="primary" @click="submitPay">确认付款</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.total { margin-left: auto; font-size: 13px; color: #86909c; }
.alloc-actions { display: flex; align-items: center; gap: 12px; margin-top: 10px; font-size: 13px; color: #86909c; }
</style>
