import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Like, Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { unsealSecret } from '../../common/utils/crypto.util'
import { sealSensitiveFields } from '../../common/utils/sensitive.util'
import { AuditService } from '../audit/audit.service'
import { CreateSupplierDto, QuerySupplierDto, UpdateSupplierDto } from './dto'
import { SupplierEntity } from './entities/supplier.entity'

@Injectable()
export class SupplierService {
  constructor(
    @InjectRepository(SupplierEntity) private readonly repo: Repository<SupplierEntity>,
    private readonly auditService: AuditService
  ) {}

  async list(query: QuerySupplierDto, user: JwtUser): Promise<PageResult<SupplierEntity>> {
    const where = {
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.keyword ? { supplierName: Like(`%${query.keyword}%`) } : {})
    }
    const [list, total] = await this.repo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list.map((item) => this.revealSupplier(item, user)), total, query.page, query.pageSize)
  }

  async create(dto: CreateSupplierDto, user: JwtUser): Promise<SupplierEntity> {
    const existing = await this.repo.findOne({
      where: { tenantId: user.tenantId, supplierCode: dto.supplierCode, isDeleted: 0 }
    })
    if (existing) throw new ConflictException('供应商编码已存在')
    const sealed = sealSensitiveFields({ bankAccount: dto.bankAccount ?? '' }, ['bankAccount'])
    const entity = this.repo.create({
      ...dto,
      tenantId: user.tenantId,
      qualificationStatus: dto.qualificationStatus ?? 'PENDING',
      qualificationExpire: dto.qualificationExpire ?? null,
      blacklist: dto.blacklist === 'YES' ? 1 : 0,
      ratingScore: dto.ratingScore ?? '0',
      contactName: dto.contactName ?? null,
      contactPhone: dto.contactPhone ?? null,
      // 明文列仅保存掩码，原文加密存储
      bankAccount: sealed.masked.bankAccountMask ?? null,
      bankAccountEncrypted: sealed.encrypted.bankAccountEncrypted ?? null,
      bankAccountMask: sealed.masked.bankAccountMask ?? null,
      bankName: dto.bankName ?? null,
      createdBy: user.userId
    })
    const saved = await this.repo.save(entity)
    await this.auditService.record({ bizType: 'supplier', bizId: saved.id, action: 'CREATE_SUPPLIER', afterValue: this.maskForAudit(saved) }, user)
    return this.revealSupplier(saved, user)
  }

  async update(id: number, dto: UpdateSupplierDto, user: JwtUser): Promise<SupplierEntity> {
    const entity = await this.findOwned(id, user)
    const before = this.maskForAudit(entity)
    const { blacklist, bankAccount, ...rest } = dto
    Object.assign(entity, rest)
    if (blacklist !== undefined) entity.blacklist = blacklist === 'YES' ? 1 : 0
    // 前端回传掩码视为未修改，避免把掩码当作真实账号重新加密落库
    if (bankAccount !== undefined && bankAccount !== entity.bankAccountMask) {
      const sealed = sealSensitiveFields({ bankAccount }, ['bankAccount'])
      entity.bankAccount = sealed.masked.bankAccountMask ?? null
      entity.bankAccountEncrypted = sealed.encrypted.bankAccountEncrypted ?? null
      entity.bankAccountMask = sealed.masked.bankAccountMask ?? null
    }
    entity.updatedBy = user.userId
    entity.updatedAt = new Date()
    const saved = await this.repo.save(entity)
    await this.auditService.record({ bizType: 'supplier', bizId: id, action: 'UPDATE_SUPPLIER', beforeValue: before, afterValue: this.maskForAudit(saved) }, user)
    return this.revealSupplier(saved, user)
  }

  async remove(id: number, user: JwtUser): Promise<void> {
    const entity = await this.findOwned(id, user)
    entity.isDeleted = 1
    await this.repo.save(entity)
    await this.auditService.record({ bizType: 'supplier', bizId: id, action: 'DELETE_SUPPLIER', beforeValue: this.maskForAudit(entity) }, user)
  }

  /** 敏感字段回显：具备 `purchase:supplier:bank` 权限才解密明文，否则仅返回掩码 */
  private revealSupplier(entity: SupplierEntity, user: JwtUser): SupplierEntity {
    const canView = user.isSuperAdmin || user.permissions.includes('purchase:supplier:bank')
    if (!canView) {
      return { ...entity, bankAccount: entity.bankAccountMask ?? entity.bankAccount, bankAccountEncrypted: null }
    }
    return {
      ...entity,
      bankAccount: unsealSecret(entity.bankAccountEncrypted) ?? entity.bankAccountMask ?? entity.bankAccount,
      bankAccountEncrypted: null
    }
  }

  /** 审计留痕脱敏：不落密文与明文账号 */
  private maskForAudit(entity: SupplierEntity): Record<string, unknown> {
    return {
      ...entity,
      bankAccount: entity.bankAccountMask ?? entity.bankAccount,
      bankAccountEncrypted: undefined,
      bankAccountMask: entity.bankAccountMask ?? undefined
    }
  }

  private async findOwned(id: number, user: JwtUser): Promise<SupplierEntity> {
    const entity = await this.repo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('供应商不存在')
    return entity
  }
}
