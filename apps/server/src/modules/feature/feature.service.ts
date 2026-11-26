import { createHash } from 'node:crypto'
import { ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Like, type FindOptionsWhere, type Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { AuditService } from '../audit/audit.service'
import { TenantEntity } from '../platform/entities/tenant.entity'
import { CreateFeatureDto, QueryFeatureDto, UpdateFeatureDto } from './dto'
import { FeatureFlagEntity } from './entities/feature-flag.entity'

const DEFAULT_FLAGS = [
  { code: 'ai.enabled', name: 'AI 能力', module: 'AI' },
  { code: 'shop.enabled', name: '商城渠道', module: '商城' },
  { code: 'mobile.enabled', name: '移动工作台', module: '移动' },
  { code: 'openapi.enabled', name: '开放平台', module: '系统' }
]

@Injectable()
export class FeatureService implements OnModuleInit {
  constructor(
    @InjectRepository(FeatureFlagEntity) private readonly flagRepo: Repository<FeatureFlagEntity>,
    @InjectRepository(TenantEntity) private readonly tenantRepo: Repository<TenantEntity>,
    private readonly auditService: AuditService
  ) {}

  async onModuleInit(): Promise<void> {
    const tenants = await this.tenantRepo.find({ where: { isDeleted: 0 } })
    for (const tenant of tenants) {
      for (const flag of DEFAULT_FLAGS) {
        const existing = await this.flagRepo.findOne({ where: { tenantId: tenant.id, code: flag.code } })
        if (existing) continue
        await this.flagRepo.save(this.flagRepo.create({
          ...flag,
          tenantId: tenant.id,
          status: 'ON',
          grayUsers: [],
          grayRoles: [],
          grayPercent: 0,
          createdBy: 0
        }))
      }
    }
  }

  async list(query: QueryFeatureDto, user: JwtUser): Promise<PageResult<FeatureFlagEntity>> {
    const where: FindOptionsWhere<FeatureFlagEntity> = { tenantId: user.tenantId, isDeleted: 0 }
    if (query.status) where.status = query.status
    if (query.module) where.module = query.module
    if (query.keyword) where.name = Like(`%${query.keyword}%`)
    const [list, total] = await this.flagRepo.findAndCount({
      where,
      order: { id: 'ASC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async upsert(dto: CreateFeatureDto, user: JwtUser): Promise<FeatureFlagEntity> {
    const existing = await this.flagRepo.findOne({ where: { tenantId: user.tenantId, code: dto.code, isDeleted: 0 } })
    if (existing) throw new ConflictException('功能码已存在')
    const saved = await this.flagRepo.save(this.flagRepo.create({
      ...dto,
      tenantId: user.tenantId,
      status: dto.status ?? 'ON',
      grayUsers: dto.grayUsers ?? [],
      grayRoles: dto.grayRoles ?? [],
      grayPercent: dto.grayPercent ?? 0,
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'feature_flag', bizId: saved.id, action: 'CREATE_FEATURE', afterValue: saved }, user)
    return saved
  }

  async update(id: number, dto: UpdateFeatureDto, user: JwtUser): Promise<FeatureFlagEntity> {
    const flag = await this.findFlag(id, user)
    const before = { ...flag }
    Object.assign(flag, dto)
    flag.updatedAt = new Date()
    const saved = await this.flagRepo.save(flag)
    await this.auditService.record({ bizType: 'feature_flag', bizId: id, action: 'UPDATE_FEATURE', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  async remove(id: number, user: JwtUser): Promise<void> {
    const flag = await this.findFlag(id, user)
    flag.isDeleted = 1
    flag.status = 'OFF'
    await this.flagRepo.save(flag)
    await this.auditService.record({ bizType: 'feature_flag', bizId: id, action: 'DELETE_FEATURE', beforeValue: flag }, user)
  }

  /** 变更影响提示：说明开关状态对用户/角色的预计影响 */
  async impact(id: number, user: JwtUser): Promise<{
    code: string
    status: string
    affectedUsers: number[]
    affectedRoles: string[]
    estimatedPercent: number
    message: string
  }> {
    const flag = await this.findFlag(id, user)
    const affectedUsers = flag.grayUsers ?? []
    const affectedRoles = flag.grayRoles ?? []
    const percent = Number(flag.grayPercent ?? 0)
    const message = flag.status === 'ON'
      ? '全量启用：所有用户将看到该功能'
      : flag.status === 'OFF'
        ? '全量停用：所有用户将失去该功能'
        : `灰度中：${affectedUsers.length} 个指定用户、${affectedRoles.length} 个角色、${percent}% 用户可见`
    return {
      code: flag.code, status: flag.status, affectedUsers, affectedRoles, estimatedPercent: percent, message
    }
  }

  async check(code: string, user: JwtUser): Promise<{ code: string; enabled: boolean }> {
    return { code, enabled: await this.isEnabled(code, user) }
  }

  async isEnabled(code: string, user: JwtUser): Promise<boolean> {
    const flag = await this.flagRepo.findOne({ where: { tenantId: user.tenantId, code, isDeleted: 0 } })
    if (!flag || flag.status === 'OFF') return false
    if (flag.status === 'ON') return true
    if (flag.grayUsers?.includes(user.userId)) return true
    if (flag.grayRoles?.some((role) => user.roles.includes(role))) return true
    const percent = Number(flag.grayPercent ?? 0)
    if (percent <= 0) return false
    return this.hashPercent(`${code}:${user.userId}`) < percent
  }

  private hashPercent(value: string): number {
    const digest = createHash('sha256').update(value).digest()
    return digest[0]! % 100
  }

  private async findFlag(id: number, user: JwtUser): Promise<FeatureFlagEntity> {
    const entity = await this.flagRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('功能开关不存在')
    return entity
  }
}
