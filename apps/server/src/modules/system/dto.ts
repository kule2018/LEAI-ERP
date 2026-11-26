import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength
} from 'class-validator'
import { PaginationDto } from '../../common/dto/pagination.dto'

export type SystemDataScopeLevel = 'SELF' | 'DEPT' | 'DEPT_AND_CHILD' | 'ORG' | 'ALL'

export class QuerySystemDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(24) status?: string
}

export class IdListDto {
  @IsArray() ids!: number[]
}

export class CreateCompanyDto {
  @IsString() @IsNotEmpty() @MaxLength(60) companyCode!: string
  @IsString() @IsNotEmpty() @MaxLength(150) companyName!: string
  @IsOptional() @IsString() @MaxLength(50) creditCode?: string
  @IsOptional() @IsString() @MaxLength(60) legalPerson?: string
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
}

export class UpdateCompanyDto {
  @IsOptional() @IsString() @MaxLength(150) companyName?: string
  @IsOptional() @IsString() @MaxLength(50) creditCode?: string
  @IsOptional() @IsString() @MaxLength(60) legalPerson?: string
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
}

export class CreateOrgDto {
  @IsInt() @Min(1) companyId!: number
  @IsOptional() @IsInt() @Min(1) parentId?: number
  @IsString() @IsNotEmpty() @MaxLength(60) orgCode!: string
  @IsString() @IsNotEmpty() @MaxLength(150) orgName!: string
  @IsOptional() @IsString() @MaxLength(24) orgType?: string
  @IsOptional() @IsInt() @Min(0) sortNo?: number
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
}

export class UpdateOrgDto {
  @IsOptional() @IsInt() @Min(1) companyId?: number
  @IsOptional() @IsInt() @Min(1) parentId?: number
  @IsOptional() @IsString() @MaxLength(150) orgName?: string
  @IsOptional() @IsString() @MaxLength(24) orgType?: string
  @IsOptional() @IsInt() @Min(0) sortNo?: number
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
}

export class CreateDeptDto {
  @IsInt() @Min(1) orgId!: number
  @IsOptional() @IsInt() @Min(1) parentId?: number
  @IsString() @IsNotEmpty() @MaxLength(60) deptCode!: string
  @IsString() @IsNotEmpty() @MaxLength(150) deptName!: string
  @IsOptional() @IsInt() @Min(1) leaderUserId?: number
  @IsOptional() @IsInt() @Min(0) sortNo?: number
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
}

export class UpdateDeptDto {
  @IsOptional() @IsInt() @Min(1) orgId?: number
  @IsOptional() @IsInt() @Min(1) parentId?: number
  @IsOptional() @IsString() @MaxLength(150) deptName?: string
  @IsOptional() @IsInt() @Min(1) leaderUserId?: number
  @IsOptional() @IsInt() @Min(0) sortNo?: number
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
}

export class CreatePositionDto {
  @IsInt() @Min(1) orgId!: number
  @IsOptional() @IsInt() @Min(1) deptId?: number
  @IsString() @IsNotEmpty() @MaxLength(60) positionCode!: string
  @IsString() @IsNotEmpty() @MaxLength(150) positionName!: string
  @IsOptional() @IsString() @MaxLength(24) grade?: string
  @IsOptional() @IsInt() @Min(0) sortNo?: number
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
}

export class UpdatePositionDto {
  @IsOptional() @IsInt() @Min(1) orgId?: number
  @IsOptional() @IsInt() @Min(1) deptId?: number
  @IsOptional() @IsString() @MaxLength(150) positionName?: string
  @IsOptional() @IsString() @MaxLength(24) grade?: string
  @IsOptional() @IsInt() @Min(0) sortNo?: number
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
}

