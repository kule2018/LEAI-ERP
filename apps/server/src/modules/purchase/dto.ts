import { Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

const AMOUNT = /^\d+(\.\d{1,4})?$/
const QTY = /^\d+(\.\d{1,3})?$/

export class QueryPurchaseDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(24) status?: string
}

export class CreateEvaluateDto {
  @IsInt() @Min(1) supplierId!: number
  @IsString() @IsNotEmpty() @MaxLength(20) period!: string
  @IsString() @Matches(AMOUNT) qualityScore!: string
  @IsString() @Matches(AMOUNT) deliveryScore!: string
  @IsString() @Matches(AMOUNT) priceScore!: string
  @IsString() @Matches(AMOUNT) serviceScore!: string
}

export class RfqLineDto {
  @IsInt() @Min(1) productId!: number
  @IsString() @Matches(QTY) qty!: string
  @IsOptional() @IsString() @Matches(AMOUNT) targetPrice?: string
}

export class CreateRfqDto {
  @IsString() @IsNotEmpty() @MaxLength(150) projectName!: string
  @IsOptional() @IsString() @MaxLength(10) quoteDeadline?: string
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => RfqLineDto) lines!: RfqLineDto[]
}

export class SupplierQuoteDto {
  @IsInt() @Min(1) supplierId!: number
  @IsString() @Matches(AMOUNT) price!: string
  @IsOptional() @IsInt() @Min(0) leadDays?: number
  @IsOptional() @IsString() @Matches(AMOUNT) score?: string
}

export class AwardDto {
  @IsInt() @Min(1) quoteId!: number
}

export class CreateDemandDto {
  @IsInt() @Min(1) productId!: number
  @IsString() @Matches(QTY) qty!: string
  @IsOptional() @IsString() @MaxLength(24) sourceType?: string
}

export class PurchaseOrderLineDto {
  @IsInt() @Min(1) productId!: number
  @IsOptional() @IsInt() @Min(1) variantId?: number
  @IsOptional() @IsInt() @Min(1) warehouseId?: number
  @IsString() @Matches(QTY) qty!: string
  @IsString() @Matches(AMOUNT) unitPrice!: string
}

export class CreatePurchaseOrderDto {
  @IsInt() @Min(1) supplierId!: number
  @IsOptional() @IsInt() @Min(1) warehouseId?: number
  @IsString() @IsNotEmpty() @MaxLength(10) orderDate!: string
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PurchaseOrderLineDto) lines!: PurchaseOrderLineDto[]
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class UpdatePurchaseOrderDto {
  @IsOptional() @IsIn(['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIAL', 'DONE', 'CANCELLED']) status?: string
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class ReceiptLineDto {
  @IsInt() @Min(1) orderLineId!: number
  @IsString() @Matches(QTY) qty!: string
  @IsOptional() @IsString() @MaxLength(60) batchNo?: string
  @IsOptional() @IsString() @MaxLength(100) serialNo?: string
  @IsOptional() @IsIn(['PENDING', 'PASS', 'FAIL']) qcStatus?: string
}

export class CreateReceiptDto {
  @IsInt() @Min(1) orderId!: number
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ReceiptLineDto) lines!: ReceiptLineDto[]
}

export class UpdateReceiptDto {
  @IsOptional() @IsIn(['DRAFT', 'SUBMITTED', 'DONE', 'CANCELLED']) status?: string
}

export class UpdateQcDto {
  @IsIn(['PENDING', 'PASS', 'FAIL']) qcStatus!: string
}

export class CreateVendorStatementDto {
  @IsInt() @Min(1) supplierId!: number
  @IsString() @IsNotEmpty() @MaxLength(20) period!: string
  @IsString() @Matches(AMOUNT) amount!: string
}

export class SettleVendorStatementDto {
  @IsString() @Matches(AMOUNT) amount!: string
}

export class PurchaseReturnLineDto {
  @IsInt() @Min(1) productId!: number
  @IsString() @Matches(QTY) qty!: string
  @IsString() @Matches(AMOUNT) amount!: string
}

export class CreatePurchaseReturnDto {
  @IsInt() @Min(1) supplierId!: number
  @IsOptional() @IsInt() @Min(1) receiptId?: number
  @IsOptional() @IsString() @MaxLength(200) reason?: string
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PurchaseReturnLineDto) lines!: PurchaseReturnLineDto[]
}

