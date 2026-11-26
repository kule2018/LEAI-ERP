import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Redis } from 'ioredis'
import { FindOptionsWhere, Repository } from 'typeorm'
import {
  ALERT_DEFAULT_THRESHOLDS,
  ALERT_METRIC,
  resolveAlertThreshold,
  resolveAlertThresholds,
  type AlertRuleDefinition
} from '../../common/alert-rule-engine'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { AuditService } from '../audit/audit.service'
import { CreateAlertRuleDto, QueryAlertRuleDto, UpdateAlertRuleDto } from './dto'
import { AlertRuleEntity } from './entities/alert-rule.entity'

const CACHE_TTL_MS = 30_000

interface CachedThresholds {
  at: number
  thresholds: Record<string, number>
}

/**
 * 统一告警规则服务：规则维护 + 阈值分发。
 * 业务域（风险扫描、安全守卫、运维监控）统一从这里取阈值，
 * 不再各自维护硬编码常量。
 */
@Injectable()
export class AlertService {
  private readonly cache = new Map<number, CachedThresholds>()

  constructor(
    @InjectRepository(AlertRuleEntity) private readonly repo: Repository<AlertRuleEntity>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly auditService: AuditService
  ) {}

  async list(query: QueryAlertRuleDto, user: JwtUser): Promise<PageResult<AlertRuleEntity>> {
    const where: FindOptionsWhere<AlertRuleEntity> = { tenantId: user.tenantId }
    if (query.bizType) where.bizType = query.bizType
    if (query.metric) where.metric = query.metric
    if (query.enabled !== undefined) where.enabled = query.enabled ? 1 : 0
    const [list, total] = await this.repo.findAndCount({
      where,
      order: { bizType: 'ASC', metric: 'ASC', id: 'ASC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async create(dto: CreateAlertRuleDto, user: JwtUser): Promise<AlertRuleEntity> {
    const ruleCode = dto.ruleCode.trim()
    const exists = await this.repo.findOne({ where: { tenantId: user.tenantId, ruleCode } })
    if (exists) throw new BadRequestException('规则编码已存在')
    const entity = this.repo.create({
      tenantId: user.tenantId,
      ruleCode,
      ruleName: dto.ruleName.trim(),
      bizType: dto.bizType.trim(),
      metric: dto.metric.trim(),
      comparator: dto.comparator ?? 'GTE',
      threshold: String(dto.threshold),
      windowMinutes: dto.windowMinutes ?? 0,
      severity: dto.severity ?? 'MEDIUM',
      notifyChannels: dto.notifyChannels ?? null,
      enabled: dto.enabled === false ? 0 : 1,
      description: dto.description?.trim() ?? null,
      createdBy: user.userId
    })
    const saved = await this.repo.save(entity)
    await this.afterChange(user.tenantId)
    await this.auditService.record({
      bizType: 'alert_rule',
      bizId: saved.id,
      action: 'CREATE_ALERT_RULE',
      afterValue: { ruleCode: saved.ruleCode, metric: saved.metric, threshold: saved.threshold }
    }, user)
    return saved
  }

  async update(id: number, dto: UpdateAlertRuleDto, user: JwtUser): Promise<AlertRuleEntity> {
    const entity = await this.findRule(id, user)
    const before = { ...entity }
    if (dto.ruleName !== undefined) entity.ruleName = dto.ruleName.trim()
    if (dto.bizType !== undefined) entity.bizType = dto.bizType.trim()
    if (dto.metric !== undefined) entity.metric = dto.metric.trim()
    if (dto.comparator !== undefined) entity.comparator = dto.comparator
    if (dto.threshold !== undefined) entity.threshold = String(dto.threshold)
    if (dto.windowMinutes !== undefined) entity.windowMinutes = dto.windowMinutes
    if (dto.severity !== undefined) entity.severity = dto.severity
    if (dto.notifyChannels !== undefined) entity.notifyChannels = dto.notifyChannels
    if (dto.enabled !== undefined) entity.enabled = dto.enabled ? 1 : 0
    if (dto.description !== undefined) entity.description = dto.description?.trim() ?? null
    entity.updatedAt = new Date()
    const saved = await this.repo.save(entity)
    await this.afterChange(user.tenantId)
    await this.auditService.record({
      bizType: 'alert_rule',
      bizId: id,
      action: 'UPDATE_ALERT_RULE',
      beforeValue: { ruleCode: before.ruleCode, metric: before.metric, threshold: before.threshold, enabled: before.enabled },
      afterValue: { metric: saved.metric, threshold: saved.threshold, enabled: saved.enabled }
    }, user)
    return saved
  }

  async remove(id: number, user: JwtUser): Promise<{ id: number }> {
    const entity = await this.findRule(id, user)
    await this.repo.remove(entity)
    await this.afterChange(user.tenantId)
    await this.auditService.record({
      bizType: 'alert_rule',
      bizId: id,
      action: 'DELETE_ALERT_RULE',
      beforeValue: { ruleCode: entity.ruleCode, metric: entity.metric, threshold: entity.threshold }
    }, user)
    return { id }
  }

  /** 规则定义的业务视图，供引擎计算使用 */
  async definitions(tenantId: number, bizType?: string): Promise<AlertRuleDefinition[]> {
    const rows = await this.repo.find({ where: { tenantId, ...(bizType ? { bizType } : {}) } })
    return rows.map((row) => this.toDefinition(row))
  }

  /** 阈值查询：命中已启用规则，未配置时回落到内置默认值 */
  async thresholds(tenantId: number, metrics?: string[]): Promise<Record<string, number>> {
    const cached = this.cache.get(tenantId)
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      if (!metrics) return { ...cached.thresholds }
      const result: Record<string, number> = {}
      for (const metric of metrics) {
        result[metric] = cached.thresholds[metric] ?? ALERT_DEFAULT_THRESHOLDS[metric] ?? 0
      }
      return result
    }
    const rules = await this.definitions(tenantId)
    const thresholds = resolveAlertThresholds(rules, metrics ?? Object.keys(ALERT_DEFAULT_THRESHOLDS))
    this.cache.set(tenantId, { at: Date.now(), thresholds: { ...thresholds } })
    return thresholds
  }

  /** 单指标阈值 */
  async threshold(tenantId: number, metric: string): Promise<number> {
    const thresholds = await this.thresholds(tenantId, [metric])
    return thresholds[metric] ?? 0
  }

  /** 规则变更后刷新缓存并向 Redis 广播，供守卫等无状态组件读取 */
  private async afterChange(tenantId: number): Promise<void> {
    this.cache.delete(tenantId)
    await this.publishToRedis(tenantId)
  }

  /** 广播阈值到 Redis：键 alert:thresholds:{tenantId} */
  async publishToRedis(tenantId: number): Promise<void> {
    try {
      const rules = await this.definitions(tenantId)
      const payload: Record<string, number> = {}
      for (const rule of rules) {
        if (!rule.enabled) continue
        payload[rule.metric] = Number(rule.threshold)
      }
      await this.redis.set(`alert:thresholds:${tenantId}`, JSON.stringify(payload))
    } catch {
      // 广播失败不影响规则落库，下一次读取会重新加载
    }
  }

  private toDefinition(row: AlertRuleEntity): AlertRuleDefinition {
    return {
      ruleCode: row.ruleCode,
      bizType: row.bizType,
      metric: row.metric,
      comparator: row.comparator,
      threshold: Number(row.threshold),
      windowMinutes: row.windowMinutes,
      severity: row.severity,
      enabled: row.enabled === 1,
      notifyChannels: row.notifyChannels ?? []
    }
  }

  private async findRule(id: number, user: JwtUser): Promise<AlertRuleEntity> {
    const entity = await this.repo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('告警规则不存在')
    return entity
  }
}

/** 默认规则模板：租户首次访问时按内置口径补齐，保证各业务域始终能取到阈值 */
export const DEFAULT_ALERT_RULE_TEMPLATES: Array<{
  ruleCode: string
  ruleName: string
  bizType: string
  metric: string
  comparator: string
  threshold: number
  windowMinutes: number
  severity: string
  description: string
}> = [
  {
    ruleCode: 'RISK_CREDIT_OVER_RATIO',
    ruleName: '信用超限高危比例',
    bizType: 'risk_alert',
    metric: ALERT_METRIC.CREDIT_OVER_RATIO,
    comparator: 'GT',
    threshold: ALERT_DEFAULT_THRESHOLDS[ALERT_METRIC.CREDIT_OVER_RATIO],
    windowMinutes: 0,
    severity: 'HIGH',
    description: '超限金额超过授信额度该比例时判定为高危'
  },
  {
    ruleCode: 'RISK_STOCK_CRITICAL_RATIO',
    ruleName: '库存低于安全线高危比例',
    bizType: 'risk_alert',
    metric: ALERT_METRIC.STOCK_CRITICAL_RATIO,
    comparator: 'LTE',
    threshold: ALERT_DEFAULT_THRESHOLDS[ALERT_METRIC.STOCK_CRITICAL_RATIO],
    windowMinutes: 0,
    severity: 'HIGH',
    description: '现有库存不高于安全库存该比例时判定为高危'
  },
  {
    ruleCode: 'RISK_AR_MEDIUM_DAYS',
    ruleName: '应收逾期中危天数',
    bizType: 'risk_alert',
    metric: ALERT_METRIC.AR_MEDIUM_DAYS,
    comparator: 'GT',
    threshold: ALERT_DEFAULT_THRESHOLDS[ALERT_METRIC.AR_MEDIUM_DAYS],
    windowMinutes: 0,
    severity: 'MEDIUM',
    description: '逾期天数大于该值判定为中危'
  },
  {
    ruleCode: 'RISK_AR_HIGH_DAYS',
    ruleName: '应收逾期高危天数',
    bizType: 'risk_alert',
    metric: ALERT_METRIC.AR_HIGH_DAYS,
    comparator: 'GT',
    threshold: ALERT_DEFAULT_THRESHOLDS[ALERT_METRIC.AR_HIGH_DAYS],
    windowMinutes: 0,
    severity: 'HIGH',
    description: '逾期天数大于该值判定为高危'
  },
  {
    ruleCode: 'SECURITY_UNAUTHORIZED_ATTEMPTS',
    ruleName: '越权访问告警次数',
    bizType: 'security_alert',
    metric: ALERT_METRIC.SECURITY_UNAUTHORIZED_ATTEMPTS,
    comparator: 'GTE',
    threshold: ALERT_DEFAULT_THRESHOLDS[ALERT_METRIC.SECURITY_UNAUTHORIZED_ATTEMPTS],
    windowMinutes: 5,
    severity: 'HIGH',
    description: '窗口内累计越权次数达到该值触发安全告警'
  },
  {
    ruleCode: 'OPS_SLOW_REQUEST_MS',
    ruleName: '慢请求耗时阈值',
    bizType: 'ops_monitor',
    metric: ALERT_METRIC.OPS_SLOW_REQUEST_MS,
    comparator: 'GT',
    threshold: ALERT_DEFAULT_THRESHOLDS[ALERT_METRIC.OPS_SLOW_REQUEST_MS],
    windowMinutes: 10,
    severity: 'LOW',
    description: '请求耗时超过该毫秒数记为慢请求'
  },
  {
    ruleCode: 'OPS_ERROR_RATE',
    ruleName: '错误率告警阈值',
    bizType: 'ops_monitor',
    metric: ALERT_METRIC.OPS_ERROR_RATE,
    comparator: 'GT',
    threshold: ALERT_DEFAULT_THRESHOLDS[ALERT_METRIC.OPS_ERROR_RATE],
    windowMinutes: 10,
    severity: 'MEDIUM',
    description: '窗口内错误率超过该比例触发告警'
  }
]

/** 便捷函数：按规则集合解析单个指标阈值 */
export function resolveRuleThreshold(rules: AlertRuleDefinition[], metric: string): number {
  return resolveAlertThreshold(rules, metric)
}
