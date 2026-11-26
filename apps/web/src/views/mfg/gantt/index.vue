<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createPlanTasks, deletePlanTask, fetchCenters, fetchPlanTasks, fetchWorkOrders, updatePlanTask,
  type ManufacturingQuery, type PlanTask, type WorkCenter, type WorkOrder
} from '@/api/manufacturing'
import {
  createChangeoverRule, disableChangeoverRule, fetchChangeoverLogs, fetchChangeoverRules, fetchGanttSchedule,
  lockPlanTask, reschedulePlanTask, type ChangeoverLog, type ChangeoverRule, type GanttTaskRow
} from '@/api/manufacturing-extension'

const activeTab = ref('gantt')
const DAY = 86400000
const LEAD_DAYS = 2
const DAY_OPTIONS = [7, 10, 14, 21]
const DAY_COUNT_KEY = 'leaierp:gantt:dayCount'

function readStoredDayCount(): number {
  try {
    const stored = Number(localStorage.getItem(DAY_COUNT_KEY))
    return DAY_OPTIONS.includes(stored) ? stored : 7
  } catch {
    return 7
  }
}

const dayCount = ref(readStoredDayCount())
const gantt = ref<{ rows: GanttTaskRow[]; centers: Array<{ workCenterId: number; centerName: string; centerCode: string; tasks: GanttTaskRow[] }>; conflictCount: number; changeoverTotal: number; ruleCount: number }>({
  rows: [], centers: [], conflictCount: 0, changeoverTotal: 0, ruleCount: 0
})
const rules = ref<ChangeoverRule[]>([])
const logs = ref<ChangeoverLog[]>([])
const loading = ref(false)
const draggingId = ref<number | null>(null)
const dragState = ref<{ id: number; originX: number; startAt: number; endAt: number } | null>(null)
const lastDragX = ref<number | null>(null)
const highlightId = ref<number | null>(null)

const rows = ref<PlanTask[]>([])
const total = ref(0)
const visible = ref(false)
const centers = ref<WorkCenter[]>([])
const workOrders = ref<WorkOrder[]>([])
const form = reactive({
  taskName: '',
  workOrderId: undefined as number | undefined,
  workCenterId: undefined as number | undefined,
  startAt: '',
  endAt: ''
})

const ruleForm = reactive({ workCenterId: undefined as number | undefined, fromProductId: undefined as number | undefined, toProductId: undefined as number | undefined, minutes: 30, remark: '' })
const ruleVisible = ref(false)

const keyword = ref('')
const centerFilter = ref<number | undefined>(undefined)
const onlyConflict = ref(false)
const detailVisible = ref(false)
const detailTaskId = ref<number | null>(null)
const detailForm = reactive({
  taskName: '',
  startAt: '',
  endAt: '',
  workCenterId: undefined as number | undefined,
  status: 'PLANNED',
  locked: false
})

const visibleCenters = computed(() => gantt.value.centers
  .filter((center) => centerFilter.value === undefined || center.workCenterId === centerFilter.value)
  .map((center) => ({
    ...center,
    tasks: center.tasks.filter((task) =>
      (!keyword.value || task.taskName.toLowerCase().includes(keyword.value.toLowerCase())) &&
      (!onlyConflict.value || task.conflict)
    )
  }))
  .filter((center) => center.tasks.length > 0 || (!keyword.value && !onlyConflict.value)))

const taskSpanDays = computed(() => {
  const times = gantt.value.rows
    .flatMap((row) => [new Date(row.startAt).getTime(), new Date(row.endAt).getTime()])
    .filter((value) => Number.isFinite(value))
  if (!times.length) return 0
  const first = new Date(Math.min(...times)).setHours(0, 0, 0, 0)
  const last = new Date(Math.max(...times)).setHours(0, 0, 0, 0)
  return Math.floor((last - first) / DAY) + 1
})

const autoDayCount = computed(() => {
  if (taskSpanDays.value > 14) return 21
  if (taskSpanDays.value > 10) return 14
  if (taskSpanDays.value > 7) return 10
  return 7
})

watch(dayCount, (value) => {
  const next = Math.max(value, autoDayCount.value)
  if (next !== value) {
    dayCount.value = next
    return
  }
  try { localStorage.setItem(DAY_COUNT_KEY, String(value)) } catch { /* ignore storage errors */ }
})

