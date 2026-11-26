import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import {
  CloseExceptionDto, CompleteDto, CreateBomDto, CreateEquipmentDto, CreateExceptionDto,
  CreateMaterialReturnDto, CreatePlanTaskDto, CreateQcDto, CreateRoutingDto, CreateWorkCenterDto,
  CreateWorkOrderDto, IssueDto, QueryManufacturingDto, QueryMaterialReturnDto, ReportDto, RunMrpDto,
  UpdatePlanTaskDto, UpdateWorkOrderDto
} from './dto'
import { ManufacturingService } from './manufacturing.service'

const guards = [AuthGuard, PermissionsGuard, DataScopeGuard]

@Controller('mfg/boms')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class BomController {
  constructor(private readonly service: ManufacturingService) {}
  @Get() @RequirePerm('mfg:bom:view')
  list(@Query() query: QueryManufacturingDto, @CurrentUser() user: JwtUser) { return this.service.listBoms(query, user) }
  @Get(':id/detail') @RequirePerm('mfg:bom:view')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.bomDetail(id, user) }
  @Post() @RequirePerm('mfg:bom:create')
  create(@Body() dto: CreateBomDto, @CurrentUser() user: JwtUser) { return this.service.createBom(dto, user) }
  @Post(':id/activate') @RequirePerm('mfg:bom:approve')
  activate(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.activateBom(id, user) }
  @Get(':id/cost') @RequirePerm('mfg:bom:view')
  cost(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.rollupBomCost(id, user) }
  @Post('items/:itemId/substitute') @RequirePerm('mfg:bom:view')
  substitute(@Param('itemId', ParseIntPipe) itemId: number, @Body() body: { requiredQty: number }, @CurrentUser() user: JwtUser) {
    return this.service.resolveMaterialSubstitute(itemId, body.requiredQty, user)
  }
}

@Controller('mfg/work-centers')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class WorkCenterController {
  constructor(private readonly service: ManufacturingService) {}
  @Get() @RequirePerm('mfg:routing:view')
  list(@Query() query: QueryManufacturingDto, @CurrentUser() user: JwtUser) { return this.service.listCenters(query, user) }
  @Post() @RequirePerm('mfg:routing:create')
  create(@Body() dto: CreateWorkCenterDto, @CurrentUser() user: JwtUser) { return this.service.createCenter(dto, user) }
}

@Controller('mfg/routings')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class RoutingController {
  constructor(private readonly service: ManufacturingService) {}
  @Get() @RequirePerm('mfg:routing:view')
  list(@Query() query: QueryManufacturingDto, @CurrentUser() user: JwtUser) { return this.service.listRoutings(query, user) }
  @Get(':id/detail') @RequirePerm('mfg:routing:view')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.routingDetail(id, user) }
  @Post() @RequirePerm('mfg:routing:create')
  create(@Body() dto: CreateRoutingDto, @CurrentUser() user: JwtUser) { return this.service.createRouting(dto, user) }
  @Get('effective/:productId') @RequirePerm('mfg:routing:view')
  effective(@Param('productId', ParseIntPipe) productId: number, @Query('date') date: string, @CurrentUser() user: JwtUser) {
    return this.service.findEffectiveRouting(productId, date || new Date().toISOString().slice(0, 10), user)
  }
}

@Controller('mfg/mrp')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class MrpController {
  constructor(private readonly service: ManufacturingService) {}
  @Get('runs') @RequirePerm('mfg:mrp:view')
  runs(@Query() query: QueryManufacturingDto, @CurrentUser() user: JwtUser) { return this.service.listMrpRuns(query, user) }
  @Get('runs/:runId/suggests') @RequirePerm('mfg:mrp:view')
  suggests(@Param('runId', ParseIntPipe) runId: number, @CurrentUser() user: JwtUser) { return this.service.listMrpSuggests(runId, user) }
  @Post('run') @RequirePerm('mfg:mrp:run')
  run(@Body() dto: RunMrpDto, @CurrentUser() user: JwtUser) { return this.service.runMrp(dto, user) }
  /** 按 MRP 建议自动生成采购需求 */
  @Post(':id/generate-demands') @RequirePerm('purchase:demand:convert')
  generateDemands(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.generatePurchaseDemands(id, user)
  }
}

@Controller('mfg/plans')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class PlanController {
  constructor(private readonly service: ManufacturingService) {}
  @Get() @RequirePerm('mfg:plan:view')
  list(@Query() query: QueryManufacturingDto, @CurrentUser() user: JwtUser) { return this.service.listPlanTasks(query, user) }
  @Post() @RequirePerm('mfg:plan:create')
  create(@Body() dto: CreatePlanTaskDto, @CurrentUser() user: JwtUser) { return this.service.createPlanTasks(dto, user) }
  @Put(':id') @RequirePerm('mfg:plan:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePlanTaskDto, @CurrentUser() user: JwtUser) { return this.service.updatePlanTask(id, dto, user) }
  @Delete(':id') @RequirePerm('mfg:plan:delete')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.removePlanTask(id, user) }
}

