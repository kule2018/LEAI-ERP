import { Type } from 'class-transformer'
import { IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class SaveViewConfigDto {
  @IsObject()
  config!: Record<string, unknown>
}

/** 保存草稿内容 */
export class SaveDraftDto {
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>
}

/** 快捷搜索历史记录 */
export class RecordSearchKeywordDto {
  @IsString()
  @MaxLength(128)
  keyword!: string
}

export class QueryFavoriteDto {
  @IsOptional()
  @IsString()
  @MaxLength(24)
  targetType?: string
}

export class CreateFavoriteDto {
  @IsOptional()
  @IsString()
  @MaxLength(24)
  targetType?: string

  @IsString()
  @MaxLength(128)
  targetKey!: string

  @IsString()
  @MaxLength(128)
  title!: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  route?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bizType?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bizId?: number

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string
}
