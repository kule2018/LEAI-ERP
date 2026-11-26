<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  approveEmployeeRecord, assetAction, createEmployeeRecord, createOffer,
  createPayrollDetail, createPerformanceReview, createTrainingRecord,
  fetchEmployeeRecords
} from '@/api/hr-extension'
import type { PageQuery } from '@/types/contract'

const activeTab = ref('records')
const records = ref<Array<Record<string, unknown>>>([])
const total = ref(0)
const query = reactive<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const warning = ref('')

const recordForm = reactive({ employeeId: 0, recordType: 'CONTRACT', recordTitle: '', detail: '', effectiveDate: '', expiryDate: '' })
const offerForm = reactive({ candidateId: 0, positionName: '', salary: '0', budget: 0 })
const payrollForm = reactive({ salaryId: 0, gross: '0', taxable: '' })
const performanceForm = reactive({ performanceId: 0, kpiScore: 80, peerScore: 80, calibration: 0 })
const trainingForm = reactive({ trainingId: 0, employeeId: 0, examScore: 0 })
const assetForm = reactive({ assetId: 0, action: 'ISSUE', holderId: 0, note: '' })

async function load(): Promise<void> {
  try {
    const result = await fetchEmployeeRecords(query)
    records.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载档案记录失败')
  }
}

