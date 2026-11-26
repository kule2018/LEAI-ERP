import { Type } from 'class-transformer'
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min, ValidateNested } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

const QTY = /^\d+(\.\d{1,3})?$/
const AMOUNT = /^\d+(\.\d{1,4})?$/

export class QueryManufacturingDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(24) status?: string
  @IsOptional() @IsInt() @Min(1) productId?: number
}

export class BomItemDto {
  @IsInt() @Min(1) materialId!: number
  @IsString() @Matches(QTY) qty!: string
  @IsOptional() @IsString() @Matches(AMOUNT) lossRate?: string
  @IsOptional() @IsInt() @Min(1) substituteMaterialId?: number
}

export class CreateBomDto {
  @IsInt() @Min(1) productId!: number
  @IsString() @IsNotEmpty() @MaxLength(20) version!: string
  @IsOptional() @IsString() @Matches(QTY) baseQty?: string
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => BomItemDto) items!: BomItemDto[]
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class CreateWorkCenterDto {
  @IsString() @IsNotEmpty() @MaxLength(50) centerCode!: string
  @IsString() @IsNotEmpty() @MaxLength(100) centerName!: string
  @IsOptional() @IsString() @Matches(QTY) capacity?: string
}

export class OperationDto {
  @IsString() @IsNotEmpty() @MaxLength(100) operationName!: string
  @IsOptional() @IsInt() @Min(1) workCenterId?: number
  @IsOptional() @IsString() @Matches(AMOUNT) standardMinutes?: string
  @IsOptional() @IsInt() @Min(0) sortNo?: number
}

export class CreateRoutingDto {
  @IsInt() @Min(1) productId!: number
  @IsString() @IsNotEmpty() @MaxLength(20) version!: string
  @IsOptional() @IsString() @MaxLength(10) effectiveFrom?: string
  @IsOptional() @IsString() @MaxLength(10) effectiveTo?: string
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => OperationDto) operations!: OperationDto[]
}

export class RunMrpDto {
  @IsOptional() @IsString() @MaxLength(10) planDate?: string
  /** 工厂 ID（按工厂关联仓库过滤可用库存） */
  @IsOptional() @IsInt() @Min(1) factoryId?: number
  /** 直接指定仓库 ID 集合；优先于工厂过滤 */
  @IsOptional() @IsArray() @IsInt({ each: true }) @Min(1, { each: true }) warehouseIds?: number[]
  /** 运算后按 PURCHASE 建议自动生成采购需求 */
  @IsOptional() @IsBoolean() generateDemands?: boolean
}

export class GenerateDemandsDto {
  @IsInt() @Min(1) runId!: number
}

export class PlanTaskDto {
  @IsString() @IsNotEmpty() @MaxLength(150) taskName!: string
  @IsOptional() @IsInt() @Min(1) workOrderId?: number
  @IsOptional() @IsInt() @Min(1) workCenterId?: number
  @IsString() @IsNotEmpty() @MaxLength(30) startAt!: string
  @IsString() @IsNotEmpty() @MaxLength(30) endAt!: string
}

export class CreatePlanTaskDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PlanTaskDto) tasks!: PlanTaskDto[]
}

export class UpdatePlanTaskDto {
  @IsOptional() @IsString() @MaxLength(30) startAt?: string
  @IsOptional() @IsString() @MaxLength(30) endAt?: string
  @IsOptional() @IsString() @MaxLength(150) taskName?: string
  /** 0 表示取消工作中心分配 */
  @IsOptional() @IsInt() @Min(0) workCenterId?: number
  @IsOptional() @IsIn(['PLANNED', 'RUNNING', 'DONE', 'CANCELLED']) status?: string
}

