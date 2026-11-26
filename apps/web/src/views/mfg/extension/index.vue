<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  approveBomChange, approveOverIssue, approveWorkOrderChange, createBomChange, createEquipmentFault,
  createMaintenance, createQcItem, createWorkOrderChange, diffBomVersions, executeMaintenance,
  fetchCapacityLoad, fetchOverIssueCheck, fetchProductionAnalysis, fetchScheduleConflicts, fetchWipBoard,
  listBomChanges, listEquipmentFaults, listMaintenances, listOverIssues, listQcItems, listWorkOrderChanges,
  lockPlanTask, recordStopLine, repairEquipmentFault, requestOverIssue, scanReport, simulateMrp, splitWorkOrder
} from '@/api/manufacturing-extension'

type Row = Record<string, unknown>

const tab = ref('bom')

const bomChanges = ref<Row[]>([])
const bomDiff = ref<Row>({})
const bomForm = reactive({ baseId: 1, targetId: 1, bomId: 1, toVersion: 'V2', changeType: 'UPDATE', changeReason: '' })

const workOrderChanges = ref<Row[]>([])
const changeForm = reactive({ workOrderId: 1, changeType: 'QTY', qty: '', changeReason: '' })
const splitForm = reactive({ workOrderId: 1, splitQty: '1', reason: '' })

const conflicts = ref<Row>({})
const capacity = ref<Row>({})
const scheduleForm = reactive({ from: '', to: '', days: 7 })
const lockForm = reactive({ planTaskId: 1, reason: '' })

const overIssue = ref<Row>({})
const overIssues = ref<Row[]>([])
const overForm = reactive({ workOrderId: 1, materialId: 1, reason: '' })

const reportForm = reactive({ workOrderId: 1, scanCode: '', qty: '1', defectQty: '0', workHours: '0' })
const wip = ref<Row>({})

const analysis = ref<Row>({})
const analysisForm = reactive({ from: '', to: '', productId: undefined as number | undefined })

const qcItems = ref<Row[]>([])
const qcForm = reactive({ qcId: 1, itemCode: 'ITEM1', itemName: '外观检验', standardValue: '', measuredValue: '', upperLimit: '', lowerLimit: '' })

const faults = ref<Row[]>([])
const faultForm = reactive({ equipmentId: 1, faultType: 'MECHANICAL', faultDesc: '', stopLineAt: '', stopLineEnd: '', dailyCapacity: '' })
const maintenances = ref<Row[]>([])
const maintenanceForm = reactive({ equipmentId: 1, planDate: '', cycleDays: 30, maintenanceType: 'ROUTINE', maintenanceContent: '' })

const stopLineForm = reactive({ exceptionId: 1, stopLineAt: '', stopLineEnd: '', dailyCapacity: '' })
const mrpSim = ref<Row>({})
const mrpForm = reactive({ planDate: '', factoryId: undefined as number | undefined, safetyQty: '0' })

function fail(cause: unknown): void {
  ElMessage.error(cause instanceof Error ? cause.message : '操作失败')
}

async function loadBomChanges(): Promise<void> {
  try {
    bomChanges.value = await listBomChanges({ page: 1, pageSize: 100 })
  } catch (cause) {
    fail(cause)
  }
}

async function loadWorkOrderChanges(): Promise<void> {
  try {
    workOrderChanges.value = await listWorkOrderChanges(changeForm.workOrderId)
  } catch (cause) {
    fail(cause)
  }
}

async function loadOverIssues(): Promise<void> {
  try {
    overIssues.value = await listOverIssues({ page: 1, pageSize: 100 })
  } catch (cause) {
    fail(cause)
  }
}

async function loadQcItems(): Promise<void> {
  try {
    qcItems.value = await listQcItems(qcForm.qcId)
  } catch (cause) {
    fail(cause)
  }
}

async function loadFaults(): Promise<void> {
  try {
    faults.value = await listEquipmentFaults({ page: 1, pageSize: 100 })
  } catch (cause) {
    fail(cause)
  }
}

