import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser, PortalUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { SupplierPortalGuard } from '../../common/guards/supplier-portal.guard'
import {
  CreatePortalAccountDto,
  PortalAccountQueryDto,
  PortalInvoiceInputDto,
  PortalLoginDto,
  PortalQueryDto,
  PortalShipmentInputDto,
  ResetPortalPasswordDto,
  UpdatePortalAccountDto
} from './supplier-portal.dto'
import { SupplierPortalService } from './supplier-portal.service'

interface PortalRequest {
  portalUser: PortalUser
  headers: Record<string, string | undefined>
  ip?: string
}

/**
 * 供应商门户对外接口：外部供应商人员使用独立令牌登录，
 * 全部数据按令牌中的供应商主体隔离，不使用内部员工权限码。
 */
/**
 * 供应商门户认证接口：登录不校验令牌，其余接口需门户令牌。
 */
@Controller('purchase/external/portal/auth')
export class SupplierPortalAuthController {
  constructor(private readonly service: SupplierPortalService) {}

  @Post('login')
  async login(@Body() dto: PortalLoginDto, @Req() request: PortalRequest) {
    return this.service.login(dto, {
      ip: request.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ?? request.ip,
      userAgent: request.headers?.['user-agent']
    })
  }

  @Post('logout')
  @UseGuards(SupplierPortalGuard)
  async logout(@Req() request: PortalRequest) {
    await this.service.logout(request.portalUser)
    return { loggedOut: true }
  }

  @Get('profile')
  @UseGuards(SupplierPortalGuard)
  profile(@Req() request: PortalRequest) {
    return this.service.profile(request.portalUser)
  }
}

/**
 * 供应商门户对外接口：外部供应商人员使用独立令牌登录，
 * 全部数据按令牌中的供应商主体隔离，不使用内部员工权限码。
 */
@Controller('purchase/external/portal')
@UseGuards(SupplierPortalGuard)
export class SupplierPortalExternalController {
  constructor(private readonly service: SupplierPortalService) {}

  @Get('summary')
  summary(@Req() request: PortalRequest) {
    return this.service.summary(request.portalUser)
  }

  @Get('orders')
  orders(@Query() query: PortalQueryDto, @Req() request: PortalRequest) {
    return this.service.listOrders(request.portalUser, query)
  }

  @Get('orders/:id')
  orderDetail(@Param('id', ParseIntPipe) id: number, @Req() request: PortalRequest) {
    return this.service.orderDetail(request.portalUser, id)
  }

  @Post('orders/:id/confirm')
  confirmOrder(@Param('id', ParseIntPipe) id: number, @Req() request: PortalRequest) {
    return this.service.confirmOrder(request.portalUser, id)
  }

  @Get('statements')
  statements(@Query() query: PortalQueryDto, @Req() request: PortalRequest) {
    return this.service.listStatements(request.portalUser, query)
  }

  @Post('statements/:id/confirm')
  confirmStatement(@Param('id', ParseIntPipe) id: number, @Req() request: PortalRequest) {
    return this.service.confirmStatement(request.portalUser, id)
  }

  @Get('shipments')
  shipments(@Query() query: PortalQueryDto, @Req() request: PortalRequest) {
    return this.service.listShipments(request.portalUser, query)
  }

  @Post('shipments')
  createShipment(@Body() dto: PortalShipmentInputDto, @Req() request: PortalRequest) {
    return this.service.createShipment(request.portalUser, dto)
  }

  @Get('invoices')
  invoices(@Query() query: PortalQueryDto, @Req() request: PortalRequest) {
    return this.service.listInvoices(request.portalUser, query)
  }

  @Post('invoices')
  createInvoice(@Body() dto: PortalInvoiceInputDto, @Req() request: PortalRequest) {
    return this.service.createInvoice(request.portalUser, dto)
  }

  @Get('actions')
  actions(@Query() query: PortalQueryDto, @Req() request: PortalRequest) {
    return this.service.listPortalActions(request.portalUser, query.page ?? 1, query.pageSize ?? 20)
  }
}

/**
 * 门户账号管理（内部采购管理员）：创建外部账号、启停与重置密码。
 */
@Controller('purchase/portal/accounts')
@UseGuards(AuthGuard, PermissionsGuard, DataScopeGuard)
@DataScope({ org: 'dept', level: 'ORG' })
export class SupplierPortalAccountController {
  constructor(private readonly service: SupplierPortalService) {}

  @Get() @RequirePerm('purchase:portal:manage')
  list(@Query() query: PortalAccountQueryDto, @CurrentUser() user: JwtUser) {
    return this.service.listAccounts(query, user)
  }

  @Post() @RequirePerm('purchase:portal:manage')
  create(@Body() dto: CreatePortalAccountDto, @CurrentUser() user: JwtUser) {
    return this.service.createAccount(dto, user)
  }

  @Patch(':id/status') @RequirePerm('purchase:portal:manage')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePortalAccountDto, @CurrentUser() user: JwtUser) {
    return this.service.updateAccountStatus(id, dto, user)
  }

  @Post(':id/reset-password') @RequirePerm('purchase:portal:manage')
  resetPassword(@Param('id', ParseIntPipe) id: number, @Body() dto: ResetPortalPasswordDto, @CurrentUser() user: JwtUser) {
    return this.service.resetPassword(id, dto, user)
  }
}
