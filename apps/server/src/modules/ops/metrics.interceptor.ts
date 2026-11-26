import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import type { Response } from 'express'
import { Observable, tap } from 'rxjs'
import { MetricsService } from './metrics.service'

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<string>() !== 'http') {
      return next.handle()
    }
    const response = context.switchToHttp().getResponse<Response>()
    const request = context.switchToHttp().getRequest<{ method?: string; originalUrl?: string }>()
    const method = request.method ?? 'UNKNOWN'
    const url = request.originalUrl ?? ''
    const started = Date.now()
    return next.handle().pipe(
      tap({
        next: () => this.metrics.record(method, response.statusCode, Date.now() - started, url),
        error: () => this.metrics.record(method, response.statusCode || 500, Date.now() - started, url)
      })
    )
  }
}
