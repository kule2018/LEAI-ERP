import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('fin_bank_transaction', { engine: 'InnoDB' })
@Index('uk_bank_tx_external', ['tenantId', 'accountId', 'externalNo'], { unique: true })
export class BankTransactionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'account_id', type: 'bigint' }) accountId!: number
  @Column({ name: 'external_no', type: 'varchar', length: 100 }) externalNo!: string
  @Column({ type: 'varchar', length: 24, default: 'IN' }) direction!: string
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) amount!: string
  @Column({ name: 'tx_date', type: 'date', nullable: true }) txDate!: string | null
  @Column({ type: 'varchar', length: 300, nullable: true }) summary!: string | null
  @Column({ name: 'matched', type: 'tinyint', width: 1, default: 0 }) matched!: number
  @Column({ name: 'match_target_type', type: 'varchar', length: 32, nullable: true }) matchTargetType!: string | null
  @Column({ name: 'match_target_id', type: 'bigint', nullable: true }) matchTargetId!: number | null
  @Column({ name: 'match_score', type: 'decimal', precision: 10, scale: 2, nullable: true }) matchScore!: string | null
  @Column({ name: 'matched_at', type: 'datetime', nullable: true }) matchedAt!: Date | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
