import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

export class CreateSequenceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  bizCode!: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bizName?: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  numberPrefix!: string

  @IsOptional()
  @IsString()
  @MaxLength(20)
  dateFormat?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  stepValue?: number

  @IsOptional()
  @IsIn(['DAILY', 'MONTHLY', 'YEARLY'])
  resetCycle?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string
}

export class UpdateSequenceDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bizName?: string

  @IsOptional()
  @IsString()
  @MaxLength(20)
  numberPrefix?: string

  @IsOptional()
  @IsString()
  @MaxLength(20)
  dateFormat?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  stepValue?: number

  @IsOptional()
  @IsIn(['DAILY', 'MONTHLY', 'YEARLY'])
  resetCycle?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string
}

export class QuerySequenceDto extends PaginationDto {}

export class NextSequenceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  bizCode!: string
}