async function loadMaintenances(): Promise<void> {
  try {
    maintenances.value = await listMaintenances({ page: 1, pageSize: 100 })
  } catch (cause) {
    fail(cause)
  }
}

async function loadWip(): Promise<void> {
  try {
    wip.value = await fetchWipBoard()
  } catch (cause) {
    fail(cause)
  }
}

async function loadAnalysis(): Promise<void> {
  try {
    analysis.value = await fetchProductionAnalysis({ ...analysisForm })
  } catch (cause) {
    fail(cause)
  }
}

async function doBomDiff(): Promise<void> {
  try {
    bomDiff.value = await diffBomVersions(bomForm.baseId, bomForm.targetId)
    ElMessage.success('对比完成')
  } catch (cause) {
    fail(cause)
  }
}

async function doCreateBomChange(): Promise<void> {
  try {
    await createBomChange({ ...bomForm })
    ElMessage.success('变更单已提交')
    await loadBomChanges()
  } catch (cause) {
    fail(cause)
  }
}

async function doApproveBomChange(id: number, approve: boolean): Promise<void> {
  try {
    await approveBomChange(id, { approve })
    ElMessage.success(approve ? '已审批' : '已驳回')
    await loadBomChanges()
  } catch (cause) {
    fail(cause)
  }
}

async function doCreateWorkOrderChange(): Promise<void> {
  try {
    await createWorkOrderChange(changeForm.workOrderId, { ...changeForm })
    ElMessage.success('变更单已提交')
    await loadWorkOrderChanges()
  } catch (cause) {
    fail(cause)
  }
}

async function doApproveWorkOrderChange(id: number, approve: boolean): Promise<void> {
  try {
    await approveWorkOrderChange(id, { approve })
    ElMessage.success(approve ? '已审批' : '已驳回')
    await loadWorkOrderChanges()
  } catch (cause) {
    fail(cause)
  }
}

async function doSplit(): Promise<void> {
  try {
    await splitWorkOrder(splitForm.workOrderId, { splitQty: splitForm.splitQty, reason: splitForm.reason })
    ElMessage.success('拆分完成')
  } catch (cause) {
    fail(cause)
  }
}

async function doConflicts(): Promise<void> {
  try {
    conflicts.value = await fetchScheduleConflicts({ ...scheduleForm })
    ElMessage.success('冲突检测完成')
  } catch (cause) {
    fail(cause)
  }
}

async function doCapacity(): Promise<void> {
  try {
    capacity.value = await fetchCapacityLoad({ ...scheduleForm })
    ElMessage.success('负荷分析完成')
  } catch (cause) {
    fail(cause)
  }
}

async function doLock(lock: boolean): Promise<void> {
  try {
    await lockPlanTask(lockForm.planTaskId, { lock, reason: lockForm.reason })
    ElMessage.success(lock ? '已锁定' : '已解锁')
  } catch (cause) {
    fail(cause)
  }
}

async function doOverCheck(): Promise<void> {
  try {
    overIssue.value = await fetchOverIssueCheck(overForm.workOrderId, overForm.materialId)
    ElMessage.success('已检测')
  } catch (cause) {
    fail(cause)
  }
}

async function doRequestOverIssue(): Promise<void> {
  try {
    await requestOverIssue(overForm.workOrderId, { materialId: overForm.materialId, reason: overForm.reason })
    ElMessage.success('审批单已提交')
    await loadOverIssues()
  } catch (cause) {
    fail(cause)
  }
}

async function doApproveOverIssue(id: number, approve: boolean): Promise<void> {
  try {
    await approveOverIssue(id, { approve })
    ElMessage.success(approve ? '已审批' : '已驳回')
    await loadOverIssues()
  } catch (cause) {
    fail(cause)
  }
}

async function doScanReport(): Promise<void> {
  try {
    await scanReport(reportForm.workOrderId, { ...reportForm })
    ElMessage.success('报工成功')
    await loadWip()
  } catch (cause) {
    fail(cause)
  }
}

