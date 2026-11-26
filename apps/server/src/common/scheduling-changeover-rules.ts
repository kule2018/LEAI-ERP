/**
 * 排产调度与换线规则（纯函数）
 *
 * 规范要求（第 6 章 生产制造）：
 * - 排产甘特：拖拽排产、冲突检测、换线、产能负荷、锁定任务
 * - 冲突需提示；锁定任务不可拖拽
 *
 * 本模块提供：
 * 1. 换线时间主数据匹配（工作中心 + 前产品 → 后产品）
 * 2. 甘特时间轴计算（相邻任务之间自动累加换线时间）
 * 3. 同工作中心时间重叠冲突检测
 * 4. 拖拽改期后的级联顺延
 */

/** 换线规则视图 */
export interface ChangeoverRuleView {
  id: number
  /** 工作中心（null 表示适用所有工作中心） */
  workCenterId: number | null
  /** 前产品（null 表示适用所有产品） */
  fromProductId: number | null
  /** 后产品（null 表示适用所有产品） */
  toProductId: number | null
  /** 换线分钟数 */
  minutes: number
}

/** 换线匹配上下文 */
export interface ChangeoverContext {
  workCenterId: number | null
  fromProductId: number | null
  toProductId: number | null
}

/** 默认换线时间（分钟）：无规则匹配时使用 */
export const DEFAULT_CHANGEOVER_MINUTES = 0

/**
 * 匹配换线时间：
 * - 命中「工作中心 + 前产品 + 后产品」优先级最高；
 * - 其次「工作中心 + 后产品」；再次「仅后产品」；最后全局通配规则。
 */
export function matchChangeoverMinutes(
  rules: ChangeoverRuleView[],
  context: ChangeoverContext,
  fallback: number = DEFAULT_CHANGEOVER_MINUTES
): number {
  const { workCenterId, fromProductId, toProductId } = context
  if (fromProductId !== null && toProductId !== null && fromProductId === toProductId) return 0
  let best: { score: number; minutes: number } | null = null
  for (const rule of rules) {
    let score = 0
    if (rule.workCenterId !== null && rule.workCenterId === workCenterId) score += 4
    else if (rule.workCenterId !== null) continue
    else score += 1
    if (rule.fromProductId !== null && rule.fromProductId === fromProductId) score += 2
    else if (rule.fromProductId !== null) continue
    else score += 1
    if (rule.toProductId !== null && rule.toProductId === toProductId) score += 2
    else if (rule.toProductId !== null) continue
    else score += 1
    if (!best || score > best.score) best = { score, minutes: Number(rule.minutes) || 0 }
  }
  if (!best) return fallback
  return best.minutes
}

/** 排产任务视图 */
export interface ScheduleTaskView {
  id: number
  taskName?: string | null
  workCenterId: number | null
  workOrderId: number | null
  productId: number | null
  startAt: Date | string
  endAt: Date | string
  locked: boolean
  status: string
}

/** 甘特行（含换线与冲突标记） */
export interface GanttTaskRow {
  id: number
  taskName: string
  workCenterId: number | null
  workOrderId: number | null
  productId: number | null
  startAt: Date
  endAt: Date
  /** 本任务开始前需等待的换线时间（分钟） */
  changeoverMinutes: number
  /** 与其它任务时间重叠 */
  conflict: boolean
  locked: boolean
  status: string
}

/** 时间戳 */
export function toTime(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime()
}

/**
 * 计算甘特时间轴：
 * - 同工作中心按开始时间排序；
 * - 相邻两个任务之间按换线规则插入换线时间（累加到后一个任务的结束时间）。
 */
export function computeGanttRows(
  tasks: ScheduleTaskView[],
  rules: ChangeoverRuleView[] = [],
  fallback: number = DEFAULT_CHANGEOVER_MINUTES
): GanttTaskRow[] {
  const sorted = [...tasks].sort((a, b) => toTime(a.startAt) - toTime(b.startAt))
  const conflictIds = new Set<number>()
  const overlaps = detectTaskOverlaps(sorted)
  for (const pair of overlaps) {
    conflictIds.add(pair.a)
    conflictIds.add(pair.b)
  }
  const lastByCenter = new Map<string, { productId: number | null; endAt: number }>()
  const rows: GanttTaskRow[] = []
  for (const task of sorted) {
    const key = task.workCenterId === null ? 'none' : String(task.workCenterId)
    const previous = lastByCenter.get(key)
    let changeoverMinutes = 0
    let startAt = toTime(task.startAt)
    let endAt = toTime(task.endAt)
    if (previous) {
      changeoverMinutes = matchChangeoverMinutes(
        rules,
        { workCenterId: task.workCenterId, fromProductId: previous.productId, toProductId: task.productId },
        fallback
      )
    }
    lastByCenter.set(key, { productId: task.productId, endAt: endAt })
    rows.push({
      id: task.id,
      taskName: task.taskName ?? `任务 ${task.id}`,
      workCenterId: task.workCenterId,
      workOrderId: task.workOrderId,
      productId: task.productId,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      changeoverMinutes,
      conflict: conflictIds.has(task.id),
      locked: task.locked,
      status: task.status
    })
  }
  return rows
}

