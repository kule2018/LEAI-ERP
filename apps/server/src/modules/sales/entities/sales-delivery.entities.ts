import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** 出货物流轨迹节点 */
@Entity('shipment_tracking_node', { engine: 'InnoDB' })
@Index('idx_shipment_tracking', ['tenantId', 'shipmentId'])
export class ShipmentTrackingNodeEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'shipment_id', type: 'bigint' }) shipmentId!: number
  /** 节点编码：CREATED/PICKED/SHIPPED/IN_TRANSIT/DELIVERED/EXCEPTION */
  @Column({ name: 'node_code', type: 'varchar', length: 32 }) nodeCode!: string
  @Column({ name: 'node_name', type: 'varchar', length: 100 }) nodeName!: string
  @Column({ name: 'node_time', type: 'datetime' }) nodeTime!: Date
  @Column({ type: 'varchar', length: 120, nullable: true }) location!: string | null
  @Column({ type: 'varchar', length: 60, nullable: true }) operator!: string | null
  /** 节点来源：MANUAL/CARRIER/SYSTEM */
  @Column({ type: 'varchar', length: 24, default: 'MANUAL' }) source!: string
  @Column({ type: 'varchar', length: 300, nullable: true }) remark!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 出货异常回单 */
@Entity('shipment_exception', { engine: 'InnoDB' })
@Index('idx_shipment_exception', ['tenantId', 'shipmentId'])
export class ShipmentExceptionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'shipment_id', type: 'bigint' }) shipmentId!: number
  @Column({ name: 'order_id', type: 'bigint', nullable: true }) orderId!: number | null
  /** 异常类型：REJECTED/DAMAGED/LOST/DELAY/SHORTAGE/OTHER */
  @Column({ name: 'exception_type', type: 'varchar', length: 24 }) exceptionType!: string
  /** 严重度：HIGH/MEDIUM/LOW */
  @Column({ type: 'varchar', length: 12, default: 'LOW' }) severity!: string
  @Column({ type: 'varchar', length: 500 }) description!: string
  /** 凭证照片 */
  @Column({ type: 'json', nullable: true }) evidence!: string[] | null
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  /** 异常处理后生成的售后退货单 */
  @Column({ name: 'return_id', type: 'bigint', nullable: true }) returnId!: number | null
  @Column({ name: 'handled_by', type: 'bigint', nullable: true }) handledBy!: number | null
  @Column({ name: 'handled_at', type: 'datetime', nullable: true }) handledAt!: Date | null
  @Column({ name: 'handle_remark', type: 'varchar', length: 500, nullable: true }) handleRemark!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** POS 交接班班次 */
@Entity('pos_shift', { engine: 'InnoDB' })
@Index('uk_pos_shift_no', ['tenantId', 'shiftNo'], { unique: true })
export class PosShiftEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'shift_no', type: 'varchar', length: 60 }) shiftNo!: string
  @Column({ name: 'store_name', type: 'varchar', length: 100, default: '' }) storeName!: string
  @Column({ name: 'cashier_user_id', type: 'bigint', nullable: true }) cashierUserId!: number | null
  @Column({ name: 'open_at', type: 'datetime' }) openAt!: Date
  @Column({ name: 'close_at', type: 'datetime', nullable: true }) closeAt!: Date | null
  /** 开班备用金 */
  @Column({ name: 'opening_cash', type: 'decimal', precision: 18, scale: 4, default: 0 }) openingCash!: string
  /** 本班现金收款 */
  @Column({ name: 'cash_received', type: 'decimal', precision: 18, scale: 4, default: 0 }) cashReceived!: string
  /** 其他现金收入 */
  @Column({ name: 'other_income', type: 'decimal', precision: 18, scale: 4, default: 0 }) otherIncome!: string
  /** 应存现金 */
  @Column({ name: 'expected_cash', type: 'decimal', precision: 18, scale: 4, default: 0 }) expectedCash!: string
  /** 实盘现金 */
  @Column({ name: 'actual_cash', type: 'decimal', precision: 18, scale: 4, nullable: true }) actualCash!: string | null
  /** 现金差异（实盘 - 应存） */
  @Column({ name: 'difference_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) differenceAmount!: string
  /** 差异等级：OK/WARN/ALARM */
  @Column({ type: 'varchar', length: 12, default: 'OK' }) level!: string
  @Column({ name: 'order_count', type: 'int', default: 0 }) orderCount!: number
  @Column({ name: 'order_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) orderAmount!: string
  /** 各支付方式汇总 */
  @Column({ name: 'payment_summary', type: 'json', nullable: true }) paymentSummary!: Array<{ payType: string; amount: number; count: number }> | null
  @Column({ type: 'varchar', length: 24, default: 'OPEN' }) status!: string
  @Column({ type: 'varchar', length: 500, nullable: true }) remark!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 销售组合促销（套装 / 满减） */
@Entity('sale_promotion_bundle', { engine: 'InnoDB' })
@Index('uk_sale_promotion_code', ['tenantId', 'promotionCode'], { unique: true })
export class SalePromotionBundleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'promotion_code', type: 'varchar', length: 60 }) promotionCode!: string
  @Column({ name: 'promotion_name', type: 'varchar', length: 150 }) promotionName!: string
  /** COMBO=套装价；FULL_REDUCTION=满减 */
  @Column({ name: 'bundle_type', type: 'varchar', length: 24, default: 'COMBO' }) bundleType!: string
  @Column({ name: 'threshold_amount', type: 'decimal', precision: 18, scale: 4, nullable: true }) thresholdAmount!: string | null
  @Column({ name: 'discount_amount', type: 'decimal', precision: 18, scale: 4, nullable: true }) discountAmount!: string | null
  @Column({ name: 'combo_price', type: 'decimal', precision: 18, scale: 4, nullable: true }) comboPrice!: string | null
  @Column({ name: 'start_date', type: 'date', nullable: true }) startDate!: string | null
  @Column({ name: 'end_date', type: 'date', nullable: true }) endDate!: string | null
  @Column({ type: 'varchar', length: 24, default: 'ENABLED' }) status!: string
  @Column({ type: 'int', default: 0 }) priority!: number
  @Column({ type: 'varchar', length: 300, nullable: true }) remark!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

/** 组合促销明细（套装成分） */
@Entity('sale_promotion_bundle_item', { engine: 'InnoDB' })
@Index('idx_sale_promotion_item', ['tenantId', 'bundleId'])
export class SalePromotionBundleItemEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'bundle_id', type: 'bigint' }) bundleId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ type: 'decimal', precision: 18, scale: 3, default: 1 }) qty!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 换货记录：退货单与换货出库单、销售单的双向关联 */
@Entity('sale_return_exchange', { engine: 'InnoDB' })
@Index('idx_sale_return_exchange', ['tenantId', 'returnId'])
export class SaleReturnExchangeEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'return_id', type: 'bigint' }) returnId!: number
  @Column({ name: 'exchange_order_id', type: 'bigint', nullable: true }) exchangeOrderId!: number | null
  @Column({ name: 'exchange_shipment_id', type: 'bigint', nullable: true }) exchangeShipmentId!: number | null
  @Column({ name: 'exchange_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) exchangeQty!: string
  @Column({ type: 'varchar', length: 24, default: 'CREATED' }) exchangeStatus!: string
  @Column({ type: 'varchar', length: 300, nullable: true }) remark!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
