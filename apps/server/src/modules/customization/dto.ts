import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

const FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'DATETIME', 'SELECT', 'MULTI_SELECT', 'BOOLEAN', 'REFERENCE']
const CONDITION_OPERATORS = ['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'CONTAINS']

export class CustomFieldOptionDto {
  @IsString()
  @MaxLength(64)
  label!: string

  @IsString()
  @MaxLength(64)
  value!: string
}

export class CustomFieldConditionDto {
  @IsString()
  @MaxLength(64)
  fieldKey!: string

  @IsIn(CONDITION_OPERATORS)
  operator!: string

  @IsOptional()
  value?: unknown
}

export class QueryCustomFieldDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityCode?: string

  @IsOptional()
  @IsString()
  @MaxLength(24)
  fieldType?: string
}

export class CreateCustomFieldDto {
  @IsString()
  @MaxLength(64)
  entityCode!: string

  @IsString()
  @MaxLength(64)
  fieldKey!: string

  @IsString()
  @MaxLength(128)
  fieldLabel!: string

  @IsOptional()
  @IsIn(FIELD_TYPES)
  fieldType?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CustomFieldOptionDto)
  options?: CustomFieldOptionDto[]

  @IsOptional()
  @IsString()
  @MaxLength(500)
  defaultValue?: string

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  required?: boolean

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  visibleInList?: boolean

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  allowFilter?: boolean

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxLength?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  min?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  max?: number

  @IsOptional()
  @IsString()
  @MaxLength(255)
  pattern?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  groupName?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number

  @IsOptional()
  @IsString()
  @MaxLength(64)
  referenceType?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomFieldConditionDto)
  condition?: CustomFieldConditionDto

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string
}

export class UpdateCustomFieldDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  fieldLabel?: string

  @IsOptional()
  @IsIn(FIELD_TYPES)
  fieldType?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CustomFieldOptionDto)
  options?: CustomFieldOptionDto[]

  @IsOptional()
  @IsString()
  @MaxLength(500)
  defaultValue?: string

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  required?: boolean

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  visibleInList?: boolean

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  allowFilter?: boolean

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxLength?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  min?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  max?: number

  @IsOptional()
  @IsString()
  @MaxLength(255)
  pattern?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  groupName?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number

  @IsOptional()
  @IsString()
  @MaxLength(64)
  referenceType?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomFieldConditionDto)
  condition?: CustomFieldConditionDto

  @IsOptional()
  @IsString()
  @MaxLength(24)
  status?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string
}

export class QueryCustomFormDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityCode?: string
}

export class CreateCustomFormDto {
  @IsString()
  @MaxLength(64)
  formCode!: string

  @IsString()
  @MaxLength(128)
  formName!: string

  @IsString()
  @MaxLength(64)
  entityCode!: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsObject({ each: true })
  layout?: Array<Record<string, unknown>>

  @IsOptional()
  @IsString()
  @MaxLength(24)
  status?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string
}

export class UpdateCustomFormDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  formName?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsObject({ each: true })
  layout?: Array<Record<string, unknown>>

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number

  @IsOptional()
  @IsString()
  @MaxLength(24)
  status?: string

  @IsOptional()
  @IsString()
  @MaxLength(255)
  remark?: string
}

export class SaveCustomValuesDto {
  @IsObject()
  values!: Record<string, unknown>
}

/** 批量读取自定义字段取值（列表页动态列使用） */
export class BatchCustomValuesDto {
  @IsString()
  @MaxLength(64)
  entityCode!: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  @Min(1)
  bizIds?: number[]
}
