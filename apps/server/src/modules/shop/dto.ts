import { Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

const QTY = /^\d+(\.\d{1,3})?$/
const AMOUNT = /^\d+(\.\d{1,4})?$/

export class QueryShopDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(24) status?: string
}

export class CreateStoreDto {
  @IsString() @IsNotEmpty() @MaxLength(60) storeCode!: string
  @IsString() @IsNotEmpty() @MaxLength(150) storeName!: string
  @IsString() @IsNotEmpty() @MaxLength(40) platform!: string
  @IsOptional() @IsString() @MaxLength(100) secret?: string
  @IsOptional() @IsString() @MaxLength(24) syncStrategy?: string
}

export class CreateGoodsMapDto {
  @IsInt() @Min(1) storeId!: number
  @IsString() @IsNotEmpty() @MaxLength(100) platformGoodsId!: string
  @IsOptional() @IsString() @MaxLength(100) platformSkuId?: string
  @IsInt() @Min(1) productId!: number
  @IsOptional() @IsInt() @Min(0) variantId?: number
  @IsOptional() @IsString() @MaxLength(200) priceRule?: string
  @IsOptional() @IsString() @MaxLength(200) stockRule?: string
}

export class ShopOrderLineDto {
  @IsInt() @Min(1) productId!: number
  @IsOptional() @IsInt() @Min(0) variantId?: number
  @IsString() @Matches(QTY) qty!: string
  @IsString() @Matches(AMOUNT) unitPrice!: string
  @IsOptional() @IsInt() @Min(1) activityId?: number
}

export class CreateShopOrderDto {
  @IsInt() @Min(1) storeId!: number
  @IsString() @IsNotEmpty() @MaxLength(100) platformOrderNo!: string
  @IsOptional() @IsInt() @Min(1) customerId?: number
  @IsString() @Matches(AMOUNT) orderAmount!: string
  @IsOptional() @IsString() @MaxLength(10) orderDate?: string
  @IsOptional() @IsString() @MaxLength(60) couponCode?: string
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ShopOrderLineDto) lines!: ShopOrderLineDto[]
}

export class ShipShopOrderDto {
  @IsString() @IsNotEmpty() @MaxLength(80) waybillNo!: string
  @IsOptional() @IsString() @MaxLength(60) carrier?: string
}

export class CreatePromotionDto {
  @IsInt() @Min(1) storeId!: number
  @IsString() @IsNotEmpty() @MaxLength(60) promotionCode!: string
  @IsString() @IsNotEmpty() @MaxLength(32) promotionType!: string
  @IsString() @IsNotEmpty() @MaxLength(30) startTime!: string
  @IsString() @IsNotEmpty() @MaxLength(30) endTime!: string
  @IsOptional() @IsString() @Matches(QTY) stockLimit?: string
}

export class CreateCouponDto {
  @IsInt() @Min(1) storeId!: number
  @IsString() @IsNotEmpty() @MaxLength(60) couponCode!: string
  @IsIn(['FIXED', 'PERCENT']) couponType!: 'FIXED' | 'PERCENT'
  @IsString() @Matches(AMOUNT) discountValue!: string
  @IsString() @Matches(AMOUNT) minAmount!: string
  @IsOptional() @IsString() @Matches(AMOUNT) maxDiscount?: string
  @IsString() @IsNotEmpty() @MaxLength(30) startTime!: string
  @IsString() @IsNotEmpty() @MaxLength(30) endTime!: string
  @IsOptional() @IsIn([true, false]) stackable?: boolean
}

export class ValidateCouponDto {
  @IsInt() @Min(1) storeId!: number
  @IsString() @IsNotEmpty() @MaxLength(60) couponCode!: string
  @IsString() @Matches(AMOUNT) amount!: string
  @IsOptional() @IsString() @MaxLength(30) at?: string
}

export class CreateSeckillDto {
  @IsInt() @Min(1) storeId!: number
  @IsString() @IsNotEmpty() @MaxLength(60) seckillCode!: string
  @IsInt() @Min(1) productId!: number
  @IsOptional() @IsInt() @Min(0) variantId?: number
  @IsString() @Matches(AMOUNT) basePrice!: string
  @IsString() @Matches(AMOUNT) seckillPrice!: string
  @IsInt() @Min(1) limitPerUser!: number
  @IsString() @IsNotEmpty() @MaxLength(30) startTime!: string
  @IsString() @IsNotEmpty() @MaxLength(30) endTime!: string
}

