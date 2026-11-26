import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import {
  CreateContractDto,
  CreateFollowDto,
  CreateSaleClauseDto,
  RenewContractDto,
  SignContractDto,
  CreateLeadDto,
  CreateOpportunityDto,
  CreatePriceAgreementDto,
  CreateQuotationDto,
  CreateSaleOrderDto,
  CreateSaleReturnDto,
  CreateShipmentDto,
  SplitSaleOrderDto,
  SignShipmentDto,
  CreateStatementDto,
  CreateTargetDto,
  AdvanceOpportunityDto, ApproveMergeDto, ApproveQuotationDto, ApproveReturnDto,
  CreateCustomerMergeDto, HangPosOrderDto, PosOrderDto,
  CompareQuotationVersionDto,
  CreateCustomerContactDto,
  CreateMemberPriceDto,
  CreateRedInvoiceDto,
  HandleChurnWarningDto,
  PosPaymentDto,
  QuerySalesDto,
  QueryFollowTimelineDto,
  SaveQuotationVersionDto,
  ReturnQcDto,
  ReverseStatementDto,
  SettleStatementDto,
  UpdateContractDto,
  UpdateLeadDto,
  UpdateOpportunityDto,
  UpdateQuotationDto,
  UpdateSaleOrderDto,
  UpdateSaleReturnDto,
  UpdateShipmentDto
} from './dto'
import { SalesService } from './sales.service'

const guards = [AuthGuard, PermissionsGuard, DataScopeGuard]

