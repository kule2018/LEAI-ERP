import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('sys_permission', { engine: 'InnoDB' })
@Index('uk_sys_permission_code', ['permCode'], { unique: true })
export class PermissionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint', default: 0 })
  tenantId!: number

  @Column({ name: 'perm_code', type: 'varchar', length: 100 })
  permCode!: string

  @Column({ name: 'perm_name', type: 'varchar', length: 128 })
  permName!: string

  @Column({ name: 'perm_type', type: 'varchar', length: 24 })
  permType!: string

  @Column({ name: 'parent_id', type: 'bigint', nullable: true })
  parentId!: number | null

  @Column({ name: 'sort_no', type: 'int', default: 0 })
  sortNo!: number

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'datetime', nullable: true })
  updatedAt!: Date | null

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
