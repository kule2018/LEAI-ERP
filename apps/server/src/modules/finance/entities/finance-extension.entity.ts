import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

/** 正式现金流量表出具记录：快照固化 + 出具留痕，支持报表归档与重出 */
@Entity('fin_cashflow_report', { engine: 'InnoDB' })
@Index('idx_fin_cashflow_report', ['tenantId', 'period'])
export class FinCashFlowReportEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'report_no', type: 'varchar', length: 60 }) reportNo!: string
  @Column({ type: 'varchar', length: 20 }) period!: string
  /** 报表类型：OFFICIAL 正式报表 / PREVIEW 预览 */
  @Column({ name: 'report_type', type: 'varchar', length: 24, default: 'OFFICIAL' }) reportType!: string
  /** 出具快照：分类金额、期初/期末现金等 */
  @Column({ type: 'json', nullable: true }) snapshot!: unknown
  /** 状态：ISSUED 已出具 / VOID 已作废 */
  @Column({ type: 'varchar', length: 24, default: 'ISSUED' }) status!: string
  @Column({ name: 'issued_by', type: 'bigint', nullable: true }) issuedBy!: number | null
  @Column({ name: 'issued_at', type: 'datetime', nullable: true }) issuedAt!: Date | null
  @Column({ type: 'varchar', length: 255, nullable: true }) remark!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 凭证模板：按业务类型预置分录模板，支持一键套用生成凭证草稿 */
@Entity('fin_voucher_template', { engine: 'InnoDB' })
@Index('uk_fin_voucher_template', ['tenantId', 'templateCode'], { unique: true })
export class FinVoucherTemplateEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'template_code', type: 'varchar', length: 60 }) templateCode!: string
  @Column({ name: 'template_name', type: 'varchar', length: 120 }) templateName!: string
  @Column({ name: 'biz_type', type: 'varchar', length: 32, default: 'GENERAL' }) bizType!: string
  @Column({ type: 'varchar', length: 24, default: 'ENABLED' }) status!: string
  @Column({ type: 'json', nullable: true }) items!: unknown
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 凭证附件：发票、合同、审批单等影像资料挂接 */
@Entity('fin_voucher_attachment', { engine: 'InnoDB' })
@Index('idx_fin_voucher_attachment', ['tenantId', 'voucherId'])
export class FinVoucherAttachmentEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'voucher_id', type: 'bigint' }) voucherId!: number
  @Column({ name: 'file_name', type: 'varchar', length: 200 }) fileName!: string
  @Column({ name: 'file_url', type: 'varchar', length: 500 }) fileUrl!: string
  @Column({ name: 'file_size', type: 'bigint', default: 0 }) fileSize!: number
  @Column({ name: 'attachment_type', type: 'varchar', length: 32, default: 'OTHER' }) attachmentType!: string
  @Column({ name: 'uploaded_by', type: 'bigint', nullable: true }) uploadedBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 费用政策：单笔限额、发票与审批要求 */
@Entity('fin_expense_policy', { engine: 'InnoDB' })
@Index('uk_fin_expense_policy', ['tenantId', 'policyCode'], { unique: true })
export class FinExpensePolicyEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'policy_code', type: 'varchar', length: 60 }) policyCode!: string
  @Column({ name: 'policy_name', type: 'varchar', length: 120 }) policyName!: string
  @Column({ type: 'varchar', length: 32, nullable: true }) category!: string | null
  @Column({ name: 'max_amount', type: 'decimal', precision: 18, scale: 4, nullable: true }) maxAmount!: string | null
  @Column({ name: 'require_invoice', type: 'tinyint', width: 1, default: 0 }) requireInvoice!: number
  @Column({ name: 'require_approval', type: 'tinyint', width: 1, default: 0 }) requireApproval!: number
  @Column({ type: 'json', nullable: true }) keywords!: string[] | null
  @Column({ type: 'varchar', length: 24, default: 'ENABLED' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 费用单：OCR 解析结果 + 政策判定留痕 */
@Entity('fin_expense_claim', { engine: 'InnoDB' })
@Index('idx_fin_expense_claim', ['tenantId', 'status'])
export class FinExpenseClaimEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'claim_no', type: 'varchar', length: 60 }) claimNo!: string
  @Column({ name: 'dept_id', type: 'bigint', nullable: true }) deptId!: number | null
  @Column({ type: 'varchar', length: 16, default: 'OUT' }) direction!: string
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) amount!: string
  @Column({ name: 'occurred_at', type: 'date', nullable: true }) occurredAt!: string | null
  @Column({ type: 'varchar', length: 300, nullable: true }) summary!: string | null
  @Column({ name: 'counterparty', type: 'varchar', length: 120, nullable: true }) counterparty!: string | null
  @Column({ name: 'source_text', type: 'text', nullable: true }) sourceText!: string | null
  @Column({ type: 'json', nullable: true }) ocrResult!: unknown
  @Column({ name: 'policy_id', type: 'bigint', nullable: true }) policyId!: number | null
  @Column({ name: 'policy_level', type: 'varchar', length: 16, default: 'PASS' }) policyLevel!: string
  @Column({ name: 'has_invoice', type: 'tinyint', width: 1, default: 0 }) hasInvoice!: number
  @Column({ type: 'varchar', length: 24, default: 'SUBMITTED' }) status!: string
  @Column({ name: 'approved_by', type: 'bigint', nullable: true }) approvedBy!: number | null
  @Column({ name: 'approved_at', type: 'datetime', nullable: true }) approvedAt!: Date | null
  @Column({ name: 'approve_remark', type: 'varchar', length: 500, nullable: true }) approveRemark!: string | null
  @Column({ name: 'payment_id', type: 'bigint', nullable: true }) paymentId!: number | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 费用报销部门分摊行 */
