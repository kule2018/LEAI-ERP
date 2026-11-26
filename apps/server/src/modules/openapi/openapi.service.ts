import { randomBytes, createHmac } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Like, type FindOptionsWhere, type Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { AuditService } from '../audit/audit.service'
import { hashPassword } from '../../common/utils/password.util'
import { maskSecret, sealSecret, unsealSecret } from '../../common/utils/crypto.util'
import {
  CreateApiKeyDto,
  CreateWebhookDto,
  PublishEventDto,
  QueryOpenApiDto,
  UpdateWebhookDto
} from './dto'
import { ApiKeyEntity, WebhookDeliveryEntity, WebhookEntity } from './entities/openapi.entities'
import { ApiCallLogEntity } from './entities/api-call-log.entity'

@Injectable()
export class OpenApiService {
  constructor(
    @InjectRepository(ApiKeyEntity) private readonly apiKeyRepo: Repository<ApiKeyEntity>,
    @InjectRepository(WebhookEntity) private readonly webhookRepo: Repository<WebhookEntity>,
    @InjectRepository(WebhookDeliveryEntity) private readonly deliveryRepo: Repository<WebhookDeliveryEntity>,
    @InjectRepository(ApiCallLogEntity) private readonly callLogRepo: Repository<ApiCallLogEntity>,
    private readonly auditService: AuditService
  ) {}

