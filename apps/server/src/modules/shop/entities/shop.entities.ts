import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

export const CsConversationStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED'
} as const

@Entity('shop_store', { engine: 'InnoDB' })
@Index('uk_shop_store_code', ['tenantId', 'storeCode'], { unique: true })
export class ShopStoreEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'store_code', type: 'varchar', length: 60 }) storeCode!: string
  @Column({ name: 'store_name', type: 'varchar', length: 150 }) storeName!: string
  @Column({ type: 'varchar', length: 40 }) platform!: string
  @Column({ name: 'auth_config', type: 'json', nullable: true }) authConfig!: Record<string, unknown> | null
  @Column({ name: 'secret_mask', type: 'varchar', length: 100, nullable: true }) secretMask!: string | null
  @Column({ name: 'health_status', type: 'varchar', length: 24, default: 'UNKNOWN' }) healthStatus!: string
  @Column({ name: 'sync_strategy', type: 'varchar', length: 24, default: 'MANUAL' }) syncStrategy!: string
  @Column({ name: 'auth_expire_at', type: 'datetime', nullable: true }) authExpireAt!: Date | null
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('shop_goods_map', { engine: 'InnoDB' })
@Index('uk_shop_goods_map', ['tenantId', 'storeId', 'platformGoodsId'], { unique: true })
export class ShopGoodsMapEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'store_id', type: 'bigint' }) storeId!: number
  @Column({ name: 'platform_goods_id', type: 'varchar', length: 100 }) platformGoodsId!: string
  @Column({ name: 'platform_sku_id', type: 'varchar', length: 100, nullable: true }) platformSkuId!: string | null
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'variant_id', type: 'bigint', default: 0 }) variantId!: number
  @Column({ name: 'price_rule', type: 'varchar', length: 200, nullable: true }) priceRule!: string | null
  @Column({ name: 'stock_rule', type: 'varchar', length: 200, nullable: true }) stockRule!: string | null
  @Column({ type: 'varchar', length: 24, default: 'ENABLED' }) status!: string
  @Column({ name: 'sync_status', type: 'varchar', length: 24, default: 'IDLE' }) syncStatus!: string
  @Column({ name: 'last_sync_at', type: 'datetime', nullable: true }) lastSyncAt!: Date | null
  @Column({ name: 'error_text', type: 'varchar', length: 500, nullable: true }) errorText!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('shop_order', { engine: 'InnoDB' })
@Index('uk_shop_order_idempotent', ['tenantId', 'idempotentKey'], { unique: true })
@Index('idx_shop_order_store', ['tenantId', 'storeId', 'status'])
export class ShopOrderEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'store_id', type: 'bigint' }) storeId!: number
  @Column({ name: 'platform_order_no', type: 'varchar', length: 100 }) platformOrderNo!: string
  @Column({ name: 'idempotent_key', type: 'varchar', length: 180 }) idempotentKey!: string
  @Column({ name: 'customer_id', type: 'bigint', nullable: true }) customerId!: number | null
  @Column({ name: 'sale_order_id', type: 'bigint', nullable: true }) saleOrderId!: number | null
  @Column({ name: 'order_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) orderAmount!: string
  @Column({ name: 'paid_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) paidAmount!: string
  @Column({ name: 'ship_status', type: 'varchar', length: 24, default: 'UNSHIPPED' }) shipStatus!: string
  @Column({ type: 'varchar', length: 24, default: 'SYNCED' }) status!: string
  @Column({ type: 'json', nullable: true }) payload!: Record<string, unknown> | null
  @Column({ name: 'synced_at', type: 'datetime', nullable: true }) syncedAt!: Date | null
  @Column({ name: 'retry_count', type: 'int', default: 0 }) retryCount!: number
  @Column({ name: 'error_text', type: 'varchar', length: 500, nullable: true }) errorText!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('shop_sync_log', { engine: 'InnoDB' })
@Index('idx_shop_sync_log', ['tenantId', 'bizType', 'bizId'])
export class ShopSyncLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'store_id', type: 'bigint' }) storeId!: number
  @Column({ name: 'biz_type', type: 'varchar', length: 32 }) bizType!: string
  @Column({ name: 'biz_id', type: 'bigint', default: 0 }) bizId!: number
  @Column({ name: 'idempotent_key', type: 'varchar', length: 180, nullable: true }) idempotentKey!: string | null
  @Column({ type: 'varchar', length: 24 }) result!: string
  @Column({ name: 'error_text', type: 'varchar', length: 500, nullable: true }) errorText!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('shop_promotion', { engine: 'InnoDB' })
@Index('idx_shop_promotion', ['tenantId', 'status'])
export class ShopPromotionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'store_id', type: 'bigint' }) storeId!: number
  @Column({ name: 'promotion_code', type: 'varchar', length: 60 }) promotionCode!: string
  @Column({ name: 'promotion_type', type: 'varchar', length: 32 }) promotionType!: string
  @Column({ name: 'start_time', type: 'datetime' }) startTime!: Date
  @Column({ name: 'end_time', type: 'datetime' }) endTime!: Date
  @Column({ name: 'stock_limit', type: 'decimal', precision: 18, scale: 3, default: 0 }) stockLimit!: string
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('shop_payment_config', { engine: 'InnoDB' })
@Index('uk_shop_payment_config', ['tenantId', 'storeId', 'channel'], { unique: true })
export class ShopPaymentConfigEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'store_id', type: 'bigint' }) storeId!: number
  @Column({ type: 'varchar', length: 40 }) channel!: string
  @Column({ name: 'merchant_id', type: 'varchar', length: 100, nullable: true }) merchantId!: string | null
  @Column({ name: 'secret_mask', type: 'varchar', length: 100, nullable: true }) secretMask!: string | null
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('shop_waybill', { engine: 'InnoDB' })
@Index('uk_shop_waybill_no', ['tenantId', 'waybillNo'], { unique: true })
export class ShopWaybillEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'store_id', type: 'bigint' }) storeId!: number
  @Column({ name: 'shop_order_id', type: 'bigint' }) shopOrderId!: number
  @Column({ name: 'waybill_no', type: 'varchar', length: 80 }) waybillNo!: string
  @Column({ type: 'varchar', length: 60, nullable: true }) carrier!: string | null
  @Column({ name: 'label_url', type: 'varchar', length: 500, nullable: true }) labelUrl!: string | null
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'exception_flag', type: 'varchar', length: 16, default: 'NO' }) exceptionFlag!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('shop_cs_conversation', { engine: 'InnoDB' })
@Index('idx_shop_cs', ['tenantId', 'status'])
export class ShopCsConversationEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'store_id', type: 'bigint' }) storeId!: number
  @Column({ name: 'platform_buyer_id', type: 'varchar', length: 100, nullable: true }) platformBuyerId!: string | null
  @Column({ type: 'varchar', length: 24, default: 'OPEN' }) status!: string
  @Column({ name: 'last_message', type: 'varchar', length: 500, nullable: true }) lastMessage!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', nullable: true }) updatedAt!: Date | null
}

