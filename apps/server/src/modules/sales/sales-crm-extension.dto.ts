import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min
} from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

const AMOUNT = /^\d+(\.\d{1,4})?$/
const RATE = /^(0(\.\d+)?|1(\.0+)?)$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

/* ------------------------------ 佣金规则 ------------------------------ */

export class CreateCommissionRuleDto {
  @IsString() @IsNotEmpty() @MaxLength(60) ruleCode!: string
  @IsString() @IsNotEmpty() @MaxLength(120) ruleName!: string
  @IsIn(['RATE', 'FIXED', 'TIER']) ruleType!: string
  /** 比例（0-1），RATE 类型必填 */
  @IsOptional() @IsString() @Matches(RATE) rate?: string
  /** 固定金额，FIXED 类型必填 */
  @IsOptional() @IsString() @Matches(AMOUNT) fixedAmount?: string
  /** 阶梯配置，TIER 类型必填 */
  @IsOptional() @IsArray() @ArrayMinSize(1) @IsObject({ each: true }) tiers?: Array<Record<string, unknown>>
  /** 指定业务员；为空表示全员通用 */
  @IsOptional() @IsInt() @Min(1) salesRepId?: number
  @IsOptional() @IsString() @Matches(DATE) effectiveFrom?: string
  @IsOptional() @IsString() @Matches(DATE) effectiveTo?: string
}

export class UpdateCommissionRuleDto {
  @IsOptional() @IsString() @MaxLength(120) ruleName?: string
  @IsOptional() @IsIn(['RATE', 'FIXED', 'TIER']) ruleType?: string
  @IsOptional() @IsString() @Matches(RATE) rate?: string
  @IsOptional() @IsString() @Matches(AMOUNT) fixedAmount?: string
  @IsOptional() @IsArray() @ArrayMinSize(1) @IsObject({ each: true }) tiers?: Array<Record<string, unknown>>
  @IsOptional() @IsInt() @Min(1) salesRepId?: number
  @IsOptional() @IsString() @Matches(DATE) effectiveFrom?: string
  @IsOptional() @IsString() @Matches(DATE) effectiveTo?: string
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
}

export class QueryCommissionRuleDto extends PaginationDto {
  @IsOptional() @IsIn(['RATE', 'FIXED', 'TIER']) ruleType?: string
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
}

/* ------------------------------ 佣金核算 ------------------------------ */

export class CalculateCommissionDto {
  @IsInt() @Min(1) ruleId!: number
  @IsInt() @Min(1) orderId!: number
  /** 核算期间，默认取订单日期所属月份 */
  @IsOptional() @IsString() @MaxLength(20) period?: string
  @IsOptional() @IsString() @MaxLength(300) remark?: string
}

export class ConfirmCommissionDto {
  @IsOptional() @IsString() @MaxLength(300) remark?: string
  /** 发放时收款方（供应商档案）ID：提供后自动生成佣金应付单 */
  @IsOptional() @IsInt() @Min(1) supplierId?: number
}

export class QueryCommissionRecordDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(20) period?: string
  @IsOptional() @IsIn(['PENDING', 'CONFIRMED', 'PAID', 'CANCELLED']) status?: string
  @IsOptional() @IsInt() @Min(1) salesRepId?: number
}

/* ------------------------------ 投诉工单 ------------------------------ */

export class CreateComplaintDto {
  @IsInt() @Min(1) customerId!: number
  @IsOptional() @IsInt() @Min(1) orderId?: number
  @IsOptional() @IsIn(['QUALITY', 'DELIVERY', 'SERVICE', 'PRICE']) complaintType?: string
  @IsString() @IsNotEmpty() @MaxLength(150) title!: string
  @IsOptional() @IsString() @MaxLength(2000) description?: string
  @IsOptional() @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']) severity?: string
}

export class AssignComplaintDto {
  @IsInt() @Min(1) assigneeId!: number
}

export class ResolveComplaintDto {
  @IsString() @IsNotEmpty() @MaxLength(500) resolution!: string
}

export class QueryComplaintDto extends PaginationDto {
  @IsOptional() @IsIn(['OPEN', 'PROCESSING', 'RESOLVED', 'CLOSED']) status?: string
  @IsOptional() @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']) severity?: string
  @IsOptional() @IsInt() @Min(1) customerId?: number
  /** 仅看超时未闭环 */
  @IsOptional() @IsString() overdueOnly?: string
}

