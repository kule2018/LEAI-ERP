import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('product_variant', { engine: 'InnoDB' })
@Index('uk_product_variant_sku', ['tenantId', 'skuCode'], { unique: true })
@Index('idx_product_variant_product', ['tenantId', 'productId'])
export class ProductVariantEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'product_id', type: 'bigint' })
  productId!: number

  @Column({ name: 'sku_code', type: 'varchar', length: 80 })
  skuCode!: string

  @Column({ type: 'json', nullable: true })
  attributes!: Record<string, string> | null

  @Column({ name: 'barcode', type: 'varchar', length: 100, nullable: true })
  barcode!: string | null

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  cost!: string

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  price!: string

  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl!: string | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
