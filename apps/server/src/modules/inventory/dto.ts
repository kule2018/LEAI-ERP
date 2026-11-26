import { Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

const QTY = /^\d+(\.\d{1,3})?$/
const QTY_SIGNED = /^-?\d+(\.\d{1,3})?$/
const AMOUNT = /^\d+(\.\d{1,4})?$/

export class RecallFreezeDto {
  @IsInt() @Min(1) productId!: number
  @IsString() @IsNotEmpty() @MaxLength(60) batchNo!: string
  @IsString() @Matches(QTY) qty!: string
}

export class QueryInventoryDto extends PaginationDto {
  @IsOptional() @IsInt() @Min(1) warehouseId?: number
  @IsOptional() @IsInt() @Min(1) productId?: number
  @IsOptional() @IsString() @MaxLength(40) voucherType?: string
  @IsOptional() @IsString() @MaxLength(24) status?: string
  @IsOptional() @IsString() @MaxLength(60) batchNo?: string
}

/** 切换产品成本核算方法 */
export class ChangeCostingMethodDto {
  @IsIn(['MOVING_WEIGHTED', 'FIFO', 'BATCH']) method!: string
}

/** 成本重算期间锁定 */
export class CostPeriodLockDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string
}

export class StockMovementDto {
  @IsString() @IsNotEmpty() @MaxLength(40) voucherType!: string
  @IsInt() @Min(0) voucherId!: number
  @IsOptional() @IsInt() @Min(0) voucherLineId?: number
  @IsInt() @Min(1) warehouseId!: number
  @IsOptional() @IsInt() @Min(0) locationId?: number
  @IsInt() @Min(1) productId!: number
  @IsOptional() @IsInt() @Min(0) variantId?: number
  @IsOptional() @IsString() @MaxLength(60) batchNo?: string
  @IsOptional() @IsString() @Matches(QTY) qtyIn?: string
  @IsOptional() @IsString() @Matches(QTY) qtyOut?: string
  @IsOptional() @IsString() @Matches(AMOUNT) cost?: string
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class LockStockDto {
  @IsString() @IsNotEmpty() @MaxLength(32) sourceType!: string
  @IsInt() @Min(1) sourceId!: number
  @IsInt() @Min(1) warehouseId!: number
  @IsInt() @Min(1) productId!: number
  @IsOptional() @IsInt() @Min(0) variantId?: number
  @IsOptional() @IsString() @MaxLength(60) batchNo?: string
  @IsString() @Matches(QTY) qty!: string
}

export class CreateAlertDto {
  @IsString() @IsNotEmpty() @MaxLength(32) alertType!: string
  @IsInt() @Min(1) productId!: number
  @IsOptional() @IsInt() @Min(0) warehouseId?: number
  @IsString() @Matches(QTY) thresholdQty!: string
  @IsOptional() @IsString() @MaxLength(500) message?: string
}

export class CreateBatchProfileDto {
  @IsInt() @Min(1) productId!: number
  @IsOptional() @IsInt() @Min(1) variantId?: number
  @IsString() @IsNotEmpty() @MaxLength(60) batchNo!: string
  @IsOptional() @IsInt() @Min(1) warehouseId?: number
  @IsOptional() @IsDateString() expiryDate?: string
  @IsOptional() @IsInt() @Min(1) shelfLifeDays?: number
  @IsOptional() @IsString() @Matches(QTY) qty?: string
  @IsOptional() @IsIn(['NORMAL', 'EXPIRING', 'EXPIRED', 'FROZEN']) status?: string
  @IsOptional() @IsString() @MaxLength(255) remark?: string
}

export class QueryBatchProfileDto {
  @IsOptional() @IsInt() @Min(1) productId?: number
  @IsOptional() @IsString() @MaxLength(60) batchNo?: string
  @IsOptional() @IsInt() @Min(1) pageSize?: number
}

export class ScanAlertDto {
  @IsOptional() @IsInt() @Min(1) warnDays?: number
  @IsOptional() @IsInt() @Min(1) urgentDays?: number
}

export class CloseAlertDto {
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string
}

export class SaveAlertPolicyDto {
  /** 0 表示全局默认策略 */
  @IsOptional() @IsInt() @Min(0) productId?: number
  /** 0 表示全部仓库 */
  @IsOptional() @IsInt() @Min(0) warehouseId?: number
  @IsOptional() @IsInt() @Min(1) warnDays?: number
  @IsOptional() @IsInt() @Min(1) urgentDays?: number
  @IsOptional() @IsString() @Matches(QTY) safetyStock?: string
  @IsOptional() @IsInt() @Min(0) slowMovingDays?: number
  @IsOptional() @IsIn(['ENABLED', 'DISABLED']) status?: string
  @IsOptional() @IsString() @MaxLength(255) remark?: string
}

export class StocktakeLineDto {
  @IsInt() @Min(1) productId!: number
  @IsOptional() @IsInt() @Min(0) variantId?: number
  @IsOptional() @IsString() @MaxLength(60) batchNo?: string
  @IsString() @Matches(QTY) bookQty!: string
  @IsString() @Matches(QTY) actualQty!: string
}

export class CreateStocktakeDto {
  @IsInt() @Min(1) warehouseId!: number
  @IsOptional() @IsString() @MaxLength(10) planDate?: string
  @IsOptional() @IsInt() @Min(0) @Max(1) blindMode?: number
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => StocktakeLineDto) lines!: StocktakeLineDto[]
}

