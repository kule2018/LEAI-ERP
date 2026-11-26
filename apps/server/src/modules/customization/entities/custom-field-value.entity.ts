import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * 自定义字段值：按业务对象 + 业务单据 + 字段存放动态字段取值，
 * 使存量业务表无需改结构即可扩展字段。
 */
@Entity('custom_field_value', { engine: 'InnoDB' })
@Index('idx_custom_value_target', ['tenantId', 'entityCode', 'bizId'])
export class CustomFieldValueEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'entity_code', type: 'varchar', length: 64 })
  entityCode!: string

  @Column({ name: 'biz_id', type: 'bigint' })
  bizId!: number

  @Column({ name: 'field_key', type: 'varchar', length: 64 })
  fieldKey!: string

  @Column({ name: 'field_value', type: 'text', nullable: true })
  fieldValue!: string | null

  @Column({ name: 'updated_by', type: 'bigint', default: 0 })
  updatedBy!: number

  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  updatedAt!: Date
}
