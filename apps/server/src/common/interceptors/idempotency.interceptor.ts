import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor
} from '@nestjs/common'
import type Redis from 'ioredis'
import { Observable, defaultIfEmpty, lastValueFrom, of } from 'rxjs'
import { resolveIdempotentRecord } from '../idempotency-rules'

const TTL_SECONDS = 86400

/**
 * 全局幂等拦截器：请求携带 `Idempotency-Key` 头时，
 * 同一租户 + 用户 + 键的请求在 TTL 内只允许成功执行一次。
 * 离线暂存表单在恢复网络后按原幂等键重放，此处回放首次执行结果，
 * 避免出现「实际已建单却提示重复提交」导致单据无法落地的情况。
 * Redis 不可用时降级放行，不影响主流程。
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest()
    const raw = request.headers?.['idempotency-key']
    const key = Array.isArray(raw) ? raw[0] : raw
    if (!key) return next.handle()

    const portalUser = request.portalUser as { tenantId?: number; portalUserId?: number } | undefined
    const tenantId = portalUser?.tenantId ?? request.user?.tenantId ?? 'anonymous'
    const userId = portalUser?.portalUserId ?? request.user?.userId ?? 'anonymous'
    const redisKey = `idem:${tenantId}:${userId}:${String(key).slice(0, 120)}`

    let existing: string | null = null
    try {
      existing = await this.redis.get(redisKey)
    } catch {
      // Redis 异常时降级放行
      return next.handle()
    }
    if (existing) {
      return this.replay(existing)
    }

    let acquired = true
    try {
      acquired = (await this.redis.set(redisKey, JSON.stringify({ status: 'PENDING' }), 'EX', TTL_SECONDS, 'NX')) === 'OK'
    } catch {
      return next.handle()
    }
    if (!acquired) {
      const current = await this.redis.get(redisKey).catch(() => null)
      if (current) return this.replay(current)
      throw new ConflictException('检测到重复提交，请勿短时间内重复操作')
    }

    try {
      const result = await lastValueFrom(next.handle().pipe(defaultIfEmpty(null)))
      await this.markDone(redisKey, result)
      return of(result)
    } catch (error) {
      // 失败时释放键，允许修正后重试
      try { await this.redis.del(redisKey) } catch { /* 忽略释放失败 */ }
      throw error
    }
  }

  /** 已完成：回放首次执行结果；处理中：提示稍后确认 */
  private replay(raw: string): Observable<unknown> {
    const decision = resolveIdempotentRecord(raw)
    if (decision.action === 'replay') {
      return of(decision.payload)
    }
    throw new ConflictException(decision.message)
  }

  private async markDone(redisKey: string, result: unknown): Promise<void> {
    try {
      await this.redis.set(redisKey, JSON.stringify({ status: 'DONE', payload: result ?? null }), 'EX', TTL_SECONDS)
    } catch {
      // 序列化或写入失败时只标记完成态，重放时提示人工核对
      try { await this.redis.set(redisKey, JSON.stringify({ status: 'DONE' }), 'EX', TTL_SECONDS) } catch { /* 忽略 */ }
    }
  }
}
