<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createLaborContract, fetchExpiringContracts, fetchLaborContracts, refreshLaborContractStatus,
  renewLaborContract, terminateLaborContract, type ContractExpirySummary, type ContractReminderRow,
  type LaborContractRow
} from '@/api/hr-labor-contract'

const activeTab = ref('list')
const contracts = ref<LaborContractRow[]>([])
const reminders = ref<ContractReminderRow[]>([])
const summary = ref<ContractExpirySummary>({ expiringCount: 0, expiredCount: 0, urgentCount: 0, employeeCount: 0 })
const total = ref(0)
const loading = ref(false)
const query = reactive({ page: 1, pageSize: 20, status: '', contractType: '', employeeId: undefined as number | undefined })
const createVisible = ref(false)
const renewVisible = ref(false)
const renewTarget = ref<LaborContractRow | null>(null)

const form = reactive({
  employeeId: 0, contractNo: '', contractType: 'FIXED', partyA: '', signDate: '',
  effectiveDate: '', duration: 3, expiryDate: '', remindDays: 30, salary: '0', remark: ''
})
const renewForm = reactive({ effectiveDate: '', duration: 3, expiryDate: '', contractNo: '', salary: undefined as number | undefined, remark: '' })

const TYPE_LABEL: Record<string, string> = {
  FIXED: '固定期限', OPEN_ENDED: '无固定期限', OUTSOURCE: '外包合同', INTERN: '实习协议', SERVICE: '劳务协议'
}
const STATUS_LABEL: Record<string, string> = {
  DRAFT: '待生效', EFFECTIVE: '生效中', EXPIRED: '已到期', RENEWED: '已续签', TERMINATED: '已解除'
}
const LEVEL_TYPE: Record<string, 'danger' | 'warning' | 'info'> = { URGENT: 'danger', WARNING: 'warning', NORMAL: 'info' }

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchLaborContracts({ ...query })
    contracts.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载合同失败')
  } finally {
    loading.value = false
  }
}

async function loadReminders(): Promise<void> {
  try {
    const result = await fetchExpiringContracts({ employeeId: query.employeeId, contractType: query.contractType })
    reminders.value = result.list
    summary.value = result.summary
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载到期提醒失败')
  }
}

function openCreate(): void {
  Object.assign(form, {
    employeeId: 0, contractNo: `HT${new Date().getFullYear()}${String(Date.now()).slice(-6)}`, contractType: 'FIXED',
    partyA: '', signDate: '', effectiveDate: '', duration: 3, expiryDate: '', remindDays: 30, salary: '0', remark: ''
  })
  createVisible.value = true
}

async function save(): Promise<void> {
  try {
    const payload: Record<string, unknown> = { ...form }
    if (!payload.expiryDate) delete payload.expiryDate
    if (!payload.signDate) delete payload.signDate
    if (!payload.partyA) delete payload.partyA
    if (form.contractType === 'OPEN_ENDED') delete payload.duration
    payload.salary = form.salary || '0'
    await createLaborContract(payload)
    createVisible.value = false
    ElMessage.success('劳动合同已登记')
    await load()
    await loadReminders()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '登记失败')
  }
}

function openRenew(row: LaborContractRow): void {
  renewTarget.value = row
  Object.assign(renewForm, {
    effectiveDate: row.expiryDate ?? '', duration: row.contractType === 'FIXED' ? 3 : 12,
    expiryDate: '', contractNo: '', salary: undefined, remark: ''
  })
  renewVisible.value = true
}

function renewByReminder(row: ContractReminderRow): void {
  const contract = contracts.value.find((item) => item.id === row.contractId)
  openRenew(contract ?? ({
    id: row.contractId, contractType: 'FIXED', expiryDate: row.expiryDate
  } as LaborContractRow))
}

