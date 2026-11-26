/**
 * 项目与人事运营增强规则引擎（纯函数）：看板分组、甘特时间轴、工时校验、里程碑、招聘管道、Offer 审批、人才库、车队调度、提醒归集。
 */

/* ------------------------------------------------------------------ 看板 */

export interface KanbanTask {
  id: number
  taskName: string
  status: string
  assigneeId?: number | null
  dueDate?: string | null
}

export const DEFAULT_KANBAN_COLUMNS = ['TODO', 'DOING', 'DONE']

/** 看板分组：按状态分列并保留列顺序，未知状态归入「其他」列 */
export function buildKanban(
  tasks: KanbanTask[],
  columns: string[] = DEFAULT_KANBAN_COLUMNS
): Array<{ status: string; count: number; tasks: KanbanTask[] }> {
  const result = columns.map((status) => ({ status, count: 0, tasks: [] as KanbanTask[] }))
  const others: KanbanTask[] = []
  for (const task of tasks ?? []) {
    const column = result.find((item) => item.status === task.status)
    if (column) {
      column.tasks.push(task)
      column.count += 1
    } else {
      others.push(task)
    }
  }
  if (others.length) result.push({ status: 'OTHER', count: others.length, tasks: others })
  return result
}

/* ------------------------------------------------------------------ 甘特 */

export interface GanttTask {
  id: number
  taskName: string
  status: string
  startDate?: string | null
  dueDate?: string | null
}

export interface GanttMilestone {
  id: number
  milestoneName: string
  planDate?: string | null
  actualDate?: string | null
  status: string
}

export interface GanttResult {
  start: string | null
  end: string | null
  totalDays: number
  items: Array<{
    id: number
    name: string
    status: string
    start: string | null
    end: string | null
    offsetDays: number
    durationDays: number
    progress: number
    overdue: boolean
  }>
  milestones: Array<{
    id: number
    name: string
    date: string | null
    status: string
    offsetDays: number
    completed: boolean
  }>
}

const DAY = 86400000

function toTime(value?: string | null): number | null {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function toDateText(time: number): string {
  return new Date(time).toISOString().slice(0, 10)
}

/** 甘特时间轴：计算每条任务的偏移天数、进度与延期标记 */
export function buildGantt(
  tasks: GanttTask[],
  milestones: GanttMilestone[] = [],
  project?: { startDate?: string | null; endDate?: string | null } | null,
  at: Date = new Date()
): GanttResult {
  const points: number[] = []
  for (const task of tasks ?? []) {
    const start = toTime(task.startDate)
    const end = toTime(task.dueDate)
    if (start !== null) points.push(start)
    if (end !== null) points.push(end)
  }
  for (const milestone of milestones ?? []) {
    const planned = toTime(milestone.planDate)
    const actual = toTime(milestone.actualDate)
    if (planned !== null) points.push(planned)
    if (actual !== null) points.push(actual)
  }
  const projectStart = toTime(project?.startDate)
  const projectEnd = toTime(project?.endDate)
  if (projectStart !== null) points.push(projectStart)
  if (projectEnd !== null) points.push(projectEnd)

  const base = points.length ? Math.min(...points) : null
  const last = points.length ? Math.max(...points) : null
  const end = last ?? base
  const totalDays = base !== null && end !== null ? Math.max(1, Math.ceil((end - base) / DAY) + 1) : 0

  const offset = (time: number | null): number => (base !== null && time !== null ? Math.floor((time - base) / DAY) : 0)

  const items = (tasks ?? []).map((task) => {
    const start = toTime(task.startDate)
    const endTime = toTime(task.dueDate)
    const duration = start !== null && endTime !== null ? Math.max(1, Math.ceil((endTime - start) / DAY) + 1) : 1
    const progress = task.status === 'DONE' ? 100 : task.status === 'DOING' ? 50 : 0
    return {
      id: task.id,
      name: task.taskName,
      status: task.status,
      start: start !== null ? toDateText(start) : null,
      end: endTime !== null ? toDateText(endTime) : null,
      offsetDays: offset(start ?? endTime),
      durationDays: duration,
      progress,
      overdue: endTime !== null && endTime < at.getTime() && task.status !== 'DONE'
    }
  })

  const milestoneItems = (milestones ?? []).map((milestone) => {
    const planned = toTime(milestone.planDate)
    const actual = toTime(milestone.actualDate)
    const reference = actual ?? planned
    return {
      id: milestone.id,
      name: milestone.milestoneName,
      date: reference !== null ? toDateText(reference) : null,
      status: milestone.status,
      offsetDays: offset(reference),
      completed: milestone.status === 'DONE'
    }
  })

  return {
    start: base !== null ? toDateText(base) : null,
    end: end !== null ? toDateText(end) : null,
    totalDays,
    items,
    milestones: milestoneItems
  }
}

/* ------------------------------------------------------------------ 工时 */

export interface WorklogCheck {
  ok: boolean
  reason: string | null
  totalHours: number
}

/** 工时校验：单次不超过 24 小时、同任务当日累计不超过 24 小时 */
export function evaluateWorklog(
  existing: Array<{ workDate: string; hours: string | number }>,
  workDate: string,
  hours: string | number,
  maxDailyHours = 24
): WorklogCheck {
  const value = Number(hours)
  if (!Number.isFinite(value) || value <= 0) return { ok: false, reason: '工时必须大于零', totalHours: 0 }
  if (value > maxDailyHours) return { ok: false, reason: `单日工时不得超过 ${maxDailyHours} 小时`, totalHours: 0 }
  const sameDay = existing
    .filter((item) => item.workDate === workDate)
    .reduce((sum, item) => sum + (Number(item.hours) || 0), 0)
  const totalHours = Number((sameDay + value).toFixed(2))
  if (totalHours > maxDailyHours) {
    return { ok: false, reason: `当日累计工时 ${totalHours} 小时，超过 ${maxDailyHours} 小时上限`, totalHours }
  }
  return { ok: true, reason: null, totalHours }
}

/* ------------------------------------------------------------------ 里程碑 */

export interface MilestoneCheck {
  ok: boolean
  reason: string | null
  status: string
}

/** 里程碑状态推进：仅允许 计划中 → 进行中 → 已完成 */
export function evaluateMilestoneStatus(current: string, next: string): MilestoneCheck {
  const flow: Record<string, string[]> = {
    PLANNED: ['DOING', 'DONE', 'CANCELLED'],
    DOING: ['DONE', 'CANCELLED'],
    DONE: [],
    CANCELLED: []
  }
  const allowed = flow[current] ?? []
  if (current === next) return { ok: true, reason: null, status: current }
  if (!allowed.includes(next)) return { ok: false, reason: `里程碑当前状态 ${current} 不允许变更为 ${next}`, status: current }
  return { ok: true, reason: null, status: next }
}

/* ------------------------------------------------------------------ 招聘管道 */

export const CANDIDATE_STAGES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'ASSESSMENT', 'OFFER', 'HIRED', 'REJECTED', 'TALENT']

