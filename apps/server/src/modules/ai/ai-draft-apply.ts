import type { JwtUser } from '../../common/contracts'
import type { AiDraftApplier } from './ai-draft-applier'

/**
 * AI 草稿写回的纯逻辑校验：权限二次校验 + 必填字段校验 + 幂等状态校验。
 * 与持久层解耦，便于单元测试。
 */

export interface DraftValidationResult {
  ok: boolean
  reason?: string
}

/** 二次权限校验：超管放行，否则必须拥有 applier 要求的权限码 */
export function checkApplyPermission(applier: AiDraftApplier, user: JwtUser): DraftValidationResult {
  if (user.isSuperAdmin) return { ok: true }
  if (user.permissions?.includes(applier.requiredPerm)) return { ok: true }
  return { ok: false, reason: `缺少写回权限：${applier.requiredPerm}` }
}

/** 低置信草稿必须人工补齐关键字段后才允许写回 */
export function checkDraftCompleteness(
  draft: Record<string, unknown>,
  requiredKeys: string[]
): DraftValidationResult {
  const missing = requiredKeys.filter((key) => {
    const value = draft[key]
    return value == null || (typeof value === 'string' && value.trim() === '')
  })
  if (missing.length > 0) {
    return { ok: false, reason: `草稿缺少必填字段：${missing.join('、')}` }
  }
  return { ok: true }
}

/** 幂等校验：只有待确认状态且未写回过才允许执行写回 */
export function checkConfirmState(accepted: string, appliedBizId: number | null): DraftValidationResult {
  if (appliedBizId != null) return { ok: false, reason: '该建议已写回业务单据，不可重复写入' }
  if (accepted !== 'PENDING') return { ok: false, reason: '该建议已处理' }
  return { ok: true }
}

/** 从审计响应 JSON 中安全提取草稿对象 */
export function extractDraft(response: string | null | undefined): Record<string, unknown> {
  if (!response) return {}
  try {
    const parsed = JSON.parse(response) as Record<string, unknown>
    const draft = parsed?.draft
    return draft && typeof draft === 'object' && !Array.isArray(draft)
      ? (draft as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}
