import { randomBytes } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsWhere, Like, Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import type { NotifyLevel } from '../../common/notify-rule-engine'
import { renderTemplate, selectChannels, shouldRetry, extractTemplateVariables } from '../../common/notify-scheduler-rules'
import {
  buildNotifyDeliveryPayload,
  evaluateDeliveryResponse,
  evaluateNotifyChannelConfig,
  isExternalChannel,
  NOTIFY_CHANNELS
} from '../../common/platform-guard-engine'
import { env } from '../../config/env'
import { AuditService } from '../audit/audit.service'
import { UserEntity } from '../platform/entities/user.entity'
import {
  CreateNotificationDto,
  CreateNotifyTemplateDto,
  DispatchNotifyEventDto,
  QueryNotificationDto,
  QueryNotifySendRecordDto,
  SendByTemplateDto,
  TestNotifyChannelDto,
  UpdateNotificationDto,
  UpdateNotifyTemplateDto
} from './dto'
import { NotificationEntity } from './entities/notification.entity'
import { NotifyTemplateEntity } from './entities/notify-template.entity'
import { NotifyRuleService } from './notify-rule.service'

@Injectable()
export class NotifyService {
  constructor(
    @InjectRepository(NotificationEntity) private readonly repo: Repository<NotificationEntity>,
    @InjectRepository(NotifyTemplateEntity) private readonly templateRepo: Repository<NotifyTemplateEntity>,
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    private readonly notifyRuleService: NotifyRuleService,
    private readonly auditService: AuditService
  ) {}

