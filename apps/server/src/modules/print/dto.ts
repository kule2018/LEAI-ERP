import { IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

export class CreatePrintTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  bizType!: string

  @IsOptional()
  @IsString()
  @MaxLength(32)
  paper?: string

  @IsOptional()
  @IsObject()
  schema?: Record<string, unknown>
}

export class UpdatePrintTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(32)
  paper?: string

  @IsOptional()
  @IsObject()
  schema?: Record<string, unknown>

  @IsOptional()
  @IsIn(['YES', 'NO'])
  isActive?: string

  @IsOptional()
  @IsIn(['YES', 'NO'])
  isDefault?: string
}

export class QueryPrintTemplateDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  bizType?: string
}

export class CreatePrintJobDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  bizType!: string

  @IsInt()
  @Min(1)
  bizId!: number

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bizNo?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  templateCode?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  copies?: number

  @IsOptional()
  @IsIn(['SERVER_PDF', 'CLIENT'])
  channel?: string
}

export class QueryPrintRecordDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  bizType?: string
}

export class QueryPrintJobDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(24)
  status?: string
}

export class BatchCreateLabelDto {
  @IsInt()
  @Min(1)
  labelTemplateId!: number

  @IsInt()
  @Min(1)
  productId!: number

  @IsOptional()
  @IsInt()
  @Min(0)
  variantId?: number

  @IsOptional()
  @IsString()
  @MaxLength(60)
  batchNo?: string

  @IsInt()
  @Min(1)
  @Max(500)
  count!: number

  @IsOptional()
  @IsString()
  @MaxLength(60)
  ruleCode?: string
}

export class QueryLabelInstanceDto extends PaginationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  productId?: number

  @IsOptional()
  @IsString()
  @MaxLength(24)
  status?: string
}

export class CreateBarcodeRuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  ruleCode!: string

  @IsOptional()
  @IsString()
  @MaxLength(20)
  prefix?: string

  @IsOptional()
  @IsString()
  @MaxLength(16)
  dateFormat?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  seqLength?: number

  @IsOptional()
  @IsIn(['NONE', 'DAILY', 'MONTHLY', 'YEARLY'])
  resetCycle?: string

  @IsOptional()
  @IsIn(['CODE128', 'EAN13', 'QR', 'DATAMATRIX'])
  barcodeType?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string
}

export class UpdateBarcodeRuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  prefix?: string

  @IsOptional()
  @IsString()
  @MaxLength(16)
  dateFormat?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  seqLength?: number

  @IsOptional()
  @IsIn(['NONE', 'DAILY', 'MONTHLY', 'YEARLY'])
  resetCycle?: string

  @IsOptional()
  @IsIn(['CODE128', 'EAN13', 'QR', 'DATAMATRIX'])
  barcodeType?: string

  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string
}

export class CreatePrintLabelDto {

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  labelCode!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  labelName!: string

  @IsOptional()
  @IsString()
  @MaxLength(24)
  barcodeType?: string

  @IsOptional()
  @IsString()
  @MaxLength(30)
  paperSize?: string

  @IsOptional()
  @IsObject()
  schema?: Record<string, unknown>
}
