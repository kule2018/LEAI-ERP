<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createSalary, fetchSalaries,
  type CollabQuery, type Salary
} from '@/api/collaboration'
import {
  fetchPayrollDetails, fetchPayslips, fetchSocialInsurances, generateSocialInsurance,
  reviewPayrollDetail, type PayrollDetailRow, type PayslipRow, type SocialInsuranceRow
} from '@/api/hr-approval'

const rows = ref<Salary[]>([])
const payslips = ref<PayslipRow[]>([])
const insurances = ref<SocialInsuranceRow[]>([])
const details = ref<PayrollDetailRow[]>([])
const loading = ref(false)
const query = ref<CollabQuery>({ page: 1, pageSize: 20 })
const form = reactive({ employeeId: 0, period: '', grossAmount: '0', netAmount: '0' })
const socialForm = reactive({ salaryId: 0, baseAmount: '' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const [salary, slip, social, detail] = await Promise.all([
      fetchSalaries(query.value), fetchPayslips(query.value), fetchSocialInsurances(), fetchPayrollDetails(query.value)
    ])
    if (current !== seq) return
    rows.value = salary.list
    payslips.value = slip.list
    insurances.value = social
    details.value = detail.list
  } finally { if (current === seq) loading.value = false }
}
async function save(): Promise<void> {
  try {
    await createSalary({ ...form, netAmount: form.netAmount === '0' ? form.grossAmount : form.netAmount })
    ElMessage.success('薪资记录已保存')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
async function approve(row: PayrollDetailRow): Promise<void> {
  try {
    await reviewPayrollDetail(row.id, 'APPROVE')
    ElMessage.success('发放审批通过')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '审批失败') }
}
async function generateSocial(): Promise<void> {
  try {
    await generateSocialInsurance({ salaryId: socialForm.salaryId, baseAmount: socialForm.baseAmount || undefined })
    ElMessage.success('社保公积金明细已生成')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '生成失败') }
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>薪酬</h2><p>按期间维护员工工资、个税和发放状态。</p></header>
    <el-tabs>
      <el-tab-pane label="薪资单">
        <el-form inline>
          <el-form-item label="员工ID"><el-input-number v-model="form.employeeId" :min="1" /></el-form-item>
          <el-form-item label="期间"><el-date-picker v-model="form.period" type="month" value-format="YYYY-MM" placeholder="YYYY-MM"  /></el-form-item>
          <el-form-item label="应发"><el-input v-model="form.grossAmount" /></el-form-item>
          <el-form-item label="实发"><el-input v-model="form.netAmount" /></el-form-item>
          <el-button type="primary" v-perm="'hr:payroll:create'" @click="save">保存</el-button>
        </el-form>
        <el-table v-loading="loading" :data="rows" row-key="id" size="small">
          <el-table-column prop="employeeId" label="员工ID" width="110" />
          <el-table-column prop="period" label="期间" width="120" />
          <el-table-column prop="grossAmount" label="应发" width="150" />
          <el-table-column prop="netAmount" label="实发" width="150" />
          <el-table-column prop="status" label="状态" width="110" />
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="工资条">
        <el-table :data="payslips" row-key="id" size="small">
          <el-table-column prop="employeeId" label="员工ID" width="110" />
          <el-table-column prop="period" label="期间" width="110" />
          <el-table-column prop="payslipNo" label="工资条号" width="180" />
          <el-table-column prop="grossAmount" label="应发" width="140" />
          <el-table-column prop="social" label="社保" width="140" />
          <el-table-column prop="tax" label="个税" width="140" />
          <el-table-column prop="netAmount" label="实发" width="140" />
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="社保公积金">
        <el-form inline>
          <el-form-item label="薪资单ID"><el-input-number v-model="socialForm.salaryId" :min="1" /></el-form-item>
          <el-form-item label="缴费基数"><el-input v-model="socialForm.baseAmount" placeholder="默认取应发金额" /></el-form-item>
          <el-button type="primary" v-perm="'hr:payroll:create'" @click="generateSocial">生成明细</el-button>
        </el-form>
        <el-table :data="insurances" row-key="id" size="small">
          <el-table-column prop="period" label="期间" width="100" />
          <el-table-column prop="itemName" label="险种" width="140" />
          <el-table-column prop="baseAmount" label="缴费基数" width="140" />
          <el-table-column prop="companyRate" label="单位费率" width="110" />
          <el-table-column prop="companyAmount" label="单位金额" width="140" />
          <el-table-column prop="personalRate" label="个人费率" width="110" />
          <el-table-column prop="personalAmount" label="个人金额" width="140" />
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="个税明细">
        <el-table :data="details" row-key="id" size="small">
          <el-table-column prop="salaryId" label="薪资单ID" width="120" />
          <el-table-column prop="baseAmount" label="计税基数" width="150" />
          <el-table-column prop="social" label="社保" width="150" />
          <el-table-column prop="tax" label="个税" width="150" />
          <el-table-column prop="payslipNo" label="工资条号" min-width="180" />
          <el-table-column label="发放审批" width="120" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" v-perm="'hr:payroll:approve'" @click="approve(row)">通过</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
</style>
