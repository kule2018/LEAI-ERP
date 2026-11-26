import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * 导出任务：异步导出的持久化载体。
 * 任务由 BullMQ 队列消费（Redis 不可用时降级为进程内异步执行），
 * 生成结果写入 content 字段，前端通过 content 接口下载。
 */
@Entity('export_task', { engine: 'InnoDB' })
@Index('idx_export_task_tenant', ['tenantId', 'id'])
export class ExportTaskEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  /** 资源代码（customer/product/...） */
  @Column({ type: 'varchar', length: 64 })
  code!: string

  @Column({ name: 'biz_type', type: 'varchar', length: 64, nullable: true })
  bizType!: string | null

  /** PENDING / RUNNING / DONE / FAILED */
  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status!: string

  @Column({ type: 'json', nullable: true })
  params!: Record<string, unknown> | null

  @Column({ name: 'file_name', type: 'varchar', length: 200, nullable: true })
  fileName!: string | null

  @Column({ type: 'longtext', nullable: true })
  content!: string | null

  @Column({ name: 'row_count', type: 'int', default: 0 })
  rowCount!: number

  @Column({ name: 'result_url', type: 'varchar', length: 500, nullable: true })
  resultUrl!: string | null

  @Column({ name: 'error_message', type: 'varchar', length: 1000, nullable: true })
  errorMessage!: string | null

  @Column({ name: 'queue_job_id', type: 'varchar', length: 64, nullable: true })
  queueJobId!: string | null

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: number | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'started_at', type: 'datetime', nullable: true })
  startedAt!: Date | null

  @Column({ name: 'finished_at', type: 'datetime', nullable: true })
  finishedAt!: Date | null
}
