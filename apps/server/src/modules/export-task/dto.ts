import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

/** 创建导出任务 */
export class CreateExportTaskDto {
  /** 资源代码（customer/product/...） */
  @IsString()
  @IsNotEmpty()
  code!: string

  /** 业务域标识（可选） */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  bizType?: string

  /** 附加参数（筛选条件等） */
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>
}

/** 导出任务查询 */
export class QueryExportTaskDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  status?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  code?: string
}