export class SetActivityStockDto {
  @IsInt() @Min(1) storeId!: number
  @IsIn(['SECKILL', 'PROMOTION']) activityType!: 'SECKILL' | 'PROMOTION'
  @IsInt() @Min(1) activityId!: number
  @IsInt() @Min(1) productId!: number
  @IsOptional() @IsInt() @Min(0) variantId?: number
  @IsString() @Matches(QTY) totalStock!: string
}

export class ReserveActivityStockDto {
  @IsInt() @Min(1) storeId!: number
  @IsIn(['SECKILL', 'PROMOTION']) activityType!: 'SECKILL' | 'PROMOTION'
  @IsInt() @Min(1) activityId!: number
  @IsInt() @Min(1) productId!: number
  @IsOptional() @IsInt() @Min(0) variantId?: number
  @IsString() @Matches(QTY) qty!: string
  @IsOptional() @IsString() @MaxLength(100) buyerKey?: string
}

export class CreatePaymentConfigDto {
  @IsInt() @Min(1) storeId!: number
  @IsString() @IsNotEmpty() @MaxLength(40) channel!: string
  @IsOptional() @IsString() @MaxLength(100) merchantId?: string
  @IsOptional() @IsString() @MaxLength(100) secret?: string
}

export class CreateCsConversationDto {
  @IsInt() @Min(1) storeId!: number
  @IsOptional() @IsString() @MaxLength(100) platformBuyerId?: string
  @IsOptional() @IsString() @MaxLength(500) message?: string
}

export class ReplyCsDto {
  @IsString() @IsNotEmpty() @MaxLength(500) message!: string
}

export interface QueryShopRecordsDto extends PaginationDto {
  status?: string
}

export class GenerateWaybillDto {
  @IsString() @IsNotEmpty() @MaxLength(40) carrier!: string
}

export class QuickReplyDto {
  @IsString() @IsNotEmpty() @MaxLength(500) message!: string
}

export class PushTrackingDto {
  @IsString() @IsNotEmpty() @MaxLength(40) status!: string
  @IsOptional() @IsString() @MaxLength(200) location?: string
  @IsOptional() @IsString() @MaxLength(500) description?: string
  @IsOptional() @IsString() @MaxLength(30) eventAt?: string
}

export class CreateCsQcDto {
  @IsInt() @Min(0) responseMinutes!: number
  @IsIn([true, false]) resolved!: boolean
  @IsInt() @Min(1) @Max(5) politeness!: number
  @IsOptional() @IsInt() @Min(1) firstReplySlaMinutes?: number
  @IsOptional() @IsString() @MaxLength(500) note?: string
}

export class ReconcileBillInputDto {
  @IsInt() @Min(1) storeId!: number
  @IsString() @IsNotEmpty() @MaxLength(100) billNo!: string
  @IsString() @IsNotEmpty() @MaxLength(40) channel!: string
  @IsOptional() @IsString() @MaxLength(24) period?: string
  @IsString() @Matches(AMOUNT) platformAmount!: string
  @IsString() @Matches(AMOUNT) localAmount!: string
  @IsOptional() @IsString() @MaxLength(12) currency?: string
}

export class ImportReconcileDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ReconcileBillInputDto) bills!: ReconcileBillInputDto[]
}

export class ResolveReconcileDto {
  @IsString() @IsNotEmpty() @MaxLength(500) note!: string
}

export class CreateRefundDto {
  @IsInt() @Min(1) storeId!: number
  @IsInt() @Min(1) shopOrderId!: number
  @IsString() @Matches(AMOUNT) amount!: string
  @IsOptional() @IsString() @MaxLength(200) reason?: string
  @IsOptional() @IsInt() @Min(1) reconcileBillId?: number
}

export class ApproveRefundDto {
  @IsOptional() @IsString() @MaxLength(80) redInvoiceNo?: string
  @IsOptional() @IsString() @MaxLength(500) note?: string
}

export class RejectRefundDto {
  @IsString() @IsNotEmpty() @MaxLength(500) note!: string
}

export const SHOP_RECONCILE_RESULT = ['SUCCESS', 'DIFF', 'PENDING'] as const
export type ShopReconcileResult = (typeof SHOP_RECONCILE_RESULT)[number]

export class ReconcileDto {
  @IsIn(SHOP_RECONCILE_RESULT) result!: ShopReconcileResult
  @IsOptional() @IsString() @MaxLength(500) note?: string
}
