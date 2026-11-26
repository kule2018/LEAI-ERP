import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('print_label_instance', { engine: 'InnoDB' })
@Index('uk_print_label_serial', ['tenantId', 'serialNo'], { unique: true })
export class PrintLabelInstanceEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'label_template_id', type: 'bigint' })
  labelTemplateId!: number

  @Column({ name: 'template_code', type: 'varchar', length: 60 })
  templateCode!: string

  @Column({ name: 'product_id', type: 'bigint' })
  productId!: number

  @Column({ name: 'variant_id', type: 'bigint', default: 0 })
  variantId!: number

  @Column({ name: 'serial_no', type: 'varchar', length: 80 })
  serialNo!: string

  @Column({ name: 'barcode_type', type: 'varchar', length: 24, default: 'CODE128' })
  barcodeType!: string

  @Column({ name: 'batch_no', type: 'varchar', length: 60, default: '' })
  batchNo!: string

  @Column({ type: 'decimal', precision: 18, scale: 3, default: 1 })
  quantity!: string

  @Column({ name: 'print_count', type: 'int', default: 0 })
  printCount!: number

  @Column({ name: 'last_printed_at', type: 'datetime', precision: 3, nullable: true })
  lastPrintedAt!: Date | null

  @Column({ type: 'varchar', length: 24, default: 'GENERATED' })
  status!: string

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: number | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}

@Entity('print_barcode_rule', { engine: 'InnoDB' })
@Index('uk_print_barcode_rule', ['tenantId', 'ruleCode'], { unique: true })
export class PrintBarcodeRuleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId!: number

  @Column({ name: 'rule_code', type: 'varchar', length: 60 })
  ruleCode!: string

  @Column({ type: 'varchar', length: 20, default: '' })
  prefix!: string

  @Column({ name: 'date_format', type: 'varchar', length: 16, default: 'yyyyMMdd' })
  dateFormat!: string

  @Column({ name: 'seq_length', type: 'int', default: 6 })
  seqLength!: number

  @Column({ name: 'reset_cycle', type: 'varchar', length: 16, default: 'DAILY' })
  resetCycle!: string

  @Column({ name: 'barcode_type', type: 'varchar', length: 24, default: 'CODE128' })
  barcodeType!: string

  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' })
  status!: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  remark!: string | null

  @Column({ name: 'created_by', type: 'bigint', nullable: true })
  createdBy!: number | null

  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' })
  createdAt!: Date

  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 })
  isDeleted!: number
}
