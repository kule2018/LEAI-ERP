import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsWhere, Repository } from 'typeorm'
import type { JwtUser } from '../../common/contracts'
import { AuditService } from '../audit/audit.service'
import { CreateFavoriteDto, QueryFavoriteDto, SaveDraftDto, SaveViewConfigDto } from './dto'
import { QuickSearchLogEntity } from './entities/quick-search-log.entity'
import { UserDraftEntity } from './entities/user-draft.entity'
import { UserFavoriteEntity } from './entities/user-favorite.entity'
import { UserViewConfigEntity } from './entities/user-view-config.entity'

/**
 * 用户偏好服务：列表视图配置、个人收藏、快捷搜索历史与草稿。
 */
@Injectable()
export class UserPreferenceService {
  constructor(
    @InjectRepository(UserViewConfigEntity) private readonly viewConfigRepo: Repository<UserViewConfigEntity>,
    @InjectRepository(UserFavoriteEntity) private readonly favoriteRepo: Repository<UserFavoriteEntity>,
    @InjectRepository(QuickSearchLogEntity) private readonly searchLogRepo: Repository<QuickSearchLogEntity>,
    @InjectRepository(UserDraftEntity) private readonly draftRepo: Repository<UserDraftEntity>,
    private readonly auditService: AuditService
  ) {}

  /** 读取视图配置，无配置时返回空对象 */
  async viewConfig(pageKey: string, user: JwtUser): Promise<Record<string, unknown>> {
    const entity = await this.viewConfigRepo.findOne({
      where: { tenantId: user.tenantId, userId: user.userId, pageKey }
    })
    return entity?.config ?? {}
  }

  /** 保存视图配置 */
  async saveViewConfig(pageKey: string, dto: SaveViewConfigDto, user: JwtUser): Promise<Record<string, unknown>> {
    const existing = await this.viewConfigRepo.findOne({
      where: { tenantId: user.tenantId, userId: user.userId, pageKey }
    })
    if (existing) {
      existing.config = dto.config ?? {}
      existing.updatedAt = new Date()
      const saved = await this.viewConfigRepo.save(existing)
      return saved.config
    }
    const entity = this.viewConfigRepo.create({
      tenantId: user.tenantId,
      userId: user.userId,
      pageKey,
      config: dto.config ?? {}
    })
    const saved = await this.viewConfigRepo.save(entity)
    return saved.config
  }

  async listFavorites(query: QueryFavoriteDto, user: JwtUser): Promise<UserFavoriteEntity[]> {
    const where: FindOptionsWhere<UserFavoriteEntity> = { tenantId: user.tenantId, userId: user.userId }
    if (query.targetType) where.targetType = query.targetType
    return this.favoriteRepo.find({ where, order: { sortNo: 'ASC', id: 'DESC' } })
  }

  /** 新增收藏，已存在则更新标题等信息 */
  async addFavorite(dto: CreateFavoriteDto, user: JwtUser): Promise<UserFavoriteEntity> {
    const targetType = dto.targetType?.trim() || 'PAGE'
    const targetKey = dto.targetKey.trim()
    const existing = await this.favoriteRepo.findOne({
      where: { tenantId: user.tenantId, userId: user.userId, targetType, targetKey }
    })
    if (existing) {
      existing.title = dto.title.trim()
      existing.route = dto.route?.trim() ?? existing.route
      existing.bizType = dto.bizType?.trim() ?? existing.bizType
      existing.bizId = dto.bizId ?? existing.bizId
      existing.remark = dto.remark?.trim() ?? existing.remark
      return this.favoriteRepo.save(existing)
    }
    const entity = this.favoriteRepo.create({
      tenantId: user.tenantId,
      userId: user.userId,
      targetType,
      targetKey,
      title: dto.title.trim(),
      route: dto.route?.trim() ?? null,
      bizType: dto.bizType?.trim() ?? null,
      bizId: dto.bizId ?? null,
      remark: dto.remark?.trim() ?? null,
      sortNo: 0
    })
    const saved = await this.favoriteRepo.save(entity)
    await this.auditService.record({
      bizType: 'user_favorite',
      bizId: saved.id,
      action: 'ADD_USER_FAVORITE',
      afterValue: { targetType, targetKey, title: saved.title }
    }, user)
    return saved
  }

