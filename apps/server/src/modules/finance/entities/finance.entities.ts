import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('account_subject', { engine: 'InnoDB' })
@Index('uk_account_subject_code', ['tenantId', 'subjectCode'], { unique: true })
export class AccountSubjectEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'subject_code', type: 'varchar', length: 50 }) subjectCode!: string
  @Column({ name: 'subject_name', type: 'varchar', length: 100 }) subjectName!: string
  @Column({ name: 'parent_id', type: 'bigint', nullable: true }) parentId!: number | null
  @Column({ type: 'varchar', length: 24 }) category!: string
  @Column({ type: 'varchar', length: 10, default: 'DEBIT' }) direction!: string
  @Column({ name: 'aux_type', type: 'varchar', length: 50, nullable: true }) auxType!: string | null
  @Column({ name: 'is_leaf', type: 'tinyint', width: 1, default: 1 }) isLeaf!: number
  @Column({ type: 'varchar', length: 24, default: 'ENABLED' }) status!: string
  @Column({ name: 'disable_reason', type: 'varchar', length: 200, nullable: true }) disableReason!: string | null
  @Column({ name: 'disabled_at', type: 'datetime', nullable: true }) disabledAt!: Date | null
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('fin_account', { engine: 'InnoDB' })
@Index('uk_fin_account_code', ['tenantId', 'accountCode'], { unique: true })
export class FinAccountEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'account_code', type: 'varchar', length: 50 }) accountCode!: string
  @Column({ name: 'account_name', type: 'varchar', length: 100 }) accountName!: string
  @Column({ name: 'account_type', type: 'varchar', length: 24, default: 'BANK' }) accountType!: string
  @Column({ name: 'currency_code', type: 'varchar', length: 10, default: 'CNY' }) currencyCode!: string
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) balance!: string
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('voucher', { engine: 'InnoDB' })
@Index('uk_voucher_no', ['tenantId', 'voucherNo'], { unique: true })
export class VoucherEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'voucher_no', type: 'varchar', length: 60 }) voucherNo!: string
  @Column({ name: 'voucher_date', type: 'date' }) voucherDate!: string
  @Column({ name: 'period', type: 'varchar', length: 20 }) period!: string
  @Column({ name: 'source_type', type: 'varchar', length: 32, nullable: true }) sourceType!: string | null
  @Column({ name: 'source_id', type: 'bigint', nullable: true }) sourceId!: number | null
  @Column({ type: 'varchar', length: 24, default: 'DRAFT' }) status!: string
  @Column({ name: 'total_debit', type: 'decimal', precision: 18, scale: 4, default: 0 }) totalDebit!: string
  @Column({ name: 'total_credit', type: 'decimal', precision: 18, scale: 4, default: 0 }) totalCredit!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
  @Column({ name: 'posted_at', type: 'datetime', nullable: true }) postedAt!: Date | null
  @Column({ name: 'voided_at', type: 'datetime', nullable: true }) voidedAt!: Date | null
  @Column({ name: 'void_reason', type: 'varchar', length: 200, nullable: true }) voidReason!: string | null
  @Column({ name: 'template_id', type: 'bigint', nullable: true }) templateId!: number | null
  @Column({ name: 'ai_suggested', type: 'tinyint', width: 1, default: 0 }) aiSuggested!: number
  @Column({ name: 'check_status', type: 'varchar', length: 24, default: 'PASS' }) checkStatus!: string
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
  @Column({ type: 'varchar', length: 500, nullable: true }) remark!: string | null
}

@Entity('voucher_entry', { engine: 'InnoDB' })
@Index('idx_voucher_entry', ['tenantId', 'voucherId'])
@Index('idx_voucher_entry_subject', ['tenantId', 'subjectId', 'period'])
export class VoucherEntryEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'voucher_id', type: 'bigint' }) voucherId!: number
  @Column({ name: 'line_no', type: 'int', default: 1 }) lineNo!: number
  @Column({ name: 'subject_id', type: 'bigint' }) subjectId!: number
  @Column({ type: 'varchar', length: 300 }) summary!: string
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) debit!: string
  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 }) credit!: string
  @Column({ type: 'varchar', length: 20 }) period!: string
  @Column({ name: 'aux_type', type: 'varchar', length: 50, nullable: true }) auxType!: string | null
  @Column({ name: 'aux_id', type: 'varchar', length: 60, nullable: true }) auxId!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('receivable', { engine: 'InnoDB' })
