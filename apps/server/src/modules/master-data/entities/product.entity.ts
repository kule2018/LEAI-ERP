import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('product', { engine: 'InnoDB' })
@Index('uk_product_code', ['tenantId', 'productCode'], { unique: true })
export class ProductEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'product_code', type: 'varchar', length: 50 })
  productCode!: string

  @Column({ name: 'product_name', type: 'varchar', length: 150 })
  productName!: string

  @Column({ name: 'barcode', type: 'varchar', length: 100, nullable: true })
  barcode!: string | null

  @Column({ name: 'category_id', type: 'bigint', nullable: true })
  categoryId!: number | null

  @Column({ name: 'brand_id', type: 'bigint', nullable: true })
  brandId!: number | null

  @Column({ name: 'unit_id', type: 'bigint', nullable: true })
  unitId!: number | null

  @Column({ name: 'product_type', type: 'varchar', length: 24, default: 'STANDARD' })
  productType!: string

  @Column({ name: 'tracking_type', type: 'varchar', length: 24, default: 'NONE' })
  trackingType!: string

  /** 成本核算方法：MOVING_WEIGHTED 移动加权平均 / FIFO 先进先出 / BATCH 分批实际成本 */
  @Column({ name: 'costing_method', type: 'varchar', length: 24, default: 'MOVING_WEIGHTED' })
  costingMethod!: string

  /** 产品属性（JSON），用于颜色/材质/规格等非标维度 */
  @Column({ type: 'json', nullable: true })
  attributes!: Record<string, unknown> | null

  /** 默认仓库：出库与盘点默认落库位置 */
  @Column({ name: 'default_warehouse_id', type: 'bigint', nullable: true })
  defaultWarehouseId!: number | null

  /** 默认库位：上架与拣货默认落位 */
  @Column({ name: 'default_location_id', type: 'bigint', nullable: true })
  defaultLocationId!: number | null

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  cost!: string

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  price!: string

  /** 最低销售价（底价）：开单低于底价需具备价格权限，否则禁止提交 */
  @Column({ name: 'floor_price', type: 'decimal', precision: 18, scale: 4, default: 0 })
  floorPrice!: string

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl!: string | null

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: number

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: number | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy!: number | null

  @Column({ name: 'updated_at', type: 'datetime', nullable: true })
  updatedAt!: Date | null

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null
}
