import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsWhere, Like, Repository } from 'typeorm'
import { DATA_SCOPE_LEVEL, buildPageResult, type DataScopeInfo, type JwtUser, type PageResult } from '../../common/contracts'
import { encodeCsv } from '../../common/csv'
import { appendWatermark, buildCsvWatermark, isSensitiveField, maskSensitiveText } from '../../common/export-guard-engine'
import { diffSnapshots } from '../../common/revision-engine'
import { maskSecret } from '../../common/utils/crypto.util'
import { ConfigService } from '../config/config.service'
import { AuditFieldLogEntity } from './entities/audit-field-log.entity'
import { AuditLogEntity } from './entities/audit-log.entity'
import { QueryAuditDto, QueryAuditFieldLogDto } from './dto'

export interface AuditRecordInput {
  bizType: string
  bizId?: number
  action: string
  beforeValue?: unknown
  afterValue?: unknown
  ip?: string | null
  traceId?: string | null
}

/** 单次审计最多记录多少个字段级差异，避免超大快照拖慢写入 */
const MAX_FIELD_LOG_ENTRIES = 60

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity) private readonly repo: Repository<AuditLogEntity>,
    @InjectRepository(AuditFieldLogEntity) private readonly fieldLogRepo: Repository<AuditFieldLogEntity>,
    private readonly configService: ConfigService
  ) {}

  async record(input: AuditRecordInput, user: JwtUser): Promise<AuditLogEntity> {
    const before = this.sanitize(input.beforeValue)
    const after = this.sanitize(input.afterValue)
    const entity = this.repo.create({
      tenantId: user.tenantId,
      bizType: input.bizType,
      bizId: input.bizId ?? 0,
      action: input.action,
      beforeValue: this.stringify(before),
      afterValue: this.stringify(after),
      operator: user.userId,
      operatorName: user.realName || user.username,
      ip: input.ip ?? null,
      traceId: input.traceId ?? null
    })
    const saved = await this.repo.save(entity)
    // 字段级差异：仅当前后都是普通对象时拆解，写入失败不影响主审计记录
    await this.recordFieldLogs(input, before, after, user)
    return saved
  }

  /**
   * 记录字段级变更明细：把审计的前后快照按字段拆解，
   * 复用通用快照比对引擎，保证与版本快照的差异口径一致。
   */
  private async recordFieldLogs(
    input: AuditRecordInput,
    before: unknown,
    after: unknown,
    user: JwtUser
  ): Promise<void> {
    if (!this.isPlainObject(before) || !this.isPlainObject(after)) return
    const entries = diffSnapshots(before, after).slice(0, MAX_FIELD_LOG_ENTRIES)
    if (!entries.length) return
    try {
      await this.fieldLogRepo.save(
        entries.map((entry) =>
          this.fieldLogRepo.create({
            tenantId: user.tenantId,
            bizType: input.bizType,
            bizId: input.bizId ?? 0,
            action: input.action,
            fieldKey: entry.field,
            changeType: entry.type,
            beforeValue: this.stringify(entry.before),
            afterValue: this.stringify(entry.after),
            operator: user.userId,
            operatorName: user.realName || user.username
          })
        )
      )
    } catch {
      // 字段级明细属于增强能力，写入失败静默降级
    }
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value)
  }

  /** 字段级变更明细查询 */
  async listFieldLogs(query: QueryAuditFieldLogDto, user: JwtUser, scope: DataScopeInfo): Promise<PageResult<AuditFieldLogEntity>> {
    const where: FindOptionsWhere<AuditFieldLogEntity> = { tenantId: user.tenantId }
    if (scope.level === DATA_SCOPE_LEVEL.SELF) where.operator = user.userId
    if (query.bizType) where.bizType = query.bizType
    if (query.bizId) where.bizId = query.bizId
    if (query.fieldKey) where.fieldKey = Like(`%${query.fieldKey}%`)
    const [list, total] = await this.fieldLogRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 字段级变更明细导出 */
  async exportFieldLogsCsv(query: QueryAuditFieldLogDto, user: JwtUser, scope: DataScopeInfo): Promise<string> {
    const where: FindOptionsWhere<AuditFieldLogEntity> = { tenantId: user.tenantId }
    if (scope.level === DATA_SCOPE_LEVEL.SELF) where.operator = user.userId
    if (query.bizType) where.bizType = query.bizType
    if (query.bizId) where.bizId = query.bizId
    if (query.fieldKey) where.fieldKey = Like(`%${query.fieldKey}%`)
    const rows = await this.fieldLogRepo.find({ where, order: { id: 'DESC' }, take: 5000 })
    const matrix: Array<Array<string | number>> = [
      ['时间', '业务类型', '业务ID', '动作', '字段', '变更类型', '变更前', '变更后', '操作人']
    ]
    for (const row of rows) {
      matrix.push([
        row.createdAt?.toISOString?.() ?? '',
        row.bizType,
        row.bizId,
        row.action,
        row.fieldKey,
        row.changeType,
        maskSensitiveText(this.truncate(row.beforeValue)),
        maskSensitiveText(this.truncate(row.afterValue)),
        this.maskName(row.operatorName)
      ])
    }
    const watermarkOptions = await this.configService.getExportWatermarkOptions(user.tenantId)
    return encodeCsv(appendWatermark(matrix, buildCsvWatermark(user), watermarkOptions), { bom: true })
  }

  async list(query: QueryAuditDto, user: JwtUser, scope: DataScopeInfo): Promise<PageResult<AuditLogEntity>> {
    const where: FindOptionsWhere<AuditLogEntity> = { tenantId: user.tenantId }
    if (scope.level === DATA_SCOPE_LEVEL.SELF) {
      where.operator = user.userId
    }
    if (query.bizType) {
      where.bizType = query.bizType
    }
    if (query.action) {
      where.action = query.action
    }
    if (query.keyword) {
      where.operatorName = Like(`%${query.keyword}%`)
    }

    const [list, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 审计导出：受数据权限约束，敏感字段脱敏，最多 5000 条 */
  async exportCsv(query: QueryAuditDto, user: JwtUser, scope: DataScopeInfo): Promise<string> {
    const where: FindOptionsWhere<AuditLogEntity> = { tenantId: user.tenantId }
    if (scope.level === DATA_SCOPE_LEVEL.SELF) where.operator = user.userId
    if (query.bizType) where.bizType = query.bizType
    if (query.action) where.action = query.action
    if (query.keyword) where.operatorName = Like(`%${query.keyword}%`)
    const rows = await this.repo.find({ where, order: { createdAt: 'DESC' }, take: 5000 })
    const matrix: Array<Array<string | number>> = [
      ['时间', '业务类型', '业务ID', '动作', '操作人', 'IP', '追踪ID', '变更前', '变更后']
    ]
    for (const row of rows) {
      matrix.push([
        row.createdAt?.toISOString?.() ?? '',
        row.bizType,
        row.bizId,
        row.action,
        this.maskName(row.operatorName),
        this.maskIp(row.ip),
        row.traceId ?? '',
        maskSensitiveText(this.truncate(row.beforeValue)),
        maskSensitiveText(this.truncate(row.afterValue))
      ])
    }
    const watermarkOptions = await this.configService.getExportWatermarkOptions(user.tenantId)
    return encodeCsv(appendWatermark(matrix, buildCsvWatermark(user), watermarkOptions), { bom: true })
  }

  private maskName(value: string | null): string {
    if (!value) return ''
    return value.length <= 2 ? value[0] + '*' : value[0] + '**' + value[value.length - 1]
  }

  private maskIp(value: string | null): string {
    if (!value) return ''
    const parts = value.split('.')
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.**.***` : value
  }

  private truncate(value: string | null): string {
    if (!value) return ''
    return value.length > 500 ? value.slice(0, 500) + '…' : value
  }

  private stringify(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null
    }
    if (typeof value === 'string') {
      return value
    }
    return JSON.stringify(value)
  }

  /** 审计留痕脱敏：敏感字段仅保留掩码，密文字段整体丢弃 */
  private sanitize(value: unknown): unknown {
    if (value === null || value === undefined) return value
    if (Array.isArray(value)) return value.map((item) => this.sanitize(item))
    if (typeof value === 'object') {
      const result: Record<string, unknown> = {}
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        if (key.endsWith('Encrypted')) continue
        if (isSensitiveField(key)) {
          result[key] = typeof item === 'string' && item ? maskSecret(item) : item
          continue
        }
        result[key] = this.sanitize(item)
      }
      return result
    }
    return value
  }
}
