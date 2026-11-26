import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Like, Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { AuditService } from '../audit/audit.service'
import {
  CreateCustomerAddressDto,
  CreateCustomerContactDto,
  CreateCustomerDto,
  QueryCustomerDto,
  UpdateCustomerAddressDto,
  UpdateCustomerContactDto,
  UpdateCustomerDto
} from './dto'
import { CustomerAddressEntity } from './entities/customer-address.entity'
import { CustomerContactEntity } from './entities/customer-contact.entity'
import { CustomerEntity } from './entities/customer.entity'
import { sealSensitiveFields } from '../../common/utils/sensitive.util'
import { unsealSecret } from '../../common/utils/crypto.util'

@Injectable()
export class CustomerService {
  constructor(
    @InjectRepository(CustomerEntity) private readonly repo: Repository<CustomerEntity>,
    @InjectRepository(CustomerContactEntity) private readonly contactRepo: Repository<CustomerContactEntity>,
    @InjectRepository(CustomerAddressEntity) private readonly addressRepo: Repository<CustomerAddressEntity>,
    private readonly auditService: AuditService
  ) {}

  async list(query: QueryCustomerDto, user: JwtUser): Promise<PageResult<CustomerEntity>> {
    const where = {
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.keyword ? { customerName: Like(`%${query.keyword}%`) } : {})
    }
    const [list, total] = await this.repo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async create(dto: CreateCustomerDto, user: JwtUser): Promise<CustomerEntity> {
    const existing = await this.repo.findOne({
      where: { tenantId: user.tenantId, customerCode: dto.customerCode, isDeleted: 0 }
    })
    if (existing) {
      throw new ConflictException('客户编码已存在')
    }
    const entity = this.repo.create({
      ...dto,
      tenantId: user.tenantId,
      creditLimit: dto.creditLimit ?? '0',
      createdBy: user.userId
    })
    const saved = await this.repo.save(entity)
    await this.auditService.record({ bizType: 'customer', bizId: saved.id, action: 'CREATE_CUSTOMER', afterValue: saved }, user)
    return saved
  }

