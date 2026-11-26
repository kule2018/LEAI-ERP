import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsWhere, In, Repository } from 'typeorm'
import {
  matchNotifyRules,
  NOTIFY_RECEIVER_TYPES,
  requiresExplicitReceiver,
  resolveRuleChannels,
  type NotifyLevel,
  type NotifyRuleDefinition
} from '../../common/notify-rule-engine'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { AuditService } from '../audit/audit.service'
import { UserEntity } from '../platform/entities/user.entity'
import { UserRoleEntity } from '../platform/entities/user-role.entity'
import { CreateNotifyRuleDto, QueryNotifyRuleDto, UpdateNotifyRuleDto } from './dto'
import { NotifyRuleEntity } from './entities/notify-rule.entity'

/**
 * 统一通知规则服务：规则维护 + 事件匹配 + 接收人解析。
 */
@Injectable()
export class NotifyRuleService {
  constructor(
    @InjectRepository(NotifyRuleEntity) private readonly repo: Repository<NotifyRuleEntity>,
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(UserRoleEntity) private readonly userRoleRepo: Repository<UserRoleEntity>,
    private readonly auditService: AuditService
  ) {}

  async list(query: QueryNotifyRuleDto, user: JwtUser): Promise<PageResult<NotifyRuleEntity>> {
    const where: FindOptionsWhere<NotifyRuleEntity> = { tenantId: user.tenantId }
    if (query.eventType) where.eventType = query.eventType
    if (query.bizType) where.bizType = query.bizType
    if (query.enabled !== undefined) where.enabled = query.enabled ? 1 : 0
    const [list, total] = await this.repo.findAndCount({
      where,
      order: { eventType: 'ASC', priority: 'ASC', id: 'ASC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async create(dto: CreateNotifyRuleDto, user: JwtUser): Promise<NotifyRuleEntity> {
    const ruleCode = dto.ruleCode.trim()
    const exists = await this.repo.findOne({ where: { tenantId: user.tenantId, ruleCode } })
    if (exists) throw new BadRequestException('通知规则编码已存在')
    const entity = this.repo.create({
      tenantId: user.tenantId,
      ruleCode,
      ruleName: dto.ruleName.trim(),
      eventType: dto.eventType.trim(),
      bizType: dto.bizType.trim(),
      templateCode: dto.templateCode.trim(),
      channels: dto.channels ?? null,
      level: dto.level ?? 'MEDIUM',
      receiverType: dto.receiverType ?? 'ROLE',
      receiverIds: dto.receiverIds ?? null,
      priority: dto.priority ?? 100,
      enabled: dto.enabled === false ? 0 : 1,
      description: dto.description?.trim() ?? null,
      createdBy: user.userId
    })
    const saved = await this.repo.save(entity)
    await this.auditService.record({
      bizType: 'notify_rule',
      bizId: saved.id,
      action: 'CREATE_NOTIFY_RULE',
      afterValue: { ruleCode: saved.ruleCode, eventType: saved.eventType, templateCode: saved.templateCode }
    }, user)
    return saved
  }

  async update(id: number, dto: UpdateNotifyRuleDto, user: JwtUser): Promise<NotifyRuleEntity> {
    const entity = await this.findRule(id, user)
    const before = { ...entity }
    if (dto.ruleName !== undefined) entity.ruleName = dto.ruleName.trim()
    if (dto.eventType !== undefined) entity.eventType = dto.eventType.trim()
    if (dto.bizType !== undefined) entity.bizType = dto.bizType.trim()
    if (dto.templateCode !== undefined) entity.templateCode = dto.templateCode.trim()
    if (dto.channels !== undefined) entity.channels = dto.channels
    if (dto.level !== undefined) entity.level = dto.level
    if (dto.receiverType !== undefined) entity.receiverType = dto.receiverType
    if (dto.receiverIds !== undefined) entity.receiverIds = dto.receiverIds
    if (dto.priority !== undefined) entity.priority = dto.priority
    if (dto.enabled !== undefined) entity.enabled = dto.enabled ? 1 : 0
    if (dto.description !== undefined) entity.description = dto.description?.trim() ?? null
    entity.updatedAt = new Date()
    const saved = await this.repo.save(entity)
    await this.auditService.record({
      bizType: 'notify_rule',
      bizId: id,
      action: 'UPDATE_NOTIFY_RULE',
      beforeValue: { eventType: before.eventType, templateCode: before.templateCode, enabled: before.enabled },
      afterValue: { eventType: saved.eventType, templateCode: saved.templateCode, enabled: saved.enabled }
    }, user)
    return saved
  }

  async remove(id: number, user: JwtUser): Promise<{ id: number }> {
    const entity = await this.findRule(id, user)
    await this.repo.remove(entity)
    await this.auditService.record({
      bizType: 'notify_rule',
      bizId: id,
      action: 'DELETE_NOTIFY_RULE',
      beforeValue: { ruleCode: entity.ruleCode, eventType: entity.eventType }
    }, user)
    return { id }
  }

  /** 事件匹配的规则定义，供通知派发使用 */
  async match(eventType: string, tenantId: number, minLevel?: NotifyLevel): Promise<NotifyRuleDefinition[]> {
    const rows = await this.repo.find({ where: { tenantId, eventType } })
    return matchNotifyRules(rows.map((row) => this.toDefinition(row)), eventType, minLevel)
  }

  /** 解析规则接收人 ID 列表 */
  async resolveReceivers(
    rule: NotifyRuleDefinition,
    tenantId: number,
    context: { ownerUserId?: number | null } = {}
  ): Promise<number[]> {
    const ids = rule.receiverIds ?? []
    switch (rule.receiverType) {
      case 'USER':
        return [...new Set(ids)]
      case 'ROLE': {
        if (ids.length === 0) return []
        const links = await this.userRoleRepo.find({ where: { tenantId, roleId: In(ids) } })
        return [...new Set(links.map((link) => link.userId))]
      }
      case 'BIZ_OWNER':
        return context.ownerUserId ? [context.ownerUserId] : []
      case 'ALL': {
        const users = await this.userRepo.find({ where: { tenantId, status: 'ACTIVE', isDeleted: 0 } })
        return users.map((item) => item.id)
      }
      default:
        return []
    }
  }

  /** 规则渠道解析：规则渠道优先，缺失时回落到模板渠道 */
  resolveChannels(rule: NotifyRuleDefinition, fallback: string[]): string[] {
    return resolveRuleChannels(rule, fallback)
  }

  /** 规则完整性校验：缺少显式接收人时提示管理员补全 */
  validateCompleteness(rule: NotifyRuleDefinition): string | null {
    if (requiresExplicitReceiver(rule)) {
      return `规则 ${rule.ruleCode} 的接收人未配置`
    }
    return null
  }

  private toDefinition(row: NotifyRuleEntity): NotifyRuleDefinition {
    return {
      ruleCode: row.ruleCode,
      ruleName: row.ruleName,
      eventType: row.eventType,
      bizType: row.bizType,
      templateCode: row.templateCode,
      channels: (row.channels ?? '').split(',').map((item) => item.trim()).filter(Boolean),
      level: row.level as NotifyLevel,
      receiverType: (NOTIFY_RECEIVER_TYPES as readonly string[]).includes(row.receiverType)
        ? (row.receiverType as NotifyRuleDefinition['receiverType'])
        : 'ROLE',
      receiverIds: Array.isArray(row.receiverIds) ? row.receiverIds : [],
      priority: row.priority,
      enabled: row.enabled === 1
    }
  }

  private async findRule(id: number, user: JwtUser): Promise<NotifyRuleEntity> {
    const entity = await this.repo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('通知规则不存在')
    return entity
  }
}
