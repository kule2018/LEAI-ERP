import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Redis } from 'ioredis'
import { FindOptionsWhere, Like, Repository } from 'typeorm'
import { SEQUENCE_KEY_TTL_SECONDS, buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { AuditService } from '../audit/audit.service'
import { CreateSequenceDto, NextSequenceDto, QuerySequenceDto, UpdateSequenceDto } from './dto'
import { SequenceEntity } from './entities/sequence.entity'

export interface NextSequenceResult {
  docNo: string
  seq: number
  redisKey: string
}

@Injectable()
export class SequenceService {
  constructor(
    @InjectRepository(SequenceEntity) private readonly repo: Repository<SequenceEntity>,
    private readonly auditService: AuditService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis
  ) {}

  async list(query: QuerySequenceDto, user: JwtUser): Promise<PageResult<SequenceEntity>> {
    const where: FindOptionsWhere<SequenceEntity> = { tenantId: user.tenantId, isDeleted: 0 }
    if (query.keyword) {
      where.bizCode = Like(`%${query.keyword}%`)
    }
    const [list, total] = await this.repo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async create(dto: CreateSequenceDto, user: JwtUser): Promise<SequenceEntity> {
    const existing = await this.repo.findOne({
      where: { tenantId: user.tenantId, bizCode: dto.bizCode, isDeleted: 0 }
    })
    if (existing) {
      throw new ConflictException('业务编码已存在')
    }
    const entity = this.repo.create({
      ...dto,
      tenantId: user.tenantId,
      dateFormat: dto.dateFormat ?? 'yyyyMMdd',
      stepValue: dto.stepValue ?? 1,
      resetCycle: dto.resetCycle ?? 'DAILY',
      createdBy: user.userId
    })
    const saved = await this.repo.save(entity)
    await this.auditService.record({ bizType: 'sequence', bizId: saved.id, action: 'CREATE_SEQUENCE', afterValue: saved }, user)
    return saved
  }

  async update(id: number, dto: UpdateSequenceDto, user: JwtUser): Promise<SequenceEntity> {
    const entity = await this.findOwned(id, user)
    const before = { ...entity }
    Object.assign(entity, dto)
    entity.updatedBy = user.userId
    entity.updatedAt = new Date()
    const saved = await this.repo.save(entity)
    await this.auditService.record({ bizType: 'sequence', bizId: id, action: 'UPDATE_SEQUENCE', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  async remove(id: number, user: JwtUser): Promise<void> {
    const entity = await this.findOwned(id, user)
    entity.isDeleted = 1
    entity.updatedBy = user.userId
    entity.updatedAt = new Date()
    await this.repo.save(entity)
    await this.auditService.record({ bizType: 'sequence', bizId: id, action: 'DELETE_SEQUENCE', beforeValue: entity }, user)
  }

  /** 规则预览：展示下一个将生成的编码，不消耗序号、不写库 */
  async preview(bizCode: string, user: JwtUser): Promise<NextSequenceResult> {
    const rule = await this.repo.findOne({
      where: { tenantId: user.tenantId, bizCode, isDeleted: 0 }
    })
    if (!rule) throw new NotFoundException('编码规则不存在')
    const datePart = this.formatDate(new Date(), rule.dateFormat || 'yyyyMMdd')
    const redisKey = `seq:${user.tenantId}:${rule.bizCode}:${datePart}`
    const current = Number(await this.redis.get(redisKey) ?? 0)
    const seq = (current + 1) * rule.stepValue
    const docNo = `${rule.numberPrefix}${datePart}${String(seq).padStart(6, '0')}`
    return { docNo, seq, redisKey }
  }

  async next(dto: NextSequenceDto, user: JwtUser): Promise<NextSequenceResult> {
    const rule = await this.repo.findOne({
      where: { tenantId: user.tenantId, bizCode: dto.bizCode, isDeleted: 0 }
    })
    if (!rule) {
      throw new NotFoundException('编码规则不存在')
    }

    const datePart = this.formatDate(new Date(), rule.dateFormat || 'yyyyMMdd')
    const redisKey = `seq:${user.tenantId}:${rule.bizCode}:${datePart}`
    const counter = await this.redis.incr(redisKey)
    if (counter === 1) {
      await this.redis.expire(redisKey, SEQUENCE_KEY_TTL_SECONDS)
    }

    const seq = counter * rule.stepValue
    const docNo = `${rule.numberPrefix}${datePart}${String(seq).padStart(6, '0')}`
    rule.currentSeq = seq
    rule.docNo = docNo
    await this.repo.save(rule)
    await this.auditService.record(
      { bizType: 'sequence', bizId: rule.id, action: 'NEXT_SEQUENCE', afterValue: { docNo, seq, redisKey } },
      user
    )
    return { docNo, seq, redisKey }
  }

  private async findOwned(id: number, user: JwtUser): Promise<SequenceEntity> {
    const entity = await this.repo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) {
      throw new NotFoundException('编码规则不存在')
    }
    return entity
  }

  private formatDate(date: Date, format: string): string {
    const pad = (value: number): string => String(value).padStart(2, '0')
    const values: Record<string, string> = {
      yyyy: String(date.getFullYear()),
      MM: pad(date.getMonth() + 1),
      dd: pad(date.getDate()),
      HH: pad(date.getHours()),
      mm: pad(date.getMinutes()),
      ss: pad(date.getSeconds())
    }
    return format.replace(/yyyy|MM|dd|HH|mm|ss/g, (token) => values[token] ?? token)
  }
}
