import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { InjectRepository } from '@nestjs/typeorm'
import type { Request } from 'express'
import type Redis from 'ioredis'
import { Repository } from 'typeorm'
import type { JwtUser } from '../../../common/contracts'
import { comparePassword } from '../../../common/utils/password.util'
import { API_SCOPE_KEY } from '../decorators/require-api-scope.decorator'
import { ApiCallLogEntity } from '../entities/api-call-log.entity'
import { ApiKeyEntity } from '../entities/openapi.entities'

interface ApiKeyRequest extends Request {
  headers: Record<string, string | string[] | undefined>
  apiKeyId?: number
  tenantId?: number
  user?: JwtUser
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  /** 每密钥每分钟调用计数（进程内，轻量限流） */
  private readonly rateWindow = new Map<number, { minute: number; count: number }>()
  private readonly rateLimit = 100

  constructor(
    @InjectRepository(ApiKeyEntity) private readonly apiKeyRepo: Repository<ApiKeyEntity>,
    @InjectRepository(ApiCallLogEntity) private readonly callLogRepo: Repository<ApiCallLogEntity>,
    private readonly reflector: Reflector,
    @Inject('REDIS_CLIENT') private readonly redis: Redis
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiKeyRequest>()
    const keyId = this.header(request, 'x-api-key')
    const secret = this.header(request, 'x-api-secret')
    if (!keyId || !secret) {
      throw new UnauthorizedException('缺少 API Key 或 Secret')
    }

    const apiKey = await this.apiKeyRepo.findOne({ where: { keyId, isDeleted: 0, status: 'ACTIVE' } })
    if (!apiKey || !comparePassword(secret, apiKey.secretHash)) {
      throw new UnauthorizedException('API Key 无效')
    }
    if (apiKey.expiresAt && apiKey.expiresAt.getTime() < Date.now()) {
      throw new ForbiddenException('API Key 已过期')
    }

    const requiredScope = this.reflector.getAllAndOverride<string | undefined>(API_SCOPE_KEY, [
      context.getHandler(),
      context.getClass()
    ])
    if (requiredScope && !apiKey.scopes.includes(requiredScope) && !apiKey.scopes.includes('*')) {
      throw new ForbiddenException(`API Key 缺少 ${requiredScope} 权限`)
    }

    // 密钥级限流：Redis 原子计数，跨实例共享；失败时降级为进程内计数
    const count = await this.rateCount(apiKey.id)
    if (count > this.rateLimit) throw new ForbiddenException('API Key 调用频率超限')

    apiKey.lastUsedAt = new Date()
    await this.apiKeyRepo.save(apiKey)
    // 调用日志（失败不阻断主流程）
    await this.callLogRepo.save(this.callLogRepo.create({
      tenantId: apiKey.tenantId,
      apiKeyId: apiKey.id,
      method: request.method,
      path: (request.originalUrl ?? request.url ?? '').slice(0, 300),
      status: 200,
      durationMs: 0
    })).catch(() => undefined)
    request.apiKeyId = apiKey.id
    request.tenantId = apiKey.tenantId
    request.user = {
      userId: apiKey.createdBy,
      tenantId: apiKey.tenantId,
      username: `api-key:${apiKey.keyId}`,
      realName: apiKey.name,
      orgId: null,
      roles: [],
      permissions: apiKey.scopes,
      isSuperAdmin: false,
      dataScopeLevel: 'ORG'
    }
    return true
  }

  private async rateCount(apiKeyId: number): Promise<number> {
    const script = "local c = redis.call('INCR', KEYS[1]); if c == 1 then redis.call('EXPIRE', KEYS[1], 60); end; return c"
    try {
      return Number(await this.redis.eval(script, 1, `ratelimit:apikey:${apiKeyId}`))
    } catch {
      const minute = Math.floor(Date.now() / 60000)
      const window = this.rateWindow.get(apiKeyId)
      if (!window || window.minute !== minute) {
        this.rateWindow.set(apiKeyId, { minute, count: 1 })
        return 1
      }
      window.count += 1
      return window.count
    }
  }

  private header(request: ApiKeyRequest, name: string): string | null {
    const value = request.headers[name]
    const text = Array.isArray(value) ? value[0] : value
    return text?.trim() || null
  }
}