watch(autoDayCount, (needed) => {
  if (dayCount.value < needed) dayCount.value = needed
}, { immediate: true })

function toPickerTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}

/** 时间轴起点：在最早任务前预留缓冲，既有空间向前拖，也不会拖出日期范围 */
const rangeStart = computed(() => {
  const starts = gantt.value.rows.map((row) => new Date(row.startAt).getTime())
  const min = starts.length ? Math.min(...starts) : Date.now()
  return new Date(min).setHours(0, 0, 0, 0) - LEAD_DAYS * DAY
})

const timelineDays = computed(() => dayCount.value + LEAD_DAYS)

/** 时间轴列（按天） */
const days = computed(() => {
  const list: Array<{ date: string; label: string; week: string }> = []
  const base = rangeStart.value
  for (let i = 0; i < timelineDays.value; i += 1) {
    const date = new Date(base + i * DAY)
    list.push({
      date: date.toISOString().slice(0, 10),
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      week: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
    })
  }
  return list
})

function offsetPercent(time: number): number {
  return ((time - rangeStart.value) / (timelineDays.value * DAY)) * 100
}

function taskStyle(task: GanttTaskRow): Record<string, string> {
  const start = new Date(task.startAt).getTime()
  const end = new Date(task.endAt).getTime()
  const left = Math.max(offsetPercent(start), 0)
  const width = Math.max(offsetPercent(end) - left, 1.2)
  return { left: `${left}%`, width: `${width}%` }
}

function loadGantt(): Promise<void> {
  loading.value = true
  return fetchGanttSchedule({})
    .then((result) => {
      gantt.value = {
        rows: result.rows ?? [],
        centers: result.centers ?? [],
        conflictCount: result.conflictCount ?? 0,
        changeoverTotal: result.changeoverTotal ?? 0,
        ruleCount: result.ruleCount ?? 0
      }
    })
    .catch((cause) => { ElMessage.error(cause instanceof Error ? cause.message : '加载排程失败') })
    .finally(() => { loading.value = false })
}

function loadRules(): Promise<void> {
  return fetchChangeoverRules()
    .then((result) => { rules.value = result ?? [] })
    .catch((cause) => { ElMessage.error(cause instanceof Error ? cause.message : '加载换线规则失败') })
}

function loadLogs(): Promise<void> {
  return fetchChangeoverLogs({ page: 1, pageSize: 100 })
    .then((result) => { logs.value = result ?? [] })
    .catch((cause) => { ElMessage.error(cause instanceof Error ? cause.message : '加载换线记录失败') })
}

async function load(): Promise<void> {
  await loadGantt()
  await Promise.all([loadRules(), loadLogs()])
}

/* ------------------------------ 拖拽排产 ------------------------------ */

function onDragStart(task: GanttTaskRow, event: DragEvent): void {
  if (task.locked) {
    event.preventDefault()
    ElMessage.warning('排产任务已锁定，不可拖拽')
    return
  }
  draggingId.value = task.id
  dragState.value = {
    id: task.id,
    originX: event.clientX,
    startAt: new Date(task.startAt).getTime(),
    endAt: new Date(task.endAt).getTime()
  }
  lastDragX.value = event.clientX
  event.dataTransfer?.setData('text/plain', String(task.id))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDragOver(event: DragEvent): void {
  lastDragX.value = event.clientX
}

function onDragEnd(): void {
  draggingId.value = null
  dragState.value = null
  lastDragX.value = null
}

async function onDrop(event: DragEvent): Promise<void> {
  event.preventDefault()
  const state = dragState.value
  const id = state?.id ?? draggingId.value ?? Number(event.dataTransfer?.getData('text/plain'))
  if (!id) {
    onDragEnd()
    return
  }
  const task = gantt.value.rows.find((item) => item.id === id)
  if (!task) {
    onDragEnd()
    return
  }
  const row = event.currentTarget as HTMLElement
  const track = row.classList.contains('gantt-track')
    ? row
    : row.querySelector<HTMLElement>('.gantt-track')
  if (!track) {
    onDragEnd()
    return
  }
  const rect = track.getBoundingClientRect()
  const clientX = event.clientX || lastDragX.value
  if (!rect.width || clientX == null || !state || !Number.isFinite(state.startAt) || !Number.isFinite(state.endAt)) {
    onDragEnd()
    return
  }
  // 按指针位移改期，保留抓取点在任务条内的位置；结果限制在当前时间轴日期范围内
  const step = 30 * 60000
  const deltaMs = ((clientX - state.originX) / rect.width) * timelineDays.value * DAY
  const duration = Math.max(state.endAt - state.startAt, step)
  const timelineStart = rangeStart.value
  const maxStart = Math.max(timelineStart, timelineStart + timelineDays.value * DAY - duration)
  const rawStart = state.startAt + deltaMs
  const clampedStart = Math.min(Math.max(rawStart, timelineStart), maxStart)
  const startMs = Math.round(clampedStart / step) * step
  const startAt = toPickerTime(new Date(startMs))
  const endAt = toPickerTime(new Date(startMs + duration))
  onDragEnd()
  await applyMove(task, startAt, false, endAt)
}

async function applyMove(
  task: GanttTaskRow,
  startAt: string,
  ignoreConflict = false,
  endAt?: string
): Promise<void> {
  try {
    const result = await reschedulePlanTask(task.id, {
      startAt,
      ...(endAt ? { endAt } : {}),
      ignoreConflict
    })
    if (!result.applied) {
      ElMessage.warning(result.message ?? '存在时间冲突')
      try {
        await ElMessageBox.confirm(
          `改期后与 ${result.conflicts?.length ?? 0} 个任务时间重叠，是否强制改期？`,
          '冲突提示',
          { type: 'warning' }
        )
      } catch {
        return
      }
      await applyMove(task, startAt, true, endAt)
      return
    }
    highlightId.value = task.id
    ElMessage.success(`已改期，换线累加 ${result.changeoverMinutes ?? 0} 分钟`)
    await loadGantt()
    await loadLogs()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '拖拽排产失败')
  }
}

