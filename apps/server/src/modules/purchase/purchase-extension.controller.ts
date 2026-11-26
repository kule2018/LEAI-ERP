import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import {
  AllocateCostDto,
  ApproveAwardDto,
  ApproveLossDto,
  ApprovePriceDto,
  ArrivalPlanDto,
  CompareQuotesDto,
  ConvertDemandDto,
  CreateAwardDto,
  CreateBankAccountDto,
  CreateEstimateDto,
  CreateFrameAgreementDto,
  CreateOutsourceLossDto,
  CreateQualificationDto,
  CreateSupplierBlacklistDto,
  CreateTrackNodeDto,
  DifferenceReceiptDto,
  FreightReconcileDto,
  MatchEvidenceDto,
  MergeDemandsDto,
  OrderChangeDto,
  PortalInvoiceDto,
  PortalShipmentDto,
  QueryPurchaseDto,
  RenewQualificationDto,
  ResolvePriceDto,
  ReverseEstimateDto,
  ReverseStatementDto,
  RfqRoundQuoteDto,
  ScanReceiptDto,
  SettleOutsourceDto,
  StatementDifferenceDto,
  UpgradeFrameAgreementDto,
  WaybillExceptionDto
} from './dto'
import { PurchaseExtensionService } from './purchase-extension.service'

const guards = [AuthGuard, PermissionsGuard, DataScopeGuard]

/** 供应商资质与银行账户 */
@Controller('purchase/supplier-extensions')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class SupplierExtensionController {
  constructor(private readonly service: PurchaseExtensionService) {}

  @Get('qualifications/:supplierId') @RequirePerm('purchase:supplier:view')
  listQualifications(@Param('supplierId', ParseIntPipe) supplierId: number, @CurrentUser() user: JwtUser) {
    return this.service.listQualifications(supplierId, user)
  }

  @Post('qualifications') @RequirePerm('purchase:supplier:qualification')
  createQualification(@Body() dto: CreateQualificationDto, @CurrentUser() user: JwtUser) {
    return this.service.createQualification(dto, user)
  }

  @Put('qualifications/:id/renew') @RequirePerm('purchase:supplier:qualification')
  renew(@Param('id', ParseIntPipe) id: number, @Body() dto: RenewQualificationDto, @CurrentUser() user: JwtUser) {
    return this.service.renewQualification(id, dto, user)
  }

  @Get('qualification-alerts') @RequirePerm('purchase:supplier:view')
  alerts(@CurrentUser() user: JwtUser) {
    return this.service.qualificationAlertList(user)
  }

  @Get('bank-accounts/:supplierId') @RequirePerm('purchase:supplier:view')
  listBankAccounts(@Param('supplierId', ParseIntPipe) supplierId: number, @CurrentUser() user: JwtUser) {
    return this.service.listBankAccounts(supplierId, user)
  }

  @Post('bank-accounts') @RequirePerm('purchase:supplier:bank')
  createBankAccount(@Body() dto: CreateBankAccountDto, @CurrentUser() user: JwtUser) {
    return this.service.createBankAccount(dto, user)
  }

  @Get('radar/:supplierId') @RequirePerm('purchase:supplier:view')
  radar(@Param('supplierId', ParseIntPipe) supplierId: number, @CurrentUser() user: JwtUser) {
    return this.service.supplierRadar(supplierId, user)
  }
}