export class RecountStocktakeDto {
  @IsArray() @ArrayMinSize(1) lines!: Array<{ lineId: number; recountQty: string }>
}

export class RejectStocktakeApprovalDto {
  @IsOptional() @IsString() @MaxLength(200) reason?: string
}

export class StocktakeScanDto {
  @IsOptional() @IsInt() @Min(1) lineId?: number
  @IsOptional() @IsInt() @Min(1) productId?: number
  @IsOptional() @IsString() @MaxLength(60) batchNo?: string
  @IsOptional() @IsString() @MaxLength(80) barcode?: string
  @IsString() @Matches(QTY) qty!: string
}

export class ScanStocktakeDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => StocktakeScanDto) scans!: StocktakeScanDto[]
}

export class TransferReceiptLineDto {
  @IsInt() @Min(1) lineId!: number
  @IsString() @Matches(QTY) receivedQty!: string
}

export class ReceiveTransferDto {
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TransferReceiptLineDto) lines?: TransferReceiptLineDto[]
  @IsOptional() @IsString() @MaxLength(255) remark?: string
}

export class TransferLineDto {
  @IsInt() @Min(1) productId!: number
  @IsOptional() @IsInt() @Min(0) variantId?: number
  @IsOptional() @IsString() @MaxLength(60) batchNo?: string
  @IsString() @Matches(QTY) qty!: string
}

export class CreateTransferDto {
  @IsInt() @Min(1) fromWarehouseId!: number
  @IsInt() @Min(1) toWarehouseId!: number
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => TransferLineDto) lines!: TransferLineDto[]
}

export class CreatePutawayDto {
  @IsString() @IsNotEmpty() @MaxLength(32) sourceType!: string
  @IsInt() @Min(1) sourceId!: number
  @IsInt() @Min(1) warehouseId!: number
  @IsInt() @Min(1) locationId!: number
  @IsOptional() @IsString() @MaxLength(50) strategyCode?: string
}

export class PickTaskDto {
  @IsOptional() @IsString() @MaxLength(32) sourceType?: string
  @IsInt() @Min(1) sourceId!: number
  @IsInt() @Min(1) productId!: number
  @IsInt() @Min(1) warehouseId!: number
  @IsOptional() @IsInt() @Min(0) locationId?: number
  @IsString() @Matches(QTY) qty!: string
}

export class CreateWaveDto {
  @IsOptional() @IsInt() @Min(0) priority?: number
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PickTaskDto) tasks!: PickTaskDto[]
}

export class PickDto {
  @IsString() @Matches(QTY) qty!: string
}

export class AssemblyLineDto {
  @IsInt() @Min(1) productId!: number
  @IsOptional() @IsInt() @Min(0) variantId?: number
  @IsOptional() @IsString() @MaxLength(60) batchNo?: string
  @IsString() @Matches(QTY) qty!: string
}

export class CreateAssemblyDto {
  @IsIn(['ASSEMBLY', 'DISASSEMBLY']) assemblyType!: string
  @IsInt() @Min(1) productId!: number
  @IsInt() @Min(1) warehouseId!: number
  @IsString() @Matches(QTY) qty!: string
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => AssemblyLineDto) lines!: AssemblyLineDto[]
}

