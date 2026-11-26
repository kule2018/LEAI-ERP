import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('sys_audit_log', { engine: 'InnoDB' })
@Index('idx_sys_audit_tenant_biz', ['tenantId', 'bizType', 'bizId'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'biz_type', type: 'varchar', length: 64 })
  bizType!: string

  @Column({ name: 'biz_id', type: 'bigint', default: 0 })
  bizId!: number

  @Column({ name: 'action_name', type: 'varchar', length: 64 })
  action!: string

  @Column({ name: 'before_value', type: 'text', nullable: true })
  beforeValue!: string | null

  @Column({ name: 'after_value', type: 'text', nullable: true })
  afterValue!: string | null

  @Column({ type: 'bigint' })
  operator!: number

  @Column({ name: 'operator_name', type: 'varchar', length: 64, default: '' })
  operatorName!: string

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null

  @Column({ name: 'trace_id', type: 'varchar', length: 64, nullable: true })
  traceId!: string | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date
}
