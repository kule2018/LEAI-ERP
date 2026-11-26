import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** 期间结转批次：记录一次期末损益结转生成的凭证 */
@Entity('fin_period_carry', { engine: 'InnoDB' })
@Index('uk_fin_period_carry', ['tenantId', 'period'], { unique: true })
export class FinPeriodCarryEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 20 }) period!: string
  @Column({ name: 'voucher_id', type: 'bigint' }) voucherId!: number
  @Column({ name: 'total_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) totalAmount!: string
  @Column({ name: 'profit_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) profitAmount!: string
  @Column({ name: 'subject_count', type: 'int', default: 0 }) subjectCount!: number
  @Column({ type: 'varchar', length: 24, default: 'DONE' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 资金账户间转账 */
@Entity('fin_account_transfer', { engine: 'InnoDB' })
@Index('idx_fin_account_transfer', ['tenantId', 'transferDate'])
export class FinAccountTransferEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'transfer_no', type: 'varchar', length: 60 }) transferNo!: string
  @Column({ name: 'from_account_id', type: 'bigint' }) fromAccountId!: number
  @Column({ name: 'to_account_id', type: 'bigint' }) toAccountId!: number
  @Column({ type: 'decimal', precision: 18, scale: 4 }) amount!: string
  @Column({ name: 'transfer_date', type: 'date' }) transferDate!: string
  @Column({ name: 'voucher_id', type: 'bigint', nullable: true }) voucherId!: number | null
  @Column({ type: 'varchar', length: 500, nullable: true }) remark!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 固定资产变更留痕 */
@Entity('fin_asset_change', { engine: 'InnoDB' })
@Index('idx_fin_asset_change', ['tenantId', 'assetId'])
export class FinAssetChangeEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'asset_id', type: 'bigint' }) assetId!: number
  @Column({ name: 'change_type', type: 'varchar', length: 32 }) changeType!: string
  @Column({ name: 'before_value', type: 'json', nullable: true }) beforeValue!: Record<string, unknown> | null
  @Column({ name: 'after_value', type: 'json', nullable: true }) afterValue!: Record<string, unknown> | null
  @Column({ name: 'changes', type: 'json', nullable: true }) changes!: Array<{ field: string; label: string; before: string | number | null; after: string | number | null }> | null
  @Column({ type: 'varchar', length: 300, nullable: true }) reason!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
