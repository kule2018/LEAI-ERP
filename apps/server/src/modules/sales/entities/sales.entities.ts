import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('crm_lead', { engine: 'InnoDB' })
@Index('uk_crm_lead_no', ['tenantId', 'leadNo'], { unique: true })
export class LeadEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'lead_no', type: 'varchar', length: 60 }) leadNo!: string
  @Column({ type: 'varchar', length: 100 }) name!: string
  @Column({ type: 'varchar', length: 30, nullable: true }) phone!: string | null
  @Column({ type: 'varchar', length: 50, nullable: true }) source!: string | null
  @Column({ type: 'int', default: 0 }) score!: number
  @Column({ type: 'varchar', length: 24, default: 'NEW' }) status!: string
  @Column({ name: 'owner_user_id', type: 'bigint', nullable: true }) ownerUserId!: number | null
  @Column({ name: 'customer_id', type: 'bigint', nullable: true }) customerId!: number | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', nullable: true }) updatedAt!: Date | null
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
  @Column({ type: 'varchar', length: 500, nullable: true }) remark!: string | null
}

@Entity('crm_opportunity', { engine: 'InnoDB' })
@Index('uk_crm_opportunity_no', ['tenantId', 'oppNo'], { unique: true })
export class OpportunityEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'opp_no', type: 'varchar', length: 60 }) oppNo!: string
  @Column({ name: 'customer_id', type: 'bigint' }) customerId!: number
  @Column({ type: 'varchar', length: 150 }) title!: string
  @Column({ type: 'varchar', length: 24, default: 'PROSPECT' }) stage!: string
  @Column({ name: 'expected_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) expectedAmount!: string
  @Column({ name: 'win_rate', type: 'int', default: 10 }) winRate!: number
  @Column({ name: 'competitor', type: 'varchar', length: 150, nullable: true }) competitor!: string | null
  @Column({ name: 'lost_reason', type: 'varchar', length: 300, nullable: true }) lostReason!: string | null
  @Column({ name: 'team_member_ids', type: 'json', nullable: true }) teamMemberIds!: number[] | null
  @Column({ name: 'owner_user_id', type: 'bigint', nullable: true }) ownerUserId!: number | null
  @Column({ name: 'close_date', type: 'date', nullable: true }) closeDate!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', nullable: true }) updatedAt!: Date | null
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('crm_follow', { engine: 'InnoDB' })
@Index('idx_crm_follow_biz', ['tenantId', 'bizType', 'bizId'])
export class FollowEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'biz_type', type: 'varchar', length: 32 }) bizType!: string
  @Column({ name: 'biz_id', type: 'bigint' }) bizId!: number
  @Column({ name: 'follow_type', type: 'varchar', length: 24, default: 'NOTE' }) followType!: string
  @Column({ type: 'varchar', length: 1000 }) content!: string
  @Column({ name: 'next_time', type: 'datetime', nullable: true }) nextTime!: Date | null
  @Column({ name: 'created_by', type: 'bigint' }) createdBy!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('crm_quotation', { engine: 'InnoDB' })
@Index('uk_crm_quotation_no', ['tenantId', 'quoteNo'], { unique: true })
export class QuotationEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'quote_no', type: 'varchar', length: 60 }) quoteNo!: string
  @Column({ name: 'customer_id', type: 'bigint' }) customerId!: number
  @Column({ name: 'quote_date', type: 'date' }) quoteDate!: string
  @Column({ name: 'expire_date', type: 'date', nullable: true }) expireDate!: string | null
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ type: 'int', default: 1 }) version!: number
  @Column({ name: 'approval_status', type: 'varchar', length: 24, default: 'PENDING' }) approvalStatus!: string
  @Column({ name: 'converted_order_id', type: 'bigint', nullable: true }) convertedOrderId!: number | null
  @Column({ name: 'total_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) totalAmount!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', nullable: true }) updatedAt!: Date | null
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
  @Column({ type: 'varchar', length: 500, nullable: true }) remark!: string | null
}

@Entity('crm_quotation_line', { engine: 'InnoDB' })
@Index('idx_quote_line', ['tenantId', 'quotationId'])
export class QuotationLineEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'quotation_id', type: 'bigint' }) quotationId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ name: 'unit_price', type: 'decimal', precision: 18, scale: 4 }) unitPrice!: string
  @Column({ type: 'decimal', precision: 18, scale: 4 }) amount!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('sale_contract', { engine: 'InnoDB' })
