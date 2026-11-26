import { Type } from 'class-transformer'
import {
  ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested
} from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

const QTY = /^\d+(\.\d{1,3})?$/
const AMOUNT = /^\d+(\.\d{1,4})?$/

export class QueryManufacturingExtensionDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(24) status?: string
  @IsOptional() @IsInt() @Min(1) productId?: number
  @IsOptional() @IsInt() @Min(1) equipmentId?: number
  @IsOptional() @IsInt() @Min(1) workOrderId?: number
}

export class BomVersionDiffDto {
  @IsInt() @Min(1) baseId!: number
  @IsInt() @Min(1) targetId!: number
}

export class CreateBomChangeDto {
  @IsInt() @Min(1) bomId!: number
  @IsString() @IsNotEmpty() @MaxLength(20) toVersion!: string
  @IsOptional() @IsIn(['UPDATE', 'REPLACE', 'DISABLE']) changeType?: string
  @IsOptional() @IsString() @MaxLength(500) changeReason?: string
}

export class ApproveBomChangeDto {
  @IsBoolean() approve!: boolean
  @IsOptional() @IsString() @MaxLength(500) comment?: string
}

export class SplitWorkOrderDto {
  @IsString() @Matches(QTY) splitQty!: string
  @IsOptional() @IsString() @MaxLength(500) reason?: string
}

export class CreateWorkOrderChangeDto {
  @IsIn(['QTY', 'PLAN', 'ROUTING', 'CANCEL']) changeType!: string
  @IsOptional() @IsString() @Matches(QTY) qty?: string
  @IsOptional() @IsString() @MaxLength(30) planStart?: string
  @IsOptional() @IsString() @MaxLength(30) planEnd?: string
  @IsOptional() @IsInt() @Min(1) routingId?: number
  @IsOptional() @IsString() @MaxLength(500) changeReason?: string
}

export class ApproveWorkOrderChangeDto {
  @IsBoolean() approve!: boolean
  @IsOptional() @IsString() @MaxLength(500) comment?: string
}

export class LockPlanTaskDto {
  @IsBoolean() lock!: boolean
  @IsOptional() @IsString() @MaxLength(500) reason?: string
}

export class CreateQcItemDto {
  @IsInt() @Min(1) qcId!: number
  @IsString() @IsNotEmpty() @MaxLength(50) itemCode!: string
  @IsString() @IsNotEmpty() @MaxLength(100) itemName!: string
  @IsOptional() @IsString() @Matches(AMOUNT) standardValue?: string
  @IsOptional() @IsString() @Matches(AMOUNT) measuredValue?: string
  @IsOptional() @IsString() @Matches(AMOUNT) upperLimit?: string
  @IsOptional() @IsString() @Matches(AMOUNT) lowerLimit?: string
  @IsOptional() @IsBoolean() qualified?: boolean
}

export class CreateEquipmentFaultDto {
  @IsInt() @Min(1) equipmentId!: number
  @IsOptional() @IsIn(['MECHANICAL', 'ELECTRICAL', 'PROCESS', 'OTHER']) faultType?: string
  @IsOptional() @IsString() @MaxLength(500) faultDesc?: string
  @IsOptional() @IsInt() @Min(1) workOrderId?: number
  @IsOptional() @IsString() @MaxLength(30) stopLineAt?: string
  @IsOptional() @IsString() @MaxLength(30) stopLineEnd?: string
  @IsOptional() @IsString() @Matches(QTY) dailyCapacity?: string
}

export class RepairEquipmentFaultDto {
  @IsString() @IsNotEmpty() @MaxLength(500) repairResult!: string
  @IsOptional() @IsString() @MaxLength(30) repairedAt?: string
}

export class CreateMaintenanceDto {
  @IsInt() @Min(1) equipmentId!: number
  @IsOptional() @IsString() @MaxLength(10) planDate?: string
  @IsOptional() @IsInt() @Min(1) cycleDays?: number
  @IsOptional() @IsIn(['ROUTINE', 'PREDICTIVE', 'OVERHAUL']) maintenanceType?: string
  @IsOptional() @IsString() @MaxLength(500) maintenanceContent?: string
}

export class ExecuteMaintenanceDto {
  @IsOptional() @IsString() @MaxLength(500) executeResult?: string
  @IsOptional() @IsString() @MaxLength(30) executedAt?: string
}

export class ScanReportDto {
  @IsOptional() @IsString() @MaxLength(120) scanCode?: string
  @IsOptional() @IsInt() @Min(1) operationId?: number
  @IsString() @Matches(QTY) qty!: string
  @IsOptional() @IsString() @Matches(QTY) defectQty?: string
  @IsOptional() @IsString() @Matches(AMOUNT) workHours?: string
}

export class MrpSimulateDto {
  @IsOptional() @IsString() @MaxLength(10) planDate?: string
  @IsOptional() @IsInt() @Min(1) factoryId?: number
  @IsOptional() @IsString() @Matches(QTY) safetyQty?: string
  @IsOptional() @IsArray() @ArrayMinSize(1) @IsString({ each: true }) priorities?: string[]
}

export class ProductionAnalysisQueryDto {
  @IsOptional() @IsString() @MaxLength(10) from?: string
  @IsOptional() @IsString() @MaxLength(10) to?: string
  @IsOptional() @IsInt() @Min(1) productId?: number
}

export class ScheduleQueryDto {
  @IsOptional() @IsString() @MaxLength(30) from?: string
  @IsOptional() @IsString() @MaxLength(30) to?: string
  @IsOptional() @IsInt() @Min(1) days?: number
}

/** 拖拽排产改期 */
export class ReschedulePlanTaskDto {
  /** 新的开始时间（ISO 字符串） */
  @IsString() @IsNotEmpty() @MaxLength(30) startAt!: string
  /** 新的结束时间（可选，不传则保持原时长并自动累加换线时间） */
  @IsOptional() @IsString() @MaxLength(30) endAt?: string
  @IsOptional() @IsString() @MaxLength(500) reason?: string
  /** 忽略冲突提示强制改期 */
  @IsOptional() @IsBoolean() ignoreConflict?: boolean
}

/** 换线时间主数据 */
export class CreateChangeoverRuleDto {
  /** 工作中心（不传表示通用规则） */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) workCenterId?: number
  /** 前产品（不传表示通用） */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) fromProductId?: number
  /** 后产品（不传表示通用） */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) toProductId?: number
  /** 换线耗时（分钟） */
  @Type(() => Number) @IsInt() @Min(0) @Max(10080) minutes!: number
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

/** 换线记录查询 */
export class QueryChangeoverLogDto extends PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) workCenterId?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) planTaskId?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) fromProductId?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) toProductId?: number
}

export class StopLineDto {
  @IsString() @IsNotEmpty() @MaxLength(30) stopLineAt!: string
  @IsOptional() @IsString() @MaxLength(30) stopLineEnd?: string
  @IsOptional() @IsInt() @Min(1) impactOrderId?: number
  @IsOptional() @IsString() @Matches(QTY) dailyCapacity?: string
}

export class OverIssueApproveDto {
  @IsBoolean() approve!: boolean
  @IsOptional() @IsString() @MaxLength(500) comment?: string
}

export class BatchWorkOrderChangeDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateWorkOrderChangeDto) changes!: CreateWorkOrderChangeDto[]
}

