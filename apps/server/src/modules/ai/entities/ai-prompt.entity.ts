import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('ai_prompt', { engine: 'InnoDB' })
@Index('uk_ai_prompt_code_version', ['tenantId', 'code', 'version'], { unique: true })
export class AiPromptEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ type: 'varchar', length: 64 })
  code!: string

  @Column({ type: 'varchar', length: 100 })
  name!: string

  @Column({ type: 'text' })
  content!: string

  @Column({ type: 'varchar', length: 64, nullable: true })
  model!: string | null

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.2 })
  temperature!: string

  @Column({ type: 'int', default: 1 })
  version!: number

  /** 版本状态：DRAFT 草稿 / PUBLISHED 已发布 / ARCHIVED 已归档 */
  @Column({ type: 'varchar', length: 24, default: 'PUBLISHED' })
  status!: string

  /** 上一版本 ID，用于版本链与回滚追溯 */
  @Column({ name: 'parent_id', type: 'bigint', nullable: true })
  parentId!: number | null

  @Column({ name: 'published_at', type: 'datetime', nullable: true })
  publishedAt!: Date | null

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: number

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: number | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'updated_at', type: 'datetime', nullable: true })
  updatedAt!: Date | null

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