async function saveRenew(): Promise<void> {
  if (!renewTarget.value) return
  try {
    const payload: Record<string, unknown> = { effectiveDate: renewForm.effectiveDate, duration: renewForm.duration }
    if (renewForm.expiryDate) payload.expiryDate = renewForm.expiryDate
    if (renewForm.contractNo) payload.contractNo = renewForm.contractNo
    if (renewForm.salary !== undefined) payload.salary = renewForm.salary
    if (renewForm.remark) payload.remark = renewForm.remark
    await renewLaborContract(renewTarget.value.id, payload)
    renewVisible.value = false
    ElMessage.success('合同已续签')
    await load()
    await loadReminders()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '续签失败')
  }
}

async function terminate(row: LaborContractRow): Promise<void> {
  try {
    const { value } = await ElMessageBox.prompt('请输入解除日期（YYYY-MM-DD）', '解除合同', {
      inputPattern: /^\d{4}-\d{2}-\d{2}$/,
      inputErrorMessage: '日期格式不正确'
    })
    const { value: reason } = await ElMessageBox.prompt('请输入解除原因', '解除合同', { inputValidator: (v) => (v ? true : '原因必填') })
    await terminateLaborContract(row.id, { terminateDate: value, reason })
    ElMessage.success('合同已解除')
    await load()
    await loadReminders()
  } catch (cause) {
    if (cause === 'cancel' || cause === 'close') return
    ElMessage.error(cause instanceof Error ? cause.message : '解除失败')
  }
}

async function refreshStatus(): Promise<void> {
  try {
    const result = await refreshLaborContractStatus()
    ElMessage.success(`已刷新 ${result.updated} 条合同状态`)
    await load()
    await loadReminders()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '刷新失败')
  }
}

function resetQuery(): void {
  query.status = ''
  query.contractType = ''
  query.employeeId = undefined
  query.page = 1
  void load()
}

