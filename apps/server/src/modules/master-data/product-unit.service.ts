import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import type { JwtUser } from '../../common/contracts'
import {
  buildUnitOptions,
  convertToBaseQty,
  validateConversionSet,
  type UnitConversionRow,
  type UnitOption
} from '../../common/product-unit-engine'
import { AuditService } from '../audit/audit.service'
import { ConvertProductUnitDto, CreateUnitConversionDto } from './dto'
import { ProductUnitConversionEntity } from './entities/product-unit-conversion.entity'
import { ProductUnitEntity } from './entities/product-unit.entity'
import { ProductEntity } from './entities/product.entity'

export interface ProductUnitConversionRow {
  id: number
  productId: number
  unitId: number
  unitCode: string
  unitName: string
  conversionRate: string
  isBase: number
  remark: string | null
  baseQty: number
}

/**
 * 产品多单位换算服务：
 * - 一个产品可配置多个计量单位（箱/件/包等），换算率以基准单位为准
 * - 同一产品下基准单位唯一，换算率必须为正数
 * - 换算配置变更留审计
 */
@Injectable()
export class ProductUnitService {
  constructor(
    @InjectRepository(ProductUnitConversionEntity) private readonly repo: Repository<ProductUnitConversionEntity>,
    @InjectRepository(ProductEntity) private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(ProductUnitEntity) private readonly unitRepo: Repository<ProductUnitEntity>,
    private readonly auditService: AuditService
  ) {}

  /** 读取产品全部换算配置（含单位档案） */
  private async loadRows(productId: number, user: JwtUser): Promise<UnitConversionRow[]> {
    const list = await this.repo.find({
      where: { tenantId: user.tenantId, productId },
      order: { isBase: 'DESC', id: 'ASC' }
    })
    if (list.length === 0) return []
    const unitIds = [...new Set(list.map((item) => item.unitId))]
    const units = await this.unitRepo.find({ where: { tenantId: user.tenantId, id: In(unitIds) } })
    const unitMap = new Map(units.map((unit) => [unit.id, unit]))
    return list.map((item) => {
      const unit = unitMap.get(item.unitId)
      return {
        unitId: item.unitId,
        unitCode: unit?.unitCode ?? String(item.unitId),
        unitName: unit?.unitName ?? '',
        conversionRate: Number(item.conversionRate),
        isBase: item.isBase === 1
      }
    })
  }

  /** 换算配置列表（带折合基准数量） */
  async list(productId: number, user: JwtUser): Promise<ProductUnitConversionRow[]> {
    const product = await this.productRepo.findOne({
      where: { id: productId, tenantId: user.tenantId, isDeleted: 0 }
    })
    if (!product) throw new NotFoundException('产品不存在')
    const rows = await this.loadRows(productId, user)
    const options = buildUnitOptions(rows)
    const records = await this.repo.find({
      where: { tenantId: user.tenantId, productId },
      order: { isBase: 'DESC', id: 'ASC' }
    })
    return records.map((record) => {
      const option = options.find((item) => item.unitId === record.unitId)
      return {
        id: record.id,
        productId: record.productId,
        unitId: record.unitId,
        unitCode: option?.unitCode ?? String(record.unitId),
        unitName: option?.unitName ?? '',
        conversionRate: record.conversionRate,
        isBase: record.isBase,
        remark: record.remark,
        baseQty: option?.baseQty ?? 0
      }
    })
  }

  /** 单据录入用的单位下拉选项 */
  async unitOptions(productId: number, user: JwtUser): Promise<UnitOption[]> {
    const rows = await this.loadRows(productId, user)
    return buildUnitOptions(rows)
  }

  /** 新增或覆盖一个单位换算配置 */
  async create(dto: CreateUnitConversionDto, user: JwtUser): Promise<ProductUnitConversionRow> {
    const product = await this.productRepo.findOne({
      where: { id: dto.productId, tenantId: user.tenantId, isDeleted: 0 }
    })
    if (!product) throw new NotFoundException('产品不存在')
    const unit = await this.unitRepo.findOne({
      where: { id: dto.unitId, tenantId: user.tenantId, isDeleted: 0 }
    })
    if (!unit) throw new NotFoundException('计量单位不存在')

    const rate = Number(dto.conversionRate ?? '1')
    if (!Number.isFinite(rate) || rate <= 0) throw new BadRequestException('换算率必须大于 0')

    const existingRows = await this.loadRows(dto.productId, user)
    const isBase = dto.isBase === 'YES'
    const merged: UnitConversionRow[] = [
      ...existingRows.filter((row) => row.unitId !== dto.unitId),
      { unitId: dto.unitId, unitCode: unit.unitCode, unitName: unit.unitName, conversionRate: rate, isBase }
    ]
    const issues = validateConversionSet(merged)
    if (issues.length > 0) throw new BadRequestException(issues.join('；'))

    const existing = await this.repo.findOne({
      where: { tenantId: user.tenantId, productId: dto.productId, unitId: dto.unitId }
    })
    if (existing) throw new ConflictException('该产品已配置此单位，请直接调整换算率')

    // 基准单位唯一：设置新基准时，其余单位降级为非基准
    if (isBase) {
      await this.repo.update(
        { tenantId: user.tenantId, productId: dto.productId },
        { isBase: 0 }
      )
    }

    const saved = await this.repo.save(this.repo.create({
      tenantId: user.tenantId,
      productId: dto.productId,
      unitId: dto.unitId,
      conversionRate: rate.toFixed(6),
      isBase: isBase ? 1 : 0,
      remark: dto.remark ?? null,
      createdBy: user.userId
    }))
    await this.auditService.record({
      bizType: 'product_unit_conversion',
      bizId: saved.id,
      action: 'CREATE_UNIT_CONVERSION',
      afterValue: saved
    }, user)
    const rows = await this.list(dto.productId, user)
    return rows.find((row) => row.id === saved.id) as ProductUnitConversionRow
  }

  /** 删除单位换算配置；不允许删除唯一基准单位 */
  async remove(id: number, user: JwtUser): Promise<void> {
    const record = await this.repo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!record) throw new NotFoundException('换算配置不存在')
    if (record.isBase === 1) throw new BadRequestException('基准单位不可直接删除，请先指定新的基准单位')
    record.remark = null
    await this.repo.remove(record)
    await this.auditService.record({
      bizType: 'product_unit_conversion',
      bizId: id,
      action: 'REMOVE_UNIT_CONVERSION',
      beforeValue: record
    }, user)
  }

  /** 把指定单位数量折算为基准单位数量 */
  async convert(dto: ConvertProductUnitDto, user: JwtUser): Promise<{ baseQty: number; unitId: number }> {
    const rows = await this.loadRows(dto.productId, user)
    if (rows.length === 0) throw new BadRequestException('该产品未配置单位换算')
    const qty = Number(dto.qty ?? '0')
    if (!Number.isFinite(qty)) throw new BadRequestException('数量格式不正确')
    const baseQty = convertToBaseQty(qty, dto.unitId, rows)
    if (baseQty === 0 && qty !== 0) throw new BadRequestException('单位不属于该产品或换算配置缺失')
    return { baseQty, unitId: dto.unitId }
  }
}
