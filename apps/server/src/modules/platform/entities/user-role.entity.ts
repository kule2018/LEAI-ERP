import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('sys_user_role', { engine: 'InnoDB' })
@Index('uk_sys_user_role', ['tenantId', 'userId', 'roleId'], { unique: true })
export class UserRoleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: number

  @Column({ name: 'role_id', type: 'bigint' })
  roleId!: number

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date
}
