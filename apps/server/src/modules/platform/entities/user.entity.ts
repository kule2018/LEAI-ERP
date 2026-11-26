import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('sys_user', { engine: 'InnoDB' })
@Index('uk_sys_user_username', ['tenantId', 'username'], { unique: true })
@Index('idx_sys_user_tenant_deleted', ['tenantId', 'isDeleted'])
export class UserEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ type: 'varchar', length: 64 })
  username!: string

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string

  /** 是否强制下次登录修改密码 */
  @Column({ name: 'must_change_password', type: 'tinyint', width: 1, default: 0 })
  mustChangePassword!: number

  @Column({ name: 'password_updated_at', type: 'datetime', nullable: true })
  passwordUpdatedAt!: Date | null

  @Column({ name: 'real_name', type: 'varchar', length: 64 })
  realName!: string

  @Column({ name: 'dept_id', type: 'bigint', nullable: true })
  deptId!: number | null

  @Column({ name: 'org_id', type: 'bigint', nullable: true })
  orgId!: number | null

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobile!: string | null

  @Column({ type: 'varchar', length: 120, nullable: true })
  email!: string | null

  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' })
  status!: string

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: number | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'updated_by', type: 'bigint', nullable: true })
  updatedBy!: number | null

  @Column({ name: 'updated_at', type: 'datetime', nullable: true })
  updatedAt!: Date | null

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark!: string | null
}
