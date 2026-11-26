import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('sys_slow_sql_log', { engine: 'InnoDB' })
@Index('idx_slow_sql_captured', ['capturedAt'])
export class SysSlowSqlLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint', default: 0 })
  tenantId!: number

  @Column({ name: 'sql_text', type: 'varchar', length: 1000 })
  sqlText!: string

  @Column({ name: 'duration_ms', type: 'int' })
  durationMs!: number

  @Column({ name: 'row_count', type: 'int', default: 0 })
  rowCount!: number

  @Column({ name: 'threshold_ms', type: 'int', default: 500 })
  thresholdMs!: number

  @Column({ name: 'captured_at', type: 'datetime', precision: 3 })
  capturedAt!: Date

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date
}
