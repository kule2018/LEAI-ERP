import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type Redis from 'ioredis'
import { Repository } from 'typeorm'
import type { JwtUser } from '../../common/contracts'
import { SUPPORTED_CURRENCIES, convertAmount, isValidCurrency, needsRateApproval, reverseRate, toBaseCurrency } from '../../common/currency-engine'
import { env } from '../../config/env'
import { AuditService } from '../audit/audit.service'
import { ExchangeRateEntity } from './entities/exchange-rate.entity'

export interface ExternalRateSyncResult {
  source: string
  base: string
  date: string
  synced: number
  rates: Record<string, number>
}

@Injectable()
export class CurrencyService {
  constructor(
    @InjectRepository(ExchangeRateEntity) private readonly repo: Repository<ExchangeRateEntity>,
    private readonly auditService: AuditService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis
  ) {}

  /** 设置汇率：大额变更需 reason，留审计 */
  async setRate(
    input: { fromCurrency: string; toCurrency: string; rate: number; effectiveDate: string; reason?: string },
    user: JwtUser
  ): Promise<ExchangeRateEntity> {
    const from = input.fromCurrency.toUpperCase()
    const to = input.toCurrency.toUpperCase()
    if (!isValidCurrency(from) || !isValidCurrency(to)) throw new BadRequestException('不支持的币种')
    if (!Number.isFinite(input.rate) || input.rate <= 0) throw new BadRequestException('汇率必须为正数')
    if (from === to && input.rate !== 1) throw new BadRequestException('同种币种汇率必须为 1')

    const latest = await this.repo.findOne({
      where: { tenantId: user.tenantId, fromCurrency: from, toCurrency: to },
      order: { effectiveDate: 'DESC' }
    })
    if (latest && needsRateApproval(Number(latest.rate), input.rate)) {
      if (!input.reason?.trim()) throw new BadRequestException('汇率变动超过 5%，必须填写变更原因')
    }
    const existing = await this.repo.findOne({
      where: { tenantId: user.tenantId, fromCurrency: from, toCurrency: to, effectiveDate: input.effectiveDate }
    })
    const entity = existing ?? this.repo.create({
      tenantId: user.tenantId,
      fromCurrency: from,
      toCurrency: to,
      effectiveDate: input.effectiveDate
    })
    entity.rate = String(input.rate)
    entity.source = 'MANUAL'
    entity.changedBy = user.userId
    const saved = await this.repo.save(entity)
    await this.auditService.record({
      bizType: 'exchange_rate', bizId: saved.id, action: 'SET_RATE',
      afterValue: { from, to, rate: input.rate, effectiveDate: input.effectiveDate, reason: input.reason ?? null }
    }, user)
    return saved
  }

  /** 按日期查汇率（取生效日期 <= 指定日期的最新一条） */
  async getRate(fromCurrency: string, toCurrency: string, date: string, user: JwtUser): Promise<number> {
    const from = fromCurrency.toUpperCase()
    const to = toCurrency.toUpperCase()
    if (from === to) return 1
    const row = await this.repo
      .createQueryBuilder('r')
      .where('r.tenant_id = :tenantId', { tenantId: user.tenantId })
      .andWhere('r.from_currency = :from', { from })
      .andWhere('r.to_currency = :to', { to })
      .andWhere('r.effective_date <= :date', { date })
      .orderBy('r.effective_date', 'DESC')
      .getOne()
    if (!row) throw new NotFoundException(`未找到 ${from}/${to} 在 ${date} 的汇率`)
    return Number(row.rate)
  }

  /** 换算金额 */
  async convert(amount: number, fromCurrency: string, toCurrency: string, date: string, user: JwtUser) {
    const rate = await this.getRate(fromCurrency, toCurrency, date, user)
    return { amount, rate, converted: convertAmount(amount, rate), fromCurrency, toCurrency, date }
  }

  /** 反汇率（无数据时按正数校验） */
  inverse(rate: number) {
    return reverseRate(rate)
  }

  /** 多币种汇总到本位币 */
  async toBase(items: Array<{ amount: number; currency: string }>, base: string, date: string, user: JwtUser) {
    const converted = await Promise.all(items.map(async (item) => ({
      amount: item.amount,
      rate: await this.getRate(item.currency, base, date, user)
    })))
    return { base, date, total: toBaseCurrency(converted) }
  }

  list(user: JwtUser): Promise<ExchangeRateEntity[]> {
    return this.repo.find({ where: { tenantId: user.tenantId }, order: { effectiveDate: 'DESC', id: 'DESC' }, take: 200 })
  }

  /**
   * 从外部汇率源同步基准币种对其他支持币种的汇率。
   * 默认使用 Frankfurter(ECB) 数据，结果按 base/date 缓存到 Redis。
   */
  async syncExternalRates(user: JwtUser, base = 'CNY'): Promise<ExternalRateSyncResult> {
    const from = base.toUpperCase()
    if (!isValidCurrency(from)) throw new BadRequestException('不支持的基准币种')
    const today = new Date().toISOString().slice(0, 10)
    const cacheKey = `fx:rates:${from}:${today}`
    try {
      const cached = await this.redis.get(cacheKey)
      if (cached) return JSON.parse(cached) as ExternalRateSyncResult
    } catch {
      // Redis 不可用时直接请求外部源
    }
    const url = env.fx.url.includes('{base}') ? env.fx.url.replace('{base}', from) : env.fx.url
    const response = await fetch(url)
    if (!response.ok) throw new BadRequestException(`外部汇率源请求失败：${response.status}`)
    const payload = await response.json() as { date?: string; rates?: Record<string, number> }
    const rates = payload.rates ?? {}
    const effectiveDate = payload.date ?? today
    let synced = 0
    for (const currency of SUPPORTED_CURRENCIES) {
      const rate = rates[currency]
      if (currency === from || !Number.isFinite(rate) || rate <= 0) continue
      const existing = await this.repo.findOne({
        where: { tenantId: user.tenantId, fromCurrency: from, toCurrency: currency, effectiveDate }
      })
      const entity = existing ?? this.repo.create({
        tenantId: user.tenantId,
        fromCurrency: from,
        toCurrency: currency,
        effectiveDate
      })
      entity.rate = String(rate)
      entity.source = env.fx.provider.toUpperCase()
      entity.changedBy = user.userId
      await this.repo.save(entity)
      synced += 1
    }
    const result = { source: env.fx.provider.toUpperCase(), base: from, date: effectiveDate, synced, rates }
    try {
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', env.fx.cacheTtlSeconds)
    } catch {
      // 缓存失败不影响同步结果
    }
    await this.auditService.record({
      bizType: 'exchange_rate',
      bizId: 0,
      action: 'SYNC_EXTERNAL_RATES',
      afterValue: result
    }, user)
    return result
  }
}
