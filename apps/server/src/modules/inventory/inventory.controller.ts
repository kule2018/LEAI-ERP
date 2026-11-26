import { Body, Controller, Get, Header, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import {
  ChangeCostingMethodDto, CloseAlertDto, CostPeriodLockDto, CreateAdjustmentDto, CreateAlertDto,
  CreateAssemblyDto, CreateBatchProfileDto, CreatePutawayDto, CreatePutawayStrategyDto, CreateStocktakeDto,
  CreateTransferDto, CreateWaveDto, InventoryReportDto, LockStockDto, PickDto, PostAdjustmentDto,
  PutawayRecommendDto, QueryBatchProfileDto, QueryInventoryDto, RecallFreezeDto, ReceiveTransferDto,
  RecountStocktakeDto, RejectStocktakeApprovalDto, SaveAlertPolicyDto, ScanAlertDto, ScanStocktakeDto, StockMovementDto
} from './dto'
import { InventoryAlertService } from './inventory-alert.service'
import { InventoryService } from './inventory.service'

const guards = [AuthGuard, PermissionsGuard, DataScopeGuard]

@Controller('inventory/balances')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class BalanceController {
  constructor(private readonly service: InventoryService) {}
  @Get() @RequirePerm('inventory:balance:view')
  list(@Query() query: QueryInventoryDto, @CurrentUser() user: JwtUser) { return this.service.listBalances(query, user) }
  @Get('available') @RequirePerm('inventory:balance:view')
  available(@Query() query: QueryInventoryDto, @CurrentUser() user: JwtUser) { return this.service.availableStock(query, user) }
  @Get('matrix') @RequirePerm('inventory:balance:view')
  matrix(@Query() query: QueryInventoryDto, @CurrentUser() user: JwtUser) { return this.service.batchLocationMatrix(query, user) }
}

@Controller('inventory/ledger')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class LedgerController {
  constructor(private readonly service: InventoryService) {}
  @Get() @RequirePerm('inventory:ledger:view')
  list(@Query() query: QueryInventoryDto, @CurrentUser() user: JwtUser) { return this.service.listLedger(query, user) }
  @Get('export') @RequirePerm('inventory:ledger:export')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="inventory-ledger.csv"')
  async export(@Query() query: QueryInventoryDto, @CurrentUser() user: JwtUser): Promise<string> {
    const result = await this.service.exportLedger(query, user)
    return result.content
  }
  @Get('trace/:batchNo') @RequirePerm('inventory:ledger:view')
  trace(@Param('batchNo') batchNo: string, @CurrentUser() user: JwtUser) { return this.service.traceBatch(batchNo, user) }
}

@Controller('inventory/recall')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class RecallController {
  constructor(private readonly service: InventoryService) {}
  @Post('freeze') @RequirePerm('inventory:stocktake:approve')
  freeze(@Body() dto: RecallFreezeDto, @CurrentUser() user: JwtUser) {
    return this.service.recallFreeze(dto.productId, dto.batchNo, dto.qty, user)
  }
}

@Controller('inventory/movements')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class MovementController {
  constructor(private readonly service: InventoryService) {}
  @Post() @RequirePerm('inventory:inout:create')
  create(@Body() dto: StockMovementDto, @CurrentUser() user: JwtUser) { return this.service.postMovement(dto, user) }
}

@Controller('inventory/locks')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class LockController {
  constructor(private readonly service: InventoryService) {}
  @Get() @RequirePerm('inventory:balance:view')
  list(@Query() query: QueryInventoryDto, @CurrentUser() user: JwtUser) { return this.service.listLocks(query, user) }
  @Post() @RequirePerm('inventory:balance:update')
  lock(@Body() dto: LockStockDto, @CurrentUser() user: JwtUser) { return this.service.lockStock(dto, user) }
  @Post('unlock') @RequirePerm('inventory:balance:update')
  unlock(@Body() dto: LockStockDto, @CurrentUser() user: JwtUser) { return this.service.unlockStock(dto.sourceType, dto.sourceId, user) }
}

@Controller('inventory/alerts')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class AlertController {
  constructor(
    private readonly service: InventoryService,
    private readonly alertService: InventoryAlertService
  ) {}
  @Get() @RequirePerm('inventory:alert:view')
  list(@Query() query: QueryInventoryDto, @CurrentUser() user: JwtUser) { return this.service.listAlerts(query, user) }
  @Post() @RequirePerm('inventory:alert:create')
  create(@Body() dto: CreateAlertDto, @CurrentUser() user: JwtUser) { return this.service.createAlert(dto, user) }
  @Post(':id/close') @RequirePerm('inventory:alert:update')
  close(@Param('id', ParseIntPipe) id: number, @Body() dto: CloseAlertDto, @CurrentUser() user: JwtUser) {
    return this.alertService.closeAlert(id, dto.reason, user)
  }
}

@Controller('inventory/batch-profiles')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class BatchProfileController {
  constructor(private readonly alertService: InventoryAlertService) {}
  @Get() @RequirePerm('inventory:alert:view')
  list(@Query() query: QueryBatchProfileDto, @CurrentUser() user: JwtUser) {
    return this.alertService.listBatchProfiles(query, user)
  }
  @Post() @RequirePerm('inventory:alert:create')
  create(@Body() dto: CreateBatchProfileDto, @CurrentUser() user: JwtUser) {
    return this.alertService.saveBatchProfile(dto, user)
  }
  /** 巡检：临期/过期、安全库存、呆滞库存预警落库 */
  @Post('scan') @RequirePerm('inventory:alert:create')
  scan(@Body() dto: ScanAlertDto, @CurrentUser() user: JwtUser) {
    return this.alertService.scanAlerts({ warnDays: dto.warnDays, urgentDays: dto.urgentDays }, user)
  }
  /** 预警策略列表 */
  @Get('policies') @RequirePerm('inventory:alert:view')
  policies(@CurrentUser() user: JwtUser) {
    return this.alertService.listPolicies(user)
  }
  /** 保存预警策略 */
  @Post('policies') @RequirePerm('inventory:alert:create')
  savePolicy(@Body() dto: SaveAlertPolicyDto, @CurrentUser() user: JwtUser) {
    return this.alertService.savePolicy(dto, user)
  }
}

@Controller('inventory/stocktakes')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class StocktakeController {
  constructor(private readonly service: InventoryService) {}
  @Get() @RequirePerm('inventory:stocktake:view')
  list(@Query() query: QueryInventoryDto, @CurrentUser() user: JwtUser) { return this.service.listStocktakes(query, user) }
  @Get(':id/detail') @RequirePerm('inventory:stocktake:view')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.stocktakeDetail(id, user) }
  @Post() @RequirePerm('inventory:stocktake:create')
  create(@Body() dto: CreateStocktakeDto, @CurrentUser() user: JwtUser) { return this.service.createStocktake(dto, user) }
  @Post(':id/approve') @RequirePerm('inventory:stocktake:approve')
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.approveStocktake(id, user) }
  /** 提交盘点差异审批：无差异直接过账，有差异进入审批中 */
  @Post(':id/submit-approval') @RequirePerm('inventory:stocktake:create')
  submitApproval(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.submitStocktakeApproval(id, user) }
  /** 驳回盘点差异审批 */
  @Post(':id/reject-approval') @RequirePerm('inventory:stocktake:approve')
  rejectApproval(@Param('id', ParseIntPipe) id: number, @Body() dto: RejectStocktakeApprovalDto, @CurrentUser() user: JwtUser) { return this.service.rejectStocktakeApproval(id, dto.reason, user) }
  @Post(':id/recount') @RequirePerm('inventory:stocktake:approve')
  recount(@Param('id', ParseIntPipe) id: number, @Body() dto: RecountStocktakeDto, @CurrentUser() user: JwtUser) { return this.service.recountStocktake(id, dto.lines, user) }
  @Post(':id/scan') @RequirePerm('inventory:stocktake:create')
  scan(@Param('id', ParseIntPipe) id: number, @Body() dto: ScanStocktakeDto, @CurrentUser() user: JwtUser) { return this.service.scanStocktake(id, dto, user) }
}

