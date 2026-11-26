import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** 库存调整单（盘盈 / 盘亏 / 系统差异修正） */
@Entity('stock_adjustment', { engine: 'InnoDB' })
@Index('idx_stock_adjustment', ['tenantId', 'status'])
export class StockAdjustmentEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'adjust_no', type: 'varchar', length: 60 }) adjustNo!: string
  @Column({ name: 'adjust_type', type: 'varchar', length: 16, default: 'GAIN' }) adjustType!: string
  @Column({ name: 'warehouse_id', type: 'bigint', nullable: true }) warehouseId!: number | null
  @Column({ type: 'varchar', length: 40, default: 'DRAFT' }) status!: string
  @Column({ name: 'total_qty_in', type: 'decimal', precision: 18, scale: 4, default: 0 }) totalQtyIn!: string
  @Column({ name: 'total_qty_out', type: 'decimal', precision: 18, scale: 4, default: 0 }) totalQtyOut!: string
  @Column({ name: 'total_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) totalAmount!: string
  @Column({ type: 'varchar', length: 300, nullable: true }) reason!: string | null
  @Column({ name: 'posted_at', type: 'datetime', nullable: true }) postedAt!: Date | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 库存调整明细 */
@Entity('stock_adjustment_line', { engine: 'InnoDB' })
@Index('idx_stock_adjustment_line', ['adjustmentId'])
export class StockAdjustmentLineEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'adjustment_id', type: 'bigint' }) adjustmentId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'variant_id', type: 'bigint', default: 0 }) variantId!: number
  @Column({ name: 'batch_no', type: 'varchar', length: 60, default: '' }) batchNo!: string
  /** 调整数量：正数为盘盈，负数为盘亏 */
  @Column({ type: 'decimal', precision: 18, scale: 4 }) qty!: string
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) cost!: string
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) amount!: string
  @Column({ type: 'varchar', length: 300, nullable: true }) reason!: string | null
}
