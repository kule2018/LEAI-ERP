import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import type { CustomFieldCondition, CustomFieldOption } from '../../../common/custom-field-engine'

/**
 * 自定义字段：为业务单据动态扩展字段，
 * entityCode 指向业务对象（如 SALE_ORDER），fieldKey 为字段标识。
 */
@Entity('custom_field', { engine: 'InnoDB' })
@Index('idx_custom_field_entity', ['tenantId', 'entityCode', 'isDeleted'])
export class CustomFieldEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'entity_code', type: 'varchar', length: 64 })
  entityCode!: string

  @Column({ name: 'field_key', type: 'varchar', length: 64 })
  fieldKey!: string

  @Column({ name: 'field_label', type: 'varchar', length: 128 })
  fieldLabel!: string

  @Column({ name: 'field_type', type: 'varchar', length: 24, default: 'TEXT' })
  fieldType!: string

  @Column({ type: 'json', nullable: true })
  options!: CustomFieldOption[] | null

  @Column({ name: 'default_value', type: 'varchar', length: 500, nullable: true })
  defaultValue!: string | null

  @Column({ type: 'tinyint', width: 1, default: 0 })
  required!: number

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder!: number

  @Column({ name: 'group_name', type: 'varchar', length: 64, default: '基础信息' })
  groupName!: string

  @Column({ name: 'visible_in_list', type: 'tinyint', width: 1, default: 1 })
  visibleInList!: number

  @Column({ name: 'allow_filter', type: 'tinyint', width: 1, default: 0 })
  allowFilter!: number

  @Column({ name: 'max_length', type: 'int', nullable: true })
  maxLength!: number | null

  @Column({ name: 'min_value', type: 'decimal', precision: 18, scale: 4, nullable: true })
  minValue!: string | null

  @Column({ name: 'max_value', type: 'decimal', precision: 18, scale: 4, nullable: true })
  maxValue!: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  pattern!: string | null

  @Column({ name: 'reference_type', type: 'varchar', length: 64, nullable: true })
  referenceType!: string | null

  @Column({ type: 'json', nullable: true })
  condition!: CustomFieldCondition | null

  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' })
  status!: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: string | null

  @Column({ name: 'created_by', type: 'bigint', default: 0 })
  createdBy!: number

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  updatedAt!: Date

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