/** 库存调整单：盘盈 / 盘亏 / 系统差异修正 */
@Controller('inventory/adjustments')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class AdjustmentController {
  constructor(private readonly service: InventoryService) {}
  @Get() @RequirePerm('inventory:adjustment:view')
  list(@Query() query: QueryInventoryDto, @CurrentUser() user: JwtUser) { return this.service.listAdjustments(query, user) }
  @Get(':id') @RequirePerm('inventory:adjustment:view')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.adjustmentDetail(id, user) }
  @Post() @RequirePerm('inventory:adjustment:create')
  create(@Body() dto: CreateAdjustmentDto, @CurrentUser() user: JwtUser) { return this.service.createAdjustment(dto, user) }
  @Post(':id/post') @RequirePerm('inventory:adjustment:post')
  post(@Param('id', ParseIntPipe) id: number, @Body() dto: PostAdjustmentDto, @CurrentUser() user: JwtUser) { return this.service.postAdjustment(id, dto, user) }
  @Post(':id/cancel') @RequirePerm('inventory:adjustment:post')
  cancel(@Param('id', ParseIntPipe) id: number, @Body() dto: PostAdjustmentDto, @CurrentUser() user: JwtUser) { return this.service.cancelAdjustment(id, dto, user) }
}

@Controller('inventory/negative-stock')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class NegativeStockController {
  constructor(private readonly service: InventoryService) {}
  @Get() @RequirePerm('inventory:negative:view')
  list(@Query() query: QueryInventoryDto, @CurrentUser() user: JwtUser) {
    return this.service.listNegativeStock(query, user)
  }
}

