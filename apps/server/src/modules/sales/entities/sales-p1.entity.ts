import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** 报价模板 */
@Entity('sale_quotation_template', { engine: 'InnoDB' })
@Index('idx_sale_quote_tpl', ['tenantId', 'status'])
export class QuotationTemplateEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'template_code', type: 'varchar', length: 60 }) templateCode!: string
  @Column({ name: 'template_name', type: 'varchar', length: 150 }) templateName!: string
  @Column({ name: 'customer_id', type: 'bigint', nullable: true }) customerId!: number | null
  @Column({ type: 'varchar', length: 500, nullable: true }) remark!: string | null
  @Column({ type: 'varchar', length: 16, default: 'ENABLED' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 报价模板行 */
@Entity('sale_quotation_template_line', { engine: 'InnoDB' })
@Index('idx_sale_quote_tpl_line', ['tenantId', 'templateId'])
export class QuotationTemplateLineEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'template_id', type: 'bigint' }) templateId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ type: 'decimal', precision: 18, scale: 3 }) qty!: string
  @Column({ name: 'unit_price', type: 'decimal', precision: 18, scale: 4 }) unitPrice!: string
  @Column({ type: 'varchar', length: 300, nullable: true }) remark!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 客户信用动态流水 */
@Entity('sale_customer_credit_flow', { engine: 'InnoDB' })
@Index('idx_sale_credit_flow', ['tenantId', 'customerId'])
export class CustomerCreditFlowEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'customer_id', type: 'bigint' }) customerId!: number
  @Column({ name: 'flow_type', type: 'varchar', length: 16 }) flowType!: string
  @Column({ type: 'decimal', precision: 18, scale: 4 }) amount!: string
  @Column({ name: 'before_used', type: 'decimal', precision: 18, scale: 4, default: 0 }) beforeUsed!: string
  @Column({ name: 'after_used', type: 'decimal', precision: 18, scale: 4, default: 0 }) afterUsed!: string
  @Column({ name: 'source_type', type: 'varchar', length: 32, nullable: true }) sourceType!: string | null
  @Column({ name: 'source_id', type: 'bigint', nullable: true }) sourceId!: number | null
  @Column({ type: 'varchar', length: 300, nullable: true }) remark!: string | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
