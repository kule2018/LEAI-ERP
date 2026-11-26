import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('ai_audit_log', { engine: 'InnoDB' })
@Index('idx_ai_audit_tenant_capability', ['tenantId', 'capability'])
export class AiAuditLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ type: 'varchar', length: 64 })
  capability!: string

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: number

  @Column({ type: 'varchar', length: 64, default: 'local-rule-engine' })
  model!: string

  @Column({ name: 'prompt_tokens', type: 'int', default: 0 })
  promptTokens!: number

  @Column({ name: 'completion_tokens', type: 'int', default: 0 })
  completionTokens!: number

  @Column({ name: 'latency_ms', type: 'int', default: 0 })
  latencyMs!: number

  @Column({ type: 'varchar', length: 16, default: 'PENDING' })
  accepted!: string

  @Column({ type: 'text', nullable: true })
  request!: string | null

  @Column({ type: 'text', nullable: true })
  response!: string | null

  @Column({ name: 'applied_biz_type', type: 'varchar', length: 64, nullable: true })
  appliedBizType!: string | null

  @Column({ name: 'applied_biz_id', type: 'bigint', nullable: true })
  appliedBizId!: number | null

  @Column({ name: 'applied_at', type: 'datetime', nullable: true })
  appliedAt!: Date | null

  @Column({ name: 'apply_error', type: 'varchar', length: 1000, nullable: true })
  applyError!: string | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date
}
