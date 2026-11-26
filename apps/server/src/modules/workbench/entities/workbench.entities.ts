import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** KPI 角色可见性配置 */
@Entity('sys_workbench_kpi', { engine: 'InnoDB' })
@Index('uk_workbench_kpi', ['tenantId', 'code'], { unique: true })
export class WorkbenchKpiEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 48 }) code!: string
  @Column({ type: 'varchar', length: 80 }) name!: string
  @Column({ type: 'varchar', length: 24 }) source!: string
  @Column({ type: 'json', nullable: true }) roles!: string[] | null
  @Column({ name: 'sort_no', type: 'int', default: 0 }) sortNo!: number
  @Column({ type: 'tinyint', width: 1, default: 1 }) enabled!: number
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 订阅推送配置 */
@Entity('sys_workbench_subscription', { engine: 'InnoDB' })
@Index('uk_workbench_subscription', ['tenantId', 'userId', 'resource'], { unique: true })
export class WorkbenchSubscriptionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'user_id', type: 'bigint' }) userId!: number
  @Column({ type: 'varchar', length: 40 }) resource!: string
  @Column({ type: 'varchar', length: 16, default: 'DAILY' }) frequency!: string
  @Column({ type: 'varchar', length: 24, default: 'INBOX' }) channel!: string
  @Column({ type: 'tinyint', width: 1, default: 1 }) enabled!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 经营简报：模板 + 数据快照 + AI 摘要 + 阅读确认 */
@Entity('sys_workbench_briefing', { engine: 'InnoDB' })
@Index('idx_workbench_briefing', ['tenantId', 'period'])
export class WorkbenchBriefingEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 16 }) type!: string
  @Column({ type: 'varchar', length: 24 }) period!: string
  @Column({ type: 'varchar', length: 120 }) title!: string
  @Column({ type: 'varchar', length: 40, nullable: true }) template!: string | null
  @Column({ type: 'json', nullable: true }) snapshot!: Record<string, unknown> | null
  @Column({ type: 'text', nullable: true }) summary!: string | null
  @Column({ name: 'source_refs', type: 'json', nullable: true }) sourceRefs!: string[] | null
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'pdf_content', type: 'text', nullable: true }) pdfContent!: string | null
  @Column({ name: 'read_by', type: 'json', nullable: true }) readBy!: number[] | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
