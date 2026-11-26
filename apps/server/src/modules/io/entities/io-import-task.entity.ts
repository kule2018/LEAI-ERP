import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** 导入批次任务：登记每次导入的处理结果，便于查询批次状态与错误报告 */
@Entity('io_import_task', { engine: 'InnoDB' })
@Index('idx_io_import_task', ['tenantId', 'code', 'id'])
export class IoImportTaskEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  /** 导入资源代码（customer / product 等） */
  @Column({ type: 'varchar', length: 50 })
  code!: string

  /** 导入批次号 */
  @Column({ name: 'batch_no', type: 'varchar', length: 64 })
  batchNo!: string

  /** RUNNING / SUCCESS / PARTIAL / FAILED */
  @Column({ type: 'varchar', length: 24, default: 'RUNNING' })
  status!: string

  @Column({ name: 'total_rows', type: 'int', default: 0 })
  totalRows!: number

  @Column({ name: 'imported_rows', type: 'int', default: 0 })
  importedRows!: number

  @Column({ name: 'skipped_rows', type: 'int', default: 0 })
  skippedRows!: number

  @Column({ name: 'error_rows', type: 'int', default: 0 })
  errorRows!: number

  /** STRICT：整批校验；SKIP_INVALID：只导入正确行 */
  @Column({ type: 'varchar', length: 24, default: 'STRICT' })
  mode!: string

  @Column({ name: 'error_message', type: 'varchar', length: 1000, nullable: true })
  errorMessage!: string | null

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: number | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'finished_at', type: 'datetime', nullable: true })
  finishedAt!: Date | null
}
