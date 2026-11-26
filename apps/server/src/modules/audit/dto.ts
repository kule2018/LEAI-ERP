import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

export class QueryAuditDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  bizType?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  action?: string
}

/** 审计字段级差异查询 */
export class QueryAuditFieldLogDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  bizType?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bizId?: number

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fieldKey?: string
}