export const CANDIDATE_STAGE_FLOW: Record<string, string[]> = {
  APPLIED: ['SCREENING', 'REJECTED', 'TALENT'],
  SCREENING: ['INTERVIEW', 'REJECTED', 'TALENT'],
  INTERVIEW: ['ASSESSMENT', 'OFFER', 'REJECTED', 'TALENT'],
  ASSESSMENT: ['OFFER', 'REJECTED', 'TALENT'],
  OFFER: ['HIRED', 'REJECTED', 'TALENT'],
  HIRED: [],
  REJECTED: ['TALENT'],
  TALENT: ['APPLIED', 'SCREENING', 'INTERVIEW', 'REJECTED']
}

/** 候选人阶段流转校验：管道阶段需按既定顺序推进 */
export function evaluateCandidateStage(current: string, next: string): { ok: boolean; reason: string | null } {
  if (!CANDIDATE_STAGES.includes(next)) return { ok: false, reason: `未知招聘阶段 ${next}` }
  if (current === next) return { ok: true, reason: null }
  const allowed = CANDIDATE_STAGE_FLOW[current] ?? []
  if (!allowed.includes(next)) {
    return { ok: false, reason: `候选人当前阶段 ${current} 不允许流转到 ${next}` }
  }
  return { ok: true, reason: null }
}

/** 面试反馈必填校验：进入面试结论阶段时必须填写反馈 */
export function evaluateInterviewFeedback(feedback?: string | null): { ok: boolean; reason: string | null } {
  const text = (feedback ?? '').trim()
  if (!text) return { ok: false, reason: '面试反馈为必填项，不能为空' }
  if (text.length < 5) return { ok: false, reason: '面试反馈内容过短，至少 5 个字符' }
  return { ok: true, reason: null }
}

/* ------------------------------------------------------------------ Offer 审批 */

export interface OfferCheck {
  ok: boolean
  reason: string | null
  status: string
}

/** Offer 审批：创建后进入 PENDING，通过/驳回仅允许 PENDING 状态操作 */
export function evaluateOfferTransition(status: string, action: 'APPROVE' | 'REJECT'): OfferCheck {
  if (status !== 'PENDING') return { ok: false, reason: `Offer 当前状态 ${status} 不允许审批`, status }
  if (action === 'APPROVE') return { ok: true, reason: null, status: 'APPROVED' }
  return { ok: true, reason: null, status: 'REJECTED' }
}

