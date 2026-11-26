import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('product_brand', { engine: 'InnoDB' })
@Index('uk_product_brand_code', ['tenantId', 'brandCode'], { unique: true })
export class ProductBrandEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'brand_code', type: 'varchar', length: 50 })
  brandCode!: string

  @Column({ name: 'brand_name', type: 'varchar', length: 100 })
  brandName!: string

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
