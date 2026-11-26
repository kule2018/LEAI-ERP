import { AsyncLocalStorage } from 'node:async_hooks'
import { In, type FindOptionsWhere } from 'typeorm'
import { DATA_SCOPE_LEVEL, type DataScopeInfo, type JwtUser } from './contracts'

const storage = new AsyncLocalStorage<DataScopeInfo>()

/** 将当前请求计算好的数据权限作用域写入上下文，供 Service 层查询过滤使用。 */
export function enterScope(scope: DataScopeInfo): void {
  storage.enterWith(scope)
}

/** 读取当前请求的数据权限作用域；非 HTTP 上下文返回 undefined。 */
export function currentScope(): DataScopeInfo | undefined {
  return storage.getStore()
}

/** 清除当前上下文作用域，主要用于测试隔离。 */
export function clearScope(): void {
  storage.disable()
}

export interface ScopeFilterOptions {
  /**
   * SELF 级别用于匹配的字段。仅在实体确实具备该字段时传入；
   * 不传表示不追加创建人过滤（适用于台账/主数据/流水等共享实体）。
   */
  ownerField?: string
  /**
   * DEPT / DEPT_AND_CHILD / ORG 级别用于匹配的字段。实体无组织字段时不传，
   * 此时若有 ownerField 则降级为按创建人过滤，否则保持基础条件。
   */
  orgField?: string
  /** DEPT_AND_CHILD 级别的子组织 ID 列表，由调用方按组织树展开后传入 */
  childOrgIds?: number[]
}

/**
 * 在基础查询条件上叠加数据权限过滤。
 * 作用域优先级：当前上下文 scope > 用户角色 dataScopeLevel。
 * 安全原则：只有显式声明 ownerField / orgField 时才应用对应过滤，
 * 避免对不含这些字段的实体生成非法 SQL。租户隔离仍由 base.tenantId 保证。
 */
export function scopeWhere<T extends object>(
  base: FindOptionsWhere<T>,
  user: JwtUser,
  options: ScopeFilterOptions = {}
): FindOptionsWhere<T> {
  const scope = currentScope()
  const level = scope?.level ?? (user.isSuperAdmin ? DATA_SCOPE_LEVEL.ALL : user.dataScopeLevel ?? DATA_SCOPE_LEVEL.SELF)
  const runtimeField = scope?.orgField
  const ownerField = runtimeField === 'created_by' ? runtimeField : options.ownerField
  const result: Record<string, unknown> = { ...base }

  if (level === DATA_SCOPE_LEVEL.ALL) {
    return result as FindOptionsWhere<T>
  }

  if (level === DATA_SCOPE_LEVEL.SELF) {
    if (ownerField) {
      result[ownerField] = user.userId
    }
    return result as FindOptionsWhere<T>
  }

  const orgField = runtimeField && runtimeField !== 'created_by' ? runtimeField : options.orgField
  if (orgField && user.orgId != null) {
    if (level === DATA_SCOPE_LEVEL.DEPT_AND_CHILD) {
      const children = scope?.childOrgIds ?? options.childOrgIds ?? []
      result[orgField] = In(children.length ? [user.orgId, ...children] : [user.orgId])
    } else {
      result[orgField] = user.orgId
    }
  } else if (ownerField) {
    result[ownerField] = user.userId
  }

  return result as FindOptionsWhere<T>
}
