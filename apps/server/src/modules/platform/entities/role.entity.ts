import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import type { DataScopeLevel } from '../../../common/contracts'

@Entity('sys_role', { engine: 'InnoDB' })
@Index('uk_sys_role_code', ['tenantId', 'roleCode'], { unique: true })
export class RoleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'role_code', type: 'varchar', length: 64 })
  roleCode!: string

  @Column({ name: 'role_name', type: 'varchar', length: 128 })
  roleName!: string

  @Column({ name: 'data_scope_level', type: 'varchar', length: 24, default: 'SELF' })
  dataScopeLevel!: DataScopeLevel

  @Column({ name: 'parent_id', type: 'bigint', nullable: true }) parentId!: number | null

  @Column({ name: 'sort_no', type: 'int', default: 0 })
  sortNo!: number

  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' })
  status!: string

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'datetime', nullable: true })
  updatedAt!: Date | null

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null
}
