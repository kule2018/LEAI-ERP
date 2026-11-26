import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('warehouse', { engine: 'InnoDB' })
@Index('uk_warehouse_code', ['tenantId', 'warehouseCode'], { unique: true })
export class WarehouseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'warehouse_code', type: 'varchar', length: 50 })
  warehouseCode!: string

  @Column({ name: 'warehouse_name', type: 'varchar', length: 100 })
  warehouseName!: string

  @Column({ name: 'org_id', type: 'bigint', nullable: true })
  orgId!: number | null

  @Column({ type: 'varchar', length: 300, nullable: true })
  address!: string | null

  @Column({ type: 'varchar', length: 50, nullable: true })
  manager!: string | null

  @Column({ name: 'is_default', type: 'tinyint', width: 1, default: 0 })
  isDefault!: number

  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' })
  status!: string

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
