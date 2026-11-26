import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/**
 * 导入错误行明细：记录每次导入校验未通过的行内容与错误原因，
 * 支持事后下载错误报告与"只导入正确行"的重试。
 */
@Entity('io_import_error', { engine: 'InnoDB' })
@Index('idx_io_import_error', ['tenantId', 'code', 'batchNo'])
export class IoImportErrorEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  /** 导入资源代码（customer / product 等） */
  @Column({ type: 'varchar', length: 50 })
  code!: string

  /** 导入批次号：同一次导入共享 */
  @Column({ name: 'batch_no', type: 'varchar', length: 64 })
  batchNo!: string

  /** CSV 行号（含表头，从 2 开始） */
  @Column({ name: 'row_no', type: 'int' })
  rowNo!: number

  /** 出错列名 */
  @Column({ name: 'field_name', type: 'varchar', length: 120, nullable: true })
  fieldName!: string | null

  /** 错误原因 */
  @Column({ name: 'message', type: 'varchar', length: 500 })
  message!: string

  /** 原始行数据（JSON） */
  @Column({ name: 'row_data', type: 'json', nullable: true })
  rowData!: Record<string, string> | null

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: number | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date
}
