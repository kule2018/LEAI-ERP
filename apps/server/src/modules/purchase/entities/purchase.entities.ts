import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('sup_evaluate', { engine: 'InnoDB' })
@Index('idx_sup_evaluate', ['tenantId', 'supplierId', 'period'])
export class SupplierEvaluateEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: number
  @Column({ type: 'varchar', length: 20 }) period!: string
  @Column({ name: 'quality_score', type: 'decimal', precision: 5, scale: 2, default: 0 }) qualityScore!: string
  @Column({ name: 'delivery_score', type: 'decimal', precision: 5, scale: 2, default: 0 }) deliveryScore!: string
  @Column({ name: 'price_score', type: 'decimal', precision: 5, scale: 2, default: 0 }) priceScore!: string
  @Column({ name: 'service_score', type: 'decimal', precision: 5, scale: 2, default: 0 }) serviceScore!: string
  @Column({ name: 'total_score', type: 'decimal', precision: 5, scale: 2, default: 0 }) totalScore!: string
  @Column({ type: 'varchar', length: 12, default: 'B' }) level!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('pur_quotation', { engine: 'InnoDB' })
@Index('uk_pur_quotation_no', ['tenantId', 'rfqNo'], { unique: true })
export class PurQuotationEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'rfq_no', type: 'varchar', length: 60 }) rfqNo!: string
  @Column({ name: 'project_name', type: 'varchar', length: 150 }) projectName!: string
  @Column({ name: 'quote_deadline', type: 'date', nullable: true }) quoteDeadline!: string | null
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'round_no', type: 'int', default: 1 }) roundNo!: number
  @Column({ name: 'attachment_url', type: 'varchar', length: 255, nullable: true }) attachmentUrl!: string | null
  @Column({ name: 'award_status', type: 'varchar', length: 24, default: 'PENDING' }) awardStatus!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('pur_quotation_line', { engine: 'InnoDB' })
@Index('idx_pur_quote_line', ['tenantId', 'rfqId'])
export class PurQuotationLineEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'rfq_id', type: 'bigint' }) rfqId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ name: 'target_price', type: 'decimal', precision: 18, scale: 4, default: 0 }) targetPrice!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('pur_quotation_quote', { engine: 'InnoDB' })
@Index('idx_pur_quote_supplier', ['tenantId', 'rfqLineId', 'supplierId'])
export class PurSupplierQuoteEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'rfq_line_id', type: 'bigint' }) rfqLineId!: number
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: number
  @Column({ type: 'decimal', precision: 18, scale: 4 }) price!: string
  @Column({ name: 'lead_days', type: 'int', default: 0 }) leadDays!: number
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 }) score!: string
  @Column({ type: 'varchar', length: 16, default: 'NO' }) awarded!: string
  @Column({ name: 'round_no', type: 'int', default: 1 }) roundNo!: number
  @Column({ name: 'attachment_url', type: 'varchar', length: 255, nullable: true }) attachmentUrl!: string | null
  @Column({ name: 'rank_no', type: 'int', default: 0 }) rankNo!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('purchase_demand', { engine: 'InnoDB' })
@Index('uk_purchase_demand_no', ['tenantId', 'demandNo'], { unique: true })
export class PurchaseDemandEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'demand_no', type: 'varchar', length: 60 }) demandNo!: string
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ name: 'source_type', type: 'varchar', length: 24, default: 'MANUAL' }) sourceType!: string
  @Column({ name: 'source_id', type: 'bigint', nullable: true }) sourceId!: number | null
  @Column({ name: 'source_run_no', type: 'varchar', length: 60, nullable: true }) sourceRunNo!: string | null
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('purchase_order', { engine: 'InnoDB' })
@Index('uk_purchase_order_no', ['tenantId', 'orderNo'], { unique: true })
export class PurchaseOrderEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'order_no', type: 'varchar', length: 60 }) orderNo!: string
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: number
  @Column({ name: 'warehouse_id', type: 'bigint', nullable: true }) warehouseId!: number | null
  @Column({ name: 'order_date', type: 'date' }) orderDate!: string
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'contract_id', type: 'bigint', nullable: true }) contractId!: number | null
  @Column({ name: 'frame_flag', type: 'tinyint', width: 1, default: 0 }) frameFlag!: number
  @Column({ name: 'expected_date', type: 'date', nullable: true }) expectedDate!: string | null
  @Column({ type: 'int', default: 1 }) version!: number
  @Column({ name: 'portal_confirmed_at', type: 'datetime', nullable: true }) portalConfirmedAt!: Date | null
  @Column({ name: 'portal_confirmed_by', type: 'bigint', nullable: true }) portalConfirmedBy!: number | null
  @Column({ name: 'pay_status', type: 'varchar', length: 24, default: 'UNPAID' }) payStatus!: string
  @Column({ name: 'total_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) totalAmount!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', nullable: true }) updatedAt!: Date | null
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
  @Column({ type: 'varchar', length: 500, nullable: true }) remark!: string | null
}

