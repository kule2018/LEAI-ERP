<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createFlowDefinition, fetchFlowDefinitionNodes, fetchFlowDefinitionVersions, fetchFlowDefinitions,
  updateFlowDefinition, type CollabQuery, type FlowDefinition, type FlowDefinitionVersion, type FormField
} from '@/api/collaboration'

interface NodeRow {
  nodeCode: string
  nodeName: string
  nodeType: string
  assigneeRule: string
  conditionExpr: string
  approvalMode: string
  timeoutHours: number
  sortNo: number
}

const rows = ref<FlowDefinition[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<CollabQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const editing = ref<FlowDefinition | null>(null)
const form = reactive({ code: '', flowName: '', bizType: '', remark: '' })
const nodes = ref<NodeRow[]>([])
const fields = ref<FormField[]>([])
const versionVisible = ref(false)
const versions = ref<FlowDefinitionVersion[]>([])
const diffBase = ref<number | null>(null)
const diffTarget = ref<number | null>(null)
const nodeDiff = ref<Array<{ change: string; target: string; detail: string }>>([])
const fieldDiff = ref<Array<{ change: string; target: string; detail: string }>>([])
let seq = 0

function emptyNode(sortNo: number): NodeRow {
  return { nodeCode: '', nodeName: '', nodeType: 'APPROVAL', assigneeRule: '', conditionExpr: '', approvalMode: 'SEQUENTIAL', timeoutHours: 24, sortNo }
}

const designMode = ref<'graph' | 'table'>('graph')
const selectedNodeIndex = ref(0)
const draggingNodeIndex = ref<number | null>(null)
const palette = [
  { key: 'approval', label: '审批节点', type: 'APPROVAL', mode: 'SEQUENTIAL', icon: '✓' },
  { key: 'countersign', label: '会签节点', type: 'COUNTERSIGN', mode: 'ALL', icon: '⊞' },
  { key: 'orsign', label: '或签节点', type: 'OR_SIGN', mode: 'ANY', icon: '◇' },
  { key: 'condition', label: '条件分支', type: 'CONDITION', mode: 'SEQUENTIAL', icon: '◆' },
  { key: 'cc', label: '抄送节点', type: 'CC', mode: 'SEQUENTIAL', icon: '↗' }
]
const selectedNode = computed(() => nodes.value[selectedNodeIndex.value] ?? null)

function normalizeSort(): void {
  nodes.value.forEach((node, index) => { node.sortNo = index + 1 })
}

function createNodeFromPalette(key: string): NodeRow {
  const item = palette.find((entry) => entry.key === key) ?? palette[0]
  const node = emptyNode(nodes.value.length + 1)
  Object.assign(node, {
    nodeCode: `NODE_${nodes.value.length + 1}`,
    nodeName: item.label,
    nodeType: item.type,
    approvalMode: item.mode
  })
  return node
}

function appendPaletteNode(key: string): void {
  nodes.value.push(createNodeFromPalette(key))
  selectedNodeIndex.value = nodes.value.length - 1
  normalizeSort()
}

function onPaletteDragStart(key: string, event: DragEvent): void {
  event.dataTransfer?.setData('text/plain', `palette:${key}`)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
}

function onNodeDragStart(index: number, event: DragEvent): void {
  draggingNodeIndex.value = index
  selectedNodeIndex.value = index
  event.dataTransfer?.setData('text/plain', String(index))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDragOver(event: DragEvent): void {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = draggingNodeIndex.value === null ? 'copy' : 'move'
}

function insertNodeAt(raw: string, index: number): void {
  if (raw.startsWith('palette:')) {
    const node = createNodeFromPalette(raw.slice(8))
    nodes.value.splice(index, 0, node)
    selectedNodeIndex.value = index
    normalizeSort()
    return
  }
  const from = Number(raw)
  if (!Number.isInteger(from) || from < 0 || from >= nodes.value.length || from === index) return
  const [node] = nodes.value.splice(from, 1)
  nodes.value.splice(index, 0, node)
  selectedNodeIndex.value = index
  normalizeSort()
}

function onNodeDrop(index: number, event: DragEvent): void {
  event.preventDefault()
  event.stopPropagation()
  const raw = event.dataTransfer?.getData('text/plain') ?? ''
  if (raw) insertNodeAt(raw, index)
  draggingNodeIndex.value = null
}

function onCanvasDrop(event: DragEvent): void {
  event.preventDefault()
  const raw = event.dataTransfer?.getData('text/plain') ?? ''
  if (raw) insertNodeAt(raw, nodes.value.length)
  draggingNodeIndex.value = null
}

function removeSelectedNode(): void {
  if (nodes.value.length <= 1 || selectedNodeIndex.value < 0) return
  nodes.value.splice(selectedNodeIndex.value, 1)
  selectedNodeIndex.value = Math.min(selectedNodeIndex.value, nodes.value.length - 1)
  normalizeSort()
}

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchFlowDefinitions(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}

function openAdd(): void {
  editing.value = null
  Object.assign(form, { code: '', flowName: '', bizType: '', remark: '' })
  nodes.value = [emptyNode(1)]
  selectedNodeIndex.value = 0
  designMode.value = 'graph'
  fields.value = []
  visible.value = true
}

async function openEdit(row: FlowDefinition): Promise<void> {
  editing.value = row
  Object.assign(form, { code: row.code, flowName: row.flowName, bizType: row.bizType, remark: '' })
  const nodeList = await fetchFlowDefinitionNodes(row.id)
  nodes.value = nodeList.map((item) => ({
    nodeCode: item.nodeCode,
    nodeName: item.nodeName,
    nodeType: item.nodeType,
    assigneeRule: item.assigneeRule ?? '',
    conditionExpr: item.conditionExpr ?? '',
    approvalMode: item.approvalMode,
    timeoutHours: item.timeoutHours ?? 24,
    sortNo: item.sortNo
  }))
  fields.value = (row.formSchema?.fields ?? []).map((item) => ({ ...item }))
  selectedNodeIndex.value = 0
  designMode.value = 'graph'
  visible.value = true
}

async function save(): Promise<void> {
  if (!form.code.trim() || !form.flowName.trim() || !form.bizType.trim()) {
    ElMessage.warning('编码、名称与业务类型不能为空')
    return
  }
  const payload = {
    ...form,
    nodes: nodes.value,
    formSchema: { fields: fields.value }
  }
  try {
    if (editing.value) {
      await updateFlowDefinition(editing.value.id, payload)
      ElMessage.success(`流程已更新至版本 ${editing.value.version + 1}`)
    } else {
      await createFlowDefinition(payload)
      ElMessage.success('流程已创建')
    }
    visible.value = false
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}

async function openVersions(row: FlowDefinition): Promise<void> {
  versions.value = await fetchFlowDefinitionVersions(row.id)
  diffBase.value = versions.value[1]?.version ?? versions.value[0]?.version ?? null
  diffTarget.value = versions.value[0]?.version ?? null
  computeDiff()
  versionVisible.value = true
}

/** 计算两个版本之间的节点与表单字段差异 */
function computeDiff(): void {
  const base = versions.value.find((item) => item.version === diffBase.value)
  const target = versions.value.find((item) => item.version === diffTarget.value)
  nodeDiff.value = []
  fieldDiff.value = []
  if (!base || !target) return
  const baseNodes = new Map<string, Record<string, unknown>>()
  for (const node of base.nodes ?? []) baseNodes.set(String(node.nodeCode ?? ''), node)
  const targetNodes = new Map<string, Record<string, unknown>>()
  for (const node of target.nodes ?? []) targetNodes.set(String(node.nodeCode ?? ''), node)
  const nodeFields = ['nodeName', 'nodeType', 'assigneeRule', 'conditionExpr', 'approvalMode', 'timeoutHours', 'sortNo']
  for (const [code, node] of targetNodes) {
    const old = baseNodes.get(code)
    if (!old) {
      nodeDiff.value.push({ change: '新增', target: String(node.nodeName ?? code), detail: describeNode(node) })
      continue
    }
    const changed = nodeFields.filter((key) => String(old[key] ?? '') !== String(node[key] ?? ''))
    if (changed.length) {
      nodeDiff.value.push({
        change: '修改',
        target: String(node.nodeName ?? code),
        detail: changed.map((key) => `${key}: ${old[key] ?? ''} → ${node[key] ?? ''}`).join('；')
      })
    }
  }
  for (const [code, node] of baseNodes) {
    if (!targetNodes.has(code)) {
      nodeDiff.value.push({ change: '删除', target: String(node.nodeName ?? code), detail: describeNode(node) })
    }
  }
  const baseFields = new Map<string, FormField>()
  for (const field of base.formSchema?.fields ?? []) baseFields.set(field.key, field)
  const targetFields = new Map<string, FormField>()
  for (const field of target.formSchema?.fields ?? []) targetFields.set(field.key, field)
  for (const [key, field] of targetFields) {
    const old = baseFields.get(key)
    if (!old) {
      fieldDiff.value.push({ change: '新增', target: `${field.label}(${key})`, detail: describeField(field) })
      continue
    }
    const changed = (['label', 'type', 'required', 'options'] as const).filter(
      (item) => String(old[item] ?? '') !== String(field[item] ?? '')
    )
    if (changed.length) {
      fieldDiff.value.push({
        change: '修改',
        target: `${field.label}(${key})`,
        detail: changed.map((item) => `${item}: ${old[item] ?? ''} → ${field[item] ?? ''}`).join('；')
      })
    }
  }
  for (const [key, field] of baseFields) {
    if (!targetFields.has(key)) {
      fieldDiff.value.push({ change: '删除', target: `${field.label}(${key})`, detail: describeField(field) })
    }
  }
}

function describeNode(node: Record<string, unknown>): string {
  return `审批人:${node.assigneeRule ?? '-'}；条件:${node.conditionExpr ?? '-'}；模式:${node.approvalMode ?? '-'}`
}

function describeField(field: FormField): string {
  return `类型:${field.type ?? '-'}${field.required ? '；必填' : ''}`
}

onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>流程定义</h2>
      <p>配置审批节点、条件分支、会签或签、表单字段与版本留痕。</p>
    </header>
    <article class="panel">
      <div class="toolbar">
        <el-button type="primary" v-perm="'flow:define:create'" @click="openAdd">新建流程</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="code" label="流程编码" width="150" />
        <el-table-column prop="flowName" label="流程名称" min-width="180" />
        <el-table-column prop="bizType" label="业务类型" width="150" />
        <el-table-column prop="version" label="版本" width="90" />
        <el-table-column label="表单字段" width="110">
          <template #default="{ row }">{{ row.formSchema?.fields?.length ?? 0 }} 个</template>
        </el-table-column>
        <el-table-column prop="isActive" label="启用" width="90" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'flow:define:update'" @click="openEdit(row)">编辑</el-button>
            <el-button link type="info" v-perm="'flow:define:view'" @click="openVersions(row)">版本</el-button>
          </template>
        </el-table-column>
      </el-table>
    </article>

    <el-dialog v-model="visible" :title="editing ? `编辑流程（当前版本 ${editing.version}）` : '新建流程'" width="980px" top="5vh">
      <el-form label-width="90px">
        <el-form-item label="编码"><el-input v-model="form.code" :disabled="!!editing" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.flowName" /></el-form-item>
        <el-form-item label="业务类型"><el-input v-model="form.bizType" /></el-form-item>
        <el-form-item v-if="editing" label="变更说明"><el-input v-model="form.remark" placeholder="记录本次修改原因" /></el-form-item>
      </el-form>

      <h4 class="block-title">审批节点</h4>
      <div class="design-bar">
        <el-radio-group v-model="designMode" size="small">
          <el-radio-button label="graph">图形设计</el-radio-button>
          <el-radio-button label="table">表格设计</el-radio-button>
        </el-radio-group>
        <span class="design-tip">从左侧拖入节点，拖动节点可调整顺序；单击节点编辑属性</span>
      </div>

      <template v-if="designMode === 'graph'">
        <div class="flow-designer">
          <div class="node-palette">
            <div
              v-for="item in palette"
              :key="item.key"
              class="palette-item"
              draggable="true"
              @dragstart="onPaletteDragStart(item.key, $event)"
              @dblclick="appendPaletteNode(item.key)"
            >
              <span class="palette-icon">{{ item.icon }}</span>
              <span>{{ item.label }}</span>
            </div>
          </div>

          <div class="flow-canvas" @dragover="onDragOver" @drop="onCanvasDrop">
            <template v-for="(node, index) in nodes" :key="index">
              <div
                class="flow-node"
                :class="{ active: selectedNodeIndex === index, dragging: draggingNodeIndex === index }"
                draggable="true"
                @dragstart="onNodeDragStart(index, $event)"
                @dragover="onDragOver"
                @drop="onNodeDrop(index, $event)"
                @click="selectedNodeIndex = index"
              >
                <div class="node-head">
                  <strong>{{ index + 1 }}. {{ node.nodeName || '未命名节点' }}</strong>
                  <small>{{ node.nodeType }}</small>
                </div>
                <div class="node-meta">{{ node.approvalMode }} · {{ node.timeoutHours }}h</div>
                <div v-if="node.conditionExpr" class="node-condition">{{ node.conditionExpr }}</div>
              </div>
              <div v-if="index < nodes.length - 1" class="flow-arrow">→</div>
            </template>
            <div v-if="!nodes.length" class="canvas-empty">拖动左侧节点到此处</div>
          </div>

          <div class="node-properties">
            <template v-if="selectedNode">
              <el-form label-width="76px" size="small">
                <el-form-item label="编码"><el-input v-model="selectedNode.nodeCode" /></el-form-item>
                <el-form-item label="名称"><el-input v-model="selectedNode.nodeName" /></el-form-item>
                <el-form-item label="类型">
                  <el-select v-model="selectedNode.nodeType">
                    <el-option v-for="item in palette" :key="item.key" :label="item.label" :value="item.type" />
                  </el-select>
                </el-form-item>
                <el-form-item label="审批模式">
                  <el-select v-model="selectedNode.approvalMode">
                    <el-option label="顺序" value="SEQUENTIAL" />
                    <el-option label="会签" value="ALL" />
                    <el-option label="或签" value="ANY" />
                  </el-select>
                </el-form-item>
                <el-form-item label="审批人"><el-input v-model="selectedNode.assigneeRule" placeholder="用户ID，多个用逗号分隔" /></el-form-item>
                <el-form-item label="条件"><el-input v-model="selectedNode.conditionExpr" placeholder="如 amount > 1000" /></el-form-item>
                <el-form-item label="超时(h)"><el-input-number v-model="selectedNode.timeoutHours" :min="1" :max="720" /></el-form-item>
              </el-form>
              <el-button link type="danger" @click="removeSelectedNode">删除节点</el-button>
            </template>
          </div>
        </div>
      </template>

      <template v-else>
        <el-table :data="nodes" size="small">
          <el-table-column label="节点编码" width="140"><template #default="{ row }"><el-input v-model="row.nodeCode" /></template></el-table-column>
          <el-table-column label="节点名称" width="160"><template #default="{ row }"><el-input v-model="row.nodeName" /></template></el-table-column>
          <el-table-column label="审批人规则" width="170"><template #default="{ row }"><el-input v-model="row.assigneeRule" placeholder="用户ID，多个用逗号分隔" /></template></el-table-column>
          <el-table-column label="条件表达式" width="180"><template #default="{ row }"><el-input v-model="row.conditionExpr" placeholder="如 amount > 1000" /></template></el-table-column>
          <el-table-column label="审批模式" width="120"><template #default="{ row }">
            <el-select v-model="row.approvalMode"><el-option label="顺序" value="SEQUENTIAL" /><el-option label="会签" value="ALL" /><el-option label="或签" value="ANY" /></el-select>
          </template></el-table-column>
          <el-table-column label="超时(h)" width="100"><template #default="{ row }"><el-input-number v-model="row.timeoutHours" :min="1" :max="720" controls-position="right" /></template></el-table-column>
          <el-table-column label="顺序" width="80"><template #default="{ row }"><el-input v-model="row.sortNo" /></template></el-table-column>
          <el-table-column width="70"><template #default="{ $index }"><el-button link type="danger" :disabled="nodes.length <= 1" @click="nodes.splice($index, 1)">删</el-button></template></el-table-column>
        </el-table>
        <el-button class="add-line" @click="nodes.push(emptyNode(nodes.length + 1))">加节点</el-button>
      </template>

      <h4 class="block-title">表单字段设计</h4>
      <el-table :data="fields" size="small">
        <el-table-column label="字段标识" width="160"><template #default="{ row }"><el-input v-model="row.key" /></template></el-table-column>
        <el-table-column label="标题" width="160"><template #default="{ row }"><el-input v-model="row.label" /></template></el-table-column>
        <el-table-column label="类型" width="140"><template #default="{ row }">
          <el-select v-model="row.type">
            <el-option label="文本" value="text" /><el-option label="数字" value="number" />
            <el-option label="日期" value="date" /><el-option label="下拉" value="select" /><el-option label="长文本" value="textarea" />
          </el-select>
        </template></el-table-column>
        <el-table-column label="必填" width="80"><template #default="{ row }"><el-switch v-model="row.required" /></template></el-table-column>
        <el-table-column label="选项" min-width="160"><template #default="{ row }"><el-input v-model="row.options" placeholder="下拉选项，逗号分隔" /></template></el-table-column>
        <el-table-column width="70"><template #default="{ $index }"><el-button link type="danger" @click="fields.splice($index, 1)">删</el-button></template></el-table-column>
      </el-table>
      <el-button class="add-line" @click="fields.push({ key: '', label: '', type: 'text', required: false })">加字段</el-button>

      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="save">{{ editing ? '保存新版本' : '创建' }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="versionVisible" title="版本时间线" width="760px">
      <el-table :data="versions" size="small" row-key="id">
        <el-table-column prop="version" label="版本" width="90" />
        <el-table-column prop="remark" label="变更说明" min-width="220" />
        <el-table-column label="节点数" width="90"><template #default="{ row }">{{ row.nodes?.length ?? 0 }}</template></el-table-column>
        <el-table-column label="表单字段" width="100"><template #default="{ row }">{{ row.formSchema?.fields?.length ?? 0 }}</template></el-table-column>
        <el-table-column prop="changedAt" label="变更时间" width="190" />
      </el-table>

      <h4 class="block-title">版本差异对比</h4>
      <div class="diff-bar">
        <el-select v-model="diffBase" placeholder="对比基线版本" style="width: 180px" @change="computeDiff">
          <el-option v-for="item in versions" :key="`base-${item.id}`" :label="`v${item.version}`" :value="item.version" />
        </el-select>
        <span class="arrow">→</span>
        <el-select v-model="diffTarget" placeholder="目标版本" style="width: 180px" @change="computeDiff">
          <el-option v-for="item in versions" :key="`target-${item.id}`" :label="`v${item.version}`" :value="item.version" />
        </el-select>
        <el-button @click="computeDiff">重新比对</el-button>
      </div>
      <el-table :data="nodeDiff" size="small" border class="diff-table">
        <el-table-column prop="change" label="节点变更" width="90" />
        <el-table-column prop="target" label="节点" width="180" />
        <el-table-column prop="detail" label="明细" min-width="260" />
      </el-table>
      <el-table :data="fieldDiff" size="small" border class="diff-table">
        <el-table-column prop="change" label="字段变更" width="90" />
        <el-table-column prop="target" label="字段" width="180" />
        <el-table-column prop="detail" label="明细" min-width="260" />
      </el-table>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.add-line { margin-top: 12px; }
.block-title { margin: 18px 0 10px; font-size: 14px; color: #1f2329; }
.design-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.design-tip { color: #909399; font-size: 12px; }
.flow-designer { display: grid; grid-template-columns: 120px 1fr 240px; gap: 12px; min-height: 260px; }
.node-palette { display: flex; flex-direction: column; gap: 8px; padding: 8px; background: #f5f7fa; border-radius: 6px; }
.palette-item { display: flex; align-items: center; gap: 6px; padding: 8px; background: #fff; border: 1px dashed #c0c4cc; border-radius: 4px; cursor: grab; font-size: 12px; }
.palette-item:active { cursor: grabbing; }
.palette-icon { color: #409eff; font-weight: 700; }
.flow-canvas { display: flex; flex-wrap: wrap; align-items: center; align-content: flex-start; gap: 8px; min-height: 240px; padding: 12px; border: 1px dashed #c0c4cc; border-radius: 6px; background: #fafafa; }
.flow-node { width: 140px; padding: 10px; background: #fff; border: 1px solid #dcdfe6; border-radius: 6px; cursor: move; box-shadow: 0 1px 4px rgba(0,0,0,.06); }
.flow-node.active { border-color: #409eff; box-shadow: 0 0 0 2px rgba(64,158,255,.2); }
.flow-node.dragging { opacity: .5; }
.node-head strong { display: block; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.node-head small { color: #909399; font-size: 11px; }
.node-meta { margin-top: 6px; color: #606266; font-size: 11px; }
.node-condition { margin-top: 4px; color: #e6a23c; font-size: 11px; }
.flow-arrow { color: #409eff; font-size: 18px; }
.canvas-empty { width: 100%; text-align: center; color: #c0c4cc; line-height: 200px; }
.node-properties { padding: 8px; background: #f5f7fa; border-radius: 6px; }
.diff-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.diff-bar .arrow { color: #909399; }
.diff-table { margin-bottom: 12px; }
</style>
