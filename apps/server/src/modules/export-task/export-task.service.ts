import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Queue, Worker, type Job } from 'bullmq'
import { FindOptionsWhere, Repository } from 'typeorm'
import { buildPageResult, DATA_SCOPE_LEVEL, type DataScopeLevel, type JwtUser, type PageResult } from '../../common/contracts'
import { currentScope, enterScope } from '../../common/data-scope-context'
import { env } from '../../config/env'
import { AuditService } from '../audit/audit.service'
import { IoService } from '../io/io.service'
import { SchedulerService } from '../ops/scheduler.service'
import { ExportTaskEntity } from './entities/export-task.entity'

const QUEUE_NAME = 'erp-export'

interface ExportJobData {
  taskId: number
  tenantId: number
  userId: number
}

interface ExportScopeSnapshot {
  level: DataScopeLevel
  orgId: number | null
  orgField?: string
  childOrgIds?: number[]
}

/**
 * 导出任务服务：
 * - 优先使用 BullMQ 队列异步执行（多实例可并行消费）；
 * - Redis 不可用时降级为进程内异步执行，并由调度器兜底扫描 PENDING 任务；
 * - 任务状态、结果文件与错误信息全部落库，前端可轮询与下载。
 */
@Injectable()
export class ExportTaskService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExportTaskService.name)
  private queue: Queue | null = null
  private worker: Worker | null = null
  private queueReady = false

  constructor(
    @InjectRepository(ExportTaskEntity) private readonly repo: Repository<ExportTaskEntity>,
    private readonly ioService: IoService,
    private readonly auditService: AuditService,
    private readonly scheduler: SchedulerService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.setupQueue()
    // 兜底执行器：队列不可用或任务积压时，保证 PENDING 任务最终被处理
    this.scheduler.register({
      code: 'export.task.worker',
      name: '导出任务兜底执行器',
      intervalMinutes: 1,
      enabled: true,
      handler: async () => this.processPendingTasks()
    })
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close().catch(() => undefined)
    await this.queue?.close().catch(() => undefined)
  }

  /** 初始化 BullMQ 队列与消费者；Redis 不可用时静默降级 */
  private async setupQueue(): Promise<void> {
    const connection = {
      host: env.redis.host,
      port: env.redis.port,
      password: env.redis.password,
      maxRetriesPerRequest: null as unknown as number
    }
    try {
      this.queue = new Queue(QUEUE_NAME, { connection })
      this.queue.on('error', (cause) => {
        this.logger.warn(`导出队列异常，降级为进程内执行：${String(cause)}`)
        this.queueReady = false
      })
      await this.queue.waitUntilReady()
      this.worker = new Worker(QUEUE_NAME, async (job: Job<ExportJobData>) => {
        await this.execute(job.data.taskId)
      }, { connection })
      this.worker.on('error', (cause) => {
        this.logger.warn(`导出消费者异常：${String(cause)}`)
      })
      this.queueReady = true
      this.logger.log('导出队列已就绪（BullMQ）')
    } catch (cause) {
      this.queueReady = false
      this.logger.warn(`BullMQ 不可用，导出任务降级为进程内执行：${String(cause)}`)
      await this.queue?.close().catch(() => undefined)
      this.queue = null
    }
  }

  /** 创建导出任务：落库后投递队列（不可用时进程内异步执行） */
  async create(dto: { code: string; bizType?: string; params?: Record<string, unknown> }, user: JwtUser): Promise<ExportTaskEntity> {
    const task = this.repo.create({
      tenantId: user.tenantId,
      code: dto.code,
      bizType: dto.bizType ?? null,
      status: 'PENDING',
      params: { ...(dto.params ?? {}), __scope: this.buildScopeSnapshot(user) },
      createdBy: user.userId
    })
    const saved = await this.repo.save(task)
    await this.auditService.record(
      { bizType: 'export_task', bizId: saved.id, action: 'CREATE_EXPORT_TASK', afterValue: { code: saved.code, params: saved.params } },
      user
    )
    await this.enqueue(saved, user)
    return saved
  }

  /** 投递任务到队列；队列不可用时降级为进程内异步执行 */
  private async enqueue(task: ExportTaskEntity, user: JwtUser): Promise<void> {
    if (this.queue && this.queueReady) {
      try {
        const job = await this.queue.add(
          'export',
          { taskId: task.id, tenantId: user.tenantId, userId: user.userId },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: 200,
            removeOnFail: 200
          }
        )
        task.queueJobId = job.id ?? null
        await this.repo.save(task)
        return
      } catch (cause) {
        this.queueReady = false
        this.logger.warn(`导出任务投递失败，降级为进程内执行：${String(cause)}`)
      }
    }
    setTimeout(() => {
      void this.execute(task.id)
    }, 0)
  }

  /** 执行导出任务：生成 CSV 并更新状态 */
  async execute(taskId: number): Promise<string> {
    const task = await this.repo.findOne({ where: { id: taskId } })
    if (!task) return '任务不存在'
    if (task.status === 'DONE') return '任务已完成'
    task.status = 'RUNNING'
    task.startedAt = new Date()
    await this.repo.save(task)

    const snapshot = this.parseScopeSnapshot(task.params?.__scope)
    const actor: JwtUser = {
      userId: task.createdBy ?? 0,
      tenantId: task.tenantId,
      username: 'export-task',
      realName: '导出任务',
      orgId: snapshot?.orgId ?? null,
      roles: [],
      permissions: [],
      isSuperAdmin: false,
      dataScopeLevel: snapshot?.level ?? DATA_SCOPE_LEVEL.SELF
    }
    enterScope({
      org: snapshot?.orgField === 'org_id' ? 'org' : snapshot?.orgField === 'created_by' ? 'created_by' : 'dept',
      level: actor.dataScopeLevel,
      orgId: actor.orgId,
      ...(snapshot?.orgField ? { orgField: snapshot.orgField } : {}),
      ...(snapshot?.childOrgIds ? { childOrgIds: snapshot.childOrgIds } : {})
    })

    try {
      const result = await this.ioService.exportResource(task.code, actor)
      task.status = 'DONE'
      task.fileName = result.filename
      task.content = result.content
      task.rowCount = result.rowCount
      task.resultUrl = `/api/v1/system/export-task/${task.id}/content`
      task.errorMessage = null
      task.finishedAt = new Date()
      await this.repo.save(task)
      return `导出任务 ${taskId} 完成，共 ${result.rowCount} 行`
    } catch (cause) {
      task.status = 'FAILED'
      task.errorMessage = String(cause instanceof Error ? cause.message : cause).slice(0, 1000)
      task.finishedAt = new Date()
      await this.repo.save(task)
      return `导出任务 ${taskId} 失败：${task.errorMessage}`
    }
  }

  /** 兜底扫描：处理仍处于 PENDING 的任务（队列异常或重启后遗留） */
  async processPendingTasks(): Promise<string> {
    const pending = await this.repo.find({ where: { status: 'PENDING' }, take: 10 })
    if (!pending.length) return '无待处理导出任务'
    for (const task of pending) {
      await this.execute(task.id)
    }
    return `处理导出任务 ${pending.length} 个`
  }

  /** 导出任务列表（按租户隔离） */
  async list(query: { page?: number; pageSize?: number; status?: string; code?: string }, user: JwtUser): Promise<PageResult<ExportTaskEntity>> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const where: FindOptionsWhere<ExportTaskEntity> = { tenantId: user.tenantId }
    if (query.status) where.status = query.status
    if (query.code) where.code = query.code
    const [list, total] = await this.repo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
    return buildPageResult(list, total, page, pageSize)
  }

  /** 任务详情 */
  async detail(id: number, user: JwtUser): Promise<ExportTaskEntity> {
    const task = await this.repo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!task) throw new NotFoundException('导出任务不存在')
    return task
  }

  /** 读取导出文件内容 */
  async content(id: number, user: JwtUser): Promise<string> {
    const task = await this.detail(id, user)
    if (task.status !== 'DONE' || !task.content) throw new NotFoundException('导出文件尚未生成')
    return task.content
  }

  /** 重新执行失败或未完成的任务 */
  async retry(id: number, user: JwtUser): Promise<ExportTaskEntity> {
    const task = await this.detail(id, user)
    task.status = 'PENDING'
    task.errorMessage = null
    task.startedAt = null
    task.finishedAt = null
    const saved = await this.repo.save(task)
    await this.enqueue(saved, user)
    return saved
  }

  /** 队列是否可用（供健康检查展示） */
  get queueEnabled(): boolean {
    return this.queueReady
  }

  private buildScopeSnapshot(user: JwtUser): ExportScopeSnapshot {
    const scope = currentScope()
    return {
      level: scope?.level ?? user.dataScopeLevel ?? DATA_SCOPE_LEVEL.SELF,
      orgId: scope?.orgId ?? user.orgId,
      ...(scope?.orgField ? { orgField: scope.orgField } : {}),
      ...(scope?.childOrgIds ? { childOrgIds: scope.childOrgIds } : {})
    }
  }

  private parseScopeSnapshot(raw: unknown): ExportScopeSnapshot | undefined {
    if (!raw || typeof raw !== 'object') return undefined
    const candidate = raw as Partial<ExportScopeSnapshot>
    if (!candidate.level) return undefined
    return {
      level: candidate.level,
      orgId: candidate.orgId ?? null,
      ...(candidate.orgField ? { orgField: candidate.orgField } : {}),
      ...(candidate.childOrgIds ? { childOrgIds: candidate.childOrgIds } : {})
    }
  }
}
