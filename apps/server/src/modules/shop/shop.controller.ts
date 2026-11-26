import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import {
  ApproveRefundDto, CreateCouponDto, CreateCsConversationDto, CreateGoodsMapDto, CreatePaymentConfigDto,
  CreateCsQcDto, CreatePromotionDto, CreateRefundDto, CreateSeckillDto, CreateShopOrderDto,
  CreateStoreDto, GenerateWaybillDto, ImportReconcileDto, PushTrackingDto,
  QueryShopDto, QuickReplyDto, ReconcileDto, RejectRefundDto, ReplyCsDto,
  ReserveActivityStockDto, ResolveReconcileDto, SetActivityStockDto,
  ShipShopOrderDto, ValidateCouponDto
} from './dto'
import { RequireFeature } from '../feature/decorators/require-feature.decorator'
import { FeatureGuard } from '../feature/guards/feature.guard'
import { ShopService } from './shop.service'

const guards = [AuthGuard, PermissionsGuard, DataScopeGuard, FeatureGuard]

@Controller('shop/stores')
@UseGuards(...guards)
@RequireFeature('shop.enabled')
@DataScope({ org: 'dept', level: 'ORG' })
export class ShopStoreController {
  constructor(private readonly service: ShopService) {}
  @Get() @RequirePerm('shop:store:view')
  list(@Query() query: QueryShopDto, @CurrentUser() user: JwtUser) { return this.service.listStores(query, user) }
  @Post() @RequirePerm('shop:store:create')
  create(@Body() dto: CreateStoreDto, @CurrentUser() user: JwtUser) { return this.service.createStore(dto, user) }
  @Post(':id/health') @RequirePerm('shop:store:update')
  health(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.checkStore(id, user) }

  @Get('auth-expiry-alerts')
  @RequirePerm('shop:store:view')
  authExpiryAlerts(@Query('days') days: string, @CurrentUser() user: JwtUser) {
    return this.service.authExpiryAlerts(user, Number(days) || 30)
  }
}

@Controller('shop/goods-maps')
@UseGuards(...guards)
@RequireFeature('shop.enabled')
@DataScope({ org: 'dept', level: 'ORG' })
export class ShopGoodsMapController {
  constructor(private readonly service: ShopService) {}
  @Get() @RequirePerm('shop:goods:view')
  list(@Query() query: QueryShopDto, @CurrentUser() user: JwtUser) { return this.service.listGoodsMaps(query, user) }
  @Post() @RequirePerm('shop:goods:create')
  create(@Body() dto: CreateGoodsMapDto, @CurrentUser() user: JwtUser) { return this.service.createGoodsMap(dto, user) }
  @Post('retry-failed') @RequirePerm('shop:goods:update')
  retryFailed(@CurrentUser() user: JwtUser) { return this.service.retryFailedGoodsMaps(user) }
  @Post(':id/sync') @RequirePerm('shop:goods:update')
  sync(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.syncGoodsMap(id, user) }
}

@Controller('shop/orders')
@UseGuards(...guards)
@RequireFeature('shop.enabled')
@DataScope({ org: 'dept', level: 'ORG' })
export class ShopOrderController {
  constructor(private readonly service: ShopService) {}
  @Get() @RequirePerm('shop:order:view')
  list(@Query() query: QueryShopDto, @CurrentUser() user: JwtUser) { return this.service.listOrders(query, user) }
  @Post('sync') @RequirePerm('shop:order:sync')
  sync(@Body() dto: CreateShopOrderDto, @CurrentUser() user: JwtUser) { return this.service.syncOrder(dto, user) }
  @Post(':id/retry') @RequirePerm('shop:order:sync')
  retry(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.retryFailedOrder(id, user) }
  @Post('retry-batch') @RequirePerm('shop:order:sync')
  retryBatch() { return this.service.retryFailedOrdersBatch() }
  @Post(':id/waybill/generate') @RequirePerm('shop:order:ship')
  generateWaybill(@Param('id', ParseIntPipe) id: number, @Body() dto: GenerateWaybillDto, @CurrentUser() user: JwtUser) { return this.service.generateWaybillLabel(id, dto, user) }
  @Post(':id/ship') @RequirePerm('shop:order:ship')
  ship(@Param('id', ParseIntPipe) id: number, @Body() dto: ShipShopOrderDto, @CurrentUser() user: JwtUser) { return this.service.shipOrder(id, dto, user) }
}

