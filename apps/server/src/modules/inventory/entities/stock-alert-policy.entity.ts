import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** 库存预警策略：临期阈值、安全库存、呆滞天数 */
@Entity('md_stock_alert_policy', { engine: 'InnoDB' })
@Index('uk_md_stock_alert_policy', ['tenantId', 'productId', 'warehouseId'], { unique: true })
export class StockAlertPolicyEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  /** 0 表示全局默认策略 */
  @Column({ name: 'product_id', type: 'bigint', default: 0 }) productId!: number
  /** 0 表示全部仓库 */
  @Column({ name: 'warehouse_id', type: 'bigint', default: 0 }) warehouseId!: number
  @Column({ name: 'warn_days', type: 'int', default: 30 }) warnDays!: number
  @Column({ name: 'urgent_days', type: 'int', default: 7 }) urgentDays!: number
  /** 安全库存，0 表示不启用 */
  @Column({ name: 'safety_stock', type: 'decimal', precision: 18, scale: 4, default: 0 }) safetyStock!: string
  /** 呆滞库存天数阈值，0 表示不启用 */
  @Column({ name: 'slow_moving_days', type: 'int', default: 0 }) slowMovingDays!: number
  @Column({ type: 'varchar', length: 24, default: 'ENABLED' }) status!: string
  @Column({ type: 'varchar', length: 255, nullable: true }) remark!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) updatedAt!: Date
}
