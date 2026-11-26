import { Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

const AMOUNT = /^\d+(\.\d{1,4})?$/

export class QueryFinExtensionDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(24) status?: string
  @IsOptional() @IsString() @MaxLength(20) period?: string
  @IsOptional() @IsString() @MaxLength(64) customerId?: string
}

export class VoucherTemplateItemDto {
  @IsString() @IsNotEmpty() @MaxLength(50) subjectCode!: string
  @IsIn(['DEBIT', 'CREDIT']) direction!: string
  @IsOptional() @IsNumber() @Min(0) ratio?: number
  @IsOptional() @IsString() @MaxLength(300) summary?: string
  @IsOptional() @IsString() @MaxLength(50) auxType?: string
}

export class CreateVoucherTemplateDto {
  @IsString() @IsNotEmpty() @MaxLength(60) templateCode!: string
  @IsString() @IsNotEmpty() @MaxLength(120) templateName!: string
  @IsOptional() @IsString() @MaxLength(32) bizType?: string
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => VoucherTemplateItemDto) items!: VoucherTemplateItemDto[]
}

export class ApplyVoucherTemplateDto {
  @IsInt() @Min(1) templateId!: number
  @IsString() @Matches(AMOUNT) amount!: string
  @IsOptional() @IsString() @MaxLength(300) summary?: string
  @IsOptional() @Type(() => Object) auxMap?: Record<string, string>
}

export class SuggestSubjectDto {
  @IsString() @IsNotEmpty() @MaxLength(200) keyword!: string
  @IsOptional() @IsString() @MaxLength(32) bizType?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number
}

export class ValidateVoucherEntryDto {
  @IsInt() @Min(1) subjectId!: number
  @IsOptional() @IsString() @MaxLength(300) summary?: string
  @IsOptional() @IsString() @Matches(AMOUNT) debit?: string
  @IsOptional() @IsString() @Matches(AMOUNT) credit?: string
  @IsOptional() @IsString() @MaxLength(50) auxType?: string
  @IsOptional() @IsString() @MaxLength(60) auxId?: string
}

export class ValidateVoucherDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ValidateVoucherEntryDto) entries!: ValidateVoucherEntryDto[]
}

export class CreateVoucherAttachmentDto {
  @IsInt() @Min(1) voucherId!: number
  @IsString() @IsNotEmpty() @MaxLength(200) fileName!: string
  @IsString() @IsNotEmpty() @MaxLength(500) fileUrl!: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) fileSize?: number
  @IsOptional() @IsString() @MaxLength(32) attachmentType?: string
}

export class CreateExpensePolicyDto {
  @IsString() @IsNotEmpty() @MaxLength(60) policyCode!: string
  @IsString() @IsNotEmpty() @MaxLength(120) policyName!: string
  @IsOptional() @IsString() @MaxLength(32) category?: string
  @IsOptional() @IsString() @Matches(AMOUNT) maxAmount?: string
  @IsOptional() @Type(() => Boolean) requireInvoice?: boolean
  @IsOptional() @Type(() => Boolean) requireApproval?: boolean
  @IsOptional() @IsArray() @IsString({ each: true }) keywords?: string[]
}

export class CreateExpenseClaimDto {
  @IsOptional() @IsString() @MaxLength(4000) sourceText?: string
  @IsOptional() @IsString() @Matches(AMOUNT) amount?: string
  @IsOptional() @IsIn(['IN', 'OUT']) direction?: string
  @IsOptional() @IsString() @MaxLength(10) occurredAt?: string
  @IsOptional() @IsString() @MaxLength(300) summary?: string
  @IsOptional() @IsString() @MaxLength(120) counterparty?: string
  @IsOptional() @IsString() @MaxLength(32) category?: string
  @IsOptional() @Type(() => Boolean) hasInvoice?: boolean
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) deptId?: number
}

/** 报销审批 */
export class ApproveClaimDto {
  @IsOptional() @IsIn(['APPROVED', 'REJECTED', 'CANCELLED']) status?: string
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

/** 报销部门分摊 */
export class AllocateClaimDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ClaimAllocationItemDto)
  items!: ClaimAllocationItemDto[]
}

export class ClaimAllocationItemDto {
  @IsInt() @Min(1) deptId!: number
  /** 分摊比例 0~1 */
  @IsNumber() @Min(0.0001) @Max(1) ratio!: number
  @IsOptional() @IsInt() @Min(1) subjectId?: number
}