@Controller('inventory/costing')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class CostingController {
  constructor(private readonly service: InventoryService) {}
  @Get('layers') @RequirePerm('inventory:costing:view')
  listLayers(@Query() query: QueryInventoryDto, @CurrentUser() user: JwtUser) { return this.service.listCostLayers(query, user) }
  @Get('preview') @RequirePerm('inventory:costing:view')
  preview(
    @Query('productId', ParseIntPipe) productId: number,
    @Query('qty') qty: string,
    @CurrentUser() user: JwtUser
  ) { return this.service.previewCostLayerConsumption(productId, qty, user) }
  @Get('period-locks') @RequirePerm('inventory:costing:view')
  periodLocks(@CurrentUser() user: JwtUser) { return this.service.listCostPeriodLocks(user) }
  @Put('products/:productId/method') @RequirePerm('inventory:costing:manage')
  updateMethod(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: ChangeCostingMethodDto,
    @CurrentUser() user: JwtUser
  ) { return this.service.updateCostingMethod(productId, dto.method, user) }
  @Post('period-locks/:period/lock') @RequirePerm('inventory:costing:manage')
  lock(
    @Param('period') period: string,
    @Body() dto: CostPeriodLockDto,
    @CurrentUser() user: JwtUser
  ) { return this.service.setCostPeriodLock(period, true, dto.reason, user) }
  @Post('period-locks/:period/release') @RequirePerm('inventory:costing:manage')
  release(@Param('period') period: string, @CurrentUser() user: JwtUser) {
    return this.service.setCostPeriodLock(period, false, undefined, user)
  }
}

@Controller('inventory/transfers')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class TransferController {
  constructor(private readonly service: InventoryService) {}
  @Get() @RequirePerm('inventory:transfer:view')
  list(@Query() query: QueryInventoryDto, @CurrentUser() user: JwtUser) { return this.service.listTransfers(query, user) }
  @Post() @RequirePerm('inventory:transfer:create')
  create(@Body() dto: CreateTransferDto, @CurrentUser() user: JwtUser) { return this.service.createTransfer(dto, user) }
  @Post(':id/submit') @RequirePerm('inventory:transfer:create')
  submit(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.submitTransfer(id, user) }
  @Post(':id/receive') @RequirePerm('inventory:transfer:receive')
  receive(@Param('id', ParseIntPipe) id: number, @Body() dto: ReceiveTransferDto, @CurrentUser() user: JwtUser) { return this.service.receiveTransfer(id, user, dto) }
}

@Controller('inventory/putaways')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class PutawayController {
  constructor(private readonly service: InventoryService) {}
  @Get() @RequirePerm('inventory:putaway:view')
  list(@Query() query: QueryInventoryDto, @CurrentUser() user: JwtUser) { return this.service.listPutaways(query, user) }
  @Post() @RequirePerm('inventory:putaway:create')
  create(@Body() dto: CreatePutawayDto, @CurrentUser() user: JwtUser) { return this.service.createPutaway(dto, user) }
  @Post(':id/complete') @RequirePerm('inventory:putaway:update')
  complete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.completePutaway(id, user) }
}

