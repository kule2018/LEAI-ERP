import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import type { DataScopeLevel } from '../../common/contracts'
import { PaginationDto } from '../../common/dto/pagination.dto'

const SCOPE_LEVELS = ['SELF', 'DEPT', 'DEPT_AND_CHILD', 'ORG', 'ALL'] as const

export class CreateDataScopeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  scopeCode!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  scopeName!: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bizType?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  orgField?: string

  @IsIn(SCOPE_LEVELS)
  scopeLevel!: DataScopeLevel

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  priority?: number
}

export class UpdateDataScopeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  scopeName?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bizType?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  orgField?: string

  @IsOptional()
  @IsIn(SCOPE_LEVELS)
  scopeLevel?: DataScopeLevel

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  priority?: number

  @IsOptional()
  @IsIn(['ENABLED', 'DISABLED'])
  status?: string
}

export class QueryDataScopeDto extends PaginationDto {}
