import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  content?: string

  @IsIn(['INMAIL', 'EMAIL', 'SMS', 'WECOM', 'DINGTALK'])
  channel!: string

  @IsInt()
  @Min(1)
  receiverId!: number

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bizType?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  bizId?: number
}

export class QueryNotificationDto extends PaginationDto {
  @IsOptional()
  @IsIn(['YES', 'NO'])
  readFlag?: string

  @IsOptional()
  @IsIn(['INMAIL', 'EMAIL', 'SMS', 'WECOM', 'DINGTALK'])
  channel?: string
}

export class QueryNotifySendRecordDto extends PaginationDto {
  @IsOptional()
  @IsIn(['SUCCESS', 'PENDING', 'FAILED'])
  sendStatus?: string

  @IsOptional()
  @IsIn(['INMAIL', 'EMAIL', 'SMS', 'WECOM', 'DINGTALK'])
  channel?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  templateCode?: string
}

export class UpdateNotificationDto {
  @IsOptional()
  @IsIn(['YES', 'NO'])
  readFlag?: string
}

export class CreateNotifyTemplateDto {
  @IsString() @IsNotEmpty() @MaxLength(64) code!: string
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string
  @IsString() @IsNotEmpty() @MaxLength(200) title!: string
  @IsString() @IsNotEmpty() @MaxLength(1000) content!: string
  @IsOptional() @IsString() @MaxLength(200) channels?: string
}

export class SendByTemplateDto {
  @IsInt() @Min(1) receiverId!: number
  @IsObject() variables!: Record<string, unknown>
  @IsOptional() @IsString() @MaxLength(24) level?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  @IsOptional() @IsString() @MaxLength(64) bizType?: string
  @IsOptional() @IsInt() @Min(0) bizId?: number
}

export class UpdateNotifyTemplateDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string
  @IsOptional() @IsString() @MaxLength(200) title?: string
  @IsOptional() @IsString() @MaxLength(1000) content?: string
  @IsOptional() @IsString() @MaxLength(200) channels?: string
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
}

export class QueryNotifyRuleDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  eventType?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bizType?: string

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean
}

export class CreateNotifyRuleDto {
  @IsString() @IsNotEmpty() @MaxLength(64) ruleCode!: string
  @IsString() @IsNotEmpty() @MaxLength(128) ruleName!: string
  @IsString() @IsNotEmpty() @MaxLength(64) eventType!: string
  @IsString() @IsNotEmpty() @MaxLength(64) bizType!: string
  @IsString() @IsNotEmpty() @MaxLength(64) templateCode!: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  channels?: string

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  level?: string

  @IsOptional()
  @IsIn(['USER', 'ROLE', 'BIZ_OWNER', 'ALL'])
  receiverType?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @Min(1, { each: true })
  receiverIds?: number[]

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  priority?: number

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string
}

export class UpdateNotifyRuleDto {
  @IsOptional() @IsString() @MaxLength(128) ruleName?: string
  @IsOptional() @IsString() @MaxLength(64) eventType?: string
  @IsOptional() @IsString() @MaxLength(64) bizType?: string
  @IsOptional() @IsString() @MaxLength(64) templateCode?: string
  @IsOptional() @IsString() @MaxLength(200) channels?: string
  @IsOptional() @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) level?: string
  @IsOptional() @IsIn(['USER', 'ROLE', 'BIZ_OWNER', 'ALL']) receiverType?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  @Min(1, { each: true })
  receiverIds?: number[]

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(9999)
  priority?: number

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string
}

export class DispatchNotifyEventDto {
  @IsObject()
  variables!: Record<string, unknown>

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  level?: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  bizType?: string

  @IsOptional()
  @IsInt()
  @Min(0)
  bizId?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  ownerUserId?: number
}

export class TestNotifyChannelDto {
  @IsIn(['INMAIL', 'EMAIL', 'SMS', 'WECOM', 'DINGTALK'])
  channel!: string

  @IsOptional() @IsString() @MaxLength(120) target?: string
}
