import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import {
  ApproveBomChangeDto, ApproveWorkOrderChangeDto, BomVersionDiffDto, CreateBomChangeDto, CreateChangeoverRuleDto,
  CreateEquipmentFaultDto, CreateMaintenanceDto, CreateQcItemDto, CreateWorkOrderChangeDto, ExecuteMaintenanceDto,
  LockPlanTaskDto, MrpSimulateDto, OverIssueApproveDto, ProductionAnalysisQueryDto, QueryChangeoverLogDto,
  QueryManufacturingExtensionDto, RepairEquipmentFaultDto, ReschedulePlanTaskDto, ScanReportDto, ScheduleQueryDto,
  SplitWorkOrderDto, StopLineDto
} from './manufacturing-extension.dto'
import { ManufacturingExtensionService } from './manufacturing-extension.service'

const guards = [AuthGuard, PermissionsGuard, DataScopeGuard]

@Controller('mfg/extensions')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class ManufacturingExtensionController {
  constructor(private readonly service: ManufacturingExtensionService) {}

  /* BOM 版本对比与变更审批 */
  @Get('boms/version-diff') @RequirePerm('mfg:bom:view')
  bomVersionDiff(@Query() query: BomVersionDiffDto, @CurrentUser() user: JwtUser) { return this.service.bomVersionDiff(query, user) }

  @Post('boms/changes') @RequirePerm('mfg:bom:change')
  createBomChange(@Body() dto: CreateBomChangeDto, @CurrentUser() user: JwtUser) { return this.service.createBomChange(dto, user) }

  @Get('boms/changes') @RequirePerm('mfg:bom:view')
  listBomChanges(@Query() query: QueryManufacturingExtensionDto, @CurrentUser() user: JwtUser) { return this.service.listBomChanges(query, user) }

  @Put('boms/changes/:id/approve') @RequirePerm('mfg:bom:change')
  approveBomChange(@Param('id', ParseIntPipe) id: number, @Body() dto: ApproveBomChangeDto, @CurrentUser() user: JwtUser) {
    return this.service.approveBomChange(id, dto, user)
  }

  /* 工单变更与拆分 */
  @Post('work-orders/:id/changes') @RequirePerm('mfg:work-order:change')
  createWorkOrderChange(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateWorkOrderChangeDto, @CurrentUser() user: JwtUser) {
    return this.service.createWorkOrderChange(id, dto, user)
  }

  @Get('work-orders/:id/changes') @RequirePerm('mfg:work-order:view')
  listWorkOrderChanges(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.listWorkOrderChanges(id, user) }

  @Put('work-order-changes/:id/approve') @RequirePerm('mfg:work-order:change')
  approveWorkOrderChange(@Param('id', ParseIntPipe) id: number, @Body() dto: ApproveWorkOrderChangeDto, @CurrentUser() user: JwtUser) {
    return this.service.approveWorkOrderChange(id, dto, user)
  }

  @Post('work-orders/:id/split') @RequirePerm('mfg:work-order:split')
  splitWorkOrder(@Param('id', ParseIntPipe) id: number, @Body() dto: SplitWorkOrderDto, @CurrentUser() user: JwtUser) {
    return this.service.splitWorkOrder(id, dto, user)
  }

  /* 排产冲突、产能负荷与锁定 */
  @Get('schedule/conflicts') @RequirePerm('mfg:schedule:view')
  scheduleConflicts(@Query() query: ScheduleQueryDto, @CurrentUser() user: JwtUser) { return this.service.scheduleConflicts(query, user) }

  @Get('schedule/capacity-load') @RequirePerm('mfg:schedule:view')
  capacityLoad(@Query() query: ScheduleQueryDto, @CurrentUser() user: JwtUser) { return this.service.capacityLoad(query, user) }

  @Put('plan-tasks/:id/lock') @RequirePerm('mfg:schedule:lock')
  lockPlanTask(@Param('id', ParseIntPipe) id: number, @Body() dto: LockPlanTaskDto, @CurrentUser() user: JwtUser) {
    return this.service.lockPlanTask(id, dto, user)
  }

  /* 拖拽排产与换线 */
  @Get('schedule/gantt') @RequirePerm('mfg:schedule:view')
  ganttSchedule(@Query() query: ScheduleQueryDto, @CurrentUser() user: JwtUser) {
    return this.service.ganttSchedule(query, user)
  }

  @Put('plan-tasks/:id/reschedule') @RequirePerm('mfg:schedule:reschedule')
  reschedulePlanTask(@Param('id', ParseIntPipe) id: number, @Body() dto: ReschedulePlanTaskDto, @CurrentUser() user: JwtUser) {
    return this.service.reschedulePlanTask(id, dto, user)
  }

  @Get('changeover/rules') @RequirePerm('mfg:changeover:view')
  listChangeoverRules(@CurrentUser() user: JwtUser) {
    return this.service.listChangeoverRules(user)
  }

  @Post('changeover/rules') @RequirePerm('mfg:changeover:manage')
  createChangeoverRule(@Body() dto: CreateChangeoverRuleDto, @CurrentUser() user: JwtUser) {
    return this.service.createChangeoverRule(dto, user)
  }

  @Put('changeover/rules/:id/disable') @RequirePerm('mfg:changeover:manage')
  disableChangeoverRule(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) {
    return this.service.disableChangeoverRule(id, user)
  }

  @Get('changeover/logs') @RequirePerm('mfg:changeover:view')
  listChangeoverLogs(@Query() query: QueryChangeoverLogDto, @CurrentUser() user: JwtUser) {
    return this.service.listChangeoverLogs(query, user)
  }

  /* 超额领料与扫码领料 */
  @Get('work-orders/:id/over-issue') @RequirePerm('mfg:issue:create')
  overIssueCheck(@Param('id', ParseIntPipe) id: number, @Query('materialId', ParseIntPipe) materialId: number, @CurrentUser() user: JwtUser) {
    return this.service.overIssueCheck(id, materialId, user)
  }

  @Post('work-orders/:id/over-issue') @RequirePerm('mfg:issue:create')
  requestOverIssue(@Param('id', ParseIntPipe) id: number, @Body() body: { materialId: number; reason?: string }, @CurrentUser() user: JwtUser) {
    return this.service.requestOverIssue(id, body.materialId, body.reason ?? '', user)
  }

  @Get('over-issues') @RequirePerm('mfg:issue:create')
  listOverIssues(@Query() query: QueryManufacturingExtensionDto, @CurrentUser() user: JwtUser) { return this.service.listOverIssues(query, user) }

  @Put('over-issues/:id/approve') @RequirePerm('mfg:issue:over-approve')
  approveOverIssue(@Param('id', ParseIntPipe) id: number, @Body() dto: OverIssueApproveDto, @CurrentUser() user: JwtUser) {
    return this.service.approveOverIssue(id, dto, user)
  }

  @Post('work-orders/:id/scan-report') @RequirePerm('mfg:report:create')
  scanReport(@Param('id', ParseIntPipe) id: number, @Body() dto: ScanReportDto, @CurrentUser() user: JwtUser) {
    return this.service.scanReport(id, dto, user)
  }

  /* 在制看板与生产分析 */
  @Get('wip-board') @RequirePerm('mfg:work-order:view')
  wipBoard(@CurrentUser() user: JwtUser) { return this.service.wipBoard(user) }

  @Get('production-analysis') @RequirePerm('mfg:report:analysis')
  productionAnalysis(@Query() query: ProductionAnalysisQueryDto, @CurrentUser() user: JwtUser) { return this.service.productionAnalysis(query, user) }

  /* 质检检验项 */
  @Get('qc/:qcId/items') @RequirePerm('mfg:qc:view')
  listQcItems(@Param('qcId', ParseIntPipe) qcId: number, @CurrentUser() user: JwtUser) { return this.service.listQcItems(qcId, user) }

  @Post('qc/items') @RequirePerm('mfg:qc:create')
  createQcItems(@Body() dto: CreateQcItemDto, @CurrentUser() user: JwtUser) { return this.service.createQcItems(dto, user) }

  /* 设备故障与保养 */
  @Post('equipment/faults') @RequirePerm('mfg:equipment:fault')
  createEquipmentFault(@Body() dto: CreateEquipmentFaultDto, @CurrentUser() user: JwtUser) { return this.service.createEquipmentFault(dto, user) }

  @Get('equipment/faults') @RequirePerm('mfg:equipment:view')
  listEquipmentFaults(@Query() query: QueryManufacturingExtensionDto, @CurrentUser() user: JwtUser) { return this.service.listEquipmentFaults(query, user) }

  @Put('equipment/faults/:id/repair') @RequirePerm('mfg:equipment:fault')
  repairEquipmentFault(@Param('id', ParseIntPipe) id: number, @Body() dto: RepairEquipmentFaultDto, @CurrentUser() user: JwtUser) {
    return this.service.repairEquipmentFault(id, dto, user)
  }

  @Post('equipment/maintenances') @RequirePerm('mfg:equipment:maintenance')
  createMaintenance(@Body() dto: CreateMaintenanceDto, @CurrentUser() user: JwtUser) { return this.service.createMaintenance(dto, user) }

  @Get('equipment/maintenances') @RequirePerm('mfg:equipment:view')
  listMaintenances(@Query() query: QueryManufacturingExtensionDto, @CurrentUser() user: JwtUser) { return this.service.listMaintenances(query, user) }

  @Put('equipment/maintenances/:id/execute') @RequirePerm('mfg:equipment:maintenance')
  executeMaintenance(@Param('id', ParseIntPipe) id: number, @Body() dto: ExecuteMaintenanceDto, @CurrentUser() user: JwtUser) {
    return this.service.executeMaintenance(id, dto, user)
  }

  /* 生产异常停线 */
  @Post('exceptions/:id/stop-line') @RequirePerm('mfg:exception:create')
  recordStopLine(@Param('id', ParseIntPipe) id: number, @Body() dto: StopLineDto, @CurrentUser() user: JwtUser) {
    return this.service.recordStopLine(id, dto, user)
  }

  /* MRP 模拟运算与优先级 */
  @Post('mrp/simulate') @RequirePerm('mfg:mrp:simulate')
  simulateMrp(@Body() dto: MrpSimulateDto, @CurrentUser() user: JwtUser) { return this.service.simulateMrp(dto, user) }

  @Post('mrp/runs/:id/rank') @RequirePerm('mfg:mrp:run')
  rankMrpRun(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.rankMrpRun(id, user) }
}