export class CreatePutawayStrategyDto {
  @IsOptional() @IsInt() @Min(0) warehouseId?: number
  @IsString() @IsNotEmpty() @MaxLength(100) strategyName!: string
  @IsIn(['TEMPERATURE', 'BATCH', 'VOLUME', 'TURNOVER', 'WEIGHT', 'ZONE']) ruleType!: string
  @IsOptional() @IsInt() @Min(1) priority?: number
  @IsOptional() @IsString() @MaxLength(120) ruleValue?: string
}

export class PutawayRecommendDto {
  @IsInt() @Min(1) warehouseId!: number
  @IsInt() @Min(1) productId!: number
  @IsOptional() @IsInt() @Min(0) locationId?: number
  @IsOptional() @IsString() @MaxLength(24) temperatureZone?: string
  @IsOptional() @IsInt() @Min(0) volume?: number
  @IsOptional() @IsInt() @Min(0) weight?: number
  @IsOptional() @IsInt() @Min(0) turnoverDays?: number
  @IsOptional() @IsString() @MaxLength(60) batchNo?: string
}

export class InventoryReportDto {
  @IsOptional() @IsString() @MaxLength(10) from?: string
  @IsOptional() @IsString() @MaxLength(10) to?: string
  @IsOptional() @IsInt() @Min(1) warehouseId?: number
  @IsOptional() @IsInt() @Min(1) productId?: number
}

export class CreateAdjustmentLineDto {
  @IsInt() @Min(1) productId!: number
  @IsOptional() @IsInt() @Min(0) variantId?: number
  @IsOptional() @IsString() @MaxLength(60) batchNo?: string
  /** 调整数量：正数盘盈、负数盘亏 */
  @IsString() @Matches(QTY_SIGNED) qty!: string
  @IsOptional() @IsString() @Matches(QTY) cost?: string
  @IsOptional() @IsString() @MaxLength(300) reason?: string
}

export class CreateAdjustmentDto {
  @IsIn(['GAIN', 'LOSS', 'SYSTEM']) adjustType!: string
  @IsOptional() @IsInt() @Min(1) warehouseId?: number
  @IsOptional() @IsString() @MaxLength(300) reason?: string
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateAdjustmentLineDto)
  lines!: CreateAdjustmentLineDto[]
}

export class PostAdjustmentDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string
}

/* ==================== 出入库单 ==================== */

export class QueryStockIoDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(32) ioType?: string
  @IsOptional() @IsString() @MaxLength(20) status?: string
  @IsOptional() @IsInt() @Min(1) warehouseId?: number
}

export class CreateStockIoLineDto {
  @IsInt() @Min(1) productId!: number
  @IsOptional() @IsInt() @Min(0) variantId?: number
  @IsOptional() @IsInt() @Min(0) locationId?: number
  @IsOptional() @IsString() @MaxLength(60) batchNo?: string
  @IsOptional() @IsString() @Matches(QTY) qtyIn?: string
  @IsOptional() @IsString() @Matches(QTY) qtyOut?: string
  @IsOptional() @IsString() @Matches(AMOUNT) unitCost?: string
  /** 是否暂估行 */
  @IsOptional() @IsBoolean() isProvisional?: boolean
  @IsOptional() @IsString() @MaxLength(300) remark?: string
}

export class CreateStockIoDto {
  @IsString() @IsNotEmpty() @MaxLength(32) ioType!: string
  @IsInt() @Min(1) warehouseId!: number
  @IsOptional() @IsString() @MaxLength(40) sourceType?: string
  @IsOptional() @IsInt() @Min(0) sourceId?: number
  @IsOptional() @IsString() @Matches(AMOUNT) provisionalAmount?: string
  @IsOptional() @IsDateString() docDate?: string
  @IsOptional() @IsString() @MaxLength(300) remark?: string
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateStockIoLineDto)
  lines!: CreateStockIoLineDto[]
}

export class PostStockIoDto {
  @IsOptional() @IsString() @MaxLength(300) remark?: string
}

export class ReverseStockIoDto {
  @IsString() @IsNotEmpty() @MaxLength(300) reason!: string
}

export class CreateStockIoAttachmentDto {
  @IsString() @IsNotEmpty() @MaxLength(200) fileName!: string
  @IsOptional() @IsString() @MaxLength(500) fileUrl?: string
  @IsOptional() @IsInt() @Min(0) fileSize?: number
}