async function toggleLock(task: GanttTaskRow): Promise<void> {
  try {
    await lockPlanTask(task.id, { lock: !task.locked, reason: task.locked ? '解锁排产' : '锁定排产' })
    ElMessage.success(task.locked ? '已解锁' : '已锁定')
    await loadGantt()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '操作失败')
  }
}

/* ------------------------------ 任务详情与维护 ------------------------------ */

function openDetail(task: GanttTaskRow): void {
  detailTaskId.value = task.id
  Object.assign(detailForm, {
    taskName: task.taskName,
    startAt: toPickerTime(task.startAt),
    endAt: toPickerTime(task.endAt),
    workCenterId: task.workCenterId && task.workCenterId > 0 ? task.workCenterId : undefined,
    status: task.status || 'PLANNED',
    locked: task.locked
  })
  detailVisible.value = true
}

function shiftDetail(minutes: number): void {
  const start = new Date(detailForm.startAt)
  const end = new Date(detailForm.endAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return
  detailForm.startAt = toPickerTime(new Date(start.getTime() + minutes * 60000))
  detailForm.endAt = toPickerTime(new Date(end.getTime() + minutes * 60000))
}

function changeDuration(minutes: number): void {
  const end = new Date(detailForm.endAt)
  if (Number.isNaN(end.getTime())) return
  const next = end.getTime() + minutes * 60000
  if (next <= new Date(detailForm.startAt).getTime()) {
    ElMessage.warning('结束时间不能早于开始时间')
    return
  }
  detailForm.endAt = toPickerTime(new Date(next))
}

async function saveDetail(): Promise<void> {
  if (!detailTaskId.value) return
  if (!detailForm.taskName.trim()) {
    ElMessage.warning('任务名称不能为空')
    return
  }
  if (!detailForm.startAt || !detailForm.endAt || new Date(detailForm.endAt) <= new Date(detailForm.startAt)) {
    ElMessage.warning('结束时间必须晚于开始时间')
    return
  }
  try {
    const task = gantt.value.rows.find((item) => item.id === detailTaskId.value) as GanttTaskRow
    await updatePlanTask(detailTaskId.value, {
      taskName: detailForm.taskName,
      status: detailForm.status,
      workCenterId: detailForm.workCenterId ?? 0
    })
    await applyMove(task, detailForm.startAt, false, detailForm.endAt)
    detailVisible.value = false
    await loadGantt()
    await loadTasks()
    await loadLogs()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function removeTask(task: GanttTaskRow): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认删除排产任务「${task.taskName}」？`, '删除确认', { type: 'warning' })
    await deletePlanTask(task.id)
    if (detailTaskId.value === task.id) detailVisible.value = false
    ElMessage.success('排产任务已删除')
    await Promise.all([loadGantt(), loadTasks(), loadLogs()])
  } catch (cause) {
    if (cause !== 'cancel' && cause !== 'close') {
      ElMessage.error(cause instanceof Error ? cause.message : '删除失败')
    }
  }
}

async function toggleDetailLock(): Promise<void> {
  const task = gantt.value.rows.find((item) => item.id === detailTaskId.value)
  if (!task) return
  await toggleLock(task)
  detailForm.locked = !detailForm.locked
}

async function removeDetailTask(): Promise<void> {
  const task = gantt.value.rows.find((item) => item.id === detailTaskId.value)
  if (task) await removeTask(task)
}

/* ------------------------------ 换线规则 ------------------------------ */

function openRule(): void {
  Object.assign(ruleForm, { workCenterId: undefined, fromProductId: undefined, toProductId: undefined, minutes: 30, remark: '' })
  ruleVisible.value = true
}

async function saveRule(): Promise<void> {
  try {
    await createChangeoverRule({
      workCenterId: ruleForm.workCenterId,
      fromProductId: ruleForm.fromProductId,
      toProductId: ruleForm.toProductId,
      minutes: ruleForm.minutes,
      remark: ruleForm.remark
    })
    ruleVisible.value = false
    ElMessage.success('换线规则已保存')
    await loadRules()
    await loadGantt()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

async function disableRule(rule: ChangeoverRule): Promise<void> {
  try {
    await disableChangeoverRule(rule.id)
    ElMessage.success('换线规则已停用')
    await loadRules()
    await loadGantt()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '停用失败')
  }
}

/* ------------------------------ 原有排产任务 ------------------------------ */

async function loadTasks(): Promise<void> {
  const query: ManufacturingQuery = { page: 1, pageSize: 100, keyword: '' }
  const result = await fetchPlanTasks(query)
  rows.value = result.list
  total.value = result.total
}

async function loadOptions(): Promise<void> {
  const query: ManufacturingQuery = { page: 1, pageSize: 200, keyword: '' }
  const [centerResult, orderResult] = await Promise.all([fetchCenters(query), fetchWorkOrders(query)])
  centers.value = centerResult.list
  workOrders.value = orderResult.list
}

function openAdd(): void {
  Object.assign(form, { taskName: '', workOrderId: undefined, workCenterId: undefined, startAt: '', endAt: '' })
  visible.value = true
}

async function save(): Promise<void> {
  try {
    const payload = {
      taskName: form.taskName,
      startAt: form.startAt,
      endAt: form.endAt,
      ...(form.workOrderId ? { workOrderId: form.workOrderId } : {}),
      ...(form.workCenterId ? { workCenterId: form.workCenterId } : {})
    }
    await createPlanTasks({ tasks: [payload] })
    visible.value = false
    ElMessage.success('排产任务已创建')
    await Promise.all([loadTasks(), loadGantt()])
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}

async function setStatus(row: unknown, status: string): Promise<void> {
  const task = row as PlanTask
  try { await updatePlanTask(task.id, { status }); ElMessage.success('状态已更新'); await loadGantt() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '更新失败') }
}

function openDetailFromList(row: PlanTask): void {
  const view = gantt.value.rows.find((item) => item.id === row.id) ?? {
    id: row.id,
    taskName: row.taskName,
    workCenterId: row.workCenterId,
    workOrderId: row.workOrderId,
    productId: null,
    startAt: row.startAt,
    endAt: row.endAt,
    changeoverMinutes: 0,
    conflict: false,
    locked: false,
    status: row.status
  }
  openDetail(view)
}

async function removePlanRow(row: PlanTask): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认删除排产任务「${row.taskName}」？`, '删除确认', { type: 'warning' })
    await deletePlanTask(row.id)
    ElMessage.success('排产任务已删除')
    await Promise.all([loadGantt(), loadTasks()])
  } catch (cause) {
    if (cause !== 'cancel' && cause !== 'close') {
      ElMessage.error(cause instanceof Error ? cause.message : '删除失败')
    }
  }
}