  async update(id: number, dto: UpdateCustomerDto, user: JwtUser): Promise<CustomerEntity> {
    const entity = await this.findOwned(id, user)
    const before = { ...entity }
    Object.assign(entity, dto)
    entity.updatedBy = user.userId
    entity.updatedAt = new Date()
    const saved = await this.repo.save(entity)
    await this.auditService.record({ bizType: 'customer', bizId: id, action: 'UPDATE_CUSTOMER', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  async remove(id: number, user: JwtUser): Promise<void> {
    const entity = await this.findOwned(id, user)
    entity.isDeleted = 1
    await this.repo.save(entity)
    await this.auditService.record({ bizType: 'customer', bizId: id, action: 'DELETE_CUSTOMER', beforeValue: entity }, user)
  }

  async listContacts(customerId: number, user: JwtUser): Promise<CustomerContactEntity[]> {
    await this.findOwned(customerId, user)
    const list = await this.contactRepo.find({
      where: { tenantId: user.tenantId, customerId, isDeleted: 0 },
      order: { isPrimary: 'DESC', id: 'ASC' }
    })
    return list.map((item) => this.revealContact(item, user))
  }

  async createContact(customerId: number, dto: CreateCustomerContactDto, user: JwtUser): Promise<CustomerContactEntity> {
    await this.findOwned(customerId, user)
    if (dto.isPrimary === 'YES') {
      await this.clearPrimaryContact(customerId, user.tenantId)
    }
    const sealed = sealSensitiveFields({ phone: dto.phone ?? '', email: dto.email ?? '' }, ['phone', 'email'])
    const entity = this.contactRepo.create({
      ...dto,
      tenantId: user.tenantId,
      customerId,
      // 明文列仅保存掩码，原文加密存储
      phone: sealed.masked.phoneMask ?? null,
      email: sealed.masked.emailMask ?? null,
      phoneEncrypted: sealed.encrypted.phoneEncrypted ?? null,
      emailEncrypted: sealed.encrypted.emailEncrypted ?? null,
      phoneMask: sealed.masked.phoneMask ?? null,
      emailMask: sealed.masked.emailMask ?? null,
      position: dto.position ?? null,
      isPrimary: dto.isPrimary === 'YES' ? 1 : 0
    })
    const saved = await this.contactRepo.save(entity)
    await this.auditService.record({ bizType: 'customer_contact', bizId: saved.id, action: 'CREATE_CONTACT', afterValue: { id: saved.id, customerId } }, user)
    return this.revealContact(saved, user)
  }

  async updateContact(customerId: number, contactId: number, dto: UpdateCustomerContactDto, user: JwtUser): Promise<CustomerContactEntity> {
    const entity = await this.findContact(customerId, contactId, user)
    if (dto.isPrimary === 'YES') {
      await this.clearPrimaryContact(customerId, user.tenantId)
    }
    const { isPrimary, ...rest } = dto
    Object.assign(entity, rest)
    if (isPrimary !== undefined) {
      entity.isPrimary = isPrimary === 'YES' ? 1 : 0
    }
    if (dto.phone !== undefined || dto.email !== undefined) {
      const sealed = sealSensitiveFields({ phone: dto.phone ?? '', email: dto.email ?? '' }, ['phone', 'email'])
      if (dto.phone !== undefined) {
        entity.phone = sealed.masked.phoneMask ?? null
        entity.phoneEncrypted = sealed.encrypted.phoneEncrypted ?? null
        entity.phoneMask = sealed.masked.phoneMask ?? null
      }
      if (dto.email !== undefined) {
        entity.email = sealed.masked.emailMask ?? null
        entity.emailEncrypted = sealed.encrypted.emailEncrypted ?? null
        entity.emailMask = sealed.masked.emailMask ?? null
      }
    }
    const saved = await this.contactRepo.save(entity)
    await this.auditService.record({ bizType: 'customer_contact', bizId: saved.id, action: 'UPDATE_CONTACT', afterValue: { id: saved.id, customerId } }, user)
    return this.revealContact(saved, user)
  }

  /** 敏感字段回显：具备 `sales:customer:sensitive` 权限才解密明文，否则仅返回掩码 */
  private revealContact(entity: CustomerContactEntity, user: JwtUser): CustomerContactEntity {
    const canView = user.isSuperAdmin || user.permissions.includes('sales:customer:sensitive')
    if (!canView) return entity
    return {
      ...entity,
      phone: unsealSecret(entity.phoneEncrypted) ?? entity.phoneMask ?? entity.phone,
      email: unsealSecret(entity.emailEncrypted) ?? entity.emailMask ?? entity.email
    }
  }

  async removeContact(customerId: number, contactId: number, user: JwtUser): Promise<void> {
    const entity = await this.findContact(customerId, contactId, user)
    entity.isDeleted = 1
    await this.contactRepo.save(entity)
  }

  async listAddresses(customerId: number, user: JwtUser): Promise<CustomerAddressEntity[]> {
    await this.findOwned(customerId, user)
    return this.addressRepo.find({
      where: { tenantId: user.tenantId, customerId, isDeleted: 0 },
      order: { isDefault: 'DESC', id: 'ASC' }
    })
  }

  async createAddress(customerId: number, dto: CreateCustomerAddressDto, user: JwtUser): Promise<CustomerAddressEntity> {
    await this.findOwned(customerId, user)
    if (dto.isDefault === 'YES') {
      await this.clearDefaultAddress(customerId, user.tenantId)
    }
    const entity = this.addressRepo.create({
      ...dto,
      tenantId: user.tenantId,
      customerId,
      province: dto.province ?? null,
      city: dto.city ?? null,
      district: dto.district ?? null,
      contactName: dto.contactName ?? null,
      contactPhone: dto.contactPhone ?? null,
      isDefault: dto.isDefault === 'YES' ? 1 : 0
    })
    return this.addressRepo.save(entity)
  }

  async updateAddress(customerId: number, addressId: number, dto: UpdateCustomerAddressDto, user: JwtUser): Promise<CustomerAddressEntity> {
    const entity = await this.findAddress(customerId, addressId, user)
    if (dto.isDefault === 'YES') {
      await this.clearDefaultAddress(customerId, user.tenantId)
    }
    const { isDefault, ...rest } = dto
    Object.assign(entity, rest)
    if (isDefault !== undefined) {
      entity.isDefault = isDefault === 'YES' ? 1 : 0
    }
    return this.addressRepo.save(entity)
  }

  async removeAddress(customerId: number, addressId: number, user: JwtUser): Promise<void> {
    const entity = await this.findAddress(customerId, addressId, user)
    entity.isDeleted = 1
    await this.addressRepo.save(entity)
  }

  private async clearPrimaryContact(customerId: number, tenantId: number): Promise<void> {
    const contacts = await this.contactRepo.find({ where: { tenantId, customerId, isPrimary: 1 } })
    for (const contact of contacts) {
      contact.isPrimary = 0
      await this.contactRepo.save(contact)
    }
  }

  private async clearDefaultAddress(customerId: number, tenantId: number): Promise<void> {
    const addresses = await this.addressRepo.find({ where: { tenantId, customerId, isDefault: 1 } })
    for (const address of addresses) {
      address.isDefault = 0
      await this.addressRepo.save(address)
    }
  }

  private async findOwned(id: number, user: JwtUser): Promise<CustomerEntity> {
    const entity = await this.repo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('客户不存在')
    return entity
  }

  private async findContact(customerId: number, contactId: number, user: JwtUser): Promise<CustomerContactEntity> {
    const entity = await this.contactRepo.findOne({ where: { id: contactId, customerId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('联系人不存在')
    return entity
  }

  private async findAddress(customerId: number, addressId: number, user: JwtUser): Promise<CustomerAddressEntity> {
    const entity = await this.addressRepo.findOne({ where: { id: addressId, customerId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('地址不存在')
    return entity
  }
}
