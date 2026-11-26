import { DATA_SCOPE_LEVEL, type DataScopeLevel } from './contracts'

export interface RoleNode {
  id: number
  parentId?: number | null
}

export interface DataScopeRuleInput {
  bizType: string
  orgField: string
  scopeLevel: DataScopeLevel
  priority: number
  status: string
}

export interface RuntimeScopeInput {
  bizType: string
  declaredLevel: DataScopeLevel
  roleLevel: DataScopeLevel
  rules: DataScopeRuleInput[]
}

export interface RuntimeScopeResult {
  level: DataScopeLevel
  orgField: string
  rule?: DataScopeRuleInput
}

const SCOPE_RANK: Record<DataScopeLevel, number> = {
  SELF: 1,
  DEPT: 2,
  DEPT_AND_CHILD: 3,
  ORG: 4,
  ALL: 5
}

export function buildRoleClosure(roles: RoleNode[]): Map<number, number[]> {
  const byId = new Map(roles.map((role) => [role.id, role]))
  const closure = new Map<number, number[]>()
  for (const role of roles) {
    const ancestors: number[] = []
    const seen = new Set<number>([role.id])
    let current = role.parentId
    while (current != null && !seen.has(current)) {
      const parent = byId.get(current)
      if (!parent) break
      seen.add(current)
      ancestors.push(current)
      current = parent.parentId
    }
    closure.set(role.id, ancestors)
  }
  return closure
}

export function effectiveRoleIds(directIds: number[], closure: Map<number, number[]>): number[] {
  const result = new Set<number>()
  for (const id of directIds) {
    result.add(id)
    for (const ancestor of closure.get(id) ?? []) result.add(ancestor)
  }
  return [...result]
}

export function detectRoleConflict(roleId: number, parentId: number | null | undefined, roles: RoleNode[]): string | null {
  if (parentId == null) return null
  if (parentId === roleId) return '角色不能继承自身'
  const byId = new Map(roles.map((role) => [role.id, role]))
  if (!byId.has(roleId)) return '角色不存在'
  if (!byId.has(parentId)) return '父角色不存在'
  const seen = new Set<number>([roleId])
  let current: number | null | undefined = parentId
  while (current != null) {
    if (seen.has(current)) return '角色继承存在循环'
    seen.add(current)
    current = byId.get(current)?.parentId
  }
  return null
}

export function resolveRuntimeScope(input: RuntimeScopeInput): RuntimeScopeResult {
  const candidates = input.rules.filter((rule) =>
    rule.status === 'ENABLED' && (rule.bizType === input.bizType || rule.bizType === 'ALL')
  ).sort((a, b) => b.priority - a.priority)
  const rule = candidates[0]
  const ruleLevel = rule?.scopeLevel ?? input.declaredLevel
  const baseLevel = input.roleLevel === DATA_SCOPE_LEVEL.ALL ? input.declaredLevel : input.roleLevel
  const level = SCOPE_RANK[ruleLevel] < SCOPE_RANK[baseLevel] ? ruleLevel : baseLevel
  return { level, orgField: rule?.orgField ?? 'dept_id', ...(rule ? { rule } : {}) }
}