/** 询价多轮比价与授标 */
@Controller('purchase/awards')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class AwardExtensionController {
  constructor(private readonly service: PurchaseExtensionService) {}

  @Get() @RequirePerm('purchase:inquiry:view')
  list(@Query() query: QueryPurchaseDto, @CurrentUser() user: JwtUser) {
    return this.service.listAwards(query, user)
  }

  @Post('rfqs/:rfqId/rounds') @RequirePerm('purchase:inquiry:update')
  openRound(@Param('rfqId', ParseIntPipe) rfqId: number, @CurrentUser() user: JwtUser) {
    return this.service.openRound(rfqId, user)
  }

  @Post('rfq-lines/:lineId/quotes') @RequirePerm('purchase:inquiry:update')
  addQuote(@Param('lineId', ParseIntPipe) lineId: number, @Body() dto: RfqRoundQuoteDto, @CurrentUser() user: JwtUser) {
    return this.service.addRoundQuote(lineId, dto, user)
  }

  @Post('compare') @RequirePerm('purchase:inquiry:compare')
  compare(@Body() dto: CompareQuotesDto, @CurrentUser() user: JwtUser) {
    return this.service.compareQuotes(dto, user)
  }

  @Post() @RequirePerm('purchase:inquiry:approve')
  create(@Body() dto: CreateAwardDto, @CurrentUser() user: JwtUser) {
    return this.service.createAward(dto, user)
  }

  @Post(':id/approve') @RequirePerm('purchase:inquiry:approve')
  approve(@Param('id', ParseIntPipe) id: number, @Body() dto: ApproveAwardDto, @CurrentUser() user: JwtUser) {
    return this.service.approveAward(id, dto, user)
  }
}

/** 采购需求合并与转单、订单变更与到货计划 */
@Controller('purchase/order-extensions')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class OrderExtensionController {
  constructor(private readonly service: PurchaseExtensionService) {}

  @Post('demands/merge') @RequirePerm('purchase:demand:merge')
  mergeDemands(@Body() dto: MergeDemandsDto, @CurrentUser() user: JwtUser) {
    return this.service.mergeDemands(dto, user)
  }

  @Post('demands/convert') @RequirePerm('purchase:demand:convert')
  convertDemand(@Body() dto: ConvertDemandDto, @CurrentUser() user: JwtUser) {
    return this.service.convertDemand(dto, user)
  }

  @Post(':id/changes') @RequirePerm('purchase:order:change')
  change(@Param('id', ParseIntPipe) id: number, @Body() dto: OrderChangeDto, @CurrentUser() user: JwtUser) {
    return this.service.changeOrder(id, dto, user)
  }

  @Get(':id/changes') @RequirePerm('purchase:order:view')
  listChanges(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.listOrderChanges(id, user)
  }

  @Post(':id/arrival-plans') @RequirePerm('purchase:order:update')
  createArrivalPlan(@Param('id', ParseIntPipe) id: number, @Body() dto: ArrivalPlanDto, @CurrentUser() user: JwtUser) {
    return this.service.createArrivalPlan(id, dto, user)
  }

  @Get(':id/progress') @RequirePerm('purchase:order:view')
  progress(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.orderProgress(id, user)
  }

  @Post(':id/portal-confirm') @RequirePerm('purchase:portal:write')
  portalConfirm(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.confirmOrderByPortal(id, user)
  }
}

/** 扫码收货、差异收货、暂估冲销与成本分摊 */
@Controller('purchase/receipt-extensions')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class ReceiptExtensionController {
  constructor(private readonly service: PurchaseExtensionService) {}

  @Post('scan') @RequirePerm('purchase:receipt:scan')
  scan(@Body() dto: ScanReceiptDto, @CurrentUser() user: JwtUser) {
    return this.service.scanReceipt(dto, user)
  }

  @Post(':id/difference') @RequirePerm('purchase:receipt:difference')
  difference(@Param('id', ParseIntPipe) id: number, @Body() dto: DifferenceReceiptDto, @CurrentUser() user: JwtUser) {
    return this.service.receiveDifference(id, dto, user)
  }

  @Post(':id/estimate') @RequirePerm('purchase:receipt:create')
  estimate(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateEstimateDto, @CurrentUser() user: JwtUser) {
    return this.service.createEstimate(id, dto, user)
  }

  @Post(':id/estimate/reverse') @RequirePerm('purchase:estimate:reverse')
  reverseEstimate(@Param('id', ParseIntPipe) id: number, @Body() dto: ReverseEstimateDto, @CurrentUser() user: JwtUser) {
    return this.service.reverseEstimate(id, dto, user)
  }

  @Post(':id/cost-allocations') @RequirePerm('purchase:cost:allocate')
  allocate(@Param('id', ParseIntPipe) id: number, @Body() dto: AllocateCostDto, @CurrentUser() user: JwtUser) {
    return this.service.allocateCost(id, dto, user)
  }
}

