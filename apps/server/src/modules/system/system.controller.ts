import { Body, Controller, Delete, Get, Param, ParseIntPipe, BadRequestException, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import {
  AssignPermissionsDto,
  AssignRolesDto,
  CreateCompanyDto,
  CreateDeptDto,
  CreateMenuDto,
  CreateOrgDto,
  CreatePermissionDto,
  CreatePositionDto,
  CreateRoleDto,
  CreateUserDto,
  QuerySystemDto,
  UpdateCompanyDto,
  UpdateDeptDto,
  UpdateMenuDto,
  UpdateOrgDto,
  UpdatePermissionDto,
  UpdatePositionDto,
  UpdateRoleDto,
  UpdateUserDto,
  UpsertConfigDto
} from './dto'
import { SystemService } from './system.service'
import { ConfigService, EXPORT_WATERMARK_ENABLED_KEY, EXPORT_WATERMARK_TEXT_KEY } from '../config/config.service'

@Controller('system')
@UseGuards(AuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope({ org: 'dept', level: 'ORG' })
export class SystemController {
  constructor(
    private readonly service: SystemService,
    private readonly configService: ConfigService
  ) {}

  /** 租户级系统参数列表 */
  @Get('configs')
  @RequirePerm('system:config:view')
  listConfigs(@CurrentUser() user: JwtUser) {
    return this.configService.list(user.tenantId)
  }

  /** 新增或更新系统参数 */
  @Post('configs')
  @RequirePerm('system:config:update')
  upsertConfig(@Body() dto: UpsertConfigDto, @CurrentUser() user: JwtUser) {
    return this.configService.upsert(user.tenantId, {
      configKey: dto.configKey,
      configValue: dto.configValue ?? null,
      valueType: dto.valueType,
      category: dto.category ?? null,
      remark: dto.remark ?? null
    }, user.userId)
  }

  /** 删除系统参数 */
  @Delete('configs/:key')
  @RequirePerm('system:config:update')
  removeConfig(@Param('key') key: string, @CurrentUser() user: JwtUser) {
    return this.configService.remove(user.tenantId, key).then(() => ({ removed: true }))
  }

  /** 读取导出水印策略 */
  @Get('export-watermark')
  @RequirePerm('system:export-watermark:view')
  getExportWatermark(@CurrentUser() user: JwtUser) {
    return this.configService.getExportWatermarkOptions(user.tenantId)
  }

  /** 保存导出水印策略 */
  @Post('export-watermark')
  @RequirePerm('system:config:update')
  async saveExportWatermark(@Body() dto: UpsertConfigDto, @CurrentUser() user: JwtUser) {
    if (dto.configKey !== EXPORT_WATERMARK_ENABLED_KEY && dto.configKey !== EXPORT_WATERMARK_TEXT_KEY) {
      throw new BadRequestException('不支持的水印参数键')
    }
    await this.configService.upsert(user.tenantId, {
      configKey: dto.configKey,
      configValue: dto.configValue ?? null,
      valueType: dto.configKey === EXPORT_WATERMARK_ENABLED_KEY ? 'BOOLEAN' : 'STRING',
      category: 'security',
      remark: dto.remark ?? null
    }, user.userId)
    return this.configService.getExportWatermarkOptions(user.tenantId)
  }

  @Get('companies')
  @RequirePerm('system:company:view')
  listCompanies(@Query() query: QuerySystemDto, @CurrentUser() user: JwtUser) {
    return this.service.listCompanies(query, user)
  }

  @Post('companies')
  @RequirePerm('system:company:create')
  createCompany(@Body() dto: CreateCompanyDto, @CurrentUser() user: JwtUser) {
    return this.service.createCompany(dto, user)
  }

  @Put('companies/:id')
  @RequirePerm('system:company:update')
  updateCompany(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCompanyDto, @CurrentUser() user: JwtUser) {
    return this.service.updateCompany(id, dto, user)
  }

  @Delete('companies/:id')
  @RequirePerm('system:company:delete')
  removeCompany(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.removeCompany(id, user)
  }

  @Get('orgs')
  @RequirePerm('system:org:view')
  listOrgs(@Query() query: QuerySystemDto, @CurrentUser() user: JwtUser) {
    return this.service.listOrgs(query, user)
  }

  @Post('orgs')
  @RequirePerm('system:org:create')
  createOrg(@Body() dto: CreateOrgDto, @CurrentUser() user: JwtUser) {
    return this.service.createOrg(dto, user)
  }

  @Put('orgs/:id')
  @RequirePerm('system:org:update')
  updateOrg(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrgDto, @CurrentUser() user: JwtUser) {
    return this.service.updateOrg(id, dto, user)
  }

  @Delete('orgs/:id')
  @RequirePerm('system:org:delete')
  removeOrg(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.removeOrg(id, user)
  }

  @Get('depts')
  @RequirePerm('system:dept:view')
  listDepts(@Query() query: QuerySystemDto, @CurrentUser() user: JwtUser) {
    return this.service.listDepts(query, user)
  }

  @Post('depts')
  @RequirePerm('system:dept:create')
  createDept(@Body() dto: CreateDeptDto, @CurrentUser() user: JwtUser) {
    return this.service.createDept(dto, user)
  }

  @Put('depts/:id')
  @RequirePerm('system:dept:update')
  updateDept(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDeptDto, @CurrentUser() user: JwtUser) {
    return this.service.updateDept(id, dto, user)
  }

  @Delete('depts/:id')
  @RequirePerm('system:dept:delete')
  removeDept(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.removeDept(id, user)
  }

  @Get('positions')
  @RequirePerm('system:position:view')
  listPositions(@Query() query: QuerySystemDto, @CurrentUser() user: JwtUser) {
    return this.service.listPositions(query, user)
  }

  @Post('positions')
  @RequirePerm('system:position:create')
  createPosition(@Body() dto: CreatePositionDto, @CurrentUser() user: JwtUser) {
    return this.service.createPosition(dto, user)
  }

  @Put('positions/:id')
  @RequirePerm('system:position:update')
  updatePosition(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePositionDto, @CurrentUser() user: JwtUser) {
    return this.service.updatePosition(id, dto, user)
  }

  @Delete('positions/:id')
  @RequirePerm('system:position:delete')
  removePosition(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.removePosition(id, user)
  }

  @Get('users')
  @RequirePerm('system:user:view')
  listUsers(@Query() query: QuerySystemDto, @CurrentUser() user: JwtUser) {
    return this.service.listUsers(query, user)
  }

  @Post('users')
  @RequirePerm('system:user:create')
  createUser(@Body() dto: CreateUserDto, @CurrentUser() user: JwtUser) {
    return this.service.createUser(dto, user)
  }

  @Put('users/:id')
  @RequirePerm('system:user:update')
  updateUser(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto, @CurrentUser() user: JwtUser) {
    return this.service.updateUser(id, dto, user)
  }

  @Delete('users/:id')
  @RequirePerm('system:user:delete')
  removeUser(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.removeUser(id, user)
  }

  @Post('users/:id/roles')
  @RequirePerm('system:user:update')
  assignUserRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignRolesDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.assignUserRoles(id, dto, user)
  }

  @Get('roles')
  @RequirePerm('system:role:view')
  listRoles(@Query() query: QuerySystemDto, @CurrentUser() user: JwtUser) {
    return this.service.listRoles(query, user)
  }

  @Post('roles')
  @RequirePerm('system:role:create')
  createRole(@Body() dto: CreateRoleDto, @CurrentUser() user: JwtUser) {
    return this.service.createRole(dto, user)
  }

  @Put('roles/:id')
  @RequirePerm('system:role:update')
  updateRole(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto, @CurrentUser() user: JwtUser) {
    return this.service.updateRole(id, dto, user)
  }

  @Delete('roles/:id')
  @RequirePerm('system:role:delete')
  removeRole(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.removeRole(id, user)
  }

  @Post('roles/:id/permissions')
  @RequirePerm('system:role:update')
  assignRolePermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignPermissionsDto,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.assignRolePermissions(id, dto, user)
  }

  /** 批量授权（含互斥校验） */
  @Post('permissions/batch-grant')
  @RequirePerm('system:permission:update')
  batchGrant(@Body() dto: {
    userIds?: number[]
    roleIds?: number[]
    permissionIds: number[]
    action?: string
  }, @CurrentUser() user: JwtUser) {
    return this.service.batchGrant(dto, user)
  }

  @Get('permissions')
  @RequirePerm('system:permission:view')
  listPermissions(@Query() query: QuerySystemDto, @CurrentUser() user: JwtUser) {
    return this.service.listPermissions(query, user)
  }

  @Post('permissions')
  @RequirePerm('system:permission:create')
  createPermission(@Body() dto: CreatePermissionDto, @CurrentUser() user: JwtUser) {
    return this.service.createPermission(dto, user)
  }

  @Put('permissions/:id')
  @RequirePerm('system:permission:update')
  updatePermission(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePermissionDto, @CurrentUser() user: JwtUser) {
    return this.service.updatePermission(id, dto, user)
  }

  @Delete('permissions/:id')
  @RequirePerm('system:permission:delete')
  removePermission(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.removePermission(id, user)
  }

  @Get('menus')
  @RequirePerm('system:menu:view')
  listMenus(@Query() query: QuerySystemDto, @CurrentUser() user: JwtUser) {
    return this.service.listMenus(query, user)
  }

  @Post('menus')
  @RequirePerm('system:menu:create')
  createMenu(@Body() dto: CreateMenuDto, @CurrentUser() user: JwtUser) {
    return this.service.createMenu(dto, user)
  }

  @Put('menus/:id')
  @RequirePerm('system:menu:update')
  updateMenu(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMenuDto, @CurrentUser() user: JwtUser) {
    return this.service.updateMenu(id, dto, user)
  }

  @Delete('menus/:id')
  @RequirePerm('system:menu:delete')
  removeMenu(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.removeMenu(id, user)
  }
}
