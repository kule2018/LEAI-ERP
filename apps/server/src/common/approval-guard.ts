import { BadRequestException } from '@nestjs/common'

/** 审批中的单据状态（与业务模块 status 字段约定一致） */
const APPROVING_STATUSES = new Set(['SUBMITTED', 'PENDING_APPROVAL', 'APPROVING'])
const REJECT_DECISIONS = new Set(['REJECT', 'REJECTED', 'REFUSE', 'DENY'])

export interface ApprovalEditContext {
  /** 业务单据当前状态 */
  status?: string | null
  /** 单据上已记录的工作流实例 ID */
  flowInstanceId?: number | null
  /** 工作流实例当前是否仍在流转（由业务模块查询流程实例得到） */
  flowRunning?: boolean
}

/**
 * 全局审批规则：任何驳回动作都必须填写原因。
 * 同时供 DTO 校验失败兜底与 Service 直接调用场景使用。
 */
export function assertRejectReason(decision: string | null | undefined, reason: string | null | undefined): void {
  if (decision && REJECT_DECISIONS.has(String(decision).toUpperCase()) && !String(reason ?? '').trim()) {
    throw new BadRequestException('驳回必须填写原因')
  }
}

/**
 * 全局审批规则：审批中（含已发起工作流）禁止修改关键字段。
 * 仅比对 DTO 中显式传入的字段，避免可选字段未传时被误判为“已修改”。
 */
export function assertBizEditable(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
  context: ApprovalEditContext = {}
): void {
  const approving = context.flowRunning === true
    || Boolean(context.flowInstanceId)
    || (context.status != null && APPROVING_STATUSES.has(String(context.status)))
  if (!approving) return

  const changed = fields.filter((field) =>
    Object.prototype.hasOwnProperty.call(after, field)
    && JSON.stringify(before[field]) !== JSON.stringify(after[field])
  )
  if (changed.length > 0) {
    throw new BadRequestException(`审批中的单据禁止修改关键字段：${changed.join('、')}`)
  }
}
