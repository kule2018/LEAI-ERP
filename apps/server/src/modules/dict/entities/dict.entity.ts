import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('sys_dict', { engine: 'InnoDB' })
@Index('uk_sys_dict_type', ['tenantId', 'dictType'], { unique: true })
export class DictEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'dict_type', type: 'varchar', length: 50 })
  dictType!: string

  @Column({ name: 'dict_name', type: 'varchar', length: 100 })
  dictName!: string

  @Column({ type: 'varchar', length: 24, default: 'ENABLED' })
  status!: string

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: number | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy!: number | null

  @Column({ name: 'updated_at', type: 'datetime', nullable: true })
  updatedAt!: Date | null

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null
}