@Entity('purchase_order_line', { engine: 'InnoDB' })
@Index('idx_purchase_order_line', ['tenantId', 'orderId'])
export class PurchaseOrderLineEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'order_id', type: 'bigint' }) orderId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'variant_id', type: 'bigint', nullable: true }) variantId!: number | null
  @Column({ name: 'warehouse_id', type: 'bigint', nullable: true }) warehouseId!: number | null
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ name: 'unit_price', type: 'decimal', precision: 18, scale: 4 }) unitPrice!: string
  @Column({ type: 'decimal', precision: 18, scale: 4 }) amount!: string
  @Column({ name: 'received_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) receivedQty!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('goods_receipt', { engine: 'InnoDB' })
@Index('uk_goods_receipt_no', ['tenantId', 'receiptNo'], { unique: true })
export class GoodsReceiptEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'receipt_no', type: 'varchar', length: 60 }) receiptNo!: string
  @Column({ name: 'order_id', type: 'bigint' }) orderId!: number
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: number
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'receipt_type', type: 'varchar', length: 24, default: 'NORMAL' }) receiptType!: string
  @Column({ name: 'scan_mode', type: 'varchar', length: 16, default: 'MANUAL' }) scanMode!: string
  @Column({ name: 'difference_reason', type: 'varchar', length: 300, nullable: true }) differenceReason!: string | null
  @Column({ name: 'received_at', type: 'datetime', nullable: true }) receivedAt!: Date | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('goods_receipt_line', { engine: 'InnoDB' })
