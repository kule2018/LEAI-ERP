import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type Redis from 'ioredis'
import { Repository } from 'typeorm'
import { SystemConfigEntity } from './entities/system-config.entity'

export interface UpsertConfigInput {
  configKey: string
  configValue: string | null
  valueType?: string
  category?: string | null
  isSystem?: boolean
  remark?: string | null
}

const CACHE_TTL_MS = 60_000

/** 导出水印开关参数键 */
export const EXPORT_WATERMARK_ENABLED_KEY = 'security.export.watermark.enabled'
/** 导出水印说明文案参数键 */
export const EXPORT_WATERMARK_TEXT_KEY = 'security.export.watermark.text'

export interface ExportWatermarkOptions {
  enabled: boolean
  extraText: string | null
}

/**
 * 租户级系统参数服务：统一收敛散落在代码中的硬编码阈值与开关配置。
 * 读取优先 Redis 共享缓存（多实例一致），Redis 不可用时降级到进程内缓存。
 */
@Injectable()
export class ConfigService {
  private readonly fallbackCache = new Map<string, { value: string | null; expireAt: number }>()

  constructor(
    @InjectRepository(SystemConfigEntity) private readonly repo: Repository<SystemConfigEntity>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis
  ) {}

  private cacheKey(tenantId: number, configKey: string): string {
    return `config:${tenantId}:${configKey}`
  }

  /** 读取参数原始值 */
  async getRaw(tenantId: number, configKey: string): Promise<string | null | undefined> {
    const cacheKey = this.cacheKey(tenantId, configKey)
    let cached: { value: string | null } | null = null
    try {
      const raw = await this.redis.get(cacheKey)
      if (raw) cached = JSON.parse(raw) as { value: string | null }
    } catch {
      // Redis 不可用时使用本地缓存
    }
    if (!cached) {
      const local = this.fallbackCache.get(cacheKey)
      if (local && local.expireAt > Date.now()) cached = { value: local.value }
    }
    if (cached) return cached.value === null ? null : cached.value

    const entity = await this.repo.findOne({
      where: { tenantId, configKey, isDeleted: 0 }
    })
    const value = entity?.configValue ?? null
    const payload = JSON.stringify({ value })
    try {
      await this.redis.set(cacheKey, payload, 'EX', Math.ceil(CACHE_TTL_MS / 1000))
    } catch {
      this.fallbackCache.set(cacheKey, { value, expireAt: Date.now() + CACHE_TTL_MS })
    }
    return entity ? value : undefined
  }

  private async invalidate(tenantId: number, configKey: string): Promise<void> {
    const cacheKey = this.cacheKey(tenantId, configKey)
    this.fallbackCache.delete(cacheKey)
    try {
      await this.redis.del(cacheKey)
    } catch {
      // 本地缓存已失效，Redis 不可用时不影响写入
    }
  }

  /** 读取字符串参数 */
  async get(tenantId: number, configKey: string, fallback = ''): Promise<string> {
    const value = await this.getRaw(tenantId, configKey)
    return value === undefined || value === null ? fallback : value
  }

  /** 读取数字参数 */
  async getNumber(tenantId: number, configKey: string, fallback: number): Promise<number> {
    const value = await this.getRaw(tenantId, configKey)
    if (value === undefined || value === null || value === '') return fallback
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  /** 读取布尔参数 */
  async getBoolean(tenantId: number, configKey: string, fallback: boolean): Promise<boolean> {
    const value = await this.getRaw(tenantId, configKey)
    if (value === undefined || value === null || value === '') return fallback
    return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase())
  }

  /** 读取 JSON 参数 */
  async getJson<T>(tenantId: number, configKey: string, fallback: T): Promise<T> {
    const value = await this.getRaw(tenantId, configKey)
    if (!value) return fallback
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }

  /** 参数列表 */
  async list(tenantId: number, category?: string): Promise<SystemConfigEntity[]> {
    return this.repo.find({
      where: {
        tenantId,
        isDeleted: 0,
        ...(category ? { category } : {})
      },
      order: { category: 'ASC', configKey: 'ASC' }
    })
  }

  /** 新增或更新参数 */
  async upsert(tenantId: number, input: UpsertConfigInput, operatorId?: number): Promise<SystemConfigEntity> {
    if (!input.configKey?.trim()) throw new BadRequestException('参数键不能为空')
    const existing = await this.repo.findOne({
      where: { tenantId, configKey: input.configKey.trim() }
    })
    const payload = {
      tenantId,
      configKey: input.configKey.trim(),
      configValue: input.configValue ?? null,
      valueType: input.valueType ?? existing?.valueType ?? 'STRING',
      category: input.category ?? existing?.category ?? null,
      isSystem: input.isSystem === undefined ? (existing?.isSystem ?? 0) : input.isSystem ? 1 : 0,
      remark: input.remark ?? existing?.remark ?? null,
      updatedBy: operatorId ?? null
    }
    const entity = existing
      ? Object.assign(existing, payload, { isDeleted: 0, updatedAt: new Date() })
      : this.repo.create({ ...payload, createdBy: operatorId ?? null })
    const saved = await this.repo.save(entity)
    await this.invalidate(tenantId, saved.configKey)
    return saved
  }

  /** 读取导出水印策略：开关默认开启，说明文案可选 */
  async getExportWatermarkOptions(tenantId: number): Promise<ExportWatermarkOptions> {
    const enabled = await this.getBoolean(tenantId, EXPORT_WATERMARK_ENABLED_KEY, true)
    const text = (await this.get(tenantId, EXPORT_WATERMARK_TEXT_KEY, '')).trim()
    return { enabled, extraText: text ? text : null }
  }

  /** 删除参数（系统内置参数不可删除） */
  async remove(tenantId: number, configKey: string): Promise<void> {
    const entity = await this.repo.findOne({ where: { tenantId, configKey } })
    if (!entity) return
    if (entity.isSystem === 1) throw new BadRequestException('系统内置参数不可删除')
    entity.isDeleted = 1
    entity.updatedAt = new Date()
    await this.repo.save(entity)
    await this.invalidate(tenantId, configKey)
  }
}
