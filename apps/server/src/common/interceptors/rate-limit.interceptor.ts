import { createHash } from 'node:crypto'
import { CallHandler, ExecutionContext, HttpException, HttpStatus, Inject, Injectable, NestInterceptor, OnModuleDestroy } from '@nestjs/common'
import type { Request } from 'express'
import type Redis from 'ioredis'
import { Observable } from 'rxjs'
import { env } from '../../config/env'

const INCR_WITH_TTL = "local c = redis.call('INCR', KEYS[1]); if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); end; return c"

interface RateBucket {
  count: number
  resetAt: number
}

interface RateLimitRequest extends Request {
  user?: { userId?: number }
}

@Injectable()
export class RateLimitInterceptor implements NestInterceptor, OnModuleDestroy {
  private readonly buckets = new Map<string, RateBucket>()
  private readonly timer: NodeJS.Timeout

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {
    this.timer = setInterval(() => this.cleanup(), 60_000)
    this.timer.unref()
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType<string>() !== 'http') {
      return next.handle()
    }
    const request = context.switchToHttp().getRequest<RateLimitRequest>()
    if (request.path === '/api/v1/health' || request.path === '/api/v1/metrics') {
      return next.handle()
    }
    const rawKey = `${request.ip ?? 'unknown'}:${request.user?.userId ?? 'anonymous'}:${request.method}:${request.path}`
    const key = `ratelimit:${createHash('sha1').update(rawKey).digest('hex')}`
    const count = await this.increment(key, env.rateLimit.windowMs)
    if (count > env.rateLimit.max) {
      throw new HttpException('请求过于频繁，请稍后重试', HttpStatus.TOO_MANY_REQUESTS)
    }
    return next.handle()
  }

  /** Redis 原子计数；不可用时降级为进程内计数 */
  private async increment(key: string, windowMs: number): Promise<number> {
    try {
      return Number(await this.redis.eval(INCR_WITH_TTL, 1, key, windowMs))
    } catch {
      const now = Date.now()
      const bucket = this.buckets.get(key)
      if (!bucket || bucket.resetAt <= now) {
        this.buckets.set(key, { count: 1, resetAt: now + windowMs })
        return 1
      }
      bucket.count += 1
      return bucket.count
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.timer)
    this.buckets.clear()
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key)
      }
    }
  }
}
