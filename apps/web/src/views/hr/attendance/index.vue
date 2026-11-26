<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createLeave, createOvertime, createPunch, createShift, fetchLeaves, fetchOvertimes,
  fetchPunches, fetchShifts, type CollabQuery, type Leave, type Overtime, type Punch, type Shift
} from '@/api/collaboration'
import {
  approveLeave, approveOvertime, createShiftSchedule, fetchShiftSchedules, type ShiftSchedule
} from '@/api/hr-approval'

const shifts = ref<Shift[]>([])
const punches = ref<Punch[]>([])
const leaves = ref<Leave[]>([])
const overtimes = ref<Overtime[]>([])
const schedules = ref<ShiftSchedule[]>([])
const query = ref<CollabQuery>({ page: 1, pageSize: 100 })
const shiftForm = reactive({ shiftCode: '', shiftName: '', startTime: '09:00', endTime: '18:00' })
const punchForm = reactive({ employeeId: 0 })
const leaveForm = reactive({ employeeId: 0, leaveType: 'ANNUAL', startTime: '', endTime: '' })
const overtimeForm = reactive({ employeeId: 0, hours: '1', reason: '' })
const scheduleForm = reactive({ employeeId: 0, workDate: '', shiftId: 0 })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  try {
    const [s, p, l, o, sc] = await Promise.all([
      fetchShifts(query.value), fetchPunches(query.value), fetchLeaves(query.value),
      fetchOvertimes(query.value), fetchShiftSchedules(query.value)
    ])
    if (current !== seq) return
    shifts.value = s.list
    punches.value = p.list
    leaves.value = l.list
    overtimes.value = o.list
    schedules.value = sc.list
  } finally { /* noop */ }
}
async function run(fn: () => Promise<unknown>, message: string): Promise<void> {
  try { await fn(); ElMessage.success(message); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
function decide(kind: 'leave' | 'overtime', id: number, decision: 'APPROVE' | 'REJECT'): void {
  const action = decision === 'APPROVE' ? '通过' : '驳回'
  void run(() => (kind === 'leave'
    ? approveLeave(id, decision)
    : approveOvertime(id, decision)), `${action}成功`)
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>考勤排班</h2><p>班次、员工排班、打卡、请假和加班审批。</p></header>
    <el-tabs>
      <el-tab-pane label="班次">
        <el-form inline>
          <el-form-item label="编码"><el-input v-model="shiftForm.shiftCode" /></el-form-item>
          <el-form-item label="名称"><el-input v-model="shiftForm.shiftName" /></el-form-item>
          <el-form-item label="开始"><el-input v-model="shiftForm.startTime" /></el-form-item>
          <el-form-item label="结束"><el-input v-model="shiftForm.endTime" /></el-form-item>
          <el-button type="primary" v-perm="'hr:attendance:create'" @click="run(() => createShift({ ...shiftForm }), '班次已创建')">新增</el-button>
        </el-form>
        <el-table :data="shifts" size="small" row-key="id">
          <el-table-column prop="shiftCode" label="编码" width="140" />
          <el-table-column prop="shiftName" label="名称" min-width="160" />
          <el-table-column prop="startTime" label="开始" width="100" />
          <el-table-column prop="endTime" label="结束" width="100" />
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="员工排班">
        <el-form inline>
          <el-form-item label="员工ID"><el-input-number v-model="scheduleForm.employeeId" :min="1" /></el-form-item>
          <el-form-item label="日期"><el-date-picker v-model="scheduleForm.workDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
          <el-form-item label="班次ID"><el-input-number v-model="scheduleForm.shiftId" :min="1" /></el-form-item>
          <el-button type="primary" v-perm="'hr:attendance:create'" @click="run(() => createShiftSchedule({ ...scheduleForm }), '排班已登记')">登记排班</el-button>
        </el-form>
        <el-table :data="schedules" size="small" row-key="id">
          <el-table-column prop="employeeId" label="员工ID" width="110" />
          <el-table-column prop="workDate" label="日期" width="130" />
          <el-table-column prop="shiftCode" label="班次" width="120" />
          <el-table-column prop="shiftName" label="名称" min-width="160" />
          <el-table-column prop="status" label="状态" width="110" />
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="打卡">
        <el-form inline>
          <el-form-item label="员工ID"><el-input-number v-model="punchForm.employeeId" :min="1" /></el-form-item>
          <el-button type="primary" v-perm="'hr:attendance:create'" @click="run(() => createPunch({ ...punchForm }), '打卡成功')">打卡</el-button>
        </el-form>
        <el-table :data="punches" size="small" row-key="id">
          <el-table-column prop="employeeId" label="员工ID" width="110" />
          <el-table-column prop="punchTime" label="打卡时间" width="200" />
          <el-table-column prop="source" label="来源" width="120" />
          <el-table-column prop="status" label="状态" width="110" />
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="请假">
        <el-form inline>
          <el-form-item label="员工ID"><el-input-number v-model="leaveForm.employeeId" :min="1" /></el-form-item>
          <el-form-item label="类型"><el-input v-model="leaveForm.leaveType" /></el-form-item>
          <el-form-item label="开始"><el-date-picker v-model="leaveForm.startTime" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="YYYY-MM-DDTHH:mm:ss"  /></el-form-item>
          <el-form-item label="结束"><el-date-picker v-model="leaveForm.endTime" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="YYYY-MM-DDTHH:mm:ss"  /></el-form-item>
          <el-button type="primary" v-perm="'hr:attendance:create'" @click="run(() => createLeave({ ...leaveForm }), '请假已登记')">登记</el-button>
        </el-form>
        <el-table :data="leaves" size="small" row-key="id">
          <el-table-column prop="employeeId" label="员工ID" width="110" />
          <el-table-column prop="leaveType" label="类型" width="120" />
          <el-table-column prop="startTime" label="开始" width="180" />
          <el-table-column prop="endTime" label="结束" width="180" />
          <el-table-column prop="days" label="天数" width="90" />
          <el-table-column prop="status" label="状态" width="110" />
          <el-table-column label="审批" width="170" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" v-perm="'hr:attendance:approve'" @click="decide('leave', row.id, 'APPROVE')">通过</el-button>
              <el-button link type="danger" v-perm="'hr:attendance:approve'" @click="decide('leave', row.id, 'REJECT')">驳回</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="加班">
        <el-form inline>
          <el-form-item label="员工ID"><el-input-number v-model="overtimeForm.employeeId" :min="1" /></el-form-item>
          <el-form-item label="小时"><el-input v-model="overtimeForm.hours" /></el-form-item>
          <el-form-item label="原因"><el-input v-model="overtimeForm.reason" /></el-form-item>
          <el-button type="primary" v-perm="'hr:attendance:create'" @click="run(() => createOvertime({ ...overtimeForm }), '加班已登记')">登记</el-button>
        </el-form>
        <el-table :data="overtimes" size="small" row-key="id">
          <el-table-column prop="employeeId" label="员工ID" width="110" />
          <el-table-column prop="hours" label="小时" width="100" />
          <el-table-column prop="reason" label="原因" min-width="180" />
          <el-table-column prop="status" label="状态" width="110" />
          <el-table-column label="审批" width="170" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" v-perm="'hr:attendance:approve'" @click="decide('overtime', row.id, 'APPROVE')">通过</el-button>
              <el-button link type="danger" v-perm="'hr:attendance:approve'" @click="decide('overtime', row.id, 'REJECT')">驳回</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>

<style scoped>
.table { margin-top: 12px; }
</style>
