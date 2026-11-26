import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import {
  AwardDto,
  CreateCarrierDto,
  CreateDemandDto,
  CreateOutsourceOrderDto,
  OutsourceIssueDto,
  OutsourceReceiveDto,
  CreateEvaluateDto,
  CreatePurchaseContractDto,
  CreatePurchaseOrderDto,
  CreatePurchasePriceDto,
  CreatePurchaseReturnDto,
  CreateReceiptDto,
  CreateRfqDto,
  CreateVendorStatementDto,
  CreateWaybillDto,
  QueryPortalDto,
  QueryPurchaseDto,
  SettleVendorStatementDto,
  SupplierQuoteDto,
  UpdatePurchaseOrderDto,
  UpdateQcDto,
  UpdateReceiptDto
} from './dto'
import { PurchaseService } from './purchase.service'

const guards = [AuthGuard, PermissionsGuard, DataScopeGuard]

@Controller('purchase/evaluates')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class EvaluateController {
  constructor(private readonly service: PurchaseService) {}
  @Get() @RequirePerm('purchase:supplier:view')
  list(@Query() query: QueryPurchaseDto, @CurrentUser() user: JwtUser) { return this.service.listEvaluates(query, user) }
  @Post() @RequirePerm('purchase:supplier:update')
  create(@Body() dto: CreateEvaluateDto, @CurrentUser() user: JwtUser) { return this.service.createEvaluate(dto, user) }
  @Post('admission/:supplierId') @RequirePerm('purchase:supplier:update')
  admission(@Param('supplierId', ParseIntPipe) supplierId: number, @Body() body: { hasBusinessLicense: boolean; hasQualification: boolean; minScore?: number }, @CurrentUser() user: JwtUser) {
    return this.service.approveSupplierAdmission(supplierId, body, user)
  }
}

@Controller('purchase/rfqs')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class RfqController {
  constructor(private readonly service: PurchaseService) {}
  @Get() @RequirePerm('purchase:inquiry:view')
  list(@Query() query: QueryPurchaseDto, @CurrentUser() user: JwtUser) { return this.service.listRfqs(query, user) }
  @Get(':id/detail') @RequirePerm('purchase:inquiry:view')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.rfqDetail(id, user) }
  @Post() @RequirePerm('purchase:inquiry:create')
  create(@Body() dto: CreateRfqDto, @CurrentUser() user: JwtUser) { return this.service.createRfq(dto, user) }
  @Post('lines/:lineId/quotes') @RequirePerm('purchase:inquiry:update')
  addQuote(@Param('lineId', ParseIntPipe) lineId: number, @Body() dto: SupplierQuoteDto, @CurrentUser() user: JwtUser) { return this.service.addQuote(lineId, dto, user) }
  @Post('award') @RequirePerm('purchase:inquiry:approve')
  award(@Body() dto: AwardDto, @CurrentUser() user: JwtUser) { return this.service.award(dto, user) }
}

@Controller('purchase/demands')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class DemandController {
  constructor(private readonly service: PurchaseService) {}
  @Get() @RequirePerm('purchase:demand:view')
  list(@Query() query: QueryPurchaseDto, @CurrentUser() user: JwtUser) { return this.service.listDemands(query, user) }
  @Post() @RequirePerm('purchase:demand:create')
  create(@Body() dto: CreateDemandDto, @CurrentUser() user: JwtUser) { return this.service.createDemand(dto, user) }
}

@Controller('purchase/orders')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class PurchaseOrderController {
  constructor(private readonly service: PurchaseService) {}
  @Get() @RequirePerm('purchase:order:view')
  list(@Query() query: QueryPurchaseDto, @CurrentUser() user: JwtUser) { return this.service.listOrders(query, user) }
  @Get(':id/detail') @RequirePerm('purchase:order:view')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.orderDetail(id, user) }
  @Post() @RequirePerm('purchase:order:create')
  create(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() user: JwtUser) { return this.service.createOrder(dto, user) }
  @Put(':id') @RequirePerm('purchase:order:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePurchaseOrderDto, @CurrentUser() user: JwtUser) { return this.service.updateOrder(id, dto, user) }
  @Post(':id/submit') @RequirePerm('purchase:order:submit')
  submit(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.submitOrder(id, user) }
  @Post(':id/approve') @RequirePerm('purchase:order:approve')
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.approveOrder(id, user) }
}

