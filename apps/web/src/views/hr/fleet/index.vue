<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createVehicle, createVehicleUse, fetchVehicleUses, fetchVehicles,
  type CollabQuery, type Vehicle, type VehicleUse
} from '@/api/collaboration'
import {
  approveVehicleExpense, approveVehicleUse, createVehicleExpense, fetchVehicleExpenses, fetchVehicleFuelStats,
  fetchVehicleTracks, updateVehicleUse, type VehicleExpenseRow, type VehicleFuelStat, type VehicleTrackRow
} from '@/api/hr-approval'
import { dispatchVehicle } from '@/api/project-ops'

const vehicles = ref<Vehicle[]>([])
const uses = ref<VehicleUse[]>([])
const expenses = ref<VehicleExpenseRow[]>([])
const tracks = ref<VehicleTrackRow[]>([])
const fuelStats = ref<VehicleFuelStat[]>([])
const query = ref<CollabQuery>({ page: 1, pageSize: 100 })
const vehicleForm = reactive({ plateNo: '', vehicleName: '', driverId: 0 })
const useForm = reactive({ vehicleId: 0, applyUserId: 0, startTime: '', endTime: '' })
const expenseForm = reactive({ vehicleId: 0, vehicleUseId: 0, expenseType: 'FUEL', amount: '0', expenseDate: '', fuelLitres: '0' })
const dispatchForm = reactive({ applyUserId: 0, startTime: '', endTime: '', reason: '', forceConflict: 'NO' })
const mileageForm = reactive({ useId: 0, mileage: '0', reason: '' })
const dispatchResult = ref<{ vehicleId: number | null; conflicted: Array<{ vehicleId: number }> } | null>(null)
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  try {
    const [v, u, e, t, f] = await Promise.all([
      fetchVehicles(query.value), fetchVehicleUses(query.value), fetchVehicleExpenses(query.value),
      fetchVehicleTracks(query.value), fetchVehicleFuelStats()
    ])
    if (current !== seq) return
    vehicles.value = v.list
    uses.value = u.list
    expenses.value = e.list
    tracks.value = t.list
    fuelStats.value = f
  } finally { /* noop */ }
}
async function run(fn: () => Promise<unknown>, message: string): Promise<void> {
  try { await fn(); ElMessage.success(message); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '操作失败') }
}
async function saveVehicle(): Promise<void> {
  try {
    await createVehicle({ ...vehicleForm, driverId: vehicleForm.driverId || undefined })
    ElMessage.success('车辆已保存')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
async function saveUse(): Promise<void> {
  try {
    await createVehicleUse({ ...useForm })
    ElMessage.success('用车申请已保存')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
async function runDispatch(): Promise<void> {
  try {
    const result = await dispatchVehicle({
      applyUserId: dispatchForm.applyUserId,
      startTime: dispatchForm.startTime,
      endTime: dispatchForm.endTime,
      reason: dispatchForm.reason || undefined,
      forceConflict: dispatchForm.forceConflict
    })
    dispatchResult.value = { vehicleId: result.vehicleId, conflicted: result.conflicted }
    ElMessage.success(`已派出车辆 #${result.vehicleId}`)
    await load()
  } catch (cause) {
    dispatchResult.value = null
    ElMessage.error(cause instanceof Error ? cause.message : '调度失败')
  }
}
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>车队</h2><p>车辆台账和用车申请。</p></header>
    <div class="fleet-layout">
      <article class="panel">
        <h3>车辆</h3>
        <el-form inline>
          <el-form-item label="车牌"><el-input v-model="vehicleForm.plateNo" /></el-form-item>
          <el-form-item label="名称"><el-input v-model="vehicleForm.vehicleName" /></el-form-item>
          <el-form-item label="司机ID"><el-input-number v-model="vehicleForm.driverId" :min="0" /></el-form-item>
          <el-button type="primary" v-perm="'hr:fleet:create'" @click="saveVehicle">保存</el-button>
        </el-form>
        <el-table :data="vehicles" size="small" row-key="id">
          <el-table-column prop="plateNo" label="车牌" width="140" />
          <el-table-column prop="vehicleName" label="车辆" min-width="160" />
          <el-table-column prop="status" label="状态" width="110" />
        </el-table>
      </article>
      <article class="panel">
        <h3>用车申请</h3>
        <el-form inline>
          <el-form-item label="车辆ID"><el-input-number v-model="useForm.vehicleId" :min="1" /></el-form-item>
          <el-form-item label="申请人ID"><el-input-number v-model="useForm.applyUserId" :min="1" /></el-form-item>
          <el-form-item label="开始"><el-date-picker v-model="useForm.startTime" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="YYYY-MM-DDTHH:mm:ss"  /></el-form-item>
          <el-form-item label="结束"><el-date-picker v-model="useForm.endTime" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="YYYY-MM-DDTHH:mm:ss"  /></el-form-item>
          <el-form-item label="里程"><el-input v-model="mileageForm.mileage" /></el-form-item>
          <el-form-item label="事由"><el-input v-model="mileageForm.reason" /></el-form-item>
          <el-button type="primary" v-perm="'hr:fleet:create'" @click="saveUse">申请</el-button>
        </el-form>
        <el-table :data="uses" size="small" row-key="id">
          <el-table-column prop="vehicleId" label="车辆ID" width="110" />
          <el-table-column prop="applyUserId" label="申请人" width="110" />
          <el-table-column prop="startTime" label="开始" width="180" />
          <el-table-column prop="endTime" label="结束" width="180" />
          <el-table-column prop="status" label="状态" width="110" />
          <el-table-column label="审批" width="230" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" v-perm="'hr:fleet:dispatch'" @click="run(() => approveVehicleUse(row.id, 'APPROVE'), '已通过')">通过</el-button>
              <el-button link type="danger" v-perm="'hr:fleet:dispatch'" @click="run(() => approveVehicleUse(row.id, 'REJECT'), '已驳回')">驳回</el-button>
              <el-button link type="warning" v-perm="'hr:fleet:update'" @click="run(() => updateVehicleUse(row.id, { mileage: mileageForm.mileage, reason: mileageForm.reason || undefined }), '里程已回填')">回填里程</el-button>
            </template>
          </el-table-column>
        </el-table>
      </article>
      <article class="panel">
        <h3>智能调度</h3>
        <el-form inline>
          <el-form-item label="申请人ID"><el-input-number v-model="dispatchForm.applyUserId" :min="1" /></el-form-item>
          <el-form-item label="开始"><el-date-picker v-model="dispatchForm.startTime" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="YYYY-MM-DDTHH:mm:ss"  /></el-form-item>
          <el-form-item label="结束"><el-date-picker v-model="dispatchForm.endTime" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="YYYY-MM-DDTHH:mm:ss"  /></el-form-item>
          <el-form-item label="事由"><el-input v-model="dispatchForm.reason" style="width: 180px" /></el-form-item>
          <el-form-item label="冲突强制">
            <el-select v-model="dispatchForm.forceConflict" style="width: 130px">
              <el-option label="否" value="NO" />
              <el-option label="是（人工确认）" value="YES" />
            </el-select>
          </el-form-item>
          <el-button type="primary" v-perm="'hr:fleet:dispatch'" @click="runDispatch">调度</el-button>
        </el-form>
        <el-alert
          v-if="dispatchResult"
          :title="dispatchResult.vehicleId ? `已派出车辆 #${dispatchResult.vehicleId}` : '无可用车辆'"
          :type="dispatchResult.vehicleId ? 'success' : 'warning'"
          :description="dispatchResult.conflicted.length ? `冲突车辆：${dispatchResult.conflicted.map((item) => item.vehicleId).join('、')}` : '无时间冲突'"
          :closable="false"
        />
      </article>
      <article class="panel">
        <h3>用车费用</h3>
        <el-form inline>
          <el-form-item label="车辆ID"><el-input-number v-model="expenseForm.vehicleId" :min="1" /></el-form-item>
          <el-form-item label="类型"><el-input v-model="expenseForm.expenseType" /></el-form-item>
          <el-form-item label="金额"><el-input v-model="expenseForm.amount" /></el-form-item>
          <el-form-item label="升数"><el-input v-model="expenseForm.fuelLitres" /></el-form-item>
          <el-form-item label="日期"><el-date-picker v-model="expenseForm.expenseDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
          <el-button type="primary" v-perm="'hr:fleet:create'" @click="run(() => createVehicleExpense({ ...expenseForm }), '费用已登记')">登记费用</el-button>
        </el-form>
        <el-table :data="expenses" size="small" row-key="id">
          <el-table-column prop="vehicleId" label="车辆ID" width="110" />
          <el-table-column prop="expenseType" label="类型" width="110" />
          <el-table-column prop="amount" label="金额" width="120" />
          <el-table-column prop="fuelLitres" label="升数" width="100" />
          <el-table-column prop="expenseDate" label="日期" width="120" />
          <el-table-column prop="status" label="状态" width="110" />
          <el-table-column label="审批" width="150" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" v-perm="'hr:fleet:dispatch'" @click="run(() => approveVehicleExpense(row.id, 'APPROVE'), '费用已通过')">通过</el-button>
              <el-button link type="danger" v-perm="'hr:fleet:dispatch'" @click="run(() => approveVehicleExpense(row.id, 'REJECT'), '费用已驳回')">驳回</el-button>
            </template>
          </el-table-column>
        </el-table>
      </article>
      <article class="panel">
        <h3>行驶轨迹</h3>
        <el-table :data="tracks" size="small" row-key="id">
          <el-table-column prop="vehicleId" label="车辆ID" width="110" />
          <el-table-column prop="latitude" label="纬度" width="130" />
          <el-table-column prop="longitude" label="经度" width="130" />
          <el-table-column prop="speed" label="速度" width="100" />
          <el-table-column prop="recordedAt" label="记录时间" min-width="180" />
        </el-table>
      </article>
      <article class="panel">
        <h3>油耗分析</h3>
        <el-table :data="fuelStats" size="small" row-key="vehicleId">
          <el-table-column prop="plateNo" label="车牌" width="140" />
          <el-table-column prop="vehicleName" label="车辆" min-width="160" />
          <el-table-column prop="litres" label="加油量(升)" width="130" />
          <el-table-column prop="mileage" label="里程(公里)" width="130" />
          <el-table-column prop="per100km" label="百公里油耗" width="130" />
          <el-table-column label="告警" width="100">
            <template #default="{ row }">
              <el-tag :type="row.warning ? 'danger' : 'success'">{{ row.warning ? '超标' : '正常' }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </article>
    </div>
  </section>
</template>

<style scoped>
.fleet-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel h3 { margin: 0 0 16px; }
@media (max-width: 1100px) { .fleet-layout { grid-template-columns: 1fr; } }
</style>
