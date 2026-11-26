import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('fin_cost_job', { engine: 'InnoDB' })
@Index('idx_fin_cost_job', ['tenantId', 'status'])
export class CostJobEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 20 }) period!: string
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'progress', type: 'int', default: 0 }) progress!: number
  @Column({ name: 'total_items', type: 'int', default: 0 }) totalItems!: number
  @Column({ name: 'error_message', type: 'varchar', length: 1000, nullable: true }) errorMessage!: string | null
  @Column({ type: 'json', nullable: true }) snapshot!: Record<string, unknown> | null
  @Column({ name: 'rollback_status', type: 'varchar', length: 24, nullable: true }) rollbackStatus!: string | null
  @Column({ name: 'rolled_back_at', type: 'datetime', nullable: true }) rolledBackAt!: Date | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'finished_at', type: 'datetime', nullable: true }) finishedAt!: Date | null
}
