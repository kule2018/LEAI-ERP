import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * 快捷搜索历史：记录用户在全局搜索框中输入过的关键词，
 * 支持按关键词去重计数、最近使用排序与历史清空。
 */
@Entity('quick_search_log', { engine: 'InnoDB' })
@Index('idx_quick_search_log', ['tenantId', 'userId', 'keyword'], { unique: true })
export class QuickSearchLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'user_id', type: 'bigint' })
  userId!: number

  @Column({ type: 'varchar', length: 128 })
  keyword!: string

  /** 命中次数 */
  @Column({ type: 'int', default: 1 })
  count!: number

  @Column({ name: 'last_used_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  lastUsedAt!: Date

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date
}
