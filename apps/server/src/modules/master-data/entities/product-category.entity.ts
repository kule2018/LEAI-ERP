import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('product_category', { engine: 'InnoDB' })
@Index('uk_product_category_code', ['tenantId', 'categoryCode'], { unique: true })
export class ProductCategoryEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'category_code', type: 'varchar', length: 50 })
  categoryCode!: string

  @Column({ name: 'category_name', type: 'varchar', length: 100 })
  categoryName!: string

  @Column({ name: 'parent_id', type: 'bigint', nullable: true })
  parentId!: number | null

  @Column({ name: 'sort_no', type: 'int', default: 0 })
  sortNo!: number

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
