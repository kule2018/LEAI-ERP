import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

export interface AdviceSupplier {
  name: string
  inquiryNo: string
  sourceType: string
}

export interface AdviceQuote {
  supplier: string
  sourceType: string
  fileName: string
  unitPrice: number
  moq: number
  leadTimeDays: number
  ruleOk: boolean
  evidence: string
}

export interface AdviceSuggestion {
  winner: string
  reason: string
  ruleCitations: string[]
  ranking: Array<{ supplier: string; score: number; reason: string }>
}

@Entity('ai_procurement_advice', { engine: 'InnoDB' })
@Index('uk_ai_procurement_advice_no', ['tenantId', 'taskNo'], { unique: true })
@Index('idx_ai_procurement_advice_status', ['tenantId', 'status'])
export class AiProcurementAdviceEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'task_no', type: 'varchar', length: 60 }) taskNo!: string
  @Column({ name: 'product_name', type: 'varchar', length: 150 }) productName!: string
  @Column({ name: 'shortage_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) shortageQty!: string
  @Column({ name: 'rule_text', type: 'text', nullable: true }) ruleText!: string | null
  @Column({ name: 'suppliers_json', type: 'json', nullable: true }) suppliers!: AdviceSupplier[] | null
  @Column({ name: 'quotes_json', type: 'json', nullable: true }) quotes!: AdviceQuote[] | null
  @Column({ name: 'suggestion_json', type: 'json', nullable: true }) suggestion!: AdviceSuggestion | null
  @Column({ type: 'varchar', length: 24, default: 'WAITING' }) status!: string
  @Column({ type: 'varchar', length: 24, default: 'INQUIRING' }) progress!: string
  @Column({ name: 'resume_count', type: 'int', default: 0 }) resumeCount!: number
  @Column({ name: 'remind_count', type: 'int', default: 0 }) remindCount!: number
  @Column({ name: 'draft_no', type: 'varchar', length: 60, nullable: true }) draftNo!: string | null
  @Column({ name: 'evaluation_json', type: 'json', nullable: true }) evaluation!: Record<string, unknown> | null
  @Column({ name: 'confirmed_by', type: 'bigint', nullable: true }) confirmedBy!: number | null
  @Column({ name: 'confirmed_at', type: 'datetime', nullable: true }) confirmedAt!: Date | null
  @Column({ name: 'created_by', type: 'bigint' }) createdBy!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', nullable: true }) updatedAt!: Date | null
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}
