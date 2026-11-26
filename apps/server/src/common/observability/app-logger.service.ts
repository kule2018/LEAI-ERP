import { randomBytes } from 'node:crypto'
import type { LoggerService } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { env } from '../../config/env'

declare const require: (id: string) => any

const LEVEL_WEIGHT: Record<string, number> = {
  debug: 10,
  verbose: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60
}

/** 结构化 JSON 日志：替代散落的 console/Nest 默认输出，并可选上报 Sentry */
@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly minLevel = LEVEL_WEIGHT[env.observability.logLevel] ?? 30
  private readonly winston: any

  constructor() {
    try {
      const winston = require('winston')
      this.winston = winston.createLogger({
        level: env.observability.logLevel,
        format: winston.format.json(),
        transports: [new winston.transports.Console()]
      })
    } catch {
      this.winston = null
    }
  }

  log(message: unknown, context?: string): void {
    this.write('info', message, context)
  }

  error(message: unknown, stack?: string, context?: string): void {
    this.write('error', message, context, stack)
    void this.capture('error', message, context, stack)
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context)
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context)
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context)
  }

  fatal(message: unknown, context?: string): void {
    this.write('fatal', message, context)
    void this.capture('fatal', message, context)
  }

  private write(level: string, message: unknown, context?: string, stack?: string): void {
    if ((LEVEL_WEIGHT[level] ?? 30) < this.minLevel) return
    const entry = {
      time: new Date().toISOString(),
      level,
      context: context ?? 'Application',
      message: message instanceof Error ? message.message : message,
      ...(stack ? { stack } : {}),
      ...(message instanceof Error && message.stack ? { errorStack: message.stack } : {})
    }
    if (this.winston) {
      const winstonLevel = level === 'fatal' ? 'error' : level
      this.winston.log({ level: winstonLevel, message: entry.message, context: entry.context })
    } else {
      process.stdout.write(`${JSON.stringify(entry)}\n`)
    }
  }

  private async capture(level: string, message: unknown, context?: string, stack?: string): Promise<void> {
    const dsn = env.observability.sentryDsn
    if (!dsn) return
    try {
      const parsed = new URL(dsn)
      const projectId = parsed.pathname.replace(/^\//, '').split('/').pop()
      if (!projectId || !parsed.username) return
      const eventId = randomBytes(16).toString('hex')
      const response = await fetch(`${parsed.origin}/api/${projectId}/store/`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-sentry-auth': `Sentry sentry_version=7, sentry_client=leaierp-api/1.0, sentry_key=${parsed.username}`
        },
        body: JSON.stringify({
          event_id: eventId,
          timestamp: new Date().toISOString(),
          level,
          platform: 'node',
          environment: env.nodeEnv,
          logger: context ?? 'Application',
          message: message instanceof Error ? message.message : String(message),
          ...(stack ? { stacktrace: { frames: [{ function: stack.split('\n')[0] ?? '' }] } } : {})
        })
      })
      if (!response.ok) process.stderr.write(`Sentry 上报失败：${response.status}\n`)
    } catch {
      // 监控上报不得影响主流程
    }
  }
}
