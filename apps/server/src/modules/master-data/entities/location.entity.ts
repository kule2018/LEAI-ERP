import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('location', { engine: 'InnoDB' })
@Index('uk_location_code', ['tenantId', 'warehouseId', 'locationCode'], { unique: true })
export class LocationEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'warehouse_id', type: 'bigint' })
  warehouseId!: number

  @Column({ name: 'location_code', type: 'varchar', length: 50 })
  locationCode!: string

  @Column({ name: 'location_name', type: 'varchar', length: 100, nullable: true })
  locationName!: string | null

  @Column({ name: 'zone_code', type: 'varchar', length: 50, nullable: true })
  zoneCode!: string | null

  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' })
  status!: string

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