/** 对账差异与红冲 */
@Controller('purchase/statement-extensions')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class StatementExtensionController {
  constructor(private readonly service: PurchaseExtensionService) {}

  @Get(':id/difference') @RequirePerm('purchase:statement:difference')
  difference(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.statementDifference(id, user)
  }

  @Post(':id/difference') @RequirePerm('purchase:statement:difference')
  markDifference(@Param('id', ParseIntPipe) id: number, @Body() dto: StatementDifferenceDto, @CurrentUser() user: JwtUser) {
    return this.service.markStatementDifference(id, dto, user)
  }

  @Post(':id/reverse') @RequirePerm('purchase:statement:reverse')
  reverse(@Param('id', ParseIntPipe) id: number, @Body() dto: ReverseStatementDto, @CurrentUser() user: JwtUser) {
    return this.service.reverseStatement(id, dto, user)
  }

  @Post(':id/portal-confirm') @RequirePerm('purchase:portal:write')
  portalConfirm(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.confirmStatementByPortal(id, user)
  }
}

/** 委外损耗、结算与对账 */
@Controller('purchase/outsource-extensions')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class OutsourceExtensionController {
  constructor(private readonly service: PurchaseExtensionService) {}

  @Post('losses') @RequirePerm('purchase:outsource:view')
  createLoss(@Body() dto: CreateOutsourceLossDto, @CurrentUser() user: JwtUser) {
    return this.service.createOutsourceLoss(dto, user)
  }

  @Post('losses/:id/approve') @RequirePerm('purchase:outsource:approve')
  approveLoss(@Param('id', ParseIntPipe) id: number, @Body() dto: ApproveLossDto, @CurrentUser() user: JwtUser) {
    return this.service.approveLoss(id, dto, user)
  }

  @Post(':id/settle') @RequirePerm('purchase:outsource:settle')
  settle(@Param('id', ParseIntPipe) id: number, @Body() dto: SettleOutsourceDto, @CurrentUser() user: JwtUser) {
    return this.service.settleOutsource(id, dto, user)
  }

  @Get(':id/reconcile') @RequirePerm('purchase:outsource:view')
  reconcile(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.outsourceReconcile(id, user)
  }
}

/** 物流轨迹、异常签收与运费对账 */
@Controller('purchase/logistics-extensions')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class LogisticsExtensionController {
  constructor(private readonly service: PurchaseExtensionService) {}

  @Post('waybills/:waybillId/track-nodes') @RequirePerm('purchase:logistics:track')
  addTrack(@Param('waybillId', ParseIntPipe) waybillId: number, @Body() dto: CreateTrackNodeDto, @CurrentUser() user: JwtUser) {
    return this.service.addTrackNode(waybillId, dto, user)
  }

  @Get('waybills/:waybillId/track-nodes') @RequirePerm('purchase:logistics:view')
  listTrack(@Param('waybillId', ParseIntPipe) waybillId: number, @CurrentUser() user: JwtUser) {
    return this.service.listTrackNodes(waybillId, user)
  }

  @Post('waybills/:waybillId/exception') @RequirePerm('purchase:logistics:track')
  exception(@Param('waybillId', ParseIntPipe) waybillId: number, @Body() dto: WaybillExceptionDto, @CurrentUser() user: JwtUser) {
    return this.service.reportWaybillException(waybillId, dto, user)
  }

  @Post('waybills/:waybillId/freight-reconcile') @RequirePerm('purchase:logistics:reconcile')
  reconcile(@Param('waybillId', ParseIntPipe) waybillId: number, @Body() dto: FreightReconcileDto, @CurrentUser() user: JwtUser) {
    return this.service.reconcileFreight(waybillId, dto, user)
  }
}