@Index('uk_sale_contract_no', ['tenantId', 'contractNo'], { unique: true })
export class SaleContractEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'contract_no', type: 'varchar', length: 60 }) contractNo!: string
  @Column({ name: 'customer_id', type: 'bigint' }) customerId!: number
  @Column({ type: 'varchar', length: 150 }) title!: string
  @Column({ name: 'start_date', type: 'date', nullable: true }) startDate!: string | null
  @Column({ name: 'end_date', type: 'date', nullable: true }) endDate!: string | null
  @Column({ name: 'clause_ids', type: 'json', nullable: true }) clauseIds!: number[] | null
  @Column({ name: 'esign_no', type: 'varchar', length: 80, nullable: true }) esignNo!: string | null
  /** 续签来源合同 */
  @Column({ name: 'renewed_from_id', type: 'bigint', nullable: true }) renewedFromId!: number | null
  /** 续签次数 */
  @Column({ name: 'renew_count', type: 'int', default: 0 }) renewCount!: number
  /** 电子签署时间 */
  @Column({ name: 'signed_at', type: 'datetime', nullable: true }) signedAt!: Date | null
  @Column({ type: 'int', default: 1 }) version!: number
  @Column({ name: 'total_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) totalAmount!: string
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', nullable: true }) updatedAt!: Date | null
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('sale_clause', { engine: 'InnoDB' })
@Index('uk_sale_clause_code', ['tenantId', 'clauseCode'], { unique: true })
export class SaleClauseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'clause_code', type: 'varchar', length: 60 }) clauseCode!: string
  @Column({ name: 'clause_title', type: 'varchar', length: 150 }) clauseTitle!: string
  @Column({ name: 'clause_content', type: 'text', nullable: true }) clauseContent!: string | null
  @Column({ type: 'varchar', length: 60, nullable: true }) category!: string | null
  @Column({ name: 'is_system', type: 'tinyint', width: 1, default: 0 }) isSystem!: number
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', nullable: true }) updatedAt!: Date | null
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('sale_order', { engine: 'InnoDB' })
@Index('uk_sale_order_no', ['tenantId', 'orderNo'], { unique: true })
export class SaleOrderEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'order_no', type: 'varchar', length: 60 }) orderNo!: string
  @Column({ name: 'customer_id', type: 'bigint' }) customerId!: number
  @Column({ name: 'warehouse_id', type: 'bigint', nullable: true }) warehouseId!: number | null
  @Column({ name: 'order_date', type: 'date' }) orderDate!: string
  @Column({ name: 'source_type', type: 'varchar', length: 24, default: 'MANUAL' }) sourceType!: string
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'pay_status', type: 'varchar', length: 24, default: 'UNPAID' }) payStatus!: string
  @Column({ name: 'ship_status', type: 'varchar', length: 24, default: 'PENDING' }) shipStatus!: string
  @Column({ name: 'total_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) totalAmount!: string
  @Column({ name: 'paid_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) paidAmount!: string
  @Column({ name: 'credit_occupied', type: 'decimal', precision: 18, scale: 4, default: 0 }) creditOccupied!: string
  @Column({ name: 'flow_instance_id', type: 'bigint', nullable: true }) flowInstanceId!: number | null
  /** 拆单来源单据ID（本单由原单拆分而来） */
  @Column({ name: 'parent_order_id', type: 'bigint', nullable: true }) parentOrderId!: number | null
  /** 拆分批次号：同一原单拆出的多单共用批次号 */
  @Column({ name: 'split_batch_no', type: 'varchar', length: 60, nullable: true }) splitBatchNo!: string | null
  /** 命中的组合促销编码 */
  @Column({ name: 'promotion_code', type: 'varchar', length: 60, nullable: true }) promotionCode!: string | null
  /** 组合促销优惠金额 */
  @Column({ name: 'promotion_discount', type: 'decimal', precision: 18, scale: 4, default: 0 }) promotionDiscount!: string
  /** 组合促销命中明细（商品、金额、依据） */
  @Column({ name: 'promotion_detail', type: 'json', nullable: true }) promotionDetail!: Record<string, unknown> | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', nullable: true }) updatedAt!: Date | null
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
  @Column({ type: 'varchar', length: 500, nullable: true }) remark!: string | null
}

@Entity('sale_order_line', { engine: 'InnoDB' })
@Index('idx_sale_order_line', ['tenantId', 'orderId'])
export class SaleOrderLineEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'order_id', type: 'bigint' }) orderId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'variant_id', type: 'bigint', nullable: true }) variantId!: number | null
  @Column({ name: 'warehouse_id', type: 'bigint', nullable: true }) warehouseId!: number | null
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ name: 'unit_price', type: 'decimal', precision: 18, scale: 4 }) unitPrice!: string
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 }) discount!: string
  @Column({ type: 'decimal', precision: 18, scale: 4 }) amount!: string
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) cost!: string
  @Column({ name: 'shipped_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) shippedQty!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('customer_statement', { engine: 'InnoDB' })
@Index('uk_customer_statement_no', ['tenantId', 'statementNo'], { unique: true })
export class CustomerStatementEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'statement_no', type: 'varchar', length: 60 }) statementNo!: string
  @Column({ name: 'customer_id', type: 'bigint' }) customerId!: number
  @Column({ type: 'varchar', length: 20 }) period!: string
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) amount!: string
  @Column({ name: 'settled_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) settledAmount!: string
  @Column({ name: 'reversed_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) reversedAmount!: string
  @Column({ name: 'reverse_reason', type: 'varchar', length: 300, nullable: true }) reverseReason!: string | null
  @Column({ name: 'reversed_at', type: 'datetime', nullable: true }) reversedAt!: Date | null
  @Column({ name: 'due_date', type: 'date', nullable: true }) dueDate!: string | null
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  /** 对账差异标记：NO/MINOR/MAJOR */
  @Column({ name: 'diff_flag', type: 'varchar', length: 16, default: 'NO' }) diffFlag!: string
  /** 差异明细与依据 */
  @Column({ name: 'diff_detail', type: 'json', nullable: true }) diffDetail!: Record<string, unknown> | null
  /** AI 对账建议（含依据与置信度） */
  @Column({ name: 'ai_suggestion', type: 'json', nullable: true }) aiSuggestion!: Array<Record<string, unknown>> | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('shipment', { engine: 'InnoDB' })
@Index('uk_shipment_no', ['tenantId', 'shipmentNo'], { unique: true })
export class ShipmentEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'shipment_no', type: 'varchar', length: 60 }) shipmentNo!: string
  @Column({ name: 'order_id', type: 'bigint' }) orderId!: number
  @Column({ name: 'customer_id', type: 'bigint' }) customerId!: number
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'shipped_at', type: 'datetime', nullable: true }) shippedAt!: Date | null
  @Column({ name: 'tracking_no', type: 'varchar', length: 100, nullable: true }) trackingNo!: string | null
  /** 签收时间 */
  @Column({ name: 'signed_at', type: 'datetime', nullable: true }) signedAt!: Date | null
  /** 签收人 */
  @Column({ name: 'signed_by', type: 'varchar', length: 60, nullable: true }) signedBy!: string | null
  /** 签收凭证（照片/单号等） */
  @Column({ name: 'sign_evidence', type: 'json', nullable: true }) signEvidence!: Record<string, unknown> | null
  /** 关联拣货波次（复核后才可发货） */
  @Column({ name: 'wave_id', type: 'bigint', nullable: true }) waveId!: number | null
  /** 异常标记：NO/HAS_EXCEPTION */
  @Column({ name: 'exception_flag', type: 'varchar', length: 16, default: 'NO' }) exceptionFlag!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('shipment_line', { engine: 'InnoDB' })
