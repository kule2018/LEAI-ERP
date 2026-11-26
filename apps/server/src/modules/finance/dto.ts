import { Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Matches, MaxLength, Min, ValidateNested } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'
import { BANK_CONNECTOR_TYPES } from '../../common/bank-connection-rules'

const AMOUNT = /^\d+(\.\d{1,4})?$/

export class QueryFinanceDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(24) status?: string
  @IsOptional() @IsString() @MaxLength(20) period?: string
  @IsOptional() @IsString() @MaxLength(64) subjectId?: string
}

export class CreateSubjectDto {
  @IsString() @IsNotEmpty() @MaxLength(50) subjectCode!: string
  @IsString() @IsNotEmpty() @MaxLength(100) subjectName!: string
  @IsOptional() @IsInt() @Min(1) parentId?: number
  @IsIn(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']) category!: string
  @IsOptional() @IsIn(['DEBIT', 'CREDIT']) direction?: string
  @IsOptional() @IsString() @MaxLength(50) auxType?: string
}

export class CreateTaxCodeDto {
  @IsString() @IsNotEmpty() @MaxLength(40) taxCode!: string
  @IsString() @IsNotEmpty() @MaxLength(120) taxName!: string
  @IsIn(['VAT', 'CIT', 'SURTAX', 'STAMP', 'OTHER']) taxType!: string
  @Matches(/^(0(\.\d{1,6})?|1(\.0{1,6})?)$/) rate!: string
  @IsOptional() @IsIn(['OUTPUT', 'INPUT', 'BOTH']) direction?: string
  @IsOptional() @IsInt() @Min(1) subjectId?: number
  @IsOptional() @IsString() @MaxLength(300) remark?: string
}

export class BuildTaxDeclarationDto {
  @IsString() @IsNotEmpty() @MaxLength(20) period!: string
  @IsOptional() @IsBoolean() declare?: boolean
}

export class CreateCategoryDto {
  @IsIn(['EXPENSE', 'REVENUE']) categoryType!: string
  @IsString() @IsNotEmpty() @MaxLength(40) categoryCode!: string
  @IsString() @IsNotEmpty() @MaxLength(120) categoryName!: string
  @IsOptional() @IsString() @MaxLength(40) parentCode?: string
  @IsOptional() @IsInt() @Min(1) subjectId?: number
  @IsOptional() @IsInt() @Min(0) sortNo?: number
}

export class UpdateSubjectDto {
  @IsOptional() @IsString() @MaxLength(100) subjectName?: string
  @IsOptional() @IsIn(['ENABLED', 'DISABLED']) status?: string
  @IsOptional() @IsString() @MaxLength(200) disableReason?: string
}

export class MergeSubjectDto {
  @IsInt() @Min(1) sourceSubjectId!: number
  @IsInt() @Min(1) targetSubjectId!: number
}

export class VoidVoucherDto {
  @IsOptional() @IsString() @MaxLength(200) reason?: string
}

export class RedLineDto {
  @IsOptional() @IsString() @MaxLength(200) reason?: string
  /** 原凭证分录：系统按借贷互换生成红字分录 */
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => VoucherEntryDto) entries?: VoucherEntryDto[]
}

export class CreateAccountDto {
  @IsString() @IsNotEmpty() @MaxLength(50) accountCode!: string
  @IsString() @IsNotEmpty() @MaxLength(100) accountName!: string
  @IsOptional() @IsString() @MaxLength(24) accountType?: string
  @IsOptional() @IsString() @MaxLength(10) currencyCode?: string
  @IsOptional() @IsString() @Matches(AMOUNT) balance?: string
}

export class VoucherEntryDto {
  @IsInt() @Min(1) subjectId!: number
  @IsString() @IsNotEmpty() @MaxLength(300) summary!: string
  @IsOptional() @IsString() @Matches(AMOUNT) debit?: string
  @IsOptional() @IsString() @Matches(AMOUNT) credit?: string
  @IsOptional() @IsString() @MaxLength(50) auxType?: string
  @IsOptional() @IsString() @MaxLength(60) auxId?: string
}