export class CreatePurchaseContractDto {
  @IsInt() @Min(1) supplierId!: number
  @IsString() @IsNotEmpty() @MaxLength(150) title!: string
  @IsOptional() @IsString() @MaxLength(10) startDate?: string
  @IsOptional() @IsString() @MaxLength(10) endDate?: string
  @IsOptional() @IsString() @Matches(AMOUNT) totalAmount?: string
  @IsOptional() @IsString() @MaxLength(500) attachmentUrl?: string
  @IsOptional() @IsString() @MaxLength(200) attachmentName?: string
}

export class CreatePurchasePriceDto {
  @IsInt() @Min(1) supplierId!: number
  @IsInt() @Min(1) productId!: number
  @IsString() @Matches(AMOUNT) price!: string
  @IsOptional() @IsString() @MaxLength(10) startDate?: string
  @IsOptional() @IsString() @MaxLength(10) endDate?: string
}

export class CreateCarrierDto {
  @IsString() @IsNotEmpty() @MaxLength(50) carrierCode!: string
  @IsString() @IsNotEmpty() @MaxLength(100) carrierName!: string
  @IsOptional() @IsString() @MaxLength(30) contactPhone?: string
}

export class CreateWaybillDto {
  @IsString() @IsNotEmpty() @MaxLength(80) waybillNo!: string
  @IsInt() @Min(1) carrierId!: number
  @IsOptional() @IsString() @MaxLength(32) sourceType?: string
  @IsOptional() @IsInt() @Min(1) sourceId?: number
}

export class OutsourceMaterialDto {
  @IsInt() @Min(1) materialId!: number
  @IsString() @Matches(QTY) qty!: string
}

export class CreateOutsourceOrderDto {
  @IsInt() @Min(1) supplierId!: number
  @IsInt() @Min(1) productId!: number
  @IsOptional() @IsInt() @Min(1) warehouseId?: number
  @IsString() @Matches(QTY) qty!: string
  @IsString() @Matches(AMOUNT) unitPrice!: string
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => OutsourceMaterialDto) lines!: OutsourceMaterialDto[]
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class OutsourceIssueDto {
  @IsIn(['PICK', 'RETURN']) issueType!: string
  @IsInt() @Min(1) materialId!: number
  @IsString() @Matches(QTY) qty!: string
  @IsOptional() @IsString() @MaxLength(60) batchNo?: string
}

export class OutsourceReceiveDto {
  @IsString() @Matches(QTY) qty!: string
  @IsOptional() @IsString() @MaxLength(60) batchNo?: string
}

export class QueryPortalDto extends PaginationDto {
  @IsOptional() @IsInt() @Min(1) supplierId?: number
  @IsOptional() @IsString() @MaxLength(24) status?: string
}

export class CreateQualificationDto {
  @IsInt() @Min(1) supplierId!: number
  @IsString() @IsNotEmpty() @MaxLength(60) qualificationType!: string
  @IsOptional() @IsString() @MaxLength(100) certificateNo?: string
  @IsOptional() @IsString() @MaxLength(10) issueDate?: string
  @IsOptional() @IsString() @MaxLength(10) expireDate?: string
  @IsOptional() @IsString() @MaxLength(255) fileUrl?: string
}

export class RenewQualificationDto {
  @IsString() @IsNotEmpty() @MaxLength(10) expireDate!: string
}

export class CreateBankAccountDto {
  @IsInt() @Min(1) supplierId!: number
  @IsString() @IsNotEmpty() @MaxLength(150) accountName!: string
  @IsString() @IsNotEmpty() @MaxLength(100) accountNo!: string
  @IsString() @IsNotEmpty() @MaxLength(100) bankName!: string
  @IsOptional() @IsString() @MaxLength(60) bankCode?: string
  @IsOptional() @IsString() @MaxLength(60) taxNo?: string
  @IsOptional() @IsInt() @Min(0) @Max(1) isDefault?: number
}

