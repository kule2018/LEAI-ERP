import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Like, Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { previewScope } from '../../common/business-extension-engine'
import { AuditService } from '../audit/audit.service'
import { CreateDataScopeDto, QueryDataScopeDto, UpdateDataScopeDto } from './dto'
import { DataScopeEntity } from './entities/data-scope.entity'

@Injectable()
export class DataScopeService {
  constructor(
    @InjectRepository(DataScopeEntity) private readonly repo: Repository<DataScopeEntity>,
    private readonly auditService: AuditService
  ) {}

  async list(query: QueryDataScopeDto, user: JwtUser): Promise<PageResult<DataScopeEntity>> {
    const where = {
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.keyword ? { scopeName: Like(`%${query.keyword}%`) } : {})
    }
    const [list, total] = await this.repo.findAndCount({
      where,
      order: { priority: 'DESC', id: 'ASC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async preview(bizType: string, user: JwtUser): Promise<Record<string, unknown>> {
    const rules = await this.repo.find({ where: { tenantId: user.tenantId, isDeleted: 0, status: 'ENABLED' } })
    return previewScope(bizType, user.dataScopeLevel, rules.map((rule) => ({
      bizType: rule.bizType,
      orgField: rule.orgField,
      scopeLevel: rule.scopeLevel,
      priority: rule.priority,
      status: rule.status
    })))
  }

  async create(dto: CreateDataScopeDto, user: JwtUser): Promise<DataScopeEntity> {
    const existing = await this.repo.findOne({
      where: { tenantId: user.tenantId, scopeCode: dto.scopeCode, isDeleted: 0 }
    })
    if (existing) {
      throw new ConflictException('数据权限编码已存在')
    }
    const entity = this.repo.create({
      ...dto,
      tenantId: user.tenantId,
      bizType: dto.bizType ?? 'ALL',
      orgField: dto.orgField ?? 'dept_id',
      priority: dto.priority ?? 0,
      createdBy: user.userId
    })
    const saved = await this.repo.save(entity)
    await this.auditService.record({ bizType: 'data_scope', bizId: saved.id, action: 'CREATE_SCOPE', afterValue: saved }, user)
    return saved
  }

  async update(id: number, dto: UpdateDataScopeDto, user: JwtUser): Promise<DataScopeEntity> {
    const entity = await this.findOwned(id, user)
    const before = { ...entity }
    Object.assign(entity, dto)
    const saved = await this.repo.save(entity)
    await this.auditService.record({ bizType: 'data_scope', bizId: id, action: 'UPDATE_SCOPE', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  async remove(id: number, user: JwtUser): Promise<void> {
    const entity = await this.findOwned(id, user)
    entity.isDeleted = 1
    await this.repo.save(entity)
    await this.auditService.record({ bizType: 'data_scope', bizId: id, action: 'DELETE_SCOPE', beforeValue: entity }, user)
  }

  private async findOwned(id: number, user: JwtUser): Promise<DataScopeEntity> {
    const entity = await this.repo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) {
      throw new NotFoundException('数据权限规则不存在')
    }
    return entity
  }
}
