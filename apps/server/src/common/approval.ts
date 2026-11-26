/**
 * 审批引擎纯逻辑：节点通过判定、委托权限、快照、超时计算。
 * 与持久层解耦，便于单元测试和被 CollaborationService 复用。
 */

export const APPROVAL_MODE = {
  /** 或签：任一审批人同意即通过节点 */
  ANY: 'ANY',
  /** 会签：全部审批人同意才通过节点 */
  ALL: 'ALL',
  /** 依次审批：按顺序逐个处理 */
  SEQUENTIAL: 'SEQUENTIAL'
} as const

export type ApprovalMode = (typeof APPROVAL_MODE)[keyof typeof APPROVAL_MODE]

export const TASK_DECISION = {
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
} as const

export type TaskDecision = (typeof TASK_DECISION)[keyof typeof TASK_DECISION]

export interface ApprovalDecision {
  assigneeId: number
  decision: TaskDecision
  actedAt?: Date
}

/**
 * 判定一个节点是否已完成审批并给出结论。
 * - REJECTED：任一驳回（会签/或签都立即驳回）
 * - ANY：同意数 >= 1 即通过
 * - ALL：需全部同意
 * - SEQUENTIAL：需全部同意（顺序由任务 sortNo/createdAt 保证）
 */
export function evaluateNodeDecision(
  mode: ApprovalMode,
  decisions: ApprovalDecision[],
  expectedAssignees: number[]
): 'PENDING' | 'APPROVED' | 'REJECTED' {
  if (decisions.some((d) => d.decision === TASK_DECISION.REJECTED)) return 'REJECTED'
  if (expectedAssignees.length === 0) return 'PENDING'

  const approvedIds = new Set(decisions.filter((d) => d.decision === TASK_DECISION.APPROVED).map((d) => d.assigneeId))
  const threshold = mode === APPROVAL_MODE.ANY ? 1 : expectedAssignees.length
  if (approvedIds.size >= threshold) return 'APPROVED'
  return 'PENDING'
}

/**
 * 判断用户是否可以处理某任务：本人，或任务的受托人。
 * delegatedTo 为 null 表示未委托。
 */
export function canActOnTask(assigneeId: number, delegatedTo: number | null, userId: number): boolean {
  if (assigneeId === userId) return true
  return delegatedTo != null && delegatedTo === userId
}

/** 生成流程定义快照（发起时固化，后续定义变更不影响进行中的实例） */
export function buildFlowSnapshot(nodes: Array<{ id: number; nodeCode: string; sortNo: number; mode?: string; timeoutHours?: number | null }>): object {
  return {
    capturedAt: new Date().toISOString(),
    nodes: nodes.map((n) => ({
      id: n.id,
      nodeCode: n.nodeCode,
      sortNo: n.sortNo,
      mode: n.mode ?? APPROVAL_MODE.SEQUENTIAL,
      timeoutHours: n.timeoutHours ?? null
    }))
  }
}

/** 根据节点超时配置计算应完成时间；未配置返回 null */
export function computeDueAt(timeoutHours: number | null | undefined, startedAt: Date): Date | null {
  if (timeoutHours == null || timeoutHours <= 0) return null
  return new Date(startedAt.getTime() + timeoutHours * 60 * 60 * 1000)
}

/** 判断是否超时（用于超时升级与 SLA 标红） */
export function isOverdue(dueAt: Date | null | undefined, now: Date = new Date()): boolean {
  return dueAt != null && dueAt.getTime() < now.getTime()
}