@Index('idx_receipt_line', ['tenantId', 'receiptId'])
export class GoodsReceiptLineEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'receipt_id', type: 'bigint' }) receiptId!: number
  @Column({ name: 'order_line_id', type: 'bigint' }) orderLineId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ name: 'batch_no', type: 'varchar', length: 60, nullable: true }) batchNo!: string | null
  @Column({ name: 'serial_no', type: 'varchar', length: 100, nullable: true }) serialNo!: string | null
  @Column({ name: 'qc_status', type: 'varchar', length: 24, default: 'PENDING' }) qcStatus!: string
  @Column({ name: 'difference_type', type: 'varchar', length: 24, nullable: true }) differenceType!: string | null
  @Column({ name: 'origin_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) originQty!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('vendor_statement', { engine: 'InnoDB' })
@Index('uk_vendor_statement_no', ['tenantId', 'statementNo'], { unique: true })
export class VendorStatementEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'statement_no', type: 'varchar', length: 60 }) statementNo!: string
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: number
  @Column({ type: 'varchar', length: 20 }) period!: string
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) amount!: string
  @Column({ name: 'settled_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) settledAmount!: string
  @Column({ name: 'difference_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) differenceAmount!: string
  @Column({ name: 'difference_reason', type: 'varchar', length: 300, nullable: true }) differenceReason!: string | null
  @Column({ name: 'reversed_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) reversedAmount!: string
  @Column({ name: 'reverse_reason', type: 'varchar', length: 300, nullable: true }) reverseReason!: string | null
  @Column({ name: 'portal_confirmed_at', type: 'datetime', nullable: true }) portalConfirmedAt!: Date | null
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('purchase_return', { engine: 'InnoDB' })
@Index('uk_purchase_return_no', ['tenantId', 'returnNo'], { unique: true })
export class PurchaseReturnEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'return_no', type: 'varchar', length: 60 }) returnNo!: string
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: number
  @Column({ name: 'receipt_id', type: 'bigint', nullable: true }) receiptId!: number | null
  @Column({ type: 'varchar', length: 200, nullable: true }) reason!: string | null
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'refund_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) refundAmount!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('purchase_return_line', { engine: 'InnoDB' })
@Index('idx_purchase_return_line', ['tenantId', 'returnId'])
export class PurchaseReturnLineEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'return_id', type: 'bigint' }) returnId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ type: 'decimal', precision: 18, scale: 4 }) amount!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('purchase_contract', { engine: 'InnoDB' })
@Index('uk_purchase_contract_no', ['tenantId', 'contractNo'], { unique: true })
export class PurchaseContractEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'contract_no', type: 'varchar', length: 60 }) contractNo!: string
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: number
  @Column({ type: 'varchar', length: 150 }) title!: string
  @Column({ name: 'start_date', type: 'date', nullable: true }) startDate!: string | null
  @Column({ name: 'end_date', type: 'date', nullable: true }) endDate!: string | null
  @Column({ name: 'total_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) totalAmount!: string
  @Column({ name: 'attachment_url', type: 'varchar', length: 500, nullable: true }) attachmentUrl!: string | null
  @Column({ name: 'attachment_name', type: 'varchar', length: 200, nullable: true }) attachmentName!: string | null
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('purchase_price', { engine: 'InnoDB' })
@Index('idx_purchase_price', ['tenantId', 'supplierId', 'productId'])
export class PurchasePriceEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ type: 'decimal', precision: 18, scale: 4 }) price!: string
  @Column({ name: 'start_date', type: 'date', nullable: true }) startDate!: string | null
  @Column({ name: 'end_date', type: 'date', nullable: true }) endDate!: string | null
  @Column({ type: 'varchar', length: 24, default: 'ENABLED' }) status!: string
  @Column({ type: 'int', default: 0 }) priority!: number
  @Column({ name: 'approval_status', type: 'varchar', length: 24, default: 'APPROVED' }) approvalStatus!: string
  @Column({ type: 'int', default: 1 }) version!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('logistics_carrier', { engine: 'InnoDB' })
