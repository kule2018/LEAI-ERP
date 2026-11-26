import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { DataScope } from '../../common/decorators/data-scope.decorator'
import { RequirePerm } from '../../common/decorators/require-perm.decorator'
import type { JwtUser } from '../../common/contracts'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DataScopeGuard } from '../../common/guards/data-scope.guard'
import { PermissionsGuard } from '../../common/guards/permissions.guard'
import { CollaborationService } from './collaboration.service'
import {
  AddSignDto, AppealPerformanceDto, ApprovalStatusDto, ApprovePunchRequestDto, ApproveSalaryDto,
  AssetActionDto, BatchActTaskDto, CreateAdminAssetDto, CreateCandidateDto, CreateChatDto, CreateDocumentDto,
  CreateEmployeeRecordDto, CreateFlowDefinitionDto, CreateInterviewDto, CreateLeaveDto, CreateMeetingDto,
  CreateMilestoneDto, CreateNoticeDto, CreateOaTaskDto, CreateOfferDto, CreateOvertimeDto, CreatePayrollDetailDto,
  CreatePerformanceDto, CreatePerformanceFeedbackDto, CreatePerformanceReviewDto, CreateProjectDto,
  CreateProjectRiskDto, CreatePunchDto, CreatePunchRequestDto, CreateRecruitDto, CreateSalaryDto,
  CreateSensitiveWordDto, CreateShiftDto, CreateTrainingDto, CreateTrainingRecordDto, CreateVehicleDto,
  CreateVehicleExpenseDto, CreateVehicleTrackDto, CreateVehicleUseDto, DispatchVehicleDto, DelegateTaskDto,
  FlowActionDto, MoveCandidateStageDto, OfferActionDto, QueryCollaborationDto, QueryReminderDto, ResolveAppealDto, CreateWorklogDto,
  ReviewPayrollDto, StartFlowDto, TalentActionDto, TrainingScoreDto, TrainingSigninDto, UpdateMilestoneDto,
  UpdateProjectRiskDto,
  CreateAssetRepairDto, CreateAssetStocktakeDto, CreateCalibrationDto, CreatePerformanceKpiDto,
  CreateShiftScheduleDto, FinishAssetRepairDto, GenerateSocialInsuranceDto, HrApprovalDto,
  SubmitStocktakeDto, UpdateVehicleUseDto, UpdateFlowDefinitionDto
} from './dto'

const guards = [AuthGuard, PermissionsGuard, DataScopeGuard]

