import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import type { Request } from 'express'
import { Observable, tap } from 'rxjs'
import type { JwtUser } from '../contracts'
import { AuditService } from '../../modules/audit/audit.service'

interface AuditRequest extends Request {
  user?: JwtUser
}

const SENSITIVE_KEYS = new Set(['password', 'secret', 'apiKey', 'token', 'refreshToken', 'secretHash'])

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<string>() !== 'http') {
      return next.handle()
    }
    const request = context.switchToHttp().getRequest<AuditRequest>()
    if (request.method === 'GET' || !request.user) {
      return next.handle()
    }
    const path = request.originalUrl.split('?')[0] ?? request.originalUrl
    const bizType = path.replace(/^\/api\/v1\//, '').split('/')[0] || 'http'
    return next.handle().pipe(
      tap(() => {
        void this.auditService.record({
          bizType,
          bizId: 0,
          action: `${request.method} ${path}`,
          afterValue: this.sanitize(request.body),
          ip: request.ip ?? null
        }, request.user as JwtUser).catch(() => undefined)
      })
    )
  }

  private sanitize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sanitize(item))
    }
    if (!value || typeof value !== 'object') {
      return value
    }
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_KEYS.has(key) ? '***' : this.sanitize(item)
    }
    return result
  }
}
