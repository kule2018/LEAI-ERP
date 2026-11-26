import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'
import type { RevisionDiffEntry } from '../../../common/revision-engine'

/**
 * 通用单据版本快照：任意业务单据在关键节点（提交、变更、审批发起等）
 * 留存一份完整快照，并自动记录与上一版本的差异。
 */
@Entity('revision_snapshot', { engine: 'InnoDB' })
@Index('idx_revision_target', ['tenantId', 'entityCode', 'bizId', 'versionNo'])
export class RevisionSnapshotEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'entity_code', type: 'varchar', length: 64 })
  entityCode!: string

  @Column({ name: 'biz_id', type: 'bigint' })
  bizId!: number

  @Column({ name: 'version_no', type: 'int', default: 1 })
  versionNo!: number

  @Column({ type: 'varchar', length: 32, default: 'SNAPSHOT' })
  action!: string

  @Column({ type: 'json' })
  snapshot!: Record<string, unknown>

  @Column({ type: 'json', nullable: true })
  diff!: RevisionDiffEntry[] | null

  @Column({ name: 'operator_id', type: 'bigint', default: 0 })
  operatorId!: number

  @Column({ name: 'operator_name', type: 'varchar', length: 64, nullable: true })
  operatorName!: string | null

  @Column({ type: 'varchar', length: 32, default: 'SYSTEM' })
  source!: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: string | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date
}
