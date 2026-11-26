import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import {
  CreateShipmentExceptionDto,
  CreateTrackingNodeDto,
  ExchangeReturnDto,
  HandleShipmentExceptionDto,
  LinkWaveDto,
  QuerySalesDto
} from './dto'
import { SalesDeliveryService } from './sales-delivery.service'

const guards = [AuthGuard, PermissionsGuard, DataScopeGuard]

/** 出货物流轨迹 */
@Controller('sales/shipments')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class ShipmentTrackingController {
  constructor(private readonly service: SalesDeliveryService) {}

  @Get(':id/tracking') @RequirePerm('sales:shipment:view')
  timeline(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.shipmentTimeline(id, user) }

  @Post(':id/tracking') @RequirePerm('sales:shipment:tracking')
  addNode(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateTrackingNodeDto, @CurrentUser() user: JwtUser) { return this.service.addTrackingNode(id, dto, user) }
}

/** 出货拣货波次联动（复核后才可发货） */
@Controller('sales/shipments')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class ShipmentWaveController {
  constructor(private readonly service: SalesDeliveryService) {}

  @Get('waves/available') @RequirePerm('sales:shipment:view')
  waves(@CurrentUser() user: JwtUser) { return this.service.listShippableWaves(user) }

  @Post(':id/wave') @RequirePerm('sales:shipment:update')
  link(@Param('id', ParseIntPipe) id: number, @Body() dto: LinkWaveDto, @CurrentUser() user: JwtUser) { return this.service.linkShipmentWave(id, dto, user) }
}

/** 出货异常回单登记与处理 */
@Controller('sales/shipment-exceptions')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class ShipmentExceptionController {
  constructor(private readonly service: SalesDeliveryService) {}

  @Get() @RequirePerm('sales:shipment:exception')
  list(@Query() query: QuerySalesDto, @CurrentUser() user: JwtUser) { return this.service.listExceptions(query, user) }

  @Post(':id/handle') @RequirePerm('sales:shipment:exception')
  handle(@Param('id', ParseIntPipe) id: number, @Body() dto: HandleShipmentExceptionDto, @CurrentUser() user: JwtUser) { return this.service.handleException(id, dto, user) }
}

/** 出货异常登记（出货单详情直接登记） */
@Controller('sales/shipments')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class ShipmentExceptionRegisterController {
  constructor(private readonly service: SalesDeliveryService) {}

  @Post(':id/exceptions') @RequirePerm('sales:shipment:exception')
  register(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateShipmentExceptionDto, @CurrentUser() user: JwtUser) { return this.service.registerException(id, dto, user) }
}

/** 销售退货换货 */
@Controller('sales/returns')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class SaleReturnExchangeController {
  constructor(private readonly service: SalesDeliveryService) {}

  @Get(':id/detail') @RequirePerm('sales:return:view')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.getReturnDetail(id, user) }

  @Get(':id/exchanges') @RequirePerm('sales:return:view')
  exchanges(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.listExchanges(id, user) }

  @Post(':id/exchange') @RequirePerm('sales:return:exchange')
  exchange(@Param('id', ParseIntPipe) id: number, @Body() dto: ExchangeReturnDto, @CurrentUser() user: JwtUser) { return this.service.exchangeReturn(id, dto, user) }
}
