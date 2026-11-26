import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * 用户收藏：收藏菜单、页面或业务记录，便于个人快速访问。
 */
@Entity('user_favorite', { engine: 'InnoDB' })
@Index('idx_user_favorite', ['tenantId', 'userId', 'targetType', 'targetKey'], { unique: true })
export class UserFavoriteEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: number

  @Column({ name: 'target_type', type: 'varchar', length: 24, default: 'PAGE' })
  targetType!: string

  @Column({ name: 'target_key', type: 'varchar', length: 128 })
  targetKey!: string

  @Column({ type: 'varchar', length: 128 })
  title!: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  route!: string | null

  @Column({ name: 'biz_type', type: 'varchar', length: 64, nullable: true })
  bizType!: string | null

  @Column({ name: 'biz_id', type: 'bigint', nullable: true })
  bizId!: number | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: string | null

  @Column({ name: 'sort_no', type: 'int', default: 0 })
  sortNo!: number

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date
}
