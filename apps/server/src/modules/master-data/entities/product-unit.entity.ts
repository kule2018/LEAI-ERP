import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('product_unit', { engine: 'InnoDB' })
@Index('uk_product_unit_code', ['tenantId', 'unitCode'], { unique: true })
export class ProductUnitEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'unit_code', type: 'varchar', length: 20 })
  unitCode!: string

  @Column({ name: 'unit_name', type: 'varchar', length: 50 })
  unitName!: string

  @Column({ type: 'int', default: 3 })
  precision!: number

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
