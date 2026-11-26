import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import type { DataScopeInfo, JwtUser } from '../contracts'
import { DATA_SCOPE_LEVEL } from '../contracts'
import { DataScopeOption, DATA_SCOPE_KEY } from '../decorators/data-scope.decorator'
import { PUBLIC_KEY } from '../decorators/public.decorator'
import { enterScope } from '../data-scope-context'
import { resolveRuntimeScope } from '../role-inherit-engine'
import { DataScopeEntity } from '../../modules/data-scope/entities/data-scope.entity'
import { OrgEntity } from '../../modules/system/entities/org.entities'

interface RequestWithScope {
  user: JwtUser
  dataScope?: DataScopeInfo
}

@Injectable()
export class DataScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectDataSource() private readonly dataSource: DataSource
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ])
    if (isPublic) {
      return true
    }

    const option = this.reflector.getAllAndOverride<DataScopeOption>(DATA_SCOPE_KEY, [
      context.getHandler(),
      context.getClass()
    ]) ?? { org: 'dept', level: DATA_SCOPE_LEVEL.SELF }

    const request = context.switchToHttp().getRequest<RequestWithScope>()
    const user = request.user
    const declaredLevel = option.level ?? DATA_SCOPE_LEVEL.SELF
    const roleLevel = user.dataScopeLevel ?? DATA_SCOPE_LEVEL.SELF
    const bizType = option.bizType ?? context.getClass().name.replace(/Controller$/, '').toUpperCase()

    const rules = await this.dataSource.getRepository(DataScopeEntity).find({
      where: { tenantId: user.tenantId, status: 'ENABLED', isDeleted: 0 }
    })
    const resolved = resolveRuntimeScope({
      bizType,
      declaredLevel,
      roleLevel,
      rules: rules.map((rule) => ({
        bizType: rule.bizType,
        orgField: rule.orgField,
        scopeLevel: rule.scopeLevel,
        priority: rule.priority,
        status: rule.status
      }))
    })
    const level = user.isSuperAdmin ? DATA_SCOPE_LEVEL.ALL : resolved.level
    const org: DataScopeInfo['org'] = resolved.orgField === 'created_by'
      ? 'created_by'
      : (resolved.orgField === 'org_id' ? 'org' : 'dept')
    const childOrgIds = level === DATA_SCOPE_LEVEL.DEPT_AND_CHILD && user.orgId != null
      ? await this.resolveChildOrgIds(user.tenantId, user.orgId)
      : undefined

    request.dataScope = {
      org,
      level,
      orgId: user.orgId,
      orgField: resolved.orgField,
      childOrgIds
    }
    enterScope(request.dataScope)
    return true
  }

  /** 从组织树展开指定组织的所有下级组织，供 DEPT_AND_CHILD 过滤使用 */
  private async resolveChildOrgIds(tenantId: number, rootOrgId: number): Promise<number[]> {
    const orgs = await this.dataSource.getRepository(OrgEntity).find({
      where: { tenantId, isDeleted: 0 },
      select: { id: true, parentId: true }
    })
    const childrenByParent = new Map<number, number[]>()
    for (const org of orgs) {
      if (org.parentId == null) continue
      const children = childrenByParent.get(org.parentId) ?? []
      children.push(org.id)
      childrenByParent.set(org.parentId, children)
    }
    const result: number[] = []
    const queue = [rootOrgId]
    const visited = new Set<number>([rootOrgId])
    while (queue.length > 0) {
      const current = queue.shift() as number
      for (const child of childrenByParent.get(current) ?? []) {
        if (visited.has(child)) continue
        visited.add(child)
        result.push(child)
        queue.push(child)
      }
    }
    return result
  }
}
