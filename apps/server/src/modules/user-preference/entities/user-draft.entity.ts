import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * 用户草稿：保存列表页/表单页未提交的内容，
 * 便于浏览器崩溃、切换设备后继续编辑。
 */
@Entity('user_draft', { engine: 'InnoDB' })
@Index('idx_user_draft', ['tenantId', 'userId', 'draftKey'], { unique: true })
export class UserDraftEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: number

  /** 草稿键：建议为 页面标识:业务标识 */
  @Column({ name: 'draft_key', type: 'varchar', length: 160 })
  draftKey!: string

  /** 草稿内容（JSON） */
  @Column({ type: 'json', nullable: true })
  content!: Record<string, unknown> | null

  @Column({ name: 'updated_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  updatedAt!: Date

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date
}
