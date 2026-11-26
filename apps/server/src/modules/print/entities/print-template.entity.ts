import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('print_template', { engine: 'InnoDB' })
@Index('uk_print_template_code', ['tenantId', 'code'], { unique: true })
export class PrintTemplateEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ type: 'varchar', length: 64 })
  code!: string

  @Column({ type: 'varchar', length: 100 })
  name!: string

  @Column({ name: 'biz_type', type: 'varchar', length: 64 })
  bizType!: string

  @Column({ type: 'varchar', length: 32, default: 'A4' })
  paper!: string

  @Column({ type: 'json', nullable: true })
  schema!: Record<string, unknown> | null

  @Column({ type: 'int', default: 1 })
  version!: number

  @Column({ name: 'is_default', type: 'tinyint', width: 1, default: 0 })
  isDefault!: number

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: number

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: number | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'datetime', nullable: true })
  updatedAt!: Date | null

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