@Index('idx_shipment_line', ['tenantId', 'shipmentId'])
export class ShipmentLineEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'shipment_id', type: 'bigint' }) shipmentId!: number
  @Column({ name: 'order_line_id', type: 'bigint' }) orderLineId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'variant_id', type: 'bigint', nullable: true }) variantId!: number | null
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ name: 'batch_no', type: 'varchar', length: 60, nullable: true }) batchNo!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('sale_return', { engine: 'InnoDB' })
@Index('uk_sale_return_no', ['tenantId', 'returnNo'], { unique: true })
export class SaleReturnEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'return_no', type: 'varchar', length: 60 }) returnNo!: string
  @Column({ name: 'customer_id', type: 'bigint' }) customerId!: number
  @Column({ name: 'order_id', type: 'bigint', nullable: true }) orderId!: number | null
  @Column({ type: 'varchar', length: 200, nullable: true }) reason!: string | null
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'refund_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) refundAmount!: string
  @Column({ name: 'approved_by', type: 'bigint', nullable: true }) approvedBy!: number | null
  @Column({ name: 'approved_at', type: 'datetime', nullable: true }) approvedAt!: Date | null
  @Column({ name: 'red_invoice_no', type: 'varchar', length: 80, nullable: true }) redInvoiceNo!: string | null
  /** 退货处理方式：REFUND=退款；EXCHANGE=换货 */
  @Column({ name: 'return_type', type: 'varchar', length: 24, default: 'REFUND' }) returnType!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('sale_return_line', { engine: 'InnoDB' })