@Entity('fin_expense_claim_alloc', { engine: 'InnoDB' })
@Index('idx_fin_claim_alloc', ['tenantId', 'claimId'])
export class FinExpenseClaimAllocEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'claim_id', type: 'bigint' }) claimId!: number
  @Column({ name: 'dept_id', type: 'bigint' }) deptId!: number
  @Column({ type: 'decimal', precision: 6, scale: 4 }) ratio!: string
  @Column({ type: 'decimal', precision: 18, scale: 4 }) amount!: string
  @Column({ name: 'subject_id', type: 'bigint', nullable: true }) subjectId!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 坏账计提申请与审批 */
@Entity('fin_bad_debt_provision', { engine: 'InnoDB' })
@Index('idx_fin_bad_debt', ['tenantId', 'period', 'status'])
export class FinBadDebtProvisionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 20 }) period!: string
  @Column({ name: 'customer_id', type: 'bigint' }) customerId!: number
  @Column({ name: 'customer_name', type: 'varchar', length: 120, nullable: true }) customerName!: string | null
  @Column({ name: 'aging_bucket', type: 'varchar', length: 16, default: 'CURRENT' }) agingBucket!: string
  @Column({ name: 'receivable_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) receivableAmount!: string
  @Column({ name: 'provision_rate', type: 'decimal', precision: 10, scale: 4, default: 0 }) provisionRate!: string
  @Column({ name: 'provision_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) provisionAmount!: string
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ type: 'varchar', length: 500, nullable: true }) reason!: string | null
  @Column({ name: 'submitted_by', type: 'bigint', nullable: true }) submittedBy!: number | null
  @Column({ name: 'approved_by', type: 'bigint', nullable: true }) approvedBy!: number | null
  @Column({ name: 'approved_at', type: 'datetime', nullable: true }) approvedAt!: Date | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** AI 催收计划 */
@Entity('fin_collection_plan', { engine: 'InnoDB' })
@Index('idx_fin_collection_plan', ['tenantId', 'customerId', 'status'])
export class FinCollectionPlanEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'customer_id', type: 'bigint' }) customerId!: number
  @Column({ name: 'customer_name', type: 'varchar', length: 120, nullable: true }) customerName!: string | null
  @Column({ name: 'receivable_id', type: 'bigint', nullable: true }) receivableId!: number | null
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) amount!: string
  @Column({ name: 'overdue_days', type: 'int', default: 0 }) overdueDays!: number
  @Column({ name: 'risk_level', type: 'varchar', length: 16, default: 'LOW' }) riskLevel!: string
  @Column({ name: 'suggestion', type: 'varchar', length: 300, nullable: true }) suggestion!: string | null
  @Column({ name: 'action', type: 'varchar', length: 100, nullable: true }) action!: string | null
  @Column({ name: 'planned_at', type: 'date', nullable: true }) plannedAt!: string | null
  @Column({ type: 'varchar', length: 24, default: 'PLANNED' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 银行流水匹配结果 */
@Entity('fin_bank_match', { engine: 'InnoDB' })
@Index('idx_fin_bank_match', ['tenantId', 'transactionId'])
export class FinBankMatchEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'transaction_id', type: 'bigint' }) transactionId!: number
  @Column({ name: 'external_no', type: 'varchar', length: 100, nullable: true }) externalNo!: string | null
  @Column({ name: 'biz_type', type: 'varchar', length: 32, nullable: true }) bizType!: string | null
  @Column({ name: 'biz_id', type: 'bigint', nullable: true }) bizId!: number | null
  @Column({ name: 'score', type: 'decimal', precision: 10, scale: 2, default: 0 }) score!: string
  @Column({ name: 'difference', type: 'decimal', precision: 18, scale: 4, default: 0 }) difference!: string
  @Column({ type: 'varchar', length: 300, nullable: true }) reason!: string | null
  @Column({ type: 'varchar', length: 24, default: 'SUGGESTED' }) status!: string
  @Column({ name: 'matched_by', type: 'bigint', nullable: true }) matchedBy!: number | null
  @Column({ name: 'matched_at', type: 'datetime', nullable: true }) matchedAt!: Date | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 现金流情景 */
