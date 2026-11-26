import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** 批次效期档案：登记批次的到期日与保质期，支撑临期预警与召回冻结 */
@Entity('md_batch_profile', { engine: 'InnoDB' })
@Index('uk_md_batch_profile', ['tenantId', 'productId', 'batchNo'], { unique: true })
@Index('idx_md_batch_profile_expiry', ['tenantId', 'expiryDate'])
export class BatchProfileEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'product_id', type: 'bigint' })
  productId!: number

  @Column({ name: 'variant_id', type: 'bigint', nullable: true })
  variantId!: number | null

  @Column({ name: 'batch_no', type: 'varchar', length: 64 })
  batchNo!: string

  @Column({ name: 'warehouse_id', type: 'bigint', nullable: true })
  warehouseId!: number | null

  @Column({ name: 'expiry_date', type: 'datetime', nullable: true })
  expiryDate!: Date | null

  @Column({ name: 'shelf_life_days', type: 'int', nullable: true })
  shelfLifeDays!: number | null

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  qty!: string

  @Column({ type: 'varchar', length: 24, default: 'NORMAL' })
  status!: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: string | null

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: number | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'datetime', nullable: true })
  updatedAt!: Date | null
}