@Controller('inventory/waves')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class WaveController {
  constructor(private readonly service: InventoryService) {}
  @Get() @RequirePerm('inventory:wave:view')
  list(@Query() query: QueryInventoryDto, @CurrentUser() user: JwtUser) { return this.service.listWaves(query, user) }
  @Get(':id/detail') @RequirePerm('inventory:wave:view')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.waveDetail(id, user) }
  @Post() @RequirePerm('inventory:wave:create')
  create(@Body() dto: CreateWaveDto, @CurrentUser() user: JwtUser) { return this.service.createWave(dto, user) }
  @Post(':id/tasks/:taskId/pick') @RequirePerm('inventory:wave:pick')
  pick(@Param('id', ParseIntPipe) id: number, @Param('taskId', ParseIntPipe) taskId: number, @Body() dto: PickDto, @CurrentUser() user: JwtUser) { return this.service.pickTask(id, taskId, dto, user) }
  @Post(':id/complete') @RequirePerm('inventory:wave:complete')
  complete(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.completeWave(id, user) }
  /** 波次复核：复核后才允许发货 */
  @Post(':id/review') @RequirePerm('inventory:wave:review')
  review(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.reviewWave(id, user) }
}

@Controller('inventory/assemblies')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class AssemblyController {
  constructor(private readonly service: InventoryService) {}
  @Get() @RequirePerm('inventory:assembly:view')
  list(@Query() query: QueryInventoryDto, @CurrentUser() user: JwtUser) { return this.service.listAssemblies(query, user) }
  @Post() @RequirePerm('inventory:assembly:create')
  create(@Body() dto: CreateAssemblyDto, @CurrentUser() user: JwtUser) { return this.service.createAssembly(dto, user) }
  @Post(':id/approve') @RequirePerm('inventory:assembly:approve')
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.approveAssembly(id, user) }
}

@Controller('inventory/reports')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class InventoryReportController {
  constructor(private readonly service: InventoryService) {}
  @Get('summary') @RequirePerm('inventory:report:view')
  summary(@CurrentUser() user: JwtUser) { return this.service.report(user) }
  @Get('aging') @RequirePerm('inventory:report:view')
  aging(@Query() query: InventoryReportDto, @CurrentUser() user: JwtUser) { return this.service.agingReport(query, user) }
  @Get('abc') @RequirePerm('inventory:report:view')
  abc(@Query() query: InventoryReportDto, @CurrentUser() user: JwtUser) { return this.service.abcReport(query, user) }
  @Get('in-out') @RequirePerm('inventory:report:view')
  inOut(@Query() query: InventoryReportDto, @CurrentUser() user: JwtUser) { return this.service.inOutReport(query, user) }
  @Get('in-transit') @RequirePerm('inventory:report:view')
  inTransit(@Query() query: InventoryReportDto, @CurrentUser() user: JwtUser) { return this.service.inTransitReport(query, user) }
}

/** 上架策略规则与库位推荐 */
@Controller('inventory/putaway-strategies')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class PutawayStrategyController {
  constructor(private readonly service: InventoryService) {}
  @Get() @RequirePerm('inventory:putaway:view')
  list(@Query() query: QueryInventoryDto, @CurrentUser() user: JwtUser) { return this.service.listPutawayStrategies(query, user) }
  @Post() @RequirePerm('inventory:putaway:create')
  create(@Body() dto: CreatePutawayStrategyDto, @CurrentUser() user: JwtUser) { return this.service.createPutawayStrategy(dto, user) }
  @Post('recommend') @RequirePerm('inventory:putaway:view')
  recommend(@Body() dto: PutawayRecommendDto, @CurrentUser() user: JwtUser) { return this.service.recommendPutaway(dto, user) }
}

/** 拣货路径优化 */
@Controller('inventory/waves')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class PickPathController {
  constructor(private readonly service: InventoryService) {}
  @Get(':id/pick-path') @RequirePerm('inventory:wave:view')
  path(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.optimizePickPath(id, user) }
}
