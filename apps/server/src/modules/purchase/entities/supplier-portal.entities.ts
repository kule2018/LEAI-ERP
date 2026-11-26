import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * 供应商门户独立账号：外部供应商人员使用的登录身份，
 * 与内部 sys_user 完全隔离，绑定唯一供应商主体。
 */
@Entity('supplier_portal_user', { engine: 'InnoDB' })
@Index('uk_supplier_portal_user', ['tenantId', 'username'], { unique: true })
@Index('idx_supplier_portal_user_supplier', ['tenantId', 'supplierId'])
export class SupplierPortalUserEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number

  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number

  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: number

  @Column({ type: 'varchar', length: 60 }) username!: string

  @Column({ name: 'password_hash', type: 'varchar', length: 200 }) passwordHash!: string

  @Column({ name: 'display_name', type: 'varchar', length: 100 }) displayName!: string

  @Column({ type: 'varchar', length: 30, nullable: true }) phone!: string | null

  @Column({ type: 'varchar', length: 120, nullable: true }) email!: string | null

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' }) status!: string

  @Column({ name: 'failed_login_count', type: 'int', default: 0 }) failedLoginCount!: number

  @Column({ name: 'lock_until', type: 'datetime', nullable: true }) lockUntil!: Date | null

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true }) lastLoginAt!: Date | null

  @Column({ name: 'password_updated_at', type: 'datetime', nullable: true }) passwordUpdatedAt!: Date | null

  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date

  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) updatedAt!: Date
}
