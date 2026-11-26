<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchProjects, type CollabQuery, type Project } from '@/api/collaboration'
import {
  createMilestone,
  createProjectRisk,
  createWorklog,
  fetchMilestones,
  fetchProjectBoard,
  fetchProjectGantt,
  fetchProjectRisks,
  fetchReminders,
  fetchWorklogs,
  updateMilestone,
  updateProjectRisk,
  type Milestone,
  type ProjectBoardColumn,
  type ProjectGantt,
  type ProjectRisk,
  type ReminderItem,
  type Worklog
} from '@/api/project-ops'

const projects = ref<Project[]>([])
const projectId = ref<number | undefined>(undefined)
const columns = ref<ProjectBoardColumn[]>([])
const gantt = ref<ProjectGantt | null>(null)
const milestones = ref<Milestone[]>([])
const worklogs = ref<Worklog[]>([])
const risks = ref<ProjectRisk[]>([])
const reminders = ref<ReminderItem[]>([])
const loading = ref(false)

const milestoneForm = reactive({ milestoneName: '', planDate: '', ownerId: 0, remark: '' })
const worklogForm = reactive({ taskId: 0, workDate: '', hours: '8', content: '' })
const riskForm = reactive({ riskTitle: '', riskLevel: 'MEDIUM', probability: 3, impact: 3, ownerId: 0, mitigation: '' })

function fail(cause: unknown): void {
  ElMessage.error(cause instanceof Error ? cause.message : '操作失败')
}

async function loadProjects(): Promise<void> {
  try {
    const result = await fetchProjects({ page: 1, pageSize: 200 } as CollabQuery)
    projects.value = result.list
    if (!projectId.value && result.list.length) projectId.value = result.list[0].id
  } catch (cause) {
    fail(cause)
  }
}

async function loadBoard(): Promise<void> {
  if (!projectId.value) return
  loading.value = true
  try {
    const result = await fetchProjectBoard(projectId.value)
    columns.value = result.columns
  } catch (cause) {
    fail(cause)
  } finally {
    loading.value = false
  }
}

async function loadGantt(): Promise<void> {
  if (!projectId.value) return
  loading.value = true
  try {
    gantt.value = await fetchProjectGantt(projectId.value)
  } catch (cause) {
    fail(cause)
  } finally {
    loading.value = false
  }
}

async function loadMilestones(): Promise<void> {
  if (!projectId.value) return
  try {
    const result = await fetchMilestones({ page: 1, pageSize: 100, projectId: projectId.value })
    milestones.value = result.list
  } catch (cause) {
    fail(cause)
  }
}

async function loadWorklogs(): Promise<void> {
  try {
    const result = await fetchWorklogs({ page: 1, pageSize: 100 })
    worklogs.value = result.list
  } catch (cause) {
    fail(cause)
  }
}

async function loadRisks(): Promise<void> {
  if (!projectId.value) return
  try {
    const result = await fetchProjectRisks({ page: 1, pageSize: 100, projectId: projectId.value })
    risks.value = result.list
  } catch (cause) {
    fail(cause)
  }
}

async function loadReminders(): Promise<void> {
  try {
    reminders.value = await fetchReminders({ page: 1, pageSize: 100, thresholdDays: 7 })
  } catch (cause) {
    fail(cause)
  }
}

async function refresh(): Promise<void> {
  await Promise.all([loadBoard(), loadGantt(), loadMilestones(), loadWorklogs(), loadRisks(), loadReminders()])
}

async function saveMilestone(): Promise<void> {
  if (!projectId.value) {
    ElMessage.warning('请先选择项目')
    return
  }
  try {
    await createMilestone({
      projectId: projectId.value,
      milestoneName: milestoneForm.milestoneName,
      planDate: milestoneForm.planDate || undefined,
      ownerId: milestoneForm.ownerId || undefined,
      remark: milestoneForm.remark || undefined
    })
    ElMessage.success('里程碑已创建')
    milestoneForm.milestoneName = ''
    milestoneForm.planDate = ''
    milestoneForm.remark = ''
    await loadMilestones()
  } catch (cause) {
    fail(cause)
  }
}

async function advanceMilestone(row: Milestone): Promise<void> {
  const next = row.status === 'PLANNED' ? 'DOING' : row.status === 'DOING' ? 'DONE' : row.status
  try {
    await updateMilestone(row.id, { status: next })
    ElMessage.success('里程碑状态已更新')
    await loadMilestones()
  } catch (cause) {
    fail(cause)
  }
}