  async removeFavorite(id: number, user: JwtUser): Promise<{ id: number }> {
    const entity = await this.favoriteRepo.findOne({
      where: { id, tenantId: user.tenantId, userId: user.userId }
    })
    if (!entity) throw new NotFoundException('收藏不存在')
    await this.favoriteRepo.remove(entity)
    await this.auditService.record({
      bizType: 'user_favorite',
      bizId: id,
      action: 'REMOVE_USER_FAVORITE',
      beforeValue: { targetType: entity.targetType, targetKey: entity.targetKey, title: entity.title }
    }, user)
    return { id }
  }

  /** 收藏开关：已收藏则取消，未收藏则新增 */
  async toggleFavorite(dto: CreateFavoriteDto, user: JwtUser): Promise<{ favorited: boolean; id?: number }> {
    const targetType = dto.targetType?.trim() || 'PAGE'
    const targetKey = dto.targetKey.trim()
    const existing = await this.favoriteRepo.findOne({
      where: { tenantId: user.tenantId, userId: user.userId, targetType, targetKey }
    })
    if (existing) {
      await this.removeFavorite(existing.id, user)
      return { favorited: false }
    }
    const saved = await this.addFavorite(dto, user)
    return { favorited: true, id: saved.id }
  }

  /** 快捷搜索历史：记录关键词并累计次数 */
  async recordSearchKeyword(keyword: string, user: JwtUser): Promise<QuickSearchLogEntity> {
    const trimmed = keyword.trim()
    if (!trimmed) throw new NotFoundException('搜索关键词不能为空')
    const existing = await this.searchLogRepo.findOne({
      where: { tenantId: user.tenantId, userId: user.userId, keyword: trimmed }
    })
    if (existing) {
      existing.count += 1
      existing.lastUsedAt = new Date()
      return this.searchLogRepo.save(existing)
    }
    const entity = this.searchLogRepo.create({
      tenantId: user.tenantId,
      userId: user.userId,
      keyword: trimmed,
      count: 1,
      lastUsedAt: new Date()
    })
    return this.searchLogRepo.save(entity)
  }

  /** 快捷搜索历史列表：按最近使用时间倒序 */
  async listSearchHistory(limit: number, user: JwtUser): Promise<QuickSearchLogEntity[]> {
    return this.searchLogRepo.find({
      where: { tenantId: user.tenantId, userId: user.userId },
      order: { lastUsedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 50)
    })
  }

  /** 清空快捷搜索历史 */
  async clearSearchHistory(user: JwtUser): Promise<{ cleared: number }> {
    const result = await this.searchLogRepo.delete({ tenantId: user.tenantId, userId: user.userId })
    return { cleared: result.affected ?? 0 }
  }

  /** 读取草稿 */
  async getDraft(draftKey: string, user: JwtUser): Promise<UserDraftEntity | null> {
    return this.draftRepo.findOne({
      where: { tenantId: user.tenantId, userId: user.userId, draftKey }
    })
  }

  /** 保存草稿（覆盖式写入） */
  async saveDraft(draftKey: string, dto: SaveDraftDto, user: JwtUser): Promise<UserDraftEntity> {
    const existing = await this.draftRepo.findOne({
      where: { tenantId: user.tenantId, userId: user.userId, draftKey }
    })
    if (existing) {
      existing.content = dto.content ?? {}
      existing.updatedAt = new Date()
      return this.draftRepo.save(existing)
    }
    const entity = this.draftRepo.create({
      tenantId: user.tenantId,
      userId: user.userId,
      draftKey,
      content: dto.content ?? {}
    })
    return this.draftRepo.save(entity)
  }

  /** 删除草稿（提交成功后调用） */
  async deleteDraft(draftKey: string, user: JwtUser): Promise<{ deleted: boolean }> {
    const result = await this.draftRepo.delete({ tenantId: user.tenantId, userId: user.userId, draftKey })
    return { deleted: (result.affected ?? 0) > 0 }
  }
}
