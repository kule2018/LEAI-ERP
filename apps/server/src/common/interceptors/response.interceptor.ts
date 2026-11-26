import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable, map } from 'rxjs'

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<string>() === 'sse') {
      return next.handle()
    }
    return next.handle().pipe(
      map((data: unknown) => {
        if (Buffer.isBuffer(data)) {
          return data
        }
        if (this.isWrapped(data)) {
          return data
        }
        return { code: 0, data: data ?? null, message: 'success' }
      })
    )
  }

  private isWrapped(data: unknown): boolean {
    if (typeof data !== 'object' || data === null) {
      return false
    }
    const candidate = data as Record<string, unknown>
    return typeof candidate.code === 'number' && typeof candidate.message === 'string'
  }
}
