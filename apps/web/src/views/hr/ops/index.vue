<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  approvePunchRequest,
  approveSalary,
  createPunchRequest,
  createVehicleExpense,
  fetchExpiringCertificates,
  fetchPunchRequests,
  fetchVehicleExpenses,
  resolvePerformanceAppeal,
  type VehicleExpense
} from '@/api/ops-enhancement'

interface PunchRequest {
  id: number
  employeeId: number
  punchDate: string
  status: string
  reason: string
}

const punches = ref<PunchRequest[]>([])
const punchTotal = ref(0)
const certificates = ref<Array<{ id: number; employeeId: number; expireDate: string; daysToExpire: number | null; expired: boolean }>>([])
const expenses = ref<VehicleExpense[]>([])
const loading = ref(false)
const punchQuery = reactive({ page: 1, pageSize: 20, status: '' })
const punchForm = reactive({ employeeId: 0, punchDate: '', punchType: 'MISSING', reason: '' })
const expenseForm = reactive({ vehicleId: 0, expenseType: 'FUEL', amount: '0', expenseDate: '', remark: '' })
const appealForm = reactive({ id: 0, result: 'ACCEPT' as 'ACCEPT' | 'REJECT', resolution: '' })

function fail(cause: unknown): void {
  ElMessage.error(cause instanceof Error ? cause.message : '操作失败')
}

async function loadPunches(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchPunchRequests({
      page: punchQuery.page,
      pageSize: punchQuery.pageSize,
      status: punchQuery.status || undefined
    })
    punches.value = result.list
    punchTotal.value = result.total
  } catch (cause) {
    fail(cause)
  } finally {
    loading.value = false
  }
}

async function loadCertificates(): Promise<void> {
  try {
    certificates.value = await fetchExpiringCertificates(30)
  } catch (cause) {
    fail(cause)
  }
}

async function loadExpenses(): Promise<void> {
  try {
    const result = await fetchVehicleExpenses({ page: 1, pageSize: 50 })
    expenses.value = result.list
  } catch (cause) {
    fail(cause)
  }
}

async function submitPunch(): Promise<void> {
  try {
    await createPunchRequest({ ...punchForm })
    ElMessage.success('补卡申请已提交，等待审批')
    await loadPunches()
  } catch (cause) {
    fail(cause)
  }
}

async function handlePunchApprove(row: PunchRequest, decision: 'APPROVE' | 'REJECT'): Promise<void> {
  try {
    await approvePunchRequest(row.id, decision)
    ElMessage.success(decision === 'APPROVE' ? '已通过并生成考勤记录' : '已驳回')
    await loadPunches()
  } catch (cause) {
    fail(cause)
  }
}

async function handleSalary(id: number, decision: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'PAY'): Promise<void> {
  try {
    await approveSalary(id, decision)
    ElMessage.success('薪酬单状态已更新')
  } catch (cause) {
    fail(cause)
  }
}

async function handleAppeal(): Promise<void> {
  try {
    await resolvePerformanceAppeal(appealForm.id, appealForm.result, appealForm.resolution)
    ElMessage.success('绩效申诉已处理')
  } catch (cause) {
    fail(cause)
  }
}

async function submitExpense(): Promise<void> {
  try {
    await createVehicleExpense({ ...expenseForm })
    ElMessage.success('车队费用已登记')
    await loadExpenses()
  } catch (cause) {
    fail(cause)
  }
}

