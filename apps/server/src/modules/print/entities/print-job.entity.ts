import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('print_job', { engine: 'InnoDB' })
@Index('idx_print_job', ['tenantId', 'status'])
export class PrintJobEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'job_no', type: 'varchar', length: 60 }) jobNo!: string
  @Column({ name: 'biz_type', type: 'varchar', length: 64 }) bizType!: string
  @Column({ name: 'biz_id', type: 'bigint' }) bizId!: number
  @Column({ name: 'template_id', type: 'bigint' }) templateId!: number
  @Column({ type: 'int', default: 1 }) copies!: number
  @Column({ type: 'varchar', length: 32, default: 'SERVER_PDF' }) channel!: string
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'record_id', type: 'bigint', nullable: true }) recordId!: number | null
  @Column({ name: 'error_text', type: 'varchar', length: 500, nullable: true }) errorText!: string | null
  @Column({ name: 'created_by', type: 'bigint' }) createdBy!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'finished_at', type: 'datetime', nullable: true }) finishedAt!: Date | null
}
