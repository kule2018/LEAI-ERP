import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Redis } from 'ioredis'
import { FindOptionsWhere, Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { slowSqlCollector } from '../../common/slow-sql-capture'
import { AuditService } from '../audit/audit.service'
import { SysSecurityAlertEntity } from './entities/security-alert.entity'
import { SysSlowSqlLogEntity } from './entities/slow-sql-log.entity'

export interface QuerySecurityAlert {
  page: number
  pageSize: number
  status?: string
  level?: string
}

export interface ConfirmSecurityAlertDto {
  status: 'CONFIRMED' | 'CLOSED'
  comment?: string
}

/**
 * 平台安全治理：越权访问告警落库与确认、慢 SQL 采集查询与落库。
 */
@Injectable()
export class SecurityGuardService {
  constructor(
    @InjectRepository(SysSecurityAlertEntity) private readonly alertRepo: Repository<SysSecurityAlertEntity>,
    @InjectRepository(SysSlowSqlLogEntity) private readonly slowSqlRepo: Repository<SysSlowSqlLogEntity>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly auditService: AuditService
  ) {}

  /** 将 Redis 告警队列落库（同一用户同一权限合并计数） */
  async materializeAlerts(tenantId: number): Promise<number> {
    const key = `security:alerts:${tenantId}`
    const raw = await this.redis.lrange(key, 0, -1)
    if (!raw.length) return 0
    await this.redis.del(key)
    let created = 0
    for (const item of raw) {
      try {
        const payload = JSON.parse(item) as {
          userId: number
          username?: string
          perm?: string
          path?: string
          method?: string
          attempts?: number
          level?: string
          reason?: string
          occurredAt?: string
        }
        const existing = await this.alertRepo.findOne({
          where: {
            tenantId,
            userId: payload.userId,
            perm: payload.perm ?? undefined,
            status: 'OPEN',
            isDeleted: 0
          }
        })
        if (existing) {
          existing.attempts = Math.max(existing.attempts, payload.attempts ?? 1)
          existing.level = payload.level ?? existing.level
          existing.reason = payload.reason ?? existing.reason
          existing.occurredAt = payload.occurredAt ? new Date(payload.occurredAt) : existing.occurredAt
          await this.alertRepo.save(existing)
          continue
        }
        await this.alertRepo.save(this.alertRepo.create({
          tenantId,
          userId: payload.userId,
          username: payload.username ?? null,
          perm: payload.perm ?? null,
          path: payload.path ?? null,
          method: payload.method ?? null,
          attempts: payload.attempts ?? 1,
          level: payload.level ?? 'LOW',
          reason: payload.reason ?? null,
          status: 'OPEN',
          occurredAt: payload.occurredAt ? new Date(payload.occurredAt) : new Date()
        }))
        created += 1
      } catch {
        // 单条解析失败不影响整体落库
      }
    }
    return created
  }

  /** 告警列表 */
  async listAlerts(query: QuerySecurityAlert, user: JwtUser): Promise<PageResult<SysSecurityAlertEntity>> {
    const where: FindOptionsWhere<SysSecurityAlertEntity> = { tenantId: user.tenantId, isDeleted: 0 }
    if (query.status) where.status = query.status
    if (query.level) where.level = query.level
    const [list, total] = await this.alertRepo.findAndCount({
      where,
      order: { occurredAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 确认/关闭告警 */
  async confirmAlert(id: number, dto: ConfirmSecurityAlertDto, user: JwtUser): Promise<SysSecurityAlertEntity> {
    const entity = await this.alertRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('安全告警不存在')
    const before = { ...entity }
    entity.status = dto.status
    entity.confirmedBy = user.userId
    entity.confirmedAt = new Date()
    const saved = await this.alertRepo.save(entity)
    await this.auditService.record({
      bizType: 'security_alert',
      bizId: id,
      action: 'CONFIRM_ALERT',
      beforeValue: before,
      afterValue: { ...saved, comment: dto.comment ?? null }
    }, user)
    return saved
  }

  /** 慢 SQL 明细与聚合 */
  listSlowSql(limit = 50): { entries: ReturnType<typeof slowSqlCollector.list>; aggregate: ReturnType<typeof slowSqlCollector.aggregate> } {
    return { entries: slowSqlCollector.list(limit), aggregate: slowSqlCollector.aggregate() }
  }

  /** 慢 SQL 落库并清空缓冲 */
  async persistSlowSql(tenantId: number): Promise<number> {
    const entries = slowSqlCollector.drain()
    if (!entries.length) return 0
    const rows = entries.map((entry) => this.slowSqlRepo.create({
      tenantId,
      sqlText: entry.sql,
      durationMs: entry.durationMs,
      rowCount: entry.rowCount,
      thresholdMs: entry.thresholdMs,
      capturedAt: new Date(entry.capturedAt)
    }))
    await this.slowSqlRepo.save(rows)
    return rows.length
  }

  /** 慢 SQL 历史查询 */
  async listSlowSqlHistory(limit = 50): Promise<SysSlowSqlLogEntity[]> {
    return this.slowSqlRepo.find({ order: { capturedAt: 'DESC' }, take: limit })
  }
}
