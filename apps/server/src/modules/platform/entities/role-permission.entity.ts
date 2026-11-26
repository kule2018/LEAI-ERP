import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('sys_role_permission', { engine: 'InnoDB' })
@Index('uk_sys_role_permission', ['tenantId', 'roleId', 'permissionId'], { unique: true })
export class RolePermissionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'role_id', type: 'bigint' })
  roleId!: number

  @Column({ name: 'permission_id', type: 'bigint' })
  permissionId!: number

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date
}
