import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp()
    const response = context.getResponse()
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR
    const message = this.resolveMessage(exception, status)

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(message, exception instanceof Error ? exception.stack : undefined)
    }

    response.status(status).json({
      code: status,
      data: null,
      message
    })
  }

  private resolveMessage(exception: unknown, status: number): string {
    if (exception instanceof HttpException) {
      const payload = exception.getResponse()
      if (typeof payload === 'string') {
        return payload
      }
      if (typeof payload === 'object' && payload !== null) {
        const candidate = payload as Record<string, unknown>
        const message = candidate.message
        if (typeof message === 'string') {
          return message
        }
        if (Array.isArray(message) && message.length > 0) {
          return String(message[0])
        }
      }
    }
    return status >= HttpStatus.INTERNAL_SERVER_ERROR ? '系统异常' : '请求失败'
  }
}