@Controller('sales/leads')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class LeadController {
  constructor(private readonly service: SalesService) {}

  @Get() @RequirePerm('sales:lead:view')
  list(@Query() query: QuerySalesDto, @CurrentUser() user: JwtUser) { return this.service.listLeads(query, user) }

  @Post() @RequirePerm('sales:lead:create')
  create(@Body() dto: CreateLeadDto, @CurrentUser() user: JwtUser) { return this.service.createLead(dto, user) }

  @Put(':id') @RequirePerm('sales:lead:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLeadDto, @CurrentUser() user: JwtUser) { return this.service.updateLead(id, dto, user) }

  @Post(':id/convert') @RequirePerm('sales:lead:convert')
  convert(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.convertLead(id, user) }
  @Post(':id/smart-assign') @RequirePerm('sales:lead:update')
  smartAssign(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.smartAssignLead(id, user) }
  @Get(':id/duplicates') @RequirePerm('sales:lead:view')
  duplicates(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.duplicateLeads(id, user) }
}

@Controller('sales/opportunities')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class OpportunityController {
  constructor(private readonly service: SalesService) {}

  @Get() @RequirePerm('sales:opportunity:view')
  list(@Query() query: QuerySalesDto, @CurrentUser() user: JwtUser) { return this.service.listOpportunities(query, user) }

  @Post() @RequirePerm('sales:opportunity:create')
  create(@Body() dto: CreateOpportunityDto, @CurrentUser() user: JwtUser) { return this.service.createOpportunity(dto, user) }

  @Put(':id') @RequirePerm('sales:opportunity:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOpportunityDto, @CurrentUser() user: JwtUser) { return this.service.updateOpportunity(id, dto, user) }
  @Post(':id/advance') @RequirePerm('sales:opportunity:update')
  advance(@Param('id', ParseIntPipe) id: number, @Body() dto: AdvanceOpportunityDto, @CurrentUser() user: JwtUser) { return this.service.advanceOpportunity(id, dto, user) }
}

@Controller('sales/follows')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class FollowController {
  constructor(private readonly service: SalesService) {}

  @Get() @RequirePerm('sales:lead:view')
  list(@Query('bizType') bizType: string, @Query('bizId', ParseIntPipe) bizId: number, @CurrentUser() user: JwtUser) {
    return this.service.listFollows(bizType, bizId, user)
  }

  /** 跟进流水（跨线索 / 商机 / 客户） */
  @Get('timeline') @RequirePerm('sales:lead:view')
  timeline(@Query() query: QueryFollowTimelineDto, @CurrentUser() user: JwtUser) {
    return this.service.listFollowTimeline(query, user)
  }

  @Post() @RequirePerm('sales:lead:update')
  create(@Body() dto: CreateFollowDto, @CurrentUser() user: JwtUser) { return this.service.createFollow(dto, user) }
}

@Controller('sales/quotations')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class QuotationController {
  constructor(private readonly service: SalesService) {}

  @Get() @RequirePerm('sales:quotation:view')
  list(@Query() query: QuerySalesDto, @CurrentUser() user: JwtUser) { return this.service.listQuotations(query, user) }

  @Get(':id/detail') @RequirePerm('sales:quotation:view')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.quotationDetail(id, user) }

  @Post() @RequirePerm('sales:quotation:create')
  create(@Body() dto: CreateQuotationDto, @CurrentUser() user: JwtUser) { return this.service.createQuotation(dto, user) }

  @Put(':id') @RequirePerm('sales:quotation:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateQuotationDto, @CurrentUser() user: JwtUser) { return this.service.updateQuotation(id, dto, user) }
  @Post(':id/approve') @RequirePerm('sales:quotation:update')
  approve(@Param('id', ParseIntPipe) id: number, @Body() dto: ApproveQuotationDto, @CurrentUser() user: JwtUser) { return this.service.approveQuotation(id, dto, user) }
  @Post(':id/convert') @RequirePerm('sales:quotation:convert')
  convert(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.convertQuotation(id, user) }
}

@Controller('sales/contracts')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class ContractController {
  constructor(private readonly service: SalesService) {}

  @Get() @RequirePerm('sales:contract:view')
  list(@Query() query: QuerySalesDto, @CurrentUser() user: JwtUser) { return this.service.listContracts(query, user) }

  @Post() @RequirePerm('sales:contract:create')
  create(@Body() dto: CreateContractDto, @CurrentUser() user: JwtUser) { return this.service.createContract(dto, user) }

  @Put(':id') @RequirePerm('sales:contract:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateContractDto, @CurrentUser() user: JwtUser) { return this.service.updateContract(id, dto, user) }

  @Get('expiring') @RequirePerm('sales:contract:view')
  expiring(@CurrentUser() user: JwtUser) { return this.service.listExpiringContracts(user) }

  @Post(':id/renew') @RequirePerm('sales:contract:renew')
  renew(@Param('id', ParseIntPipe) id: number, @Body() dto: RenewContractDto, @CurrentUser() user: JwtUser) { return this.service.renewContract(id, dto, user) }

  @Post(':id/sign') @RequirePerm('sales:contract:sign')
  sign(@Param('id', ParseIntPipe) id: number, @Body() dto: SignContractDto, @CurrentUser() user: JwtUser) { return this.service.signContract(id, dto, user) }
}

@Controller('sales/clauses')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class ClauseController {
  constructor(private readonly service: SalesService) {}

  @Get() @RequirePerm('sales:clause:view')
  list(@Query() query: QuerySalesDto, @CurrentUser() user: JwtUser) { return this.service.listClauses(query, user) }

  @Post() @RequirePerm('sales:clause:manage')
  create(@Body() dto: CreateSaleClauseDto, @CurrentUser() user: JwtUser) { return this.service.saveClause(dto, null, user) }

  @Put(':id') @RequirePerm('sales:clause:manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateSaleClauseDto, @CurrentUser() user: JwtUser) { return this.service.saveClause(dto, id, user) }
}

@Controller('sales/orders')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class SaleOrderController {
  constructor(private readonly service: SalesService) {}

  @Get() @RequirePerm('sales:order:view')
  list(@Query() query: QuerySalesDto, @CurrentUser() user: JwtUser) { return this.service.listOrders(query, user) }

  @Get(':id/detail') @RequirePerm('sales:order:view')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.orderDetail(id, user) }

  @Post() @RequirePerm('sales:order:create')
  create(@Body() dto: CreateSaleOrderDto, @CurrentUser() user: JwtUser) { return this.service.createOrder(dto, user) }

  @Put(':id') @RequirePerm('sales:order:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSaleOrderDto, @CurrentUser() user: JwtUser) { return this.service.updateOrder(id, dto, user) }

  /** 拆单：按明细行拆出新单，原单保留剩余行 */
  @Post(':id/split') @RequirePerm('sales:order:update')
  split(@Param('id', ParseIntPipe) id: number, @Body() dto: SplitSaleOrderDto, @CurrentUser() user: JwtUser) {
    return this.service.splitOrder(id, dto, user)
  }

  @Post(':id/submit') @RequirePerm('sales:order:submit')  submit(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.submitOrder(id, user) }

  @Post(':id/approve') @RequirePerm('sales:order:approve')
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.approveOrder(id, user) }
}

@Controller('sales/products')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class SaleProductController {
  constructor(private readonly service: SalesService) {}

  /** 缺货替代推荐：同品类且有可用库存的候选产品 */
  @Get(':productId/substitutes') @RequirePerm('sales:order:view')
  substitutes(
    @Param('productId', ParseIntPipe) productId: number,
    @Query('warehouseId') warehouseId: string,
    @CurrentUser() user: JwtUser
  ) {
    return this.service.recommendSubstitutes(productId, Number(warehouseId ?? 0) || 0, user)
  }
}

@Controller('sales/pos')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class PosController {
  constructor(private readonly service: SalesService) {}

  @Post('orders') @RequirePerm('sales:pos:create')
  create(@Body() dto: PosOrderDto, @CurrentUser() user: JwtUser) { return this.service.posOrder(dto, user) }
}

@Controller('sales/statements')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class StatementController {
  constructor(private readonly service: SalesService) {}

  @Get() @RequirePerm('sales:statement:view')
  list(@Query() query: QuerySalesDto, @CurrentUser() user: JwtUser) { return this.service.listStatements(query, user) }

  @Post() @RequirePerm('sales:statement:create')
  create(@Body() dto: CreateStatementDto, @CurrentUser() user: JwtUser) { return this.service.createStatement(dto, user) }

  @Get('collection-plan') @RequirePerm('sales:statement:view')
  collectionPlan(@CurrentUser() user: JwtUser) { return this.service.collectionPlan(user) }
  @Get(':id/writeoff-suggestion') @RequirePerm('sales:statement:view')
  writeoffSuggestion(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.smartWriteoff(id, user) }
  @Post(':id/collection-letter') @RequirePerm('sales:statement:settle')
  collectionLetter(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.collectionLetter(id, user) }
  @Post(':id/settle') @RequirePerm('sales:statement:settle')
  settle(@Param('id', ParseIntPipe) id: number, @Body() dto: SettleStatementDto, @CurrentUser() user: JwtUser) { return this.service.settleStatement(id, dto, user) }
  @Post(':id/reverse') @RequirePerm('sales:statement:reverse')
  reverse(@Param('id', ParseIntPipe) id: number, @Body() dto: ReverseStatementDto, @CurrentUser() user: JwtUser) { return this.service.reverseStatement(id, dto, user) }
}

@Controller('sales/shipments')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class ShipmentController {
  constructor(private readonly service: SalesService) {}

  @Get() @RequirePerm('sales:shipment:view')
  list(@Query() query: QuerySalesDto, @CurrentUser() user: JwtUser) { return this.service.listShipments(query, user) }

  @Post() @RequirePerm('sales:shipment:create')
  create(@Body() dto: CreateShipmentDto, @CurrentUser() user: JwtUser) { return this.service.createShipment(dto, user) }

  @Put(':id') @RequirePerm('sales:shipment:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateShipmentDto, @CurrentUser() user: JwtUser) { return this.service.updateShipment(id, dto, user) }

  /** 出货签收：记录签收人与签收凭证 */
  @Post(':id/sign') @RequirePerm('sales:shipment:update')
  sign(@Param('id', ParseIntPipe) id: number, @Body() dto: SignShipmentDto, @CurrentUser() user: JwtUser) { return this.service.signShipment(id, dto, user) }
}

@Controller('sales/returns')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class SaleReturnController {
  constructor(private readonly service: SalesService) {}

  @Get() @RequirePerm('sales:return:view')
  list(@Query() query: QuerySalesDto, @CurrentUser() user: JwtUser) { return this.service.listReturns(query, user) }

  @Post() @RequirePerm('sales:return:create')
  create(@Body() dto: CreateSaleReturnDto, @CurrentUser() user: JwtUser) { return this.service.createReturn(dto, user) }

  @Put(':id') @RequirePerm('sales:return:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSaleReturnDto, @CurrentUser() user: JwtUser) { return this.service.updateReturn(id, dto, user) }

  @Post(':id/qc') @RequirePerm('sales:return:update')
  qc(@Param('id', ParseIntPipe) id: number, @Body() dto: ReturnQcDto, @CurrentUser() user: JwtUser) { return this.service.qcReturnLine(id, dto, user) }

  @Post(':id/approve') @RequirePerm('sales:return:approve')
  approve(@Param('id', ParseIntPipe) id: number, @Body() dto: ApproveReturnDto, @CurrentUser() user: JwtUser) { return this.service.approveReturn(id, dto, user) }
}

@Controller('sales/price-agreements')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class PriceAgreementController {
  constructor(private readonly service: SalesService) {}

  @Get() @RequirePerm('sales:price:view')
  list(@Query() query: QuerySalesDto, @CurrentUser() user: JwtUser) { return this.service.listAgreements(query, user) }

  @Post() @RequirePerm('sales:price:create')
  create(@Body() dto: CreatePriceAgreementDto, @CurrentUser() user: JwtUser) { return this.service.createAgreement(dto, user) }
}

@Controller('sales/targets')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class SaleTargetController {
  constructor(private readonly service: SalesService) {}

  @Get() @RequirePerm('sales:target:view')
  list(@Query() query: QuerySalesDto, @CurrentUser() user: JwtUser) { return this.service.listTargets(query, user) }

  @Post() @RequirePerm('sales:target:create')
  create(@Body() dto: CreateTargetDto, @CurrentUser() user: JwtUser) { return this.service.createTarget(dto, user) }
  @Post(':id/refresh') @RequirePerm('sales:target:update')
  refresh(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.refreshTarget(id, user) }
  @Get('alerts') @RequirePerm('sales:target:view')
  alerts(@CurrentUser() user: JwtUser) { return this.service.targetAlerts(user) }
}

/** 客户 360 图谱、联系人与流失预警 */
@Controller('sales/customers')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class CrmCustomerController {
  constructor(private readonly service: SalesService) {}

  @Get(':id/profile-360') @RequirePerm('sales:customer:profile')
  profile360(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.customerProfile360(id, user) }

  @Get(':id/contacts') @RequirePerm('sales:customer:view')
  contacts(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.listCustomerContacts(id, user) }

  @Post('contacts') @RequirePerm('sales:customer:update')
  createContact(@Body() dto: CreateCustomerContactDto, @CurrentUser() user: JwtUser) { return this.service.addCustomerContact(dto, user) }
}

@Controller('sales/churn-warnings')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class CrmChurnController {
  constructor(private readonly service: SalesService) {}

  @Get('scan') @RequirePerm('sales:churn:view')
  scan(@CurrentUser() user: JwtUser) { return this.service.scanChurnWarnings(user) }

  @Post(':id/handle') @RequirePerm('sales:churn:handle')
  handle(@Param('id', ParseIntPipe) id: number, @Body() dto: HandleChurnWarningDto, @CurrentUser() user: JwtUser) {
    return this.service.handleChurnWarning(id, dto, user)
  }
}

/** 报价版本快照与版本对比 */
@Controller('sales/quotation-versions')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class QuotationVersionController {
  constructor(private readonly service: SalesService) {}

  @Post(':id/snapshot') @RequirePerm('sales:quotation:version')
  snapshot(@Param('id', ParseIntPipe) id: number, @Body() dto: SaveQuotationVersionDto, @CurrentUser() user: JwtUser) {
    return this.service.saveQuotationVersion(id, user, dto.changeReason)
  }

  @Get(':id/compare') @RequirePerm('sales:quotation:version')
  compare(@Param('id', ParseIntPipe) id: number, @Query() dto: CompareQuotationVersionDto, @CurrentUser() user: JwtUser) {
    return this.service.compareQuotationVersions(id, dto, user)
  }
}

/** POS 多支付与会员价 */
@Controller('sales/pos')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class PosPaymentController {
  constructor(private readonly service: SalesService) {}

  @Post('payments') @RequirePerm('sales:pos:pay')
  pay(@Body() dto: PosPaymentDto, @CurrentUser() user: JwtUser) { return this.service.posPay(dto, user) }
}

@Controller('sales/pos/member-price')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class PosMemberPriceController {
  constructor(private readonly service: SalesService) {}

  @Post() @RequirePerm('sales:pos:member-price')
  save(@Body() dto: CreateMemberPriceDto, @CurrentUser() user: JwtUser) { return this.service.setMemberPrice(dto, user) }

  @Get('query') @RequirePerm('sales:pos:member-price')
  query(@Query('customerId', ParseIntPipe) customerId: number, @Query('productId', ParseIntPipe) productId: number, @CurrentUser() user: JwtUser) {
    return this.service.memberPriceOf(customerId, productId, user)
  }
}

/** 退货红字发票 */
@Controller('sales/red-invoices')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class SaleRedInvoiceController {
  constructor(private readonly service: SalesService) {}

  @Post() @RequirePerm('sales:return:red-invoice')
  create(@Body() dto: CreateRedInvoiceDto, @CurrentUser() user: JwtUser) { return this.service.createRedInvoice(dto, user) }
}

@Controller('sales/reports')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class SaleReportController {
  constructor(private readonly service: SalesService) {}

  @Get('summary') @RequirePerm('sales:report:view')
  summary(@CurrentUser() user: JwtUser) { return this.service.summary(user) }
}

@Controller('sales/customer-merges')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class CustomerMergeController {
  constructor(private readonly service: SalesService) {}
  @Post() @RequirePerm('sales:customer:merge')
  create(@Body() dto: CreateCustomerMergeDto, @CurrentUser() user: JwtUser) { return this.service.createMergeRequest(dto, user) }
  @Post(':id/approve') @RequirePerm('sales:customer:merge')
  approve(@Param('id', ParseIntPipe) id: number, @Body() dto: ApproveMergeDto, @CurrentUser() user: JwtUser) { return this.service.approveMergeRequest(id, dto, user) }
}

@Controller('sales/pos-hang')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class PosHangController {
  constructor(private readonly service: SalesService) {}
  @Post() @RequirePerm('sales:pos:hang')
  hang(@Body() dto: HangPosOrderDto, @CurrentUser() user: JwtUser) { return this.service.hangPosOrder(dto, user) }
  @Post(':id/resume') @RequirePerm('sales:pos:hang')
  resume(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.resumePosHang(id, user) }
}