@Controller('shop/promotions')
@UseGuards(...guards)
@RequireFeature('shop.enabled')
@DataScope({ org: 'dept', level: 'ORG' })
export class ShopPromotionController {
  constructor(private readonly service: ShopService) {}
  @Get() @RequirePerm('shop:promotion:view')
  list(@Query() query: QueryShopDto, @CurrentUser() user: JwtUser) { return this.service.listPromotions(query, user) }
  @Post() @RequirePerm('shop:promotion:create')
  create(@Body() dto: CreatePromotionDto, @CurrentUser() user: JwtUser) { return this.service.createPromotion(dto, user) }
  @Get('calendar') @RequirePerm('shop:promotion:view')
  calendar(@CurrentUser() user: JwtUser) { return this.service.activityCalendar(user) }
}

@Controller('shop/promotions/coupons')
@UseGuards(...guards)
@RequireFeature('shop.enabled')
@DataScope({ org: 'dept', level: 'ORG' })
export class ShopCouponController {
  constructor(private readonly service: ShopService) {}
  @Get() @RequirePerm('shop:promotion:view')
  list(@Query() query: QueryShopDto, @CurrentUser() user: JwtUser) { return this.service.listCoupons(query, user) }
  @Post() @RequirePerm('shop:promotion:create')
  create(@Body() dto: CreateCouponDto, @CurrentUser() user: JwtUser) { return this.service.createCoupon(dto, user) }
  @Post('validate') @RequirePerm('shop:promotion:view')
  validate(@Body() dto: ValidateCouponDto, @CurrentUser() user: JwtUser) { return this.service.validateCouponOrder(dto, user) }
}

@Controller('shop/promotions/seckills')
@UseGuards(...guards)
@RequireFeature('shop.enabled')
@DataScope({ org: 'dept', level: 'ORG' })
export class ShopSeckillController {
  constructor(private readonly service: ShopService) {}
  @Get() @RequirePerm('shop:promotion:view')
  list(@Query() query: QueryShopDto, @CurrentUser() user: JwtUser) { return this.service.listSeckills(query, user) }
  @Post() @RequirePerm('shop:promotion:create')
  create(@Body() dto: CreateSeckillDto, @CurrentUser() user: JwtUser) { return this.service.createSeckill(dto, user) }
}

@Controller('shop/promotions/activity-stock')
@UseGuards(...guards)
@RequireFeature('shop.enabled')
@DataScope({ org: 'dept', level: 'ORG' })
export class ShopActivityStockController {
  constructor(private readonly service: ShopService) {}
  @Get() @RequirePerm('shop:promotion:view')
  list(@Query() query: QueryShopDto, @CurrentUser() user: JwtUser) { return this.service.listActivityStocks(query, user) }
  @Post() @RequirePerm('shop:promotion:stock')
  set(@Body() dto: SetActivityStockDto, @CurrentUser() user: JwtUser) { return this.service.setActivityStock(dto, user) }
  @Post('reserve') @RequirePerm('shop:promotion:stock')
  reserve(@Body() dto: ReserveActivityStockDto, @CurrentUser() user: JwtUser) { return this.service.reserveActivityStock(dto, user) }
  @Post(':id/release') @RequirePerm('shop:promotion:stock')
  release(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.releaseActivityStock(id, user) }
}

@Controller('shop/promotions/effect')
@UseGuards(...guards)
@RequireFeature('shop.enabled')
@DataScope({ org: 'dept', level: 'ORG' })
export class ShopPromotionEffectController {
  constructor(private readonly service: ShopService) {}
  @Get() @RequirePerm('shop:promotion:effect')
  effect(@Query('storeId') storeId: string, @CurrentUser() user: JwtUser) {
    return this.service.promotionEffect(user, storeId ? Number(storeId) : undefined)
  }
}

@Controller('shop/payment-configs')
@UseGuards(...guards)
@RequireFeature('shop.enabled')
@DataScope({ org: 'dept', level: 'ORG' })
export class ShopPaymentController {
  constructor(private readonly service: ShopService) {}
  @Get() @RequirePerm('shop:payment:view')
  list(@Query() query: QueryShopDto, @CurrentUser() user: JwtUser) { return this.service.listPaymentConfigs(query, user) }
  @Post() @RequirePerm('shop:payment:create')
  create(@Body() dto: CreatePaymentConfigDto, @CurrentUser() user: JwtUser) { return this.service.createPaymentConfig(dto, user) }
  @Post(':storeId/reconcile') @RequirePerm('shop:payment:reconcile')
  reconcile(@Param('storeId', ParseIntPipe) storeId: number, @Body() dto: ReconcileDto, @CurrentUser() user: JwtUser) { return this.service.reconcile(storeId, dto, user) }
}

