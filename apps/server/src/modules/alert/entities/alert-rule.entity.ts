import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * 统一告警规则：把库存、风险、安全等业务域原先硬编码的阈值收敛为可配置规则。
 */
@Entity('alert_rule', { engine: 'InnoDB' })
@Index('idx_alert_rule_tenant', ['tenantId', 'bizType'])
@Index('idx_alert_rule_metric', ['tenantId', 'metric'])
export class AlertRuleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'rule_code', type: 'varchar', length: 64 })
  ruleCode!: string

  @Column({ name: 'rule_name', type: 'varchar', length: 128 })
  ruleName!: string

  @Column({ name: 'biz_type', type: 'varchar', length: 64 })
  bizType!: string

  @Column({ type: 'varchar', length: 64 })
  metric!: string

  @Column({ type: 'varchar', length: 8, default: 'GTE' })
  comparator!: string

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  threshold!: string

  @Column({ name: 'window_minutes', type: 'int', default: 0 })
  windowMinutes!: number

  @Column({ type: 'varchar', length: 16, default: 'MEDIUM' })
  severity!: string

  @Column({ name: 'notify_channels', type: 'json', nullable: true })
  notifyChannels!: string[] | null

  @Column({ type: 'tinyint', width: 1, default: 1 })
  enabled!: number

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null

  @Column({ name: 'created_by', type: 'bigint', default: 0 })
  createdBy!: number

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  updatedAt!: Date
}