@Controller('collab/flows')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class FlowController {
  constructor(private readonly service: CollaborationService) {}
  @Get('definitions') @RequirePerm('flow:define:view')
  definitions(@Query() query: QueryCollaborationDto, @CurrentUser() user: JwtUser) { return this.service.listDefinitions(query, user) }
  @Post('definitions') @RequirePerm('flow:define:create')
  createDefinition(@Body() dto: CreateFlowDefinitionDto, @CurrentUser() user: JwtUser) { return this.service.createDefinition(dto, user) }
  @Get('definitions/:id/nodes') @RequirePerm('flow:define:view')
  definitionNodes(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.listDefinitionNodes(id, user) }
  @Put('definitions/:id') @RequirePerm('flow:define:update')
  updateDefinition(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFlowDefinitionDto, @CurrentUser() user: JwtUser) { return this.service.updateDefinition(id, dto, user) }
  @Get('definitions/:id/versions') @RequirePerm('flow:define:view')
  definitionVersions(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.listDefinitionVersions(id, user) }
  @Get('instances') @RequirePerm('flow:monitor:view')
  instances(@Query() query: QueryCollaborationDto, @CurrentUser() user: JwtUser) { return this.service.listInstances(query, user) }
  /** 流程监控分析：耗时分析、瓶颈节点、超时排行（只读） */
  @Get('monitor/analysis') @RequirePerm('flow:monitor:view')
  monitorAnalysis(@Query() query: QueryCollaborationDto, @CurrentUser() user: JwtUser) { return this.service.monitorAnalysis(query, user) }
  /** 流程监控导出：留审计 */
  @Post('monitor/export') @RequirePerm('flow:monitor:view')
  exportMonitorAnalysis(@Body() body: QueryCollaborationDto, @CurrentUser() user: JwtUser) { return this.service.exportMonitorAnalysis(body, user) }
  @Post('start') @RequirePerm('flow:start')
  start(@Body() dto: StartFlowDto, @CurrentUser() user: JwtUser) { return this.service.startFlow(dto, user) }
  @Get('todo') @RequirePerm('flow:todo:view')
  todo(@Query() query: QueryCollaborationDto, @CurrentUser() user: JwtUser) { return this.service.listTodo(query, user) }
  @Get('done') @RequirePerm('flow:todo:view')
  done(@Query() query: QueryCollaborationDto, @CurrentUser() user: JwtUser) { return this.service.listDone(query, user) }
  @Post('tasks/:id/act') @RequirePerm('flow:todo:approve')
  act(@Param('id', ParseIntPipe) id: number, @Body() dto: FlowActionDto, @CurrentUser() user: JwtUser) { return this.service.actTask(id, dto, user) }
  @Post('tasks/batch-act') @RequirePerm('flow:todo:approve')
  batchAct(@Body() dto: BatchActTaskDto, @CurrentUser() user: JwtUser) { return this.service.batchActTasks(dto.ids, dto, user) }
  @Post('tasks/:id/delegate') @RequirePerm('flow:todo:approve')
  delegate(@Param('id', ParseIntPipe) id: number, @Body() dto: DelegateTaskDto, @CurrentUser() user: JwtUser) { return this.service.delegateTask(id, dto, user) }
  @Post('tasks/:id/add-sign') @RequirePerm('flow:todo:approve')
  addSign(@Param('id', ParseIntPipe) id: number, @Body() dto: AddSignDto, @CurrentUser() user: JwtUser) { return this.service.addSign(id, dto, user) }
  @Post('instances/:id/withdraw') @RequirePerm('flow:start')
  withdraw(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.withdrawInstance(id, user) }
  @Get('instances/:id') @RequirePerm('flow:monitor:view')
  detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.flowDetail(id, user) }
  @Post('escalate') @RequirePerm('flow:monitor:view')
  escalate(@CurrentUser() user: JwtUser) { return this.service.escalateOverdue(user) }
}

