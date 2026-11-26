import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { PaginationDto } from '../../common/dto/pagination.dto'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { PurchaseP1Service } from './purchase-p1.service'

const guards = [AuthGuard, PermissionsGuard, DataScopeGuard]

@Controller('purchase/crossdocks')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class CrossDockController {
  constructor(private readonly service: PurchaseP1Service) {}
  @Get() @RequirePerm('purchase:crossdock:view')
  list(@Query() query: PaginationDto & { status?: string }, @CurrentUser() user: JwtUser) {
    return this.service.listCrossDocks(query, user)
  }
  @Post() @RequirePerm('purchase:crossdock:create')
  create(@Body() dto: {
    supplierId: number
    purchaseOrderId?: number
    saleOrderId?: number
    customerId?: number
    productId: number
    qty: string
    warehouseId?: number
    remark?: string
  }, @CurrentUser() user: JwtUser) {
    return this.service.createCrossDock(dto, user)
  }
  @Post(':id/:action') @RequirePerm('purchase:crossdock:create')
  transition(
    @Param('id', ParseIntPipe) id: number,
    @Param('action') action: string,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.transitionCrossDock(id, action.toUpperCase(), user)
  }
}

@Controller('purchase/fines')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class SupplierFineController {
  constructor(private readonly service: PurchaseP1Service) {}
  @Get() @RequirePerm('purchase:fine:view')
  list(@Query() query: PaginationDto & { supplierId?: number }, @CurrentUser() user: JwtUser) {
    return this.service.listFines(query, user)
  }
  @Post() @RequirePerm('purchase:fine:create')
  create(@Body() dto: {
    supplierId: number
    purchaseOrderId?: number
    fineType: string
    amount: string
    reason?: string
  }, @CurrentUser() user: JwtUser) {
    return this.service.createFine(dto, user)
  }
  @Post(':id/approve') @RequirePerm('purchase:fine:approve')
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.approveFine(id, user)
  }
  @Post(':id/deduct') @RequirePerm('purchase:fine:approve')
  deduct(@Param('id', ParseIntPipe) id: number, @Body() body: { amount: number }, @CurrentUser() user: JwtUser) {
    return this.service.deductFine(id, body.amount, user)
  }
}
