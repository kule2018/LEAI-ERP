import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('sys_security_alert', { engine: 'InnoDB' })
@Index('idx_security_alert_tenant_status', ['tenantId', 'status', 'isDeleted'])
export class SysSecurityAlertEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: number

  @Column({ type: 'varchar', length: 64, nullable: true })
  username!: string | null

  @Column({ type: 'varchar', length: 120, nullable: true })
  perm!: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  path!: string | null

  @Column({ type: 'varchar', length: 16, nullable: true })
  method!: string | null

  @Column({ type: 'int', default: 1 })
  attempts!: number

  @Column({ type: 'varchar', length: 16, default: 'LOW' })
  level!: string

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason!: string | null

  @Column({ type: 'varchar', length: 16, default: 'OPEN' })
  status!: string

  @Column({ name: 'confirmed_by', type: 'bigint', nullable: true })
  confirmedBy!: number | null

  @Column({ name: 'confirmed_at', type: 'datetime', precision: 3, nullable: true })
  confirmedAt!: Date | null

  @Column({ name: 'occurred_at', type: 'datetime', precision: 3 })
  occurredAt!: Date

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
