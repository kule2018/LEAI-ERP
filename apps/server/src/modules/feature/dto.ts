import { IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

export class QueryFeatureDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(60) module?: string
  @IsOptional() @IsString() @MaxLength(24) status?: string
}

export class CreateFeatureDto {
  @IsString() @IsNotEmpty() @MaxLength(80) code!: string
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string
  @IsString() @IsNotEmpty() @MaxLength(60) module!: string
  @IsOptional() @IsIn(['ON', 'OFF', 'GRAY']) status?: string
  @IsOptional() @IsArray() grayUsers?: number[]
  @IsOptional() @IsArray() grayRoles?: string[]
  @IsOptional() @IsInt() @Min(0) @Max(100) grayPercent?: number
}

export class UpdateFeatureDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string
  @IsOptional() @IsString() @MaxLength(60) module?: string
  @IsOptional() @IsIn(['ON', 'OFF', 'GRAY']) status?: string
  @IsOptional() @IsArray() grayUsers?: number[]
  @IsOptional() @IsArray() grayRoles?: string[]
  @IsOptional() @IsInt() @Min(0) @Max(100) grayPercent?: number
}