/* ------------------------------------------------------------------ 人才库 */

export interface TalentCheck {
  ok: boolean
  reason: string | null
  status: string
}

/** 人才库状态：入池 / 复用 / 淘汰 */
export function evaluateTalentAction(status: string, action: 'IN' | 'REUSE' | 'DISCARD'): TalentCheck {
  if (action === 'IN') {
    if (status === 'TALENT') return { ok: false, reason: '候选人已在人才库中', status }
    return { ok: true, reason: null, status: 'TALENT' }
  }
  if (status !== 'TALENT') return { ok: false, reason: '仅人才库中的候选人可执行该操作', status }
  if (action === 'REUSE') return { ok: true, reason: null, status: 'APPLIED' }
  return { ok: true, reason: null, status: 'DISCARDED' }
}

/* ------------------------------------------------------------------ 车队调度 */

export interface DispatchVehicle {
  id: number
  plateNo: string
  status: string
  driverId?: number | null
}

export interface DispatchWindow {
  vehicleId: number
  startTime: string | Date
  endTime: string | Date
  status: string
}

export interface DispatchResult {
  ok: boolean
  reason: string | null
  vehicleId: number | null
  conflicted: Array<{ vehicleId: number; startTime: string; endTime: string }>
}

/**
 * 车队调度：在可用车辆中挑选不冲突者（优先状态空闲、其次车牌序），并返回全部冲突车辆供人工确认。
 */
export function selectVehicleDispatch(
  vehicles: DispatchVehicle[],
  windows: DispatchWindow[],
  request: { startTime: string | Date; endTime: string | Date },
  options: { requireDriver?: boolean; allowBusy?: boolean } = {}
): DispatchResult {
  const start = new Date(request.startTime).getTime()
  const end = new Date(request.endTime).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { ok: false, reason: '用车起止时间不合法', vehicleId: null, conflicted: [] }
  }
  const conflicted: DispatchResult['conflicted'] = []
  const candidates: DispatchVehicle[] = []
  for (const vehicle of vehicles ?? []) {
    if (options.requireDriver && !vehicle.driverId) continue
    if (!options.allowBusy && vehicle.status !== 'IDLE') continue
    const overlap = (windows ?? []).filter(
      (item) =>
        item.vehicleId === vehicle.id &&
        item.status !== 'CANCELLED' &&
        new Date(item.startTime).getTime() < end &&
        new Date(item.endTime).getTime() > start
    )
    if (overlap.length) {
      conflicted.push({
        vehicleId: vehicle.id,
        startTime: String(overlap[0].startTime),
        endTime: String(overlap[0].endTime)
      })
      continue
    }
    candidates.push(vehicle)
  }
  if (!candidates.length) {
    return {
      ok: false,
      reason: conflicted.length ? '所选时段车辆均已占用，请调整时间或人工确认' : '没有可用车辆',
      vehicleId: null,
      conflicted
    }
  }
  candidates.sort((a, b) => a.plateNo.localeCompare(b.plateNo))
  return { ok: true, reason: null, vehicleId: candidates[0].id, conflicted }
}

/* ------------------------------------------------------------------ 提醒归集 */

export interface ReminderItem {
  type: string
  targetType: string
  targetId: number
  title: string
  dueDate: string | null
  days: number
  level: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface ReminderInput {
  type: string
  targetType: string
  targetId: number
  title: string
  dueDate?: string | null
  ownerId?: number | null
  thresholdDays?: number
}

/**
 * 提醒归集：按阈值天数筛出临期与逾期项，逾期等级最高。
 * 已完成（done/completed/cancelled 状态）不产生提醒。
 */
export function collectReminders(inputs: ReminderInput[], at: Date = new Date()): ReminderItem[] {
  const result: ReminderItem[] = []
  for (const item of inputs ?? []) {
    const due = item.dueDate ?? null
    if (!due) continue
    const target = new Date(due).getTime()
    if (!Number.isFinite(target)) continue
    const days = Math.ceil((target - at.getTime()) / DAY)
    const threshold = item.thresholdDays ?? 3
    if (days > threshold) continue
    const level: ReminderItem['level'] = days < 0 ? 'HIGH' : days <= 1 ? 'MEDIUM' : 'LOW'
    result.push({
      type: item.type,
      targetType: item.targetType,
      targetId: item.targetId,
      title: item.title,
      dueDate: due.slice(0, 10),
      days,
      level
    })
  }
  return result.sort((a, b) => a.days - b.days)
}
