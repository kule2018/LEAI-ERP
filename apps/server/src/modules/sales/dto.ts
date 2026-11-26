import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

const AMOUNT = /^\d+(\.\d{1,4})?$/
const QTY = /^\d+(\.\d{1,3})?$/

export class QuerySalesDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(24) status?: string
}

/** 跟进流水查询 */
export class QueryFollowTimelineDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(32) bizType?: string
  @IsOptional() @IsInt() @Min(1) bizId?: number
  @IsOptional() @IsString() @MaxLength(24) followType?: string
  @IsOptional() @IsString() @MaxLength(200) declare keyword?: string
  @IsOptional() @IsString() @MaxLength(20) startDate?: string
  @IsOptional() @IsString() @MaxLength(20) endDate?: string
}

export class CreateLeadDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name!: string
  @IsOptional() @IsString() @MaxLength(30) phone?: string
  @IsOptional() @IsString() @MaxLength(50) source?: string
  @IsOptional() @IsInt() @Min(0) score?: number
  @IsOptional() @IsInt() @Min(1) ownerUserId?: number
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class UpdateLeadDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string
  @IsOptional() @IsString() @MaxLength(30) phone?: string
  @IsOptional() @IsString() @MaxLength(50) source?: string
  @IsOptional() @IsInt() @Min(0) score?: number
  @IsOptional() @IsIn(['NEW', 'FOLLOWING', 'QUALIFIED', 'CONVERTED', 'LOST']) status?: string
  @IsOptional() @IsInt() @Min(1) ownerUserId?: number
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class CreateOpportunityDto {
  @IsInt() @Min(1) customerId!: number
  @IsString() @IsNotEmpty() @MaxLength(150) title!: string
  @IsOptional() @IsString() @Matches(AMOUNT) expectedAmount?: string
  @IsOptional() @IsInt() @Min(0) @Max(100) winRate?: number
  @IsOptional() @IsInt() @Min(1) ownerUserId?: number
  @IsOptional() @IsString() @MaxLength(10) closeDate?: string
}

