import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('ai_anomaly', { engine: 'InnoDB' })
@Index('idx_ai_anomaly', ['tenantId', 'status', 'severity'])
export class AiAnomalyEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'scan_task_id', type: 'bigint', nullable: true }) scanTaskId!: number | null
  @Column({ type: 'varchar', length: 60 }) type!: string
  @Column({ type: 'varchar', length: 16 }) severity!: string
  @Column({ type: 'varchar', length: 200 }) target!: string
  @Column({ type: 'varchar', length: 500 }) message!: string
  @Column({ type: 'json', nullable: true }) evidence!: Record<string, unknown> | null
  @Column({ type: 'varchar', length: 500, nullable: true }) suggestion!: string | null
  @Column({ type: 'varchar', length: 24, default: 'OPEN' }) status!: string
  @Column({ name: 'assignee_id', type: 'bigint', nullable: true }) assigneeId!: number | null
  @Column({ name: 'closed_by', type: 'bigint', nullable: true }) closedBy!: number | null
  @Column({ name: 'close_note', type: 'varchar', length: 500, nullable: true }) closeNote!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'closed_at', type: 'datetime', nullable: true }) closedAt!: Date | null
}