@Controller('purchase/receipts')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class ReceiptController {
  constructor(private readonly service: PurchaseService) {}
  @Get() @RequirePerm('purchase:receipt:view')
  list(@Query() query: QueryPurchaseDto, @CurrentUser() user: JwtUser) { return this.service.listReceipts(query, user) }
  @Get(':id/detail') @RequirePerm('purchase:receipt:view')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.receiptDetail(id, user) }
  @Post() @RequirePerm('purchase:receipt:create')
  create(@Body() dto: CreateReceiptDto, @CurrentUser() user: JwtUser) { return this.service.createReceipt(dto, user) }
  @Put(':id/lines/:lineId/qc') @RequirePerm('purchase:receipt:update')
  updateQc(@Param('id', ParseIntPipe) id: number, @Param('lineId', ParseIntPipe) lineId: number, @Body() dto: UpdateQcDto, @CurrentUser() user: JwtUser) { return this.service.updateQc(id, lineId, dto, user) }
  @Put(':id') @RequirePerm('purchase:receipt:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateReceiptDto, @CurrentUser() user: JwtUser) { return this.service.updateReceipt(id, dto, user) }
  @Get(':id/match') @RequirePerm('purchase:receipt:view')
  match(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.threeWayMatch(id, user) }
}

@Controller('purchase/statements')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class VendorStatementController {
  constructor(private readonly service: PurchaseService) {}
  @Get() @RequirePerm('purchase:statement:view')
  list(@Query() query: QueryPurchaseDto, @CurrentUser() user: JwtUser) { return this.service.listStatements(query, user) }
  @Post() @RequirePerm('purchase:statement:create')
  create(@Body() dto: CreateVendorStatementDto, @CurrentUser() user: JwtUser) { return this.service.createStatement(dto, user) }
  @Post(':id/settle') @RequirePerm('purchase:statement:settle')
  settle(@Param('id', ParseIntPipe) id: number, @Body() dto: SettleVendorStatementDto, @CurrentUser() user: JwtUser) { return this.service.settleStatement(id, dto, user) }
}

@Controller('purchase/returns')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class PurchaseReturnController {
  constructor(private readonly service: PurchaseService) {}
  @Get() @RequirePerm('purchase:return:view')
  list(@Query() query: QueryPurchaseDto, @CurrentUser() user: JwtUser) { return this.service.listReturns(query, user) }
  @Post() @RequirePerm('purchase:return:create')
  create(@Body() dto: CreatePurchaseReturnDto, @CurrentUser() user: JwtUser) { return this.service.createReturn(dto, user) }
}

@Controller('purchase/contracts')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class PurchaseContractController {
  constructor(private readonly service: PurchaseService) {}
  @Get() @RequirePerm('purchase:contract:view')
  list(@Query() query: QueryPurchaseDto, @CurrentUser() user: JwtUser) { return this.service.listContracts(query, user) }
  @Post() @RequirePerm('purchase:contract:create')
  create(@Body() dto: CreatePurchaseContractDto, @CurrentUser() user: JwtUser) { return this.service.createContract(dto, user) }
}

@Controller('purchase/prices')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class PurchasePriceController {
  constructor(private readonly service: PurchaseService) {}
  @Get() @RequirePerm('purchase:price:view')
  list(@Query() query: QueryPurchaseDto, @CurrentUser() user: JwtUser) { return this.service.listPrices(query, user) }
  @Post() @RequirePerm('purchase:price:create')
  create(@Body() dto: CreatePurchasePriceDto, @CurrentUser() user: JwtUser) { return this.service.createPrice(dto, user) }
}