@Index('uk_logistics_carrier_code', ['tenantId', 'carrierCode'], { unique: true })
export class LogisticsCarrierEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'carrier_code', type: 'varchar', length: 50 }) carrierCode!: string
  @Column({ name: 'carrier_name', type: 'varchar', length: 100 }) carrierName!: string
  @Column({ name: 'contact_phone', type: 'varchar', length: 30, nullable: true }) contactPhone!: string | null
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('logistics_waybill', { engine: 'InnoDB' })
@Index('uk_logistics_waybill_no', ['tenantId', 'waybillNo'], { unique: true })
export class LogisticsWaybillEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'waybill_no', type: 'varchar', length: 80 }) waybillNo!: string
  @Column({ name: 'carrier_id', type: 'bigint' }) carrierId!: number
  @Column({ name: 'supplier_id', type: 'bigint', nullable: true }) supplierId!: number | null
  @Column({ name: 'source_type', type: 'varchar', length: 32, nullable: true }) sourceType!: string | null
  @Column({ name: 'source_id', type: 'bigint', nullable: true }) sourceId!: number | null
  @Column({ name: 'freight_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) freightAmount!: string
  @Column({ name: 'exception_flag', type: 'tinyint', width: 1, default: 0 }) exceptionFlag!: number
  @Column({ name: 'exception_reason', type: 'varchar', length: 300, nullable: true }) exceptionReason!: string | null
  @Column({ name: 'delivered_at', type: 'datetime', nullable: true }) deliveredAt!: Date | null
  @Column({ name: 'signer', type: 'varchar', length: 60, nullable: true }) signer!: string | null
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('outsource_order', { engine: 'InnoDB' })
@Index('uk_outsource_order_no', ['tenantId', 'outsourceNo'], { unique: true })
export class OutsourceOrderEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'outsource_no', type: 'varchar', length: 60 }) outsourceNo!: string
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'warehouse_id', type: 'bigint', nullable: true }) warehouseId!: number | null
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ name: 'unit_price', type: 'decimal', precision: 18, scale: 4, default: 0 }) unitPrice!: string
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) amount!: string
  @Column({ name: 'issued_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) issuedQty!: string
  @Column({ name: 'received_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) receivedQty!: string
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', nullable: true }) updatedAt!: Date | null
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
  @Column({ type: 'varchar', length: 500, nullable: true }) remark!: string | null
}

@Entity('outsource_order_line', { engine: 'InnoDB' })
@Index('idx_outsource_order_line', ['tenantId', 'orderId'])
export class OutsourceOrderLineEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'order_id', type: 'bigint' }) orderId!: number
  @Column({ name: 'material_id', type: 'bigint' }) materialId!: number
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ name: 'issued_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) issuedQty!: string
  @Column({ name: 'returned_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) returnedQty!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('supplier_qualification', { engine: 'InnoDB' })
@Index('idx_supplier_qualification', ['tenantId', 'supplierId'])
export class SupplierQualificationEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: number
  @Column({ name: 'qualification_type', type: 'varchar', length: 60 }) qualificationType!: string
  @Column({ name: 'certificate_no', type: 'varchar', length: 100, nullable: true }) certificateNo!: string | null
  @Column({ name: 'issue_date', type: 'date', nullable: true }) issueDate!: string | null
  @Column({ name: 'expire_date', type: 'date', nullable: true }) expireDate!: string | null
  @Column({ type: 'varchar', length: 24, default: 'VALID' }) status!: string
  @Column({ name: 'file_url', type: 'varchar', length: 255, nullable: true }) fileUrl!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('supplier_bank_account', { engine: 'InnoDB' })
@Index('idx_supplier_bank_account', ['tenantId', 'supplierId'])
export class SupplierBankAccountEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: number
  @Column({ name: 'account_name', type: 'varchar', length: 150 }) accountName!: string
  @Column({ name: 'account_no', type: 'varchar', length: 100 }) accountNo!: string
  /** 账号密文：明文列仅保存掩码 */
  @Column({ name: 'account_no_encrypted', type: 'varchar', length: 255, nullable: true }) accountNoEncrypted!: string | null
  /** 账号掩码 */
  @Column({ name: 'account_no_mask', type: 'varchar', length: 100, nullable: true }) accountNoMask!: string | null
  @Column({ name: 'bank_name', type: 'varchar', length: 100 }) bankName!: string
  @Column({ name: 'bank_code', type: 'varchar', length: 60, nullable: true }) bankCode!: string | null
  @Column({ name: 'tax_no', type: 'varchar', length: 60, nullable: true }) taxNo!: string | null
  @Column({ name: 'is_default', type: 'tinyint', width: 1, default: 0 }) isDefault!: number
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('pur_award_record', { engine: 'InnoDB' })
@Index('idx_pur_award_record', ['tenantId', 'rfqId'])
export class PurchaseAwardEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'rfq_id', type: 'bigint' }) rfqId!: number
  @Column({ name: 'rfq_line_id', type: 'bigint' }) rfqLineId!: number
  @Column({ name: 'quote_id', type: 'bigint' }) quoteId!: number
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: number
  @Column({ name: 'round_no', type: 'int', default: 1 }) roundNo!: number
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) totalScore!: string
  @Column({ name: 'rank_no', type: 'int', default: 0 }) rankNo!: number
  @Column({ name: 'award_status', type: 'varchar', length: 24, default: 'PENDING' }) awardStatus!: string
  @Column({ type: 'varchar', length: 500, nullable: true }) reason!: string | null
  @Column({ name: 'approved_by', type: 'bigint', nullable: true }) approvedBy!: number | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('purchase_demand_merge', { engine: 'InnoDB' })
