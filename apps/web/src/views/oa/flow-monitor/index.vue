<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  exportFlowMonitorAnalysis,
  fetchFlowDetail,
  fetchFlowInstances,
  fetchFlowMonitorAnalysis,
  startFlow,
  type CollabQuery,
  type FlowInstance,
  type FlowMonitorAnalysis,
  type FlowTask
} from '@/api/collaboration'

const rows = ref<FlowInstance[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<CollabQuery>({ page: 1, pageSize: 20 })
const visible = ref(false)
const form = reactive({ bizType: '', bizId: 0, bizNo: '' })
const detailVisible = ref(false)
const detail = ref<{
  instance: FlowInstance
  nodes: Array<Record<string, unknown>>
  tasks: FlowTask[]
  logs: Array<Record<string, unknown>>
} | null>(null)
let seq = 0

const analysis = ref<FlowMonitorAnalysis | null>(null)
const analysisLoading = ref(false)

async function loadAnalysis(): Promise<void> {
  analysisLoading.value = true
  try {
    analysis.value = await fetchFlowMonitorAnalysis({ page: 1, pageSize: 20, ...(query.value.status ? { status: query.value.status } : {}), ...(query.value.bizType ? { bizType: query.value.bizType } : {}) })
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载监控分析失败')
  } finally {
    analysisLoading.value = false
  }
}

function toCsv(rows: Array<Array<string | number>>): string {
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
}

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([`\ufeff${content}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function exportAnalysis(): Promise<void> {
  try {
    const result = await exportFlowMonitorAnalysis({
      status: query.value.status ?? '',
      bizType: query.value.bizType ?? ''
    })
    const rows: Array<Array<string | number>> = [['业务类型', '实例数', '已完结', '平均耗时(小时)', '最长耗时(小时)']]
    result.byType.forEach((item) => rows.push([item.bizType, item.total, item.finished, item.avgDurationHours, item.maxDurationHours]))
    rows.push([])
    rows.push(['瓶颈节点', '任务数', '平均耗时(小时)', '最长耗时(小时)'])
    result.bottlenecks.forEach((item) => rows.push([item.nodeName, item.taskCount, item.avgDurationHours, item.maxDurationHours]))
    rows.push([])
    rows.push(['超时单据', '业务类型', '节点', '处理人', '等待时长(小时)', '超时时长(小时)', '超时(小时)'])
    result.timeouts.forEach((item) => rows.push([item.bizNo ?? `#${item.instanceId}`, item.bizType, item.nodeName, item.assigneeId, item.waitHours, item.timeoutHours, item.overdueHours]))
    downloadCsv(`流程监控分析_${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows))
    ElMessage.success('已导出监控分析（导出行为已留审计）')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '导出失败')
  }
}

async function openDetail(row: FlowInstance): Promise<void> {
  try {
    detail.value = await fetchFlowDetail(row.id)
    detailVisible.value = true
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载流程详情失败')
  }
}

function taskForNode(nodeId: unknown): Record<string, unknown> | undefined {
  return detail.value?.tasks.find((t) => t.nodeId === nodeId)
}

function statusLabel(status: unknown): string {
  const map: Record<string, string> = {
    PENDING: '待处理', APPROVED: '已通过', REJECTED: '已驳回', CANCELLED: '已取消',
    RUNNING: '进行中', DONE: '完成', DELEGATE: '转办', ADD_SIGN: '加签'
  }
  return map[String(status)] ?? String(status ?? '')
}

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchFlowInstances(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function openStart(): void { Object.assign(form, { bizType: '', bizId: 0, bizNo: '' }); visible.value = true }
async function save(): Promise<void> {
  try { await startFlow({ ...form }); visible.value = false; ElMessage.success('流程已发起'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '发起失败') }
}
onMounted(() => { load(); loadAnalysis() })
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>流程监控</h2><p>查看流程实例状态，也可手工发起通用审批。</p></header>
    <article class="panel" v-loading="analysisLoading">
      <div class="toolbar">
        <strong class="panel-title">监控分析</strong>
        <el-button @click="loadAnalysis">刷新分析</el-button>
        <el-button v-perm="'flow:monitor:view'" @click="exportAnalysis">导出分析</el-button>
      </div>
      <div class="metric-grid" v-if="analysis">
        <article class="metric-card"><span>实例总数</span><strong>{{ analysis.summary.total }}</strong></article>
        <article class="metric-card"><span>已完结</span><strong>{{ analysis.summary.finished }}</strong></article>
        <article class="metric-card"><span>进行中</span><strong>{{ analysis.summary.running }}</strong></article>
        <article class="metric-card"><span>平均耗时(h)</span><strong>{{ analysis.summary.avgDurationHours }}</strong></article>
        <article class="metric-card"><span>最长耗时(h)</span><strong>{{ analysis.summary.maxDurationHours }}</strong></article>
        <article class="metric-card"><span>超时待办</span><strong>{{ analysis.timeouts.length }}</strong></article>
      </div>
      <el-row :gutter="16">
        <el-col :span="12">
          <h4>瓶颈节点排行</h4>
          <el-table :data="analysis?.bottlenecks ?? []" size="small" empty-text="暂无数据">
            <el-table-column prop="nodeName" label="节点" min-width="140" />
            <el-table-column prop="taskCount" label="任务数" width="90" />
            <el-table-column prop="avgDurationHours" label="平均耗时(h)" width="120" />
            <el-table-column prop="maxDurationHours" label="最长耗时(h)" width="120" />
          </el-table>
        </el-col>
        <el-col :span="12">
          <h4>超时排行</h4>
          <el-table :data="analysis?.timeouts ?? []" size="small" empty-text="暂无超时">
            <el-table-column label="单据" min-width="140">
              <template #default="{ row }">{{ row.bizNo ?? `#${row.instanceId}` }}</template>
            </el-table-column>
            <el-table-column prop="nodeName" label="节点" width="120" />
            <el-table-column prop="assigneeId" label="处理人" width="90" />
            <el-table-column prop="waitHours" label="等待(h)" width="100" />
            <el-table-column prop="overdueHours" label="超时(h)" width="100" />
          </el-table>
        </el-col>
      </el-row>
      <h4>按业务类型耗时</h4>
      <el-table :data="analysis?.byType ?? []" size="small" empty-text="暂无数据">
        <el-table-column prop="bizType" label="业务类型" min-width="140" />
        <el-table-column prop="total" label="实例数" width="90" />
        <el-table-column prop="finished" label="已完结" width="90" />
        <el-table-column prop="avgDurationHours" label="平均耗时(h)" width="130" />
        <el-table-column prop="maxDurationHours" label="最长耗时(h)" width="130" />
      </el-table>
    </article>
    <article class="panel">
      <div class="toolbar"><el-button type="primary" v-perm="'flow:start'" @click="openStart">发起流程</el-button><el-button @click="load">刷新</el-button></div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="bizType" label="业务类型" width="150" />
        <el-table-column prop="bizId" label="业务ID" width="110" />
        <el-table-column prop="bizNo" label="业务单号" width="180" />
        <el-table-column prop="status" label="状态" width="120" />
        <el-table-column prop="startedAt" label="发起时间" width="180" />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'flow:monitor:view'" @click="openDetail(row as FlowInstance)">流程图</el-button>
          </template>
        </el-table-column>
      </el-table>
    </article>
    <el-dialog v-model="detailVisible" title="流程图追踪" width="860px">
      <template v-if="detail">
        <el-alert
          :title="`实例 #${detail.instance.id} · ${detail.instance.bizType} · 状态 ${statusLabel(detail.instance.status)}`"
          type="info" show-icon class="flow-alert"
        />
        <div class="flow-chart">
          <div v-for="node in detail.nodes" :key="String(node.id)" class="flow-node">
            <div class="node-body">
              <strong>{{ String(node.nodeName ?? node.nodeCode ?? '节点') }}</strong>
              <span class="node-mode">{{ String(node.approvalMode ?? 'SEQUENTIAL') }}</span>
              <span class="node-owner" v-if="taskForNode(node.id)">
                处理人 {{ taskForNode(node.id)?.assigneeId }} · {{ statusLabel(taskForNode(node.id)?.status) }}
              </span>
              <span class="node-owner" v-else>未开始</span>
            </div>
          </div>
        </div>
        <el-divider>审批日志</el-divider>
        <el-table :data="detail.logs" size="small" max-height="240">
          <el-table-column prop="taskId" label="任务" width="90" />
          <el-table-column prop="action" label="动作" width="120" />
          <el-table-column prop="operatorId" label="操作人" width="100" />
          <el-table-column prop="comment" label="意见" min-width="200" />
          <el-table-column prop="createdAt" label="时间" width="180" />
        </el-table>
      </template>
      <template #footer><el-button @click="detailVisible = false">关闭</el-button></template>
    </el-dialog>
    <el-dialog v-model="visible" title="发起流程" width="520px">
      <el-form label-width="90px">
        <el-form-item label="业务类型"><el-input v-model="form.bizType" /></el-form-item>
        <el-form-item label="业务ID"><el-input-number v-model="form.bizId" :min="1" /></el-form-item>
        <el-form-item label="业务单号"><el-input v-model="form.bizNo" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">发起</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; margin-bottom: 16px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; align-items: center; }
.panel-title { margin-right: auto; }
.metric-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 16px; }
.metric-card { padding: 12px; background: #f7f8fa; border-radius: 8px; }
.metric-card span { display: block; color: #646a73; font-size: 12px; }
.metric-card strong { display: block; margin-top: 6px; font-size: 18px; }
.flow-alert { margin-bottom: 16px; }
.flow-chart { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.flow-node { display: flex; align-items: center; }
.flow-node:not(:last-child)::after { content: '→'; margin: 0 4px; color: #909399; }
.node-body { display: flex; flex-direction: column; gap: 4px; padding: 10px 14px; background: #f4f6f9; border: 1px solid #dcdfe6; border-radius: 6px; min-width: 130px; }
.node-mode { font-size: 12px; color: #409eff; }
.node-owner { font-size: 12px; color: #606266; }
</style>