/** 采购价目表矩阵、历史价、自动取价与改价审批、供应商门户写操作、采购绩效 */
@Controller('purchase/price-extensions')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class PriceExtensionController {
  constructor(private readonly service: PurchaseExtensionService) {}

  @Get('matrix') @RequirePerm('purchase:price:view')
  matrix(@CurrentUser() user: JwtUser) {
    return this.service.priceMatrix(user)
  }

  @Get('history') @RequirePerm('purchase:price:view')
  history(@Query('productId', ParseIntPipe) productId: number, @Query('supplierId', ParseIntPipe) supplierId: number, @CurrentUser() user: JwtUser) {
    return this.service.priceHistory(productId, supplierId, user)
  }

  @Post('resolve') @RequirePerm('purchase:price:view')
  resolve(@Body() dto: ResolvePriceDto, @CurrentUser() user: JwtUser) {
    return this.service.resolvePrice(dto, user)
  }

  @Post(':id/approve') @RequirePerm('purchase:price:approve')
  approve(@Param('id', ParseIntPipe) id: number, @Body() dto: ApprovePriceDto, @CurrentUser() user: JwtUser) {
    return this.service.approvePrice(id, dto, user)
  }

  @Post('portal/shipments') @RequirePerm('purchase:portal:write')
  portalShipment(@Body() dto: PortalShipmentDto, @CurrentUser() user: JwtUser) {
    return this.service.portalShipment(dto, user)
  }

  @Post('portal/invoices') @RequirePerm('purchase:portal:write')
  portalInvoice(@Body() dto: PortalInvoiceDto, @CurrentUser() user: JwtUser) {
    return this.service.portalInvoice(dto, user)
  }

  @Get('performance') @RequirePerm('purchase:report:view')
  performance(@CurrentUser() user: JwtUser) {
    return this.service.performance(user)
  }
}

/** 三方匹配证据链、框架协议版本与供应商黑名单 */
@Controller('purchase/compliance-extensions')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class ComplianceExtensionController {
  constructor(private readonly service: PurchaseExtensionService) {}

  @Post('match-evidence') @RequirePerm('purchase:match:view')
  runMatchEvidence(@Body() dto: MatchEvidenceDto, @CurrentUser() user: JwtUser) {
    return this.service.runMatchEvidence(dto, user)
  }

  @Get('match-evidence/:receiptId') @RequirePerm('purchase:match:view')
  listMatchEvidence(@Param('receiptId', ParseIntPipe) receiptId: number, @CurrentUser() user: JwtUser) {
    return this.service.listMatchEvidence(receiptId, user)
  }

  @Post('frame-agreements') @RequirePerm('purchase:frame:view')
  createFrameAgreement(@Body() dto: CreateFrameAgreementDto, @CurrentUser() user: JwtUser) {
    return this.service.createFrameAgreement(dto, user)
  }

  @Get('frame-agreements') @RequirePerm('purchase:frame:view')
  listFrameAgreements(@Query() query: QueryPurchaseDto, @CurrentUser() user: JwtUser) {
    return this.service.listFrameAgreements(query, user)
  }

  @Put('frame-agreements/:id/upgrade') @RequirePerm('purchase:frame:view')
  upgradeFrameAgreement(@Param('id', ParseIntPipe) id: number, @Body() dto: UpgradeFrameAgreementDto, @CurrentUser() user: JwtUser) {
    return this.service.upgradeFrameAgreement(id, dto, user)
  }

  @Post('supplier-blacklist') @RequirePerm('purchase:blacklist:view')
  addSupplierBlacklist(@Body() dto: CreateSupplierBlacklistDto, @CurrentUser() user: JwtUser) {
    return this.service.addSupplierBlacklist(dto, user)
  }

  @Get('supplier-blacklist') @RequirePerm('purchase:blacklist:view')
  listSupplierBlacklists(@Query() query: QueryPurchaseDto, @CurrentUser() user: JwtUser) {
    return this.service.listSupplierBlacklists(query, user)
  }

  @Get('supplier-blacklist/:supplierId/check') @RequirePerm('purchase:blacklist:view')
  checkSupplierBlacklist(@Param('supplierId', ParseIntPipe) supplierId: number, @CurrentUser() user: JwtUser) {
    return this.service.checkSupplierBlacklist(supplierId, user)
  }

  @Delete('supplier-blacklist/:supplierId') @RequirePerm('purchase:blacklist:view')
  liftSupplierBlacklist(@Param('supplierId', ParseIntPipe) supplierId: number, @CurrentUser() user: JwtUser) {
    return this.service.liftSupplierBlacklist(supplierId, user)
  }
}
