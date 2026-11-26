import { IsArray, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

export class QueryOpenApiDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(24) status?: string
}

export class UpdateStatusDto {
  @IsIn(['ACTIVE', 'DISABLED']) status!: 'ACTIVE' | 'DISABLED'
}

export class CreateApiKeyDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name!: string
  @IsArray() scopes!: string[]
  @IsOptional() @IsString() @MaxLength(30) expiresAt?: string
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
}

export class CreateWebhookDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name!: string
  @IsString() @IsNotEmpty() @MaxLength(500) url!: string
  @IsArray() eventTypes!: string[]
  @IsOptional() @IsString() @MaxLength(300) secret?: string
  @IsOptional() @IsInt() @Min(1) @Max(10) retryLimit?: number
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
}

export class UpdateWebhookDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string
  @IsOptional() @IsString() @MaxLength(500) url?: string
  @IsOptional() @IsArray() eventTypes?: string[]
  @IsOptional() @IsString() @MaxLength(300) secret?: string
  @IsOptional() @IsInt() @Min(1) @Max(10) retryLimit?: number
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
}

export class PublishEventDto {
  @IsString() @IsNotEmpty() @MaxLength(80) eventType!: string
  @IsObject() payload!: Record<string, unknown>
}