export class CreateVoucherDto {
  @IsString() @IsNotEmpty() @MaxLength(10) voucherDate!: string
  @IsString() @IsNotEmpty() @MaxLength(20) period!: string
  @IsOptional() @IsString() @MaxLength(32) sourceType?: string
  @IsOptional() @IsInt() @Min(1) sourceId?: number
  @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => VoucherEntryDto) entries!: VoucherEntryDto[]
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class CreateReceivableDto {
  @IsInt() @Min(1) customerId!: number
  @IsString() @Matches(AMOUNT) amount!: string
  @IsOptional() @IsString() @MaxLength(32) sourceType?: string
  @IsOptional() @IsInt() @Min(1) sourceId?: number
  @IsOptional() @IsString() @MaxLength(60) sourceNo?: string
  @IsOptional() @IsString() @MaxLength(10) dueDate?: string
}

export class CreatePayableDto {
  @IsInt() @Min(1) supplierId!: number
  @IsString() @Matches(AMOUNT) amount!: string
  @IsOptional() @IsString() @MaxLength(32) sourceType?: string
  @IsOptional() @IsInt() @Min(1) sourceId?: number
  @IsOptional() @IsString() @MaxLength(60) sourceNo?: string
  @IsOptional() @IsString() @MaxLength(10) dueDate?: string
}

export interface WriteoffDto {
  bizType: 'RECEIVABLE' | 'PAYABLE'
  bizId: number
  amount: string
}

export class CreateReceiptDto {
  @IsInt() @Min(1) customerId!: number
  @IsInt() @Min(1) accountId!: number
  @IsString() @Matches(AMOUNT) amount!: string
  @IsString() @IsNotEmpty() @MaxLength(10) receivedAt!: string
  @IsOptional() @IsArray() writeoffs?: WriteoffDto[]
}

export class CreatePaymentDto {
  @IsInt() @Min(1) supplierId!: number
  @IsInt() @Min(1) accountId!: number
  @IsString() @Matches(AMOUNT) amount!: string
  @IsString() @IsNotEmpty() @MaxLength(10) paidAt!: string
  @IsOptional() @IsArray() writeoffs?: WriteoffDto[]
}

export class CreateInvoiceDto {
  @IsString() @IsNotEmpty() @MaxLength(80) invoiceNo!: string
  @IsString() @IsNotEmpty() @MaxLength(32) invoiceType!: string
  @IsOptional() @IsString() @MaxLength(32) bizType?: string
  @IsOptional() @IsInt() @Min(1) bizId?: number
  @IsString() @Matches(AMOUNT) amount!: string
  @IsOptional() @IsString() @Matches(AMOUNT) taxAmount?: string
}

export class CreateAssetDto {
  @IsString() @IsNotEmpty() @MaxLength(60) assetNo!: string
  @IsString() @IsNotEmpty() @MaxLength(150) assetName!: string
  @IsOptional() @IsString() @MaxLength(10) purchaseDate?: string
  @IsString() @Matches(AMOUNT) originalValue!: string
  @IsOptional() @IsInt() @Min(0) usefulMonths?: number
}

export class ClosePeriodDto {
  @IsString() @IsNotEmpty() @MaxLength(20) period!: string
}

export class CreateCostDto {
  @IsInt() @Min(1) productId!: number
  @IsString() @IsNotEmpty() @MaxLength(20) period!: string
  @IsString() @IsNotEmpty() @MaxLength(32) costType!: string
  @IsString() @Matches(AMOUNT) amount!: string
}

export class CreateBudgetDto {
  @IsString() @IsNotEmpty() @MaxLength(20) period!: string
  @IsOptional() @IsInt() @Min(1) deptId?: number
  @IsOptional() @IsInt() @Min(1) subjectId?: number
  @IsString() @Matches(AMOUNT) budgetAmount!: string
  @IsOptional() @IsIn(['WARN', 'STRICT']) controlRule?: string
}

/** 总账查询：科目余额表 / 明细账 */
export class QueryLedgerDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(24) status?: string
  @IsOptional() @IsString() @MaxLength(20) period?: string
  @IsOptional() @IsString() @MaxLength(20) beginPeriod?: string
  @IsOptional() @IsInt() @Min(1) subjectId?: number
  /** 多科目明细账：逗号分隔的科目 ID */
  @IsOptional() @IsString() @MaxLength(200) subjectIds?: string
  /** 明细账日期区间（起） */
  @IsOptional() @IsString() @MaxLength(10) beginDate?: string
  /** 明细账日期区间（止） */
  @IsOptional() @IsString() @MaxLength(10) endDate?: string
  /** 明细账凭证号（模糊匹配） */
  @IsOptional() @IsString() @MaxLength(40) voucherNo?: string
}

