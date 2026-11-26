import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

export class QueryAdviceDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(24) status?: string
}

export class StartAdviceDto {
  @IsString() @IsNotEmpty() @MaxLength(150) productName!: string
  @IsNumber() @Min(0.001) shortageQty!: number
  @IsArray() @IsString({ each: true }) suppliers!: string[]
  @IsOptional() @IsString() @MaxLength(1000) ruleText?: string
}

export class AddQuoteDto {
  @IsString() @IsNotEmpty() @MaxLength(100) supplier!: string
  @IsIn(['EXCEL', 'PDF', 'IMAGE', 'MANUAL']) sourceType!: string
  @IsOptional() @IsString() @MaxLength(200) fileName?: string
  @IsNumber() @Min(0) unitPrice!: number
  @IsNumber() @Min(0) moq!: number
  @IsNumber() @Min(0) leadTimeDays!: number
  @IsBoolean() ruleOk!: boolean
  @IsOptional() @IsString() @MaxLength(1000) evidence?: string
}

export class ConfirmAdviceDto {
  @IsIn(['CONFIRM', 'REJECT']) decision!: string
  @IsOptional() @IsString() @MaxLength(500) note?: string
}