onMounted(() => {
  void load()
  void loadTasks()
  void loadOptions()
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>排产甘特与换线</h2>
      <p>拖拽任务条即可改期，系统自动累加换线时间、级联顺延后续任务并提示冲突。</p>
    </header>

    <el-tabs v-model="activeTab" type="card">
      <el-tab-pane label="甘特排程" name="gantt">
        <article class="panel">
          <div class="toolbar">
            <el-button v-perm="'mfg:plan:create'" type="primary" @click="openAdd">新增排产</el-button>
            <el-button @click="load">刷新</el-button>
            <el-select v-model="dayCount" style="width: 130px">
              <el-option :value="7" label="显示 7 天" />
              <el-option :value="10" label="显示 10 天" />
              <el-option :value="14" label="显示 14 天" />
              <el-option :value="21" label="显示 21 天" />
            </el-select>
            <el-input v-model="keyword" clearable placeholder="搜索任务名称" style="width: 180px" />
            <el-select v-model="centerFilter" clearable placeholder="全部工作中心" style="width: 160px">
              <el-option v-for="center in centers" :key="center.id" :label="center.centerName" :value="center.id" />
              <el-option :value="0" label="未分配" />
            </el-select>
            <el-checkbox v-model="onlyConflict">仅看冲突</el-checkbox>
            <el-tag type="warning">冲突 {{ gantt.conflictCount }}</el-tag>
            <el-tag type="info">换线合计 {{ gantt.changeoverTotal }} 分钟</el-tag>
            <el-tag>换线规则 {{ gantt.ruleCount }} 条</el-tag>
          </div>

          <div v-loading="loading" class="gantt">
            <div class="gantt-head">
              <div class="gantt-label">工作中心</div>
              <div class="gantt-days">
                <div v-for="day in days" :key="day.date" class="gantt-day">
                  <span>{{ day.label }}</span>
                  <small>{{ day.week }}</small>
                </div>
              </div>
            </div>
            <div
              v-for="center in visibleCenters"
              :key="center.workCenterId"
              class="gantt-row"
              @dragover.prevent="onDragOver($event)"
              @drop="onDrop($event)"
            >
              <div class="gantt-label">
                <strong>{{ center.centerName }}</strong>
                <small>{{ center.centerCode }}</small>
              </div>
              <div class="gantt-track">
                <div v-for="day in days" :key="day.date" class="gantt-cell" />
                <div
                  v-for="task in center.tasks"
                  :key="task.id"
                  class="gantt-bar"
                  :class="{ conflict: task.conflict, locked: task.locked, dragging: draggingId === task.id, highlight: highlightId === task.id }"
                  :style="taskStyle(task)"
                  draggable="true"
                  @dragstart="onDragStart(task, $event)"
                  @dragend="onDragEnd"
                  @click="openDetail(task)"
                  @contextmenu.prevent="openDetail(task)"
                  @dblclick.stop="toggleLock(task)"
                >
                  <span class="bar-name">{{ task.taskName }}</span>
                  <span v-if="task.changeoverMinutes > 0" class="bar-tag">换线 {{ task.changeoverMinutes }}′</span>
                  <span v-if="task.locked" class="bar-tag lock">锁定</span>
                  <span class="bar-actions">
                    <span title="编辑任务" @click.stop="openDetail(task)">✎</span>
                    <span title="删除任务" @click.stop="removeTask(task)">×</span>
                  </span>
                </div>
              </div>
            </div>
            <el-empty v-if="!visibleCenters.length" description="暂无匹配的排产数据" />
          </div>
          <p class="tip">提示：按住任务条任意位置左右拖动即可提前或顺延，时间轴左侧预留 2 天缓冲，拖动结果不会超出当前日期范围；单击任务条打开详情编辑时间/工作中心/状态；双击任务条锁定或解锁；任务条右侧可快捷编辑与删除。</p>
        </article>
      </el-tab-pane>

      <el-tab-pane label="换线规则" name="rules">
        <article class="panel">
          <div class="toolbar">
            <el-button v-perm="'mfg:changeover:manage'" type="primary" @click="openRule">新增换线规则</el-button>
            <el-button @click="loadRules">刷新</el-button>
          </div>
          <el-table :data="rules" size="small">
            <el-table-column prop="workCenterId" label="工作中心" width="110">
              <template #default="{ row }">{{ row.workCenterId ?? '通用' }}</template>
            </el-table-column>
            <el-table-column prop="fromProductId" label="前产品" width="110">
              <template #default="{ row }">{{ row.fromProductId ?? '通用' }}</template>
            </el-table-column>
            <el-table-column prop="toProductId" label="后产品" width="110">
              <template #default="{ row }">{{ row.toProductId ?? '通用' }}</template>
            </el-table-column>
            <el-table-column prop="minutes" label="换线(分钟)" width="110" />
            <el-table-column prop="remark" label="备注" min-width="160" />
            <el-table-column prop="status" label="状态" width="100" />
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button v-if="row.status === 'ACTIVE'" link type="danger" v-perm="'mfg:changeover:manage'" @click="disableRule(row)">停用</el-button>
              </template>
            </el-table-column>
          </el-table>
        </article>
      </el-tab-pane>

      <el-tab-pane label="换线记录" name="logs">
        <article class="panel">
          <div class="toolbar"><el-button @click="loadLogs">刷新</el-button></div>
          <el-table :data="logs" size="small">
            <el-table-column prop="planTaskId" label="排产任务" width="100" />
            <el-table-column prop="workCenterId" label="工作中心" width="100" />
            <el-table-column prop="fromProductId" label="前产品" width="100" />
            <el-table-column prop="toProductId" label="后产品" width="100" />
            <el-table-column prop="minutes" label="耗时(分钟)" width="110" />
            <el-table-column prop="startAt" label="开始" width="170" />
            <el-table-column prop="endAt" label="结束" width="170" />
            <el-table-column prop="source" label="来源" width="90" />
            <el-table-column prop="status" label="状态" width="90" />
          </el-table>
        </article>
      </el-tab-pane>

      <el-tab-pane label="排产任务" name="tasks">
        <article class="panel">
          <div class="toolbar"><el-button @click="loadTasks">刷新</el-button></div>
          <el-table :data="rows" row-key="id" size="small">
            <el-table-column prop="taskName" label="任务" min-width="180" />
            <el-table-column prop="workOrderId" label="工单ID" width="100" />
            <el-table-column prop="workCenterId" label="工作中心" width="110" />
            <el-table-column prop="startAt" label="开始时间" width="180" />
            <el-table-column prop="endAt" label="结束时间" width="180" />
            <el-table-column prop="status" label="状态" width="110" />
            <el-table-column label="操作" width="220">
              <template #default="{ row }">
                <el-button link type="primary" @click="openDetailFromList(row)">编辑</el-button>
                <el-button link type="primary" @click="setStatus(row, 'RUNNING')">开工</el-button>
                <el-button link type="success" @click="setStatus(row, 'DONE')">完成</el-button>
                <el-button link type="danger" @click="removePlanRow(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination background layout="total, prev, pager, next" :total="total" :page-size="100" />
        </article>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="visible" title="新增排产任务" width="560px">
      <el-form label-width="90px">
        <el-form-item label="任务名称"><el-input v-model="form.taskName" /></el-form-item>
        <el-form-item label="工单">
          <el-select v-model="form.workOrderId" clearable placeholder="可不关联" style="width: 100%">
            <el-option v-for="order in workOrders" :key="order.id" :label="order.orderNo" :value="order.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="工作中心">
          <el-select v-model="form.workCenterId" clearable placeholder="未分配" style="width: 100%">
            <el-option v-for="center in centers" :key="center.id" :label="`${center.centerCode} ${center.centerName}`" :value="center.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始时间"><el-date-picker v-model="form.startAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="YYYY-MM-DDTHH:mm:ss"  /></el-form-item>
        <el-form-item label="结束时间"><el-date-picker v-model="form.endAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" placeholder="YYYY-MM-DDTHH:mm:ss"  /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="ruleVisible" title="新增换线规则" width="520px">
      <el-form label-width="110px">
        <el-form-item label="工作中心"><el-input-number v-model="ruleForm.workCenterId" :min="1" placeholder="留空为通用" /></el-form-item>
        <el-form-item label="前产品"><el-input-number v-model="ruleForm.fromProductId" :min="1" placeholder="留空为通用" /></el-form-item>
        <el-form-item label="后产品"><el-input-number v-model="ruleForm.toProductId" :min="1" placeholder="留空为通用" /></el-form-item>
        <el-form-item label="换线耗时(分)"><el-input-number v-model="ruleForm.minutes" :min="0" :max="10080" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="ruleForm.remark" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="ruleVisible = false">取消</el-button><el-button type="primary" @click="saveRule">保存</el-button></template>
    </el-dialog>

    <el-drawer v-model="detailVisible" title="排产任务详情" size="440px">
      <el-form label-width="90px">
        <el-form-item label="任务名称"><el-input v-model="detailForm.taskName" /></el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker v-model="detailForm.startAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width: 100%" />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker v-model="detailForm.endAt" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss" style="width: 100%" />
        </el-form-item>
        <el-form-item label="工作中心">
          <el-select v-model="detailForm.workCenterId" clearable placeholder="未分配" style="width: 100%">
            <el-option v-for="center in centers" :key="center.id" :label="`${center.centerCode} ${center.centerName}`" :value="center.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="detailForm.status" style="width: 100%">
            <el-option label="已排产" value="PLANNED" />
            <el-option label="进行中" value="RUNNING" />
            <el-option label="已完成" value="DONE" />
            <el-option label="已取消" value="CANCELLED" />
          </el-select>
        </el-form-item>
      </el-form>

      <el-divider content-position="left">快捷时间调整</el-divider>
      <div class="detail-quick">
        <el-button size="small" @click="shiftDetail(-1440)">整体提前 1 天</el-button>
        <el-button size="small" @click="shiftDetail(1440)">整体顺延 1 天</el-button>
        <el-button size="small" @click="shiftDetail(-120)">整体提前 2 小时</el-button>
        <el-button size="small" @click="shiftDetail(120)">整体顺延 2 小时</el-button>
        <el-button size="small" @click="changeDuration(30)">时长 +30 分钟</el-button>
        <el-button size="small" @click="changeDuration(-30)">时长 -30 分钟</el-button>
      </div>
      <el-alert
        class="detail-alert"
        type="info"
        :closable="false"
        title="保存时将按新时间重新计算换线与冲突，并级联顺延同工作中心后续任务"
      />

      <template #footer>
        <div class="detail-footer">
          <el-button v-if="detailTaskId" type="danger" plain @click="removeDetailTask">删除</el-button>
          <el-button v-if="detailTaskId" @click="toggleDetailLock">{{ detailForm.locked ? '解锁' : '锁定' }}</el-button>
          <el-button @click="detailVisible = false">取消</el-button>
          <el-button type="primary" @click="saveDetail">保存修改</el-button>
        </div>
      </template>
    </el-drawer>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.tip { margin-top: 12px; color: #909399; font-size: 12px; }
.gantt { overflow-x: auto; }
.gantt-head, .gantt-row { display: flex; min-width: 900px; }
.gantt-label { width: 160px; flex: none; padding: 8px; border-right: 1px solid #ebeef5; border-bottom: 1px solid #ebeef5; }
.gantt-label strong { display: block; font-size: 13px; }
.gantt-label small { color: #909399; }
.gantt-days { display: flex; flex: 1; }
.gantt-day { flex: 1; text-align: center; padding: 6px 0; border-right: 1px solid #ebeef5; border-bottom: 1px solid #ebeef5; font-size: 12px; }
.gantt-day small { display: block; color: #909399; }
.gantt-track { position: relative; display: flex; flex: 1; height: 54px; }
.gantt-cell { flex: 1; border-right: 1px dashed #f0f2f5; border-bottom: 1px solid #ebeef5; }
.gantt-bar {
  position: absolute; top: 12px; height: 30px; display: flex; align-items: center; gap: 6px; padding: 0 8px;
  background: #409eff; color: #fff; border-radius: 4px; font-size: 12px; cursor: move; white-space: nowrap; overflow: hidden;
}
.gantt-bar.conflict { background: #f56c6c; }
.gantt-bar.locked { background: #909399; cursor: not-allowed; }
.gantt-bar.dragging { opacity: 0.6; }
.gantt-bar.highlight { box-shadow: 0 0 0 2px #e6a23c inset; }
.bar-name { overflow: hidden; text-overflow: ellipsis; }
.bar-tag { background: rgba(255, 255, 255, 0.85); color: #409eff; border-radius: 2px; padding: 0 4px; }
.bar-tag.lock { color: #606266; }
.bar-actions { display: none; gap: 2px; margin-left: auto; }
.gantt-bar:hover .bar-actions { display: flex; }
.bar-actions span { cursor: pointer; padding: 0 3px; border-radius: 2px; background: rgba(255,255,255,.85); color: #409eff; }
.bar-actions span:last-child { color: #f56c6c; }
.detail-quick { display: flex; flex-wrap: wrap; gap: 8px; }
.detail-alert { margin-top: 16px; }
.detail-footer { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
</style>
