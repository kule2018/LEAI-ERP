import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { isTaskDue } from '../../common/notify-scheduler-rules'

/** 定时任务可注入的处理器，由业务模块在启动时注册 */
export interface TaskHandlerProvider {
  code: string
  name: string
  intervalMinutes: number
  enabled: boolean
  handler: () => Promise<string>
}

export interface ScheduledTask {
  code: string
  name: string
  intervalMinutes: number
  enabled: boolean
  handler: () => Promise<string>
  lastRunAt?: Date | null
  lastResult?: string
  runCount?: number
}

/**
 * 零依赖定时任务调度器：注册任务后按间隔轮询执行，支持手动触发、启停与执行日志。
 * 任务通过 handler 注入，避免调度模块依赖业务模块造成循环。
 */
@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name)
  private readonly tasks = new Map<string, ScheduledTask>()
  private timer: NodeJS.Timeout | null = null

  constructor() {
    this.register({
      code: 'system.heartbeat',
      name: '系统心跳',
      intervalMinutes: 5,
      enabled: true,
      handler: async () => `HEALTHY at ${new Date().toISOString()}`
    })
  }

  onModuleInit(): void {
    this.timer = setInterval(() => { void this.tick() }, 60 * 1000)
    this.timer.unref?.()
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer)
  }

  register(task: ScheduledTask): void {
    this.tasks.set(task.code, { ...task, lastRunAt: null, runCount: 0 })
  }

  list(): Array<Record<string, unknown>> {
    return [...this.tasks.values()].map((task) => ({
      code: task.code,
      name: task.name,
      intervalMinutes: task.intervalMinutes,
      enabled: task.enabled,
      lastRunAt: task.lastRunAt,
      lastResult: task.lastResult,
      runCount: task.runCount
    }))
  }

  /** 轮询到期任务并执行 */
  async tick(now: Date = new Date()): Promise<Array<{ code: string; result: string }>> {
    const executed: Array<{ code: string; result: string }> = []
    for (const task of this.tasks.values()) {
      if (!isTaskDue({ lastRunAt: task.lastRunAt ?? null, intervalMinutes: task.intervalMinutes, enabled: task.enabled }, now)) continue
      const result = await this.run(task.code)
      executed.push({ code: task.code, result })
    }
    return executed
  }

  /** 手动执行（忽略启用状态与间隔） */
  async run(code: string): Promise<string> {
    const task = this.tasks.get(code)
    if (!task) throw new Error(`任务不存在：${code}`)
    try {
      const result = await task.handler()
      task.lastRunAt = new Date()
      task.lastResult = result
      task.runCount = (task.runCount ?? 0) + 1
      return result
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      task.lastRunAt = new Date()
      task.lastResult = `FAILED: ${message}`
      task.runCount = (task.runCount ?? 0) + 1
      this.logger.error(`任务 ${code} 执行失败：${message}`)
      return task.lastResult
    }
  }
}