@Controller('shop/reconciliation')
@UseGuards(...guards)
@RequireFeature('shop.enabled')
@DataScope({ org: 'dept', level: 'ORG' })
export class ShopReconciliationController {
  constructor(private readonly service: ShopService) {}
  @Get('bills') @RequirePerm('shop:payment:reconcile')
  list(@Query() query: QueryShopDto, @CurrentUser() user: JwtUser) { return this.service.listReconcileBills(query, user) }
  @Post('bills/import') @RequirePerm('shop:payment:reconcile')
  import(@Body() dto: ImportReconcileDto, @CurrentUser() user: JwtUser) { return this.service.importReconcileBills(dto, user) }
  @Post('bills/:id/resolve') @RequirePerm('shop:payment:reconcile')
  resolve(@Param('id', ParseIntPipe) id: number, @Body() dto: ResolveReconcileDto, @CurrentUser() user: JwtUser) { return this.service.resolveReconcileBill(id, dto, user) }
}

@Controller('shop/refunds')
@UseGuards(...guards)
@RequireFeature('shop.enabled')
@DataScope({ org: 'dept', level: 'ORG' })
export class ShopRefundController {
  constructor(private readonly service: ShopService) {}
  @Get() @RequirePerm('shop:refund:view')
  list(@Query() query: QueryShopDto, @CurrentUser() user: JwtUser) { return this.service.listRefunds(query, user) }
  @Post() @RequirePerm('shop:refund:create')
  create(@Body() dto: CreateRefundDto, @CurrentUser() user: JwtUser) { return this.service.createRefund(dto, user) }
  @Post(':id/approve') @RequirePerm('shop:refund:approve')
  approve(@Param('id', ParseIntPipe) id: number, @Body() dto: ApproveRefundDto, @CurrentUser() user: JwtUser) { return this.service.approveRefund(id, dto, user) }
  @Post(':id/reject') @RequirePerm('shop:refund:approve')
  reject(@Param('id', ParseIntPipe) id: number, @Body() dto: RejectRefundDto, @CurrentUser() user: JwtUser) { return this.service.rejectRefund(id, dto, user) }
}

@Controller('shop/waybills')
@UseGuards(...guards)
@RequireFeature('shop.enabled')
@DataScope({ org: 'dept', level: 'ORG' })
export class ShopWaybillController {
  constructor(private readonly service: ShopService) {}
  @Get() @RequirePerm('shop:logistics:view')
  list(@Query() query: QueryShopDto, @CurrentUser() user: JwtUser) { return this.service.listWaybills(query, user) }
  @Post(':id/exception') @RequirePerm('shop:logistics:update')
  exception(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.markWaybillException(id, user) }
  @Get(':id/tracking') @RequirePerm('shop:logistics:view')
  tracking(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.listTracking(id, user) }
  @Post(':id/tracking') @RequirePerm('shop:logistics:update')
  pushTracking(@Param('id', ParseIntPipe) id: number, @Body() dto: PushTrackingDto, @CurrentUser() user: JwtUser) { return this.service.pushTracking(id, dto, user) }
}

@Controller('shop/cs')
@UseGuards(...guards)
@RequireFeature('shop.enabled')
@DataScope({ org: 'dept', level: 'ORG' })
export class ShopCsController {
  constructor(private readonly service: ShopService) {}
  @Get() @RequirePerm('shop:cs:view')
  list(@Query() query: QueryShopDto, @CurrentUser() user: JwtUser) { return this.service.listConversations(query, user) }
  @Post() @RequirePerm('shop:cs:create')
  create(@Body() dto: CreateCsConversationDto, @CurrentUser() user: JwtUser) { return this.service.createConversation(dto, user) }
  @Post(':id/reply') @RequirePerm('shop:cs:reply')
  reply(@Param('id', ParseIntPipe) id: number, @Body() dto: ReplyCsDto, @CurrentUser() user: JwtUser) { return this.service.replyConversation(id, dto, user) }
  @Post(':id/quality') @RequirePerm('shop:cs:qc')
  quality(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateCsQcDto, @CurrentUser() user: JwtUser) { return this.service.createCsQc(id, dto, user) }
  @Get('quality-reviews') @RequirePerm('shop:cs:qc')
  qualityReviews(@Query() query: QueryShopDto, @CurrentUser() user: JwtUser) { return this.service.listCsQc(query, user) }
  @Post('quick-replies') @RequirePerm('shop:cs:reply')
  quickReplies(@Body() dto: QuickReplyDto, @CurrentUser() user: JwtUser) { return this.service.quickReplies(dto, user) }
}

@Controller('shop')
@UseGuards(...guards)
@RequireFeature('shop.enabled')
@DataScope({ org: 'dept', level: 'ORG' })
export class ShopQueryController {
  constructor(private readonly service: ShopService) {}
  @Get('logs') @RequirePerm('shop:order:view')
  logs(@Query() query: QueryShopDto, @CurrentUser() user: JwtUser) { return this.service.listLogs(query, user) }
  @Get('report') @RequirePerm('shop:report:view')
  report(@CurrentUser() user: JwtUser) { return this.service.report(user) }
}
