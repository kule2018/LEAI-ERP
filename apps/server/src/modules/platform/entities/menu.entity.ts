import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('sys_menu', { engine: 'InnoDB' })
@Index('uk_sys_menu_route', ['tenantId', 'routePath'], { unique: true })
export class MenuEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'parent_id', type: 'bigint', nullable: true })
  parentId!: number | null

  @Column({ name: 'menu_name', type: 'varchar', length: 128 })
  menuName!: string

  @Column({ name: 'route_path', type: 'varchar', length: 200 })
  routePath!: string

  @Column({ name: 'component_path', type: 'varchar', length: 200, nullable: true })
  componentPath!: string | null

  @Column({ type: 'varchar', length: 64, nullable: true })
  icon!: string | null

  @Column({ name: 'perm_code', type: 'varchar', length: 100, nullable: true })
  permCode!: string | null

  @Column({ name: 'sort_no', type: 'int', default: 0 })
  sortNo!: number

  @Column({ type: 'tinyint', width: 1, default: 0 })
  hidden!: number

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