@Index('idx_sale_return_line', ['tenantId', 'returnId'])
export class SaleReturnLineEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'return_id', type: 'bigint' }) returnId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ type: 'decimal', precision: 18, scale: 4 }) amount!: string
  @Column({ type: 'varchar', length: 24, default: 'RESTOCK' }) disposal!: string
  @Column({ name: 'qc_status', type: 'varchar', length: 24, default: 'PENDING' }) qcStatus!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('sale_price_agreement', { engine: 'InnoDB' })
@Index('idx_sale_price_agreement', ['tenantId', 'customerId', 'productId'])
export class SalePriceAgreementEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'customer_id', type: 'bigint' }) customerId!: number
  @Column({ name: 'product_id', type: 'bigint', nullable: true }) productId!: number | null
  @Column({ name: 'category_id', type: 'bigint', nullable: true }) categoryId!: number | null
  @Column({ type: 'decimal', precision: 18, scale: 4 }) price!: string
  @Column({ name: 'qty_step', type: 'decimal', precision: 18, scale: 3, default: 1 }) qtyStep!: string
  @Column({ name: 'start_date', type: 'date', nullable: true }) startDate!: string | null
  @Column({ name: 'end_date', type: 'date', nullable: true }) endDate!: string | null
  @Column({ type: 'varchar', length: 24, default: 'ENABLED' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('sale_target', { engine: 'InnoDB' })
@Index('idx_sale_target', ['tenantId', 'period', 'userId'])
export class SaleTargetEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 20 }) period!: string
  @Column({ name: 'org_id', type: 'bigint', nullable: true }) orgId!: number | null
  @Column({ name: 'user_id', type: 'bigint', nullable: true }) userId!: number | null
  @Column({ name: 'target_amount', type: 'decimal', precision: 18, scale: 4 }) targetAmount!: string
  @Column({ name: 'actual_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) actualAmount!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('crm_customer_merge_request', { engine: 'InnoDB' })
@Index('idx_customer_merge', ['tenantId', 'status'])
export class CustomerMergeRequestEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'from_customer_id', type: 'bigint' }) fromCustomerId!: number
  @Column({ name: 'to_customer_id', type: 'bigint' }) toCustomerId!: number
  @Column({ type: 'varchar', length: 500, nullable: true }) reason!: string | null
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'check_result', type: 'json', nullable: true }) checkResult!: Record<string, unknown> | null
  @Column({ name: 'approved_by', type: 'bigint', nullable: true }) approvedBy!: number | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('pos_hang_order', { engine: 'InnoDB' })
@Index('uk_pos_hang_key', ['tenantId', 'hangKey'], { unique: true })
export class PosHangOrderEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'hang_key', type: 'varchar', length: 100 }) hangKey!: string
  @Column({ name: 'store_id', type: 'bigint', nullable: true }) storeId!: number | null
  @Column({ name: 'customer_id', type: 'bigint', nullable: true }) customerId!: number | null
  @Column({ name: 'payload', type: 'json' }) payload!: Record<string, unknown>
  @Column({ type: 'varchar', length: 24, default: 'HUNG' }) status!: string
  @Column({ name: 'resumed_order_id', type: 'bigint', nullable: true }) resumedOrderId!: number | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('crm_customer_contact', { engine: 'InnoDB' })