@Entity('fin_cashflow_scenario', { engine: 'InnoDB' })
@Index('idx_fin_cashflow_scenario', ['tenantId', 'status'])
export class FinCashflowScenarioEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'scenario_name', type: 'varchar', length: 120 }) scenarioName!: string
  @Column({ name: 'scenario_type', type: 'varchar', length: 24, default: 'BASE' }) scenarioType!: string
  @Column({ name: 'inflow_factor', type: 'decimal', precision: 10, scale: 4, default: 1 }) inflowFactor!: string
  @Column({ name: 'outflow_factor', type: 'decimal', precision: 10, scale: 4, default: 1 }) outflowFactor!: string
  @Column({ name: 'one_off', type: 'decimal', precision: 18, scale: 4, default: 0 }) oneOff!: string
  @Column({ name: 'start_date', type: 'date', nullable: true }) startDate!: string | null
  @Column({ name: 'end_date', type: 'date', nullable: true }) endDate!: string | null
  @Column({ type: 'varchar', length: 500, nullable: true }) remark!: string | null
  @Column({ type: 'varchar', length: 24, default: 'ENABLED' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 现金流日历条目 */
@Entity('fin_cashflow_calendar', { engine: 'InnoDB' })
@Index('idx_fin_cashflow_calendar', ['tenantId', 'bizDate'])
export class FinCashflowCalendarEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'scenario_id', type: 'bigint', nullable: true }) scenarioId!: number | null
  @Column({ name: 'biz_date', type: 'date' }) bizDate!: string
  @Column({ type: 'varchar', length: 16, default: 'IN' }) direction!: string
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) amount!: string
  @Column({ type: 'varchar', length: 300, nullable: true }) summary!: string | null
  @Column({ name: 'source_type', type: 'varchar', length: 32, nullable: true }) sourceType!: string | null
  @Column({ name: 'source_id', type: 'bigint', nullable: true }) sourceId!: number | null
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 月结检查清单项 */
@Entity('fin_period_check', { engine: 'InnoDB' })
@Index('idx_fin_period_check', ['tenantId', 'period', 'checkCode'])
export class FinPeriodCheckEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 20 }) period!: string
  @Column({ name: 'check_code', type: 'varchar', length: 60 }) checkCode!: string
  @Column({ name: 'check_name', type: 'varchar', length: 120 }) checkName!: string
  @Column({ name: 'passed', type: 'tinyint', width: 1, default: 0 }) passed!: number
  @Column({ type: 'varchar', length: 500, nullable: true }) detail!: string | null
  @Column({ type: 'varchar', length: 16, default: 'BLOCK' }) severity!: string
  @Column({ name: 'checked_by', type: 'bigint', nullable: true }) checkedBy!: number | null
  @Column({ name: 'checked_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) checkedAt!: Date
}

/** 预算占用明细 */
@Entity('fin_budget_occupation', { engine: 'InnoDB' })
@Index('idx_fin_budget_occupation', ['tenantId', 'period', 'released'])
export class FinBudgetOccupationEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'budget_id', type: 'bigint' }) budgetId!: number
  @Column({ type: 'varchar', length: 20 }) period!: string
  @Column({ name: 'dept_id', type: 'bigint', nullable: true }) deptId!: number | null
  @Column({ name: 'subject_id', type: 'bigint', nullable: true }) subjectId!: number | null
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) amount!: string
  @Column({ name: 'biz_type', type: 'varchar', length: 32, nullable: true }) bizType!: string | null
  @Column({ name: 'biz_id', type: 'bigint', nullable: true }) bizId!: number | null
  @Column({ name: 'released', type: 'tinyint', width: 1, default: 0 }) released!: number
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