@Index('idx_receivable_customer', ['tenantId', 'customerId', 'status'])
export class ReceivableEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'customer_id', type: 'bigint' }) customerId!: number
  @Column({ name: 'source_type', type: 'varchar', length: 32, nullable: true }) sourceType!: string | null
  @Column({ name: 'source_id', type: 'bigint', nullable: true }) sourceId!: number | null
  @Column({ name: 'source_no', type: 'varchar', length: 60, nullable: true }) sourceNo!: string | null
  @Column({ type: 'decimal', precision: 18, scale: 4 }) amount!: string
  @Column({ name: 'received_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) receivedAmount!: string
  @Column({ name: 'due_date', type: 'date', nullable: true }) dueDate!: string | null
  @Column({ type: 'varchar', length: 24, default: 'OPEN' }) status!: string
  @Column({ name: 'last_contact_at', type: 'datetime', nullable: true }) lastContactAt!: Date | null
  @Column({ name: 'risk_level', type: 'varchar', length: 16, default: 'NORMAL' }) riskLevel!: string
  @Column({ name: 'provision_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) provisionAmount!: string
  @Column({ name: 'reverse_of_id', type: 'bigint', nullable: true }) reverseOfId!: number | null
  @Column({ name: 'reversed_at', type: 'datetime', nullable: true }) reversedAt!: Date | null
  @Column({ type: 'varchar', length: 300, nullable: true }) remark!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('payable', { engine: 'InnoDB' })
@Index('idx_payable_supplier', ['tenantId', 'supplierId', 'status'])
export class PayableEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: number
  @Column({ name: 'source_type', type: 'varchar', length: 32, nullable: true }) sourceType!: string | null
  @Column({ name: 'source_id', type: 'bigint', nullable: true }) sourceId!: number | null
  @Column({ name: 'source_no', type: 'varchar', length: 60, nullable: true }) sourceNo!: string | null
  @Column({ type: 'decimal', precision: 18, scale: 4 }) amount!: string
  @Column({ name: 'paid_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) paidAmount!: string
  @Column({ name: 'due_date', type: 'date', nullable: true }) dueDate!: string | null
  @Column({ type: 'varchar', length: 24, default: 'OPEN' }) status!: string
  @Column({ name: 'reverse_of_id', type: 'bigint', nullable: true }) reverseOfId!: number | null
  @Column({ name: 'reversed_at', type: 'datetime', nullable: true }) reversedAt!: Date | null
  @Column({ type: 'varchar', length: 300, nullable: true }) remark!: string | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('fin_receipt', { engine: 'InnoDB' })
@Index('idx_fin_receipt_customer', ['tenantId', 'customerId'])
export class FinReceiptEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'receipt_no', type: 'varchar', length: 60 }) receiptNo!: string
  @Column({ name: 'customer_id', type: 'bigint' }) customerId!: number
  @Column({ name: 'account_id', type: 'bigint' }) accountId!: number
  @Column({ type: 'decimal', precision: 18, scale: 4 }) amount!: string
  @Column({ name: 'received_at', type: 'date' }) receivedAt!: string
  @Column({ type: 'varchar', length: 24, default: 'POSTED' }) status!: string
  @Column({ name: 'reverse_of_id', type: 'bigint', nullable: true }) reverseOfId!: number | null
  @Column({ name: 'reversed_at', type: 'datetime', nullable: true }) reversedAt!: Date | null
  @Column({ type: 'varchar', length: 300, nullable: true }) remark!: string | null
  @Column({ name: 'created_by', type: 'bigint' }) createdBy!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('fin_payment', { engine: 'InnoDB' })
@Index('idx_fin_payment_supplier', ['tenantId', 'supplierId'])
export class FinPaymentEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'payment_no', type: 'varchar', length: 60 }) paymentNo!: string
  @Column({ name: 'supplier_id', type: 'bigint' }) supplierId!: number
  @Column({ name: 'account_id', type: 'bigint' }) accountId!: number
  @Column({ type: 'decimal', precision: 18, scale: 4 }) amount!: string
  @Column({ name: 'paid_at', type: 'date' }) paidAt!: string
  @Column({ type: 'varchar', length: 24, default: 'POSTED' }) status!: string
  @Column({ name: 'reverse_of_id', type: 'bigint', nullable: true }) reverseOfId!: number | null
  @Column({ name: 'reversed_at', type: 'datetime', nullable: true }) reversedAt!: Date | null
  @Column({ type: 'varchar', length: 300, nullable: true }) remark!: string | null
  @Column({ name: 'created_by', type: 'bigint' }) createdBy!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('fin_writeoff', { engine: 'InnoDB' })
@Index('idx_fin_writeoff', ['tenantId', 'bizType', 'bizId'])
export class FinWriteoffEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'biz_type', type: 'varchar', length: 24 }) bizType!: string
  @Column({ name: 'biz_id', type: 'bigint' }) bizId!: number
  @Column({ name: 'writeoff_type', type: 'varchar', length: 24 }) writeoffType!: string
  @Column({ name: 'source_id', type: 'bigint', nullable: true }) sourceId!: number | null
  @Column({ type: 'decimal', precision: 18, scale: 4 }) amount!: string
  @Column({ type: 'varchar', length: 300, nullable: true }) reason!: string | null
  @Column({ name: 'created_by', type: 'bigint' }) createdBy!: number
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('fin_invoice', { engine: 'InnoDB' })
@Index('idx_fin_invoice_no', ['tenantId', 'invoiceNo'])
export class FinInvoiceEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'invoice_no', type: 'varchar', length: 80 }) invoiceNo!: string
  @Column({ name: 'invoice_type', type: 'varchar', length: 32 }) invoiceType!: string
  @Column({ name: 'supplier_id', type: 'bigint', nullable: true }) supplierId!: number | null
  @Column({ name: 'biz_type', type: 'varchar', length: 32, nullable: true }) bizType!: string | null
  @Column({ name: 'biz_id', type: 'bigint', nullable: true }) bizId!: number | null
  @Column({ type: 'decimal', precision: 18, scale: 4 }) amount!: string
  @Column({ name: 'tax_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) taxAmount!: string
  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 税码主数据 */
@Entity('fin_tax_code', { engine: 'InnoDB' })
@Index('uk_fin_tax_code', ['tenantId', 'taxCode'], { unique: true })
export class FinTaxCodeEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'tax_code', type: 'varchar', length: 40 }) taxCode!: string
  @Column({ name: 'tax_name', type: 'varchar', length: 120 }) taxName!: string
  @Column({ name: 'tax_type', type: 'varchar', length: 20 }) taxType!: string
  @Column({ type: 'decimal', precision: 8, scale: 6 }) rate!: string
  @Column({ type: 'varchar', length: 16, default: 'BOTH' }) direction!: string
  @Column({ name: 'subject_id', type: 'bigint', nullable: true }) subjectId!: number | null
  @Column({ type: 'varchar', length: 300, nullable: true }) remark!: string | null
  @Column({ type: 'varchar', length: 16, default: 'ENABLED' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 税务申报汇总 */
@Entity('fin_tax_declaration', { engine: 'InnoDB' })
@Index('uk_fin_tax_decl', ['tenantId', 'period'], { unique: true })
export class FinTaxDeclarationEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 20 }) period!: string
  @Column({ name: 'declaration_no', type: 'varchar', length: 60 }) declarationNo!: string
  @Column({ name: 'total_output_tax', type: 'decimal', precision: 18, scale: 4, default: 0 }) totalOutputTax!: string
  @Column({ name: 'total_input_tax', type: 'decimal', precision: 18, scale: 4, default: 0 }) totalInputTax!: string
  @Column({ name: 'tax_payable', type: 'decimal', precision: 18, scale: 4, default: 0 }) taxPayable!: string
  @Column({ type: 'json', nullable: true }) details!: Array<Record<string, unknown>> | null
  @Column({ name: 'declared_at', type: 'datetime', nullable: true }) declaredAt!: Date | null
  @Column({ type: 'varchar', length: 16, default: 'DRAFT' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

/** 费用/收入类别主数据 */
@Entity('fin_category', { engine: 'InnoDB' })
@Index('uk_fin_category', ['tenantId', 'categoryType', 'categoryCode'], { unique: true })
export class FinCategoryEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'category_type', type: 'varchar', length: 16 }) categoryType!: string
  @Column({ name: 'category_code', type: 'varchar', length: 40 }) categoryCode!: string
  @Column({ name: 'category_name', type: 'varchar', length: 120 }) categoryName!: string
  @Column({ name: 'parent_code', type: 'varchar', length: 40, nullable: true }) parentCode!: string | null
  @Column({ name: 'subject_id', type: 'bigint', nullable: true }) subjectId!: number | null
  @Column({ name: 'sort_no', type: 'int', default: 0 }) sortNo!: number
  @Column({ type: 'varchar', length: 16, default: 'ENABLED' }) status!: string
  @Column({ name: 'created_by', type: 'bigint', nullable: true }) createdBy!: number | null
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('fin_asset', { engine: 'InnoDB' })
@Index('uk_fin_asset_no', ['tenantId', 'assetNo'], { unique: true })
export class FinAssetEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'asset_no', type: 'varchar', length: 60 }) assetNo!: string
  @Column({ name: 'asset_name', type: 'varchar', length: 150 }) assetName!: string
  @Column({ name: 'purchase_date', type: 'date', nullable: true }) purchaseDate!: string | null
  @Column({ name: 'original_value', type: 'decimal', precision: 18, scale: 4 }) originalValue!: string
  @Column({ name: 'depreciated_value', type: 'decimal', precision: 18, scale: 4, default: 0 }) depreciatedValue!: string
  /** 账面净值 = 原值 - 累计折旧 */
  @Column({ name: 'net_value', type: 'decimal', precision: 18, scale: 4, default: 0 }) netValue!: string
  @Column({ name: 'useful_months', type: 'int', default: 0 }) usefulMonths!: number
  /** 折旧方法：STRAIGHT_LINE / DOUBLE_DECLINING / SUM_OF_YEARS */
  @Column({ name: 'depreciation_method', type: 'varchar', length: 24, default: 'STRAIGHT_LINE' }) depreciationMethod!: string
  /** 残值率 0~1 */
  @Column({ name: 'residual_rate', type: 'decimal', precision: 6, scale: 4, default: 0 }) residualRate!: string
  @Column({ name: 'expense_subject_id', type: 'bigint', nullable: true }) expenseSubjectId!: number | null
  @Column({ name: 'accumulated_subject_id', type: 'bigint', nullable: true }) accumulatedSubjectId!: number | null
  @Column({ name: 'book_quantity', type: 'int', default: 1 }) bookQuantity!: number
  @Column({ name: 'actual_quantity', type: 'int', nullable: true }) actualQuantity!: number | null
  @Column({ name: 'last_stocktake', type: 'date', nullable: true }) lastStocktake!: string | null
  @Column({ name: 'dispose_date', type: 'date', nullable: true }) disposeDate!: string | null
  @Column({ name: 'dispose_amount', type: 'decimal', precision: 18, scale: 4, nullable: true }) disposeAmount!: string | null
  @Column({ type: 'varchar', length: 24, default: 'ACTIVE' }) status!: string
  @Column({ name: 'is_deleted', type: 'tinyint', width: 1, default: 0 }) isDeleted!: number
}

