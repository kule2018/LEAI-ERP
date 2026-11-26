import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('customer_contact', { engine: 'InnoDB' })
@Index('idx_customer_contact_customer', ['tenantId', 'customerId'])
export class CustomerContactEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'customer_id', type: 'bigint' })
  customerId!: number

  @Column({ type: 'varchar', length: 50 })
  name!: string

  /** 联系电话（存储掩码；原文见 phoneEncrypted） */
  @Column({ name: 'phone', type: 'varchar', length: 30, nullable: true })
  phone!: string | null

  /** 联系电话密文 */
  @Column({ name: 'phone_encrypted', type: 'varchar', length: 255, nullable: true })
  phoneEncrypted!: string | null

  /** 联系电话掩码 */
  @Column({ name: 'phone_mask', type: 'varchar', length: 60, nullable: true })
  phoneMask!: string | null

  /** 邮箱（存储掩码；原文见 emailEncrypted） */
  @Column({ name: 'email', type: 'varchar', length: 100, nullable: true })
  email!: string | null

  /** 邮箱密文 */
  @Column({ name: 'email_encrypted', type: 'varchar', length: 255, nullable: true })
  emailEncrypted!: string | null

  /** 邮箱掩码 */
  @Column({ name: 'email_mask', type: 'varchar', length: 120, nullable: true })
  emailMask!: string | null

  @Column({ name: 'position', type: 'varchar', length: 50, nullable: true })
  position!: string | null

  @Column({ name: 'is_primary', type: 'tinyint', width: 1, default: 0 })
  isPrimary!: number

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
