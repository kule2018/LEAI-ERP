import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('print_label_template', { engine: 'InnoDB' })
@Index('uk_print_label_code', ['tenantId', 'labelCode'], { unique: true })
export class PrintLabelTemplateEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'label_code', type: 'varchar', length: 60 }) labelCode!: string
  @Column({ name: 'label_name', type: 'varchar', length: 100 }) labelName!: string
  @Column({ name: 'barcode_type', type: 'varchar', length: 24, default: 'CODE128' }) barcodeType!: string
  @Column({ name: 'paper_size', type: 'varchar', length: 30, default: '50x30' }) paperSize!: string
  @Column({ type: 'json', nullable: true }) schema!: Record<string, unknown> | null
  @Column({ type: 'int', default: 1 }) version!: number
  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 }) isActive!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}