@Entity('shop_coupon', { engine: 'InnoDB' })
@Index('uk_shop_coupon_code', ['tenantId', 'storeId', 'couponCode'], { unique: true })
export class ShopCouponEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'store_id', type: 'bigint' }) storeId!: number
  @Column({ name: 'coupon_code', type: 'varchar', length: 60 }) couponCode!: string
  @Column({ name: 'coupon_type', type: 'varchar', length: 16 }) couponType!: string
  @Column({ name: 'discount_value', type: 'decimal', precision: 18, scale: 4, default: 0 }) discountValue!: string
  @Column({ name: 'min_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) minAmount!: string
  @Column({ name: 'max_discount', type: 'decimal', precision: 18, scale: 4, default: 0 }) maxDiscount!: string
  @Column({ name: 'start_time', type: 'datetime' }) startTime!: Date
  @Column({ name: 'end_time', type: 'datetime' }) endTime!: Date
  @Column({ type: 'tinyint', width: 1, default: 0 }) stackable!: number
  @Column({ name: 'used_count', type: 'int', default: 0 }) usedCount!: number
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('shop_seckill', { engine: 'InnoDB' })
@Index('uk_shop_seckill_code', ['tenantId', 'storeId', 'seckillCode'], { unique: true })
export class ShopSeckillEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'store_id', type: 'bigint' }) storeId!: number
  @Column({ name: 'seckill_code', type: 'varchar', length: 60 }) seckillCode!: string
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'variant_id', type: 'bigint', default: 0 }) variantId!: number
  @Column({ name: 'base_price', type: 'decimal', precision: 18, scale: 4, default: 0 }) basePrice!: string
  @Column({ name: 'seckill_price', type: 'decimal', precision: 18, scale: 4, default: 0 }) seckillPrice!: string
  @Column({ name: 'limit_per_user', type: 'int', default: 1 }) limitPerUser!: number
  @Column({ name: 'start_time', type: 'datetime' }) startTime!: Date
  @Column({ name: 'end_time', type: 'datetime' }) endTime!: Date
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('shop_activity_stock', { engine: 'InnoDB' })
@Index('uk_shop_activity_stock', ['tenantId', 'storeId', 'activityType', 'activityId', 'productId', 'variantId'], { unique: true })
export class ShopActivityStockEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'store_id', type: 'bigint' }) storeId!: number
  @Column({ name: 'activity_type', type: 'varchar', length: 24 }) activityType!: string
  @Column({ name: 'activity_id', type: 'bigint' }) activityId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'variant_id', type: 'bigint', default: 0 }) variantId!: number
  @Column({ name: 'total_stock', type: 'decimal', precision: 18, scale: 3, default: 0 }) totalStock!: string
  @Column({ name: 'sold_stock', type: 'decimal', precision: 18, scale: 3, default: 0 }) soldStock!: string
  @Column({ name: 'locked_stock', type: 'decimal', precision: 18, scale: 3, default: 0 }) lockedStock!: string
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('shop_activity_order', { engine: 'InnoDB' })
@Index('idx_shop_activity_order', ['tenantId', 'storeId', 'activityId', 'status'])
@Index('idx_shop_activity_order_buyer', ['tenantId', 'activityType', 'activityId', 'productId', 'variantId', 'buyerKey'])
export class ShopActivityOrderEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'store_id', type: 'bigint' }) storeId!: number
  @Column({ name: 'shop_order_id', type: 'bigint', nullable: true }) shopOrderId!: number | null
  @Column({ name: 'activity_type', type: 'varchar', length: 24 }) activityType!: string
  @Column({ name: 'activity_id', type: 'bigint' }) activityId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'variant_id', type: 'bigint', default: 0 }) variantId!: number
  @Column({ type: 'decimal', precision: 18, scale: 3, default: 0 }) qty!: string
  @Column({ name: 'buyer_key', type: 'varchar', length: 100, default: 'ANONYMOUS' }) buyerKey!: string
  @Column({ name: 'coupon_code', type: 'varchar', length: 60, nullable: true }) couponCode!: string | null
  @Column({ name: 'discount_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) discountAmount!: string
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) price!: string
  @Column({ type: 'varchar', length: 24, default: 'LOCKED' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('shop_reconcile_bill', { engine: 'InnoDB' })
@Index('uk_shop_reconcile_bill', ['tenantId', 'storeId', 'billNo'], { unique: true })
export class ShopReconcileBillEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'store_id', type: 'bigint' }) storeId!: number
  @Column({ name: 'bill_no', type: 'varchar', length: 100 }) billNo!: string
  @Column({ type: 'varchar', length: 40 }) channel!: string
  @Column({ type: 'varchar', length: 24, nullable: true }) period!: string | null
  @Column({ name: 'platform_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) platformAmount!: string
  @Column({ name: 'local_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) localAmount!: string
  @Column({ name: 'diff_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) diffAmount!: string
  @Column({ type: 'varchar', length: 12, default: 'CNY' }) currency!: string
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'diff_reason', type: 'varchar', length: 500, nullable: true }) diffReason!: string | null
  @Column({ name: 'resolved_by', type: 'bigint', nullable: true }) resolvedBy!: number | null
  @Column({ name: 'resolved_at', type: 'datetime', nullable: true }) resolvedAt!: Date | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('shop_refund', { engine: 'InnoDB' })
@Index('uk_shop_refund_no', ['tenantId', 'refundNo'], { unique: true })
@Index('idx_shop_refund', ['tenantId', 'storeId', 'status'])
export class ShopRefundEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'store_id', type: 'bigint' }) storeId!: number
  @Column({ name: 'shop_order_id', type: 'bigint' }) shopOrderId!: number
  @Column({ name: 'reconcile_bill_id', type: 'bigint', nullable: true }) reconcileBillId!: number | null
  @Column({ name: 'sale_return_id', type: 'bigint', nullable: true }) saleReturnId!: number | null
  @Column({ name: 'refund_no', type: 'varchar', length: 60 }) refundNo!: string
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) amount!: string
  @Column({ type: 'varchar', length: 200, nullable: true }) reason!: string | null
  @Column({ type: 'varchar', length: 24, default: 'SUBMITTED' }) status!: string
  @Column({ name: 'red_invoice_no', type: 'varchar', length: 80, nullable: true }) redInvoiceNo!: string | null
  @Column({ name: 'review_note', type: 'varchar', length: 500, nullable: true }) reviewNote!: string | null
  @Column({ name: 'reviewed_by', type: 'bigint', nullable: true }) reviewedBy!: number | null
  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true }) reviewedAt!: Date | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('shop_tracking_event', { engine: 'InnoDB' })
