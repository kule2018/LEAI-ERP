import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * 用户视图配置：保存列表页的列显示、排序、筛选与分页偏好，
 * 使不同用户在同一页面上看到各自习惯的视图。
 */
@Entity('user_view_config', { engine: 'InnoDB' })
@Index('idx_user_view_config', ['tenantId', 'userId', 'pageKey'], { unique: true })
export class UserViewConfigEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: number

  @Column({ name: 'page_key', type: 'varchar', length: 128 })
  pageKey!: string

  @Column({ type: 'json' })
  config!: Record<string, unknown>

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  updatedAt!: Date
}