export class RfqRoundQuoteDto {
  @IsInt() @Min(1) supplierId!: number
  @IsString() @Matches(AMOUNT) price!: string
  @IsOptional() @IsInt() @Min(0) leadDays?: number
  @IsOptional() @IsString() @Matches(AMOUNT) score?: string
  @IsOptional() @IsString() @MaxLength(255) attachmentUrl?: string
}

export class CompareQuotesDto {
  @IsInt() @Min(1) rfqLineId!: number
  @IsOptional() @IsInt() @Min(1) roundNo?: number
  @IsOptional() @IsInt() @Min(0) @Max(100) priceWeight?: number
  @IsOptional() @IsInt() @Min(0) @Max(100) leadWeight?: number
  @IsOptional() @IsInt() @Min(0) @Max(100) qualityWeight?: number
}

export class CreateAwardDto {
  @IsInt() @Min(1) rfqLineId!: number
  @IsInt() @Min(1) quoteId!: number
  @IsOptional() @IsString() @MaxLength(500) reason?: string
}

export class ApproveAwardDto {
  @IsIn(['APPROVED', 'REJECTED']) status!: string
  @IsOptional() @IsString() @MaxLength(500) reason?: string
}

export class MergeDemandsDto {
  @IsArray() @ArrayMinSize(2) @IsInt({ each: true }) demandIds!: number[]
}

export class ConvertDemandDto {
  @IsInt() @Min(1) demandId!: number
  @IsInt() @Min(1) supplierId!: number
  @IsString() @IsNotEmpty() @MaxLength(10) orderDate!: string
  @IsOptional() @IsString() @Matches(AMOUNT) unitPrice?: string
  @IsOptional() @IsString() @MaxLength(10) expectedDate?: string
  @IsOptional() @IsInt() @Min(1) warehouseId?: number
}

export class OrderChangeDto {
  @IsIn(['DELIVERY', 'REMARK', 'QUANTITY', 'SUPPLIER']) changeType!: string
  @IsOptional() @IsString() @MaxLength(10) expectedDate?: string
  @IsOptional() @IsString() @MaxLength(500) remark?: string
  @IsOptional() @IsString() @Matches(QTY) qty?: string
  @IsOptional() @IsInt() @Min(1) supplierId?: number
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string
}

export class ArrivalPlanDto {
  @IsInt() @Min(1) productId!: number
  @IsOptional() @IsInt() @Min(1) orderLineId?: number
  @IsString() @Matches(QTY) planQty!: string
  @IsOptional() @IsString() @MaxLength(10) planDate?: string
}

export class ScanReceiptDto {
  @IsInt() @Min(1) orderId!: number
  @IsString() @IsNotEmpty() @MaxLength(120) code!: string
  @IsString() @Matches(QTY) qty!: string
}

export class DifferenceReceiptDto {
  @IsInt() @Min(1) orderLineId!: number
  @IsString() @Matches(QTY) receiptQty!: string
  @IsString() @IsNotEmpty() @MaxLength(300) reason!: string
  @IsOptional() @IsString() @Matches(AMOUNT) toleranceRate?: string
}

export class CreateEstimateDto {
  @IsString() @Matches(AMOUNT) amount!: string
}

export class ReverseEstimateDto {
  @IsString() @Matches(AMOUNT) invoiceAmount!: string
  @IsString() @IsNotEmpty() @MaxLength(300) reason!: string
  @IsOptional() @IsString() @Matches(AMOUNT) toleranceRate?: string
}

export class AllocateCostDto {
  @IsString() @Matches(AMOUNT) totalAmount!: string
  @IsIn(['QTY', 'AMOUNT', 'WEIGHT', 'EQUAL']) basis!: string
}

export class StatementDifferenceDto {
  @IsString() @Matches(AMOUNT) amount!: string
  @IsString() @IsNotEmpty() @MaxLength(300) reason!: string
}

export class ReverseStatementDto {
  @IsString() @Matches(AMOUNT) amount!: string
  @IsString() @IsNotEmpty() @MaxLength(300) reason!: string
}

export class CreateOutsourceLossDto {
  @IsInt() @Min(1) outsourceId!: number
  @IsOptional() @IsInt() @Min(1) materialId?: number
  @IsOptional() @IsString() @Matches(AMOUNT) standardLossRate?: string
  @IsOptional() @IsString() @MaxLength(500) reason?: string
}

