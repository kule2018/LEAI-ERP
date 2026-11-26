import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('customer', { engine: 'InnoDB' })
@Index('uk_customer_code', ['tenantId', 'customerCode'], { unique: true })
export class CustomerEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'customer_code', type: 'varchar', length: 50 })
  customerCode!: string

  @Column({ name: 'customer_name', type: 'varchar', length: 150 })
  customerName!: string

  @Column({ name: 'customer_group', type: 'varchar', length: 50, nullable: true })
  customerGroup!: string | null

  @Column({ name: 'level_id', type: 'bigint', nullable: true })
  levelId!: number | null

  @Column({ name: 'credit_limit', type: 'decimal', precision: 18, scale: 4, default: 0 })
  creditLimit!: string

  @Column({ name: 'credit_used', type: 'decimal', precision: 18, scale: 4, default: 0 })
  creditUsed!: string

  @Column({ name: 'price_level_id', type: 'bigint', nullable: true })
  priceLevelId!: number | null

  @Column({ name: 'owner_user_id', type: 'bigint', nullable: true })
  ownerUserId!: number | null

  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' })
  status!: string

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: number | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy!: number | null

  @Column({ name: 'updated_at', type: 'datetime', nullable: true })
  updatedAt!: Date | null

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null
}