/** 期末结转 */
export class CarryForwardDto {
  @IsString() @IsNotEmpty() @MaxLength(20) period!: string
  @IsInt() @Min(1) profitSubjectId!: number
  /** 指定结转科目（库存/往来等资产负债类科目），与损益结转组合使用 */
  @IsOptional() @IsArray() @IsInt({ each: true }) @Min(1, { each: true }) carrySubjectIds?: number[]
  /** 指定科目结转的目标科目 */
  @IsOptional() @IsInt() @Min(1) targetSubjectId?: number
}

/** 转账凭证分录 */
export class AccountTransferEntryDto {
  @IsInt() @Min(1) subjectId!: number
  @IsOptional() @IsString() @MaxLength(200) summary?: string
  @IsOptional() @IsString() @Matches(AMOUNT) debit?: string
  @IsOptional() @IsString() @Matches(AMOUNT) credit?: string
}

/** 资金账户间转账 */
export class AccountTransferDto {
  @IsInt() @Min(1) fromAccountId!: number
  @IsInt() @Min(1) toAccountId!: number
  @IsString() @Matches(AMOUNT) amount!: string
  @IsString() @IsNotEmpty() @MaxLength(10) transferDate!: string
  /** 可选：银行存款科目，填写后自动生成转账凭证 */
  @IsOptional() @IsInt() @Min(1) bankSubjectId?: number
  /** 自定义转账凭证分录（支持跨科目借贷，如手续费科目），填写后优先于 bankSubjectId */
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AccountTransferEntryDto) entries?: AccountTransferEntryDto[]
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

/** 期初余额条目 */
export class OpeningBalanceItemDto {
  @IsInt() @Min(1) subjectId!: number
  @IsOptional() @IsString() @MaxLength(32) auxType?: string
  @IsOptional() @IsString() @MaxLength(64) auxId?: string
  @IsOptional() @IsIn(['DEBIT', 'CREDIT']) direction?: string
  @IsString() @Matches(AMOUNT) amount!: string
  @IsOptional() @IsString() @MaxLength(300) remark?: string
}

/** 期初余额录入 */
export class SetOpeningBalanceDto {
  @IsString() @IsNotEmpty() @MaxLength(20) period!: string
  @IsArray() @ValidateNested({ each: true }) @Type(() => OpeningBalanceItemDto) items!: OpeningBalanceItemDto[]
}

/** 银企直连连接配置 */
export class CreateBankConnectionDto {
  @IsInt() @Min(1) accountId!: number
  @IsString() @IsNotEmpty() @MaxLength(100) bankName!: string
  @IsOptional() @IsString() @MaxLength(60) accountNo?: string
  @IsOptional() @IsIn(BANK_CONNECTOR_TYPES) connector?: string
  @IsOptional() @IsObject() credentials?: Record<string, unknown>
  @IsOptional() @IsObject() config?: Record<string, unknown>
}

/** 银企直连同步 */
export class SyncBankConnectionDto {
  /** CSV/JSON/XML 适配器：银行流水报文内容 */
  @IsOptional() @IsString() @MaxLength(20000) csvContent?: string
  /** 网银直连报文（JSON/XML），与 csvContent 二选一 */
  @IsOptional() @IsString() @MaxLength(20000) payload?: string
  /** 模拟适配器：流水日期 */
  @IsOptional() @IsString() @MaxLength(10) date?: string
  /** 模拟适配器：流水笔数 */
  @IsOptional() @IsInt() @Min(1) count?: number
  /** 同步后是否立即执行流水对账匹配 */
  @IsOptional() @IsBoolean() reconcile?: boolean
}

/** 银行流水查询 */
export class QueryBankTransactionDto extends PaginationDto {
  @IsOptional() @IsInt() @Min(1) accountId?: number
  @IsOptional() @IsString() @MaxLength(10) beginDate?: string
  @IsOptional() @IsString() @MaxLength(10) endDate?: string
  @IsOptional() @IsIn(['IN', 'OUT']) direction?: string
  @IsOptional() @IsString() @MaxLength(100) externalNo?: string
}

/** 固定资产变更 */
export class AssetChangeDto {
  @IsString() @IsNotEmpty() @MaxLength(32) changeType!: string
  @IsOptional() @IsString() @MaxLength(150) assetName?: string
  @IsOptional() @IsString() @Matches(AMOUNT) originalValue?: string
  @IsOptional() @IsInt() @Min(0) usefulMonths?: number
  @IsOptional() @IsString() @MaxLength(300) reason?: string
}