export class ApproveLossDto {
  @IsIn(['APPROVED', 'REJECTED']) status!: string
  @IsOptional() @IsString() @MaxLength(500) reason?: string
}

export class SettleOutsourceDto {
  @IsString() @Matches(AMOUNT) amount!: string
}

export class CreateTrackNodeDto {
  @IsString() @IsNotEmpty() @MaxLength(100) nodeName!: string
  @IsString() @IsNotEmpty() @MaxLength(30) nodeTime!: string
  @IsOptional() @IsString() @MaxLength(150) location?: string
  @IsOptional() @IsString() @MaxLength(80) sourceRef?: string
  @IsOptional() @IsIn(['NORMAL', 'EXCEPTION', 'REJECTED', 'LOST', 'DAMAGED', 'DELIVERED']) status?: string
}

export class WaybillExceptionDto {
  @IsString() @IsNotEmpty() @MaxLength(300) reason!: string
  @IsOptional() @IsIn(['EXCEPTION', 'REJECTED', 'LOST', 'DAMAGED']) status?: string
  @IsOptional() @IsString() @MaxLength(60) signer?: string
}

export class FreightReconcileDto {
  @IsString() @Matches(AMOUNT) declaredAmount!: string
  @IsString() @Matches(AMOUNT) settledAmount!: string
}

export class ResolvePriceDto {
  @IsInt() @Min(1) productId!: number
  @IsOptional() @IsInt() @Min(1) supplierId?: number
  @IsOptional() @IsString() @MaxLength(10) at?: string
}

export class ApprovePriceDto {
  @IsIn(['APPROVED', 'REJECTED']) status!: string
  @IsOptional() @IsString() @MaxLength(500) reason?: string
}

export class PortalShipmentDto {
  @IsInt() @Min(1) supplierId!: number
  @IsString() @IsNotEmpty() @MaxLength(80) waybillNo!: string
  @IsInt() @Min(1) carrierId!: number
  @IsOptional() @IsString() @MaxLength(32) sourceType?: string
  @IsOptional() @IsInt() @Min(1) sourceId?: number
  @IsOptional() @IsString() @Matches(AMOUNT) freightAmount?: string
}

export class PortalInvoiceDto {
  @IsInt() @Min(1) supplierId!: number
  @IsString() @IsNotEmpty() @MaxLength(60) invoiceNo!: string
  @IsString() @Matches(AMOUNT) amount!: string
  @IsOptional() @IsInt() @Min(1) receiptId?: number
}

export class MatchEvidenceDto {
  @IsInt() @Min(1) receiptId!: number
  @IsOptional() @IsInt() @Min(1) invoiceId?: number
}

export class CreateFrameAgreementDto {
  @IsString() @IsNotEmpty() @MaxLength(60) agreementNo!: string
  @IsInt() @Min(1) supplierId!: number
  @IsOptional() @IsInt() @Min(1) productId?: number
  @IsOptional() @IsString() @MaxLength(10) startDate?: string
  @IsOptional() @IsString() @MaxLength(10) endDate?: string
  @IsOptional() @IsString() @Matches(QTY) totalQty?: string
  @IsOptional() @IsString() @Matches(AMOUNT) price?: string
  @IsOptional() @IsString() @MaxLength(300) changeReason?: string
}

export class UpgradeFrameAgreementDto {
  @IsOptional() @IsString() @MaxLength(10) startDate?: string
  @IsOptional() @IsString() @MaxLength(10) endDate?: string
  @IsOptional() @IsString() @Matches(QTY) totalQty?: string
  @IsOptional() @IsString() @Matches(AMOUNT) price?: string
  @IsString() @IsNotEmpty() @MaxLength(300) changeReason!: string
}

export class CreateSupplierBlacklistDto {
  @IsInt() @Min(1) supplierId!: number
  @IsOptional() @IsString() @MaxLength(150) supplierName?: string
  @IsOptional() @IsIn(['LOW', 'MEDIUM', 'HIGH']) level?: string
  @IsOptional() @IsString() @MaxLength(300) reason?: string
  @IsOptional() @IsString() @MaxLength(10) startDate?: string
  @IsOptional() @IsString() @MaxLength(10) endDate?: string
}
