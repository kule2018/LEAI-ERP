<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { actFlowTask, addSignFlowTask, delegateFlowTask, fetchTodo, type CollabQuery, type FlowTask } from '@/api/collaboration'

type OperationType = 'APPROVE' | 'REJECT' | 'DELEGATE' | 'ADD_SIGN'

const rows = ref<FlowTask[]>([])
const total = ref(0)
const loading = ref(false)
const selected = ref<FlowTask[]>([])
const query = ref<CollabQuery>({ page: 1, pageSize: 20, keyword: '' })
let seq = 0

const operationVisible = ref(false)
const operationType = ref<OperationType>('APPROVE')
const operationTask = ref<FlowTask | null>(null)
const operationTarget = ref<number | undefined>(undefined)
const operationComment = ref('')
const operationStartAt = ref('')
const operationEndAt = ref('')
const operationSubmitting = ref(false)

const operationTitle: Record<OperationType, string> = {
  APPROVE: '通过审批',
  REJECT: '驳回审批',
  DELEGATE: '转办 / 委托',
  ADD_SIGN: '加签'
}

function isOverdue(row: FlowTask): boolean {
  return !!row.dueAt && new Date(row.dueAt).getTime() < Date.now()
}

async function batchApprove(): Promise<void> {
  if (selected.value.length === 0) { ElMessage.warning('请先选择待办'); return }
  try {
    await ElMessageBox.confirm(`确认批量通过 ${selected.value.length} 项待办？`, '批量审批', { type: 'warning' })
  } catch { return }
  let ok = 0
  for (const row of selected.value) {
    try { await actFlowTask(row.id, { action: 'APPROVE', comment: '批量审批通过' }); ok++ }
    catch { /* 单项失败不影响其余 */ }
  }
  ElMessage.success(`批量通过 ${ok} 项，失败 ${selected.value.length - ok} 项`)
  selected.value = []
  await load()
}

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchTodo(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}

function openOperation(row: unknown, type: OperationType): void {
  operationTask.value = row as FlowTask
  operationType.value = type
  operationTarget.value = undefined
  operationComment.value = ''
  operationStartAt.value = ''
  operationEndAt.value = ''
  operationVisible.value = true
}

async function submitOperation(): Promise<void> {
  const task = operationTask.value
  if (!task || operationSubmitting.value) return
  if ((operationType.value === 'DELEGATE' || operationType.value === 'ADD_SIGN') && !operationTarget.value) {
    ElMessage.warning('请填写目标用户 ID')
    return
  }
  if (operationType.value === 'REJECT' && !operationComment.value.trim()) {
    ElMessage.warning('驳回必须填写原因')
    return
  }
  if (operationType.value === 'DELEGATE' && operationStartAt.value && operationEndAt.value
    && new Date(operationEndAt.value).getTime() <= new Date(operationStartAt.value).getTime()) {
    ElMessage.warning('委托结束时间必须晚于开始时间')
    return
  }
  operationSubmitting.value = true
  try {
    if (operationType.value === 'APPROVE' || operationType.value === 'REJECT') {
      await actFlowTask(task.id, { action: operationType.value, comment: operationComment.value.trim() })
    } else if (operationType.value === 'DELEGATE') {
      await delegateFlowTask(task.id, {
        toUserId: Number(operationTarget.value),
        reason: operationComment.value.trim() || undefined,
        startAt: operationStartAt.value ? new Date(operationStartAt.value).toISOString() : undefined,
        endAt: operationEndAt.value ? new Date(operationEndAt.value).toISOString() : undefined
      })
    } else {
      await addSignFlowTask(task.id, { userId: Number(operationTarget.value), reason: operationComment.value.trim() || undefined })
    }
    operationVisible.value = false
    ElMessage.success(`${operationTitle[operationType.value]}成功`)
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '操作失败')
  } finally {
    operationSubmitting.value = false
  }
}

onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>待办</h2><p>审批、确认和处理分配给当前用户的任务；通过、驳回、转办与加签在统一操作面板完成。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-input v-model="query.keyword" placeholder="单据编号关键字" clearable style="width: 200px" @keyup.enter="load" />
        <el-input v-model="query.bizType" placeholder="业务类型，如 PURCHASE_ORDER" clearable style="width: 220px" @keyup.enter="load" />
        <el-input-number v-model="query.assigneeId" :min="1" placeholder="处理人 ID" style="width: 150px" />
        <el-checkbox v-model="query.onlyOverdue">仅超时</el-checkbox>
        <el-button type="primary" v-perm="'flow:todo:approve'" :disabled="selected.length === 0" @click="batchApprove">批量通过 ({{ selected.length }})</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="rows" row-key="id" @selection-change="(v: FlowTask[]) => selected = v">
        <el-table-column type="selection" width="50" />
        <el-table-column prop="instanceId" label="流程实例" width="120" />
        <el-table-column prop="nodeId" label="节点ID" width="110" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column prop="dueAt" label="截止" width="180">
          <template #default="{ row }">
            <span :class="{ overdue: isOverdue(row as FlowTask) }">{{ (row as FlowTask).dueAt ?? '无' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260">
          <template #default="{ row }">
            <el-button link type="success" v-perm="'flow:todo:approve'" @click="openOperation(row, 'APPROVE')">通过</el-button>
            <el-button link type="danger" v-perm="'flow:todo:approve'" @click="openOperation(row, 'REJECT')">驳回</el-button>
            <el-button link v-perm="'flow:todo:approve'" @click="openOperation(row, 'DELEGATE')">转办</el-button>
            <el-button link v-perm="'flow:todo:approve'" @click="openOperation(row, 'ADD_SIGN')">加签</el-button>
          </template>
        </el-table-column>
      </el-table>
    </article>

    <el-dialog v-model="operationVisible" :title="operationTitle[operationType]" width="520px">
      <el-form label-width="100px">
        <el-form-item label="待办ID">
          <el-input :model-value="operationTask?.id" disabled />
        </el-form-item>
        <el-form-item v-if="operationType === 'DELEGATE' || operationType === 'ADD_SIGN'" label="目标用户ID">
          <el-input-number v-model="operationTarget" :min="1" placeholder="受托/加签人用户 ID" />
        </el-form-item>
        <el-form-item v-if="operationType === 'DELEGATE'" label="委托起止">
          <el-date-picker v-model="operationStartAt" type="datetime" placeholder="开始时间" style="width: 100%" />
          <el-date-picker v-model="operationEndAt" type="datetime" placeholder="结束时间" style="width: 100%; margin-top: 8px" />
        </el-form-item>
        <el-form-item label="意见/原因">
          <el-input v-model="operationComment" type="textarea" :rows="3" placeholder="驳回必填，转办/加签可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="operationVisible = false">取消</el-button>
        <el-button type="primary" :loading="operationSubmitting" @click="submitOperation">确认</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.overdue { color: #f56c6c; font-weight: 600; }
</style>
