import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('sys_tenant', { engine: 'InnoDB' })
@Index('uk_sys_tenant_code', ['tenantCode'], { unique: true })
export class TenantEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_code', type: 'varchar', length: 64 })
  tenantCode!: string

  @Column({ name: 'tenant_name', type: 'varchar', length: 128 })
  tenantName!: string

  @Column({ name: 'default_org_id', type: 'bigint', nullable: true })
  defaultOrgId!: number | null

  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' })
  status!: string

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'datetime', nullable: true })
  updatedAt!: Date | null

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
