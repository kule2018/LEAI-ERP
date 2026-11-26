import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Like, Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { AuditService } from '../audit/audit.service'
import {
  CreateLookupDto,
  CreateProductDto,
  CreateVariantRequestDto,
  QueryProductDto,
  UpdateProductDto,
  UpdateVariantDto
} from './dto'
import { ProductBrandEntity } from './entities/product-brand.entity'
import { ProductCategoryEntity } from './entities/product-category.entity'
import { ProductEntity } from './entities/product.entity'
import { ProductUnitEntity } from './entities/product-unit.entity'
import { ProductVariantEntity } from './entities/product-variant.entity'
import { LocationEntity } from './entities/location.entity'
import { WarehouseEntity } from './entities/warehouse.entity'

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(ProductEntity) private readonly repo: Repository<ProductEntity>,
    @InjectRepository(ProductVariantEntity) private readonly variantRepo: Repository<ProductVariantEntity>,
    @InjectRepository(ProductCategoryEntity) private readonly categoryRepo: Repository<ProductCategoryEntity>,
    @InjectRepository(ProductBrandEntity) private readonly brandRepo: Repository<ProductBrandEntity>,
    @InjectRepository(ProductUnitEntity) private readonly unitRepo: Repository<ProductUnitEntity>,
    @InjectRepository(WarehouseEntity) private readonly warehouseRepo: Repository<WarehouseEntity>,
    @InjectRepository(LocationEntity) private readonly locationRepo: Repository<LocationEntity>,
    private readonly auditService: AuditService
  ) {}

  /**
   * 校验默认仓库/库位归属：必须属于当前租户，库位必须落在默认仓库下。
   */
  private async validateDefaults(
    defaultWarehouseId: number | null | undefined,
    defaultLocationId: number | null | undefined,
    user: JwtUser
  ): Promise<void> {
    if (defaultWarehouseId) {
      const warehouse = await this.warehouseRepo.findOne({
        where: { id: defaultWarehouseId, tenantId: user.tenantId, isDeleted: 0 }
      })
      if (!warehouse) throw new NotFoundException('默认仓库不存在')
    }
    if (defaultLocationId) {
      const location = await this.locationRepo.findOne({
        where: { id: defaultLocationId, tenantId: user.tenantId, isDeleted: 0 }
      })
      if (!location) throw new NotFoundException('默认库位不存在')
      if (defaultWarehouseId && location.warehouseId !== defaultWarehouseId) {
        throw new ConflictException('默认库位不属于所选默认仓库')
      }
    }
  }

  async list(query: QueryProductDto, user: JwtUser): Promise<PageResult<ProductEntity>> {
    const where = {
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.keyword ? { productName: Like(`%${query.keyword}%`) } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {})
    }
    const [list, total] = await this.repo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async create(dto: CreateProductDto, user: JwtUser): Promise<ProductEntity> {
    const existing = await this.repo.findOne({
      where: { tenantId: user.tenantId, productCode: dto.productCode, isDeleted: 0 }
    })
    if (existing) throw new ConflictException('产品编码已存在')

    const variants = dto.variants ?? []
    const skuCodes = variants.map((variant) => variant.skuCode)
    if (new Set(skuCodes).size !== skuCodes.length) throw new ConflictException('SKU 编码不能重复')
    for (const skuCode of skuCodes) {
      const duplicate = await this.variantRepo.findOne({ where: { tenantId: user.tenantId, skuCode, isDeleted: 0 } })
      if (duplicate) throw new ConflictException(`SKU 已存在：${skuCode}`)
    }

    await this.validateDefaults(dto.defaultWarehouseId, dto.defaultLocationId, user)
    const entity = this.repo.create({
      ...dto,
      tenantId: user.tenantId,
      barcode: dto.barcode ?? null,
      categoryId: dto.categoryId ?? null,
      brandId: dto.brandId ?? null,
      unitId: dto.unitId ?? null,
      productType: dto.productType ?? 'STANDARD',
      trackingType: dto.trackingType ?? 'NONE',
      cost: dto.cost ?? '0',
      price: dto.price ?? '0',
      imageUrl: dto.imageUrl ?? null,
      attributes: dto.attributes ?? null,
      defaultWarehouseId: dto.defaultWarehouseId ?? null,
      defaultLocationId: dto.defaultLocationId ?? null,
      createdBy: user.userId
    })
    const saved = await this.repo.save(entity)

    for (const variant of variants) {
      await this.variantRepo.save(this.variantRepo.create({
        ...variant,
        tenantId: user.tenantId,
        productId: saved.id,
        barcode: variant.barcode ?? null,
        cost: variant.cost ?? saved.cost,
        price: variant.price ?? saved.price,
        attributes: variant.attributes ?? null
      }))
    }

    await this.auditService.record({ bizType: 'product', bizId: saved.id, action: 'CREATE_PRODUCT', afterValue: { product: saved, variants } }, user)
    return saved
  }

  async update(id: number, dto: UpdateProductDto, user: JwtUser): Promise<ProductEntity> {
    const entity = await this.findOwned(id, user)
    const before = { ...entity }
    const { isActive, ...rest } = dto
    await this.validateDefaults(rest.defaultWarehouseId, rest.defaultLocationId, user)
    Object.assign(entity, rest)
    if (isActive !== undefined) entity.isActive = isActive === 'YES' ? 1 : 0
    entity.updatedBy = user.userId
    entity.updatedAt = new Date()
    const saved = await this.repo.save(entity)
    await this.auditService.record({ bizType: 'product', bizId: id, action: 'UPDATE_PRODUCT', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  async remove(id: number, user: JwtUser): Promise<void> {
    const entity = await this.findOwned(id, user)
    entity.isDeleted = 1
    await this.repo.save(entity)
    await this.auditService.record({ bizType: 'product', bizId: id, action: 'DELETE_PRODUCT', beforeValue: entity }, user)
  }

  async listVariants(productId: number, user: JwtUser): Promise<ProductVariantEntity[]> {
    await this.findOwned(productId, user)
    return this.variantRepo.find({
      where: { tenantId: user.tenantId, productId, isDeleted: 0 },
      order: { id: 'ASC' }
    })
  }

  async createVariant(productId: number, dto: CreateVariantRequestDto, user: JwtUser): Promise<ProductVariantEntity> {
    const product = await this.findOwned(productId, user)
    const duplicate = await this.variantRepo.findOne({
      where: { tenantId: user.tenantId, skuCode: dto.skuCode, isDeleted: 0 }
    })
    if (duplicate) throw new ConflictException('SKU 编码已存在')
    const entity = this.variantRepo.create({
      ...dto,
      tenantId: user.tenantId,
      productId,
      barcode: dto.barcode ?? null,
      cost: dto.cost ?? product.cost,
      price: dto.price ?? product.price,
      attributes: dto.attributes ?? null
    })
    return this.variantRepo.save(entity)
  }

  async updateVariant(productId: number, variantId: number, dto: UpdateVariantDto, user: JwtUser): Promise<ProductVariantEntity> {
    const entity = await this.findVariant(productId, variantId, user)
    Object.assign(entity, dto)
    return this.variantRepo.save(entity)
  }

  async removeVariant(productId: number, variantId: number, user: JwtUser): Promise<void> {
    const entity = await this.findVariant(productId, variantId, user)
    entity.isDeleted = 1
    await this.variantRepo.save(entity)
  }

  async listCategories(user: JwtUser): Promise<ProductCategoryEntity[]> {
    return this.categoryRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 }, order: { sortNo: 'ASC', id: 'ASC' } })
  }

  async createCategory(dto: CreateLookupDto, user: JwtUser): Promise<ProductCategoryEntity> {
    const existing = await this.categoryRepo.findOne({ where: { tenantId: user.tenantId, categoryCode: dto.code, isDeleted: 0 } })
    if (existing) throw new ConflictException('分类编码已存在')
    return this.categoryRepo.save(this.categoryRepo.create({
      tenantId: user.tenantId,
      categoryCode: dto.code,
      categoryName: dto.name,
      sortNo: dto.sortNo ?? 0
    }))
  }

  async listBrands(user: JwtUser): Promise<ProductBrandEntity[]> {
    return this.brandRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 }, order: { id: 'ASC' } })
  }

  async createBrand(dto: CreateLookupDto, user: JwtUser): Promise<ProductBrandEntity> {
    const existing = await this.brandRepo.findOne({ where: { tenantId: user.tenantId, brandCode: dto.code, isDeleted: 0 } })
    if (existing) throw new ConflictException('品牌编码已存在')
    return this.brandRepo.save(this.brandRepo.create({ tenantId: user.tenantId, brandCode: dto.code, brandName: dto.name }))
  }

  async listUnits(user: JwtUser): Promise<ProductUnitEntity[]> {
    return this.unitRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 }, order: { id: 'ASC' } })
  }

  async createUnit(dto: CreateLookupDto, user: JwtUser): Promise<ProductUnitEntity> {
    const existing = await this.unitRepo.findOne({ where: { tenantId: user.tenantId, unitCode: dto.code, isDeleted: 0 } })
    if (existing) throw new ConflictException('单位编码已存在')
    return this.unitRepo.save(this.unitRepo.create({ tenantId: user.tenantId, unitCode: dto.code, unitName: dto.name, precision: 3 }))
  }

  private async findOwned(id: number, user: JwtUser): Promise<ProductEntity> {
    const entity = await this.repo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('产品不存在')
    return entity
  }

  private async findVariant(productId: number, variantId: number, user: JwtUser): Promise<ProductVariantEntity> {
    const entity = await this.variantRepo.findOne({ where: { id: variantId, productId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('SKU 不存在')
    return entity
  }
}