@Controller('collab')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class OaController {
  constructor(private readonly service: CollaborationService) {}
  @Get('notices') @RequirePerm('oa:notice:view')
  notices(@Query() query: QueryCollaborationDto, @CurrentUser() user: JwtUser) { return this.service.listNotices(query, user) }
  @Post('notices') @RequirePerm('oa:notice:create')
  createNotice(@Body() dto: CreateNoticeDto, @CurrentUser() user: JwtUser) { return this.service.createNotice(dto, user) }
  @Get('chats') @RequirePerm('oa:chat:view')
  chats(@Query() query: QueryCollaborationDto, @CurrentUser() user: JwtUser) { return this.service.listChats(query, user) }
  @Post('chats') @RequirePerm('oa:chat:create')
  createChat(@Body() dto: CreateChatDto, @CurrentUser() user: JwtUser) { return this.service.createChat(dto, user) }
  @Post('chats/:id/read') @RequirePerm('oa:chat:view')
  markChatRead(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.markChatRead(id, user) }
  @Get('chats/unread-count') @RequirePerm('oa:chat:view')
  unreadChatCount(@CurrentUser() user: JwtUser) { return this.service.unreadChatCount(user) }
  @Get('sensitive-words') @RequirePerm('oa:notice:view')
  sensitiveWords(@CurrentUser() user: JwtUser) { return this.service.listSensitiveWords(user) }
  @Post('sensitive-words') @RequirePerm('oa:notice:create')
  createSensitiveWord(@Body() dto: CreateSensitiveWordDto, @CurrentUser() user: JwtUser) { return this.service.createSensitiveWord(dto, user) }
  @Delete('sensitive-words/:id') @RequirePerm('oa:notice:create')
  removeSensitiveWord(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.removeSensitiveWord(id, user) }
  @Post('notices/:id/confirm') @RequirePerm('oa:notice:view')
  confirmNotice(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.confirmNotice(id, user) }
  @Get('notices/:id/confirm-stat') @RequirePerm('oa:notice:view')
  noticeConfirmStat(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.noticeConfirmStat(id, user) }
  @Get('meetings') @RequirePerm('oa:project:view')
  meetings(@Query() query: QueryCollaborationDto, @CurrentUser() user: JwtUser) { return this.service.listMeetings(query, user) }
  @Post('meetings') @RequirePerm('oa:project:create')
  createMeeting(@Body() dto: CreateMeetingDto, @CurrentUser() user: JwtUser) { return this.service.createMeeting(dto, user) }
  @Get('projects') @RequirePerm('oa:project:view')
  projects(@Query() query: QueryCollaborationDto, @CurrentUser() user: JwtUser) { return this.service.listProjects(query, user) }
  @Post('projects') @RequirePerm('oa:project:create')
  createProject(@Body() dto: CreateProjectDto, @CurrentUser() user: JwtUser) { return this.service.createProject(dto, user) }
  @Get('tasks') @RequirePerm('oa:task:view')
  tasks(@Query() query: QueryCollaborationDto, @CurrentUser() user: JwtUser) { return this.service.listOaTasks(query, user) }
  @Post('tasks') @RequirePerm('oa:task:create')
  createTask(@Body() dto: CreateOaTaskDto, @CurrentUser() user: JwtUser) { return this.service.createOaTask(dto, user) }
  @Get('documents') @RequirePerm('oa:document:view')
  documents(@Query() query: QueryCollaborationDto, @CurrentUser() user: JwtUser) { return this.service.listDocuments(query, user) }
  @Post('documents') @RequirePerm('oa:document:create')
  createDocument(@Body() dto: CreateDocumentDto, @CurrentUser() user: JwtUser) { return this.service.createDocument(dto, user) }
  @Get('projects/:id/board') @RequirePerm('oa:project:view')
  projectBoard(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.projectBoard(id, user) }
  @Get('projects/:id/gantt') @RequirePerm('oa:project:view')
  projectGantt(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.projectGantt(id, user) }
  @Get('milestones') @RequirePerm('oa:project:view')
  milestones(@Query() query: QueryCollaborationDto, @CurrentUser() user: JwtUser) { return this.service.listMilestones(query, user) }
  @Post('milestones') @RequirePerm('oa:project:create')
  createMilestone(@Body() dto: CreateMilestoneDto, @CurrentUser() user: JwtUser) { return this.service.createMilestone(dto, user) }
  @Patch('milestones/:id') @RequirePerm('oa:project:create')
  updateMilestone(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMilestoneDto, @CurrentUser() user: JwtUser) { return this.service.updateMilestone(id, dto, user) }
  @Get('worklogs') @RequirePerm('oa:task:view')
  worklogs(@Query() query: QueryCollaborationDto, @CurrentUser() user: JwtUser) { return this.service.listWorklogs(query, user) }
  @Post('worklogs') @RequirePerm('oa:task:create')
  createWorklog(@Body() dto: CreateWorklogDto, @CurrentUser() user: JwtUser) { return this.service.createWorklog(dto, user) }
  @Delete('worklogs/:id') @RequirePerm('oa:task:create')
  removeWorklog(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtUser) { return this.service.removeWorklog(id, user) }
  @Get('project-risks') @RequirePerm('oa:project:view')
  projectRisks(@Query() query: QueryCollaborationDto, @CurrentUser() user: JwtUser) { return this.service.listProjectRisks(query, user) }
  @Post('project-risks') @RequirePerm('oa:project:create')
  createProjectRisk(@Body() dto: CreateProjectRiskDto, @CurrentUser() user: JwtUser) { return this.service.createProjectRisk(dto, user) }
  @Patch('project-risks/:id') @RequirePerm('oa:project:create')
  updateProjectRisk(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProjectRiskDto, @CurrentUser() user: JwtUser) { return this.service.updateProjectRisk(id, dto, user) }
  @Get('reminders') @RequirePerm('oa:task:view')
  reminders(@Query() query: QueryReminderDto, @CurrentUser() user: JwtUser) { return this.service.collectReminders(query, user) }
}

