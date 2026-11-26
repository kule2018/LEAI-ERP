import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('ai_task', { engine: 'InnoDB' })
@Index('uk_ai_task_no', ['tenantId', 'taskNo'], { unique: true })
@Index('idx_ai_task_capability', ['tenantId', 'capability'])
export class AiTaskEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'task_no', type: 'varchar', length: 60 }) taskNo!: string
  @Column({ type: 'varchar', length: 64 }) capability!: string
  @Column({ name: 'input_text', type: 'text', nullable: true }) inputText!: string | null
  @Column({ name: 'input_json', type: 'json', nullable: true }) inputJson!: Record<string, unknown> | null
  @Column({ name: 'result_json', type: 'json', nullable: true }) resultJson!: Record<string, unknown> | null
  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 }) confidence!: string
  @Column({ type: 'varchar', length: 24, default: 'DONE' }) status!: string
  @Column({ name: 'audit_id', type: 'bigint', nullable: true }) auditId!: number | null
  @Column({ name: 'evidence_json', type: 'json', nullable: true }) evidence!: Record<string, unknown>[] | null
  @Column({ name: 'created_by', type: 'bigint' }) createdBy!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('ai_model_config', { engine: 'InnoDB' })
@Index('uk_ai_model_code', ['tenantId', 'code'], { unique: true })
export class AiModelConfigEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 60 }) code!: string
  @Column({ type: 'varchar', length: 100 }) name!: string
  @Column({ type: 'varchar', length: 40 }) provider!: string
  @Column({ name: 'capability', type: 'varchar', length: 60, default: 'ALL' }) capability!: string
  @Column({ name: 'gray_percent', type: 'int', default: 0 }) grayPercent!: number
  @Column({ type: 'varchar', length: 80 }) model!: string
  @Column({ type: 'varchar', length: 500, nullable: true }) endpoint!: string | null
  @Column({ name: 'api_key_mask', type: 'varchar', length: 100, nullable: true }) apiKeyMask!: string | null
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.2 }) temperature!: string
  @Column({ name: 'max_tokens', type: 'int', default: 2048 }) maxTokens!: number
  @Column({ name: 'rate_limit', type: 'int', default: 60 }) rateLimit!: number
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'is_default', type: 'tinyint', width: 1, default: 0 }) isDefault!: number
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'updated_at', type: 'datetime', nullable: true }) updatedAt!: Date | null
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

/** AI 补货建议：预测结果落库，需人工确认后才能写回业务单据 */
@Entity('ai_forecast_suggestion', { engine: 'InnoDB' })
@Index('idx_ai_forecast_suggestion', ['tenantId', 'status'])
export class AiForecastSuggestionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'product_id', type: 'bigint', default: 0 }) productId!: number
  @Column({ type: 'varchar', length: 60 }) model!: string
  @Column({ name: 'avg_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) avgQty!: string
  @Column({ name: 'trend_rate', type: 'decimal', precision: 9, scale: 4, default: 0 }) trendRate!: string
  @Column({ name: 'available_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) availableQty!: string
  @Column({ name: 'suggest_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) suggestQty!: string
  @Column({ name: 'confirm_qty', type: 'decimal', precision: 18, scale: 3, default: 0 }) confirmQty!: string
  @Column({ name: 'cover_days', type: 'decimal', precision: 10, scale: 1, default: 0 }) coverDays!: string
  @Column({ type: 'varchar', length: 24, default: 'NORMAL' }) level!: string
  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0 }) confidence!: string
  @Column({ name: 'mape', type: 'decimal', precision: 8, scale: 2, default: 0 }) mape!: string
  @Column({ name: 'accuracy', type: 'decimal', precision: 5, scale: 4, default: 0 }) accuracy!: string
  /** PENDING / CONFIRMED / REJECTED */
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'applied_biz_type', type: 'varchar', length: 40, nullable: true }) appliedBizType!: string | null
  @Column({ name: 'applied_biz_id', type: 'bigint', nullable: true }) appliedBizId!: number | null
  @Column({ name: 'reject_reason', type: 'varchar', length: 500, nullable: true }) rejectReason!: string | null
  @Column({ name: 'reason', type: 'varchar', length: 500, nullable: true }) reason!: string | null
  @Column({ name: 'evidence_json', type: 'json', nullable: true }) evidence!: Record<string, unknown>[] | null
  @Column({ name: 'task_id', type: 'bigint', nullable: true }) taskId!: number | null
  @Column({ name: 'confirmed_by', type: 'bigint', nullable: true }) confirmedBy!: number | null
  @Column({ name: 'confirmed_at', type: 'datetime', nullable: true }) confirmedAt!: Date | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('ai_knowledge_doc', { engine: 'InnoDB' })
@Index('uk_ai_knowledge_doc_code', ['tenantId', 'docCode'], { unique: true })
export class AiKnowledgeDocEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'doc_code', type: 'varchar', length: 60 }) docCode!: string
  @Column({ type: 'varchar', length: 150 }) title!: string
  @Column({ name: 'doc_type', type: 'varchar', length: 24, default: 'TEXT' }) docType!: string
  @Column({ name: 'file_url', type: 'varchar', length: 500, nullable: true }) fileUrl!: string | null
  @Column({ type: 'text', nullable: true }) content!: string | null
  @Column({ type: 'varchar', length: 24, default: 'DEPT' }) visibility!: string
  @Column({ name: 'org_id', type: 'bigint', nullable: true }) orgId!: number | null
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'chunk_count', type: 'int', default: 0 }) chunkCount!: number
  @Column({ name: 'created_by', type: 'bigint' }) createdBy!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('ai_knowledge_chunk', { engine: 'InnoDB' })
@Index('uk_ai_knowledge_chunk', ['tenantId', 'docId', 'chunkNo'], { unique: true })
export class AiKnowledgeChunkEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'doc_id', type: 'bigint' }) docId!: number
  @Column({ name: 'chunk_no', type: 'int' }) chunkNo!: number
  @Column({ type: 'text' }) content!: string
  @Column({ name: 'vector_status', type: 'varchar', length: 24, default: 'LOCAL' }) vectorStatus!: string
  @Column({ name: 'feedback_good', type: 'int', default: 0 }) feedbackGood!: number
  @Column({ name: 'feedback_bad', type: 'int', default: 0 }) feedbackBad!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
