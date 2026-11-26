import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('supplier', { engine: 'InnoDB' })
@Index('uk_supplier_code', ['tenantId', 'supplierCode'], { unique: true })
export class SupplierEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'supplier_code', type: 'varchar', length: 50 })
  supplierCode!: string

  @Column({ name: 'supplier_name', type: 'varchar', length: 150 })
  supplierName!: string

  @Column({ name: 'supplier_group', type: 'varchar', length: 50, nullable: true })
  supplierGroup!: string | null

  @Column({ name: 'qualification_status', type: 'varchar', length: 24, default: 'PENDING' })
  qualificationStatus!: string

  @Column({ name: 'qualification_expire', type: 'date', nullable: true })
  qualificationExpire!: string | null

  @Column({ type: 'tinyint', width: 1, default: 0 })
  blacklist!: number

  @Column({ name: 'rating_score', type: 'decimal', precision: 5, scale: 2, default: 0 })
  ratingScore!: string

  @Column({ name: 'contact_name', type: 'varchar', length: 50, nullable: true })
  contactName!: string | null

  @Column({ name: 'contact_phone', type: 'varchar', length: 30, nullable: true })
  contactPhone!: string | null

  @Column({ name: 'bank_account', type: 'varchar', length: 100, nullable: true })
  bankAccount!: string | null

  /** 银行账号密文：明文列仅保存掩码 */
  @Column({ name: 'bank_account_encrypted', type: 'varchar', length: 255, nullable: true })
  bankAccountEncrypted!: string | null

  /** 银行账号掩码 */
  @Column({ name: 'bank_account_mask', type: 'varchar', length: 100, nullable: true })
  bankAccountMask!: string | null

  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true })
  bankName!: string | null

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