export class CreateWorkOrderDto {
  @IsInt() @Min(1) productId!: number
  @IsOptional() @IsInt() @Min(1) bomId?: number
  @IsOptional() @IsInt() @Min(1) routingId?: number
  @IsInt() @Min(1) warehouseId!: number
  @IsString() @Matches(QTY) qty!: string
  @IsOptional() @IsString() @MaxLength(30) planStart?: string
  @IsOptional() @IsString() @MaxLength(30) planEnd?: string
}

export class UpdateWorkOrderDto {
  @IsOptional() @IsIn(['DRAFT', 'SUBMITTED', 'APPROVED', 'RUNNING', 'PARTIAL', 'DONE', 'CANCELLED']) status?: string
  @IsOptional() @IsString() @MaxLength(30) planStart?: string
  @IsOptional() @IsString() @MaxLength(30) planEnd?: string
}

export class IssueDto {
  @IsIn(['PICK', 'RETURN']) issueType!: string
  @IsInt() @Min(1) materialId!: number
  @IsString() @Matches(QTY) qty!: string
  @IsOptional() @IsString() @MaxLength(60) batchNo?: string
  @IsOptional() @IsString() @MaxLength(120) scanCode?: string
}

export class ReportDto {
  @IsOptional() @IsInt() @Min(1) operationId?: number
  @IsString() @Matches(QTY) qty!: string
  @IsOptional() @IsString() @Matches(QTY) defectQty?: string
  @IsOptional() @IsString() @Matches(AMOUNT) workHours?: string
  @IsOptional() @IsString() @MaxLength(120) scanCode?: string
}

export class ByProductDto {
  @IsInt() @Min(1) productId!: number
  @IsString() @Matches(QTY) qty!: string
}

export class CompleteDto {
  @IsString() @Matches(QTY) qty!: string
  @IsOptional() @IsIn(['PENDING', 'PASS', 'FAIL']) qcResult?: string
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ByProductDto) byProducts?: ByProductDto[]
}

export class CreateQcDto {
  @IsString() @IsNotEmpty() @MaxLength(32) bizType!: string
  @IsInt() @Min(1) bizId!: number
  @IsString() @IsNotEmpty() @MaxLength(32) inspectionType!: string
  @IsOptional() @IsString() @Matches(QTY) sampleQty?: string
  @IsOptional() @IsString() @Matches(QTY) defectQty?: string
  @IsIn(['PASS', 'FAIL', 'CONCESSION']) result!: string
}

export class CreateEquipmentDto {
  @IsString() @IsNotEmpty() @MaxLength(50) equipmentCode!: string
  @IsString() @IsNotEmpty() @MaxLength(100) equipmentName!: string
  @IsOptional() @IsInt() @Min(1) workCenterId?: number
  @IsOptional() @IsString() @Matches(AMOUNT) oee?: string
  @IsOptional() @IsString() @MaxLength(10) lastMaintenance?: string
}

export class CreateExceptionDto {
  @IsString() @IsNotEmpty() @MaxLength(32) exceptionType!: string
  @IsOptional() @IsInt() @Min(1) workOrderId?: number
  @IsOptional() @IsString() @MaxLength(500) reason?: string
}

export class CloseExceptionDto {
  @IsString() @IsNotEmpty() @MaxLength(500) closedNote!: string
}

/* ------------------------------ 生产退料单 ------------------------------ */

export class MaterialReturnLineDto {
  @IsInt() @Min(1) materialId!: number
  @IsString() @Matches(QTY) qty!: string
  @IsOptional() @IsString() @MaxLength(60) batchNo?: string
  @IsOptional() @IsString() @MaxLength(300) remark?: string
}

export class CreateMaterialReturnDto {
  @IsInt() @Min(1) workOrderId!: number
  @IsOptional() @IsInt() @Min(1) warehouseId?: number
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => MaterialReturnLineDto)
  lines!: MaterialReturnLineDto[]
  @IsOptional() @IsString() @MaxLength(500) reason?: string
}

export class QueryMaterialReturnDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(16) status?: string
  @IsOptional() @IsInt() @Min(1) workOrderId?: number
}
