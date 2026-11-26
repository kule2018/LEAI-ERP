import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** 生产退料单主表 */
@Entity('mes_material_return', { engine: 'InnoDB' })
@Index('idx_mes_material_return', ['tenantId', 'status'])
@Index('idx_mes_material_return_order', ['tenantId', 'workOrderId'])
export class MesMaterialReturnEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'return_no', type: 'varchar', length: 60 }) returnNo!: string
  @Column({ name: 'work_order_id', type: 'bigint' }) workOrderId!: number
  @Column({ name: 'warehouse_id', type: 'bigint', nullable: true }) warehouseId!: number | null
  /** DRAFT 草稿 / POSTED 已过账 / CANCELLED 已作废 */
  @Column({ type: 'varchar', length: 16, default: 'DRAFT' }) status!: string
  @Column({ name: 'total_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) totalQty!: string
  @Column({ type: 'varchar', length: 500, nullable: true }) reason!: string | null
  @Column({ name: 'posted_at', type: 'datetime', nullable: true }) postedAt!: Date | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 生产退料单行 */
@Entity('mes_material_return_line', { engine: 'InnoDB' })
@Index('idx_mes_material_return_line', ['tenantId', 'returnId'])
export class MesMaterialReturnLineEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'return_id', type: 'bigint' }) returnId!: number
  @Column({ name: 'material_id', type: 'bigint' }) materialId!: number
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ name: 'batch_no', type: 'varchar', length: 60, nullable: true }) batchNo!: string | null
  @Column({ type: 'varchar', length: 300, nullable: true }) remark!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
