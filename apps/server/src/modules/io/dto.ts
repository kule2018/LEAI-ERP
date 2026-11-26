import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'
import { PaginationDto } from '../../common/dto/pagination.dto'

export class QueryIoJobDto extends PaginationDto {}

export class ImportPreviewDto {
  @IsString()
  @IsNotEmpty()
  code!: string

  @IsString()
  @IsNotEmpty()
  content!: string
}

export class ImportCommitDto extends ImportPreviewDto {
  /** 为 true 时只导入正确行，错误行写入错误行表 */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  skipInvalid?: boolean
}

/** 导入批次 / 错误行查询 */
export class QueryIoImportTaskDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  code?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  batchNo?: string
}

export class ExportJobDto {
  @IsString()
  @IsNotEmpty()
  code!: string
}

/** 单条字段映射：上传列名 → 标准模板表头 */
export class ImportMappingItemDto {
  @IsString()
  @IsNotEmpty()
  sourceHeader!: string

  @IsString()
  @IsNotEmpty()
  targetHeader!: string
}

/** 字段映射保存（整体覆盖） */
export class SaveMappingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportMappingItemDto)
  mappings!: ImportMappingItemDto[]
}
