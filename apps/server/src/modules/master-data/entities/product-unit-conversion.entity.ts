import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('md_product_unit_conversion', { engine: 'InnoDB' })
@Index('uk_md_puc_product_unit', ['tenantId', 'productId', 'unitId'], { unique: true })
@Index('idx_md_puc_product', ['tenantId', 'productId'])
export class ProductUnitConversionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'product_id', type: 'bigint' })
  productId!: number

  @Column({ name: 'unit_id', type: 'bigint' })
  unitId!: number

  /** 换算率：1 个该单位折合多少个基准单位 */
  @Column({ name: 'conversion_rate', type: 'decimal', precision: 18, scale: 6, default: 1 })
  conversionRate!: string

  @Column({ name: 'is_base', type: 'tinyint', width: 1, default: 0 })
  isBase!: number

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: string | null

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: number | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'datetime', nullable: true })
  updatedAt!: Date | null
}
