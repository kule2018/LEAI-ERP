import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

export class CreateIntegrationDto {
  @IsIn(['WECHAT', 'DINGTALK']) channel!: 'WECHAT' | 'DINGTALK'
  @IsString() @IsNotEmpty() @MaxLength(100) name!: string
  @IsString() @IsNotEmpty() @MaxLength(500) webhookUrl!: string
  @IsOptional() @IsString() @MaxLength(300) secret?: string
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
}

export class UpdateIntegrationDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string
  @IsOptional() @IsString() @MaxLength(500) webhookUrl?: string
  @IsOptional() @IsString() @MaxLength(300) secret?: string
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
}

export class SendTodoDto {
  @IsString() @IsNotEmpty() @MaxLength(150) title!: string
  @IsOptional() @IsString() @MaxLength(4000) content?: string
  @IsOptional() @IsString() @MaxLength(100) assignee?: string
  @IsOptional() @IsInt() @Min(1) taskId?: number
}

export class QueryIntegrationDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(24) channel?: string
  @IsOptional() @IsString() @MaxLength(24) status?: string
}
