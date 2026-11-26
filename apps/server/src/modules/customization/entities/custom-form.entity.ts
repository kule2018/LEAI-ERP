import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * 自定义表单：定义某业务对象的表单布局（分组、页签、控件顺序），
 * 与自定义字段配合实现表单的动态渲染。
 */
@Entity('custom_form', { engine: 'InnoDB' })
@Index('idx_custom_form_entity', ['tenantId', 'entityCode', 'isDeleted'])
export class CustomFormEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'form_code', type: 'varchar', length: 64 })
  formCode!: string

  @Column({ name: 'form_name', type: 'varchar', length: 128 })
  formName!: string

  @Column({ name: 'entity_code', type: 'varchar', length: 64 })
  entityCode!: string

  @Column({ type: 'json', nullable: true })
  layout!: Array<Record<string, unknown>> | null

  @Column({ type: 'int', default: 1 })
  version!: number

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