/** 投诉重开 */
export class ReopenComplaintDto {
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string
}

/* ------------------------------ 客户回访 ------------------------------ */

export class CreateVisitDto {
  @IsInt() @Min(1) customerId!: number
  @IsOptional() @IsInt() @Min(1) salesRepId?: number
  @IsOptional() @IsString() @Matches(DATE) visitDate?: string
  @IsOptional() @IsIn(['PHONE', 'VISIT', 'ONLINE', 'AFTER_SALE']) channel?: string
  @IsOptional() @IsString() @MaxLength(2000) content?: string
  @IsOptional() @IsString() @MaxLength(500) feedback?: string
  /** 下次回访时间 */
  @IsOptional() @IsString() nextVisitAt?: string
  @IsOptional() @IsIn(['PLANNED', 'DONE']) status?: string
  /** 满意度评分 1-5 */
  @IsOptional() @IsInt() @Min(1) @Max(5) satisfaction?: number
}

/** 完成回访：登记内容、满意度与下次回访安排 */
export class CompleteVisitDto {
  @IsOptional() @IsString() @MaxLength(2000) content?: string
  @IsOptional() @IsString() @MaxLength(500) feedback?: string
  @IsOptional() @IsInt() @Min(1) @Max(5) satisfaction?: number
  @IsOptional() @IsString() nextVisitAt?: string
}

/** 批量生成回访计划 */
export class PlanVisitsDto {
  /** 指定客户；为空表示按全部客户生成 */
  @IsOptional() @IsArray() @IsInt({ each: true }) @Min(1, { each: true }) customerIds?: number[]
  /** 回访周期（天），默认 30 */
  @IsOptional() @IsInt() @Min(1) intervalDays?: number
  @IsOptional() @IsInt() @Min(1) salesRepId?: number
  @IsOptional() @IsIn(['PHONE', 'VISIT', 'ONLINE', 'AFTER_SALE']) channel?: string
}

/** 佣金批量计提 */
export class AccrueCommissionDto {
  @IsString() @IsNotEmpty() @MaxLength(20) period!: string
  /** 指定规则；为空表示按期间生效的全部规则计提 */
  @IsOptional() @IsInt() @Min(1) ruleId?: number
}

export class QueryVisitDto extends PaginationDto {
  @IsOptional() @IsInt() @Min(1) customerId?: number
  @IsOptional() @IsIn(['PLANNED', 'DONE']) status?: string
  @IsOptional() @IsIn(['PHONE', 'VISIT', 'ONLINE', 'AFTER_SALE']) channel?: string
}

/* ------------------------------ 报表查询 ------------------------------ */

export class QueryUnshippedDto {
  @IsOptional() @IsInt() @Min(1) customerId?: number
  /** 仅看逾期未发货 */
  @IsOptional() @IsString() overdueOnly?: string
}

export class CreateQuotationTemplateDto {
  @IsString() @IsNotEmpty() @MaxLength(60) templateCode!: string
  @IsString() @IsNotEmpty() @MaxLength(150) templateName!: string
  @IsOptional() @IsInt() @Min(1) customerId?: number
  @IsOptional() @IsString() @MaxLength(500) remark?: string
  @IsArray() @ArrayMinSize(1)
  lines!: Array<{ productId: number; qty: string; unitPrice: string; remark?: string }>
}

export class ApplyQuotationTemplateDto {
  @IsInt() @Min(1) templateId!: number
  @IsOptional() overrides?: Record<string, { qty?: number; unitPrice?: number }>
}

export class CreateCreditFlowDto {
  @IsInt() @Min(1) customerId!: number
  @IsIn(['OCCUPY', 'RELEASE', 'ADJUST']) flowType!: string
  @IsString() @Matches(/^\d+(\.\d{1,4})?$/) amount!: string
  @IsOptional() @IsString() @MaxLength(32) sourceType?: string
  @IsOptional() @IsInt() @Min(1) sourceId?: number
  @IsOptional() @IsString() @MaxLength(300) remark?: string
}

export class QueryReturnRateDto {
  @IsOptional() @IsString() @Matches(DATE) beginDate?: string
  @IsOptional() @IsString() @Matches(DATE) endDate?: string
  @IsOptional() @IsInt() @Min(1) customerId?: number
  @IsOptional() @IsInt() @Min(1) productId?: number
  @IsOptional() @IsIn(['PRODUCT', 'PERIOD']) groupBy?: string
}
