import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min
} from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

const COMPARATORS = ['GT', 'GTE', 'LT', 'LTE', 'EQ', 'NEQ']
const SEVERITIES = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

export class QueryAlertRuleDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  bizType?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  metric?: string

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean
}

export class CreateAlertRuleDto {
  @IsString()
  @MaxLength(64)
  ruleCode!: string

  @IsString()
  @MaxLength(128)
  ruleName!: string

  @IsString()
  @MaxLength(64)
  bizType!: string

  @IsString()
  @MaxLength(64)
  metric!: string

  @IsOptional()
  @IsIn(COMPARATORS)
  comparator?: string

  @Type(() => Number)
  @IsNumber()
  threshold!: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  windowMinutes?: number

  @IsOptional()
  @IsIn(SEVERITIES)
  severity?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  notifyChannels?: string[]

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string
}

export class UpdateAlertRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  ruleName?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bizType?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  metric?: string

  @IsOptional()
  @IsIn(COMPARATORS)
  comparator?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  threshold?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  windowMinutes?: number

  @IsOptional()
  @IsIn(SEVERITIES)
  severity?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  notifyChannels?: string[]

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string
}