onMounted(() => {
  void load()
  void loadReminders()
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>劳动合同与到期提醒</h2>
      <p>登记劳动合同、跟踪到期风险并完成续签/解除留痕。</p>
    </header>

    <el-tabs v-model="activeTab" type="card">
      <el-tab-pane label="合同列表" name="list">
        <article class="panel">
          <div class="toolbar">
            <el-select v-model="query.status" placeholder="状态" clearable style="width: 140px" @change="load">
              <el-option v-for="(label, key) in STATUS_LABEL" :key="key" :label="label" :value="key" />
            </el-select>
            <el-select v-model="query.contractType" placeholder="合同类型" clearable style="width: 160px" @change="load">
              <el-option v-for="(label, key) in TYPE_LABEL" :key="key" :label="label" :value="key" />
            </el-select>
            <el-input-number v-model="query.employeeId" :min="1" placeholder="员工 ID" style="width: 150px" />
            <el-button type="primary" @click="query.page = 1; load()">查询</el-button>
            <el-button @click="resetQuery">重置</el-button>
            <el-button v-perm="'hr:contract:create'" type="success" @click="openCreate">登记合同</el-button>
            <el-button @click="refreshStatus">刷新到期状态</el-button>
          </div>

          <el-table v-loading="loading" :data="contracts" size="small">
            <el-table-column prop="contractNo" label="合同编号" min-width="140" />
            <el-table-column prop="employeeId" label="员工 ID" width="90" />
            <el-table-column label="类型" width="110">
              <template #default="{ row }">{{ TYPE_LABEL[row.contractType] ?? row.contractType }}</template>
            </el-table-column>
            <el-table-column prop="effectiveDate" label="生效日" width="110" />
            <el-table-column prop="expiryDate" label="到期日" width="110" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'EFFECTIVE' ? 'success' : row.status === 'EXPIRED' ? 'danger' : 'info'">
                  {{ STATUS_LABEL[row.status] ?? row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="salary" label="月薪" width="100" />
            <el-table-column label="操作" width="170">
              <template #default="{ row }">
                <el-button link type="primary" v-perm="'hr:contract:renew'" @click="openRenew(row)">续签</el-button>
                <el-button link type="danger" v-perm="'hr:contract:terminate'" @click="terminate(row)">解除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="pagination">
            <el-pagination background layout="total, prev, pager, next" :total="total" v-model:current-page="query.page"
              :page-size="query.pageSize" @current-change="load" />
          </div>
        </article>
      </el-tab-pane>

      <el-tab-pane label="到期提醒" name="expiring">
        <article class="panel">
          <div class="summary-row">
            <el-tag type="warning">即将到期 {{ summary.expiringCount }}</el-tag>
            <el-tag type="danger">已到期 {{ summary.expiredCount }}</el-tag>
            <el-tag type="danger">紧急 ≤7 天 {{ summary.urgentCount }}</el-tag>
            <el-tag type="info">涉及员工 {{ summary.employeeCount }}</el-tag>
          </div>
          <el-table :data="reminders" size="small">
            <el-table-column prop="level" label="级别" width="90">
              <template #default="{ row }">
                <el-tag :type="LEVEL_TYPE[row.level] ?? 'info'">{{ row.level }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="contractNo" label="合同编号" min-width="140" />
            <el-table-column prop="employeeName" label="员工" width="120" />
            <el-table-column prop="expiryDate" label="到期日" width="110" />
            <el-table-column prop="daysLeft" label="剩余天数" width="100" />
            <el-table-column prop="message" label="提醒" min-width="280" />
            <el-table-column label="操作" width="90">
              <template #default="{ row }">
                <el-button link type="primary" v-perm="'hr:contract:renew'" @click="renewByReminder(row)">续签</el-button>
              </template>
            </el-table-column>
          </el-table>
        </article>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="createVisible" title="登记劳动合同" width="620px">
      <el-form label-width="100px">
        <el-form-item label="员工 ID"><el-input-number v-model="form.employeeId" :min="1" /></el-form-item>
        <el-form-item label="合同编号"><el-input v-model="form.contractNo" /></el-form-item>
        <el-form-item label="合同类型">
          <el-select v-model="form.contractType" style="width: 180px">
            <el-option v-for="(label, key) in TYPE_LABEL" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item label="甲方主体"><el-input v-model="form.partyA" /></el-form-item>
        <el-form-item label="签订日期"><el-date-picker v-model="form.signDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
        <el-form-item label="生效日期"><el-date-picker v-model="form.effectiveDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
        <el-form-item label="期限">
          <el-input-number v-model="form.duration" :min="1" :max="120" />
          <span class="hint">{{ form.contractType === 'FIXED' ? '年' : '月' }}</span>
        </el-form-item>
        <el-form-item label="到期日期"><el-input v-model="form.expiryDate" placeholder="留空按期限自动推导" /></el-form-item>
        <el-form-item label="提醒提前(天)"><el-input-number v-model="form.remindDays" :min="1" :max="365" /></el-form-item>
        <el-form-item label="月薪"><el-input v-model="form.salary" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="renewVisible" title="续签劳动合同" width="520px">
      <el-form label-width="100px">
        <el-form-item label="新合同编号"><el-input v-model="renewForm.contractNo" placeholder="留空自动生成" /></el-form-item>
        <el-form-item label="新生效日"><el-date-picker v-model="renewForm.effectiveDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
        <el-form-item label="新期限"><el-input-number v-model="renewForm.duration" :min="1" :max="120" /></el-form-item>
        <el-form-item label="新到期日"><el-input v-model="renewForm.expiryDate" placeholder="留空按期限推导" /></el-form-item>
        <el-form-item label="新月薪"><el-input-number v-model="renewForm.salary" :min="0" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="renewForm.remark" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="renewVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRenew">确认续签</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 12px; }
.summary-row { display: flex; gap: 8px; margin-bottom: 12px; }
.hint { margin-left: 8px; color: #909399; }
</style>
