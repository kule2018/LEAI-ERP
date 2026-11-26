import { Type } from 'class-transformer'
import { IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const AMOUNT = /^\d+(\.\d{1,2})?$/

/** 合同类型 */
export const CONTRACT_TYPE_DTO = ['FIXED', 'OPEN_ENDED', 'OUTSOURCE', 'INTERN', 'SERVICE'] as const

export class CreateLaborContractDto {
  @IsInt() @Min(1) employeeId!: number
  @IsString() @IsNotEmpty() @MaxLength(40) contractNo!: string
  @IsIn(CONTRACT_TYPE_DTO) contractType!: string
  @IsOptional() @IsString() @MaxLength(120) partyA?: string
  @IsOptional() @IsString() @Matches(DATE) signDate?: string
  @IsString() @Matches(DATE) effectiveDate!: string
  /** 固定期限为年数；外包/实习/劳务为月数 */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(120) duration?: number
  /** 显式指定到期日（优先于 duration 推导） */
  @IsOptional() @IsString() @Matches(DATE) expiryDate?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) remindDays?: number
  @IsOptional() @IsString() @Matches(AMOUNT) salary?: string
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class RenewLaborContractDto {
  @IsOptional() @IsString() @MaxLength(40) contractNo?: string
  @IsString() @Matches(DATE) effectiveDate!: string
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(120) duration?: number
  @IsOptional() @IsString() @Matches(DATE) expiryDate?: string
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) salary?: number
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class TerminateLaborContractDto {
  @IsString() @Matches(DATE) terminateDate!: string
  @IsString() @IsNotEmpty() @MaxLength(300) reason!: string
}

export class QueryLaborContractDto extends PaginationDto {
  @IsOptional() @IsIn(['DRAFT', 'EFFECTIVE', 'EXPIRED', 'RENEWED', 'TERMINATED']) status?: string
  @IsOptional() @IsIn(CONTRACT_TYPE_DTO) contractType?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) employeeId?: number
  /** 仅看进入提醒窗口的合同 */
  @IsOptional() @IsString() expiringOnly?: string
}