  /** 调用日志：按租户查询，支持按密钥过滤 */
  async listCallLogs(query: QueryOpenApiDto & { apiKeyId?: number }, user: JwtUser): Promise<PageResult<ApiCallLogEntity>> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const where: FindOptionsWhere<ApiCallLogEntity> = {
      tenantId: user.tenantId,
      ...(query.apiKeyId ? { apiKeyId: query.apiKeyId } : {})
    }
    const [list, total] = await this.callLogRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
    return buildPageResult(list, total, page, pageSize)
  }

  async listApiKeys(query: QueryOpenApiDto, user: JwtUser): Promise<PageResult<ApiKeyEntity>> {
    const where: FindOptionsWhere<ApiKeyEntity> = { tenantId: user.tenantId, isDeleted: 0 }
    if (query.status) where.status = query.status
    if (query.keyword) where.name = Like(`%${query.keyword}%`)
    const [list, total] = await this.apiKeyRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createApiKey(dto: CreateApiKeyDto, user: JwtUser): Promise<ApiKeyEntity & { secret: string }> {
    const keyId = `ak_${randomBytes(8).toString('hex')}`
    const secret = `sk_${randomBytes(24).toString('hex')}`
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('过期时间格式不正确')
    }
    const saved = await this.apiKeyRepo.save(this.apiKeyRepo.create({
      tenantId: user.tenantId,
      keyId,
      secretHash: hashPassword(secret),
      name: dto.name,
      scopes: dto.scopes,
      status: dto.status ?? 'ACTIVE',
      expiresAt,
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'api_key', bizId: saved.id, action: 'CREATE_KEY', afterValue: { ...saved, secretHash: '***' } }, user)
    return { ...saved, secret }
  }

  async rotateApiKey(id: number, user: JwtUser): Promise<ApiKeyEntity & { secret: string }> {
    const entity = await this.findApiKey(id, user)
    const secret = `sk_${randomBytes(24).toString('hex')}`
    entity.secretHash = hashPassword(secret)
    entity.updatedAt = new Date()
    const saved = await this.apiKeyRepo.save(entity)
    await this.auditService.record({ bizType: 'api_key', bizId: id, action: 'ROTATE_KEY', afterValue: { keyId: saved.keyId } }, user)
    return { ...saved, secret }
  }

  async setApiKeyStatus(id: number, status: 'ACTIVE' | 'DISABLED', user: JwtUser): Promise<ApiKeyEntity> {
    const entity = await this.findApiKey(id, user)
    entity.status = status
    entity.updatedAt = new Date()
    const saved = await this.apiKeyRepo.save(entity)
    await this.auditService.record({ bizType: 'api_key', bizId: id, action: 'SET_KEY_STATUS', afterValue: { status } }, user)
    return saved
  }

  async removeApiKey(id: number, user: JwtUser): Promise<void> {
    const entity = await this.findApiKey(id, user)
    entity.isDeleted = 1
    entity.status = 'DISABLED'
    await this.apiKeyRepo.save(entity)
    await this.auditService.record({ bizType: 'api_key', bizId: id, action: 'DELETE_KEY', beforeValue: entity }, user)
  }

  async listWebhooks(query: QueryOpenApiDto, user: JwtUser): Promise<PageResult<WebhookEntity>> {
    const where: FindOptionsWhere<WebhookEntity> = { tenantId: user.tenantId, isDeleted: 0 }
    if (query.status) where.status = query.status
    if (query.keyword) where.name = Like(`%${query.keyword}%`)
    const [list, total] = await this.webhookRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createWebhook(dto: CreateWebhookDto, user: JwtUser): Promise<WebhookEntity> {
    const secret = dto.secret ?? `whsec_${randomBytes(18).toString('hex')}`
    const saved = await this.webhookRepo.save(this.webhookRepo.create({
      tenantId: user.tenantId,
      name: dto.name,
      url: dto.url,
      eventTypes: dto.eventTypes,
      secretEncrypted: sealSecret(secret),
      secretMask: maskSecret(secret),
      status: dto.status ?? 'ACTIVE',
      retryLimit: dto.retryLimit ?? 3,
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'webhook', bizId: saved.id, action: 'CREATE_WEBHOOK', afterValue: saved }, user)
    return saved
  }

  async updateWebhook(id: number, dto: UpdateWebhookDto, user: JwtUser): Promise<WebhookEntity> {
    const entity = await this.findWebhook(id, user)
    const before = { ...entity }
    if (dto.secret) {
      entity.secretEncrypted = sealSecret(dto.secret)
      entity.secretMask = maskSecret(dto.secret)
    }
    const { secret: _secret, ...rest } = dto
    void _secret
    Object.assign(entity, rest)
    entity.updatedAt = new Date()
    const saved = await this.webhookRepo.save(entity)
    await this.auditService.record({ bizType: 'webhook', bizId: id, action: 'UPDATE_WEBHOOK', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  async removeWebhook(id: number, user: JwtUser): Promise<void> {
    const entity = await this.findWebhook(id, user)
    entity.isDeleted = 1
    entity.status = 'DISABLED'
    await this.webhookRepo.save(entity)
    await this.auditService.record({ bizType: 'webhook', bizId: id, action: 'DELETE_WEBHOOK', beforeValue: entity }, user)
  }

  async listDeliveries(query: QueryOpenApiDto, user: JwtUser): Promise<PageResult<WebhookDeliveryEntity>> {
    const where: FindOptionsWhere<WebhookDeliveryEntity> = { tenantId: user.tenantId }
    if (query.status) where.status = query.status
    if (query.keyword) where.eventType = Like(`%${query.keyword}%`)
    const [list, total] = await this.deliveryRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async publishEvent(dto: PublishEventDto, user: JwtUser): Promise<{ eventType: string; deliveries: WebhookDeliveryEntity[] }> {
    const hooks = await this.webhookRepo.find({ where: { tenantId: user.tenantId, status: 'ACTIVE', isDeleted: 0 } })
    const matched = hooks.filter((hook) => hook.eventTypes.includes(dto.eventType) || hook.eventTypes.includes('*'))
    const deliveries: WebhookDeliveryEntity[] = []
    for (const hook of matched) {
      const delivery = await this.deliveryRepo.save(this.deliveryRepo.create({
        tenantId: user.tenantId,
        webhookId: hook.id,
        eventType: dto.eventType,
        payload: dto.payload,
        status: 'PENDING'
      }))
      deliveries.push(await this.deliver(delivery, hook))
    }
    await this.auditService.record({
      bizType: 'webhook_delivery',
      bizId: 0,
      action: 'PUBLISH_EVENT',
      afterValue: { eventType: dto.eventType, deliveryCount: deliveries.length }
    }, user)
    return { eventType: dto.eventType, deliveries }
  }

  async retryDelivery(id: number, user: JwtUser): Promise<WebhookDeliveryEntity> {
    const delivery = await this.deliveryRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!delivery) throw new NotFoundException('投递记录不存在')
    if (delivery.status === 'DELIVERED') throw new BadRequestException('该投递已成功')
    const hook = await this.webhookRepo.findOne({ where: { id: delivery.webhookId, tenantId: user.tenantId } })
    if (!hook) throw new NotFoundException('Webhook 不存在')
    const saved = await this.deliver(delivery, hook)
    await this.auditService.record({ bizType: 'webhook_delivery', bizId: id, action: 'RETRY_DELIVERY', afterValue: { status: saved.status } }, user)
    return saved
  }

  private async deliver(delivery: WebhookDeliveryEntity, hook: WebhookEntity): Promise<WebhookDeliveryEntity> {
    const secret = unsealSecret(hook.secretEncrypted) ?? ''
    const body = JSON.stringify({ eventType: delivery.eventType, payload: delivery.payload, deliveryId: delivery.id })
    const signature = secret ? createHmac('sha256', secret).update(body).digest('hex') : ''
    delivery.attemptCount += 1
    try {
      const response = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-leaierp-event': delivery.eventType,
          'x-leaierp-signature': signature
        },
        body,
        signal: AbortSignal.timeout(5000)
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
      }
      delivery.status = 'DELIVERED'
      delivery.deliveredAt = new Date()
      delivery.nextRetryAt = null
      delivery.responseText = `HTTP ${response.status}`.slice(0, 1000)
    } catch (error) {
      delivery.responseText = (error instanceof Error ? error.message : '未知错误').slice(0, 1000)
      if (delivery.attemptCount < hook.retryLimit) {
        delivery.status = 'RETRY'
        delivery.nextRetryAt = new Date(Date.now() + delivery.attemptCount * 60_000)
      } else {
        delivery.status = 'FAILED'
        delivery.nextRetryAt = null
      }
    }
    return this.deliveryRepo.save(delivery)
  }

  private async findApiKey(id: number, user: JwtUser): Promise<ApiKeyEntity> {
    const entity = await this.apiKeyRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('API Key 不存在')
    return entity
  }

  private async findWebhook(id: number, user: JwtUser): Promise<WebhookEntity> {
    const entity = await this.webhookRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('Webhook 不存在')
    return entity
  }
}