async function saveRecord(): Promise<void> {
  try {
    const result = await createEmployeeRecord({ ...recordForm })
    warning.value = result.expiryWarning?.expiring ? `合同将在 ${result.expiryWarning.days} 天内到期` : ''
    ElMessage.success('档案记录已保存')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function approve(id: number): Promise<void> {
  try {
    await approveEmployeeRecord(id, { status: 'APPROVED' })
    ElMessage.success('已审批')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '审批失败')
  }
}

async function submit(path: 'offer' | 'payroll' | 'performance' | 'training' | 'asset'): Promise<void> {
  try {
    if (path === 'offer') await createOffer({ ...offerForm })
    if (path === 'payroll') await createPayrollDetail({ ...payrollForm, taxable: payrollForm.taxable || undefined })
    if (path === 'performance') await createPerformanceReview({ ...performanceForm })
    if (path === 'training') await createTrainingRecord({ ...trainingForm })
    if (path === 'asset') await assetAction({ ...assetForm, holderId: assetForm.holderId || undefined })
    ElMessage.success('已保存')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>人事扩展</h2>
      <p>员工档案变更、Offer 审批、薪酬测算、绩效校准、培训发证与行政资产台账统一入口。</p>
    </header>

    <el-tabs v-model="activeTab" type="card">
      <el-tab-pane label="员工档案" name="records">
        <article class="panel">
          <el-form inline>
            <el-form-item label="员工 ID"><el-input-number v-model="recordForm.employeeId" :min="1" /></el-form-item>
            <el-form-item label="类型">
              <el-select v-model="recordForm.recordType" style="width: 140px">
                <el-option label="合同" value="CONTRACT" />
                <el-option label="异动" value="CHANGE" />
                <el-option label="证照" value="CERTIFICATE" />
                <el-option label="组织历史" value="ORG_HISTORY" />
              </el-select>
            </el-form-item>
            <el-form-item label="标题"><el-input v-model="recordForm.recordTitle" /></el-form-item>
            <el-form-item label="到期日"><el-date-picker v-model="recordForm.expiryDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
            <el-button type="primary" v-perm="'hr:extension:update'" @click="saveRecord">保存</el-button>
          </el-form>
          <div v-if="warning" class="warning">{{ warning }}</div>
          <el-table :data="records" size="small">
            <el-table-column prop="employeeId" label="员工 ID" width="100" />
            <el-table-column prop="recordType" label="类型" width="120" />
            <el-table-column prop="recordTitle" label="标题" min-width="160" />
            <el-table-column prop="approvalStatus" label="审批状态" width="110" />
            <el-table-column label="操作" width="90">
              <template #default="{ row }">
                <el-button link type="primary" v-perm="'hr:extension:update'" @click="approve(Number(row.id))">审批</el-button>
              </template>
            </el-table-column>
          </el-table>
          <div class="pagination">
            <el-pagination background layout="total, prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
          </div>
        </article>
      </el-tab-pane>

      <el-tab-pane label="Offer" name="offer">
        <article class="panel form-panel">
          <el-form label-width="100px">
            <el-form-item label="候选人 ID"><el-input-number v-model="offerForm.candidateId" :min="1" /></el-form-item>
            <el-form-item label="岗位"><el-input v-model="offerForm.positionName" /></el-form-item>
            <el-form-item label="薪资"><el-input v-model="offerForm.salary" /></el-form-item>
            <el-form-item label="预算"><el-input-number v-model="offerForm.budget" :min="0" /></el-form-item>
          </el-form>
          <el-button type="primary" v-perm="'hr:extension:update'" @click="submit('offer')">生成 Offer</el-button>
        </article>
      </el-tab-pane>

      <el-tab-pane label="薪酬" name="payroll">
        <article class="panel form-panel">
          <el-form label-width="100px">
            <el-form-item label="薪资单 ID"><el-input-number v-model="payrollForm.salaryId" :min="1" /></el-form-item>
            <el-form-item label="应发"><el-input v-model="payrollForm.gross" /></el-form-item>
            <el-form-item label="计税基数"><el-input v-model="payrollForm.taxable" placeholder="留空自动计算" /></el-form-item>
          </el-form>
          <el-button type="primary" v-perm="'hr:extension:update'" @click="submit('payroll')">测算并生成工资条</el-button>
        </article>
      </el-tab-pane>

      <el-tab-pane label="绩效" name="performance">
        <article class="panel form-panel">
          <el-form label-width="100px">
            <el-form-item label="绩效 ID"><el-input-number v-model="performanceForm.performanceId" :min="1" /></el-form-item>
            <el-form-item label="KPI"><el-input-number v-model="performanceForm.kpiScore" :min="0" :max="100" /></el-form-item>
            <el-form-item label="360 评分"><el-input-number v-model="performanceForm.peerScore" :min="0" :max="100" /></el-form-item>
            <el-form-item label="校准分"><el-input-number v-model="performanceForm.calibration" :min="-20" :max="20" /></el-form-item>
          </el-form>
          <el-button type="primary" v-perm="'hr:extension:update'" @click="submit('performance')">校准</el-button>
        </article>
      </el-tab-pane>

      <el-tab-pane label="培训" name="training">
        <article class="panel form-panel">
          <el-form label-width="100px">
            <el-form-item label="培训 ID"><el-input-number v-model="trainingForm.trainingId" :min="1" /></el-form-item>
            <el-form-item label="员工 ID"><el-input-number v-model="trainingForm.employeeId" :min="1" /></el-form-item>
            <el-form-item label="考试分数"><el-input-number v-model="trainingForm.examScore" :min="0" :max="100" /></el-form-item>
          </el-form>
          <el-button type="primary" v-perm="'hr:extension:update'" @click="submit('training')">登记考试</el-button>
        </article>
      </el-tab-pane>

      <el-tab-pane label="资产" name="asset">
        <article class="panel form-panel">
          <el-form label-width="100px">
            <el-form-item label="资产 ID"><el-input-number v-model="assetForm.assetId" :min="1" /></el-form-item>
            <el-form-item label="动作">
              <el-select v-model="assetForm.action">
                <el-option label="领用" value="ISSUE" />
                <el-option label="归还" value="RETURN" />
                <el-option label="盘点" value="INVENTORY" />
                <el-option label="维修" value="REPAIR" />
              </el-select>
            </el-form-item>
            <el-form-item label="持有人"><el-input-number v-model="assetForm.holderId" :min="0" /></el-form-item>
          </el-form>
          <el-button type="primary" v-perm="'hr:extension:update'" @click="submit('asset')">执行</el-button>
        </article>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.form-panel { max-width: 520px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 12px; }
.warning { margin: 12px 0; padding: 10px; color: #ad6800; background: #fffbe6; border-radius: 6px; }
</style>