async function saveWorklog(): Promise<void> {
  try {
    await createWorklog({
      taskId: worklogForm.taskId,
      workDate: worklogForm.workDate || new Date().toISOString().slice(0, 10),
      hours: worklogForm.hours,
      content: worklogForm.content
    })
    ElMessage.success('工时已登记')
    worklogForm.content = ''
    await loadWorklogs()
  } catch (cause) {
    fail(cause)
  }
}

async function saveRisk(): Promise<void> {
  if (!projectId.value) {
    ElMessage.warning('请先选择项目')
    return
  }
  try {
    await createProjectRisk({
      projectId: projectId.value,
      riskTitle: riskForm.riskTitle,
      riskLevel: riskForm.riskLevel,
      probability: riskForm.probability,
      impact: riskForm.impact,
      ownerId: riskForm.ownerId || undefined,
      mitigation: riskForm.mitigation || undefined
    })
    ElMessage.success('风险已登记')
    riskForm.riskTitle = ''
    riskForm.mitigation = ''
    await loadRisks()
  } catch (cause) {
    fail(cause)
  }
}

async function closeRisk(row: ProjectRisk): Promise<void> {
  try {
    await updateProjectRisk(row.id, { status: 'CLOSED' })
    ElMessage.success('风险已关闭')
    await loadRisks()
  } catch (cause) {
    fail(cause)
  }
}

