import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** 越库直发单：供应商到货直接转发给客户，不入库 */
@Entity('po_crossdock', { engine: 'InnoDB' })
@Index('idx_po_crossdock', ['tenantId', 'status'])
export class CrossDockEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'crossdock_no', type: 'varchar', length: 60 }) crossdockNo!: string
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: number
  @Column({ name: 'customer_id', type: 'bigint', nullable: true }) customerId!: number | null
  @Column({ name: 'purchase_order_id', type: 'bigint', nullable: true }) purchaseOrderId!: number | null
  @Column({ name: 'sale_order_id', type: 'bigint', nullable: true }) saleOrderId!: number | null
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ name: 'warehouse_id', type: 'bigint', nullable: true }) warehouseId!: number | null
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ type: 'varchar', length: 300, nullable: true }) remark!: string | null
  @Column({ name: 'completed_at', type: 'datetime', nullable: true }) completedAt!: Date | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 供应商罚款单 */
@Entity('po_supplier_fine', { engine: 'InnoDB' })
@Index('idx_po_supplier_fine', ['tenantId', 'supplierId'])
export class SupplierFineEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'fine_no', type: 'varchar', length: 60 }) fineNo!: string
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: number
  @Column({ name: 'purchase_order_id', type: 'bigint', nullable: true }) purchaseOrderId!: number | null
  @Column({ name: 'fine_type', type: 'varchar', length: 24 }) fineType!: string
  @Column({ type: 'decimal', precision: 18, scale: 4 }) amount!: string
  @Column({ name: 'deducted_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) deductedAmount!: string
  @Column({ type: 'varchar', length: 500, nullable: true }) reason!: string | null
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'approved_by', type: 'bigint', nullable: true }) approvedBy!: number | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
