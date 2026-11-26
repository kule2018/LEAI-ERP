import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import type { Redis } from 'ioredis'
import type { DataScopeLevel, JwtUser } from '../contracts'
import { env } from '../../config/env'
import { PUBLIC_KEY } from '../decorators/public.decorator'

interface RequestWithUser {
  headers: Record<string, string | undefined>
  user?: JwtUser
}

interface JwtPayload {
  sub?: string
  tenantId?: string | number
  username?: string
  realName?: string
  orgId?: string | number | null
  roles?: string[]
  permissions?: string[]
  isSuperAdmin?: boolean
  dataScopeLevel?: string
  type?: string
  permVersion?: number
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
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

    const request = context.switchToHttp().getRequest<RequestWithUser>()
    const token = this.extractToken(request.headers.authorization)
    if (!token) {
      throw new UnauthorizedException('请先登录')
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, { secret: env.jwt.secret })
      if (payload.type === 'refresh') {
        throw new UnauthorizedException('刷新令牌不能用于访问接口')
      }
      if (payload.type === 'supplier_portal') {
        throw new UnauthorizedException('供应商门户令牌不能用于内部系统接口')
      }
      request.user = await this.toJwtUser(payload)
      return true
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error
      }
      throw new UnauthorizedException('登录已失效')
    }
  }

  private extractToken(authorization: string | undefined): string | null {
    if (!authorization) {
      return null
    }
    const [scheme, token] = authorization.split(' ')
    if (scheme !== 'Bearer' || !token) {
      return null
    }
    return token
  }

  private async toJwtUser(payload: JwtPayload): Promise<JwtUser> {
    const userId = Number(payload.sub)
    const tenantId = Number(payload.tenantId)
    if (!Number.isFinite(userId) || !Number.isFinite(tenantId)) {
      throw new UnauthorizedException('登录信息不完整')
    }
    const roles = Array.isArray(payload.roles) ? payload.roles : []
    let permissions: string[] = []
    if (payload.permVersion !== undefined) {
      try {
        const raw = await this.redis.get(`auth:perms:${tenantId}:${userId}:${payload.permVersion}`)
        if (raw) {
          const parsed: unknown = JSON.parse(raw)
          if (Array.isArray(parsed)) permissions = parsed.map(String)
        }
      } catch {
        // Redis 异常时回退到旧令牌内嵌权限，避免请求整体失败
      }
    }
    if (permissions.length === 0 && Array.isArray(payload.permissions)) {
      permissions = payload.permissions
    }
    return {
      userId,
      tenantId,
      username: payload.username ?? '',
      realName: payload.realName ?? '',
      orgId: payload.orgId === null || payload.orgId === undefined ? null : Number(payload.orgId),
      roles,
      permissions,
      isSuperAdmin: Boolean(payload.isSuperAdmin),
      dataScopeLevel: (payload.dataScopeLevel ?? 'SELF') as DataScopeLevel,
      permVersion: payload.permVersion === undefined ? undefined : Number(payload.permVersion)
    }
  }
}
