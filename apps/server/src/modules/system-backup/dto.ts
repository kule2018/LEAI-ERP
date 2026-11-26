import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

export class QueryBackupDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(60) policyCode?: string
  @IsOptional() @IsIn(['FULL', 'INCREMENTAL']) backupType?: string
  @IsOptional() @IsIn(['RUNNING', 'SUCCESS', 'FAILED']) status?: string
}

export class CreateBackupPolicyDto {
  @IsString() @MaxLength(60) policyCode!: string
  @IsString() @MaxLength(120) policyName!: string
  @IsIn(['FULL', 'INCREMENTAL']) backupType!: string
  @IsInt() @Min(5) @Max(100000) intervalMinutes!: number
  @IsInt() @Min(1) @Max(3650) retentionDays!: number
  @IsString() @MaxLength(300) storagePath!: string
  @IsOptional() @IsString() @MaxLength(300) remotePath?: string
  @IsOptional() @IsBoolean() remoteEnabled?: boolean
}

export class UpdateBackupPolicyDto {
  @IsOptional() @IsString() @MaxLength(120) policyName?: string
  @IsOptional() @IsIn(['FULL', 'INCREMENTAL']) backupType?: string
  @IsOptional() @IsInt() @Min(5) @Max(100000) intervalMinutes?: number
  @IsOptional() @IsInt() @Min(1) @Max(3650) retentionDays?: number
  @IsOptional() @IsString() @MaxLength(300) storagePath?: string
  @IsOptional() @IsString() @MaxLength(300) remotePath?: string
  @IsOptional() @IsBoolean() remoteEnabled?: boolean
  @IsOptional() @IsIn(['ENABLED', 'DISABLED']) status?: string
}

export class ExecuteBackupDto {
  @IsOptional() @IsInt() @Min(1) policyId?: number
  @IsOptional() @IsIn(['FULL', 'INCREMENTAL']) backupType?: string
}

export class CreateRestoreDto {
  @IsInt() @Min(1) backupId!: number
  @IsOptional() @IsIn(['DRY_RUN', 'FULL']) restoreMode?: string
  @IsOptional() @IsString() @MaxLength(60) targetEnv?: string
  @IsOptional() @IsBoolean() confirmed?: boolean
  @IsOptional() @IsString() @MaxLength(300) operatorNote?: string
}
