import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Redis } from 'ioredis'
import { ALERT_DEFAULT_THRESHOLDS, ALERT_METRIC } from '../alert-rule-engine'
import type { JwtUser } from '../contracts'
import { PUBLIC_KEY } from '../decorators/public.decorator'
import { REQUIRE_PERM_KEY } from '../decorators/require-perm.decorator'
import { evaluateUnauthorizedAttempt, permissionVersionChanged } from '../platform-guard-engine'

interface RequestWithUser {
  user: JwtUser
  method?: string
  url?: string
}

/** 越权告警默认阈值：告警规则表未配置时使用 */
const DEFAULT_SECURITY_ALERT_THRESHOLD = ALERT_DEFAULT_THRESHOLDS[ALERT_METRIC.SECURITY_UNAUTHORIZED_ATTEMPTS]

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject('REDIS_CLIENT') private readonly redis: Redis
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ])
    if (isPublic) {
      return true
    }

    const requiredPerm = this.reflector.getAllAndOverride<string>(REQUIRE_PERM_KEY, [
      context.getHandler(),
      context.getClass()
    ])
    if (!requiredPerm) {
      return true
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>()
    const user = request.user
    if (user.isSuperAdmin || user.permissions.includes('*:*') || user.permissions.includes(requiredPerm)) {
      await this.assertPermissionVersion(user)
      return true
    }
    await this.recordUnauthorized(user, requiredPerm, request)
    throw new ForbiddenException('无权限访问')
  }

  /** 权限即时失效：令牌中的权限版本落后于当前版本时要求重新登录 */
  private async assertPermissionVersion(user: JwtUser): Promise<void> {
    if (user.permVersion === undefined) return
    const raw = await this.redis.get(`auth:permver:${user.tenantId}:${user.userId}`)
    const current = Number(raw ?? 0)
    if (permissionVersionChanged(Number.isFinite(current) ? current : 0, user.permVersion)) {
      throw new ForbiddenException('权限已变更，请重新登录')
    }
  }

  /** 越权告警阈值：读取统一告警规则广播到 Redis 的阈值，未配置时使用默认值 */
  private async resolveAlertThreshold(tenantId: number): Promise<number> {
    try {
      const raw = await this.redis.get(`alert:thresholds:${tenantId}`)
      if (!raw) return DEFAULT_SECURITY_ALERT_THRESHOLD
      const payload = JSON.parse(raw) as Record<string, number>
      const threshold = Number(payload[ALERT_METRIC.SECURITY_UNAUTHORIZED_ATTEMPTS])
      return Number.isFinite(threshold) && threshold > 0 ? threshold : DEFAULT_SECURITY_ALERT_THRESHOLD
    } catch {
      return DEFAULT_SECURITY_ALERT_THRESHOLD
    }
  }

  /** 越权访问记录：短窗口累计达阈值写入安全告警队列 */
  private async recordUnauthorized(user: JwtUser, perm: string, request: RequestWithUser): Promise<void> {
    try {
      const key = `security:unauth:${user.tenantId}:${user.userId}`
      const attempts = await this.redis.incr(key)
      if (attempts === 1) {
        await this.redis.expire(key, 300)
      }
      const judgement = evaluateUnauthorizedAttempt(attempts, await this.resolveAlertThreshold(user.tenantId))
      if (!judgement.alert) return
      await this.redis.lpush(
        `security:alerts:${user.tenantId}`,
        JSON.stringify({
          userId: user.userId,
          username: user.username,
          perm,
          path: request.url ?? '',
          method: request.method ?? '',
          attempts,
          level: judgement.level,
          reason: judgement.reason,
          occurredAt: new Date().toISOString()
        })
      )
      await this.redis.ltrim(`security:alerts:${user.tenantId}`, 0, 199)
    } catch {
      // 告警记录失败不阻断主流程
    }
  }
}