@Controller('purchase/carriers')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class CarrierController {
  constructor(private readonly service: PurchaseService) {}
  @Get() @RequirePerm('purchase:logistics:view')
  list(@Query() query: QueryPurchaseDto, @CurrentUser() user: JwtUser) { return this.service.listCarriers(query, user) }
  @Post() @RequirePerm('purchase:logistics:create')
  create(@Body() dto: CreateCarrierDto, @CurrentUser() user: JwtUser) { return this.service.createCarrier(dto, user) }
}

@Controller('purchase/waybills')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class WaybillController {
  constructor(private readonly service: PurchaseService) {}
  @Get() @RequirePerm('purchase:logistics:view')
  list(@Query() query: QueryPurchaseDto, @CurrentUser() user: JwtUser) { return this.service.listWaybills(query, user) }
  @Post() @RequirePerm('purchase:logistics:create')
  create(@Body() dto: CreateWaybillDto, @CurrentUser() user: JwtUser) { return this.service.createWaybill(dto, user) }
}

@Controller('purchase/reports')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class PurchaseReportController {
  constructor(private readonly service: PurchaseService) {}
  @Get('summary') @RequirePerm('purchase:report:view')
  summary(@CurrentUser() user: JwtUser) { return this.service.summary(user) }
}

@Controller('purchase/outsource-orders')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class OutsourceController {
  constructor(private readonly service: PurchaseService) {}
  @Get() @RequirePerm('purchase:order:view')
  list(@Query() query: QueryPurchaseDto, @CurrentUser() user: JwtUser) { return this.service.listOutsourceOrders(query, user) }
  @Post() @RequirePerm('purchase:order:create')
  create(@Body() dto: CreateOutsourceOrderDto, @CurrentUser() user: JwtUser) { return this.service.createOutsourceOrder(dto, user) }
  @Get(':id/detail') @RequirePerm('purchase:order:view')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.outsourceDetail(id, user) }
  @Post(':id/status') @RequirePerm('purchase:order:approve')
  setStatus(@Param('id', ParseIntPipe) id: number, @Body('status') status: string, @CurrentUser() user: JwtUser) {
    return this.service.setOutsourceStatus(id, status, user)
  }
  @Post(':id/issue') @RequirePerm('purchase:order:update')
  issue(@Param('id', ParseIntPipe) id: number, @Body() dto: OutsourceIssueDto, @CurrentUser() user: JwtUser) {
    return this.service.issueOutsourceMaterial(id, dto, user)
  }
  @Post(':id/receive') @RequirePerm('purchase:order:update')
  receive(@Param('id', ParseIntPipe) id: number, @Body() dto: OutsourceReceiveDto, @CurrentUser() user: JwtUser) {
    return this.service.receiveOutsource(id, dto, user)
  }
}

@Controller('purchase/portal')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class SupplierPortalController {
  constructor(private readonly service: PurchaseService) {}
  @Get('summary') @RequirePerm('purchase:supplier:view')
  summary(@Query() query: QueryPortalDto, @CurrentUser() user: JwtUser) { return this.service.portalSummary(query, user) }
  @Get('orders') @RequirePerm('purchase:supplier:view')
  orders(@Query() query: QueryPortalDto, @CurrentUser() user: JwtUser) { return this.service.portalOrders(query, user) }
  @Get('receipts') @RequirePerm('purchase:supplier:view')
  receipts(@Query() query: QueryPortalDto, @CurrentUser() user: JwtUser) { return this.service.portalReceipts(query, user) }
  @Get('statements') @RequirePerm('purchase:supplier:view')
  statements(@Query() query: QueryPortalDto, @CurrentUser() user: JwtUser) { return this.service.portalStatements(query, user) }
  @Get('evaluates') @RequirePerm('purchase:supplier:view')
  evaluates(@Query() query: QueryPortalDto, @CurrentUser() user: JwtUser) { return this.service.portalEvaluates(query, user) }
}
