import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('sys_exchange_rate', { engine: 'InnoDB' })
@Index('uk_exchange_rate', ['tenantId', 'fromCurrency', 'toCurrency', 'effectiveDate'], { unique: true })
export class ExchangeRateEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'from_currency', type: 'varchar', length: 3 }) fromCurrency!: string
  @Column({ name: 'to_currency', type: 'varchar', length: 3 }) toCurrency!: string
  @Column({ type: 'decimal', precision: 18, scale: 6 }) rate!: string
  @Column({ name: 'effective_date', type: 'date' }) effectiveDate!: string
  @Column({ name: 'source', type: 'varchar', length: 40, nullable: true }) source!: string | null
  @Column({ name: 'changed_by', type: 'bigint', nullable: true }) changedBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
