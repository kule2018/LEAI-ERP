/**
 * 权限互斥（职责分离）与批量授权规则。
 */

/** 互斥规则：权限码组，同一用户/角色不可同时持有 */
export interface PermissionExclusionGroup {
  groupCode: string
  description: string
  permissions: string[]
}

/** 内置互斥规则：制单与审核、录入与过账、付款申请与付款执行 */
export const DEFAULT_PERMISSION_EXCLUSIONS: PermissionExclusionGroup[] = [
  {
    groupCode: 'VOUCHER_PREPARE_POST',
    description: '凭证制单与过账不可同人',
    permissions: ['finance:voucher:create', 'finance:voucher:post']
  },
  {
    groupCode: 'PAY_REQUEST_EXECUTE',
    description: '付款申请与付款执行不可同人',
    permissions: ['finance:payment:create', 'finance:payment:approve']
  },
  {
    groupCode: 'AUDIT_CREATE',
    description: '业务制单与审核不可同人',
    permissions: ['sales:order:create', 'sales:order:approve', 'purchase:order:create', 'purchase:order:approve']
  }
]

/** 检测权限集合中的互斥冲突 */
export function detectPermissionConflicts(
  permissionCodes: string[],
  groups: PermissionExclusionGroup[] = DEFAULT_PERMISSION_EXCLUSIONS
): Array<{ groupCode: string; description: string; conflicts: string[] }> {
  const codes = new Set(permissionCodes)
  const result: Array<{ groupCode: string; description: string; conflicts: string[] }> = []
  for (const group of groups) {
    const conflicts = group.permissions.filter((item) => codes.has(item))
    if (conflicts.length > 1) result.push({ groupCode: group.groupCode, description: group.description, conflicts })
  }
  return result
}

/** 批量授权请求校验：用户/角色 ID 与权限 ID 不可为空 */
export function validateBatchGrant(input: {
  userIds?: number[]
  roleIds?: number[]
  permissionIds: number[]
  action: 'GRANT' | 'REVOKE'
}): { ok: boolean; reason?: string } {
  const targets = [...(input.userIds ?? []), ...(input.roleIds ?? [])]
  if (targets.length === 0) return { ok: false, reason: '请选择至少一个用户或角色' }
  if (input.permissionIds.length === 0) return { ok: false, reason: '请选择至少一个权限' }
  if (targets.some((id) => !Number.isInteger(id) || id <= 0)) return { ok: false, reason: '目标 ID 无效' }
  if (input.permissionIds.some((id) => !Number.isInteger(id) || id <= 0)) return { ok: false, reason: '权限 ID 无效' }
  return { ok: true }
}
