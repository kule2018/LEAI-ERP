import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Like, Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { AuditService } from '../audit/audit.service'
import {
  CreateLocationDto,
  CreateWarehouseDto,
  QueryWarehouseDto,
  UpdateLocationDto,
  UpdateWarehouseDto
} from './dto'
import { LocationEntity } from './entities/location.entity'
import { WarehouseEntity } from './entities/warehouse.entity'

@Injectable()
export class WarehouseService {
  constructor(
    @InjectRepository(WarehouseEntity) private readonly repo: Repository<WarehouseEntity>,
    @InjectRepository(LocationEntity) private readonly locationRepo: Repository<LocationEntity>,
    private readonly auditService: AuditService
  ) {}

  async list(query: QueryWarehouseDto, user: JwtUser): Promise<PageResult<WarehouseEntity>> {
    const where = {
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.keyword ? { warehouseName: Like(`%${query.keyword}%`) } : {})
    }
    const [list, total] = await this.repo.findAndCount({
      where,
      order: { isDefault: 'DESC', id: 'ASC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async create(dto: CreateWarehouseDto, user: JwtUser): Promise<WarehouseEntity> {
    const existing = await this.repo.findOne({ where: { tenantId: user.tenantId, warehouseCode: dto.warehouseCode, isDeleted: 0 } })
    if (existing) throw new ConflictException('仓库编码已存在')
    if (dto.isDefault === 'YES') await this.clearDefault(user.tenantId)
    const entity = this.repo.create({
      ...dto,
      tenantId: user.tenantId,
      orgId: dto.orgId ?? null,
      address: dto.address ?? null,
      manager: dto.manager ?? null,
      isDefault: dto.isDefault === 'YES' ? 1 : 0
    })
    const saved = await this.repo.save(entity)
    await this.auditService.record({ bizType: 'warehouse', bizId: saved.id, action: 'CREATE_WAREHOUSE', afterValue: saved }, user)
    return saved
  }

  async update(id: number, dto: UpdateWarehouseDto, user: JwtUser): Promise<WarehouseEntity> {
    const entity = await this.findOwned(id, user)
    const before = { ...entity }
    const { isDefault, ...rest } = dto
    Object.assign(entity, rest)
    if (isDefault !== undefined) {
      if (isDefault === 'YES') await this.clearDefault(user.tenantId)
      entity.isDefault = isDefault === 'YES' ? 1 : 0
    }
    const saved = await this.repo.save(entity)
    await this.auditService.record({ bizType: 'warehouse', bizId: id, action: 'UPDATE_WAREHOUSE', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  async remove(id: number, user: JwtUser): Promise<void> {
    const entity = await this.findOwned(id, user)
    entity.isDeleted = 1
    await this.repo.save(entity)
    await this.auditService.record({ bizType: 'warehouse', bizId: id, action: 'DELETE_WAREHOUSE', beforeValue: entity }, user)
  }

  async listLocations(warehouseId: number, user: JwtUser): Promise<LocationEntity[]> {
    await this.findOwned(warehouseId, user)
    return this.locationRepo.find({ where: { tenantId: user.tenantId, warehouseId, isDeleted: 0 }, order: { id: 'ASC' } })
  }

  async createLocation(warehouseId: number, dto: CreateLocationDto, user: JwtUser): Promise<LocationEntity> {
    await this.findOwned(warehouseId, user)
    const existing = await this.locationRepo.findOne({
      where: { tenantId: user.tenantId, warehouseId, locationCode: dto.locationCode, isDeleted: 0 }
    })
    if (existing) throw new ConflictException('库位编码已存在')
    return this.locationRepo.save(this.locationRepo.create({
      ...dto,
      tenantId: user.tenantId,
      warehouseId,
      locationName: dto.locationName ?? null,
      zoneCode: dto.zoneCode ?? null
    }))
  }

  async updateLocation(warehouseId: number, locationId: number, dto: UpdateLocationDto, user: JwtUser): Promise<LocationEntity> {
    const entity = await this.findLocation(warehouseId, locationId, user)
    Object.assign(entity, dto)
    return this.locationRepo.save(entity)
  }

  async removeLocation(warehouseId: number, locationId: number, user: JwtUser): Promise<void> {
    const entity = await this.findLocation(warehouseId, locationId, user)
    entity.isDeleted = 1
    await this.locationRepo.save(entity)
  }

  private async clearDefault(tenantId: number): Promise<void> {
    const warehouses = await this.repo.find({ where: { tenantId, isDefault: 1, isDeleted: 0 } })
    for (const warehouse of warehouses) {
      warehouse.isDefault = 0
      await this.repo.save(warehouse)
    }
  }

  private async findOwned(id: number, user: JwtUser): Promise<WarehouseEntity> {
    const entity = await this.repo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('仓库不存在')
    return entity
  }

  private async findLocation(warehouseId: number, locationId: number, user: JwtUser): Promise<LocationEntity> {
    const entity = await this.locationRepo.findOne({ where: { id: locationId, warehouseId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('库位不存在')
    return entity
  }
}
