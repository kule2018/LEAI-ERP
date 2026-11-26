import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('risk_alert', { engine: 'InnoDB' })
@Index('idx_risk_tenant_status', ['tenantId', 'status', 'severity'])
@Index('uk_risk_key', ['tenantId', 'riskKey'], { unique: true })
export class RiskAlertEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'risk_key', type: 'varchar', length: 200 })
  riskKey!: string

  @Column({ name: 'risk_type', type: 'varchar', length: 40 })
  riskType!: string

  @Column({ name: 'biz_type', type: 'varchar', length: 64 })
  bizType!: string

  @Column({ name: 'biz_id', type: 'bigint' })
  bizId!: number

  @Column({ type: 'varchar', length: 16 })
  severity!: string

  @Column({ type: 'varchar', length: 200 })
  title!: string

  @Column({ type: 'varchar', length: 500 })
  message!: string

  @Column({ type: 'json', nullable: true })
  evidence!: Record<string, unknown> | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  suggestion!: string | null

  @Column({ type: 'varchar', length: 24, default: 'OPEN' })
  status!: string

  @Column({ name: 'assignee_id', type: 'bigint', nullable: true })
  assigneeId!: number | null

  @Column({ name: 'closed_by', type: 'bigint', nullable: true })
  closedBy!: number | null

  @Column({ name: 'close_reason', type: 'varchar', length: 500, nullable: true })
  closeReason!: string | null

  @Column({ name: 'closed_at', type: 'datetime', nullable: true })
  closedAt!: Date | null

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: number | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'datetime', nullable: true })
  updatedAt!: Date | null
}