@Index('uk_purchase_demand_merge_no', ['tenantId', 'mergeNo'], { unique: true })
export class PurchaseDemandMergeEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'merge_no', type: 'varchar', length: 60 }) mergeNo!: string
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ type: 'decimal', precision: 18, scale: 3 }) totalQty!: string
  @Column({ name: 'source_demand_ids', type: 'json', nullable: true }) sourceDemandIds!: number[] | null
  @Column({ type: 'varchar', length: 24, default: 'MERGED' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('purchase_order_change', { engine: 'InnoDB' })
@Index('idx_purchase_order_change', ['tenantId', 'orderId'])
export class PurchaseOrderChangeEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'order_id', type: 'bigint' }) orderId!: number
  @Column({ type: 'int', default: 1 }) version!: number
  @Column({ name: 'change_type', type: 'varchar', length: 32 }) changeType!: string
  @Column({ name: 'diff_detail', type: 'json', nullable: true }) diffDetail!: unknown
  @Column({ type: 'varchar', length: 500, nullable: true }) reason!: string | null
  @Column({ name: 'changed_by', type: 'bigint', nullable: true }) changedBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('purchase_arrival_plan', { engine: 'InnoDB' })
@Index('idx_purchase_arrival_plan', ['tenantId', 'orderId'])
export class PurchaseArrivalPlanEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'order_id', type: 'bigint' }) orderId!: number
  @Column({ name: 'order_line_id', type: 'bigint', nullable: true }) orderLineId!: number | null
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ type: 'decimal', precision: 18, scale: 3 }) planQty!: string
  @Column({ name: 'arrived_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) arrivedQty!: string
  @Column({ name: 'plan_date', type: 'date', nullable: true }) planDate!: string | null
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('purchase_provisional', { engine: 'InnoDB' })
@Index('idx_purchase_provisional', ['tenantId', 'receiptId'])
export class PurchaseProvisionalEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'receipt_id', type: 'bigint' }) receiptId!: number
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: number
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) amount!: string
  @Column({ type: 'varchar', length: 24, default: 'ESTIMATED' }) status!: string
  @Column({ name: 'invoice_amount', type: 'decimal', precision: 18, scale: 4, nullable: true }) invoiceAmount!: string | null
  @Column({ name: 'reverse_reason', type: 'varchar', length: 300, nullable: true }) reverseReason!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('purchase_cost_flow', { engine: 'InnoDB' })
@Index('idx_purchase_cost_flow', ['tenantId', 'receiptId'])
export class PurchaseCostFlowEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'receipt_id', type: 'bigint' }) receiptId!: number
  @Column({ name: 'product_id', type: 'bigint', nullable: true }) productId!: number | null
  @Column({ name: 'cost_type', type: 'varchar', length: 32 }) costType!: string
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) amount!: string
  @Column({ name: 'allocated_from', type: 'varchar', length: 80, nullable: true }) allocatedFrom!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('outsource_loss', { engine: 'InnoDB' })
