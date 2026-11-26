import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * 库存成本层：一次入库形成的成本批次
 * 用于先进先出（FIFO）与分批实际成本（BATCH）核算，也可用于移动加权法的成本追溯。
 */
@Entity('stock_cost_layer', { engine: 'InnoDB' })
@Index('idx_stock_cost_layer_dim', ['tenantId', 'productId', 'warehouseId', 'batchNo'])
@Index('idx_stock_cost_layer_status', ['tenantId', 'status'])
export class StockCostLayerEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'warehouse_id', type: 'bigint' }) warehouseId!: number
  @Column({ name: 'location_id', type: 'bigint', default: 0 }) locationId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'variant_id', type: 'bigint', default: 0 }) variantId!: number
  @Column({ name: 'batch_no', type: 'varchar', length: 60, default: '' }) batchNo!: string
  /** 入库数量 */
  @Column({ name: 'qty_in', type: 'decimal', precision: 18, scale: 3, default: 0 }) qtyIn!: string
  /** 剩余可用数量 */
  @Column({ name: 'qty_available', type: 'decimal', precision: 18, scale: 3, default: 0 }) qtyAvailable!: string
  /** 单位成本 */
  @Column({ name: 'unit_cost', type: 'decimal', precision: 18, scale: 4, default: 0 }) unitCost!: string
  /** 入库金额 */
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) amount!: string
  /** 来源单据类型 */
  @Column({ name: 'source_voucher_type', type: 'varchar', length: 40, default: '' }) sourceVoucherType!: string
  @Column({ name: 'source_voucher_id', type: 'bigint', default: 0 }) sourceVoucherId!: number
  @Column({ name: 'source_voucher_line_id', type: 'bigint', default: 0 }) sourceVoucherLineId!: number
  /** 入库时间：先进先出排序依据 */
  @Column({ name: 'occurred_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) occurredAt!: Date
  /** OPEN 未结清 / CLOSED 已结清 */
  @Column({ type: 'varchar', length: 20, default: 'OPEN' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 成本重算期间锁：期间被锁定后禁止库存成本相关过账 */
@Entity('fin_cost_period_lock', { engine: 'InnoDB' })
@Index('uk_fin_cost_period_lock', ['tenantId', 'period'], { unique: true })
export class FinCostPeriodLockEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 20 }) period!: string
  /** LOCKED 已锁定 / RELEASED 已释放 */
  @Column({ name: 'lock_status', type: 'varchar', length: 20, default: 'LOCKED' }) lockStatus!: string
  @Column({ type: 'varchar', length: 300, nullable: true }) reason!: string | null
  @Column({ name: 'locked_by', type: 'bigint', nullable: true }) lockedBy!: number | null
  @Column({ name: 'locked_at', type: 'datetime', nullable: true }) lockedAt!: Date | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