@Controller('mfg/work-orders')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class WorkOrderController {
  constructor(private readonly service: ManufacturingService) {}
  @Get() @RequirePerm('mfg:work-order:view')
  list(@Query() query: QueryManufacturingDto, @CurrentUser() user: JwtUser) { return this.service.listWorkOrders(query, user) }
  @Get(':id/detail') @RequirePerm('mfg:work-order:view')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.workOrderDetail(id, user) }
  @Post() @RequirePerm('mfg:work-order:create')
  create(@Body() dto: CreateWorkOrderDto, @CurrentUser() user: JwtUser) { return this.service.createWorkOrder(dto, user) }
  @Put(':id') @RequirePerm('mfg:work-order:update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWorkOrderDto, @CurrentUser() user: JwtUser) { return this.service.updateWorkOrder(id, dto, user) }
  @Post(':id/submit') @RequirePerm('mfg:work-order:submit')
  submit(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.submitWorkOrder(id, user) }
  @Post(':id/approve') @RequirePerm('mfg:work-order:approve')
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.approveWorkOrder(id, user) }
  @Get(':id/kitting') @RequirePerm('mfg:work-order:view')
  kitting(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.checkWorkOrderKitting(id, user) }
  @Post(':id/issue') @RequirePerm('mfg:issue:create')
  issue(@Param('id', ParseIntPipe) id: number, @Body() dto: IssueDto, @CurrentUser() user: JwtUser) { return this.service.issue(id, dto, user) }
  @Post(':id/report') @RequirePerm('mfg:report:create')
  report(@Param('id', ParseIntPipe) id: number, @Body() dto: ReportDto, @CurrentUser() user: JwtUser) { return this.service.report(id, dto, user) }
  @Post(':id/complete') @RequirePerm('mfg:complete:create')
  complete(@Param('id', ParseIntPipe) id: number, @Body() dto: CompleteDto, @CurrentUser() user: JwtUser) { return this.service.complete(id, dto, user) }
}

@Controller('mfg/qc')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class QcController {
  constructor(private readonly service: ManufacturingService) {}
  @Get() @RequirePerm('mfg:qc:view')
  list(@Query() query: QueryManufacturingDto, @CurrentUser() user: JwtUser) { return this.service.listQcs(query, user) }
  @Post() @RequirePerm('mfg:qc:create')
  create(@Body() dto: CreateQcDto, @CurrentUser() user: JwtUser) { return this.service.createQc(dto, user) }
  @Get('sampling/:lotQty') @RequirePerm('mfg:qc:view')
  sampling(@Param('lotQty', ParseIntPipe) lotQty: number) { return this.service.suggestSampling(lotQty) }
  @Post(':id/concession') @RequirePerm('mfg:qc:approve')
  concession(@Param('id', ParseIntPipe) id: number, @Body() body: { reason: string }, @CurrentUser() user: JwtUser) { return this.service.concessionQc(id, body.reason, user) }
}

@Controller('mfg/equipment')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class EquipmentController {
  constructor(private readonly service: ManufacturingService) {}
  @Get() @RequirePerm('mfg:equipment:view')
  list(@Query() query: QueryManufacturingDto, @CurrentUser() user: JwtUser) { return this.service.listEquipment(query, user) }
  @Post() @RequirePerm('mfg:equipment:create')
  create(@Body() dto: CreateEquipmentDto, @CurrentUser() user: JwtUser) { return this.service.createEquipment(dto, user) }
  @Post(':id/inspect') @RequirePerm('mfg:equipment:update')
  inspect(@Param('id', ParseIntPipe) id: number, @Body() dto: { availability: number; performanceRate: number; qualityRate: number; result?: string; remark?: string }, @CurrentUser() user: JwtUser) { return this.service.inspectEquipment(id, dto, user) }
  @Get('maintenance-alerts') @RequirePerm('mfg:equipment:view')
  maintenanceAlerts(@Query('cycleDays') cycleDays: string, @CurrentUser() user: JwtUser) { return this.service.maintenanceAlerts(Number(cycleDays) || 30, user) }
}

@Controller('mfg/exceptions')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class ExceptionController {
  constructor(private readonly service: ManufacturingService) {}
  @Get() @RequirePerm('mfg:exception:view')
  list(@Query() query: QueryManufacturingDto, @CurrentUser() user: JwtUser) { return this.service.listExceptions(query, user) }
  @Post() @RequirePerm('mfg:exception:create')
  create(@Body() dto: CreateExceptionDto, @CurrentUser() user: JwtUser) { return this.service.createException(dto, user) }
  @Post(':id/close') @RequirePerm('mfg:exception:close')
  close(@Param('id', ParseIntPipe) id: number, @Body() dto: CloseExceptionDto, @CurrentUser() user: JwtUser) { return this.service.closeException(id, dto, user) }
}

@Controller('mfg/reports')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class ManufacturingReportController {
  constructor(private readonly service: ManufacturingService) {}
  @Get('summary') @RequirePerm('mfg:report:view')
  summary(@CurrentUser() user: JwtUser) { return this.service.reportSummary(user) }
}

@Controller('mfg/material-returns')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class MaterialReturnController {
  constructor(private readonly service: ManufacturingService) {}
  @Get() @RequirePerm('mfg:return:view')
  list(@Query() query: QueryMaterialReturnDto, @CurrentUser() user: JwtUser) { return this.service.listMaterialReturns(query, user) }
  @Get(':id/detail') @RequirePerm('mfg:return:view')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.materialReturnDetail(id, user) }
  @Post() @RequirePerm('mfg:return:create')
  create(@Body() dto: CreateMaterialReturnDto, @CurrentUser() user: JwtUser) { return this.service.createMaterialReturn(dto, user) }
  @Post(':id/post') @RequirePerm('mfg:return:post')
  post(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.postMaterialReturn(id, user) }
  @Post(':id/cancel') @RequirePerm('mfg:return:post')
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.cancelMaterialReturn(id, user) }
}

@Controller('mfg/demand')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class DemandSummaryController {
  constructor(private readonly service: ManufacturingService) {}
  @Get('summary') @RequirePerm('mfg:demand:view')
  summary(@CurrentUser() user: JwtUser) { return this.service.demandSummary(user) }
}