onMounted(() => {
  void loadPunches()
  void loadCertificates()
  void loadExpenses()
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>人事运营增强</h2>
      <p>补卡审批、薪酬发放审批与脱敏、绩效申诉闭环、证书到期提醒与车队费用台账。</p>
    </header>

    <el-tabs>
      <el-tab-pane label="补卡审批" name="punch">
        <el-form :inline="true">
          <el-form-item label="员工ID">
            <el-input-number v-model="punchForm.employeeId" :min="1" />
          </el-form-item>
          <el-form-item label="补卡日期">
            <el-date-picker v-model="punchForm.punchDate" type="date" value-format="YYYY-MM-DD" />
          </el-form-item>
          <el-form-item label="类型">
            <el-select v-model="punchForm.punchType" style="width: 120px">
              <el-option label="漏打卡" value="MISSING" />
              <el-option label="迟到" value="LATE" />
              <el-option label="早退" value="EARLY" />
            </el-select>
          </el-form-item>
          <el-form-item label="原因">
            <el-input v-model="punchForm.reason" style="width: 220px" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="submitPunch">提交申请</el-button>
          </el-form-item>
        </el-form>

        <el-table v-loading="loading" :data="punches" row-key="id">
          <el-table-column prop="employeeId" label="员工ID" width="100" />
          <el-table-column prop="punchDate" label="补卡日期" width="130" />
          <el-table-column prop="reason" label="原因" min-width="220" />
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column label="操作" width="160">
            <template #default="{ row }">
              <el-button link type="primary" v-perm="'hr:attendance:approve'" @click="handlePunchApprove(row, 'APPROVE')">通过</el-button>
              <el-button link v-perm="'hr:attendance:approve'" @click="handlePunchApprove(row, 'REJECT')">驳回</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination">
          <el-pagination
            background
            layout="prev, pager, next"
            :total="punchTotal"
            :current-page="punchQuery.page"
            :page-size="punchQuery.pageSize"
            @current-change="loadPunches"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="薪酬发放审批" name="salary">
        <el-form :inline="true">
          <el-form-item label="薪酬单ID">
            <el-input-number v-model="appealForm.id" :min="1" />
          </el-form-item>
          <el-form-item label="动作">
            <el-select v-model="appealForm.result" style="width: 130px">
              <el-option label="提交审批" value="ACCEPT" />
              <el-option label="驳回" value="REJECT" />
            </el-select>
          </el-form-item>
          <el-form-item label="说明">
            <el-input v-model="appealForm.resolution" style="width: 200px" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" v-perm="'hr:payroll:approve'" @click="handleSalary(appealForm.id, 'APPROVE')">审批通过</el-button>
            <el-button v-perm="'hr:payroll:approve'" @click="handleSalary(appealForm.id, 'PAY')">确认发放</el-button>
          </el-form-item>
        </el-form>
        <p class="tip">薪酬列表默认脱敏（仅显示档位），拥有 hr:payroll:detail 权限可查看金额。</p>
      </el-tab-pane>

      <el-tab-pane label="绩效申诉闭环" name="appeal">
        <el-form :inline="true">
          <el-form-item label="评议ID">
            <el-input-number v-model="appealForm.id" :min="1" />
          </el-form-item>
          <el-form-item label="处理结果">
            <el-select v-model="appealForm.result" style="width: 130px">
              <el-option label="申诉成立" value="ACCEPT" />
              <el-option label="申诉驳回" value="REJECT" />
            </el-select>
          </el-form-item>
          <el-form-item label="结论">
            <el-input v-model="appealForm.resolution" style="width: 240px" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" v-perm="'hr:performance:approve'" @click="handleAppeal">处理申诉</el-button>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <el-tab-pane label="证书到期提醒" name="certificate">
        <el-table :data="certificates" size="small">
          <el-table-column prop="employeeId" label="员工ID" width="110" />
          <el-table-column prop="expireDate" label="到期日" width="140" />
          <el-table-column prop="daysToExpire" label="剩余天数" width="110" />
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <el-tag :type="row.expired ? 'danger' : 'warning'">{{ row.expired ? '已过期' : '即将到期' }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="车队费用" name="fleet">
        <el-form :inline="true">
          <el-form-item label="车辆ID">
            <el-input-number v-model="expenseForm.vehicleId" :min="1" />
          </el-form-item>
          <el-form-item label="类型">
            <el-select v-model="expenseForm.expenseType" style="width: 120px">
              <el-option label="加油" value="FUEL" />
              <el-option label="过路费" value="TOLL" />
              <el-option label="停车" value="PARK" />
              <el-option label="维修" value="REPAIR" />
            </el-select>
          </el-form-item>
          <el-form-item label="金额">
            <el-input v-model="expenseForm.amount" style="width: 120px" />
          </el-form-item>
          <el-form-item label="日期">
            <el-date-picker v-model="expenseForm.expenseDate" type="date" value-format="YYYY-MM-DD" />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="expenseForm.remark" style="width: 180px" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" v-perm="'hr:fleet:create'" @click="submitExpense">登记费用</el-button>
          </el-form-item>
        </el-form>
        <el-table :data="expenses" size="small">
          <el-table-column prop="vehicleId" label="车辆ID" width="100" />
          <el-table-column prop="expenseType" label="类型" width="120" />
          <el-table-column prop="amount" label="金额" width="120" />
          <el-table-column prop="expenseDate" label="日期" width="140" />
          <el-table-column prop="remark" label="备注" min-width="200" />
          <el-table-column prop="status" label="状态" width="100" />
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<style scoped>
.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.tip {
  color: #909399;
  font-size: 13px;
}
</style>