/** 报销付款联动 */
export class PayClaimDto {
  @IsInt() @Min(1) supplierId!: number
  @IsInt() @Min(1) accountId!: number
  @IsOptional() @IsString() @Matches(AMOUNT) amount?: string
}

export class SubmitProvisionDto {
  @IsString() @IsNotEmpty() @MaxLength(20) period!: string
  @IsInt() @Min(1) customerId!: number
  @IsOptional() @IsString() @MaxLength(120) customerName?: string
  @IsIn(['CURRENT', 'D31', 'D61', 'D91']) agingBucket!: string
  @IsString() @Matches(AMOUNT) receivableAmount!: string
  @IsString() @Matches(AMOUNT) provisionRate!: string
  @IsOptional() @IsString() @MaxLength(500) reason?: string
}

export class ApproveProvisionDto {
  @Type(() => Boolean) approved!: boolean
  @IsOptional() @IsString() @MaxLength(500) comment?: string
}

export class CreateCollectionPlanDto {
  @IsInt() @Min(1) customerId!: number
  @IsOptional() @IsString() @MaxLength(120) customerName?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) receivableId?: number
  @IsString() @Matches(AMOUNT) amount!: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) overdueDays?: number
  @IsOptional() @IsString() @MaxLength(10) plannedAt?: string
  @IsOptional() @IsString() @MaxLength(300) suggestion?: string
}

export class RunBankMatchDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) accountId?: number
  @IsOptional() @IsString() @MaxLength(10) dateFrom?: string
  @IsOptional() @IsString() @MaxLength(10) dateTo?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) threshold?: number
}

export class ConfirmBankMatchDto {
  @IsInt() @Min(1) transactionId!: number
  @IsString() @IsNotEmpty() @MaxLength(32) bizType!: string
  @IsInt() @Min(1) bizId!: number
}

export class CreateCashflowScenarioDto {
  @IsString() @IsNotEmpty() @MaxLength(120) scenarioName!: string
  @IsIn(['BASE', 'OPTIMISTIC', 'PESSIMISTIC']) scenarioType!: string
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) inflowFactor?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) outflowFactor?: number
  @IsOptional() @Type(() => Number) @IsNumber() oneOff?: number
  @IsOptional() @IsString() @MaxLength(10) startDate?: string
  @IsOptional() @IsString() @MaxLength(10) endDate?: string
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class CreateCashflowCalendarDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) scenarioId?: number
  @IsString() @IsNotEmpty() @MaxLength(10) bizDate!: string
  @IsIn(['IN', 'OUT']) direction!: string
  @IsString() @Matches(AMOUNT) amount!: string
  @IsOptional() @IsString() @MaxLength(300) summary?: string
  @IsOptional() @IsString() @MaxLength(32) sourceType?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) sourceId?: number
}

export class SimulateCashflowDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) scenarioId?: number
  @IsOptional() @IsIn(['BASE', 'OPTIMISTIC', 'PESSIMISTIC']) scenarioType?: string
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) inflowFactor?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) outflowFactor?: number
  @IsOptional() @Type(() => Number) @IsNumber() oneOff?: number
  @IsOptional() @Type(() => Number) @IsNumber() openingBalance?: number
  @IsOptional() @IsString() @MaxLength(10) startDate?: string
  @IsOptional() @IsString() @MaxLength(10) endDate?: string
}

export class RollingForecastDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(24) months?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) scenarioId?: number
  @IsOptional() @IsIn(['BASE', 'OPTIMISTIC', 'PESSIMISTIC']) scenarioType?: string
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) inflowFactor?: number
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) outflowFactor?: number
  @IsOptional() @Type(() => Number) @IsNumber() openingBalance?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(12) baselineMonths?: number
  @IsOptional() @IsString() @MaxLength(10) baseMonth?: string
}

export class OccupyBudgetDto {
  @IsString() @IsNotEmpty() @MaxLength(20) period!: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) deptId?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) subjectId?: number
  @IsString() @Matches(AMOUNT) amount!: string
  @IsOptional() @IsString() @MaxLength(32) bizType?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) bizId?: number
}

export class ReleaseBudgetDto {
  @IsInt() @Min(1) occupationId!: number
}

export class ReopenPeriodDto {
  @IsString() @IsNotEmpty() @MaxLength(20) period!: string
  @IsOptional() @IsString() @MaxLength(500) reason?: string
}