/** 同工作中心时间重叠的任务对 */
export function detectTaskOverlaps(tasks: ScheduleTaskView[]): Array<{ a: number; b: number }> {
  const result: Array<{ a: number; b: number }> = []
  const byCenter = new Map<string, ScheduleTaskView[]>()
  for (const task of tasks) {
    const key = task.workCenterId === null ? 'none' : String(task.workCenterId)
    const list = byCenter.get(key) ?? []
    list.push(task)
    byCenter.set(key, list)
  }
  for (const list of byCenter.values()) {
    const sorted = [...list].sort((a, b) => toTime(a.startAt) - toTime(b.startAt))
    for (let i = 1; i < sorted.length; i += 1) {
      const previous = sorted[i - 1]
      const current = sorted[i]
      if (toTime(current.startAt) < toTime(previous.endAt)) {
        result.push({ a: previous.id, b: current.id })
      }
    }
  }
  return result
}

/** 拖拽改期后的级联顺延结果 */
export interface CascadeResult {
  /** 需要顺延的任务 */
  shifted: Array<{ id: number; startAt: Date; endAt: Date; deltaMinutes: number }>
  /** 顺延后仍存在的时间重叠 */
  conflicts: Array<{ a: number; b: number }>
}

/**
 * 拖拽改期级联顺延：
 * - 仅影响同一工作中心、开始时间在被移动任务之后的未锁定任务；
 * - 按时间顺序依次顺延，保持各自时长；
 * - 锁定任务不参与顺延（冲突交由提示处理）。
 */
export function cascadeAfterMove(
  tasks: ScheduleTaskView[],
  movedId: number,
  newStart: Date | string,
  newEnd: Date | string
): CascadeResult {
  const moved = tasks.find((item) => item.id === movedId)
  if (!moved) return { shifted: [], conflicts: [] }
  const movedStart = toTime(newStart)
  const movedEnd = toTime(newEnd)
  const oldStart = toTime(moved.startAt)
  const centerKey = moved.workCenterId === null ? 'none' : String(moved.workCenterId)
  const affected = tasks
    .filter((task) => task.id !== movedId)
    .filter((task) => (task.workCenterId === null ? 'none' : String(task.workCenterId)) === centerKey)
    .filter((task) => toTime(task.startAt) >= oldStart || toTime(task.endAt) > movedStart)
    .sort((a, b) => toTime(a.startAt) - toTime(b.startAt))

  const shifted: CascadeResult['shifted'] = []
  const virtualMap = new Map<number, ScheduleTaskView>(
    tasks.filter((task) => task.id !== movedId).map((task) => [task.id, { ...task }])
  )
  let cursor = movedEnd
  for (const task of affected) {
    if (task.locked) {
      cursor = Math.max(cursor, toTime(task.endAt))
      continue
    }
    const duration = toTime(task.endAt) - toTime(task.startAt)
    const earliest = cursor
    const currentStart = toTime(task.startAt)
    if (currentStart >= earliest) {
      cursor = currentStart + duration
      continue
    }
    const newStartAt = earliest
    const newEndAt = earliest + duration
    const deltaMinutes = Math.round((newStartAt - currentStart) / 60000)
    shifted.push({ id: task.id, startAt: new Date(newStartAt), endAt: new Date(newEndAt), deltaMinutes })
    virtualMap.set(task.id, {
      ...task,
      startAt: new Date(newStartAt),
      endAt: new Date(newEndAt)
    })
    cursor = newEndAt
  }
  virtualMap.set(movedId, { ...moved, startAt: new Date(movedStart), endAt: new Date(movedEnd) })
  return { shifted, conflicts: detectTaskOverlaps([...virtualMap.values()]) }
}
