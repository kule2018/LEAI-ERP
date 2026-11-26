import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * 库存出入库单：支持多类型（采购入库、销售出库、生产领料、调拨、退货、调整等）、
 * 暂估成本、冲销、附件与打印。
 */
@Entity('stock_io_document', { engine: 'InnoDB' })
@Index('uk_stock_io_document_no', ['tenantId', 'docNo'], { unique: true })
@Index('idx_stock_io_document_status', ['tenantId', 'status'])
@Index('idx_stock_io_document_source', ['tenantId', 'sourceType', 'sourceId'])
export class StockIoDocumentEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  /** 单据号 */
  @Column({ name: 'doc_no', type: 'varchar', length: 40 }) docNo!: string
  /** 单据类型，见 IO_TYPE_META */
  @Column({ name: 'io_type', type: 'varchar', length: 32 }) ioType!: string
  /** 单据方向 IN / OUT */
  @Column({ type: 'varchar', length: 8 }) direction!: string
  /** 来源单据类型 */
  @Column({ name: 'source_type', type: 'varchar', length: 40, default: '' }) sourceType!: string
  /** 来源单据 ID */
  @Column({ name: 'source_id', type: 'bigint', default: 0 }) sourceId!: number
  /** 仓库 */
  @Column({ name: 'warehouse_id', type: 'bigint' }) warehouseId!: number
  /** DRAFT 草稿 / POSTED 已过账 / REVERSED 已冲销 */
  @Column({ type: 'varchar', length: 20, default: 'DRAFT' }) status!: string
  /** 暂估总金额 */
  @Column({ name: 'provisional_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) provisionalAmount!: string
  /** 正式成本总金额 */
  @Column({ name: 'cost_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) costAmount!: string
  /** 冲销的原单 ID */
  @Column({ name: 'reversal_of_id', type: 'bigint', default: 0 }) reversalOfId!: number
  /** 冲销原因 */
  @Column({ name: 'reversal_reason', type: 'varchar', length: 300, nullable: true }) reversalReason!: string | null
  @Column({ name: 'doc_date', type: 'date', nullable: true }) docDate!: string | null
  @Column({ type: 'varchar', length: 300, nullable: true }) remark!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'posted_by', type: 'bigint', nullable: true }) postedBy!: number | null
  @Column({ name: 'posted_at', type: 'datetime', nullable: true }) postedAt!: Date | null
  @Column({ name: 'reversed_by', type: 'bigint', nullable: true }) reversedBy!: number | null
  @Column({ name: 'reversed_at', type: 'datetime', nullable: true }) reversedAt!: Date | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) updatedAt!: Date
}

/** 出入库单明细 */
@Entity('stock_io_line', { engine: 'InnoDB' })
@Index('idx_stock_io_line_doc', ['tenantId', 'docId'])
export class StockIoLineEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'doc_id', type: 'bigint' }) docId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ name: 'variant_id', type: 'bigint', default: 0 }) variantId!: number
  @Column({ name: 'location_id', type: 'bigint', default: 0 }) locationId!: number
  @Column({ name: 'batch_no', type: 'varchar', length: 60, default: '' }) batchNo!: string
  /** 入库数量 */
  @Column({ name: 'qty_in', type: 'decimal', precision: 18, scale: 3, default: 0 }) qtyIn!: string
  /** 出库数量 */
  @Column({ name: 'qty_out', type: 'decimal', precision: 18, scale: 3, default: 0 }) qtyOut!: string
  /** 单位成本（暂估行记录暂估单价） */
  @Column({ name: 'unit_cost', type: 'decimal', precision: 18, scale: 4, default: 0 }) unitCost!: string
  /** 金额 */
  @Column({ name: 'amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) amount!: string
  /** 是否暂估行 */
  @Column({ name: 'is_provisional', type: 'tinyint', width: 1, default: 0 }) isProvisional!: number
  @Column({ type: 'varchar', length: 300, nullable: true }) remark!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 出入库单附件 */
@Entity('stock_io_attachment', { engine: 'InnoDB' })
@Index('idx_stock_io_attachment_doc', ['tenantId', 'docId'])
export class StockIoAttachmentEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'doc_id', type: 'bigint' }) docId!: number
  @Column({ name: 'file_name', type: 'varchar', length: 200 }) fileName!: string
  @Column({ name: 'file_url', type: 'varchar', length: 500, default: '' }) fileUrl!: string
  @Column({ name: 'file_size', type: 'bigint', default: 0 }) fileSize!: number
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