@Index('idx_outsource_loss', ['tenantId', 'outsourceId'])
export class OutsourceLossEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'outsource_id', type: 'bigint' }) outsourceId!: number
  @Column({ name: 'material_id', type: 'bigint', nullable: true }) materialId!: number | null
  @Column({ name: 'issued_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) issuedQty!: string
  @Column({ name: 'received_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) receivedQty!: string
  @Column({ name: 'loss_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) lossQty!: string
  @Column({ name: 'loss_rate', type: 'decimal', precision: 10, scale: 4, default: 0 }) lossRate!: string
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ type: 'varchar', length: 500, nullable: true }) reason!: string | null
  @Column({ name: 'approved_by', type: 'bigint', nullable: true }) approvedBy!: number | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('logistics_track_node', { engine: 'InnoDB' })
@Index('idx_logistics_track_node', ['tenantId', 'waybillId'])
export class LogisticsTrackNodeEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'waybill_id', type: 'bigint' }) waybillId!: number
  @Column({ name: 'node_name', type: 'varchar', length: 100 }) nodeName!: string
  @Column({ name: 'node_time', type: 'datetime' }) nodeTime!: Date
  @Column({ name: 'location', type: 'varchar', length: 150, nullable: true }) location!: string | null
  @Column({ name: 'source_ref', type: 'varchar', length: 80, nullable: true }) sourceRef!: string | null
  @Column({ type: 'varchar', length: 24, default: 'NORMAL' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('purchase_price_history', { engine: 'InnoDB' })
@Index('idx_purchase_price_history', ['tenantId', 'supplierId', 'productId'])
export class PurchasePriceHistoryEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ type: 'decimal', precision: 18, scale: 4 }) price!: string
  @Column({ name: 'source_type', type: 'varchar', length: 32, default: 'PRICE_LIST' }) sourceType!: string
  @Column({ name: 'source_id', type: 'bigint', nullable: true }) sourceId!: number | null
  @Column({ name: 'effective_date', type: 'date', nullable: true }) effectiveDate!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('supplier_portal_action', { engine: 'InnoDB' })
@Index('idx_supplier_portal_action', ['tenantId', 'supplierId'])
export class SupplierPortalActionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: number
  @Column({ name: 'action_type', type: 'varchar', length: 32 }) actionType!: string
  @Column({ name: 'biz_type', type: 'varchar', length: 32 }) bizType!: string
  @Column({ name: 'biz_id', type: 'bigint', nullable: true }) bizId!: number | null
  @Column({ name: 'content', type: 'json', nullable: true }) content!: unknown
  @Column({ type: 'varchar', length: 24, default: 'RECEIVED' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 三方匹配证据链：订单行 / 收货行 / 发票行的逐行比对凭证 */
@Entity('purchase_match_evidence')
export class PurchaseMatchEvidenceEntity {
  @PrimaryGeneratedColumn() id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'receipt_id', type: 'bigint' }) receiptId!: number
  @Column({ name: 'receipt_no', type: 'varchar', length: 60 }) receiptNo!: string
  @Column({ name: 'order_id', type: 'bigint', nullable: true }) orderId!: number | null
  @Column({ name: 'order_no', type: 'varchar', length: 60, nullable: true }) orderNo!: string | null
  @Column({ name: 'invoice_id', type: 'bigint', nullable: true }) invoiceId!: number | null
  @Column({ name: 'invoice_no', type: 'varchar', length: 60, nullable: true }) invoiceNo!: string | null
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'order_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) orderQty!: string
  @Column({ name: 'receipt_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) receiptQty!: string
  @Column({ name: 'invoice_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) invoiceQty!: string
  @Column({ name: 'order_price', type: 'decimal', precision: 18, scale: 4, default: 0 }) orderPrice!: string
  @Column({ name: 'invoice_price', type: 'decimal', precision: 18, scale: 4, default: 0 }) invoicePrice!: string
  @Column({ type: 'varchar', length: 24, default: 'MATCHED' }) status!: string
  @Column({ type: 'json', nullable: true }) issues!: unknown
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 采购框架协议（按版本管理） */
@Entity('purchase_frame_agreement')
export class PurchaseFrameAgreementEntity {
  @PrimaryGeneratedColumn() id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'agreement_no', type: 'varchar', length: 60 }) agreementNo!: string
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: number
  @Column({ name: 'product_id', type: 'bigint', nullable: true }) productId!: number | null
  @Column({ type: 'int', default: 1 }) version!: number
  @Column({ name: 'parent_id', type: 'bigint', nullable: true }) parentId!: number | null
  @Column({ name: 'start_date', type: 'date', nullable: true }) startDate!: string | null
  @Column({ name: 'end_date', type: 'date', nullable: true }) endDate!: string | null
  @Column({ name: 'total_qty', type: 'decimal', precision: 18, scale: 3, nullable: true }) totalQty!: string | null
  @Column({ name: 'used_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) usedQty!: string
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) price!: string
  @Column({ name: 'change_reason', type: 'varchar', length: 300, nullable: true }) changeReason!: string | null
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 供应商准入黑名单 */
@Entity('purchase_supplier_blacklist')
export class PurchaseSupplierBlacklistEntity {
  @PrimaryGeneratedColumn() id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: number
  @Column({ name: 'supplier_name', type: 'varchar', length: 150, nullable: true }) supplierName!: string | null
  @Column({ type: 'varchar', length: 16, default: 'MEDIUM' }) level!: string
  @Column({ name: 'reason', type: 'varchar', length: 300, nullable: true }) reason!: string | null
  @Column({ name: 'start_date', type: 'date', nullable: true }) startDate!: string | null
  @Column({ name: 'end_date', type: 'date', nullable: true }) endDate!: string | null
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
