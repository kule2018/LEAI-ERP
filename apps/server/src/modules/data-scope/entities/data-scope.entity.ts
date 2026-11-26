import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import type { DataScopeLevel } from '../../../common/contracts'

@Entity('sys_data_scope', { engine: 'InnoDB' })
@Index('uk_sys_data_scope_code', ['tenantId', 'scopeCode'], { unique: true })
export class DataScopeEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'scope_code', type: 'varchar', length: 50 })
  scopeCode!: string

  @Column({ name: 'scope_name', type: 'varchar', length: 100 })
  scopeName!: string

  @Column({ name: 'biz_type', type: 'varchar', length: 64, default: 'ALL' })
  bizType!: string

  @Column({ name: 'org_field', type: 'varchar', length: 64, default: 'dept_id' })
  orgField!: string

  @Column({ name: 'scope_level', type: 'varchar', length: 24 })
  scopeLevel!: DataScopeLevel

  @Column({ type: 'int', default: 0 })
  priority!: number

  @Column({ type: 'varchar', length: 24, default: 'ENABLED' })
  status!: string

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: number | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
