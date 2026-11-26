import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type { Redis } from 'ioredis'
import { FindOptionsWhere, Like, Repository } from 'typeorm'
import { DICT_CACHE_TTL_SECONDS, buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { exportDictCsv, parseDictCsv, summarizeDictImport } from '../../common/dict-io-rules'
import { AuditService } from '../audit/audit.service'
import {
  CreateDictDto,
  CreateDictItemDto,
  QueryDictDto,
  QueryDictItemDto,
  UpdateDictDto,
  UpdateDictItemDto
} from './dto'
import { DictEntity } from './entities/dict.entity'
import { DictItemEntity } from './entities/dict-item.entity'

@Injectable()
export class DictService {
  constructor(
    @InjectRepository(DictEntity) private readonly dictRepo: Repository<DictEntity>,
    @InjectRepository(DictItemEntity) private readonly itemRepo: Repository<DictItemEntity>,
    private readonly auditService: AuditService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis
  ) {}

  async listTypes(query: QueryDictDto, user: JwtUser): Promise<PageResult<DictEntity>> {
    const where: FindOptionsWhere<DictEntity> = { tenantId: user.tenantId, isDeleted: 0 }
    if (query.keyword) {
      where.dictType = Like(`%${query.keyword}%`)
    }
    const [list, total] = await this.dictRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createType(dto: CreateDictDto, user: JwtUser): Promise<DictEntity> {
    const existing = await this.dictRepo.findOne({
      where: { tenantId: user.tenantId, dictType: dto.dictType, isDeleted: 0 }
    })
    if (existing) {
      throw new ConflictException('字典类型已存在')
    }
    const entity = this.dictRepo.create({
      ...dto,
      tenantId: user.tenantId,
      createdBy: user.userId,
      status: 'ENABLED'
    })
    const saved = await this.dictRepo.save(entity)
    await this.auditService.record({ bizType: 'dict', bizId: saved.id, action: 'CREATE_DICT', afterValue: saved }, user)
    return saved
  }

  async updateType(id: number, dto: UpdateDictDto, user: JwtUser): Promise<DictEntity> {
    const entity = await this.findType(id, user)
    const before = { ...entity }
    Object.assign(entity, dto)
    entity.updatedBy = user.userId
    entity.updatedAt = new Date()
    const saved = await this.dictRepo.save(entity)
    await this.invalidateCache(user.tenantId, entity.dictType)
    await this.auditService.record({ bizType: 'dict', bizId: id, action: 'UPDATE_DICT', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  async removeType(id: number, user: JwtUser): Promise<void> {
    const entity = await this.findType(id, user)
    // 被引用保护：仍有启用字典项时不可删除
    const activeItems = await this.itemRepo.count({
      where: { tenantId: user.tenantId, dictType: entity.dictType, isDeleted: 0, status: 'ENABLED' }
    })
    if (activeItems > 0) {
      throw new BadRequestException(`字典 ${entity.dictType} 仍有 ${activeItems} 个启用的字典项，不可删除`)
    }
    entity.isDeleted = 1
    entity.updatedBy = user.userId
    entity.updatedAt = new Date()
    await this.dictRepo.save(entity)
    await this.invalidateCache(user.tenantId, entity.dictType)
    await this.auditService.record({ bizType: 'dict', bizId: id, action: 'DELETE_DICT', beforeValue: entity }, user)
  }

  async listItems(query: QueryDictItemDto, user: JwtUser): Promise<PageResult<DictItemEntity>> {
    const items = await this.resolveItems(query.dictType, user.tenantId)
    const keyword = query.keyword?.trim().toLowerCase()
    const filtered = keyword
      ? items.filter((item) => item.itemLabel.toLowerCase().includes(keyword) || item.itemCode.toLowerCase().includes(keyword))
      : items
    const start = (query.page - 1) * query.pageSize
    return buildPageResult(filtered.slice(start, start + query.pageSize), filtered.length, query.page, query.pageSize)
  }

  async resolveItems(dictType: string, tenantId: number): Promise<DictItemEntity[]> {
    const key = this.cacheKey(tenantId, dictType)
    const cached = await this.redis.get(key)
    if (cached) {
      const parsed = JSON.parse(cached) as DictItemEntity[]
      return parsed.map((item) => ({ ...item, createdAt: new Date(item.createdAt) }))
    }
    const items = await this.itemRepo.find({
      where: { tenantId, dictType, isDeleted: 0, status: 'ENABLED' },
      order: { sortNo: 'ASC', id: 'ASC' }
    })
    await this.redis.set(key, JSON.stringify(items), 'EX', DICT_CACHE_TTL_SECONDS)
    return items
  }

  /** 导出全部字典与字典项为 CSV */
  async exportDictCsv(user: JwtUser): Promise<{ filename: string; content: string }> {
    const dicts = await this.dictRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 }, order: { dictType: 'ASC' } })
    const items = await this.itemRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 }, order: { dictType: 'ASC', sortNo: 'ASC' } })
    const dictMap = new Map(dicts.map((item) => [item.dictType, item.dictName]))
    const rows = items.map((item) => ({
      dictCode: item.dictType,
      dictName: dictMap.get(item.dictType) ?? item.dictType,
      itemCode: item.itemCode,
      itemLabel: item.itemLabel,
      itemValue: item.itemValue ?? '',
      sortNo: item.sortNo,
      status: item.status
    }))
    return {
      filename: `dict-${user.tenantId}-${new Date().toISOString().slice(0, 10)}.csv`,
      content: exportDictCsv(rows)
    }
  }

  /** 导入字典 CSV：dryRun 仅预览不落库 */
  async importDictCsv(content: string, dryRun: boolean, user: JwtUser): Promise<{
    dryRun: boolean
    total: number
    createdTypes: number
    createdItems: number
    updatedItems: number
    errors: string[]
    summary: ReturnType<typeof summarizeDictImport>
  }> {
    const parsed = parseDictCsv(content)
    if (parsed.errors.length > 0 && parsed.rows.length === 0) {
      throw new BadRequestException(parsed.errors.join('；'))
    }
    const existingDicts = await this.dictRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const dictTypes = new Set(existingDicts.map((item) => item.dictType))
    const summary = summarizeDictImport(parsed.rows, dictTypes)
    if (dryRun) return { dryRun: true, total: summary.total, createdTypes: summary.newDicts, createdItems: 0, updatedItems: 0, errors: parsed.errors, summary }
    let createdTypes = 0
    let createdItems = 0
    let updatedItems = 0
    for (const row of parsed.rows) {
      if (!dictTypes.has(row.dictCode)) {
        await this.dictRepo.save(this.dictRepo.create({
          tenantId: user.tenantId,
          dictType: row.dictCode,
          dictName: row.dictName,
          status: 'ENABLED',
          createdBy: user.userId
        }))
        dictTypes.add(row.dictCode)
        createdTypes++
      }
      const existing = await this.itemRepo.findOne({
        where: { tenantId: user.tenantId, dictType: row.dictCode, itemCode: row.itemCode }
      })
      if (existing) {
        existing.itemLabel = row.itemLabel
        existing.itemValue = row.itemValue
        existing.sortNo = row.sortNo ?? 0
        await this.itemRepo.save(existing)
        updatedItems++
      } else {
        await this.itemRepo.save(this.itemRepo.create({
          tenantId: user.tenantId,
          dictType: row.dictCode,
          itemCode: row.itemCode,
          itemLabel: row.itemLabel,
          itemValue: row.itemValue,
          sortNo: row.sortNo ?? 0,
          status: 'ENABLED'
        }))
        createdItems++
      }
    }
    for (const dictType of dictTypes) {
      await this.redis.del(this.cacheKey(user.tenantId, dictType))
    }
    await this.auditService.record({
      bizType: 'sys_dict', bizId: 0, action: 'IMPORT_DICT',
      afterValue: { total: parsed.rows.length, createdTypes, createdItems, updatedItems }
    }, user)
    return { dryRun: false, total: parsed.rows.length, createdTypes, createdItems, updatedItems, errors: parsed.errors, summary }
  }

  async createItem(dto: CreateDictItemDto, user: JwtUser): Promise<DictItemEntity> {
    const existing = await this.itemRepo.findOne({
      where: { tenantId: user.tenantId, dictType: dto.dictType, itemCode: dto.itemCode, isDeleted: 0 }
    })
    if (existing) {
      throw new ConflictException('字典项编码已存在')
    }
    const entity = this.itemRepo.create({
      ...dto,
      tenantId: user.tenantId,
      status: 'ENABLED',
      sortNo: dto.sortNo ?? 0
    })
    const saved = await this.itemRepo.save(entity)
    await this.invalidateCache(user.tenantId, dto.dictType)
    await this.auditService.record({ bizType: 'dict_item', bizId: saved.id, action: 'CREATE_ITEM', afterValue: saved }, user)
    return saved
  }

  async updateItem(id: number, dto: UpdateDictItemDto, user: JwtUser): Promise<DictItemEntity> {
    const entity = await this.findItem(id, user)
    const before = { ...entity }
    Object.assign(entity, dto)
    const saved = await this.itemRepo.save(entity)
    await this.invalidateCache(user.tenantId, entity.dictType)
    await this.auditService.record({ bizType: 'dict_item', bizId: id, action: 'UPDATE_ITEM', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  async removeItem(id: number, user: JwtUser): Promise<void> {
    const entity = await this.findItem(id, user)
    entity.isDeleted = 1
    await this.itemRepo.save(entity)
    await this.invalidateCache(user.tenantId, entity.dictType)
    await this.auditService.record({ bizType: 'dict_item', bizId: id, action: 'DELETE_ITEM', beforeValue: entity }, user)
  }

  private async findType(id: number, user: JwtUser): Promise<DictEntity> {
    const entity = await this.dictRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) {
      throw new NotFoundException('字典类型不存在')
    }
    return entity
  }

  private async findItem(id: number, user: JwtUser): Promise<DictItemEntity> {
    const entity = await this.itemRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) {
      throw new NotFoundException('字典项不存在')
    }
    return entity
  }

  private cacheKey(tenantId: number, dictType: string): string {
    return `dict:${tenantId}:${dictType}`
  }

  private async invalidateCache(tenantId: number, dictType: string): Promise<void> {
    await this.redis.del(this.cacheKey(tenantId, dictType))
  }
}