export class CreateUserDto {
  @IsString() @IsNotEmpty() @MaxLength(64) username!: string
  @IsString() @MinLength(6) @MaxLength(64) password!: string
  @IsString() @IsNotEmpty() @MaxLength(64) realName!: string
  @IsOptional() @IsInt() @Min(1) deptId?: number
  @IsOptional() @IsInt() @Min(1) orgId?: number
  @IsOptional() @IsString() @MaxLength(20) mobile?: string
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
  /** 是否要求用户首次登录后修改密码 */
  @IsOptional() @IsBoolean() mustChangePassword?: boolean
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(6) @MaxLength(64) password?: string
  @IsOptional() @IsString() @MaxLength(64) realName?: string
  @IsOptional() @IsInt() @Min(1) deptId?: number
  @IsOptional() @IsInt() @Min(1) orgId?: number
  @IsOptional() @IsString() @MaxLength(20) mobile?: string
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
  @IsOptional() @IsBoolean() mustChangePassword?: boolean
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class UpsertConfigDto {
  @IsString() @IsNotEmpty() @MaxLength(100) configKey!: string
  @IsOptional() @IsString() @MaxLength(4000) configValue?: string
  @IsOptional() @IsIn(['STRING', 'NUMBER', 'BOOLEAN', 'JSON']) valueType?: string
  @IsOptional() @IsString() @MaxLength(60) category?: string
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class CreateRoleDto {
  @IsString() @IsNotEmpty() @MaxLength(64) roleCode!: string
  @IsString() @IsNotEmpty() @MaxLength(128) roleName!: string
  @IsOptional() @IsIn(['SELF', 'DEPT', 'DEPT_AND_CHILD', 'ORG', 'ALL']) dataScopeLevel?: SystemDataScopeLevel
  @IsOptional() @IsInt() @Min(1) parentId?: number
  @IsOptional() @IsInt() @Min(0) sortNo?: number
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class UpdateRoleDto {
  @IsOptional() @IsString() @MaxLength(128) roleName?: string
  @IsOptional() @IsIn(['SELF', 'DEPT', 'DEPT_AND_CHILD', 'ORG', 'ALL']) dataScopeLevel?: SystemDataScopeLevel
  @IsOptional() @IsInt() @Min(1) parentId?: number
  @IsOptional() @IsInt() @Min(0) sortNo?: number
  @IsOptional() @IsIn(['ACTIVE', 'DISABLED']) status?: string
  @IsOptional() @IsString() @MaxLength(500) remark?: string
}

export class CreatePermissionDto {
  @IsString() @IsNotEmpty() @MaxLength(100) permCode!: string
  @IsString() @IsNotEmpty() @MaxLength(128) permName!: string
  @IsString() @IsNotEmpty() @MaxLength(24) permType!: string
  @IsOptional() @IsInt() @Min(1) parentId?: number
  @IsOptional() @IsInt() @Min(0) sortNo?: number
}

export class UpdatePermissionDto {
  @IsOptional() @IsString() @MaxLength(128) permName?: string
  @IsOptional() @IsString() @MaxLength(24) permType?: string
  @IsOptional() @IsInt() @Min(1) parentId?: number
  @IsOptional() @IsInt() @Min(0) sortNo?: number
}

export class CreateMenuDto {
  @IsOptional() @IsInt() @Min(1) parentId?: number
  @IsString() @IsNotEmpty() @MaxLength(128) menuName!: string
  @IsString() @IsNotEmpty() @MaxLength(200) routePath!: string
  @IsOptional() @IsString() @MaxLength(200) componentPath?: string
  @IsOptional() @IsString() @MaxLength(64) icon?: string
  @IsOptional() @IsString() @MaxLength(100) permCode?: string
  @IsOptional() @IsInt() @Min(0) sortNo?: number
  @IsOptional() @IsIn(['YES', 'NO']) hidden?: string
}

export class UpdateMenuDto {
  @IsOptional() @IsInt() @Min(1) parentId?: number
  @IsOptional() @IsString() @MaxLength(128) menuName?: string
  @IsOptional() @IsString() @MaxLength(200) routePath?: string
  @IsOptional() @IsString() @MaxLength(200) componentPath?: string
  @IsOptional() @IsString() @MaxLength(64) icon?: string
  @IsOptional() @IsString() @MaxLength(100) permCode?: string
  @IsOptional() @IsInt() @Min(0) sortNo?: number
  @IsOptional() @IsIn(['YES', 'NO']) hidden?: string
}

export class AssignRolesDto {
  @IsArray() roleIds!: number[]
}

export class AssignPermissionsDto {
  @IsArray() permissionIds!: number[]
}