@Entity('fin_asset_depreciation', { engine: 'InnoDB' })
@Index('idx_fin_depreciation', ['tenantId', 'assetId', 'period'])
export class FinAssetDepreciationEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'asset_id', type: 'bigint' }) assetId!: number
  @Column({ type: 'varchar', length: 20 }) period!: string
  @Column({ type: 'decimal', precision: 18, scale: 4 }) amount!: string
  @Column({ name: 'voucher_id', type: 'bigint', nullable: true }) voucherId!: number | null
  @Column({ name: 'method', type: 'varchar', length: 24, default: 'STRAIGHT_LINE' }) method!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('fin_period', { engine: 'InnoDB' })
@Index('uk_fin_period', ['tenantId', 'period'], { unique: true })
export class FinPeriodEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 20 }) period!: string
  @Column({ type: 'varchar', length: 24, default: 'OPEN' }) status!: string
  @Column({ name: 'closed_by', type: 'bigint', nullable: true }) closedBy!: number | null
  @Column({ name: 'closed_at', type: 'datetime', nullable: true }) closedAt!: Date | null
  @Column({ name: 'check_status', type: 'varchar', length: 24, default: 'OPEN' }) checkStatus!: string
  @Column({ name: 'reopen_count', type: 'int', default: 0 }) reopenCount!: number
  @Column({ name: 'reopened_by', type: 'bigint', nullable: true }) reopenedBy!: number | null
  @Column({ name: 'reopened_at', type: 'datetime', nullable: true }) reopenedAt!: Date | null
}

