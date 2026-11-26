import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { PortalUser } from '../contracts'
import { env } from '../../config/env'

export const PORTAL_TOKEN_TYPE = 'supplier_portal'

interface RequestWithPortal {
  headers: Record<string, string | undefined>
  portalUser?: PortalUser
}

interface PortalPayload {
  sub?: string
  tenantId?: string | number
  supplierId?: string | number
  username?: string
  displayName?: string
  type?: string
}

/**
 * 供应商门户守卫：只接受 type=supplier_portal 的门户令牌，
 * 并把供应商身份注入请求；内部员工令牌与门户令牌互不通用。
 */
@Injectable()
export class SupplierPortalGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithPortal>()
    const token = this.extractToken(request.headers.authorization)
    if (!token) {
      throw new UnauthorizedException('门户登录已失效，请重新登录')
    }

    let payload: PortalPayload
    try {
      payload = await this.jwtService.verifyAsync<PortalPayload>(token, { secret: env.jwt.secret })
    } catch {
      throw new UnauthorizedException('门户登录已失效，请重新登录')
    }
    if (payload.type !== PORTAL_TOKEN_TYPE) {
      throw new UnauthorizedException('该令牌不能用于供应商门户')
    }

    const portalUserId = Number(payload.sub)
    const tenantId = Number(payload.tenantId)
    const supplierId = Number(payload.supplierId)
    if (!Number.isFinite(portalUserId) || !Number.isFinite(tenantId) || !Number.isFinite(supplierId)) {
      throw new UnauthorizedException('门户登录信息不完整')
    }

    request.portalUser = {
      portalUserId,
      tenantId,
      supplierId,
      username: payload.username ?? '',
      displayName: payload.displayName ?? payload.username ?? ''
    }
    return true
  }

  private extractToken(authorization: string | undefined): string | null {
    if (!authorization) return null
    const [scheme, token] = authorization.split(' ')
    if (scheme !== 'Bearer' || !token) return null
    return token
  }
}