@Index('idx_crm_customer_contact', ['tenantId', 'customerId'])
export class CrmCustomerContactEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'customer_id', type: 'bigint' }) customerId!: number
  @Column({ name: 'contact_name', type: 'varchar', length: 100 }) contactName!: string
  @Column({ name: 'contact_role', type: 'varchar', length: 60, nullable: true }) contactRole!: string | null
  @Column({ name: 'phone', type: 'varchar', length: 30, nullable: true }) phone!: string | null
  @Column({ name: 'email', type: 'varchar', length: 120, nullable: true }) email!: string | null
  @Column({ name: 'is_primary', type: 'tinyint', width: 1, default: 0 }) isPrimary!: number
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('crm_churn_warning', { engine: 'InnoDB' })
@Index('idx_crm_churn_warning', ['tenantId', 'customerId'])
export class CrmChurnWarningEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'customer_id', type: 'bigint' }) customerId!: number
  @Column({ name: 'customer_name', type: 'varchar', length: 150, nullable: true }) customerName!: string | null
  @Column({ type: 'varchar', length: 16, default: 'LOW' }) level!: string
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) score!: string
  @Column({ name: 'risk_detail', type: 'json', nullable: true }) riskDetail!: Record<string, unknown> | null
  @Column({ type: 'varchar', length: 24, default: 'OPEN' }) status!: string
  @Column({ name: 'handled_by', type: 'bigint', nullable: true }) handledBy!: number | null
  @Column({ name: 'handled_at', type: 'datetime', nullable: true }) handledAt!: Date | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('crm_quotation_version', { engine: 'InnoDB' })
@Index('idx_crm_quotation_version', ['tenantId', 'quotationId'])
export class CrmQuotationVersionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'quotation_id', type: 'bigint' }) quotationId!: number
  @Column({ type: 'int', default: 1 }) version!: number
  @Column({ name: 'total_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) totalAmount!: string
  @Column({ name: 'snapshot', type: 'json' }) snapshot!: Record<string, unknown>
  @Column({ name: 'change_reason', type: 'varchar', length: 500, nullable: true }) changeReason!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('pos_member_price', { engine: 'InnoDB' })
@Index('idx_pos_member_price', ['tenantId', 'customerId', 'productId'])
export class PosMemberPriceEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'customer_id', type: 'bigint' }) customerId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'member_level', type: 'varchar', length: 24, default: 'NORMAL' }) memberLevel!: string
  @Column({ type: 'decimal', precision: 18, scale: 4 }) price!: string
  @Column({ name: 'effective_date', type: 'date', nullable: true }) effectiveDate!: string | null
  @Column({ name: 'expire_date', type: 'date', nullable: true }) expireDate!: string | null
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('pos_payment_record', { engine: 'InnoDB' })
@Index('idx_pos_payment_record', ['tenantId', 'orderId'])
export class PosPaymentRecordEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'order_id', type: 'bigint' }) orderId!: number
  @Column({ name: 'pay_type', type: 'varchar', length: 24 }) payType!: string
  @Column({ type: 'decimal', precision: 18, scale: 4 }) amount!: string
  @Column({ name: 'trade_no', type: 'varchar', length: 80, nullable: true }) tradeNo!: string | null
  @Column({ type: 'varchar', length: 24, default: 'SUCCESS' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('sale_red_invoice', { engine: 'InnoDB' })
@Index('idx_sale_red_invoice', ['tenantId', 'returnId'])
export class SaleRedInvoiceEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'return_id', type: 'bigint', nullable: true }) returnId!: number | null
  @Column({ name: 'origin_invoice_no', type: 'varchar', length: 80, nullable: true }) originInvoiceNo!: string | null
  @Column({ name: 'invoice_no', type: 'varchar', length: 80 }) invoiceNo!: string
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) amount!: string
  @Column({ name: 'tax_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) taxAmount!: string
  @Column({ type: 'varchar', length: 24, default: 'RED' }) invoiceType!: string
  @Column({ name: 'reason', type: 'varchar', length: 300, nullable: true }) reason!: string | null
  @Column({ type: 'varchar', length: 24, default: 'ISSUED' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