@Entity('fin_cost', { engine: 'InnoDB' })
@Index('idx_fin_cost', ['tenantId', 'productId', 'period'])
export class FinCostEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ name: 'product_id', type: 'bigint' }) productId!: number
  @Column({ type: 'varchar', length: 20 }) period!: string
  @Column({ name: 'cost_type', type: 'varchar', length: 32 }) costType!: string
  @Column({ type: 'decimal', precision: 18, scale: 4 }) amount!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}

@Entity('fin_budget', { engine: 'InnoDB' })
@Index('idx_fin_budget', ['tenantId', 'period', 'deptId'])
export class FinBudgetEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' }) id!: number
  @Column({ name: 'tenant_id', type: 'bigint' }) tenantId!: number
  @Column({ type: 'varchar', length: 20 }) period!: string
  @Column({ name: 'dept_id', type: 'bigint', nullable: true }) deptId!: number | null
  @Column({ name: 'subject_id', type: 'bigint', nullable: true }) subjectId!: number | null
  @Column({ name: 'budget_amount', type: 'decimal', precision: 18, scale: 4 }) budgetAmount!: string
  @Column({ name: 'used_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) usedAmount!: string
  @Column({ name: 'occupied_amount', type: 'decimal', precision: 18, scale: 4, default: 0 }) occupiedAmount!: string
  @Column({ name: 'control_rule', type: 'varchar', length: 24, default: 'WARN' }) controlRule!: string
  @Column({ name: 'created_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP(3)' }) createdAt!: Date
}