@Controller('hr')
@UseGuards(...guards)
@DataScope({ org: 'dept', level: 'ORG' })
export class HrController {
  constructor(private readonly service: CollaborationService) {}
  @Get('recruits') @RequirePerm('hr:recruit:view') recruits(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.listRecruits(q, u) }
  @Post('recruits') @RequirePerm('hr:recruit:create') createRecruit(@Body() dto: CreateRecruitDto, @CurrentUser() u: JwtUser) { return this.service.createRecruit(dto, u) }
  @Get('candidates') @RequirePerm('hr:recruit:view') candidates(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.listCandidates(q, u) }
  @Post('candidates') @RequirePerm('hr:recruit:create') createCandidate(@Body() dto: CreateCandidateDto, @CurrentUser() u: JwtUser) { return this.service.createCandidate(dto, u) }
  @Get('interviews') @RequirePerm('hr:recruit:view') interviews(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.listInterviews(q, u) }
  @Post('interviews') @RequirePerm('hr:recruit:create') createInterview(@Body() dto: CreateInterviewDto, @CurrentUser() u: JwtUser) { return this.service.createInterview(dto, u) }
  @Get('shifts') @RequirePerm('hr:attendance:view') shifts(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.listShifts(q, u) }
  @Post('shifts') @RequirePerm('hr:attendance:create') createShift(@Body() dto: CreateShiftDto, @CurrentUser() u: JwtUser) { return this.service.createShift(dto, u) }
  @Get('punches') @RequirePerm('hr:attendance:view') punches(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.listPunches(q, u) }
  @Post('punches') @RequirePerm('hr:attendance:create') createPunch(@Body() dto: CreatePunchDto, @CurrentUser() u: JwtUser) { return this.service.createPunch(dto, u) }
  @Get('leaves') @RequirePerm('hr:attendance:view') leaves(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.listLeaves(q, u) }
  @Post('leaves') @RequirePerm('hr:attendance:create') createLeave(@Body() dto: CreateLeaveDto, @CurrentUser() u: JwtUser) { return this.service.createLeave(dto, u) }
  @Get('overtimes') @RequirePerm('hr:attendance:view') overtimes(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.listOvertimes(q, u) }
  @Post('overtimes') @RequirePerm('hr:attendance:create') createOvertime(@Body() dto: CreateOvertimeDto, @CurrentUser() u: JwtUser) { return this.service.createOvertime(dto, u) }
  @Get('salaries') @RequirePerm('hr:payroll:view') salaries(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.listSalaries(q, u) }
  @Post('salaries') @RequirePerm('hr:payroll:create') createSalary(@Body() dto: CreateSalaryDto, @CurrentUser() u: JwtUser) { return this.service.createSalary(dto, u) }
  @Post('salaries/:id/approve') @RequirePerm('hr:payroll:approve')
  approveSalary(@Param('id', ParseIntPipe) id: number, @Body() dto: ApproveSalaryDto, @CurrentUser() u: JwtUser) { return this.service.approveSalary(id, dto, u) }
  @Get('punch-requests') @RequirePerm('hr:attendance:view') punchRequests(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.listPunchRequests(q, u) }
  @Post('punch-requests') @RequirePerm('hr:attendance:create') createPunchRequest(@Body() dto: CreatePunchRequestDto, @CurrentUser() u: JwtUser) { return this.service.createPunchRequest(dto, u) }
  @Post('punch-requests/:id/approve') @RequirePerm('hr:attendance:approve')
  approvePunchRequest(@Param('id', ParseIntPipe) id: number, @Body() dto: ApprovePunchRequestDto, @CurrentUser() u: JwtUser) { return this.service.approvePunchRequest(id, dto, u) }
  @Post('performance-reviews/:id/appeal-resolve') @RequirePerm('hr:performance:approve')
  resolveAppeal(@Param('id', ParseIntPipe) id: number, @Body() dto: ResolveAppealDto, @CurrentUser() u: JwtUser) { return this.service.resolvePerformanceAppeal(id, dto, u) }
  @Get('training-certificates/expiring') @RequirePerm('hr:training:view')
  expiringCertificates(@Query('days') days: string, @CurrentUser() u: JwtUser) { return this.service.listExpiringCertificates(days ? Number(days) : 30, u) }
  @Get('vehicle-expenses') @RequirePerm('hr:fleet:view') vehicleExpenses(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.listVehicleExpenses(q, u) }
  @Post('vehicle-expenses') @RequirePerm('hr:fleet:create') createVehicleExpense(@Body() dto: CreateVehicleExpenseDto, @CurrentUser() u: JwtUser) { return this.service.createVehicleExpense(dto, u) }
  @Get('vehicle-tracks') @RequirePerm('hr:fleet:view') vehicleTracks(@Query('vehicleId', ParseIntPipe) vehicleId: number, @CurrentUser() u: JwtUser) { return this.service.listVehicleTracks(vehicleId, u) }
  @Post('vehicle-tracks') @RequirePerm('hr:fleet:create') createVehicleTrack(@Body() dto: CreateVehicleTrackDto, @CurrentUser() u: JwtUser) { return this.service.createVehicleTrack(dto, u) }
  @Get('performances') @RequirePerm('hr:performance:view') performances(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.listPerformances(q, u) }
  @Post('performances') @RequirePerm('hr:performance:create') createPerformance(@Body() dto: CreatePerformanceDto, @CurrentUser() u: JwtUser) { return this.service.createPerformance(dto, u) }
  @Get('trainings') @RequirePerm('hr:training:view') trainings(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.listTrainings(q, u) }
  @Post('trainings') @RequirePerm('hr:training:create') createTraining(@Body() dto: CreateTrainingDto, @CurrentUser() u: JwtUser) { return this.service.createTraining(dto, u) }
  @Get('admin-assets') @RequirePerm('hr:admin-asset:view') adminAssets(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.listAdminAssets(q, u) }
  @Post('admin-assets') @RequirePerm('hr:admin-asset:create') createAdminAsset(@Body() dto: CreateAdminAssetDto, @CurrentUser() u: JwtUser) { return this.service.createAdminAsset(dto, u) }
  @Get('vehicles') @RequirePerm('hr:fleet:view') vehicles(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.listVehicles(q, u) }
  @Post('vehicles') @RequirePerm('hr:fleet:create') createVehicle(@Body() dto: CreateVehicleDto, @CurrentUser() u: JwtUser) { return this.service.createVehicle(dto, u) }
  @Get('vehicle-uses') @RequirePerm('hr:fleet:view') vehicleUses(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.listVehicleUses(q, u) }
  @Post('vehicle-uses') @RequirePerm('hr:fleet:create') createVehicleUse(@Body() dto: CreateVehicleUseDto, @CurrentUser() u: JwtUser) { return this.service.createVehicleUse(dto, u) }
  @Get('employee-records') @RequirePerm('hr:extension:view') employeeRecords(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.listEmployeeRecords(q, u) }
  @Post('employee-records') @RequirePerm('hr:extension:update') createEmployeeRecord(@Body() dto: CreateEmployeeRecordDto, @CurrentUser() u: JwtUser) { return this.service.createEmployeeRecord(dto, u) }
  @Post('employee-records/:id/approve') @RequirePerm('hr:extension:update') approveEmployeeRecord(@Param('id', ParseIntPipe) id: number, @Body() dto: ApprovalStatusDto, @CurrentUser() u: JwtUser) { return this.service.approveEmployeeRecord(id, dto, u) }
  @Post('offers') @RequirePerm('hr:extension:update') createOffer(@Body() dto: CreateOfferDto, @CurrentUser() u: JwtUser) { return this.service.createOffer(dto, u) }
  @Get('offers') @RequirePerm('hr:recruit:view') offers(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.listOffers(q, u) }
  @Post('payroll-details') @RequirePerm('hr:extension:update') createPayrollDetail(@Body() dto: CreatePayrollDetailDto, @CurrentUser() u: JwtUser) { return this.service.createPayrollDetail(dto, u) }
  @Post('payroll-details/:id/review') @RequirePerm('hr:extension:update') reviewPayroll(@Param('id', ParseIntPipe) id: number, @Body() dto: ReviewPayrollDto, @CurrentUser() u: JwtUser) { return this.service.reviewPayroll(id, dto, u) }
  @Post('performance-reviews') @RequirePerm('hr:extension:update') createPerformanceReview(@Body() dto: CreatePerformanceReviewDto, @CurrentUser() u: JwtUser) { return this.service.createPerformanceReview(dto, u) }
  @Post('performance-reviews/:id/appeal') @RequirePerm('hr:extension:update') appealPerformance(@Param('id', ParseIntPipe) id: number, @Body() dto: AppealPerformanceDto, @CurrentUser() u: JwtUser) { return this.service.appealPerformance(id, dto, u) }
  @Post('training-records') @RequirePerm('hr:extension:update') createTrainingRecord(@Body() dto: CreateTrainingRecordDto, @CurrentUser() u: JwtUser) { return this.service.createTrainingRecord(dto, u) }
  @Post('asset-actions') @RequirePerm('hr:extension:update') assetAction(@Body() dto: AssetActionDto, @CurrentUser() u: JwtUser) { return this.service.assetAction(dto, u) }
  @Post('vehicle-uses/checked') @RequirePerm('hr:extension:update') createVehicleUseChecked(@Body() dto: CreateVehicleUseDto, @CurrentUser() u: JwtUser) { return this.service.createVehicleUseChecked(dto, u) }
  @Get('recruit/pipeline') @RequirePerm('hr:recruit:view') recruitPipeline(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.recruitPipeline(q, u) }
  @Post('candidates/:id/stage') @RequirePerm('hr:recruit:create') moveCandidateStage(@Param('id', ParseIntPipe) id: number, @Body() dto: MoveCandidateStageDto, @CurrentUser() u: JwtUser) { return this.service.moveCandidateStage(id, dto, u) }
  @Post('candidates/:id/talent') @RequirePerm('hr:recruit:create') talentAction(@Param('id', ParseIntPipe) id: number, @Body() dto: TalentActionDto, @CurrentUser() u: JwtUser) { return this.service.talentAction(id, dto, u) }
  @Post('offers/:id/approve') @RequirePerm('hr:recruit:approve') approveOffer(@Param('id', ParseIntPipe) id: number, @Body() dto: OfferActionDto, @CurrentUser() u: JwtUser) { return this.service.actOffer(id, { ...dto, action: 'APPROVE' }, u) }
  @Post('offers/:id/reject') @RequirePerm('hr:recruit:approve') rejectOffer(@Param('id', ParseIntPipe) id: number, @Body() dto: OfferActionDto, @CurrentUser() u: JwtUser) { return this.service.actOffer(id, { ...dto, action: 'REJECT' }, u) }
  @Post('vehicles/dispatch') @RequirePerm('hr:fleet:dispatch') dispatchVehicle(@Body() dto: DispatchVehicleDto, @CurrentUser() u: JwtUser) { return this.service.dispatchVehicle(dto, u) }
  @Get('performance-reviews/:id/feedbacks') @RequirePerm('hr:performance:view') performanceFeedbacks(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtUser) { return this.service.listPerformanceFeedbacks(id, u) }
  @Post('performance-reviews/:id/feedbacks') @RequirePerm('hr:performance:create') createPerformanceFeedback(@Param('id', ParseIntPipe) id: number, @Body() dto: CreatePerformanceFeedbackDto, @CurrentUser() u: JwtUser) { return this.service.createPerformanceFeedback(id, dto, u) }
  @Post('trainings/:id/signin') @RequirePerm('hr:training:create') signinTraining(@Param('id', ParseIntPipe) id: number, @Body() dto: TrainingSigninDto, @CurrentUser() u: JwtUser) { return this.service.signinTraining(id, dto, u) }
  @Post('trainings/:id/score') @RequirePerm('hr:training:create') scoreTraining(@Param('id', ParseIntPipe) id: number, @Body() dto: TrainingScoreDto, @CurrentUser() u: JwtUser) { return this.service.scoreTraining(id, dto, u) }
  @Get('shift-schedules') @RequirePerm('hr:attendance:view') shiftSchedules(@Query() q: QueryCollaborationDto, @Query('employeeId') employeeId: string, @CurrentUser() u: JwtUser) { return this.service.listShiftSchedules(q, u, employeeId ? Number(employeeId) : undefined) }
  @Post('shift-schedules') @RequirePerm('hr:attendance:create') createShiftSchedule(@Body() dto: CreateShiftScheduleDto, @CurrentUser() u: JwtUser) { return this.service.createShiftSchedule(dto, u) }
  @Post('leaves/:id/approve') @RequirePerm('hr:attendance:approve') approveLeave(@Param('id', ParseIntPipe) id: number, @Body() dto: HrApprovalDto, @CurrentUser() u: JwtUser) { return this.service.approveLeave(id, dto, u) }
  @Post('overtimes/:id/approve') @RequirePerm('hr:attendance:approve') approveOvertime(@Param('id', ParseIntPipe) id: number, @Body() dto: HrApprovalDto, @CurrentUser() u: JwtUser) { return this.service.approveOvertime(id, dto, u) }
  @Get('payslips') @RequirePerm('hr:payroll:view') payslips(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.listPayslips(q, u) }
  @Get('social-insurances') @RequirePerm('hr:payroll:view') socialInsurances(@Query('salaryId') salaryId: string, @CurrentUser() u: JwtUser) { return this.service.listSocialInsurance(u, salaryId ? Number(salaryId) : undefined) }
  @Post('social-insurances') @RequirePerm('hr:payroll:create') generateSocialInsurance(@Body() dto: GenerateSocialInsuranceDto, @CurrentUser() u: JwtUser) { return this.service.generateSocialInsurance(dto, u) }
  @Get('performance-kpis') @RequirePerm('hr:performance:view') performanceKpis(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.listPerformanceKpis(q, u) }
  @Post('performance-kpis') @RequirePerm('hr:performance:create') createPerformanceKpi(@Body() dto: CreatePerformanceKpiDto, @CurrentUser() u: JwtUser) { return this.service.createPerformanceKpi(dto, u) }
  @Get('performance-calibrations') @RequirePerm('hr:performance:view') performanceCalibrations(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.listCalibrations(q, u) }
  @Post('performance-calibrations') @RequirePerm('hr:performance:approve') createCalibration(@Body() dto: CreateCalibrationDto, @CurrentUser() u: JwtUser) { return this.service.createCalibration(dto, u) }
  @Post('performance-reviews/:id/recalculate') @RequirePerm('hr:performance:approve') recalculatePerformance(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: JwtUser) { return this.service.recalculatePerformance(id, u) }
  @Get('asset-stocktakes') @RequirePerm('hr:admin-asset:view') assetStocktakes(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.listStocktakes(q, u) }
  @Post('asset-stocktakes') @RequirePerm('hr:admin-asset:create') createStocktake(@Body() dto: CreateAssetStocktakeDto, @CurrentUser() u: JwtUser) { return this.service.createStocktake(dto, u) }
  @Post('asset-stocktakes/:id/submit') @RequirePerm('hr:extension:update') submitStocktake(@Param('id', ParseIntPipe) id: number, @Body() dto: SubmitStocktakeDto, @CurrentUser() u: JwtUser) { return this.service.submitStocktake(id, dto, u) }
  @Get('asset-repairs') @RequirePerm('hr:admin-asset:view') assetRepairs(@Query() q: QueryCollaborationDto, @CurrentUser() u: JwtUser) { return this.service.listAssetRepairs(q, u) }
  @Post('asset-repairs') @RequirePerm('hr:admin-asset:create') createAssetRepair(@Body() dto: CreateAssetRepairDto, @CurrentUser() u: JwtUser) { return this.service.createAssetRepair(dto, u) }
  @Post('asset-repairs/:id/finish') @RequirePerm('hr:extension:update') finishAssetRepair(@Param('id', ParseIntPipe) id: number, @Body() dto: FinishAssetRepairDto, @CurrentUser() u: JwtUser) { return this.service.finishAssetRepair(id, dto, u) }
  @Post('vehicle-uses/:id/approve') @RequirePerm('hr:fleet:dispatch') approveVehicleUse(@Param('id', ParseIntPipe) id: number, @Body() dto: HrApprovalDto, @CurrentUser() u: JwtUser) { return this.service.approveVehicleUse(id, dto, u) }
  @Patch('vehicle-uses/:id') @RequirePerm('hr:fleet:update') updateVehicleUse(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVehicleUseDto, @CurrentUser() u: JwtUser) { return this.service.updateVehicleUse(id, dto, u) }
  @Post('vehicle-expenses/:id/approve') @RequirePerm('hr:fleet:dispatch') approveVehicleExpense(@Param('id', ParseIntPipe) id: number, @Body() dto: HrApprovalDto, @CurrentUser() u: JwtUser) { return this.service.approveVehicleExpense(id, dto, u) }
  @Get('vehicle-fuel-stats') @RequirePerm('hr:fleet:view') vehicleFuelStats(@CurrentUser() u: JwtUser) { return this.service.vehicleFuelStats(u) }
}
