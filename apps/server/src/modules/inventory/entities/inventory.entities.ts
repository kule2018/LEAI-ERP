import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('stock_balance', { engine: 'InnoDB' })
@Index('uk_stock_balance', ['tenantId', 'warehouseId', 'locationId', 'productId', 'variantId', 'batchNo'], { unique: true })
export class StockBalanceEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'warehouse_id', type: 'bigint' }) warehouseId!: number
  @Column({ name: 'location_id', type: 'bigint', default: 0 }) locationId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'variant_id', type: 'bigint', default: 0 }) variantId!: number
  @Column({ name: 'batch_no', type: 'varchar', length: 60, default: '' }) batchNo!: string
  @Column({ name: 'qty_on_hand', type: 'decimal', precision: 18, scale: 3, default: 0 }) qtyOnHand!: string
  @Column({ name: 'qty_occupied', type: 'decimal', precision: 18, scale: 3, default: 0 }) qtyOccupied!: string
  @Column({ name: 'qty_frozen', type: 'decimal', precision: 18, scale: 3, default: 0 }) qtyFrozen!: string
  @Column({ name: 'qty_in_transit', type: 'decimal', precision: 18, scale: 3, default: 0 }) qtyInTransit!: string
  @Column({ name: 'avg_cost', type: 'decimal', precision: 18, scale: 4, default: 0 }) avgCost!: string
  @Column({ name: 'updated_at', type: 'datetime', nullable: true }) updatedAt!: Date | null
}