  async list(query: QueryNotificationDto, user: JwtUser): Promise<PageResult<NotificationEntity>> {
    const where: FindOptionsWhere<NotificationEntity> = {
      tenantId: user.tenantId,
      receiverId: user.userId,
      isDeleted: 0
    }
    if (query.readFlag) {
      where.readFlag = query.readFlag
    }
    if (query.channel) {
      where.channel = query.channel
    }
    if (query.keyword) {
      where.title = Like(`%${query.keyword}%`)
    }
    const [list, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async create(dto: CreateNotificationDto, user: JwtUser): Promise<NotificationEntity> {
    const suffix = randomBytes(3).toString('hex').toUpperCase()
    const entity = this.repo.create({
      ...dto,
      tenantId: user.tenantId,
      notifyNo: `N${Date.now()}${suffix}`,
      readFlag: 'NO',
      content: dto.content ?? null,
      bizType: dto.bizType ?? null,
      bizId: dto.bizId ?? null
    })
    const saved = await this.repo.save(entity)
    await this.auditService.record({ bizType: 'notify', bizId: saved.id, action: 'CREATE_NOTIFY', afterValue: saved }, user)
    return saved
  }

  async markRead(id: number, dto: UpdateNotificationDto, user: JwtUser): Promise<NotificationEntity> {
    const entity = await this.repo.findOne({
      where: { id, tenantId: user.tenantId, receiverId: user.userId, isDeleted: 0 }
    })
    if (!entity) {
      throw new NotFoundException('通知不存在')
    }
    const before = { ...entity }
    Object.assign(entity, dto)
    const saved = await this.repo.save(entity)
    await this.auditService.record({ bizType: 'notify', bizId: id, action: 'READ_NOTIFY', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  /** 创建通知模板（变量用 {{key}} 占位） */
  async createTemplate(dto: CreateNotifyTemplateDto, user: JwtUser): Promise<NotifyTemplateEntity> {
    const existing = await this.templateRepo.findOne({ where: { tenantId: user.tenantId, code: dto.code } })
    if (existing) throw new NotFoundException('通知模板编码已存在')
    this.validateChannels(dto.channels ?? 'INMAIL')
    // 模板变量校验：占位符必须是合法标识符，且成对闭合
    const text = `${dto.title} ${dto.content}`
    const placeholders = [...text.matchAll(/\{\{([^}]*)\}\}/g)]
    const openCount = (text.match(/\{\{/g) ?? []).length
    const closeCount = (text.match(/\}\}/g) ?? []).length
    if (openCount !== closeCount) throw new BadRequestException('模板变量括号不匹配')
    for (const match of placeholders) {
      if (!/^\s*\w+\s*$/.test(match[1])) throw new BadRequestException(`模板变量名非法：${match[1]}`)
    }
    const entity = await this.templateRepo.save(this.templateRepo.create({
      ...dto,
      tenantId: user.tenantId,
      channels: dto.channels ?? 'INMAIL',
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'notify_template', bizId: entity.id, action: 'CREATE_TEMPLATE', afterValue: entity }, user)
    return entity
  }

  /** 模板列表（含启停状态与解析出的变量清单） */
  async listTemplates(user: JwtUser): Promise<Array<NotifyTemplateEntity & { variables: string[] }>> {
    const templates = await this.templateRepo.find({ where: { tenantId: user.tenantId }, order: { id: 'DESC' } })
    return templates.map((template) => ({
      ...template,
      variables: extractTemplateVariables(`${template.title} ${template.content}`)
    }))
  }

  /**
   * 发送记录查询：租户级管理视角，支持按渠道、发送状态、模板编码与关键字检索。
   */
  async listSendRecords(query: QueryNotifySendRecordDto, user: JwtUser): Promise<PageResult<NotificationEntity>> {
    const where: FindOptionsWhere<NotificationEntity> = { tenantId: user.tenantId, isDeleted: 0 }
    if (query.sendStatus) where.sendStatus = query.sendStatus
    if (query.channel) where.channel = query.channel
    if (query.templateCode) where.templateCode = query.templateCode
    if (query.keyword) where.title = Like(`%${query.keyword}%`)
    const [list, total] = await this.repo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /**
   * 按模板发送：渲染标题/内容，多渠道生成通知记录。
   * 站内信落库即成功；外部渠道按网关配置真实投递，未配置网关则记为待投递。
   */
  async sendByTemplate(code: string, dto: SendByTemplateDto, user: JwtUser): Promise<NotificationEntity[]> {
    const template = await this.templateRepo.findOne({ where: { tenantId: user.tenantId, code, status: 'ACTIVE' } })
    if (!template) throw new NotFoundException('通知模板不存在')
    const requiredVariables = extractTemplateVariables(`${template.title} ${template.content}`)
    const missing = requiredVariables.filter((name) => dto.variables?.[name] === undefined || dto.variables?.[name] === null)
    if (missing.length > 0) throw new BadRequestException(`模板变量缺失：${missing.join('、')}`)
    const channels = selectChannels(
      (template.channels ?? 'INMAIL').split(',').map((c) => c.trim()).filter(Boolean),
      dto.level ?? 'LOW'
    )
    const title = renderTemplate(template.title, dto.variables)
    const content = renderTemplate(template.content, dto.variables)
    const receiver = await this.userRepo.findOne({ where: { id: dto.receiverId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!receiver) throw new NotFoundException('通知接收人不存在')
    return this.sendToReceiver(template, receiver, channels, title, content, dto.variables, dto.bizType, dto.bizId, user)
  }

  /**
   * 事件驱动的通知派发：按 notify_rule 匹配事件规则，解析模板与接收人后投递。
   * 规则未命中时返回空数组，不影响业务主流程。
   */
  async dispatchByEvent(eventType: string, dto: DispatchNotifyEventDto, user: JwtUser): Promise<NotificationEntity[]> {
    const rules = await this.notifyRuleService.match(
      eventType,
      user.tenantId,
      dto.level as NotifyLevel | undefined
    )
    const results: NotificationEntity[] = []
    for (const rule of rules) {
      const template = await this.templateRepo.findOne({
        where: { tenantId: user.tenantId, code: rule.templateCode, status: 'ACTIVE' }
      })
      if (!template) continue
      const receivers = await this.notifyRuleService.resolveReceivers(rule, user.tenantId, {
        ownerUserId: dto.ownerUserId ?? null
      })
      if (receivers.length === 0) continue
      const fallbackChannels = (template.channels ?? 'INMAIL').split(',').map((item) => item.trim()).filter(Boolean)
      const channels = this.notifyRuleService.resolveChannels(rule, fallbackChannels)
      const title = renderTemplate(template.title, dto.variables)
      const content = renderTemplate(template.content, dto.variables)
      for (const receiverId of receivers) {
        const receiver = await this.userRepo.findOne({
          where: { id: receiverId, tenantId: user.tenantId, isDeleted: 0 }
        })
        if (!receiver) continue
        const sent = await this.sendToReceiver(
          template,
          receiver,
          channels,
          title,
          content,
          dto.variables,
          dto.bizType ?? rule.bizType,
          dto.bizId ?? null,
          user
        )
        results.push(...sent)
      }
    }
    return results
  }

  /** 向单个接收人按渠道投递通知 */
  private async sendToReceiver(
    template: NotifyTemplateEntity,
    receiver: UserEntity,
    channels: string[],
    title: string,
    content: string,
    variables: Record<string, unknown>,
    bizType: string | undefined,
    bizId: number | null | undefined,
    user: JwtUser
  ): Promise<NotificationEntity[]> {
    const results: NotificationEntity[] = []
    for (const channel of channels) {
      const target = this.resolveTarget(channel, receiver)
      const saved = await this.create({
        title,
        content,
        channel,
        receiverId: receiver.id,
        bizType,
        bizId
      } as CreateNotificationDto, user)
      saved.targetAddress = target
      saved.templateCode = template.code
      saved.sendUserId = user.userId
      if (!isExternalChannel(channel)) {
        saved.sendStatus = 'SUCCESS'
        saved.deliveredAt = new Date()
        await this.repo.save(saved)
        results.push(saved)
        continue
      }
      const judgement = evaluateNotifyChannelConfig(channel, this.channelConfig(channel))
      if (!judgement.ok) {
        saved.sendStatus = 'PENDING'
        saved.lastError = judgement.reason
        await this.repo.save(saved)
        results.push(saved)
        continue
      }
      const delivery = await this.deliver(channel, target ?? '', title, content, variables)
      saved.sendStatus = delivery.success ? 'SUCCESS' : 'FAILED'
      saved.lastError = delivery.success ? null : delivery.message
      saved.deliveredAt = delivery.success ? new Date() : null
      saved.gatewayMessageId = delivery.messageId
      await this.repo.save(saved)
      results.push(saved)
    }
    return results
  }

  /** 更新通知模板（含渠道调整） */
  async updateTemplate(id: number, dto: UpdateNotifyTemplateDto, user: JwtUser): Promise<NotifyTemplateEntity> {
    const entity = await this.templateRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('通知模板不存在')
    const before = { ...entity }
    this.validateChannels(dto.channels ?? entity.channels ?? 'INMAIL')
    Object.assign(entity, dto)
    const saved = await this.templateRepo.save(entity)
    await this.auditService.record({ bizType: 'notify_template', bizId: id, action: 'UPDATE_TEMPLATE', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  /** 渠道连通性测试：校验配置并对网关发起一次探测请求 */
  async testChannel(dto: TestNotifyChannelDto, user: JwtUser): Promise<{ ok: boolean; reason: string | null; gatewayUrl: string | null }> {
    const judgement = evaluateNotifyChannelConfig(dto.channel, this.channelConfig(dto.channel))
    if (!judgement.ok) {
      return { ok: false, reason: judgement.reason, gatewayUrl: null }
    }
    if (!isExternalChannel(dto.channel)) {
      return { ok: true, reason: '站内信渠道无需网关', gatewayUrl: null }
    }
    const delivery = await this.deliver(dto.channel, dto.target ?? '', '渠道连通性测试', '渠道配置测试消息', {})
    await this.auditService.record({ bizType: 'notify_channel', bizId: 0, action: 'TEST_CHANNEL', afterValue: { channel: dto.channel, ok: delivery.success } }, user)
    return {
      ok: delivery.success,
      reason: delivery.success ? null : delivery.message,
      gatewayUrl: judgement.gatewayUrl
    }
  }

  /** 渠道名称合法性校验 */
  private validateChannels(channels: string): void {
    const list = channels.split(',').map((item) => item.trim()).filter(Boolean)
    for (const channel of list) {
      if (!NOTIFY_CHANNELS.includes(channel as (typeof NOTIFY_CHANNELS)[number])) {
        throw new BadRequestException(`不支持的通知渠道：${channel}`)
      }
    }
  }

  /** 解析渠道投递地址 */
  private resolveTarget(channel: string, receiver: UserEntity): string | null {
    if (channel === 'EMAIL') return receiver.email ?? null
    if (channel === 'SMS') return receiver.mobile ?? null
    if (channel === 'WECOM' || channel === 'DINGTALK') return receiver.mobile ?? null
    return null
  }

  /** 渠道网关配置 */
  private channelConfig(channel: string): { gatewayUrl?: string | null; token?: string | null; sender?: string | null } {
    switch (channel) {
      case 'EMAIL':
        return { gatewayUrl: env.notify.emailGatewayUrl, token: env.notify.gatewayToken, sender: env.notify.emailSender }
      case 'SMS':
        return { gatewayUrl: env.notify.smsGatewayUrl, token: env.notify.gatewayToken, sender: env.notify.smsSender }
      case 'WECOM':
        return { gatewayUrl: env.notify.wecomGatewayUrl, token: env.notify.gatewayToken }
      case 'DINGTALK':
        return { gatewayUrl: env.notify.dingtalkGatewayUrl, token: env.notify.gatewayToken }
      default:
        return {}
    }
  }

  /** 调用渠道网关投递通知 */
  private async deliver(
    channel: string,
    target: string,
    title: string,
    content: string,
    variables: Record<string, unknown>
  ): Promise<{ success: boolean; message: string | null; messageId: string | null }> {
    const judgement = evaluateNotifyChannelConfig(channel, this.channelConfig(channel))
    if (!judgement.ok || !judgement.gatewayUrl) {
      return { success: false, message: judgement.reason, messageId: null }
    }
    if (!target) {
      return { success: false, message: `渠道 ${channel} 缺少投递地址`, messageId: null }
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), env.notify.timeoutMs)
    try {
      const payload = buildNotifyDeliveryPayload(channel, target, title, content, variables)
      const response = await fetch(judgement.gatewayUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(env.notify.gatewayToken ? { authorization: `Bearer ${env.notify.gatewayToken}` } : {})
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      })
      const judgementResult = evaluateDeliveryResponse(response.status)
      if (!judgementResult.success) {
        return { success: false, message: judgementResult.message, messageId: null }
      }
      const body = (await response.json().catch(() => null)) as { messageId?: string } | null
      return { success: true, message: null, messageId: body?.messageId ?? null }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '渠道投递异常'
      return { success: false, message, messageId: null }
    } finally {
      clearTimeout(timer)
    }
  }

  /** 失败重试：仅 FAILED 且未超次数，重置为 PENDING 供重新投递 */
  async retryFailed(id: number, user: JwtUser): Promise<NotificationEntity> {
    const entity = await this.repo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('通知不存在')
    if (!shouldRetry(entity.sendStatus, entity.retryCount)) {
      throw new NotFoundException('该通知无需重试或已超过重试次数')
    }
    entity.retryCount += 1
    entity.sendStatus = 'PENDING'
    entity.lastError = null
    const saved = await this.repo.save(entity)
    await this.auditService.record({ bizType: 'notify', bizId: id, action: 'RETRY_NOTIFY', afterValue: { retryCount: saved.retryCount } }, user)
    return saved
  }
}