async function doCreateQcItem(): Promise<void> {
  try {
    await createQcItem({ ...qcForm })
    ElMessage.success('检验项已录入')
    await loadQcItems()
  } catch (cause) {
    fail(cause)
  }
}

async function doCreateFault(): Promise<void> {
  try {
    await createEquipmentFault({ ...faultForm })
    ElMessage.success('故障已登记')
    await loadFaults()
  } catch (cause) {
    fail(cause)
  }
}

async function doRepairFault(id: number): Promise<void> {
  try {
    await repairEquipmentFault(id, { repairResult: '已修复' })
    ElMessage.success('维修完成')
    await loadFaults()
  } catch (cause) {
    fail(cause)
  }
}

async function doCreateMaintenance(): Promise<void> {
  try {
    await createMaintenance({ ...maintenanceForm })
    ElMessage.success('保养计划已创建')
    await loadMaintenances()
  } catch (cause) {
    fail(cause)
  }
}

async function doExecuteMaintenance(id: number): Promise<void> {
  try {
    await executeMaintenance(id, { executeResult: '完成' })
    ElMessage.success('保养已执行')
    await loadMaintenances()
  } catch (cause) {
    fail(cause)
  }
}

async function doStopLine(): Promise<void> {
  try {
    await recordStopLine(stopLineForm.exceptionId, { ...stopLineForm })
    ElMessage.success('停线已记录')
  } catch (cause) {
    fail(cause)
  }
}

async function doSimulateMrp(): Promise<void> {
  try {
    mrpSim.value = await simulateMrp({ ...mrpForm })
    ElMessage.success('模拟完成')
  } catch (cause) {
    fail(cause)
  }
}

onMounted(() => {
  void loadBomChanges()
  void loadOverIssues()
  void loadFaults()
  void loadMaintenances()
  void loadWip()
  void loadAnalysis()
})
</script>

