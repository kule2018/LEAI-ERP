import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsWhere, In, Repository } from 'typeorm'
import {
  buildCustomFormSchema,
  sanitizeCustomValues,
  validateCustomValues,
  type CustomFieldDefinition
} from '../../common/custom-field-engine'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { AuditService } from '../audit/audit.service'
import {
  CreateCustomFieldDto,
  CreateCustomFormDto,
  QueryCustomFieldDto,
  QueryCustomFormDto,
  SaveCustomValuesDto,
  UpdateCustomFieldDto,
  UpdateCustomFormDto
} from './dto'
import { CustomFieldEntity } from './entities/custom-field.entity'
import { CustomFieldValueEntity } from './entities/custom-field-value.entity'
import { CustomFormEntity } from './entities/custom-form.entity'

/**
 * 自定义字段/表单服务：字段定义维护、表单布局维护与动态字段取值读写。
 */
@Injectable()
export class CustomFieldService {
  constructor(
    @InjectRepository(CustomFieldEntity) private readonly fieldRepo: Repository<CustomFieldEntity>,
    @InjectRepository(CustomFormEntity) private readonly formRepo: Repository<CustomFormEntity>,
    @InjectRepository(CustomFieldValueEntity) private readonly valueRepo: Repository<CustomFieldValueEntity>,
    private readonly auditService: AuditService
  ) {}

