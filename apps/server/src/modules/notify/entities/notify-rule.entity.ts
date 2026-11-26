import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * 统一通知规则：把「业务事件 → 模板 + 渠道 + 接收人」的映射关系配置化。
 */
@Entity('notify_rule', { engine: 'InnoDB' })
@Index('idx_notify_rule_tenant', ['tenantId', 'eventType'])
@Index('uk_notify_rule_code', ['tenantId', 'ruleCode'], { unique: true })
export class NotifyRuleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'rule_code', type: 'varchar', length: 64 })
  ruleCode!: string

  @Column({ name: 'rule_name', type: 'varchar', length: 128 })
  ruleName!: string

  /** 业务事件编码，如 SALE_ORDER_SUBMIT、STOCK_ALERT */
  @Column({ name: 'event_type', type: 'varchar', length: 64 })
  eventType!: string

  /** 归属业务域，如 sales、inventory */
  @Column({ name: 'biz_type', type: 'varchar', length: 64 })
  bizType!: string

  @Column({ name: 'template_code', type: 'varchar', length: 64 })
  templateCode!: string

  /** 通知渠道，逗号分隔，如 INMAIL,EMAIL */
  @Column({ type: 'varchar', length: 200, nullable: true })
  channels!: string | null

  @Column({ type: 'varchar', length: 16, default: 'MEDIUM' })
  level!: string

  /** 接收人类型：USER / ROLE / BIZ_OWNER / ALL */
  @Column({ name: 'receiver_type', type: 'varchar', length: 16, default: 'ROLE' })
  receiverType!: string

  /** 接收人 ID 列表（用户 ID 或角色 ID），JSON 数组 */
  @Column({ name: 'receiver_ids', type: 'json', nullable: true })
  receiverIds!: number[] | null

  /** 优先级，数值越小越先执行 */
  @Column({ type: 'int', default: 100 })
  priority!: number

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
