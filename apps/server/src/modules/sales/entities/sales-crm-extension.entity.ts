import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** 销售佣金规则 */
@Entity('sales_commission_rule', { engine: 'InnoDB' })
@Index('idx_sales_commission_rule', ['tenantId', 'status'])
export class SalesCommissionRuleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'rule_code', type: 'varchar', length: 60 }) ruleCode!: string
  @Column({ name: 'rule_name', type: 'varchar', length: 120 }) ruleName!: string
  /** RATE 比例 / FIXED 固定金额 / TIER 阶梯 */
  @Column({ type: 'varchar', length: 16, default: 'RATE' }) ruleType!: string
  @Column({ type: 'decimal', precision: 18, scale: 6, nullable: true }) rate!: string | null
  @Column({ name: 'fixed_amount', type: 'decimal', precision: 18, scale: 4, nullable: true }) fixedAmount!: string | null
  @Column({ type: 'json', nullable: true }) tiers!: Array<{ min: number; rate: number }> | null
  @Column({ name: 'sales_rep_id', type: 'bigint', nullable: true }) salesRepId!: number | null
  @Column({ name: 'effective_from', type: 'date', nullable: true }) effectiveFrom!: string | null
  @Column({ name: 'effective_to', type: 'date', nullable: true }) effectiveTo!: string | null
  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 销售佣金核算记录 */
@Entity('sales_commission_record', { engine: 'InnoDB' })
@Index('idx_sales_commission_record', ['tenantId', 'period'])
export class SalesCommissionRecordEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'rule_id', type: 'bigint' }) ruleId!: number
  @Column({ name: 'order_id', type: 'bigint', nullable: true }) orderId!: number | null
  @Column({ name: 'order_no', type: 'varchar', length: 60, nullable: true }) orderNo!: string | null
  @Column({ name: 'sales_rep_id', type: 'bigint', nullable: true }) salesRepId!: number | null
  @Column({ name: 'order_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) orderAmount!: string
  @Column({ name: 'return_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) returnAmount!: string
  @Column({ name: 'commission_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) commissionAmount!: string
  @Column({ type: 'varchar', length: 20 }) period!: string
  /** PENDING 待确认 / CONFIRMED 已确认 / PAID 已发放 */
  @Column({ type: 'varchar', length: 20, default: 'PENDING' }) status!: string
  /** 发放时生成的应付单 ID */
  @Column({ name: 'payable_id', type: 'bigint', nullable: true }) payableId!: number | null
  @Column({ name: 'payable_no', type: 'varchar', length: 60, nullable: true }) payableNo!: string | null
  @Column({ name: 'paid_at', type: 'datetime', nullable: true }) paidAt!: Date | null
  @Column({ type: 'varchar', length: 300, nullable: true }) remark!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 客户投诉工单 */
@Entity('sales_complaint', { engine: 'InnoDB' })
@Index('idx_sales_complaint', ['tenantId', 'status'])
export class SalesComplaintEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'complaint_no', type: 'varchar', length: 60 }) complaintNo!: string
  @Column({ name: 'customer_id', type: 'bigint' }) customerId!: number
  @Column({ name: 'order_id', type: 'bigint', nullable: true }) orderId!: number | null
  /** QUALITY 质量 / DELIVERY 交付 / SERVICE 服务 / PRICE 价格 */
  @Column({ type: 'varchar', length: 24, default: 'SERVICE' }) complaintType!: string
  @Column({ type: 'varchar', length: 150 }) title!: string
  @Column({ type: 'text', nullable: true }) description!: string | null
  /** LOW / MEDIUM / HIGH / URGENT */
  @Column({ type: 'varchar', length: 12, default: 'MEDIUM' }) severity!: string
  /** OPEN / PROCESSING / RESOLVED / CLOSED */
  @Column({ type: 'varchar', length: 20, default: 'OPEN' }) status!: string
  @Column({ name: 'assignee_id', type: 'bigint', nullable: true }) assigneeId!: number | null
  @Column({ name: 'resolution', type: 'varchar', length: 500, nullable: true }) resolution!: string | null
  @Column({ name: 'resolved_at', type: 'datetime', nullable: true }) resolvedAt!: Date | null
  /** 重开次数 */
  @Column({ name: 'reopen_count', type: 'int', default: 0 }) reopenCount!: number
  /** 最近一次处理动作时间 */
  @Column({ name: 'last_action_at', type: 'datetime', nullable: true }) lastActionAt!: Date | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 投诉工单流转轨迹 */
@Entity('sales_complaint_log', { engine: 'InnoDB' })
@Index('idx_sales_complaint_log', ['tenantId', 'complaintId'])
export class SalesComplaintLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'complaint_id', type: 'bigint' }) complaintId!: number
  /** CREATE / ASSIGN / PROCESS / RESOLVE / CLOSE / REOPEN / ESCALATE */
  @Column({ type: 'varchar', length: 20 }) action!: string
  @Column({ name: 'from_status', type: 'varchar', length: 20, default: '' }) fromStatus!: string
  @Column({ name: 'to_status', type: 'varchar', length: 20, default: '' }) toStatus!: string
  @Column({ name: 'operator_id', type: 'bigint', nullable: true }) operatorId!: number | null
  @Column({ name: 'operator_name', type: 'varchar', length: 60, default: '' }) operatorName!: string
  @Column({ name: 'remark', type: 'varchar', length: 500, nullable: true }) remark!: string | null
  @Column({ name: 'duration_ms', type: 'int', default: 0 }) durationMs!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 客户回访记录 */
@Entity('sales_visit', { engine: 'InnoDB' })
@Index('idx_sales_visit', ['tenantId', 'customerId'])
export class SalesVisitEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'visit_no', type: 'varchar', length: 60 }) visitNo!: string
  @Column({ name: 'customer_id', type: 'bigint' }) customerId!: number
  @Column({ name: 'sales_rep_id', type: 'bigint', nullable: true }) salesRepId!: number | null
  @Column({ name: 'visit_date', type: 'date' }) visitDate!: string
  /** PHONE 电话 / VISIT 到店 / ONLINE 在线 / AFTER_SALE 售后 */
  @Column({ type: 'varchar', length: 20, default: 'PHONE' }) channel!: string
  @Column({ type: 'text', nullable: true }) content!: string | null
  @Column({ name: 'feedback', type: 'varchar', length: 500, nullable: true }) feedback!: string | null
  @Column({ name: 'next_visit_at', type: 'datetime', nullable: true }) nextVisitAt!: Date | null
  /** PLANNED 已计划 / DONE 已完成 */
  @Column({ type: 'varchar', length: 20, default: 'DONE' }) status!: string
  /** 满意度评分 1-5 */
  @Column({ name: 'satisfaction', type: 'int', nullable: true }) satisfaction!: number | null
  /** 回访完成时间 */
  @Column({ name: 'completed_at', type: 'datetime', nullable: true }) completedAt!: Date | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
