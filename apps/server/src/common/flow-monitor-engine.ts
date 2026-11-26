/**
 * 流程监控分析引擎（纯函数）：耗时分析、瓶颈节点排行、超时排行。
 * 用于「流程监控」页的只读分析能力，输出与存储解耦，便于单元测试。
 */

export interface FlowInstanceSample {
  id: number
  bizType: string
  bizNo: string | null
  status: string
  startedAt: Date | string
  finishedAt: Date | string | null
  currentNodeId: number | null
}

export interface FlowTaskSample {
  instanceId: number
  nodeId: number
  assigneeId: number
  status: string
  createdAt: Date | string
  actedAt: Date | string | null
  dueAt: Date | string | null
}

export interface FlowNodeSample {
  id: number
  nodeName: string
  timeoutHours: number | null
}

export interface FlowDurationSummary {
  total: number
  finished: number
  running: number
  avgDurationHours: number
  maxDurationHours: number
}

export interface FlowTypeDuration {
  bizType: string
  total: number
  finished: number
  avgDurationHours: number
  maxDurationHours: number
}

export interface FlowBottleneck {
  nodeId: number
  nodeName: string
  taskCount: number
  avgDurationHours: number
  maxDurationHours: number
}

export interface FlowTimeoutRow {
  instanceId: number
  bizType: string
  bizNo: string | null
  nodeId: number
  nodeName: string
  assigneeId: number
  waitHours: number
  timeoutHours: number
  overdueHours: number
}

const HOUR = 3600000

function toTime(value: Date | string | null | undefined): number | null {
  if (!value) return null
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(time) ? time : null
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** 实例耗时（小时）：已完结取 finishedAt - startedAt，进行中取 now - startedAt */
export function flowInstanceDurationHours(
  instance: FlowInstanceSample,
  now: number
): number | null {
  const started = toTime(instance.startedAt)
  if (started === null) return null
  const finished = toTime(instance.finishedAt)
  const end = finished ?? now
  if (end < started) return null
  return (end - started) / HOUR
}

/** 耗时分析：整体概览 + 按业务类型的耗时分布 */
export function analyzeFlowDuration(
  instances: FlowInstanceSample[],
  now: number = Date.now()
): { summary: FlowDurationSummary; byType: FlowTypeDuration[] } {
  const durations: number[] = []
  const typeMap = new Map<string, { total: number; finished: number; durations: number[] }>()

  for (const instance of instances) {
    const duration = flowInstanceDurationHours(instance, now)
    const type = typeMap.get(instance.bizType) ?? { total: 0, finished: 0, durations: [] }
    type.total += 1
    const finished = toTime(instance.finishedAt) !== null
    if (finished) {
      type.finished += 1
      if (duration !== null) {
        type.durations.push(duration)
        durations.push(duration)
      }
    }
    typeMap.set(instance.bizType, type)
  }

  const finishedCount = instances.filter((item) => toTime(item.finishedAt) !== null).length
  const summary: FlowDurationSummary = {
    total: instances.length,
    finished: finishedCount,
    running: instances.length - finishedCount,
    avgDurationHours: durations.length ? round2(durations.reduce((sum, item) => sum + item, 0) / durations.length) : 0,
    maxDurationHours: durations.length ? round2(Math.max(...durations)) : 0
  }

  const byType: FlowTypeDuration[] = [...typeMap.entries()]
    .map(([bizType, stat]) => ({
      bizType,
      total: stat.total,
      finished: stat.finished,
      avgDurationHours: stat.durations.length ? round2(stat.durations.reduce((sum, item) => sum + item, 0) / stat.durations.length) : 0,
      maxDurationHours: stat.durations.length ? round2(Math.max(...stat.durations)) : 0
    }))
    .sort((a, b) => b.avgDurationHours - a.avgDurationHours || b.total - a.total)

  return { summary, byType }
}

/** 瓶颈节点排行：按节点已处理任务的平均耗时倒序 */
export function analyzeFlowBottlenecks(
  tasks: FlowTaskSample[],
  nodes: FlowNodeSample[],
  limit = 10
): FlowBottleneck[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const statMap = new Map<number, { name: string; durations: number[] }>()

  for (const task of tasks) {
    const created = toTime(task.createdAt)
    const acted = toTime(task.actedAt)
    if (created === null || acted === null || acted < created) continue
    const node = nodeMap.get(task.nodeId)
    const stat = statMap.get(task.nodeId) ?? { name: node?.nodeName ?? `节点#${task.nodeId}`, durations: [] }
    stat.durations.push((acted - created) / HOUR)
    statMap.set(task.nodeId, stat)
  }

  return [...statMap.entries()]
    .map(([nodeId, stat]) => ({
      nodeId,
      nodeName: stat.name,
      taskCount: stat.durations.length,
      avgDurationHours: round2(stat.durations.reduce((sum, item) => sum + item, 0) / stat.durations.length),
      maxDurationHours: round2(Math.max(...stat.durations))
    }))
    .sort((a, b) => b.avgDurationHours - a.avgDurationHours || b.taskCount - a.taskCount)
    .slice(0, limit)
}

/**
 * 超时排行：待处理任务超过节点时限，或已超过任务的截止时间。
 * 按超时时长倒序。
 */
export function analyzeFlowTimeouts(
  instances: FlowInstanceSample[],
  tasks: FlowTaskSample[],
  nodes: FlowNodeSample[],
  now: number = Date.now(),
  limit = 20
): FlowTimeoutRow[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const instanceMap = new Map(instances.map((item) => [item.id, item]))
  const rows: FlowTimeoutRow[] = []

  for (const task of tasks) {
    if (task.status !== 'PENDING') continue
    const created = toTime(task.createdAt)
    if (created === null) continue
    const waitHours = (now - created) / HOUR
    if (waitHours < 0) continue
    const node = nodeMap.get(task.nodeId)
    const timeoutHours = node?.timeoutHours ?? null
    const dueAt = toTime(task.dueAt)
    const overdueByDue = dueAt !== null && now > dueAt ? (now - dueAt) / HOUR : 0
    const overdueByNode = timeoutHours !== null && waitHours > timeoutHours ? waitHours - timeoutHours : 0
    const overdueHours = Math.max(overdueByDue, overdueByNode)
    if (overdueHours <= 0) continue
    const instance = instanceMap.get(task.instanceId)
    rows.push({
      instanceId: task.instanceId,
      bizType: instance?.bizType ?? '',
      bizNo: instance?.bizNo ?? null,
      nodeId: task.nodeId,
      nodeName: node?.nodeName ?? `节点#${task.nodeId}`,
      assigneeId: task.assigneeId,
      waitHours: round2(waitHours),
      timeoutHours: timeoutHours ?? 0,
      overdueHours: round2(overdueHours)
    })
  }

  return rows.sort((a, b) => b.overdueHours - a.overdueHours).slice(0, limit)
}
