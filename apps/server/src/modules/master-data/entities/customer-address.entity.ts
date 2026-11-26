import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('customer_address', { engine: 'InnoDB' })
@Index('idx_customer_address_customer', ['tenantId', 'customerId'])
export class CustomerAddressEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'customer_id', type: 'bigint' })
  customerId!: number

  @Column({ type: 'varchar', length: 32, nullable: true })
  province!: string | null

  @Column({ type: 'varchar', length: 32, nullable: true })
  city!: string | null

  @Column({ type: 'varchar', length: 32, nullable: true })
  district!: string | null

  @Column({ type: 'varchar', length: 300 })
  address!: string

  @Column({ name: 'contact_name', type: 'varchar', length: 50, nullable: true })
  contactName!: string | null

  @Column({ name: 'contact_phone', type: 'varchar', length: 30, nullable: true })
  contactPhone!: string | null

  @Column({ name: 'is_default', type: 'tinyint', width: 1, default: 0 })
  isDefault!: number

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
