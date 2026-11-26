import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('sys_sequence', { engine: 'InnoDB' })
@Index('uk_sys_sequence_biz', ['tenantId', 'bizCode'], { unique: true })
export class SequenceEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'biz_code', type: 'varchar', length: 50 })
  bizCode!: string

  @Column({ name: 'biz_name', type: 'varchar', length: 100, default: '' })
  bizName!: string

  @Column({ name: 'number_prefix', type: 'varchar', length: 20 })
  numberPrefix!: string

  @Column({ name: 'date_format', type: 'varchar', length: 20, default: 'yyyyMMdd' })
  dateFormat!: string

  @Column({ name: 'step_value', type: 'int', default: 1 })
  stepValue!: number

  @Column({ name: 'current_seq', type: 'bigint', default: 0 })
  currentSeq!: number

  @Column({ name: 'reset_cycle', type: 'varchar', length: 20, default: 'DAILY' })
  resetCycle!: string

  @Column({ name: 'doc_no', type: 'varchar', length: 80, default: '' })
  docNo!: string

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
