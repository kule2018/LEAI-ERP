import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('print_record', { engine: 'InnoDB' })
@Index('idx_print_record_biz', ['tenantId', 'bizType', 'bizId'])
export class PrintRecordEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'biz_type', type: 'varchar', length: 64 })
  bizType!: string

  @Column({ name: 'biz_id', type: 'bigint' })
  bizId!: number

  @Column({ name: 'biz_no', type: 'varchar', length: 64, nullable: true })
  bizNo!: string | null

  @Column({ name: 'template_id', type: 'bigint' })
  templateId!: number

  @Column({ name: 'template_code', type: 'varchar', length: 64 })
  templateCode!: string

  @Column({ name: 'reprint_of', type: 'bigint', nullable: true })
  reprintOf!: number | null

  @Column({ type: 'int', default: 1 })
  copies!: number

  @Column({ type: 'varchar', length: 32 })
  channel!: string

  @Column({ name: 'printed_by', type: 'bigint' })
  printedBy!: number

  @Column({ name: 'printed_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  printedAt!: Date

  @Column({ name: 'pdf_url', type: 'varchar', length: 500, nullable: true })
  pdfUrl!: string | null

  @Column({ type: 'varchar', length: 200, nullable: true })
  watermark!: string | null

  @Column({ name: 'duplicate_warning', type: 'varchar', length: 500, nullable: true })
  duplicateWarning!: string | null

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
