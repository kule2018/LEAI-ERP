import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

export class CreateDictDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  dictType!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  dictName!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string
}

export class UpdateDictDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  dictName?: string

  @IsOptional()
  @IsIn(['ENABLED', 'DISABLED'])
  status?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string
}

export class QueryDictDto extends PaginationDto {}

export class CreateDictItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  dictType!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  itemCode!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  itemLabel!: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  itemValue?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sortNo?: number
}

export class UpdateDictItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  itemLabel?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  itemValue?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sortNo?: number

  @IsOptional()
  @IsIn(['ENABLED', 'DISABLED'])
  status?: string
}

export class QueryDictItemDto extends PaginationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  dictType!: string
}
