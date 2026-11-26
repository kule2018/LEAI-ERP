import { createHmac } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Like, type FindOptionsWhere, type Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { AuditService } from '../audit/audit.service'
import { maskSecret, sealSecret, unsealSecret } from '../../common/utils/crypto.util'
import {
  CreateIntegrationDto,
  QueryIntegrationDto,
  SendTodoDto,
  UpdateIntegrationDto
} from './dto'
import { IntegrationConfigEntity, IntegrationMessageEntity } from './entities/integration.entities'

@Injectable()
export class IntegrationService {
  constructor(
    @InjectRepository(IntegrationConfigEntity) private readonly configRepo: Repository<IntegrationConfigEntity>,
    @InjectRepository(IntegrationMessageEntity) private readonly messageRepo: Repository<IntegrationMessageEntity>,
    private readonly auditService: AuditService
  ) {}

  async listConfigs(query: QueryIntegrationDto, user: JwtUser): Promise<PageResult<IntegrationConfigEntity>> {
    const where: FindOptionsWhere<IntegrationConfigEntity> = { tenantId: user.tenantId, isDeleted: 0 }
    if (query.channel) where.channel = query.channel
    if (query.status) where.status = query.status
    if (query.keyword) where.name = Like(`%${query.keyword}%`)
    const [list, total] = await this.configRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async upsertConfig(dto: CreateIntegrationDto, user: JwtUser): Promise<IntegrationConfigEntity> {
    const existing = await this.configRepo.findOne({
      where: { tenantId: user.tenantId, channel: dto.channel, isDeleted: 0 }
    })
    const secret = dto.secret ?? unsealSecret(existing?.secretEncrypted) ?? ''
    const entity = existing ?? this.configRepo.create({
      tenantId: user.tenantId,
      channel: dto.channel,
      createdBy: user.userId
    })
    entity.name = dto.name
    entity.webhookUrl = dto.webhookUrl
    entity.status = dto.status ?? 'ACTIVE'
    entity.secretEncrypted = secret ? sealSecret(secret) : null
    entity.secretMask = secret ? maskSecret(secret) : null
    entity.updatedAt = new Date()
    const saved = await this.configRepo.save(entity)
    await this.auditService.record({ bizType: 'integration_config', bizId: saved.id, action: 'UPSERT_CONFIG', afterValue: saved }, user)
    return saved
  }

  async updateConfig(id: number, dto: UpdateIntegrationDto, user: JwtUser): Promise<IntegrationConfigEntity> {
    const entity = await this.findConfig(id, user)
    const before = { ...entity }
    if (dto.secret) {
      entity.secretEncrypted = sealSecret(dto.secret)
      entity.secretMask = maskSecret(dto.secret)
    }
    const { secret: _secret, ...rest } = dto
    void _secret
    Object.assign(entity, rest)
    entity.updatedAt = new Date()
    const saved = await this.configRepo.save(entity)
    await this.auditService.record({ bizType: 'integration_config', bizId: id, action: 'UPDATE_CONFIG', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  async removeConfig(id: number, user: JwtUser): Promise<void> {
    const entity = await this.findConfig(id, user)
    entity.isDeleted = 1
    entity.status = 'DISABLED'
    await this.configRepo.save(entity)
    await this.auditService.record({ bizType: 'integration_config', bizId: id, action: 'DELETE_CONFIG', beforeValue: entity }, user)
  }

  async listMessages(query: QueryIntegrationDto, user: JwtUser): Promise<PageResult<IntegrationMessageEntity>> {
    const where: FindOptionsWhere<IntegrationMessageEntity> = { tenantId: user.tenantId }
    if (query.channel) where.channel = query.channel
    const [list, total] = await this.messageRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async sendTodo(channel: 'WECHAT' | 'DINGTALK', dto: SendTodoDto, user: JwtUser): Promise<IntegrationMessageEntity> {
    const config = await this.configRepo.findOne({ where: { tenantId: user.tenantId, channel, isDeleted: 0, status: 'ACTIVE' } })
    if (!config) throw new BadRequestException(`未启用的 ${channel} 配置`)
    const content = [
      `### ${dto.title}`,
      ...(dto.assignee ? [`> 处理人：${dto.assignee}`] : []),
      ...(dto.taskId ? [`> 任务 ID：${dto.taskId}`] : []),
      ...(dto.content ? [dto.content] : [])
    ].join('\n')
    const message = this.messageRepo.create({
      tenantId: user.tenantId,
      channel,
      title: dto.title,
      content,
      status: 'PENDING',
      createdBy: user.userId
    })
    const saved = await this.messageRepo.save(message)
    try {
      const secret = unsealSecret(config.secretEncrypted) ?? ''
      const { url, body } = this.buildPayload(channel, config.webhookUrl, secret, dto.title, content)
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000)
      })
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
      saved.status = 'SENT'
      saved.responseText = `HTTP ${response.status}`.slice(0, 1000)
    } catch (error) {
      saved.status = 'FAILED'
      saved.responseText = (error instanceof Error ? error.message : '未知错误').slice(0, 1000)
    }
    const result = await this.messageRepo.save(saved)
    await this.auditService.record({
      bizType: 'integration_message',
      bizId: result.id,
      action: 'SEND_TODO',
      afterValue: { channel, title: dto.title, status: result.status }
    }, user)
    return result
  }

  private buildPayload(
    channel: string,
    webhookUrl: string,
    secret: string,
    title: string,
    content: string
  ): { url: string; body: Record<string, unknown> } {
    if (channel === 'DINGTALK') {
      const timestamp = Date.now().toString()
      const sign = secret
        ? createHmac('sha256', secret).update(`${timestamp}\n${secret}`).digest('base64')
        : ''
      const separator = webhookUrl.includes('?') ? '&' : '?'
      const url = secret
        ? `${webhookUrl}${separator}timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`
        : webhookUrl
      return { url, body: { msgtype: 'markdown', markdown: { title, text: content } } }
    }
    return { url: webhookUrl, body: { msgtype: 'markdown', markdown: { content } } }
  }

  private async findConfig(id: number, user: JwtUser): Promise<IntegrationConfigEntity> {
    const entity = await this.configRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('集成配置不存在')
    return entity
  }
}