export class UpdateOpportunityDto {
  @IsOptional() @IsString() @MaxLength(150) title?: string
  @IsOptional() @IsIn(['PROSPECT', 'NEEDS', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']) stage?: string
  @IsOptional() @IsString() @Matches(AMOUNT) expectedAmount?: string
  @IsOptional() @IsInt() @Min(0) @Max(100) winRate?: number
  @IsOptional() @IsInt() @Min(1) ownerUserId?: number
  @IsOptional() @IsString() @MaxLength(10) closeDate?: string
}

export class CreateFollowDto {
  @IsString() @IsNotEmpty() @MaxLength(32) bizType!: string
  @IsInt() @Min(1) bizId!: number
  @IsString() @IsNotEmpty() @MaxLength(1000) content!: string
  @IsOptional() @IsString() @MaxLength(24) followType?: string
  @IsOptional() @IsString() @MaxLength(30) nextTime?: string
}

export class QuotationLineDto {
  @IsInt() @Min(1) productId!: number
  @IsString() @Matches(QTY) qty!: string
  @IsString() @Matches(AMOUNT) unitPrice!: string
}

export class CreateQuotationDto {
  @IsInt() @Min(1) customerId!: number
  @IsString() @IsNotEmpty() @MaxLength(10) quoteDate!: string
  @IsOptional() @IsString() @MaxLength(10) expireDate?: string
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => QuotationLineDto) lines!: QuotationLineDto[]
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class UpdateQuotationDto {
  @IsOptional() @IsIn(['DRAFT', 'SUBMITTED', 'APPROVED', 'CANCELLED']) status?: string
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class CreateContractDto {
  @IsInt() @Min(1) customerId!: number
  @IsString() @IsNotEmpty() @MaxLength(150) title!: string
  @IsOptional() @IsString() @MaxLength(10) startDate?: string
  @IsOptional() @IsString() @MaxLength(10) endDate?: string
  @IsOptional() @IsString() @Matches(AMOUNT) totalAmount?: string
}

export class CreateSaleClauseDto {
  @IsString() @IsNotEmpty() @MaxLength(60) clauseCode!: string
  @IsString() @IsNotEmpty() @MaxLength(150) clauseTitle!: string
  @IsOptional() @IsString() @MaxLength(4000) clauseContent?: string
  @IsOptional() @IsString() @MaxLength(60) category?: string
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
}

export class RenewContractDto {
  @IsOptional() @IsString() @MaxLength(150) title?: string
  @IsOptional() @IsString() @MaxLength(10) startDate?: string
  @IsOptional() @IsString() @MaxLength(10) endDate?: string
  @IsOptional() @IsInt() @Min(1) @Max(120) termMonths?: number
  @IsOptional() @IsString() @Matches(AMOUNT) totalAmount?: string
}

export class SignContractDto {
  @IsString() @IsNotEmpty() @MaxLength(80) esignNo!: string
}

export class UpdateContractDto {
  @IsOptional() @IsString() @MaxLength(150) title?: string
  @IsOptional() @IsString() @MaxLength(10) startDate?: string
  @IsOptional() @IsString() @MaxLength(10) endDate?: string
  @IsOptional() @IsString() @Matches(AMOUNT) totalAmount?: string
  @IsOptional() @IsIn(['DRAFT', 'SUBMITTED', 'APPROVED', 'CANCELLED']) status?: string
}

export class SaleOrderLineDto {
  @IsInt() @Min(1) productId!: number
  @IsOptional() @IsInt() @Min(1) variantId?: number
  @IsOptional() @IsInt() @Min(1) warehouseId?: number
  @IsString() @Matches(QTY) qty!: string
  @IsString() @Matches(AMOUNT) unitPrice!: string
  @IsOptional() @IsString() @Matches(AMOUNT) discount?: string
}

export class CreateSaleOrderDto {
  @IsInt() @Min(1) customerId!: number
  @IsOptional() @IsInt() @Min(1) warehouseId?: number
  @IsString() @IsNotEmpty() @MaxLength(10) orderDate!: string
  @IsOptional() @IsString() @MaxLength(24) sourceType?: string
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SaleOrderLineDto) lines!: SaleOrderLineDto[]
  /** 缺货替代：{ 原产品ID: 替代产品ID }，替代品同品类且需有可用库存 */
  @IsOptional() @IsObject() substitutes?: Record<string, number>
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class SignShipmentDto {
  /** 签收人 */
  @IsOptional() @IsString() @MaxLength(60) signedBy?: string
  /** 签收凭证（照片地址、签收单号等） */
  @IsOptional() @IsArray() @IsString({ each: true }) evidenceUrls?: string[]
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class SplitSaleOrderDto {
  /** 需要拆出的明细行ID（可按仓库/产品分批拆单） */
  @IsArray() @ArrayMinSize(1) @IsInt({ each: true }) lineIds!: number[]
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class AdvanceOpportunityDto {
  @IsIn(['PROSPECT', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']) stage!: string
  @IsOptional() @IsString() @Matches(AMOUNT) expectedAmount?: string
  @IsOptional() @IsString() @MaxLength(10) closeDate?: string
  @IsOptional() @IsInt() @Min(0) followCount?: number
  @IsOptional() @IsString() @MaxLength(150) competitor?: string
  @IsOptional() @IsString() @MaxLength(300) lostReason?: string
  @IsOptional() @IsArray() teamMemberIds?: number[]
}

export class ApproveQuotationDto {
  @IsIn(['APPROVED', 'REJECTED']) status!: string
}

export class CreateCustomerMergeDto {
  @IsInt() @Min(1) fromCustomerId!: number
  @IsInt() @Min(1) toCustomerId!: number
  @IsOptional() @IsString() @MaxLength(500) reason?: string
}

export class ApproveMergeDto {
  @IsIn(['APPROVED', 'REJECTED']) status!: string
}

export class HangPosOrderDto {
  @IsString() @IsNotEmpty() @MaxLength(100) hangKey!: string
  @IsOptional() @IsInt() @Min(1) customerId?: number
  @IsString() @IsNotEmpty() @MaxLength(5000) payload!: string
}

export class CreateCustomerContactDto {
  @IsInt() @Min(1) customerId!: number
  @IsString() @IsNotEmpty() @MaxLength(100) contactName!: string
  @IsOptional() @IsString() @MaxLength(60) contactRole?: string
  @IsOptional() @IsString() @MaxLength(30) phone?: string
  @IsOptional() @IsString() @MaxLength(120) email?: string
  @IsOptional() @IsInt() @Min(0) @Max(1) isPrimary?: number
}

export class HandleChurnWarningDto {
  @IsIn(['HANDLED', 'IGNORED']) status!: string
}

export class CompareQuotationVersionDto {
  @IsOptional() @IsInt() @Min(1) baseVersion?: number
}

export class SaveQuotationVersionDto {
  @IsOptional() @IsString() @MaxLength(300) changeReason?: string
}

export class CreateMemberPriceDto {
  @IsInt() @Min(1) customerId!: number
  @IsInt() @Min(1) productId!: number
  @IsOptional() @IsString() @MaxLength(24) memberLevel?: string
  @IsString() @Matches(AMOUNT) price!: string
  @IsOptional() @IsString() @MaxLength(10) effectiveDate?: string
  @IsOptional() @IsString() @MaxLength(10) expireDate?: string
}

export class PosPaymentItemDto {
  @IsIn(['CASH', 'WECHAT', 'ALIPAY', 'CARD', 'CREDIT', 'OTHER']) payType!: string
  @IsString() @Matches(AMOUNT) amount!: string
  @IsOptional() @IsString() @MaxLength(80) tradeNo?: string
}

export class PosPaymentDto {
  @IsInt() @Min(1) orderId!: number
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PosPaymentItemDto)
  payments!: PosPaymentItemDto[]
}

export class CreateRedInvoiceDto {
  @IsOptional() @IsInt() @Min(1) returnId?: number
  @IsOptional() @IsString() @MaxLength(80) originInvoiceNo?: string
  @IsString() @Matches(AMOUNT) amount!: string
  @IsOptional() @IsString() @Matches(AMOUNT) taxAmount?: string
  @IsOptional() @IsString() @MaxLength(300) reason?: string
}

export class UpdateSaleOrderDto {
  @IsOptional() @IsIn(['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIAL', 'DONE', 'CANCELLED']) status?: string
  @IsOptional() @IsInt() @Min(1) customerId?: number
  @IsOptional() @IsInt() @Min(1) warehouseId?: number
  @IsOptional() @IsString() @Matches(AMOUNT) totalAmount?: string
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class PosOrderDto {
  @IsInt() @Min(1) customerId!: number
  @IsOptional() @IsInt() @Min(1) warehouseId?: number
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SaleOrderLineDto) lines!: SaleOrderLineDto[]
}

export class CreateStatementDto {
  @IsInt() @Min(1) customerId!: number
  @IsString() @IsNotEmpty() @MaxLength(20) period!: string
  @IsString() @Matches(AMOUNT) amount!: string
  @IsOptional() @IsString() @MaxLength(10) dueDate?: string
}

export class SettleStatementDto {
  @IsString() @Matches(AMOUNT) amount!: string
}

export class ReverseStatementDto {
  @IsString() @Matches(AMOUNT) amount!: string
  @IsString() @IsNotEmpty() @MaxLength(300) reason!: string
}

export class ShipmentLineDto {
  @IsInt() @Min(1) orderLineId!: number
  @IsString() @Matches(QTY) qty!: string
  @IsOptional() @IsString() @MaxLength(60) batchNo?: string
}

export class CreateShipmentDto {
  @IsInt() @Min(1) orderId!: number
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ShipmentLineDto) lines!: ShipmentLineDto[]
  @IsOptional() @IsString() @MaxLength(100) trackingNo?: string
  /** 关联拣货波次：波次须已复核，否则拒绝发货 */
  @IsOptional() @IsInt() @Min(1) waveId?: number
}

export class UpdateShipmentDto {
  @IsOptional() @IsIn(['DRAFT', 'SUBMITTED', 'DONE', 'CANCELLED']) status?: string
  @IsOptional() @IsString() @MaxLength(100) trackingNo?: string
}

export class SaleReturnLineDto {
  @IsInt() @Min(1) productId!: number
  @IsString() @Matches(QTY) qty!: string
  @IsString() @Matches(AMOUNT) amount!: string
  @IsOptional() @IsString() @MaxLength(24) disposal?: string
}

export class CreateSaleReturnDto {
  @IsInt() @Min(1) customerId!: number
  @IsOptional() @IsInt() @Min(1) orderId?: number
  @IsOptional() @IsString() @MaxLength(200) reason?: string
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SaleReturnLineDto) lines!: SaleReturnLineDto[]
}

export class UpdateSaleReturnDto {
  @IsOptional() @IsIn(['DRAFT', 'SUBMITTED', 'APPROVED', 'DONE', 'CANCELLED']) status?: string
}

export class ReturnQcDto {
  @IsInt() @Min(1) lineId!: number
  @IsIn(['PASS', 'FAIL']) result!: string
  @IsOptional() @IsString() @MaxLength(200) note?: string
}

export class ApproveReturnDto {
  @IsOptional() @IsString() @MaxLength(80) redInvoiceNo?: string
}

export class CreatePriceAgreementDto {
  @IsInt() @Min(1) customerId!: number
  @IsOptional() @IsInt() @Min(1) productId?: number
  @IsOptional() @IsInt() @Min(1) categoryId?: number
  @IsString() @Matches(AMOUNT) price!: string
  @IsOptional() @IsString() @Matches(QTY) qtyStep?: string
  @IsOptional() @IsString() @MaxLength(10) startDate?: string
  @IsOptional() @IsString() @MaxLength(10) endDate?: string
}

export class CreateTargetDto {
  @IsString() @IsNotEmpty() @MaxLength(20) period!: string
  @IsOptional() @IsInt() @Min(1) orgId?: number
  @IsOptional() @IsInt() @Min(1) userId?: number
  @IsString() @Matches(AMOUNT) targetAmount!: string
}

/* ---------------- 销售交付扩展（波次 / 轨迹 / 异常 / 换货 / 交接班 / 组合促销） ---------------- */

export class LinkWaveDto {
  @IsInt() @Min(1) waveId!: number
}

export class CreateTrackingNodeDto {
  @IsIn(['CREATED', 'PICKED', 'SHIPPED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION']) nodeCode!: string
  @IsString() @IsNotEmpty() @MaxLength(100) nodeName!: string
  @IsOptional() @IsString() @MaxLength(40) nodeTime?: string
  @IsOptional() @IsString() @MaxLength(120) location?: string
  @IsOptional() @IsString() @MaxLength(60) operator?: string
  @IsOptional() @IsIn(['MANUAL', 'CARRIER', 'SYSTEM']) source?: string
  @IsOptional() @IsString() @MaxLength(300) remark?: string
}

export class CreateShipmentExceptionDto {
  @IsIn(['REJECTED', 'DAMAGED', 'LOST', 'DELAY', 'SHORTAGE', 'OTHER']) exceptionType!: string
  @IsString() @IsNotEmpty() @MaxLength(500) description!: string
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) evidenceUrls!: string[]
}

export class HandleShipmentExceptionDto {
  @IsIn(['PROCESSING', 'DONE']) status!: string
  @IsOptional() @IsString() @MaxLength(500) handleRemark?: string
  /** 转为售后退货单 */
  @IsOptional() @IsBoolean() createReturn?: boolean
}

export class ExchangeReturnDto {
  @IsInt() @Min(1) lineId!: number
  @IsString() @Matches(QTY) qty!: string
  /** 换货商品 */
  @IsInt() @Min(1) exchangeProductId!: number
  @IsOptional() @IsInt() @Min(1) exchangeVariantId?: number
  @IsOptional() @IsString() @Matches(AMOUNT) exchangeUnitPrice?: string
  @IsOptional() @IsString() @MaxLength(300) remark?: string
}

export class OpenShiftDto {
  @IsOptional() @IsString() @MaxLength(100) storeName?: string
  @IsString() @Matches(AMOUNT) openingCash!: string
}

export class CloseShiftDto {
  @IsString() @Matches(AMOUNT) actualCash!: string
  @IsOptional() @IsString() @Matches(AMOUNT) otherIncome?: string
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class BundleItemDto {
  @IsInt() @Min(1) productId!: number
  @IsString() @Matches(QTY) qty!: string
}

export class CreatePromotionBundleDto {
  @IsString() @IsNotEmpty() @MaxLength(60) promotionCode!: string
  @IsString() @IsNotEmpty() @MaxLength(150) promotionName!: string
  @IsIn(['COMBO', 'FULL_REDUCTION']) bundleType!: string
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => BundleItemDto) items?: BundleItemDto[]
  @IsOptional() @IsString() @Matches(AMOUNT) thresholdAmount?: string
  @IsOptional() @IsString() @Matches(AMOUNT) discountAmount?: string
  @IsOptional() @IsString() @Matches(AMOUNT) comboPrice?: string
  @IsOptional() @IsString() @MaxLength(10) startDate?: string
  @IsOptional() @IsString() @MaxLength(10) endDate?: string
  @IsOptional() @IsInt() @Min(0) priority?: number
  @IsOptional() @IsString() @MaxLength(300) remark?: string
}

export class UpdatePromotionBundleDto {
  @IsOptional() @IsString() @MaxLength(150) promotionName?: string
  @IsOptional() @IsIn(['ENABLED', 'DISABLED']) status?: string
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => BundleItemDto) items?: BundleItemDto[]
  @IsOptional() @IsString() @Matches(AMOUNT) thresholdAmount?: string
  @IsOptional() @IsString() @Matches(AMOUNT) discountAmount?: string
  @IsOptional() @IsString() @Matches(AMOUNT) comboPrice?: string
  @IsOptional() @IsString() @MaxLength(10) startDate?: string
  @IsOptional() @IsString() @MaxLength(10) endDate?: string
  @IsOptional() @IsInt() @Min(0) priority?: number
  @IsOptional() @IsString() @MaxLength(300) remark?: string
}

export class PreviewBundleDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => BundleItemDto) lines!: BundleItemDto[]
  @IsOptional() @IsString() @MaxLength(10) at?: string
}

export class StatementAnalysisDto {
  @IsInt() @Min(1) statementId!: number
  /** 是否同时生成 AI 对账建议 */
  @IsOptional() @IsBoolean() withSuggestion?: boolean
}