/** 上架策略规则（按仓库维护，可被上架作业引用） */
@Entity('wms_putaway_strategy', { engine: 'InnoDB' })
export class WmsPutawayStrategyEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'warehouse_id', type: 'bigint', default: 0 }) warehouseId!: number
  @Column({ name: 'strategy_name', type: 'varchar', length: 100 }) strategyName!: string
  @Column({ name: 'rule_type', type: 'varchar', length: 24 }) ruleType!: string
  @Column({ type: 'int', default: 1 }) priority!: number
  @Column({ name: 'rule_value', type: 'varchar', length: 120, default: '' }) ruleValue!: string
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('stock_ledger', { engine: 'InnoDB' })
@Index('idx_stock_ledger_dimension', ['tenantId', 'productId', 'variantId', 'warehouseId'])
@Index('idx_stock_ledger_voucher', ['tenantId', 'voucherType', 'voucherId'])
export class StockLedgerEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'voucher_type', type: 'varchar', length: 40 }) voucherType!: string
  @Column({ name: 'voucher_id', type: 'bigint', default: 0 }) voucherId!: number
  @Column({ name: 'voucher_line_id', type: 'bigint', default: 0 }) voucherLineId!: number
  @Column({ name: 'warehouse_id', type: 'bigint' }) warehouseId!: number
  @Column({ name: 'location_id', type: 'bigint', default: 0 }) locationId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'variant_id', type: 'bigint', default: 0 }) variantId!: number
  @Column({ name: 'batch_no', type: 'varchar', length: 60, default: '' }) batchNo!: string
  @Column({ name: 'qty_in', type: 'decimal', precision: 18, scale: 3, default: 0 }) qtyIn!: string
  @Column({ name: 'qty_out', type: 'decimal', precision: 18, scale: 3, default: 0 }) qtyOut!: string
  @Column({ name: 'qty_delta', type: 'decimal', precision: 18, scale: 3, default: 0 }) qtyDelta!: string
  @Column({ name: 'balance_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) balanceQty!: string
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) cost!: string
  @Column({ name: 'occurred_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) occurredAt!: Date
  @Column({ type: 'varchar', length: 500, nullable: true }) remark!: string | null
  @Column({ name: 'operator_id', type: 'bigint', default: 0 }) operatorId!: number
}

@Entity('stock_lock', { engine: 'InnoDB' })
@Index('idx_stock_lock_source', ['tenantId', 'sourceType', 'sourceId'])
export class StockLockEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'source_type', type: 'varchar', length: 32 }) sourceType!: string
  @Column({ name: 'source_id', type: 'bigint' }) sourceId!: number
  @Column({ name: 'warehouse_id', type: 'bigint' }) warehouseId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'variant_id', type: 'bigint', default: 0 }) variantId!: number
  @Column({ name: 'batch_no', type: 'varchar', length: 60, default: '' }) batchNo!: string
  @Column({ name: 'locked_qty', type: 'decimal', precision: 18, scale: 3 }) lockedQty!: string
  @Column({ type: 'varchar', length: 16, default: 'LOCKED' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('stock_alert', { engine: 'InnoDB' })
@Index('idx_stock_alert', ['tenantId', 'alertType', 'status'])
export class StockAlertEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'alert_type', type: 'varchar', length: 32 }) alertType!: string
  /** 告警级别：INFO / WARNING / URGENT / EXPIRED */
  @Column({ name: 'alert_level', type: 'varchar', length: 24, default: 'INFO' }) alertLevel!: string
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'warehouse_id', type: 'bigint', default: 0 }) warehouseId!: number
  @Column({ name: 'batch_no', type: 'varchar', length: 64, nullable: true }) batchNo!: string | null
  @Column({ name: 'threshold_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) thresholdQty!: string
  @Column({ name: 'current_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) currentQty!: string
  @Column({ name: 'suggest_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) suggestQty!: string
  @Column({ type: 'varchar', length: 24, default: 'OPEN' }) status!: string
  @Column({ type: 'varchar', length: 500, nullable: true }) message!: string | null
  /** 关闭原因（规范要求关闭预警需记录原因） */
  @Column({ name: 'close_reason', type: 'varchar', length: 500, nullable: true }) closeReason!: string | null
  @Column({ name: 'closed_by', type: 'bigint', nullable: true }) closedBy!: number | null
  @Column({ name: 'closed_at', type: 'datetime', nullable: true }) closedAt!: Date | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('stocktake', { engine: 'InnoDB' })
@Index('uk_stocktake_no', ['tenantId', 'stocktakeNo'], { unique: true })
export class StocktakeEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'stocktake_no', type: 'varchar', length: 60 }) stocktakeNo!: string
  @Column({ name: 'warehouse_id', type: 'bigint' }) warehouseId!: number
  @Column({ name: 'plan_date', type: 'date', nullable: true }) planDate!: string | null
  @Column({ name: 'blind_mode', type: 'tinyint', width: 1, default: 0 }) blindMode!: number
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('stocktake_line', { engine: 'InnoDB' })
@Index('idx_stocktake_line', ['tenantId', 'stocktakeId'])
export class StocktakeLineEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'stocktake_id', type: 'bigint' }) stocktakeId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'variant_id', type: 'bigint', default: 0 }) variantId!: number
  @Column({ name: 'batch_no', type: 'varchar', length: 60, default: '' }) batchNo!: string
  @Column({ name: 'book_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) bookQty!: string
  @Column({ name: 'actual_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) actualQty!: string
  @Column({ name: 'recount_qty', type: 'decimal', precision: 18, scale: 3, nullable: true }) recountQty!: string | null
  @Column({ name: 'diff_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) diffQty!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('stock_transfer', { engine: 'InnoDB' })
@Index('uk_stock_transfer_no', ['tenantId', 'transferNo'], { unique: true })
export class StockTransferEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'transfer_no', type: 'varchar', length: 60 }) transferNo!: string
  @Column({ name: 'from_warehouse_id', type: 'bigint' }) fromWarehouseId!: number
  @Column({ name: 'to_warehouse_id', type: 'bigint' }) toWarehouseId!: number
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('stock_transfer_line', { engine: 'InnoDB' })
@Index('idx_stock_transfer_line', ['tenantId', 'transferId'])
export class StockTransferLineEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'transfer_id', type: 'bigint' }) transferId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'variant_id', type: 'bigint', default: 0 }) variantId!: number
  @Column({ name: 'batch_no', type: 'varchar', length: 60, default: '' }) batchNo!: string
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ name: 'received_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) receivedQty!: string
  @Column({ name: 'shipped_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) shippedQty!: string
  @Column({ name: 'diff_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) diffQty!: string
  @Column({ name: 'diff_reason', type: 'varchar', length: 255, nullable: true }) diffReason!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('wms_putaway', { engine: 'InnoDB' })
@Index('idx_wms_putaway', ['tenantId', 'sourceType', 'sourceId'])
export class WmsPutawayEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'source_type', type: 'varchar', length: 32 }) sourceType!: string
  @Column({ name: 'source_id', type: 'bigint' }) sourceId!: number
  @Column({ name: 'warehouse_id', type: 'bigint' }) warehouseId!: number
  @Column({ name: 'location_id', type: 'bigint' }) locationId!: number
  @Column({ name: 'strategy_code', type: 'varchar', length: 50, default: 'FIFO' }) strategyCode!: string
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('wms_pick_wave', { engine: 'InnoDB' })
@Index('uk_wms_pick_wave_no', ['tenantId', 'waveNo'], { unique: true })
export class WmsPickWaveEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'wave_no', type: 'varchar', length: 60 }) waveNo!: string
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ type: 'int', default: 0 }) priority!: number
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('wms_pick_task', { engine: 'InnoDB' })
@Index('idx_wms_pick_task', ['tenantId', 'waveId'])
export class WmsPickTaskEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'wave_id', type: 'bigint' }) waveId!: number
  @Column({ name: 'source_type', type: 'varchar', length: 32, default: 'SALE_ORDER' }) sourceType!: string
  @Column({ name: 'source_id', type: 'bigint' }) sourceId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'warehouse_id', type: 'bigint' }) warehouseId!: number
  @Column({ name: 'location_id', type: 'bigint', default: 0 }) locationId!: number
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ name: 'picked_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) pickedQty!: string
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('stock_assembly', { engine: 'InnoDB' })
@Index('uk_stock_assembly_no', ['tenantId', 'assemblyNo'], { unique: true })
export class StockAssemblyEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'assembly_no', type: 'varchar', length: 60 }) assemblyNo!: string
  @Column({ name: 'assembly_type', type: 'varchar', length: 24 }) assemblyType!: string
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'warehouse_id', type: 'bigint' }) warehouseId!: number
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('stock_assembly_line', { engine: 'InnoDB' })
@Index('idx_stock_assembly_line', ['tenantId', 'assemblyId'])
export class StockAssemblyLineEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'assembly_id', type: 'bigint' }) assemblyId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'variant_id', type: 'bigint', default: 0 }) variantId!: number
  @Column({ name: 'batch_no', type: 'varchar', length: 60, default: '' }) batchNo!: string
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