  async listFields(query: QueryCustomFieldDto, user: JwtUser): Promise<PageResult<CustomFieldEntity>> {
    const where: FindOptionsWhere<CustomFieldEntity> = { tenantId: user.tenantId, isDeleted: 0 }
    if (query.entityCode) where.entityCode = query.entityCode
    if (query.fieldType) where.fieldType = query.fieldType
    const [list, total] = await this.fieldRepo.findAndCount({
      where,
      order: { entityCode: 'ASC', displayOrder: 'ASC', id: 'ASC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createField(dto: CreateCustomFieldDto, user: JwtUser): Promise<CustomFieldEntity> {
    const entityCode = dto.entityCode.trim()
    const fieldKey = dto.fieldKey.trim()
    const exists = await this.fieldRepo.findOne({ where: { tenantId: user.tenantId, entityCode, fieldKey, isDeleted: 0 } })
    if (exists) throw new BadRequestException('同一业务对象下字段标识不能重复')
    const entity = this.fieldRepo.create({
      tenantId: user.tenantId,
      entityCode,
      fieldKey,
      fieldLabel: dto.fieldLabel.trim(),
      fieldType: dto.fieldType ?? 'TEXT',
      options: dto.options ?? null,
      defaultValue: dto.defaultValue ?? null,
      required: dto.required ? 1 : 0,
      visibleInList: dto.visibleInList === false ? 0 : 1,
      allowFilter: dto.allowFilter ? 1 : 0,
      maxLength: dto.maxLength ?? null,
      minValue: dto.min !== undefined ? String(dto.min) : null,
      maxValue: dto.max !== undefined ? String(dto.max) : null,
      pattern: dto.pattern ?? null,
      groupName: dto.groupName?.trim() || '基础信息',
      displayOrder: dto.displayOrder ?? 0,
      referenceType: dto.referenceType ?? null,
      condition: dto.condition ?? null,
      status: 'ACTIVE',
      remark: dto.remark?.trim() ?? null,
      createdBy: user.userId
    })
    const saved = await this.fieldRepo.save(entity)
    await this.auditService.record({
      bizType: 'custom_field',
      bizId: saved.id,
      action: 'CREATE_CUSTOM_FIELD',
      afterValue: { entityCode, fieldKey, fieldType: saved.fieldType }
    }, user)
    return saved
  }

  async updateField(id: number, dto: UpdateCustomFieldDto, user: JwtUser): Promise<CustomFieldEntity> {
    const entity = await this.findField(id, user)
    const before = { ...entity }
    if (dto.fieldLabel !== undefined) entity.fieldLabel = dto.fieldLabel.trim()
    if (dto.fieldType !== undefined) entity.fieldType = dto.fieldType
    if (dto.options !== undefined) entity.options = dto.options
    if (dto.defaultValue !== undefined) entity.defaultValue = dto.defaultValue
    if (dto.required !== undefined) entity.required = dto.required ? 1 : 0
    if (dto.visibleInList !== undefined) entity.visibleInList = dto.visibleInList ? 1 : 0
    if (dto.allowFilter !== undefined) entity.allowFilter = dto.allowFilter ? 1 : 0
    if (dto.maxLength !== undefined) entity.maxLength = dto.maxLength
    if (dto.min !== undefined) entity.minValue = String(dto.min)
    if (dto.max !== undefined) entity.maxValue = String(dto.max)
    if (dto.pattern !== undefined) entity.pattern = dto.pattern
    if (dto.groupName !== undefined) entity.groupName = dto.groupName.trim() || '基础信息'
    if (dto.displayOrder !== undefined) entity.displayOrder = dto.displayOrder
    if (dto.referenceType !== undefined) entity.referenceType = dto.referenceType
    if (dto.condition !== undefined) entity.condition = dto.condition
    if (dto.status !== undefined) entity.status = dto.status
    if (dto.remark !== undefined) entity.remark = dto.remark?.trim() ?? null
    entity.updatedAt = new Date()
    const saved = await this.fieldRepo.save(entity)
    await this.auditService.record({
      bizType: 'custom_field',
      bizId: id,
      action: 'UPDATE_CUSTOM_FIELD',
      beforeValue: { fieldLabel: before.fieldLabel, fieldType: before.fieldType, required: before.required },
      afterValue: { fieldLabel: saved.fieldLabel, fieldType: saved.fieldType, required: saved.required }
    }, user)
    return saved
  }

  async removeField(id: number, user: JwtUser): Promise<{ id: number }> {
    const entity = await this.findField(id, user)
    entity.isDeleted = 1
    entity.status = 'DISABLED'
    entity.updatedAt = new Date()
    await this.fieldRepo.save(entity)
    await this.valueRepo.delete({ tenantId: user.tenantId, entityCode: entity.entityCode, fieldKey: entity.fieldKey })
    await this.auditService.record({
      bizType: 'custom_field',
      bizId: id,
      action: 'DELETE_CUSTOM_FIELD',
      beforeValue: { fieldKey: entity.fieldKey, entityCode: entity.entityCode }
    }, user)
    return { id }
  }

  async listForms(query: QueryCustomFormDto, user: JwtUser): Promise<PageResult<CustomFormEntity>> {
    const where: FindOptionsWhere<CustomFormEntity> = { tenantId: user.tenantId, isDeleted: 0 }
    if (query.entityCode) where.entityCode = query.entityCode
    const [list, total] = await this.formRepo.findAndCount({
      where,
      order: { entityCode: 'ASC', id: 'ASC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createForm(dto: CreateCustomFormDto, user: JwtUser): Promise<CustomFormEntity> {
    const formCode = dto.formCode.trim()
    const exists = await this.formRepo.findOne({ where: { tenantId: user.tenantId, formCode, isDeleted: 0 } })
    if (exists) throw new BadRequestException('表单编码已存在')
    const entity = this.formRepo.create({
      tenantId: user.tenantId,
      formCode,
      formName: dto.formName.trim(),
      entityCode: dto.entityCode.trim(),
      layout: dto.layout ?? null,
      version: 1,
      status: dto.status ?? 'ACTIVE',
      remark: dto.remark?.trim() ?? null,
      createdBy: user.userId
    })
    const saved = await this.formRepo.save(entity)
    await this.auditService.record({
      bizType: 'custom_form',
      bizId: saved.id,
      action: 'CREATE_CUSTOM_FORM',
      afterValue: { formCode, entityCode: saved.entityCode }
    }, user)
    return saved
  }

  async updateForm(id: number, dto: UpdateCustomFormDto, user: JwtUser): Promise<CustomFormEntity> {
    const entity = await this.findForm(id, user)
    const before = { ...entity }
    if (dto.formName !== undefined) entity.formName = dto.formName.trim()
    if (dto.layout !== undefined) entity.layout = dto.layout
    if (dto.version !== undefined) entity.version = dto.version
    if (dto.status !== undefined) entity.status = dto.status
    if (dto.remark !== undefined) entity.remark = dto.remark?.trim() ?? null
    entity.updatedAt = new Date()
    const saved = await this.formRepo.save(entity)
    await this.auditService.record({
      bizType: 'custom_form',
      bizId: id,
      action: 'UPDATE_CUSTOM_FORM',
      beforeValue: { version: before.version, status: before.status },
      afterValue: { version: saved.version, status: saved.status }
    }, user)
    return saved
  }

  async removeForm(id: number, user: JwtUser): Promise<{ id: number }> {
    const entity = await this.findForm(id, user)
    entity.isDeleted = 1
    entity.status = 'DISABLED'
    entity.updatedAt = new Date()
    await this.formRepo.save(entity)
    await this.auditService.record({
      bizType: 'custom_form',
      bizId: id,
      action: 'DELETE_CUSTOM_FORM',
      beforeValue: { formCode: entity.formCode }
    }, user)
    return { id }
  }

  /** 表单结构：字段定义 + 布局 + 分组，供前端动态渲染 */
  async schema(entityCode: string, user: JwtUser): Promise<{
    entityCode: string
    fields: CustomFieldDefinition[]
    groups: ReturnType<typeof buildCustomFormSchema>
    form: CustomFormEntity | null
  }> {
    const fields = await this.definitions(entityCode, user)
    const form = await this.formRepo.findOne({
      where: { tenantId: user.tenantId, entityCode, isDeleted: 0 },
      order: { id: 'ASC' }
    })
    return {
      entityCode,
      fields,
      groups: buildCustomFormSchema(fields),
      form: form ?? null
    }
  }

  /** 读取某业务单据的自定义字段取值 */
  async values(entityCode: string, bizId: number, user: JwtUser): Promise<Record<string, unknown>> {
    const rows = await this.valueRepo.find({ where: { tenantId: user.tenantId, entityCode, bizId } })
    const result: Record<string, unknown> = {}
    for (const row of rows) {
      result[row.fieldKey] = this.parseValue(row.fieldValue)
    }
    return result
  }

  /**
   * 批量读取多个业务单据的自定义字段取值：供列表页一次性加载动态列，
   * 返回结构为 { [bizId]: { [fieldKey]: value } }。
   */
  async valuesBatch(
    entityCode: string,
    bizIds: number[],
    user: JwtUser
  ): Promise<Record<string, Record<string, unknown>>> {
    if (!bizIds.length) return {}
    const rows = await this.valueRepo.find({
      where: { tenantId: user.tenantId, entityCode, bizId: In(bizIds) }
    })
    const result: Record<string, Record<string, unknown>> = {}
    for (const row of rows) {
      const bucket = result[String(row.bizId)] ?? (result[String(row.bizId)] = {})
      bucket[row.fieldKey] = this.parseValue(row.fieldValue)
    }
    return result
  }

  /** 保存某业务单据的自定义字段取值：先校验再落库 */
  async saveValues(
    entityCode: string,
    bizId: number,
    dto: SaveCustomValuesDto,
    user: JwtUser
  ): Promise<Record<string, unknown>> {
    const fields = await this.definitions(entityCode, user)
    if (fields.length === 0) throw new BadRequestException('该业务对象未配置自定义字段')
    const sanitized = sanitizeCustomValues(fields, dto.values ?? {})
    const validation = validateCustomValues(fields, sanitized)
    if (!validation.ok) {
      throw new BadRequestException(validation.errors.map((error) => `${error.fieldLabel}：${error.message}`).join('；'))
    }
    const stored = await this.valueRepo.find({ where: { tenantId: user.tenantId, entityCode, bizId } })
    const storedMap = new Map(stored.map((row) => [row.fieldKey, row]))
    const now = new Date()
    for (const [fieldKey, value] of Object.entries(sanitized)) {
      const existing = storedMap.get(fieldKey)
      const text = value === null || value === undefined ? null : JSON.stringify(value)
      if (existing) {
        existing.fieldValue = text
        existing.updatedBy = user.userId
        existing.updatedAt = now
        await this.valueRepo.save(existing)
        storedMap.delete(fieldKey)
        continue
      }
      await this.valueRepo.save(this.valueRepo.create({
        tenantId: user.tenantId,
        entityCode,
        bizId,
        fieldKey,
        fieldValue: text,
        updatedBy: user.userId
      }))
      storedMap.delete(fieldKey)
    }
    // 未提交的字段视为清空
    if (storedMap.size > 0) {
      await this.valueRepo.delete({ id: In([...storedMap.values()].map((row) => row.id)) })
    }
    await this.auditService.record({
      bizType: `${entityCode.toLowerCase()}_custom_value`,
      bizId,
      action: 'SAVE_CUSTOM_VALUES',
      afterValue: { fields: Object.keys(sanitized) }
    }, user)
    return sanitized
  }

  /** 业务对象的字段定义（引擎结构） */
  async definitions(entityCode: string, user: JwtUser): Promise<CustomFieldDefinition[]> {
    const rows = await this.fieldRepo.find({
      where: { tenantId: user.tenantId, entityCode, isDeleted: 0 },
      order: { displayOrder: 'ASC', id: 'ASC' }
    })
    return rows.map((row) => this.toDefinition(row))
  }

  private toDefinition(row: CustomFieldEntity): CustomFieldDefinition {
    return {
      fieldKey: row.fieldKey,
      fieldLabel: row.fieldLabel,
      fieldType: row.fieldType,
      required: row.required === 1,
      options: row.options ?? [],
      defaultValue: row.defaultValue ?? undefined,
      visibleInList: row.visibleInList === 1,
      allowFilter: row.allowFilter === 1,
      maxLength: row.maxLength ?? undefined,
      min: row.minValue === null ? undefined : Number(row.minValue),
      max: row.maxValue === null ? undefined : Number(row.maxValue),
      pattern: row.pattern ?? undefined,
      groupName: row.groupName,
      displayOrder: row.displayOrder,
      referenceType: row.referenceType ?? undefined,
      condition: row.condition ?? null
    }
  }

  private parseValue(value: string | null): unknown {
    if (value === null) return null
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  private async findField(id: number, user: JwtUser): Promise<CustomFieldEntity> {
    const entity = await this.fieldRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('自定义字段不存在')
    return entity
  }

  private async findForm(id: number, user: JwtUser): Promise<CustomFormEntity> {
    const entity = await this.formRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('自定义表单不存在')
    return entity
  }
}