@Index('idx_shop_tracking', ['tenantId', 'waybillId', 'eventAt'])
export class ShopTrackingEventEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'store_id', type: 'bigint' }) storeId!: number
  @Column({ name: 'waybill_id', type: 'bigint' }) waybillId!: number
  @Column({ name: 'event_no', type: 'varchar', length: 80, nullable: true }) eventNo!: string | null
  @Column({ name: 'carrier_status', type: 'varchar', length: 40 }) carrierStatus!: string
  @Column({ type: 'varchar', length: 200, nullable: true }) location!: string | null
  @Column({ type: 'varchar', length: 500, nullable: true }) description!: string | null
  @Column({ name: 'event_at', type: 'datetime' }) eventAt!: Date
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('shop_cs_quality_review', { engine: 'InnoDB' })
@Index('idx_shop_cs_qc', ['tenantId', 'storeId', 'result'])
export class ShopCsQualityReviewEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'store_id', type: 'bigint' }) storeId!: number
  @Column({ name: 'conversation_id', type: 'bigint' }) conversationId!: number
  @Column({ type: 'int', default: 0 }) score!: number
  @Column({ type: 'varchar', length: 24 }) result!: string
  @Column({ name: 'review_note', type: 'varchar', length: 500, nullable: true }) reviewNote!: string | null
  @Column({ name: 'reviewed_by', type: 'bigint', nullable: true }) reviewedBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
