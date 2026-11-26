import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * 审计字段级变更明细：把审计日志中的前后快照拆解到字段粒度，
 * 支持按业务单据查看「哪个字段由什么值改成什么值」。
 */
@Entity('audit_field_log', { engine: 'InnoDB' })
@Index('idx_audit_field_log', ['tenantId', 'bizType', 'bizId'])
export class AuditFieldLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'biz_type', type: 'varchar', length: 64 })
  bizType!: string

  @Column({ name: 'biz_id', type: 'bigint', default: 0 })
  bizId!: number

  /** 触发审计的动作 */
  @Column({ type: 'varchar', length: 64 })
  action!: string

  /** 变更字段标识 */
  @Column({ name: 'field_key', type: 'varchar', length: 120 })
  fieldKey!: string

  /** 变更类型：ADDED / REMOVED / CHANGED */
  @Column({ name: 'change_type', type: 'varchar', length: 16 })
  changeType!: string

  @Column({ name: 'before_value', type: 'text', nullable: true })
  beforeValue!: string | null

  @Column({ name: 'after_value', type: 'text', nullable: true })
  afterValue!: string | null

  @Column({ name: 'operator', type: 'bigint', nullable: true })
  operator!: number | null

  @Column({ name: 'operator_name', type: 'varchar', length: 64, nullable: true })
  operatorName!: string | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date
}
