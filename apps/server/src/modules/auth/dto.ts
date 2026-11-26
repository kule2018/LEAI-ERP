import { IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator'

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  username!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tenantCode?: string

  /** 开启 MFA 后的动态验证码 */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  mfaCode?: string

  /** 风控触发时的验证码凭据 */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  captchaId?: string

  @IsOptional()
  @IsString()
  @MaxLength(20)
  captchaAnswer?: string
}

export class MfaCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  code!: string
}

export class SsoCallbackDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  code!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  state!: string
}

export class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken!: string
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  oldPassword!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  newPassword!: string
}

export class QueryLoginLogDto {
  @IsOptional() @IsInt() @Min(1) page?: number
  @IsOptional() @IsInt() @Min(1) pageSize?: number
  @IsOptional() @IsString() @MaxLength(64) username?: string
  @IsOptional() @IsIn(['SUCCESS', 'FAIL', 'LOCKED']) loginResult?: string
  @IsOptional() @IsDateString() startDate?: string
  @IsOptional() @IsDateString() endDate?: string
}
