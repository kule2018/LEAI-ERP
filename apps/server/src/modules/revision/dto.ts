import { Type } from 'class-transformer'
import { IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

export class QueryRevisionSnapshotDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityCode?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bizId?: number

  @IsOptional()
  @IsString()
  @MaxLength(32)
  action?: string
}

export class RecordRevisionSnapshotDto {
  @IsString()
  @MaxLength(64)
  entityCode!: string

  @Type(() => Number)
  @IsInt()
  @Min(1)
  bizId!: number

  @IsOptional()
  @IsString()
  @MaxLength(32)
  action?: string

  @IsObject()
  snapshot!: Record<string, unknown>

  @IsOptional()
  @IsString()
  @MaxLength(32)
  source?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string
}