<template>
  <section class="page">
    <header class="page-head">
      <h2>生产制造扩展</h2>
      <p>BOM 版本对比与变更审批、工单变更与拆分、排产冲突与产能负荷、超额领料审批、扫码报工、在制看板、生产分析、质检检验项、设备故障与保养、停线记录、MRP 模拟运算。</p>
    </header>

    <el-tabs v-model="tab">
      <el-tab-pane label="BOM 版本变更" name="bom">
        <el-card shadow="never">
          <el-form :inline="true">
            <el-form-item label="基准 BOM"><el-input-number v-model="bomForm.baseId" :min="1" /></el-form-item>
            <el-form-item label="目标 BOM"><el-input-number v-model="bomForm.targetId" :min="1" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doBomDiff">版本对比</el-button></el-form-item>
          </el-form>
          <el-descriptions v-if="bomDiff" :column="3" border>
            <el-descriptions-item label="新增子件">{{ ((bomDiff.added as Array<unknown>) ?? []).length }}</el-descriptions-item>
            <el-descriptions-item label="删除子件">{{ ((bomDiff.removed as Array<unknown>) ?? []).length }}</el-descriptions-item>
            <el-descriptions-item label="变更子件">{{ bomDiff.changedCount ?? 0 }}</el-descriptions-item>
          </el-descriptions>
          <el-table v-if="bomDiff" :data="(bomDiff.changed as Row[]) ?? []" size="small" style="margin-top: 12px">
            <el-table-column prop="materialId" label="物料ID" width="120" />
            <el-table-column label="变更前用量" width="120">
              <template #default="{ row }">{{ (row.before as Row)?.qty }}</template>
            </el-table-column>
            <el-table-column label="变更后用量" width="120">
              <template #default="{ row }">{{ (row.after as Row)?.qty }}</template>
            </el-table-column>
          </el-table>

          <el-divider content-position="left">变更申请</el-divider>
          <el-form :inline="true">
            <el-form-item label="BOM ID"><el-input-number v-model="bomForm.bomId" :min="1" /></el-form-item>
            <el-form-item label="目标版本"><el-input v-model="bomForm.toVersion" /></el-form-item>
            <el-form-item label="变更原因"><el-input v-model="bomForm.changeReason" style="width: 220px" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doCreateBomChange">提交变更</el-button></el-form-item>
          </el-form>
          <el-table :data="bomChanges" size="small">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="bomId" label="BOM" width="100" />
            <el-table-column prop="fromVersion" label="原版本" width="110" />
            <el-table-column prop="toVersion" label="新版本" width="110" />
            <el-table-column prop="changeReason" label="变更原因" min-width="180" />
            <el-table-column prop="status" label="状态" width="110" />
            <el-table-column label="操作" width="180">
              <template #default="{ row }">
                <el-button size="small" type="primary" @click="doApproveBomChange(row.id as number, true)">通过</el-button>
                <el-button size="small" @click="doApproveBomChange(row.id as number, false)">驳回</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="工单变更与拆分" name="workorder">
        <el-card shadow="never">
          <el-form :inline="true">
            <el-form-item label="工单 ID"><el-input-number v-model="changeForm.workOrderId" :min="1" /></el-form-item>
            <el-form-item label="变更类型">
              <el-select v-model="changeForm.changeType">
                <el-option label="数量" value="QTY" />
                <el-option label="计划" value="PLAN" />
                <el-option label="工艺" value="ROUTING" />
                <el-option label="取消" value="CANCEL" />
              </el-select>
            </el-form-item>
            <el-form-item label="数量"><el-input v-model="changeForm.qty" style="width: 120px" /></el-form-item>
            <el-form-item label="原因"><el-input v-model="changeForm.changeReason" style="width: 200px" /></el-form-item>
            <el-form-item>
              <el-button type="primary" @click="doCreateWorkOrderChange">提交变更</el-button>
              <el-button @click="loadWorkOrderChanges">刷新</el-button>
            </el-form-item>
          </el-form>
          <el-table :data="workOrderChanges" size="small">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="changeVersion" label="版本" width="90" />
            <el-table-column prop="changeType" label="类型" width="110" />
            <el-table-column prop="changeReason" label="原因" min-width="180" />
            <el-table-column prop="status" label="状态" width="110" />
            <el-table-column label="操作" width="180">
              <template #default="{ row }">
                <el-button size="small" type="primary" @click="doApproveWorkOrderChange(row.id as number, true)">通过</el-button>
                <el-button size="small" @click="doApproveWorkOrderChange(row.id as number, false)">驳回</el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-divider content-position="left">工单拆分</el-divider>
          <el-form :inline="true">
            <el-form-item label="工单 ID"><el-input-number v-model="splitForm.workOrderId" :min="1" /></el-form-item>
            <el-form-item label="拆分数量"><el-input v-model="splitForm.splitQty" style="width: 120px" /></el-form-item>
            <el-form-item label="原因"><el-input v-model="splitForm.reason" style="width: 200px" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doSplit">拆分</el-button></el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="排产冲突与产能" name="schedule">
        <el-card shadow="never">
          <el-form :inline="true">
            <el-form-item label="开始"><el-date-picker v-model="scheduleForm.from" type="date" value-format="YYYY-MM-DD" placeholder="2026-03-01"  /></el-form-item>
            <el-form-item label="结束"><el-date-picker v-model="scheduleForm.to" type="date" value-format="YYYY-MM-DD" placeholder="2026-03-31"  /></el-form-item>
            <el-form-item label="天数"><el-input-number v-model="scheduleForm.days" :min="1" /></el-form-item>
            <el-form-item>
              <el-button type="primary" @click="doConflicts">冲突检测</el-button>
              <el-button @click="doCapacity">产能负荷</el-button>
            </el-form-item>
          </el-form>
          <el-table :data="(conflicts.conflicts as Row[]) ?? []" size="small">
            <el-table-column prop="type" label="冲突类型" width="160" />
            <el-table-column label="任务" width="140">
              <template #default="{ row }">{{ (row.taskIds as number[]).join(' / ') }}</template>
            </el-table-column>
            <el-table-column prop="reason" label="原因" min-width="260" />
          </el-table>

          <el-divider content-position="left">产能负荷</el-divider>
          <el-table :data="(capacity.loads as Row[]) ?? []" size="small">
            <el-table-column prop="name" label="工作中心" min-width="160" />
            <el-table-column prop="loadHours" label="负荷工时" width="120" />
            <el-table-column prop="capacityHours" label="可用产能" width="120" />
            <el-table-column prop="loadRate" label="负荷率(%)" width="120" />
            <el-table-column prop="overloaded" label="是否超载" width="110" />
          </el-table>

          <el-divider content-position="left">排产锁定</el-divider>
          <el-form :inline="true">
            <el-form-item label="排产任务 ID"><el-input-number v-model="lockForm.planTaskId" :min="1" /></el-form-item>
            <el-form-item label="原因"><el-input v-model="lockForm.reason" style="width: 220px" /></el-form-item>
            <el-form-item>
              <el-button type="primary" @click="doLock(true)">锁定</el-button>
              <el-button @click="doLock(false)">解锁</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="超额领料" name="overissue">
        <el-card shadow="never">
          <el-form :inline="true">
            <el-form-item label="工单 ID"><el-input-number v-model="overForm.workOrderId" :min="1" /></el-form-item>
            <el-form-item label="物料 ID"><el-input-number v-model="overForm.materialId" :min="1" /></el-form-item>
            <el-form-item label="原因"><el-input v-model="overForm.reason" style="width: 220px" /></el-form-item>
            <el-form-item>
              <el-button type="primary" @click="doOverCheck">超额检测</el-button>
              <el-button @click="doRequestOverIssue">提交审批</el-button>
            </el-form-item>
          </el-form>
          <el-descriptions v-if="overIssue" :column="4" border>
            <el-descriptions-item label="应耗量">{{ overIssue.requiredQty ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="已领量">{{ overIssue.issuedQty ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="超额量">{{ overIssue.overQty ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="已批额度">{{ overIssue.approvedOverQty ?? 0 }}</el-descriptions-item>
          </el-descriptions>
          <el-table :data="overIssues" size="small" style="margin-top: 12px">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="workOrderId" label="工单" width="100" />
            <el-table-column prop="materialId" label="物料" width="100" />
            <el-table-column prop="overQty" label="超额量" width="110" />
            <el-table-column prop="status" label="状态" width="110" />
            <el-table-column label="操作" width="180">
              <template #default="{ row }">
                <el-button size="small" type="primary" @click="doApproveOverIssue(row.id as number, true)">通过</el-button>
                <el-button size="small" @click="doApproveOverIssue(row.id as number, false)">驳回</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="扫码报工与在制" name="execution">
        <el-card shadow="never">
          <el-form :inline="true">
            <el-form-item label="工单 ID"><el-input-number v-model="reportForm.workOrderId" :min="1" /></el-form-item>
            <el-form-item label="条码"><el-input v-model="reportForm.scanCode" style="width: 220px" placeholder="产品ID|批次|序列号|数量" /></el-form-item>
            <el-form-item label="数量"><el-input v-model="reportForm.qty" style="width: 110px" /></el-form-item>
            <el-form-item label="不良"><el-input v-model="reportForm.defectQty" style="width: 110px" /></el-form-item>
            <el-form-item label="工时"><el-input v-model="reportForm.workHours" style="width: 110px" /></el-form-item>
            <el-form-item>
              <el-button type="primary" @click="doScanReport">扫码报工</el-button>
              <el-button @click="loadWip">刷新看板</el-button>
            </el-form-item>
          </el-form>

          <el-descriptions :column="3" border>
            <el-descriptions-item label="在制数量">{{ wip.wipQty ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="逾期工单">{{ wip.overdueCount ?? 0 }}</el-descriptions-item>
          </el-descriptions>
          <el-table :data="(wip.rows as Row[]) ?? []" size="small" style="margin-top: 12px">
            <el-table-column prop="orderNo" label="工单号" min-width="160" />
            <el-table-column prop="plannedQty" label="计划数量" width="110" />
            <el-table-column prop="actualQty" label="完工数量" width="110" />
            <el-table-column prop="wipQty" label="在制数量" width="110" />
            <el-table-column prop="progress" label="进度(%)" width="110" />
            <el-table-column prop="overdue" label="是否逾期" width="110" />
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="生产分析" name="analysis">
        <el-card shadow="never">
          <el-form :inline="true">
            <el-form-item label="起"><el-date-picker v-model="analysisForm.from" type="date" value-format="YYYY-MM-DD" placeholder="2026-03-01"  /></el-form-item>
            <el-form-item label="止"><el-date-picker v-model="analysisForm.to" type="date" value-format="YYYY-MM-DD" placeholder="2026-03-31"  /></el-form-item>
            <el-form-item label="产品 ID"><el-input-number v-model="analysisForm.productId" :min="1" /></el-form-item>
            <el-form-item><el-button type="primary" @click="loadAnalysis">刷新</el-button></el-form-item>
          </el-form>
          <el-descriptions :column="4" border>
            <el-descriptions-item label="良率(%)">{{ analysis.yieldRate ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="效率(%)">{{ analysis.efficiencyRate ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="达成率(%)">{{ analysis.achievementRate ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="实际工时">{{ analysis.actualHours ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="标准工时">{{ analysis.standardHours ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="材料成本">{{ analysis.materialCost ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="单位成本">{{ analysis.unitCost ?? 0 }}</el-descriptions-item>
            <el-descriptions-item label="工单数">{{ analysis.orderCount ?? 0 }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="质检检验项" name="qc">
        <el-card shadow="never">
          <el-form :inline="true">
            <el-form-item label="质检单 ID"><el-input-number v-model="qcForm.qcId" :min="1" /></el-form-item>
            <el-form-item label="项编码"><el-input v-model="qcForm.itemCode" style="width: 120px" /></el-form-item>
            <el-form-item label="项名称"><el-input v-model="qcForm.itemName" style="width: 150px" /></el-form-item>
            <el-form-item label="实测值"><el-input v-model="qcForm.measuredValue" style="width: 110px" /></el-form-item>
            <el-form-item label="上限"><el-input v-model="qcForm.upperLimit" style="width: 100px" /></el-form-item>
            <el-form-item label="下限"><el-input v-model="qcForm.lowerLimit" style="width: 100px" /></el-form-item>
            <el-form-item>
              <el-button type="primary" @click="doCreateQcItem">录入</el-button>
              <el-button @click="loadQcItems">刷新</el-button>
            </el-form-item>
          </el-form>
          <el-table :data="qcItems" size="small">
            <el-table-column prop="itemCode" label="项编码" width="130" />
            <el-table-column prop="itemName" label="项名称" min-width="150" />
            <el-table-column prop="measuredValue" label="实测值" width="110" />
            <el-table-column prop="upperLimit" label="上限" width="100" />
            <el-table-column prop="lowerLimit" label="下限" width="100" />
            <el-table-column prop="isQualified" label="是否合格" width="110" />
            <el-table-column prop="itemResult" label="判定说明" min-width="200" />
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="设备故障与保养" name="equipment">
        <el-card shadow="never">
          <el-form :inline="true">
            <el-form-item label="设备 ID"><el-input-number v-model="faultForm.equipmentId" :min="1" /></el-form-item>
            <el-form-item label="故障类型">
              <el-select v-model="faultForm.faultType">
                <el-option label="机械" value="MECHANICAL" />
                <el-option label="电气" value="ELECTRICAL" />
                <el-option label="工艺" value="PROCESS" />
                <el-option label="其他" value="OTHER" />
              </el-select>
            </el-form-item>
            <el-form-item label="故障描述"><el-input v-model="faultForm.faultDesc" style="width: 200px" /></el-form-item>
            <el-form-item label="停线开始"><el-date-picker v-model="faultForm.stopLineAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="2026-03-01 08:00:00"  /></el-form-item>
            <el-form-item label="停线结束"><el-date-picker v-model="faultForm.stopLineEnd" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="2026-03-01 12:00:00"  /></el-form-item>
            <el-form-item><el-button type="primary" @click="doCreateFault">报修</el-button></el-form-item>
          </el-form>
          <el-table :data="faults" size="small">
            <el-table-column prop="faultNo" label="故障单号" min-width="160" />
            <el-table-column prop="equipmentId" label="设备" width="100" />
            <el-table-column prop="faultType" label="类型" width="120" />
            <el-table-column prop="downtimeMinutes" label="停机分钟" width="120" />
            <el-table-column prop="delayDays" label="顺延天数" width="110" />
            <el-table-column prop="status" label="状态" width="100" />
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button size="small" type="primary" @click="doRepairFault(row.id as number)">维修</el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-divider content-position="left">保养计划</el-divider>
          <el-form :inline="true">
            <el-form-item label="设备 ID"><el-input-number v-model="maintenanceForm.equipmentId" :min="1" /></el-form-item>
            <el-form-item label="计划日期"><el-date-picker v-model="maintenanceForm.planDate" type="date" value-format="YYYY-MM-DD" placeholder="2026-04-01"  /></el-form-item>
            <el-form-item label="周期(天)"><el-input-number v-model="maintenanceForm.cycleDays" :min="1" /></el-form-item>
            <el-form-item label="保养内容"><el-input v-model="maintenanceForm.maintenanceContent" style="width: 200px" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doCreateMaintenance">新增</el-button></el-form-item>
          </el-form>
          <el-table :data="maintenances" size="small">
            <el-table-column prop="maintenanceNo" label="保养单号" min-width="160" />
            <el-table-column prop="equipmentId" label="设备" width="100" />
            <el-table-column prop="planDate" label="计划日期" width="120" />
            <el-table-column prop="cycleDays" label="周期" width="100" />
            <el-table-column prop="status" label="状态" width="110" />
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button size="small" type="primary" @click="doExecuteMaintenance(row.id as number)">执行</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="停线与 MRP" name="mrp">
        <el-card shadow="never">
          <el-form :inline="true">
            <el-form-item label="异常单 ID"><el-input-number v-model="stopLineForm.exceptionId" :min="1" /></el-form-item>
            <el-form-item label="停线开始"><el-date-picker v-model="stopLineForm.stopLineAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="2026-03-01 08:00:00"  /></el-form-item>
            <el-form-item label="停线结束"><el-date-picker v-model="stopLineForm.stopLineEnd" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="2026-03-01 12:00:00"  /></el-form-item>
            <el-form-item label="日产能"><el-input v-model="stopLineForm.dailyCapacity" style="width: 110px" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doStopLine">记录停线</el-button></el-form-item>
          </el-form>

          <el-divider content-position="left">MRP 模拟运算</el-divider>
          <el-form :inline="true">
            <el-form-item label="计划日期"><el-date-picker v-model="mrpForm.planDate" type="date" value-format="YYYY-MM-DD" placeholder="2026-03-20"  /></el-form-item>
            <el-form-item label="工厂 ID"><el-input-number v-model="mrpForm.factoryId" :min="1" /></el-form-item>
            <el-form-item label="安全库存"><el-input v-model="mrpForm.safetyQty" style="width: 110px" /></el-form-item>
            <el-form-item><el-button type="primary" @click="doSimulateMrp">模拟运算</el-button></el-form-item>
          </el-form>
          <el-table :data="(mrpSim.rows as Row[]) ?? []" size="small">
            <el-table-column prop="productId" label="产品ID" width="110" />
            <el-table-column prop="grossQty" label="毛需求" width="110" />
            <el-table-column prop="availableQty" label="可用" width="110" />
            <el-table-column prop="onWayQty" label="在途" width="110" />
            <el-table-column prop="netQty" label="净需求" width="110" />
            <el-table-column prop="priority" label="优先级" width="100" />
            <el-table-column prop="priorityLabel" label="级别" width="100" />
            <el-table-column prop="priorityReason" label="优先级依据" min-width="220" />
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </section>
</template>