onMounted(async () => {
  await loadProjects()
  await refresh()
})
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>项目看板与甘特</h2>
      <p>任务看板、甘特时间轴、里程碑、工时记录、项目风险与到期提醒。</p>
    </header>

    <article class="panel">
      <div class="toolbar">
        <el-select v-model="projectId" placeholder="选择项目" style="width: 260px" @change="refresh">
          <el-option v-for="item in projects" :key="item.id" :label="`${item.projectCode} ${item.projectName}`" :value="item.id" />
        </el-select>
        <el-button @click="refresh">刷新</el-button>
      </div>

      <el-tabs>
        <el-tab-pane label="看板" name="board">
          <div v-loading="loading" class="kanban">
            <div v-for="column in columns" :key="column.status" class="kanban-column">
              <header>{{ column.status }}（{{ column.count }}）</header>
              <div v-for="task in column.tasks" :key="task.id" class="kanban-card">
                <div class="card-title">{{ task.taskName }}</div>
                <div class="card-meta">负责人 {{ task.assigneeId ?? '-' }} · 截止 {{ task.dueDate ?? '-' }}</div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="甘特" name="gantt">
          <div v-if="gantt" class="gantt">
            <div class="gantt-range">{{ gantt.start }} ~ {{ gantt.end }}（共 {{ gantt.totalDays }} 天）</div>
            <div v-for="item in gantt.items" :key="item.id" class="gantt-row">
              <div class="gantt-name">{{ item.name }}</div>
              <div class="gantt-track">
                <div
                  class="gantt-bar"
                  :class="{ overdue: item.overdue }"
                  :style="{ marginLeft: `${item.offsetDays * 12}px`, width: `${Math.max(item.durationDays * 12, 12)}px` }"
                >
                  {{ item.progress }}%
                </div>
              </div>
            </div>
            <div v-for="milestone in gantt.milestones" :key="milestone.id" class="gantt-row">
              <div class="gantt-name">◆ {{ milestone.name }}</div>
              <div class="gantt-track">
                <div class="gantt-milestone" :style="{ marginLeft: `${milestone.offsetDays * 12}px` }">{{ milestone.date }}</div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="里程碑" name="milestone">
          <el-form inline>
            <el-form-item label="名称"><el-input v-model="milestoneForm.milestoneName" style="width: 180px" /></el-form-item>
            <el-form-item label="计划日期"><el-date-picker v-model="milestoneForm.planDate" type="date" value-format="YYYY-MM-DD" style="width: 140px" placeholder="YYYY-MM-DD"  /></el-form-item>
            <el-form-item label="负责人"><el-input-number v-model="milestoneForm.ownerId" :min="0" /></el-form-item>
            <el-form-item><el-button type="primary" v-perm="'oa:project:create'" @click="saveMilestone">新增里程碑</el-button></el-form-item>
          </el-form>
          <el-table :data="milestones" size="small" row-key="id">
            <el-table-column prop="milestoneName" label="里程碑" min-width="200" />
            <el-table-column prop="planDate" label="计划日期" width="130" />
            <el-table-column prop="actualDate" label="实际日期" width="130" />
            <el-table-column prop="ownerId" label="负责人" width="100" />
            <el-table-column prop="status" label="状态" width="110" />
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button link type="primary" v-perm="'oa:project:create'" @click="advanceMilestone(row)">推进</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="工时" name="worklog">
          <el-form inline>
            <el-form-item label="任务ID"><el-input-number v-model="worklogForm.taskId" :min="1" /></el-form-item>
            <el-form-item label="日期"><el-date-picker v-model="worklogForm.workDate" type="date" value-format="YYYY-MM-DD" style="width: 140px" placeholder="YYYY-MM-DD"  /></el-form-item>
            <el-form-item label="小时"><el-input v-model="worklogForm.hours" style="width: 90px" /></el-form-item>
            <el-form-item label="内容"><el-input v-model="worklogForm.content" style="width: 220px" /></el-form-item>
            <el-form-item><el-button type="primary" v-perm="'oa:task:create'" @click="saveWorklog">登记工时</el-button></el-form-item>
          </el-form>
          <el-table :data="worklogs" size="small" row-key="id">
            <el-table-column prop="taskId" label="任务ID" width="100" />
            <el-table-column prop="userId" label="登记人" width="100" />
            <el-table-column prop="workDate" label="日期" width="130" />
            <el-table-column prop="hours" label="工时" width="90" />
            <el-table-column prop="content" label="工作内容" min-width="240" />
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="项目风险" name="risk">
          <el-form inline>
            <el-form-item label="风险描述"><el-input v-model="riskForm.riskTitle" style="width: 200px" /></el-form-item>
            <el-form-item label="等级">
              <el-select v-model="riskForm.riskLevel" style="width: 110px">
                <el-option label="低" value="LOW" />
                <el-option label="中" value="MEDIUM" />
                <el-option label="高" value="HIGH" />
              </el-select>
            </el-form-item>
            <el-form-item label="概率"><el-input-number v-model="riskForm.probability" :min="1" :max="5" /></el-form-item>
            <el-form-item label="影响"><el-input-number v-model="riskForm.impact" :min="1" :max="5" /></el-form-item>
            <el-form-item label="应对"><el-input v-model="riskForm.mitigation" style="width: 180px" /></el-form-item>
            <el-form-item><el-button type="primary" v-perm="'oa:project:create'" @click="saveRisk">登记风险</el-button></el-form-item>
          </el-form>
          <el-table :data="risks" size="small" row-key="id">
            <el-table-column prop="riskTitle" label="风险" min-width="200" />
            <el-table-column prop="riskLevel" label="等级" width="90" />
            <el-table-column prop="probability" label="概率" width="80" />
            <el-table-column prop="impact" label="影响" width="80" />
            <el-table-column prop="ownerId" label="责任人" width="90" />
            <el-table-column prop="status" label="状态" width="100" />
            <el-table-column prop="mitigation" label="应对措施" min-width="180" />
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button link type="primary" v-perm="'oa:project:create'" @click="closeRisk(row)">关闭</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="到期提醒" name="reminder">
          <el-table :data="reminders" size="small" row-key="targetId">
            <el-table-column prop="type" label="类型" width="130" />
            <el-table-column prop="title" label="标题" min-width="240" />
            <el-table-column prop="dueDate" label="截止" width="130" />
            <el-table-column prop="days" label="剩余天数" width="110" />
            <el-table-column prop="level" label="级别" width="90" />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </article>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
.kanban { display: flex; gap: 12px; overflow-x: auto; }
.kanban-column { min-width: 220px; background: #f5f7fa; border-radius: 6px; padding: 8px; }
.kanban-column header { font-weight: 600; margin-bottom: 8px; }
.kanban-card { background: #fff; border-radius: 4px; padding: 8px; margin-bottom: 8px; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06); }
.card-title { font-size: 14px; }
.card-meta { font-size: 12px; color: #909399; margin-top: 4px; }
.gantt-range { color: #909399; margin-bottom: 12px; }
.gantt-row { display: flex; align-items: center; margin-bottom: 6px; }
.gantt-name { width: 200px; font-size: 13px; }
</style>
