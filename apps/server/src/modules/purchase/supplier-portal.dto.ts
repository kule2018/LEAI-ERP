import { Type } from 'class-transformer'
import { IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

const AMOUNT = /^\d+(\.\d{1,4})?$/

/** 门户登录：外部供应商账号，与内部员工账号体系独立 */
export class PortalLoginDto {
  @IsOptional() @IsString() @MaxLength(30) tenantCode?: string
  @IsString() @IsNotEmpty() @MaxLength(60) username!: string
  @IsString() @IsNotEmpty() @MaxLength(64) password!: string
}

/** 门户账号创建（内部管理员操作） */
export class CreatePortalAccountDto {
  @IsInt() @Min(1) supplierId!: number
  @IsString() @IsNotEmpty() @MaxLength(60) username!: string
  @IsString() @IsNotEmpty() @MaxLength(64) password!: string
  @IsOptional() @IsString() @MaxLength(100) displayName?: string
  @IsOptional() @IsString() @MaxLength(30) phone?: string
  @IsOptional() @IsEmail() @MaxLength(120) email?: string
}

/** 门户账号启停 */
export class UpdatePortalAccountDto {
  @IsIn(['ACTIVE', 'DISABLED']) status!: string
}

/** 门户账号重置密码 */
export class ResetPortalPasswordDto {
  @IsString() @IsNotEmpty() @MaxLength(64) password!: string
}

/** 门户发货通知 */
export class PortalShipmentInputDto {
  @IsString() @IsNotEmpty() @MaxLength(80) waybillNo!: string
  @IsInt() @Min(1) carrierId!: number
  @IsOptional() @IsString() @MaxLength(32) sourceType?: string
  @IsOptional() @IsInt() @Min(1) sourceId?: number
  @IsOptional() @IsString() @Matches(AMOUNT) freightAmount?: string
}

/** 门户发票上传 */
export class PortalInvoiceInputDto {
  @IsString() @IsNotEmpty() @MaxLength(80) invoiceNo!: string
  @IsString() @Matches(AMOUNT) amount!: string
  @IsOptional() @IsString() @Matches(AMOUNT) taxAmount?: string
  @IsOptional() @IsInt() @Min(1) receiptId?: number
}

/** 门户业务单据列表查询 */
export class PortalQueryDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(24) status?: string
}

/** 门户密码修改 */
export class ChangePortalPasswordDto {
  @IsString() @IsNotEmpty() @MaxLength(64) oldPassword!: string
  @IsString() @IsNotEmpty() @MaxLength(64) newPassword!: string
}

export class PortalAccountQueryDto {
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) supplierId?: number
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) page?: number
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) pageSize?: number
}
