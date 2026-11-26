import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('io_job', { engine: 'InnoDB' })
@Index('idx_io_job_tenant', ['tenantId', 'id'])
export class IoJobEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ type: 'varchar', length: 50 })
  code!: string

  @Column({ type: 'varchar', length: 20 })
  type!: string

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status!: string

  @Column({ name: 'result_url', type: 'varchar', length: 500, nullable: true })
  resultUrl!: string | null

  @Column({ type: 'text', nullable: true })
  content!: string | null

  @Column({ name: 'scope_json', type: 'text', nullable: true })
  scopeJson!: string | null

  @Column({ name: 'error_message', type: 'varchar', length: 1000, nullable: true })
  errorMessage!: string | null

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: number | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'finished_at', type: 'datetime', nullable: true })
  finishedAt!: Date | null
}
