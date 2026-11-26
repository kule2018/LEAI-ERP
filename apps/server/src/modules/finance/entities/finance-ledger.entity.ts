import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** 期初余额表：科目余额表与明细账的期初余额来源 */
@Entity('fin_opening_balance', { engine: 'InnoDB' })
@Index('uk_fin_opening_balance', ['tenantId', 'period', 'subjectId', 'auxId'], { unique: true })
@Index('idx_fin_opening_balance_period', ['tenantId', 'period'])
export class FinOpeningBalanceEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 20 }) period!: string
  @Column({ name: 'subject_id', type: 'bigint' }) subjectId!: number
  @Column({ name: 'aux_type', type: 'varchar', length: 32, default: '' }) auxType!: string
  @Column({ name: 'aux_id', type: 'varchar', length: 64, default: '' }) auxId!: string
  @Column({ type: 'varchar', length: 16, default: 'DEBIT' }) direction!: string
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) amount!: string
  @Column({ type: 'varchar', length: 300, nullable: true }) remark!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 银企直连连接配置 */
@Entity('fin_bank_connection', { engine: 'InnoDB' })
@Index('idx_fin_bank_connection_account', ['tenantId', 'accountId'])
export class FinBankConnectionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'account_id', type: 'bigint' }) accountId!: number
  @Column({ name: 'bank_name', type: 'varchar', length: 100 }) bankName!: string
  @Column({ name: 'account_no', type: 'varchar', length: 60, nullable: true }) accountNo!: string | null
  @Column({ type: 'varchar', length: 24, default: 'MOCK' }) connector!: string
  @Column({ type: 'json', nullable: true }) credentials!: Record<string, unknown> | null
  @Column({ type: 'json', nullable: true }) config!: Record<string, unknown> | null
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'last_sync_at', type: 'datetime', nullable: true }) lastSyncAt!: Date | null
  @Column({ name: 'last_balance', type: 'decimal', precision: 18, scale: 4, nullable: true }) lastBalance!: string | null
  @Column({ name: 'last_result', type: 'varchar', length: 500, nullable: true }) lastResult!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 存货成本汇总（移动加权收发存） */
@Entity('fin_inventory_costing', { engine: 'InnoDB' })
@Index('uk_fin_inventory_costing', ['tenantId', 'period', 'productId'], { unique: true })
@Index('idx_fin_inventory_costing_period', ['tenantId', 'period'])
export class FinInventoryCostingEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 20 }) period!: string
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'product_name', type: 'varchar', length: 120, nullable: true }) productName!: string | null
  @Column({ type: 'varchar', length: 24, default: 'MOVING_WEIGHTED' }) method!: string
  @Column({ name: 'opening_qty', type: 'decimal', precision: 18, scale: 4, default: 0 }) openingQty!: string
  @Column({ name: 'opening_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) openingAmount!: string
  @Column({ name: 'in_qty', type: 'decimal', precision: 18, scale: 4, default: 0 }) inQty!: string
  @Column({ name: 'in_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) inAmount!: string
  @Column({ name: 'out_qty', type: 'decimal', precision: 18, scale: 4, default: 0 }) outQty!: string
  @Column({ name: 'out_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) outAmount!: string
  @Column({ name: 'closing_qty', type: 'decimal', precision: 18, scale: 4, default: 0 }) closingQty!: string
  @Column({ name: 'closing_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) closingAmount!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
