import { randomBytes } from 'node:crypto'
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, LessThan, Like, type FindOptionsWhere, Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { assertRejectReason } from '../../common/approval-guard'
import {
  APPROVAL_MODE, TASK_DECISION, buildFlowSnapshot, canActOnTask, computeDueAt, evaluateNodeDecision, isOverdue,
  type ApprovalDecision
} from '../../common/approval'
import { evaluateCondition } from '../../common/condition-engine'
import { sortTodos } from '../../common/business-extension-engine'
import {
  assetTransition, calculatePayroll, calibratePerformance, contractExpiryWarning,
  offerApproval, trainingCertification
} from '../../common/hr-extension-engine'
import {
  evaluateCertificateExpiry, evaluatePerformanceAppeal, evaluatePunchRequest, evaluateSalaryApproval,
  filterSensitiveWords, maskSalaryAmount, parseMeetingTasks
} from '../../common/collaboration-ops-engine'
import {
  assetStocktakeDiff, calibrationDistribution, detectVehicleConflict, evaluateAssetIssueReturn, evaluateHrApproval,
  leaveDurationDays, performanceCompositeScore, socialInsuranceBreakdown, vehicleFuelConsumption
} from '../../common/hr-approval-engine'
import {
  buildGantt, buildKanban, collectReminders as collectReminderItems, evaluateCandidateStage,
  evaluateInterviewFeedback, evaluateMilestoneStatus, evaluateOfferTransition, evaluateTalentAction,
  evaluateWorklog, selectVehicleDispatch
} from '../../common/project-ops-engine'
import {
  analyzeFlowBottlenecks, analyzeFlowDuration, analyzeFlowTimeouts,
  type FlowTimeoutRow
} from '../../common/flow-monitor-engine'
import { AuditService } from '../audit/audit.service'
import { SchedulerService } from '../ops/scheduler.service'
import { NotifyService } from '../notify/notify.service'
import { TenantEntity } from '../platform/entities/tenant.entity'
import { FlowBizCallbackRegistry } from './flow-biz-callback'
import {
  AddSignDto, AppealPerformanceDto, ApprovalStatusDto, ApprovePunchRequestDto, ApproveSalaryDto,
  AssetActionDto, CreateAdminAssetDto, CreateCandidateDto, CreateChatDto, CreateDocumentDto,
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
import {
  AdminAssetEntity, CandidateEntity, ChatMessageEntity, DocumentEntity, FlowDefinitionEntity,
  FlowDefinitionVersionEntity, FlowInstanceEntity, FlowNodeEntity, FlowTaskEntity, FlowTaskLogEntity, HrAssetRepairEntity,
  HrAssetStocktakeEntity, HrAssetStocktakeItemEntity, HrAssetTransactionEntity,
  HrEmployeeRecordEntity, HrOfferEntity, HrPayrollDetailEntity, HrPerformanceCalibrationEntity,
  HrPerformanceFeedbackEntity, HrPerformanceKpiEntity, HrPerformanceReviewEntity, HrShiftScheduleEntity,
  HrSocialInsuranceEntity, HrTrainingRecordEntity, InterviewEntity, LeaveEntity, MeetingEntity, NoticeConfirmEntity,
  NoticeEntity, OaTaskEntity, OvertimeEntity, PerformanceEntity, ProjectEntity, ProjectMilestoneEntity,
  ProjectRiskEntity, PunchEntity, PunchRequestEntity, RecruitDemandEntity, SalaryEntity, SensitiveWordEntity,
  ShiftEntity, TaskWorklogEntity, TrainingEntity, VehicleEntity, VehicleExpenseEntity, VehicleTrackEntity,
  VehicleUseEntity
} from './entities/collaboration.entities'

@Injectable()
export class CollaborationService {
  constructor(
    @InjectRepository(FlowDefinitionEntity) private readonly definitionRepo: Repository<FlowDefinitionEntity>,
    @InjectRepository(FlowDefinitionVersionEntity) private readonly versionRepo: Repository<FlowDefinitionVersionEntity>,
    @InjectRepository(FlowNodeEntity) private readonly nodeRepo: Repository<FlowNodeEntity>,
    @InjectRepository(FlowInstanceEntity) private readonly instanceRepo: Repository<FlowInstanceEntity>,
    @InjectRepository(FlowTaskEntity) private readonly taskRepo: Repository<FlowTaskEntity>,
    @InjectRepository(FlowTaskLogEntity) private readonly taskLogRepo: Repository<FlowTaskLogEntity>,
    @InjectRepository(NoticeEntity) private readonly noticeRepo: Repository<NoticeEntity>,
    @InjectRepository(ChatMessageEntity) private readonly chatRepo: Repository<ChatMessageEntity>,
    @InjectRepository(ProjectEntity) private readonly projectRepo: Repository<ProjectEntity>,
    @InjectRepository(OaTaskEntity) private readonly oaTaskRepo: Repository<OaTaskEntity>,
    @InjectRepository(DocumentEntity) private readonly documentRepo: Repository<DocumentEntity>,
    @InjectRepository(RecruitDemandEntity) private readonly recruitRepo: Repository<RecruitDemandEntity>,
    @InjectRepository(CandidateEntity) private readonly candidateRepo: Repository<CandidateEntity>,
    @InjectRepository(InterviewEntity) private readonly interviewRepo: Repository<InterviewEntity>,
    @InjectRepository(ShiftEntity) private readonly shiftRepo: Repository<ShiftEntity>,
    @InjectRepository(PunchEntity) private readonly punchRepo: Repository<PunchEntity>,
    @InjectRepository(LeaveEntity) private readonly leaveRepo: Repository<LeaveEntity>,
    @InjectRepository(OvertimeEntity) private readonly overtimeRepo: Repository<OvertimeEntity>,
    @InjectRepository(SalaryEntity) private readonly salaryRepo: Repository<SalaryEntity>,
    @InjectRepository(PerformanceEntity) private readonly performanceRepo: Repository<PerformanceEntity>,
    @InjectRepository(TrainingEntity) private readonly trainingRepo: Repository<TrainingEntity>,
    @InjectRepository(AdminAssetEntity) private readonly adminAssetRepo: Repository<AdminAssetEntity>,
    @InjectRepository(VehicleEntity) private readonly vehicleRepo: Repository<VehicleEntity>,
    @InjectRepository(VehicleUseEntity) private readonly vehicleUseRepo: Repository<VehicleUseEntity>,
    @InjectRepository(HrEmployeeRecordEntity) private readonly employeeRecordRepo: Repository<HrEmployeeRecordEntity>,
    @InjectRepository(HrOfferEntity) private readonly offerRepo: Repository<HrOfferEntity>,
    @InjectRepository(HrPayrollDetailEntity) private readonly payrollDetailRepo: Repository<HrPayrollDetailEntity>,
    @InjectRepository(HrPerformanceReviewEntity) private readonly performanceReviewRepo: Repository<HrPerformanceReviewEntity>,
    @InjectRepository(HrTrainingRecordEntity) private readonly trainingRecordRepo: Repository<HrTrainingRecordEntity>,
    @InjectRepository(HrAssetTransactionEntity) private readonly assetTransactionRepo: Repository<HrAssetTransactionEntity>,
    @InjectRepository(SensitiveWordEntity) private readonly sensitiveWordRepo: Repository<SensitiveWordEntity>,
    @InjectRepository(NoticeConfirmEntity) private readonly noticeConfirmRepo: Repository<NoticeConfirmEntity>,
    @InjectRepository(MeetingEntity) private readonly meetingRepo: Repository<MeetingEntity>,
    @InjectRepository(PunchRequestEntity) private readonly punchRequestRepo: Repository<PunchRequestEntity>,
    @InjectRepository(VehicleExpenseEntity) private readonly vehicleExpenseRepo: Repository<VehicleExpenseEntity>,
    @InjectRepository(VehicleTrackEntity) private readonly vehicleTrackRepo: Repository<VehicleTrackEntity>,
    @InjectRepository(ProjectMilestoneEntity) private readonly milestoneRepo: Repository<ProjectMilestoneEntity>,
    @InjectRepository(TaskWorklogEntity) private readonly worklogRepo: Repository<TaskWorklogEntity>,
    @InjectRepository(ProjectRiskEntity) private readonly riskRepo: Repository<ProjectRiskEntity>,
    @InjectRepository(HrPerformanceFeedbackEntity) private readonly performanceFeedbackRepo: Repository<HrPerformanceFeedbackEntity>,
    @InjectRepository(HrShiftScheduleEntity) private readonly shiftScheduleRepo: Repository<HrShiftScheduleEntity>,
    @InjectRepository(HrSocialInsuranceEntity) private readonly socialInsuranceRepo: Repository<HrSocialInsuranceEntity>,
    @InjectRepository(HrAssetStocktakeEntity) private readonly stocktakeRepo: Repository<HrAssetStocktakeEntity>,
    @InjectRepository(HrAssetStocktakeItemEntity) private readonly stocktakeItemRepo: Repository<HrAssetStocktakeItemEntity>,
    @InjectRepository(HrAssetRepairEntity) private readonly assetRepairRepo: Repository<HrAssetRepairEntity>,
    @InjectRepository(HrPerformanceKpiEntity) private readonly performanceKpiRepo: Repository<HrPerformanceKpiEntity>,
    @InjectRepository(HrPerformanceCalibrationEntity) private readonly calibrationRepo: Repository<HrPerformanceCalibrationEntity>,
    @InjectRepository(TenantEntity) private readonly tenantRepo: Repository<TenantEntity>,
    private readonly scheduler: SchedulerService,
    private readonly notifyService: NotifyService,
    private readonly auditService: AuditService,
    private readonly bizCallbackRegistry: FlowBizCallbackRegistry
  ) {}

  async listDefinitions(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<FlowDefinitionEntity>> {
    const [list, total] = await this.definitionRepo.findAndCount({ where: { tenantId: user.tenantId, isDeleted: 0 }, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createDefinition(dto: CreateFlowDefinitionDto, user: JwtUser): Promise<FlowDefinitionEntity> {
    const existing = await this.definitionRepo.findOne({ where: { tenantId: user.tenantId, code: dto.code, isDeleted: 0 } })
    if (existing) throw new BadRequestException('流程编码已存在')
    const definition = await this.definitionRepo.save(this.definitionRepo.create({
      tenantId: user.tenantId,
      code: dto.code,
      flowName: dto.flowName,
      bizType: dto.bizType,
      schema: { nodeCount: dto.nodes.length },
      formSchema: { fields: [] },
      createdBy: user.userId
    }))
    for (const node of dto.nodes) {
      await this.nodeRepo.save(this.nodeRepo.create({
        ...node,
        tenantId: user.tenantId,
        definitionId: definition.id,
        nodeType: node.nodeType ?? 'APPROVAL',
        assigneeRule: node.assigneeRule ?? null,
        conditionExpr: node.conditionExpr ?? null,
        approvalMode: node.approvalMode ?? APPROVAL_MODE.SEQUENTIAL,
        timeoutHours: node.timeoutHours ?? null,
        sortNo: node.sortNo ?? 0
      }))
    }
    await this.writeDefinitionVersion(definition, user, '创建流程定义')
    await this.auditService.record({ bizType: 'flow_definition', bizId: definition.id, action: 'CREATE_DEFINITION', afterValue: definition }, user)
    return definition
  }

  /** 流程定义节点列表 */
  async listDefinitionNodes(definitionId: number, user: JwtUser): Promise<FlowNodeEntity[]> {
    await this.assertDefinition(definitionId, user)
    return this.nodeRepo.find({ where: { tenantId: user.tenantId, definitionId }, order: { sortNo: 'ASC', id: 'ASC' } })
  }

  /** 更新流程定义：节点全量替换、表单设计调整、版本递增并留快照 */
  async updateDefinition(id: number, dto: UpdateFlowDefinitionDto, user: JwtUser): Promise<FlowDefinitionEntity> {
    const definition = await this.assertDefinition(id, user)
    if (dto.flowName) definition.flowName = dto.flowName
    if (dto.bizType) definition.bizType = dto.bizType
    if (dto.formSchema) definition.formSchema = dto.formSchema as unknown as Record<string, unknown>

    if (dto.nodes) {
      await this.nodeRepo.delete({ tenantId: user.tenantId, definitionId: id })
      for (const node of dto.nodes) {
        await this.nodeRepo.save(this.nodeRepo.create({
          ...node,
          tenantId: user.tenantId,
          definitionId: id,
          nodeType: node.nodeType ?? 'APPROVAL',
          assigneeRule: node.assigneeRule ?? null,
          conditionExpr: node.conditionExpr ?? null,
          approvalMode: node.approvalMode ?? APPROVAL_MODE.SEQUENTIAL,
          timeoutHours: node.timeoutHours ?? null,
          sortNo: node.sortNo ?? 0
        }))
      }
      definition.schema = { nodeCount: dto.nodes.length }
    }
    definition.version += 1
    await this.definitionRepo.save(definition)
    await this.writeDefinitionVersion(definition, user, dto.remark ?? '更新流程定义')
    await this.auditService.record({ bizType: 'flow_definition', bizId: definition.id, action: 'UPDATE_DEFINITION', afterValue: { version: definition.version, remark: dto.remark ?? null } }, user)
    return definition
  }

  /** 流程定义版本时间线 */
  async listDefinitionVersions(definitionId: number, user: JwtUser): Promise<FlowDefinitionVersionEntity[]> {
    await this.assertDefinition(definitionId, user)
    return this.versionRepo.find({ where: { tenantId: user.tenantId, definitionId }, order: { version: 'DESC' } })
  }

  private async assertDefinition(id: number, user: JwtUser): Promise<FlowDefinitionEntity> {
    const definition = await this.definitionRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!definition) throw new NotFoundException('流程定义不存在')
    return definition
  }

  /** 写入流程定义版本快照 */
  private async writeDefinitionVersion(definition: FlowDefinitionEntity, user: JwtUser, remark: string): Promise<void> {
    const nodes = await this.nodeRepo.find({ where: { tenantId: user.tenantId, definitionId: definition.id }, order: { sortNo: 'ASC' } })
    await this.versionRepo.save(this.versionRepo.create({
      tenantId: user.tenantId,
      definitionId: definition.id,
      version: definition.version,
      formSchema: definition.formSchema,
      nodes: nodes.map((node) => ({
        nodeCode: node.nodeCode,
        nodeName: node.nodeName,
        nodeType: node.nodeType,
        assigneeRule: node.assigneeRule,
        conditionExpr: node.conditionExpr,
        approvalMode: node.approvalMode,
        timeoutHours: node.timeoutHours,
        sortNo: node.sortNo
      })),
      remark,
      changedBy: user.userId
    }))
  }

  /** 是否存在指定业务类型的启用流程定义（供业务模块决定是否走审批流） */
  async hasActiveDefinition(bizType: string, tenantId: number): Promise<boolean> {
    const count = await this.definitionRepo.count({ where: { tenantId, bizType, isActive: 1, isDeleted: 0 } })
    return count > 0
  }

  /** 按业务单据查询最新的流程实例（供业务模块校验审批状态） */
  async findInstanceByBiz(bizType: string, bizId: number, tenantId: number): Promise<FlowInstanceEntity | null> {
    return this.instanceRepo.findOne({
      where: { tenantId, bizType, bizId },
      order: { id: 'DESC' }
    })
  }

  /**
   * 从实例快照还原节点顺序：快照固化了发起时的节点 ID 与顺序，
   * 后续流程定义变更（增删节点/改顺序）不影响进行中的实例。
   */
  private async nodesFromSnapshot(instance: FlowInstanceEntity, user: JwtUser): Promise<FlowNodeEntity[]> {
    const allNodes = await this.nodeRepo.find({ where: { tenantId: user.tenantId, definitionId: instance.definitionId } })
    const snapshotNodes = (instance.snapshot?.nodes ?? []) as Array<{ id: number; sortNo: number }>
    if (snapshotNodes.length === 0) {
      return allNodes.sort((a, b) => a.sortNo - b.sortNo || a.id - b.id)
    }
    const order = new Map(snapshotNodes.map((n) => [n.id, n.sortNo]))
    return allNodes
      .filter((node) => order.has(node.id))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  }

  async startFlow(dto: StartFlowDto, user: JwtUser): Promise<FlowInstanceEntity> {
    let definition = dto.definitionId
      ? await this.definitionRepo.findOne({ where: { id: dto.definitionId, tenantId: user.tenantId, isDeleted: 0 } })
      : await this.definitionRepo.findOne({ where: { tenantId: user.tenantId, bizType: dto.bizType, isActive: 1, isDeleted: 0 }, order: { version: 'DESC' } })
    if (!definition) throw new NotFoundException('流程定义不存在')
    const allNodes = await this.nodeRepo.find({ where: { tenantId: user.tenantId, definitionId: definition.id }, order: { sortNo: 'ASC', id: 'ASC' } })
    if (allNodes.length === 0) throw new BadRequestException('流程未配置节点')
    // 条件分支：按业务上下文筛选满足 conditionExpr 的节点；无条件节点作兜底始终保留
    const context = { ...dto.context, bizType: dto.bizType, bizId: dto.bizId, startedBy: user.userId }
    const matched = allNodes.filter((node) => evaluateCondition(node.conditionExpr, context).matched)
    const nodes = matched.length > 0 ? matched : allNodes.filter((node) => !node.conditionExpr)
    if (nodes.length === 0) throw new BadRequestException('没有匹配的条件审批节点')
    const snapshot = buildFlowSnapshot(nodes)
    const instance = await this.instanceRepo.save(this.instanceRepo.create({
      tenantId: user.tenantId,
      definitionId: definition.id,
      bizType: dto.bizType,
      bizId: dto.bizId,
      bizNo: dto.bizNo ?? null,
      startedBy: user.userId,
      status: 'RUNNING',
      currentNodeId: nodes[0].id,
      snapshot,
      escalated: 0
    }))
    await this.assignNodeTasks(instance.id, nodes[0], user)
    await this.auditService.record({ bizType: 'flow_instance', bizId: instance.id, action: 'START_FLOW', afterValue: instance }, user)
    return instance
  }

  /** 解析 assigneeRule：支持单个 ID、逗号分隔多 ID；无配置则退回发起人 */
  private parseAssignees(node: FlowNodeEntity, fallbackUserId: number): number[] {
    const rule = node.assigneeRule?.trim()
    if (!rule) return [fallbackUserId]
    const ids = rule.split(',').map((item) => Number(item.trim())).filter((n) => Number.isFinite(n) && n > 0)
    return ids.length ? [...new Set(ids)] : [fallbackUserId]
  }

  /** 为一个节点生成审批任务；会签/或签生成多任务，顺序审批只生成首个 */
  private async assignNodeTasks(instanceId: number, node: FlowNodeEntity, user: JwtUser): Promise<FlowTaskEntity[]> {
    const assignees = this.parseAssignees(node, user.userId)
    const mode = (node.approvalMode ?? APPROVAL_MODE.SEQUENTIAL) as string
    const targets = mode === APPROVAL_MODE.SEQUENTIAL ? assignees.slice(0, 1) : assignees
    const dueAt = computeDueAt(node.timeoutHours, new Date())
    const tasks: FlowTaskEntity[] = []
    for (const assigneeId of targets) {
      tasks.push(await this.taskRepo.save(this.taskRepo.create({
        tenantId: user.tenantId,
        instanceId,
        nodeId: node.id,
        assigneeId,
        status: 'PENDING',
        dueAt
      })))
    }
    return tasks
  }

  async listTodo(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<FlowTaskEntity>> {
    const where: FindOptionsWhere<FlowTaskEntity> = { tenantId: user.tenantId, status: 'PENDING' }
    if (query.assigneeId && query.assigneeId !== user.userId) {
      if (!user.isSuperAdmin && !user.permissions.includes('flow:todo:all')) {
        throw new ForbiddenException('无权查看他人待办')
      }
      where.assigneeId = query.assigneeId
    } else {
      where.assigneeId = user.userId
    }
    if (query.onlyOverdue) where.dueAt = LessThan(new Date())
    if (query.bizType || query.keyword) {
      const instances = await this.instanceRepo.find({
        where: {
          tenantId: user.tenantId,
          ...(query.bizType ? { bizType: query.bizType } : {}),
          ...(query.keyword ? { bizNo: Like(`%${query.keyword}%`) } : {})
        },
        select: { id: true }
      })
      where.instanceId = In(instances.map((item) => item.id))
      if (!instances.length) return buildPageResult([], 0, query.page, query.pageSize)
    }
    const [list, total] = await this.taskRepo.findAndCount({ where })
    return buildPageResult(sortTodos(list), total, query.page, query.pageSize)
  }

  async listDone(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<FlowTaskEntity>> {
    const [list, total] = await this.taskRepo.findAndCount({ where: { tenantId: user.tenantId, assigneeId: user.userId }, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list.filter((item) => item.status !== 'PENDING'), total, query.page, query.pageSize)
  }

  async listInstances(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<FlowInstanceEntity>> {
    const where = { tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }
    const [list, total] = await this.instanceRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /**
   * 流程监控分析（只读）：耗时分析、瓶颈节点排行、超时排行。
   * 数据范围受租户与数据权限约束，导出动作单独留审计。
   */
  async monitorAnalysis(query: QueryCollaborationDto, user: JwtUser): Promise<{
    summary: ReturnType<typeof analyzeFlowDuration>['summary']
    byType: ReturnType<typeof analyzeFlowDuration>['byType']
    bottlenecks: ReturnType<typeof analyzeFlowBottlenecks>
    timeouts: FlowTimeoutRow[]
  }> {
    const now = Date.now()
    const instances = await this.instanceRepo.find({
      where: {
        tenantId: user.tenantId,
        ...(query.bizType ? { bizType: query.bizType } : {}),
        ...(query.status ? { status: query.status } : {})
      },
      order: { id: 'DESC' },
      take: 500
    })
    const instanceIds = instances.map((item) => item.id)
    const tasks = instanceIds.length
      ? await this.taskRepo.find({ where: { tenantId: user.tenantId, instanceId: In(instanceIds) } })
      : []
    const nodeIds = [...new Set(tasks.map((item) => item.nodeId))]
    const nodes = nodeIds.length
      ? await this.nodeRepo.find({ where: { tenantId: user.tenantId, id: In(nodeIds) } })
      : []

    const duration = analyzeFlowDuration(instances, now)
    return {
      summary: duration.summary,
      byType: duration.byType,
      bottlenecks: analyzeFlowBottlenecks(tasks, nodes),
      timeouts: analyzeFlowTimeouts(instances, tasks, nodes, now)
    }
  }

  /** 流程监控导出：导出超时与瓶颈分析结果，留审计 */
  async exportMonitorAnalysis(query: QueryCollaborationDto, user: JwtUser): Promise<{
    exportedAt: string
    summary: ReturnType<typeof analyzeFlowDuration>['summary']
    byType: ReturnType<typeof analyzeFlowDuration>['byType']
    bottlenecks: ReturnType<typeof analyzeFlowBottlenecks>
    timeouts: FlowTimeoutRow[]
  }> {
    const analysis = await this.monitorAnalysis(query, user)
    await this.auditService.record({
      bizType: 'flow_instance',
      bizId: 0,
      action: 'FLOW_MONITOR_EXPORT',
      afterValue: {
        bizType: query.bizType ?? 'ALL',
        status: query.status ?? 'ALL',
        total: analysis.summary.total,
        timeouts: analysis.timeouts.length,
        bottlenecks: analysis.bottlenecks.length
      }
    }, user)
    return { exportedAt: new Date().toISOString(), ...analysis }
  }

  /** 批量审批待办：逐条处理并汇总成功/失败明细 */
  async batchActTasks(ids: number[], dto: FlowActionDto, user: JwtUser): Promise<{ succeeded: number[]; failed: Array<{ id: number; reason: string }> }> {
    const succeeded: number[] = []
    const failed: Array<{ id: number; reason: string }> = []
    for (const id of ids) {
      try {
        await this.actTask(id, dto, user)
        succeeded.push(id)
      } catch (cause) {
        failed.push({ id, reason: cause instanceof Error ? cause.message : '处理失败' })
      }
    }
    await this.auditService.record({
      bizType: 'oa_flow_task',
      bizId: 0,
      action: 'BATCH_ACT_TASK',
      afterValue: { action: dto.action, succeeded: succeeded.length, failed: failed.length }
    }, user)
    return { succeeded, failed }
  }

  async actTask(id: number, dto: FlowActionDto, user: JwtUser): Promise<FlowTaskEntity> {
    const task = await this.taskRepo.findOne({ where: { id, tenantId: user.tenantId, status: 'PENDING' } })
    if (!task) throw new NotFoundException('待办不存在或已处理')
    if (!canActOnTask(task.assigneeId, task.delegatedTo, user.userId)) {
      throw new ForbiddenException('不是当前用户的待办')
    }
    assertRejectReason(dto.action, dto.comment)

    task.status = dto.action === 'APPROVE' ? TASK_DECISION.APPROVED : TASK_DECISION.REJECTED
    task.actedAt = new Date()
    const saved = await this.taskRepo.save(task)
    await this.taskLogRepo.save(this.taskLogRepo.create({
      tenantId: user.tenantId,
      taskId: id,
      action: dto.action,
      operatorId: user.userId,
      comment: dto.comment ?? null
    }))

    const instance = await this.instanceRepo.findOne({ where: { id: task.instanceId, tenantId: user.tenantId } })
    if (!instance) throw new NotFoundException('流程实例不存在')
    const nodes = await this.nodesFromSnapshot(instance, user)
    const currentNode = nodes.find((node) => node.id === task.nodeId)
    if (!currentNode) throw new NotFoundException('流程节点不存在')
    const mode = (currentNode.approvalMode ?? APPROVAL_MODE.SEQUENTIAL) as keyof typeof APPROVAL_MODE
    const nodeTasks = await this.taskRepo.find({ where: { tenantId: user.tenantId, instanceId: instance.id, nodeId: currentNode.id } })

    const expectedAssignees = mode === APPROVAL_MODE.SEQUENTIAL
      ? this.parseAssignees(currentNode, instance.startedBy)
      : nodeTasks.map((item) => item.assigneeId)
    const decisions: ApprovalDecision[] = nodeTasks
      .filter((item) => item.actedAt)
      .map((item) => ({ assigneeId: item.assigneeId, decision: item.status as keyof typeof TASK_DECISION }))
    const verdict = evaluateNodeDecision(mode, decisions, expectedAssignees)

    if (verdict === 'REJECTED') {
      instance.status = 'REJECTED'
      instance.currentNodeId = null
      instance.finishedAt = new Date()
      await this.instanceRepo.save(instance)
      await this.cancelPendingTasks(instance.id, user)
      await this.notifyBizFinalState(instance, user, false, dto.comment)
    } else if (verdict === 'APPROVED') {
      await this.cancelPendingTasks(instance.id, user, currentNode.id)
      const currentIndex = nodes.findIndex((node) => node.id === currentNode.id)
      const next = nodes[currentIndex + 1]
      if (next) {
        instance.currentNodeId = next.id
        await this.instanceRepo.save(instance)
        await this.assignNodeTasks(instance.id, next, user)
      } else {
        instance.status = 'APPROVED'
        instance.currentNodeId = null
        instance.finishedAt = new Date()
        await this.instanceRepo.save(instance)
        await this.notifyBizFinalState(instance, user, true, dto.comment)
      }
    } else if (mode === APPROVAL_MODE.SEQUENTIAL) {
      await this.activateNextSequentialTask(instance, currentNode, user)
    }

    await this.auditService.record({ bizType: 'flow_task', bizId: id, action: dto.action, afterValue: saved }, user)
    return saved
  }

  /**
   * 流程到达终态时同步通知业务模块执行对应动作。
   * 业务回调在自身事务内完成；失败记录审计供补偿，不影响已提交的流程终态。
   */
  private async notifyBizFinalState(
    instance: FlowInstanceEntity,
    user: JwtUser,
    approved: boolean,
    comment?: string
  ): Promise<void> {
    const callback = this.bizCallbackRegistry.get(instance.bizType)
    if (!callback) return
    try {
      await (approved ? callback.onApproved : callback.onRejected)({
        instance,
        bizId: instance.bizId,
        user,
        comment
      })
      await this.auditService.record({
        bizType: 'flow_instance',
        bizId: instance.id,
        action: approved ? 'BIZ_APPROVED' : 'BIZ_REJECTED',
        afterValue: { bizType: instance.bizType, bizId: instance.bizId }
      }, user)
    } catch (cause) {
      await this.auditService.record({
        bizType: 'flow_instance',
        bizId: instance.id,
        action: 'BIZ_CALLBACK_FAILED',
        afterValue: { bizType: instance.bizType, bizId: instance.bizId, error: String(cause instanceof Error ? cause.message : cause) }
      }, user)
    }
  }

  /** 流程过程动作（撤回/转办/加签）通知业务模块 */
  private async notifyBizAction(
    instance: FlowInstanceEntity,
    user: JwtUser,
    action: 'WITHDRAWN' | 'DELEGATED' | 'ADD_SIGN',
    comment?: string
  ): Promise<void> {
    try {
      await this.bizCallbackRegistry.notifyAction(instance.bizType, action, {
        instance,
        bizId: instance.bizId,
        user,
        comment
      })
      await this.auditService.record({
        bizType: 'flow_instance',
        bizId: instance.id,
        action: `BIZ_${action}`,
        afterValue: { bizType: instance.bizType, bizId: instance.bizId }
      }, user)
    } catch (cause) {
      await this.auditService.record({
        bizType: 'flow_instance',
        bizId: instance.id,
        action: 'BIZ_CALLBACK_FAILED',
        afterValue: { action, error: String(cause instanceof Error ? cause.message : cause) }
      }, user)
    }
  }

  /** 发起人撤回流程：终止实例、取消待办并通知业务模块 */
  async withdrawInstance(instanceId: number, user: JwtUser): Promise<FlowInstanceEntity> {
    const instance = await this.instanceRepo.findOne({ where: { id: instanceId, tenantId: user.tenantId } })
    if (!instance) throw new NotFoundException('流程实例不存在')
    if (instance.status !== 'RUNNING') throw new BadRequestException('只有运行中的流程可以撤回')
    if (!user.isSuperAdmin && instance.startedBy !== user.userId) throw new ForbiddenException('只有发起人可以撤回流程')
    instance.status = 'WITHDRAWN'
    instance.currentNodeId = null
    instance.finishedAt = new Date()
    const saved = await this.instanceRepo.save(instance)
    await this.cancelPendingTasks(instance.id, user)
    await this.notifyBizAction(saved, user, 'WITHDRAWN', '发起人撤回')
    await this.auditService.record({ bizType: 'flow_instance', bizId: saved.id, action: 'WITHDRAW', afterValue: saved }, user)
    return saved
  }

  /** 取消实例中仍未处理的任务（可限定节点；驳回时取消全部） */
  private async cancelPendingTasks(instanceId: number, user: JwtUser, nodeId?: number): Promise<void> {
    const pending = await this.taskRepo.find({
      where: {
        tenantId: user.tenantId,
        instanceId,
        status: 'PENDING',
        ...(nodeId ? { nodeId } : {})
      }
    })
    for (const item of pending) {
      item.status = 'CANCELLED'
      item.actedAt = new Date()
      await this.taskRepo.save(item)
    }
  }

  /** 顺序审批：激活同节点的下一个审批人 */
  private async activateNextSequentialTask(
    instance: FlowInstanceEntity,
    node: FlowNodeEntity,
    user: JwtUser
  ): Promise<void> {
    const allAssignees = this.parseAssignees(node, instance.startedBy)
    const existing = await this.taskRepo.find({ where: { tenantId: user.tenantId, instanceId: instance.id, nodeId: node.id } })
    const existingIds = new Set(existing.map((item) => item.assigneeId))
    const nextAssignee = allAssignees.find((id) => !existingIds.has(id))
    if (nextAssignee == null) return
    await this.taskRepo.save(this.taskRepo.create({
      tenantId: user.tenantId,
      instanceId: instance.id,
      nodeId: node.id,
      assigneeId: nextAssignee,
      status: 'PENDING',
      dueAt: computeDueAt(node.timeoutHours, new Date())
    }))
  }

  /** 转办/委托：把当前待办委托给他人处理，原处理人保留指派记录 */
  async delegateTask(id: number, dto: DelegateTaskDto, user: JwtUser): Promise<FlowTaskEntity> {
    const task = await this.taskRepo.findOne({ where: { id, tenantId: user.tenantId, status: 'PENDING' } })
    if (!task) throw new NotFoundException('待办不存在或已处理')
    if (task.assigneeId !== user.userId) throw new ForbiddenException('只有原处理人可转办')
    const startAt = dto.startAt ? new Date(dto.startAt) : new Date()
    const endAt = dto.endAt ? new Date(dto.endAt) : null
    if (endAt && endAt.getTime() <= startAt.getTime()) throw new BadRequestException('委托结束时间必须晚于开始时间')
    task.delegatedTo = dto.toUserId
    task.entrustStartAt = startAt
    task.entrustEndAt = endAt
    const saved = await this.taskRepo.save(task)
    await this.taskLogRepo.save(this.taskLogRepo.create({
      tenantId: user.tenantId,
      taskId: id,
      action: 'DELEGATE',
      operatorId: user.userId,
      comment: `委托给用户 ${dto.toUserId}${endAt ? `（至 ${endAt.toISOString()}）` : ''}${dto.reason ? `：${dto.reason}` : ''}`
    }))
    await this.auditService.record({ bizType: 'flow_task', bizId: id, action: 'DELEGATE', afterValue: saved }, user)
    const instance = await this.instanceRepo.findOne({ where: { id: task.instanceId, tenantId: user.tenantId } })
    if (instance) await this.notifyBizAction(instance, user, 'DELEGATED', dto.reason)
    return saved
  }

  /** 加签：为当前节点增加一名审批人（与会签/或签规则一致） */
  async addSign(id: number, dto: AddSignDto, user: JwtUser): Promise<FlowTaskEntity> {
    const task = await this.taskRepo.findOne({ where: { id, tenantId: user.tenantId, status: 'PENDING' } })
    if (!task) throw new NotFoundException('待办不存在或已处理')
    const duplicate = await this.taskRepo.findOne({
      where: { tenantId: user.tenantId, instanceId: task.instanceId, nodeId: task.nodeId, assigneeId: dto.userId, status: 'PENDING' }
    })
    if (duplicate) throw new BadRequestException('该用户已有本节点待办')
    const added = await this.taskRepo.save(this.taskRepo.create({
      tenantId: user.tenantId,
      instanceId: task.instanceId,
      nodeId: task.nodeId,
      assigneeId: dto.userId,
      status: 'PENDING',
      addedBy: user.userId,
      dueAt: task.dueAt
    }))
    await this.taskLogRepo.save(this.taskLogRepo.create({
      tenantId: user.tenantId,
      taskId: id,
      action: 'ADD_SIGN',
      operatorId: user.userId,
      comment: `加签用户 ${dto.userId}${dto.reason ? `：${dto.reason}` : ''}`
    }))
    await this.auditService.record({ bizType: 'flow_task', bizId: added.id, action: 'ADD_SIGN', afterValue: added }, user)
    const instance = await this.instanceRepo.findOne({ where: { id: task.instanceId, tenantId: user.tenantId } })
    if (instance) await this.notifyBizAction(instance, user, 'ADD_SIGN', dto.reason)
    return added
  }

  /** 流程详情：实例 + 快照 + 节点/任务/日志，用于流程图追踪 */
  async flowDetail(instanceId: number, user: JwtUser): Promise<{
    instance: FlowInstanceEntity
    nodes: FlowNodeEntity[]
    tasks: FlowTaskEntity[]
    logs: FlowTaskLogEntity[]
  }> {
    const instance = await this.instanceRepo.findOne({ where: { id: instanceId, tenantId: user.tenantId } })
    if (!instance) throw new NotFoundException('流程实例不存在')
    const nodes = await this.nodesFromSnapshot(instance, user)
    const tasks = await this.taskRepo.find({ where: { tenantId: user.tenantId, instanceId }, order: { id: 'ASC' } })
    const logs = await this.taskLogRepo.find({ where: { tenantId: user.tenantId }, order: { id: 'ASC' } })
    const taskIds = new Set(tasks.map((task) => task.id))
    return { instance, nodes, tasks, logs: logs.filter((log) => taskIds.has(log.taskId)) }
  }

  /** 超时升级扫描：标记超时未完成实例的 escalated 标志并记录审计 */
  async escalateOverdue(user: JwtUser): Promise<{ escalated: number }> {
    const overdueTasks = await this.taskRepo.find({ where: { tenantId: user.tenantId, status: 'PENDING' } })
    const now = new Date()
    const instanceIds = new Set<number>()
    for (const task of overdueTasks) {
      if (isOverdue(task.dueAt, now)) instanceIds.add(task.instanceId)
    }
    let count = 0
    for (const instanceId of instanceIds) {
      const instance = await this.instanceRepo.findOne({ where: { id: instanceId, tenantId: user.tenantId } })
      if (instance && instance.status === 'RUNNING' && !instance.escalated) {
        instance.escalated = 1
        await this.instanceRepo.save(instance)
        await this.auditService.record({ bizType: 'flow_instance', bizId: instanceId, action: 'ESCALATE_TIMEOUT', afterValue: { escalated: 1 } }, user)
        count++
      }
    }
    return { escalated: count }
  }

  async listNotices(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<NoticeEntity>> {
    const [list, total] = await this.noticeRepo.findAndCount({ where: { tenantId: user.tenantId }, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createNotice(dto: CreateNoticeDto, user: JwtUser): Promise<NoticeEntity> {
    const rules = await this.sensitiveRules(user)
    const title = filterSensitiveWords(dto.title, rules)
    const content = filterSensitiveWords(dto.content ?? '', rules)
    if (title.blocked || content.blocked) {
      throw new BadRequestException(`公告包含高危敏感词：${[...title.hits, ...content.hits].join('、')}`)
    }
    const entity = this.noticeRepo.create({
      ...dto,
      title: title.text,
      content: dto.content === undefined ? null : content.text,
      tenantId: user.tenantId,
      channel: dto.channel ?? 'INMAIL',
      createdBy: user.userId
    })
    const saved = await this.noticeRepo.save(entity)
    await this.auditService.record({ bizType: 'oa_notice', bizId: saved.id, action: 'CREATE_NOTICE', afterValue: saved }, user)
    return saved
  }

  async listChats(query: QueryCollaborationDto, user: JwtUser): Promise<ChatMessageEntity[]> {
    return this.chatRepo.find({ where: { tenantId: user.tenantId, channel: query.keyword ?? 'general' }, order: { id: 'ASC' }, take: 200 })
  }

  async createChat(dto: CreateChatDto, user: JwtUser): Promise<ChatMessageEntity> {
    const rules = await this.sensitiveRules(user)
    const filtered = filterSensitiveWords(dto.content, rules)
    if (filtered.blocked) throw new BadRequestException(`消息包含高危敏感词：${filtered.hits.join('、')}`)
    return this.chatRepo.save(this.chatRepo.create({
      ...dto,
      content: filtered.text,
      tenantId: user.tenantId,
      senderId: user.userId,
      receiverId: dto.receiverId ?? null,
      readFlag: 'NO',
      readAt: null
    }))
  }

  async listProjects(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<ProjectEntity>> {
    const where = { tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }
    const [list, total] = await this.projectRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createProject(dto: CreateProjectDto, user: JwtUser): Promise<ProjectEntity> {
    const entity = this.projectRepo.create({ ...dto, tenantId: user.tenantId, ownerId: dto.ownerId ?? user.userId, startDate: dto.startDate ?? null, endDate: dto.endDate ?? null })
    const saved = await this.projectRepo.save(entity)
    await this.auditService.record({ bizType: 'oa_project', bizId: saved.id, action: 'CREATE_PROJECT', afterValue: saved }, user)
    return saved
  }

  async listOaTasks(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<OaTaskEntity>> {
    const where = { tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }
    const [list, total] = await this.oaTaskRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createOaTask(dto: CreateOaTaskDto, user: JwtUser): Promise<OaTaskEntity> {
    const entity = this.oaTaskRepo.create({ ...dto, tenantId: user.tenantId, projectId: dto.projectId ?? null, assigneeId: dto.assigneeId ?? user.userId, dueDate: dto.dueDate ?? null })
    const saved = await this.oaTaskRepo.save(entity)
    await this.auditService.record({ bizType: 'oa_task', bizId: saved.id, action: 'CREATE_TASK', afterValue: saved }, user)
    return saved
  }

  async listDocuments(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<DocumentEntity>> {
    const [list, total] = await this.documentRepo.findAndCount({ where: { tenantId: user.tenantId }, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createDocument(dto: CreateDocumentDto, user: JwtUser): Promise<DocumentEntity> {
    const entity = this.documentRepo.create({ ...dto, tenantId: user.tenantId, categoryId: dto.categoryId ?? null, fileUrl: dto.fileUrl ?? null, createdBy: user.userId })
    const saved = await this.documentRepo.save(entity)
    await this.auditService.record({ bizType: 'oa_document', bizId: saved.id, action: 'CREATE_DOCUMENT', afterValue: saved }, user)
    return saved
  }

  async listRecruits(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<RecruitDemandEntity>> {
    const [list, total] = await this.recruitRepo.findAndCount({ where: { tenantId: user.tenantId }, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createRecruit(dto: CreateRecruitDto, user: JwtUser): Promise<RecruitDemandEntity> {
    return this.recruitRepo.save(this.recruitRepo.create({ ...dto, tenantId: user.tenantId, demandNo: this.number('RD'), headcount: dto.headcount ?? 1 }))
  }

  async listCandidates(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<CandidateEntity>> {
    const [list, total] = await this.candidateRepo.findAndCount({ where: { tenantId: user.tenantId }, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createCandidate(dto: CreateCandidateDto, user: JwtUser): Promise<CandidateEntity> {
    return this.candidateRepo.save(this.candidateRepo.create({ ...dto, tenantId: user.tenantId, demandId: dto.demandId ?? null, mobile: dto.mobile ?? null, score: dto.score ?? 0 }))
  }

  async listInterviews(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<InterviewEntity>> {
    const [list, total] = await this.interviewRepo.findAndCount({ where: { tenantId: user.tenantId }, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createInterview(dto: CreateInterviewDto, user: JwtUser): Promise<InterviewEntity> {
    const judgement = evaluateInterviewFeedback(dto.feedback)
    if (!judgement.ok) throw new BadRequestException(judgement.reason)
    return this.interviewRepo.save(this.interviewRepo.create({ ...dto, tenantId: user.tenantId, interviewAt: dto.interviewAt ? new Date(dto.interviewAt) : null, feedback: dto.feedback!.trim() }))
  }

  async listShifts(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<ShiftEntity>> {
    const [list, total] = await this.shiftRepo.findAndCount({ where: { tenantId: user.tenantId, isDeleted: 0 }, order: { id: 'ASC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createShift(dto: CreateShiftDto, user: JwtUser): Promise<ShiftEntity> {
    return this.shiftRepo.save(this.shiftRepo.create({ ...dto, tenantId: user.tenantId }))
  }

  async listPunches(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<PunchEntity>> {
    const [list, total] = await this.punchRepo.findAndCount({ where: { tenantId: user.tenantId }, order: { punchTime: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createPunch(dto: CreatePunchDto, user: JwtUser): Promise<PunchEntity> {
    return this.punchRepo.save(this.punchRepo.create({ ...dto, tenantId: user.tenantId, punchTime: dto.punchTime ? new Date(dto.punchTime) : new Date(), source: dto.source ?? 'MANUAL' }))
  }

  async listLeaves(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<LeaveEntity>> {
    const where = { tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }
    const [list, total] = await this.leaveRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createLeave(dto: CreateLeaveDto, user: JwtUser): Promise<LeaveEntity> {
    const startTime = new Date(dto.startTime)
    const endTime = new Date(dto.endTime)
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      throw new BadRequestException('请假起止时间格式不正确')
    }
    return this.leaveRepo.save(this.leaveRepo.create({
      ...dto,
      tenantId: user.tenantId,
      startTime,
      endTime,
      days: String(leaveDurationDays(startTime, endTime))
    }))
  }

  async listOvertimes(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<OvertimeEntity>> {
    const [list, total] = await this.overtimeRepo.findAndCount({ where: { tenantId: user.tenantId }, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createOvertime(dto: CreateOvertimeDto, user: JwtUser): Promise<OvertimeEntity> {
    return this.overtimeRepo.save(this.overtimeRepo.create({ ...dto, tenantId: user.tenantId, reason: dto.reason ?? null }))
  }

  async listSalaries(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<SalaryEntity>> {
    const where = { tenantId: user.tenantId, ...(query.period ? { period: query.period } : {}) }
    const [list, total] = await this.salaryRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    // 薪酬金额脱敏：无明细权限时仅返回区间
    const canView = user.isSuperAdmin || user.permissions.includes('hr:payroll:detail')
    const masked = canView ? list : list.map((item) => ({
      ...item,
      grossAmount: maskSalaryAmount(item.grossAmount, false),
      netAmount: maskSalaryAmount(item.netAmount, false)
    }))
    return buildPageResult(masked, total, query.page, query.pageSize)
  }

  async createSalary(dto: CreateSalaryDto, user: JwtUser): Promise<SalaryEntity> {
    return this.salaryRepo.save(this.salaryRepo.create({ ...dto, tenantId: user.tenantId, netAmount: dto.netAmount ?? dto.grossAmount }))
  }

  async listPerformances(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<PerformanceEntity>> {
    const where = { tenantId: user.tenantId, ...(query.period ? { period: query.period } : {}) }
    const [list, total] = await this.performanceRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createPerformance(dto: CreatePerformanceDto, user: JwtUser): Promise<PerformanceEntity> {
    const score = dto.score ?? 0
    const level = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'D'
    return this.performanceRepo.save(this.performanceRepo.create({ ...dto, tenantId: user.tenantId, score, level }))
  }

  async listTrainings(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<TrainingEntity>> {
    const [list, total] = await this.trainingRepo.findAndCount({ where: { tenantId: user.tenantId }, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createTraining(dto: CreateTrainingDto, user: JwtUser): Promise<TrainingEntity> {
    return this.trainingRepo.save(this.trainingRepo.create({ ...dto, tenantId: user.tenantId, planDate: dto.planDate ?? null }))
  }

  async listAdminAssets(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<AdminAssetEntity>> {
    const [list, total] = await this.adminAssetRepo.findAndCount({ where: { tenantId: user.tenantId }, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createAdminAsset(dto: CreateAdminAssetDto, user: JwtUser): Promise<AdminAssetEntity> {
    return this.adminAssetRepo.save(this.adminAssetRepo.create({ ...dto, tenantId: user.tenantId, holderId: dto.holderId ?? null }))
  }

  async listVehicles(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<VehicleEntity>> {
    const [list, total] = await this.vehicleRepo.findAndCount({ where: { tenantId: user.tenantId }, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createVehicle(dto: CreateVehicleDto, user: JwtUser): Promise<VehicleEntity> {
    return this.vehicleRepo.save(this.vehicleRepo.create({ ...dto, tenantId: user.tenantId, driverId: dto.driverId ?? null }))
  }

  async listVehicleUses(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<VehicleUseEntity>> {
    const [list, total] = await this.vehicleUseRepo.findAndCount({ where: { tenantId: user.tenantId }, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createVehicleUse(dto: CreateVehicleUseDto, user: JwtUser): Promise<VehicleUseEntity> {
    return this.vehicleUseRepo.save(this.vehicleUseRepo.create({ ...dto, tenantId: user.tenantId, startTime: new Date(dto.startTime), endTime: new Date(dto.endTime) }))
  }

  async listEmployeeRecords(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<HrEmployeeRecordEntity>> {
    const [list, total] = await this.employeeRecordRepo.findAndCount({ where: { tenantId: user.tenantId }, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createEmployeeRecord(dto: CreateEmployeeRecordDto, user: JwtUser): Promise<Record<string, unknown>> {
    const warning = dto.expiryDate ? contractExpiryWarning({ startDate: dto.effectiveDate ?? new Date().toISOString(), endDate: dto.expiryDate }) : null
    const entity = this.employeeRecordRepo.create({
      ...dto,
      tenantId: user.tenantId,
      effectiveDate: dto.effectiveDate ?? null,
      expiryDate: dto.expiryDate ?? null,
      detail: dto.detail ?? null,
      createdBy: user.userId
    })
    const saved = await this.employeeRecordRepo.save(entity)
    await this.auditService.record({ bizType: 'hr_employee_record', bizId: saved.id, action: 'CREATE_RECORD', afterValue: saved }, user)
    return { record: saved, expiryWarning: warning }
  }

  async approveEmployeeRecord(id: number, dto: ApprovalStatusDto, user: JwtUser): Promise<HrEmployeeRecordEntity> {
    const entity = await this.employeeRecordRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('员工档案记录不存在')
    entity.approvalStatus = dto.status
    const saved = await this.employeeRecordRepo.save(entity)
    await this.auditService.record({ bizType: 'hr_employee_record', bizId: id, action: 'APPROVE_RECORD', afterValue: { status: dto.status, note: dto.note } }, user)
    return saved
  }

  async createOffer(dto: CreateOfferDto, user: JwtUser): Promise<HrOfferEntity> {
    if (!offerApproval(Number(dto.salary), dto.budget)) throw new BadRequestException('Offer 薪资必须大于零且不超过预算')
    const saved = await this.offerRepo.save(this.offerRepo.create({ ...dto, tenantId: user.tenantId, status: 'PENDING', approvedBy: null }))
    await this.auditService.record({ bizType: 'hr_offer', bizId: saved.id, action: 'CREATE_OFFER', afterValue: saved }, user)
    return saved
  }

  async createPayrollDetail(dto: CreatePayrollDetailDto, user: JwtUser): Promise<HrPayrollDetailEntity> {
    const salary = await this.salaryRepo.findOne({ where: { id: dto.salaryId, tenantId: user.tenantId } })
    if (!salary) throw new NotFoundException('薪资单不存在')
    const calculated = calculatePayroll({ gross: Number(dto.gross), taxable: dto.taxable ? Number(dto.taxable) : undefined })
    salary.netAmount = String(calculated.net)
    await this.salaryRepo.save(salary)
    const existing = await this.payrollDetailRepo.findOne({ where: { tenantId: user.tenantId, salaryId: dto.salaryId } })
    const entity = existing ?? this.payrollDetailRepo.create({ tenantId: user.tenantId, salaryId: dto.salaryId, payslipNo: this.number('PS') })
    entity.social = String(calculated.social)
    entity.tax = String(calculated.tax)
    const saved = await this.payrollDetailRepo.save(entity)
    await this.auditService.record({ bizType: 'hr_payroll', bizId: saved.id, action: 'CALCULATE_PAYROLL', afterValue: calculated }, user)
    return saved
  }

  async reviewPayroll(id: number, dto: ReviewPayrollDto, user: JwtUser): Promise<HrPayrollDetailEntity> {
    const entity = await this.payrollDetailRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('薪资明细不存在')
    entity.reviewStatus = dto.status
    entity.reviewedBy = user.userId
    const saved = await this.payrollDetailRepo.save(entity)
    await this.auditService.record({ bizType: 'hr_payroll', bizId: id, action: 'REVIEW_PAYROLL', afterValue: { status: dto.status } }, user)
    return saved
  }

  async createPerformanceReview(dto: CreatePerformanceReviewDto, user: JwtUser): Promise<HrPerformanceReviewEntity> {
    const performance = await this.performanceRepo.findOne({ where: { id: dto.performanceId, tenantId: user.tenantId } })
    if (!performance) throw new NotFoundException('绩效记录不存在')
    const calculated = calibratePerformance({ kpiScore: dto.kpiScore, peerScore: dto.peerScore, calibration: dto.calibration })
    performance.score = Math.round(calculated.score)
    performance.level = calculated.level
    await this.performanceRepo.save(performance)
    const saved = await this.performanceReviewRepo.save(this.performanceReviewRepo.create({
      tenantId: user.tenantId, performanceId: dto.performanceId, kpiScore: dto.kpiScore,
      peerScore: dto.peerScore, calibration: dto.calibration ?? 0, level: calculated.level
    }))
    await this.auditService.record({ bizType: 'hr_performance', bizId: saved.id, action: 'CALIBRATE', afterValue: calculated }, user)
    return saved
  }

  async appealPerformance(id: number, dto: AppealPerformanceDto, user: JwtUser): Promise<HrPerformanceReviewEntity> {
    const entity = await this.performanceReviewRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('绩效复核不存在')
    entity.appealStatus = 'APPEALED'
    entity.appealReason = dto.reason
    const saved = await this.performanceReviewRepo.save(entity)
    await this.auditService.record({ bizType: 'hr_performance', bizId: id, action: 'APPEAL', afterValue: { reason: dto.reason } }, user)
    return saved
  }

  async createTrainingRecord(dto: CreateTrainingRecordDto, user: JwtUser): Promise<HrTrainingRecordEntity> {
    const result = trainingCertification(dto.examScore)
    const saved = await this.trainingRecordRepo.save(this.trainingRecordRepo.create({
      tenantId: user.tenantId, ...dto, passed: result.passed ? 1 : 0,
      certificateNo: result.certificateNo, signinAt: new Date()
    }))
    await this.auditService.record({ bizType: 'hr_training', bizId: saved.id, action: 'EXAM_RECORD', afterValue: result }, user)
    return saved
  }

  async assetAction(dto: AssetActionDto, user: JwtUser): Promise<HrAssetTransactionEntity> {
    const asset = await this.adminAssetRepo.findOne({ where: { id: dto.assetId, tenantId: user.tenantId } })
    if (!asset) throw new NotFoundException('行政资产不存在')
    const next = assetTransition(asset.status, dto.action)
    if (!next) throw new BadRequestException(`当前状态 ${asset.status} 不允许执行 ${dto.action}`)
    const holderCheck = (dto.action === 'ISSUE' || dto.action === 'RETURN')
      ? evaluateAssetIssueReturn(dto.action, dto.holderId ?? asset.holderId)
      : { ok: true, reason: null }
    if (!holderCheck.ok) throw new BadRequestException(holderCheck.reason)
    const from = asset.status
    asset.status = next
    asset.holderId = dto.holderId ?? (next === 'IDLE' ? null : asset.holderId)
    await this.adminAssetRepo.save(asset)
    const saved = await this.assetTransactionRepo.save(this.assetTransactionRepo.create({
      tenantId: user.tenantId, assetId: dto.assetId, action: dto.action, fromStatus: from,
      toStatus: next, holderId: asset.holderId, note: dto.note ?? null, createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'hr_admin_asset', bizId: saved.id, action: dto.action, afterValue: saved }, user)
    return saved
  }

  async createVehicleUseChecked(dto: CreateVehicleUseDto, user: JwtUser): Promise<VehicleUseEntity> {
    const existing = await this.vehicleUseRepo.find({ where: { tenantId: user.tenantId } })
    const candidates = existing.filter((item) => ['PENDING', 'APPROVED'].includes(item.status))
    const result = detectVehicleConflict(candidates, {
      vehicleId: dto.vehicleId,
      applyUserId: dto.applyUserId,
      startTime: dto.startTime,
      endTime: dto.endTime
    })
    if (result.conflict) {
      const reason = result.types.includes('SAME_VEHICLE') ? '该车辆已被占用' : '申请人已有用车安排'
      throw new BadRequestException(`车辆时段冲突：${reason}`)
    }
    return this.createVehicleUse(dto, user)
  }

  /* ---------------- 协同增强：敏感词、已读回执、公告确认、会议纪要 ---------------- */

  /** 敏感词库维护 */
  async listSensitiveWords(user: JwtUser): Promise<SensitiveWordEntity[]> {
    return this.sensitiveWordRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 }, order: { id: 'ASC' } })
  }

  async createSensitiveWord(dto: CreateSensitiveWordDto, user: JwtUser): Promise<SensitiveWordEntity> {
    const existing = await this.sensitiveWordRepo.findOne({ where: { tenantId: user.tenantId, word: dto.word, isDeleted: 0 } })
    if (existing) throw new BadRequestException('敏感词已存在')
    const saved = await this.sensitiveWordRepo.save(this.sensitiveWordRepo.create({
      tenantId: user.tenantId,
      word: dto.word,
      level: dto.level ?? 'MEDIUM',
      enabled: dto.enabled ?? 'YES',
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'oa_sensitive_word', bizId: saved.id, action: 'CREATE_SENSITIVE_WORD', afterValue: saved }, user)
    return saved
  }

  async removeSensitiveWord(id: number, user: JwtUser): Promise<void> {
    const entity = await this.sensitiveWordRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('敏感词不存在')
    entity.isDeleted = 1
    await this.sensitiveWordRepo.save(entity)
    await this.auditService.record({ bizType: 'oa_sensitive_word', bizId: id, action: 'REMOVE_SENSITIVE_WORD', afterValue: entity }, user)
  }

  /** 读取租户敏感词规则 */
  private async sensitiveRules(user: JwtUser): Promise<Array<{ word: string; level: string; enabled: boolean }>> {
    const words = await this.sensitiveWordRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    return words.map((item) => ({ word: item.word, level: item.level, enabled: item.enabled !== 'NO' }))
  }

  /** 聊天已读回执 */
  async markChatRead(id: number, user: JwtUser): Promise<ChatMessageEntity> {
    const message = await this.chatRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!message) throw new NotFoundException('聊天消息不存在')
    if (message.senderId !== user.userId && message.receiverId !== user.userId) {
      throw new BadRequestException('只能标记本人相关的消息为已读')
    }
    message.readFlag = 'YES'
    message.readAt = new Date()
    const saved = await this.chatRepo.save(message)
    await this.auditService.record({ bizType: 'oa_chat_message', bizId: id, action: 'MARK_CHAT_READ', afterValue: { readFlag: 'YES' } }, user)
    return saved
  }

  /** 未读消息统计 */
  async unreadChatCount(user: JwtUser): Promise<{ unread: number }> {
    const unread = await this.chatRepo.count({ where: { tenantId: user.tenantId, receiverId: user.userId, readFlag: 'NO' } })
    return { unread }
  }

  /** 公告确认记录 */
  async confirmNotice(id: number, user: JwtUser): Promise<NoticeConfirmEntity> {
    const notice = await this.noticeRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!notice) throw new NotFoundException('公告不存在')
    const existing = await this.noticeConfirmRepo.findOne({ where: { tenantId: user.tenantId, noticeId: id, userId: user.userId } })
    if (existing) return existing
    const saved = await this.noticeConfirmRepo.save(this.noticeConfirmRepo.create({ tenantId: user.tenantId, noticeId: id, userId: user.userId }))
    await this.auditService.record({ bizType: 'oa_notice', bizId: id, action: 'CONFIRM_NOTICE', afterValue: { userId: user.userId } }, user)
    return saved
  }

  /** 公告确认统计 */
  async noticeConfirmStat(id: number, user: JwtUser): Promise<{ confirmed: number; confirmedByMe: boolean }> {
    const confirmed = await this.noticeConfirmRepo.count({ where: { tenantId: user.tenantId, noticeId: id } })
    const mine = await this.noticeConfirmRepo.findOne({ where: { tenantId: user.tenantId, noticeId: id, userId: user.userId } })
    return { confirmed, confirmedByMe: Boolean(mine) }
  }

  /** 会议纪要转任务：解析纪要中的任务行并生成 OA 待办 */
  async createMeeting(dto: CreateMeetingDto, user: JwtUser): Promise<{ meeting: MeetingEntity; tasks: OaTaskEntity[] }> {
    const meeting = await this.meetingRepo.save(this.meetingRepo.create({
      tenantId: user.tenantId,
      projectId: dto.projectId ?? null,
      title: dto.title,
      meetingAt: dto.meetingAt ? new Date(dto.meetingAt) : null,
      location: dto.location ?? null,
      minutes: dto.minutes ?? null,
      createdBy: user.userId
    }))
    const tasks: OaTaskEntity[] = []
    for (const candidate of parseMeetingTasks(dto.minutes ?? '')) {
      const task = await this.oaTaskRepo.save(this.oaTaskRepo.create({
        tenantId: user.tenantId,
        projectId: dto.projectId ?? null,
        taskName: candidate.taskName,
        assigneeId: candidate.assigneeId,
        dueDate: candidate.dueDate,
        status: 'TODO',
        source: 'MEETING',
        meetingId: meeting.id
      }))
      tasks.push(task)
    }
    await this.auditService.record({ bizType: 'oa_meeting', bizId: meeting.id, action: 'CREATE_MEETING', afterValue: { taskCount: tasks.length } }, user)
    return { meeting, tasks }
  }

  async listMeetings(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<MeetingEntity>> {
    const [list, total] = await this.meetingRepo.findAndCount({ where: { tenantId: user.tenantId, isDeleted: 0 }, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /* ---------------- 人事增强：补卡审批、薪酬发放审批与脱敏、绩效申诉闭环、证书到期、车队费用轨迹 ---------------- */

  /** 补卡申请 */
  async createPunchRequest(dto: CreatePunchRequestDto, user: JwtUser): Promise<PunchRequestEntity> {
    const existing = await this.punchRequestRepo.find({ where: { tenantId: user.tenantId, employeeId: dto.employeeId, punchDate: dto.punchDate } })
    const judgement = evaluatePunchRequest(existing, dto.employeeId, dto.punchDate)
    if (!judgement.ok) throw new BadRequestException(judgement.reason)
    const saved = await this.punchRequestRepo.save(this.punchRequestRepo.create({
      tenantId: user.tenantId,
      employeeId: dto.employeeId,
      punchDate: dto.punchDate,
      punchType: dto.punchType ?? 'MISSING',
      reason: dto.reason,
      status: 'PENDING',
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'hr_punch_request', bizId: saved.id, action: 'CREATE_PUNCH_REQUEST', afterValue: saved }, user)
    return saved
  }

  async listPunchRequests(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<PunchRequestEntity>> {
    const where = { tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }
    const [list, total] = await this.punchRequestRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 补卡审批：通过后生成考勤记录 */
  async approvePunchRequest(id: number, dto: ApprovePunchRequestDto, user: JwtUser): Promise<PunchRequestEntity> {
    const request = await this.punchRequestRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!request) throw new NotFoundException('补卡申请不存在')
    assertRejectReason(dto.decision, dto.comment)
    if (request.status !== 'PENDING') throw new BadRequestException(`补卡申请当前状态 ${request.status} 不允许审批`)
    const approved = dto.decision === 'APPROVE'
    request.status = approved ? 'APPROVED' : 'REJECTED'
    request.approverId = user.userId
    request.approvedAt = new Date()
    request.approveComment = dto.comment ?? null
    const saved = await this.punchRequestRepo.save(request)
    if (approved) {
      await this.punchRepo.save(this.punchRepo.create({
        tenantId: user.tenantId,
        employeeId: request.employeeId,
        punchTime: new Date(`${request.punchDate}T09:00:00`),
        source: 'MANUAL',
        status: 'NORMAL'
      }))
    }
    await this.auditService.record({ bizType: 'hr_punch_request', bizId: id, action: approved ? 'APPROVE_PUNCH_REQUEST' : 'REJECT_PUNCH_REQUEST', afterValue: saved }, user)
    return saved
  }

  /** 薪酬发放审批：草稿 → 已审批 → 已发放 */
  async approveSalary(id: number, dto: ApproveSalaryDto, user: JwtUser): Promise<SalaryEntity> {
    const salary = await this.salaryRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!salary) throw new NotFoundException('薪酬单不存在')
    assertRejectReason(dto.decision, dto.comment)
    if (dto.decision === 'SUBMIT') {
      const judgement = evaluateSalaryApproval(salary.status)
      if (!judgement.ok) throw new BadRequestException(judgement.reason)
      salary.status = 'APPROVING'
    } else if (dto.decision === 'APPROVE') {
      if (salary.status !== 'APPROVING') throw new BadRequestException(`薪酬单当前状态 ${salary.status} 不允许审批通过`)
      salary.status = 'APPROVED'
      salary.approvedBy = user.userId
      salary.approvedAt = new Date()
    } else if (dto.decision === 'REJECT') {
      salary.status = 'REJECTED'
      salary.approvedBy = user.userId
      salary.approvedAt = new Date()
    } else if (dto.decision === 'PAY') {
      if (salary.status !== 'APPROVED') throw new BadRequestException('薪酬单审批通过后才允许发放')
      salary.status = 'PAID'
      salary.payslipNo = salary.payslipNo ?? this.number('PAY')
    }
    const saved = await this.salaryRepo.save(salary)
    await this.auditService.record({ bizType: 'hr_salary', bizId: id, action: `SALARY_${dto.decision}`, afterValue: saved }, user)
    return saved
  }

  /** 绩效申诉处理：受理或驳回申诉并回写结论 */
  async resolvePerformanceAppeal(id: number, dto: ResolveAppealDto, user: JwtUser): Promise<HrPerformanceReviewEntity> {
    const review = await this.performanceReviewRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!review) throw new NotFoundException('绩效评议不存在')
    assertRejectReason(dto.result, dto.resolution)
    const judgement = evaluatePerformanceAppeal(review.appealStatus)
    if (!judgement.ok) throw new BadRequestException(judgement.reason)
    review.appealStatus = dto.result === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED'
    review.appealResolution = dto.resolution ?? null
    review.appealHandledBy = user.userId
    review.appealHandledAt = new Date()
    const saved = await this.performanceReviewRepo.save(review)
    await this.auditService.record({ bizType: 'hr_performance_review', bizId: id, action: 'RESOLVE_APPEAL', afterValue: saved }, user)
    return saved
  }

  /** 培训证书到期提醒 */
  async listExpiringCertificates(days = 30, user: JwtUser): Promise<Array<HrTrainingRecordEntity & { daysToExpire: number | null; expired: boolean }>> {
    const records = await this.trainingRecordRepo.find({ where: { tenantId: user.tenantId } })
    return records
      .map((record) => {
        const judgement = evaluateCertificateExpiry(record.expireDate, days)
        return { ...record, daysToExpire: judgement.days, expired: judgement.expired }
      })
      .filter((record) => record.daysToExpire !== null && record.daysToExpire <= days)
  }

  /** 车队费用登记 */
  async createVehicleExpense(dto: CreateVehicleExpenseDto, user: JwtUser): Promise<VehicleExpenseEntity> {
    const saved = await this.vehicleExpenseRepo.save(this.vehicleExpenseRepo.create({
      tenantId: user.tenantId,
      vehicleId: dto.vehicleId,
      vehicleUseId: dto.vehicleUseId ?? null,
      expenseType: dto.expenseType ?? 'FUEL',
      amount: dto.amount,
      expenseDate: dto.expenseDate,
      remark: dto.remark ?? null,
      status: 'PENDING',
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'hr_vehicle_expense', bizId: saved.id, action: 'CREATE_VEHICLE_EXPENSE', afterValue: saved }, user)
    return saved
  }

  async listVehicleExpenses(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<VehicleExpenseEntity>> {
    const where = { tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }
    const [list, total] = await this.vehicleExpenseRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 车辆轨迹记录 */
  async createVehicleTrack(dto: CreateVehicleTrackDto, user: JwtUser): Promise<VehicleTrackEntity> {
    const saved = await this.vehicleTrackRepo.save(this.vehicleTrackRepo.create({
      tenantId: user.tenantId,
      vehicleId: dto.vehicleId,
      vehicleUseId: dto.vehicleUseId ?? null,
      longitude: dto.longitude,
      latitude: dto.latitude,
      speed: dto.speed ?? '0',
      trackedAt: dto.trackedAt ? new Date(dto.trackedAt) : new Date()
    }))
    return saved
  }

  async listVehicleTracks(vehicleId: number, user: JwtUser): Promise<VehicleTrackEntity[]> {
    return this.vehicleTrackRepo.find({ where: { tenantId: user.tenantId, vehicleId }, order: { trackedAt: 'ASC' }, take: 500 })
  }

  private number(prefix: string): string {
    return `${prefix}${`${Date.now().toString(36)}${randomBytes(2).toString('hex')}`.toUpperCase()}`
  }

  /* ================================================================
   * 定时提醒：待办超时升级、任务/证书/合同到期提醒
   * ============================================================== */

  private readonly reminderSent = new Set<string>()

  /** 注册协同提醒调度任务 */
  onModuleInit(): void {
    this.scheduler.register({
      code: 'collab.reminder',
      name: '协同到期提醒与超时升级',
      intervalMinutes: 30,
      enabled: true,
      handler: async () => {
        const tenants = await this.tenantRepo.find()
        let sent = 0
        let escalated = 0
        for (const tenant of tenants) {
          const systemUser: JwtUser = {
            userId: 0, tenantId: tenant.id, username: 'system', realName: '系统',
            orgId: null, roles: [], permissions: [], isSuperAdmin: true, dataScopeLevel: 'ALL'
          }
          sent += await this.runTenantReminders(systemUser)
          escalated += (await this.escalateOverdue(systemUser)).escalated
        }
        return `协同提醒：推送 ${sent} 条，超时升级 ${escalated} 条`
      }
    })
  }

  /** 单租户提醒推送：任务截止、证书到期、合同到期 */
  private async runTenantReminders(user: JwtUser): Promise<number> {
    const items = await this.buildReminderItems(user)
    const reminders = collectReminderItems(items)
    const today = new Date().toISOString().slice(0, 10)
    let sent = 0
    for (const reminder of reminders) {
      const key = `${user.tenantId}:${reminder.type}:${reminder.targetId}:${today}`
      if (this.reminderSent.has(key)) continue
      this.reminderSent.add(key)
      const item = items.find((entry) => entry.type === reminder.type && entry.targetId === reminder.targetId)
      if (!item || !item.receiverId) continue
      try {
        await this.notifyService.create({
          title: reminder.title,
          content: reminder.dueDate
            ? `${reminder.title}（截止 ${reminder.dueDate}，${reminder.days >= 0 ? `剩余 ${reminder.days} 天` : `已逾期 ${Math.abs(reminder.days)} 天`}）`
            : reminder.title,
          channel: 'INMAIL',
          receiverId: item.receiverId,
          bizType: reminder.targetType,
          bizId: reminder.targetId
        }, user)
        sent += 1
      } catch {
        this.reminderSent.delete(key)
      }
    }
    return sent
  }

  /** 提醒来源：流程待办、项目任务、证书、合同 */
  private async buildReminderItems(user: JwtUser): Promise<Array<{
    type: string
    targetType: string
    targetId: number
    receiverId: number | null
    title: string
    dueDate?: string | null
    thresholdDays?: number
  }>> {
    const items: Array<{
      type: string
      targetType: string
      targetId: number
      receiverId: number | null
      title: string
      dueDate?: string | null
      thresholdDays?: number
    }> = []
    const flowTasks = await this.taskRepo.find({ where: { tenantId: user.tenantId, status: 'PENDING' }, take: 500 })
    for (const task of flowTasks) {
      if (!task.dueAt) continue
      items.push({
        type: 'FLOW_TASK',
        targetType: 'flow_task',
        targetId: task.id,
        receiverId: task.assigneeId ?? null,
        title: `待办 #${task.id} 即将超时`,
        dueDate: task.dueAt.toISOString().slice(0, 10),
        thresholdDays: 1
      })
    }
    const oaTasks = await this.oaTaskRepo.find({ where: { tenantId: user.tenantId }, take: 500 })
    for (const task of oaTasks) {
      if (task.status === 'DONE' || !task.dueDate) continue
      items.push({
        type: 'OA_TASK',
        targetType: 'oa_task',
        targetId: task.id,
        receiverId: task.assigneeId ?? null,
        title: `项目任务「${task.taskName}」即将到期`,
        dueDate: task.dueDate,
        thresholdDays: 3
      })
    }
    const certificates = await this.trainingRecordRepo.find({ where: { tenantId: user.tenantId }, take: 500 })
    for (const record of certificates) {
      if (!record.expireDate) continue
      items.push({
        type: 'CERTIFICATE',
        targetType: 'hr_training_record',
        targetId: record.id,
        receiverId: record.employeeId ?? null,
        title: `培训证书 ${record.certificateNo ?? ''} 即将到期`,
        dueDate: record.expireDate,
        thresholdDays: 30
      })
    }
    const records = await this.employeeRecordRepo.find({ where: { tenantId: user.tenantId }, take: 500 })
    for (const record of records) {
      if (!record.expiryDate) continue
      items.push({
        type: 'CONTRACT',
        targetType: 'hr_employee_record',
        targetId: record.id,
        receiverId: record.employeeId ?? null,
        title: `员工档案「${record.recordTitle}」即将到期`,
        dueDate: record.expiryDate,
        thresholdDays: 30
      })
    }
    return items
  }

  /* ================================================================
   * 项目管理增强：看板 / 甘特 / 里程碑 / 工时 / 项目风险
   * ============================================================== */

  /** 项目看板：任务按状态分列 */
  async projectBoard(projectId: number, user: JwtUser): Promise<{ project: ProjectEntity; columns: Array<{ status: string; count: number; tasks: Array<{ id: number; taskName: string; status: string; assigneeId?: number | null; dueDate?: string | null }> }> }> {
    const project = await this.projectRepo.findOne({ where: { id: projectId, tenantId: user.tenantId } })
    if (!project) throw new NotFoundException('项目不存在')
    const tasks = await this.oaTaskRepo.find({ where: { tenantId: user.tenantId, projectId }, order: { id: 'ASC' } })
    return { project, columns: buildKanban(tasks.map((item) => ({ id: item.id, taskName: item.taskName, status: item.status, assigneeId: item.assigneeId, dueDate: item.dueDate }))) }
  }

  /** 项目甘特：时间轴 + 里程碑 */
  async projectGantt(projectId: number, user: JwtUser): Promise<Record<string, unknown>> {
    const project = await this.projectRepo.findOne({ where: { id: projectId, tenantId: user.tenantId } })
    if (!project) throw new NotFoundException('项目不存在')
    const tasks = await this.oaTaskRepo.find({ where: { tenantId: user.tenantId, projectId }, order: { id: 'ASC' } })
    const milestones = await this.milestoneRepo.find({ where: { tenantId: user.tenantId, projectId }, order: { planDate: 'ASC' } })
    const gantt = buildGantt(
      tasks.map((item) => ({ id: item.id, taskName: item.taskName, status: item.status, startDate: item.startDate, dueDate: item.dueDate })),
      milestones.map((item) => ({ id: item.id, milestoneName: item.milestoneName, planDate: item.planDate, actualDate: item.actualDate, status: item.status })),
      { startDate: project.startDate, endDate: project.endDate }
    )
    return { project, ...gantt }
  }

  async listMilestones(query: QueryCollaborationDto & { projectId?: number }, user: JwtUser): Promise<PageResult<ProjectMilestoneEntity>> {
    const where: Record<string, unknown> = { tenantId: user.tenantId }
    if (query.projectId) where.projectId = query.projectId
    const [list, total] = await this.milestoneRepo.findAndCount({ where: where as never, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createMilestone(dto: CreateMilestoneDto, user: JwtUser): Promise<ProjectMilestoneEntity> {
    const project = await this.projectRepo.findOne({ where: { id: dto.projectId, tenantId: user.tenantId } })
    if (!project) throw new NotFoundException('项目不存在')
    const saved = await this.milestoneRepo.save(this.milestoneRepo.create({
      tenantId: user.tenantId,
      projectId: dto.projectId,
      milestoneName: dto.milestoneName,
      planDate: dto.planDate ?? null,
      ownerId: dto.ownerId ?? null,
      status: 'PLANNED',
      remark: dto.remark ?? null,
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'oa_project_milestone', bizId: saved.id, action: 'CREATE_MILESTONE', afterValue: saved }, user)
    return saved
  }

  async updateMilestone(id: number, dto: UpdateMilestoneDto, user: JwtUser): Promise<ProjectMilestoneEntity> {
    const entity = await this.milestoneRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('里程碑不存在')
    if (dto.status) {
      const judgement = evaluateMilestoneStatus(entity.status, dto.status)
      if (!judgement.ok) throw new BadRequestException(judgement.reason)
      entity.status = judgement.status
      if (judgement.status === 'DONE' && !entity.actualDate) entity.actualDate = new Date().toISOString().slice(0, 10)
    }
    if (dto.milestoneName !== undefined) entity.milestoneName = dto.milestoneName
    if (dto.planDate !== undefined) entity.planDate = dto.planDate
    if (dto.actualDate !== undefined) entity.actualDate = dto.actualDate
    if (dto.ownerId !== undefined) entity.ownerId = dto.ownerId
    if (dto.remark !== undefined) entity.remark = dto.remark
    const saved = await this.milestoneRepo.save(entity)
    await this.auditService.record({ bizType: 'oa_project_milestone', bizId: saved.id, action: 'UPDATE_MILESTONE', afterValue: saved }, user)
    return saved
  }

  async listWorklogs(query: QueryCollaborationDto & { taskId?: number }, user: JwtUser): Promise<PageResult<TaskWorklogEntity>> {
    const where: Record<string, unknown> = { tenantId: user.tenantId }
    if (query.taskId) where.taskId = query.taskId
    const [list, total] = await this.worklogRepo.findAndCount({ where: where as never, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 工时登记：校验单日累计不超过 24 小时 */
  async createWorklog(dto: CreateWorklogDto, user: JwtUser): Promise<TaskWorklogEntity> {
    const task = await this.oaTaskRepo.findOne({ where: { id: dto.taskId, tenantId: user.tenantId } })
    if (!task) throw new NotFoundException('任务不存在')
    const existing = await this.worklogRepo.find({ where: { tenantId: user.tenantId, taskId: dto.taskId } })
    const judgement = evaluateWorklog(existing.map((item) => ({ workDate: item.workDate, hours: item.hours })), dto.workDate, dto.hours)
    if (!judgement.ok) throw new BadRequestException(judgement.reason)
    const saved = await this.worklogRepo.save(this.worklogRepo.create({
      tenantId: user.tenantId,
      taskId: dto.taskId,
      userId: dto.userId ?? user.userId,
      workDate: dto.workDate,
      hours: dto.hours,
      content: dto.content
    }))
    await this.auditService.record({ bizType: 'oa_task_worklog', bizId: saved.id, action: 'CREATE_WORKLOG', afterValue: saved }, user)
    return saved
  }

  async removeWorklog(id: number, user: JwtUser): Promise<void> {
    const entity = await this.worklogRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('工时记录不存在')
    await this.worklogRepo.remove(entity)
  }

  async listProjectRisks(query: QueryCollaborationDto & { projectId?: number }, user: JwtUser): Promise<PageResult<ProjectRiskEntity>> {
    const where: Record<string, unknown> = { tenantId: user.tenantId }
    if (query.projectId) where.projectId = query.projectId
    const [list, total] = await this.riskRepo.findAndCount({ where: where as never, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createProjectRisk(dto: CreateProjectRiskDto, user: JwtUser): Promise<ProjectRiskEntity> {
    const project = await this.projectRepo.findOne({ where: { id: dto.projectId, tenantId: user.tenantId } })
    if (!project) throw new NotFoundException('项目不存在')
    const saved = await this.riskRepo.save(this.riskRepo.create({
      tenantId: user.tenantId,
      projectId: dto.projectId,
      riskTitle: dto.riskTitle,
      riskLevel: dto.riskLevel ?? 'MEDIUM',
      probability: dto.probability ?? 3,
      impact: dto.impact ?? 3,
      ownerId: dto.ownerId ?? null,
      mitigation: dto.mitigation ?? null,
      status: 'OPEN',
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'oa_project_risk', bizId: saved.id, action: 'CREATE_PROJECT_RISK', afterValue: saved }, user)
    return saved
  }

  async updateProjectRisk(id: number, dto: UpdateProjectRiskDto, user: JwtUser): Promise<ProjectRiskEntity> {
    const entity = await this.riskRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('项目风险不存在')
    if (dto.riskTitle !== undefined) entity.riskTitle = dto.riskTitle
    if (dto.riskLevel !== undefined) entity.riskLevel = dto.riskLevel
    if (dto.probability !== undefined) entity.probability = dto.probability
    if (dto.impact !== undefined) entity.impact = dto.impact
    if (dto.ownerId !== undefined) entity.ownerId = dto.ownerId
    if (dto.mitigation !== undefined) entity.mitigation = dto.mitigation
    if (dto.status !== undefined) entity.status = dto.status
    const saved = await this.riskRepo.save(entity)
    await this.auditService.record({ bizType: 'oa_project_risk', bizId: saved.id, action: 'UPDATE_PROJECT_RISK', afterValue: saved }, user)
    return saved
  }

  /* ================================================================
   * 招聘增强：管道阶段 / 面试反馈 / Offer 审批 / 人才库
   * ============================================================== */

  /** 招聘管道看板：候选人按阶段分组 */
  async recruitPipeline(query: QueryCollaborationDto, user: JwtUser): Promise<Array<{ stage: string; count: number; candidates: CandidateEntity[] }>> {
    const where: Record<string, unknown> = { tenantId: user.tenantId }
    if (query.status) where.stage = query.status
    const candidates = await this.candidateRepo.find({ where: where as never, order: { id: 'DESC' }, take: 1000 })
    const stages = ['APPLIED', 'SCREENING', 'INTERVIEW', 'ASSESSMENT', 'OFFER', 'HIRED', 'TALENT', 'REJECTED']
    const result = stages.map((stage) => ({ stage, count: 0, candidates: [] as CandidateEntity[] }))
    for (const candidate of candidates) {
      const column = result.find((item) => item.stage === candidate.stage)
      if (column) {
        column.candidates.push(candidate)
        column.count += 1
      }
    }
    return result
  }

  /** 候选人阶段流转 */
  async moveCandidateStage(id: number, dto: MoveCandidateStageDto, user: JwtUser): Promise<CandidateEntity> {
    const candidate = await this.candidateRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!candidate) throw new NotFoundException('候选人不存在')
    const judgement = evaluateCandidateStage(candidate.stage, dto.stage)
    if (!judgement.ok) throw new BadRequestException(judgement.reason)
    const before = candidate.stage
    candidate.stage = dto.stage
    const saved = await this.candidateRepo.save(candidate)
    await this.auditService.record({ bizType: 'hr_candidate', bizId: saved.id, action: 'MOVE_STAGE', beforeValue: { stage: before }, afterValue: { stage: dto.stage, remark: dto.remark ?? null } }, user)
    return saved
  }

  /** 人才库：入池 / 复用 / 淘汰 */
  async talentAction(id: number, dto: TalentActionDto, user: JwtUser): Promise<CandidateEntity> {
    const candidate = await this.candidateRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!candidate) throw new NotFoundException('候选人不存在')
    const judgement = evaluateTalentAction(candidate.stage, dto.action)
    if (!judgement.ok) throw new BadRequestException(judgement.reason)
    const before = candidate.stage
    candidate.stage = judgement.status
    const saved = await this.candidateRepo.save(candidate)
    await this.auditService.record({ bizType: 'hr_candidate', bizId: saved.id, action: 'TALENT_ACTION', beforeValue: { stage: before }, afterValue: { stage: judgement.status, remark: dto.remark ?? null } }, user)
    return saved
  }

  /** Offer 列表（供审批台使用） */
  async listOffers(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<HrOfferEntity>> {
    const where: Record<string, unknown> = { tenantId: user.tenantId }
    if (query.status) where.status = query.status
    const [list, total] = await this.offerRepo.findAndCount({ where: where as never, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** Offer 审批：通过 / 驳回 */
  async actOffer(id: number, dto: OfferActionDto, user: JwtUser): Promise<HrOfferEntity> {
    const offer = await this.offerRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!offer) throw new NotFoundException('Offer 不存在')
    assertRejectReason(dto.action, dto.comment)
    const judgement = evaluateOfferTransition(offer.status, dto.action)
    if (!judgement.ok) throw new BadRequestException(judgement.reason)
    offer.status = judgement.status
    offer.approvedBy = user.userId
    const saved = await this.offerRepo.save(offer)
    await this.auditService.record({ bizType: 'hr_offer', bizId: saved.id, action: `OFFER_${dto.action}`, afterValue: saved }, user)
    return saved
  }

  /* ================================================================
   * 车队调度
   * ============================================================== */

  /** 车辆调度：按时间窗挑选不冲突车辆（冲突可人工确认强制派车） */
  async dispatchVehicle(dto: DispatchVehicleDto, user: JwtUser): Promise<{ vehicleId: number | null; use: VehicleUseEntity | null; conflicted: Array<{ vehicleId: number; startTime: string; endTime: string }> }> {
    const vehicles = await this.vehicleRepo.find({ where: { tenantId: user.tenantId }, order: { id: 'ASC' } })
    const windows = await this.vehicleUseRepo.find({ where: { tenantId: user.tenantId }, order: { startTime: 'ASC' } })
    const result = selectVehicleDispatch(
      vehicles.map((item) => ({ id: item.id, plateNo: item.plateNo, status: item.status, driverId: item.driverId })),
      windows.map((item) => ({ vehicleId: item.vehicleId, startTime: item.startTime, endTime: item.endTime, status: item.status })),
      { startTime: dto.startTime, endTime: dto.endTime },
      { requireDriver: true }
    )
    const force = dto.forceConflict === 'YES'
    if (!result.ok && !force) {
      throw new BadRequestException(`${result.reason ?? '无可用车辆'}${result.conflicted.length ? `（冲突车辆 ${result.conflicted.map((item) => item.vehicleId).join(',')}）` : ''}`)
    }
    const vehicleId = result.vehicleId ?? result.conflicted[0]?.vehicleId ?? dto.vehicleId ?? null
    if (!vehicleId) throw new BadRequestException('没有可派出的车辆')
    const use = await this.vehicleUseRepo.save(this.vehicleUseRepo.create({
      tenantId: user.tenantId,
      vehicleId,
      applyUserId: dto.applyUserId,
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
      status: 'PENDING'
    }))
    await this.auditService.record({ bizType: 'hr_vehicle_use', bizId: use.id, action: 'DISPATCH_VEHICLE', afterValue: { vehicleId, forced: force, reason: dto.reason ?? null } }, user)
    return { vehicleId, use, conflicted: result.conflicted }
  }

  /* ================================================================
   * 绩效 360 反馈 / 培训签到与成绩
   * ============================================================== */

  async listPerformanceFeedbacks(reviewId: number, user: JwtUser): Promise<HrPerformanceFeedbackEntity[]> {
    const review = await this.performanceReviewRepo.findOne({ where: { id: reviewId, tenantId: user.tenantId } })
    if (!review) throw new NotFoundException('绩效评价不存在')
    return this.performanceFeedbackRepo.find({ where: { tenantId: user.tenantId, reviewId }, order: { id: 'ASC' } })
  }

  /** 360 评估反馈：提交后参与校准得分计算 */
  async createPerformanceFeedback(reviewId: number, dto: CreatePerformanceFeedbackDto, user: JwtUser): Promise<HrPerformanceFeedbackEntity> {
    const review = await this.performanceReviewRepo.findOne({ where: { id: reviewId, tenantId: user.tenantId } })
    if (!review) throw new NotFoundException('绩效评价不存在')
    const saved = await this.performanceFeedbackRepo.save(this.performanceFeedbackRepo.create({
      tenantId: user.tenantId,
      reviewId,
      evaluatorId: dto.evaluatorId,
      feedbackType: dto.feedbackType ?? 'PEER',
      score: dto.score,
      comment: dto.comment ?? null
    }))
    await this.auditService.record({ bizType: 'hr_performance_feedback', bizId: saved.id, action: 'CREATE_FEEDBACK', afterValue: saved }, user)
    return saved
  }

  /** 培训签到 */
  async signinTraining(trainingId: number, dto: TrainingSigninDto, user: JwtUser): Promise<HrTrainingRecordEntity> {
    const training = await this.trainingRepo.findOne({ where: { id: trainingId, tenantId: user.tenantId } })
    if (!training) throw new NotFoundException('培训课程不存在')
    const existing = await this.trainingRecordRepo.findOne({ where: { tenantId: user.tenantId, trainingId, employeeId: dto.employeeId } })
    if (existing) {
      existing.signinAt = new Date()
      return this.trainingRecordRepo.save(existing)
    }
    const saved = await this.trainingRecordRepo.save(this.trainingRecordRepo.create({
      tenantId: user.tenantId,
      trainingId,
      employeeId: dto.employeeId,
      examScore: 0,
      passed: 0,
      certificateNo: null,
      expireDate: null,
      signinAt: new Date()
    }))
    await this.auditService.record({ bizType: 'hr_training_record', bizId: saved.id, action: 'TRAINING_SIGNIN', afterValue: saved }, user)
    return saved
  }

  /** 培训成绩登记：通过后自动发证并设置有效期 */
  async scoreTraining(trainingId: number, dto: TrainingScoreDto, user: JwtUser): Promise<HrTrainingRecordEntity> {
    const training = await this.trainingRepo.findOne({ where: { id: trainingId, tenantId: user.tenantId } })
    if (!training) throw new NotFoundException('培训课程不存在')
    const result = trainingCertification(dto.examScore)
    const expireDate = dto.expireDate ?? new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)
    const existing = await this.trainingRecordRepo.findOne({ where: { tenantId: user.tenantId, trainingId, employeeId: dto.employeeId } })
    const entity = existing ?? this.trainingRecordRepo.create({ tenantId: user.tenantId, trainingId, employeeId: dto.employeeId })
    entity.examScore = dto.examScore
    entity.passed = result.passed ? 1 : 0
    entity.certificateNo = result.certificateNo ?? entity.certificateNo ?? null
    entity.expireDate = result.passed ? expireDate : entity.expireDate ?? null
    if (!entity.signinAt) entity.signinAt = new Date()
    const saved = await this.trainingRecordRepo.save(entity)
    await this.auditService.record({ bizType: 'hr_training_record', bizId: saved.id, action: 'TRAINING_SCORE', afterValue: saved }, user)
    return saved
  }

  /* ================================================================
   * 到期提醒归集（任务 / 证书 / 合同 / 会议）
   * ============================================================== */

  /** 汇总临期与逾期提醒，供工作台与移动端提醒中心使用 */
  async collectReminders(query: QueryReminderDto, user: JwtUser): Promise<Array<Record<string, unknown>>> {
    const items = await this.buildReminderItems(user)
    const thresholdDays = query.thresholdDays
    const inputs = items.map((item) => ({
      type: item.type,
      targetType: item.targetType,
      targetId: item.targetId,
      title: item.title,
      dueDate: item.dueDate,
      thresholdDays: thresholdDays ?? item.thresholdDays
    }))
    const reminders = collectReminderItems(inputs)
    const filtered = query.type ? reminders.filter((item) => item.type === query.type) : reminders
    return filtered as unknown as Array<Record<string, unknown>>
  }

  /* ================================================================
   * 人事审批与核算增强（考勤排班 / 请假加班审批 / 社保公积金 /
   * 工资条 / 绩效 KPI 与校准）
   * ============================================================== */

  /** 员工排班列表 */
  async listShiftSchedules(query: QueryCollaborationDto, user: JwtUser, employeeId?: number): Promise<PageResult<HrShiftScheduleEntity>> {
    const where = { tenantId: user.tenantId, ...(employeeId ? { employeeId } : {}) }
    const [list, total] = await this.shiftScheduleRepo.findAndCount({
      where,
      order: { workDate: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 排班登记：同一员工同一天同一班次不重复登记 */
  async createShiftSchedule(dto: CreateShiftScheduleDto, user: JwtUser): Promise<HrShiftScheduleEntity> {
    const shift = await this.shiftRepo.findOne({ where: { id: dto.shiftId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!shift) throw new NotFoundException('班次不存在')
    const duplicated = await this.shiftScheduleRepo.findOne({
      where: { tenantId: user.tenantId, employeeId: dto.employeeId, workDate: dto.workDate, shiftId: dto.shiftId }
    })
    if (duplicated) throw new BadRequestException('该员工当日已登记相同班次')
    const saved = await this.shiftScheduleRepo.save(this.shiftScheduleRepo.create({
      tenantId: user.tenantId,
      employeeId: dto.employeeId,
      workDate: dto.workDate,
      shiftId: shift.id,
      shiftCode: shift.shiftCode,
      shiftName: shift.shiftName,
      status: 'PLANNED',
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'hr_shift_schedule', bizId: saved.id, action: 'CREATE_SHIFT_SCHEDULE', afterValue: saved }, user)
    return saved
  }

  /** 请假审批：通过或驳回均记录审批人与意见 */
  async approveLeave(id: number, dto: HrApprovalDto, user: JwtUser): Promise<LeaveEntity> {
    const leave = await this.leaveRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!leave) throw new NotFoundException('请假申请不存在')
    assertRejectReason(dto.decision, dto.comment)
    const judgement = evaluateHrApproval(leave.status, dto.decision)
    if (!judgement.ok) throw new BadRequestException(judgement.reason)
    leave.status = dto.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED'
    leave.approverId = user.userId
    leave.approvedAt = new Date()
    leave.approveComment = dto.comment ?? null
    const saved = await this.leaveRepo.save(leave)
    await this.auditService.record({ bizType: 'hr_leave', bizId: id, action: `LEAVE_${dto.decision}`, afterValue: saved }, user)
    return saved
  }

  /** 加班审批：通过时按加班时长登记调休时长 */
  async approveOvertime(id: number, dto: HrApprovalDto, user: JwtUser): Promise<OvertimeEntity> {
    const overtime = await this.overtimeRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!overtime) throw new NotFoundException('加班申请不存在')
    assertRejectReason(dto.decision, dto.comment)
    const judgement = evaluateHrApproval(overtime.status, dto.decision)
    if (!judgement.ok) throw new BadRequestException(judgement.reason)
    overtime.status = dto.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED'
    overtime.approverId = user.userId
    overtime.approvedAt = new Date()
    overtime.approveComment = dto.comment ?? null
    if (dto.decision === 'APPROVE') {
      const hours = Number(overtime.hours ?? 0)
      overtime.compensateHours = String(Math.max(0, hours))
    }
    const saved = await this.overtimeRepo.save(overtime)
    await this.auditService.record({ bizType: 'hr_overtime', bizId: id, action: `OVERTIME_${dto.decision}`, afterValue: saved }, user)
    return saved
  }

  /** 生成社保公积金明细（按薪资单缴费基数分摊各险种） */
  async generateSocialInsurance(dto: GenerateSocialInsuranceDto, user: JwtUser): Promise<HrSocialInsuranceEntity[]> {
    const salary = await this.salaryRepo.findOne({ where: { id: dto.salaryId, tenantId: user.tenantId } })
    if (!salary) throw new NotFoundException('薪资单不存在')
    const baseAmount = dto.baseAmount !== undefined ? Number(dto.baseAmount) : Number(salary.grossAmount ?? 0)
    const breakdown = socialInsuranceBreakdown(baseAmount)
    await this.socialInsuranceRepo.delete({ tenantId: user.tenantId, salaryId: salary.id })
    const rows = await this.socialInsuranceRepo.save(breakdown.items.map((item) => this.socialInsuranceRepo.create({
      tenantId: user.tenantId,
      salaryId: salary.id,
      employeeId: salary.employeeId,
      period: salary.period,
      itemCode: item.itemCode,
      itemName: item.itemName,
      baseAmount: String(item.baseAmount),
      companyRate: String(item.companyRate),
      personalRate: String(item.personalRate),
      companyAmount: String(item.companyAmount),
      personalAmount: String(item.personalAmount)
    })))
    await this.auditService.record({
      bizType: 'hr_social_insurance',
      bizId: salary.id,
      action: 'GENERATE_SOCIAL_INSURANCE',
      afterValue: { companyTotal: breakdown.companyTotal, personalTotal: breakdown.personalTotal, count: rows.length }
    }, user)
    return rows
  }

  /** 社保公积金明细列表 */
  async listSocialInsurance(user: JwtUser, salaryId?: number): Promise<HrSocialInsuranceEntity[]> {
    const where = { tenantId: user.tenantId, ...(salaryId ? { salaryId } : {}) }
    return this.socialInsuranceRepo.find({ where, order: { id: 'ASC' } })
  }

  /** 工资条列表：无明细查看权限时对金额脱敏 */
  async listPayslips(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<Record<string, unknown>>> {
    const where = { tenantId: user.tenantId, ...(query.period ? { period: query.period } : {}) }
    const [list, total] = await this.salaryRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    const canView = user.isSuperAdmin === true || (user.permissions ?? []).includes('hr:payroll:detail')
    const details = await this.payrollDetailRepo.find({ where: { tenantId: user.tenantId } })
    const detailMap = new Map(details.map((item) => [item.salaryId, item]))
    const rows = list.map((item) => {
      const detail = detailMap.get(item.id)
      const row: Record<string, unknown> = {
        ...item,
        payslipNo: item.payslipNo ?? detail?.payslipNo ?? null,
        social: detail?.social ?? '0',
        tax: detail?.tax ?? '0'
      }
      if (canView) return row
      row.grossAmount = maskSalaryAmount(item.grossAmount ?? '0', false)
      row.netAmount = maskSalaryAmount(item.netAmount ?? '0', false)
      row.social = maskSalaryAmount(detail?.social ?? '0', false)
      row.tax = maskSalaryAmount(detail?.tax ?? '0', false)
      return row
    })
    return buildPageResult(rows, total, query.page, query.pageSize)
  }

  /** KPI 指标库列表 */
  async listPerformanceKpis(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<HrPerformanceKpiEntity>> {
    const [list, total] = await this.performanceKpiRepo.findAndCount({
      where: { tenantId: user.tenantId },
      order: { id: 'ASC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 新增 KPI 指标 */
  async createPerformanceKpi(dto: CreatePerformanceKpiDto, user: JwtUser): Promise<HrPerformanceKpiEntity> {
    const duplicated = await this.performanceKpiRepo.findOne({ where: { tenantId: user.tenantId, kpiCode: dto.kpiCode } })
    if (duplicated) throw new BadRequestException('KPI 编码已存在')
    const saved = await this.performanceKpiRepo.save(this.performanceKpiRepo.create({
      tenantId: user.tenantId,
      kpiCode: dto.kpiCode,
      kpiName: dto.kpiName,
      category: dto.category ?? 'GENERAL',
      weight: dto.weight ?? '0',
      targetValue: dto.targetValue ?? '0',
      unit: dto.unit ?? '',
      description: dto.description ?? null,
      status: 'ENABLED'
    }))
    await this.auditService.record({ bizType: 'hr_performance_kpi', bizId: saved.id, action: 'CREATE_KPI', afterValue: saved }, user)
    return saved
  }

  /** 绩效校准会议：按强制分布切分该期绩效分并留痕 */
  async createCalibration(dto: CreateCalibrationDto, user: JwtUser): Promise<HrPerformanceCalibrationEntity> {
    const performances = await this.performanceRepo.find({ where: { tenantId: user.tenantId, period: dto.period } })
    const distribution = calibrationDistribution(performances.map((item) => Number(item.score ?? 0)))
    const saved = await this.calibrationRepo.save(this.calibrationRepo.create({
      tenantId: user.tenantId,
      period: dto.period,
      calibrationDate: dto.calibrationDate,
      participantCount: performances.length,
      distribution: JSON.stringify(distribution),
      conclusion: dto.conclusion ?? null,
      status: 'DRAFT',
      createdBy: user.userId
    }))
    await this.auditService.record({
      bizType: 'hr_performance_calibration',
      bizId: saved.id,
      action: 'CREATE_CALIBRATION',
      afterValue: { period: dto.period, participantCount: performances.length, distribution }
    }, user)
    return saved
  }

  /** 校准会议记录列表 */
  async listCalibrations(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<HrPerformanceCalibrationEntity>> {
    const [list, total] = await this.calibrationRepo.findAndCount({
      where: { tenantId: user.tenantId },
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 绩效综合重算：合并 KPI、360 反馈与校准分 */
  async recalculatePerformance(reviewId: number, user: JwtUser): Promise<HrPerformanceReviewEntity> {
    const review = await this.performanceReviewRepo.findOne({ where: { id: reviewId, tenantId: user.tenantId } })
    if (!review) throw new NotFoundException('绩效记录不存在')
    const feedbacks = await this.performanceFeedbackRepo.find({ where: { tenantId: user.tenantId, reviewId } })
    const feedbackScore = feedbacks.length
      ? feedbacks.reduce((sum, item) => sum + Number(item.score ?? 0), 0) / feedbacks.length
      : null
    const composite = performanceCompositeScore({
      kpiScore: Number(review.kpiScore ?? 0),
      feedbackScore,
      calibration: review.calibration === null || review.calibration === undefined ? null : Number(review.calibration)
    })
    review.finalScore = String(composite.score)
    review.level = composite.level
    const saved = await this.performanceReviewRepo.save(review)
    await this.auditService.record({
      bizType: 'hr_performance_review',
      bizId: reviewId,
      action: 'RECALCULATE_PERFORMANCE',
      afterValue: { finalScore: composite.score, level: composite.level, feedbackCount: feedbacks.length }
    }, user)
    return saved
  }

  /* ================================================================
   * 行政资产盘点与维修台账 / 车队审批、油耗与里程
   * ============================================================== */

  /** 新建资产盘点单 */
  async createStocktake(dto: CreateAssetStocktakeDto, user: JwtUser): Promise<HrAssetStocktakeEntity> {
    const saved = await this.stocktakeRepo.save(this.stocktakeRepo.create({
      tenantId: user.tenantId,
      stocktakeNo: this.number('ST'),
      stocktakeDate: dto.stocktakeDate,
      status: 'DRAFT',
      totalCount: 0,
      diffCount: 0,
      remark: dto.remark ?? null,
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'hr_asset_stocktake', bizId: saved.id, action: 'CREATE_STOCKTAKE', afterValue: saved }, user)
    return saved
  }

  /** 资产盘点单列表 */
  async listStocktakes(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<HrAssetStocktakeEntity>> {
    const [list, total] = await this.stocktakeRepo.findAndCount({
      where: { tenantId: user.tenantId },
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 提交盘点明细：账实比对并登记差异 */
  async submitStocktake(
    id: number,
    dto: SubmitStocktakeDto,
    user: JwtUser
  ): Promise<{ stocktake: HrAssetStocktakeEntity; items: HrAssetStocktakeItemEntity[] }> {
    const stocktake = await this.stocktakeRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!stocktake) throw new NotFoundException('盘点单不存在')
    if (stocktake.status !== 'DRAFT') throw new BadRequestException(`盘点单当前状态 ${stocktake.status} 不允许提交盘点结果`)
    const assets = await this.adminAssetRepo.find({ where: { tenantId: user.tenantId } })
    const book = assets.map((item) => ({ assetId: item.id, status: item.status, holderId: item.holderId }))
    const actual = dto.items.map((item) => ({
      assetId: item.assetId,
      status: item.actualStatus,
      holderId: item.actualHolderId ?? null
    }))
    const diffs = assetStocktakeDiff(book, actual)
    await this.stocktakeItemRepo.delete({ tenantId: user.tenantId, stocktakeId: id })
    const items = await this.stocktakeItemRepo.save(diffs.map((diff) => this.stocktakeItemRepo.create({
      tenantId: user.tenantId,
      stocktakeId: id,
      assetId: diff.assetId,
      bookStatus: diff.bookStatus,
      actualStatus: diff.actualStatus,
      bookHolderId: diff.bookHolderId,
      actualHolderId: diff.actualHolderId,
      difference: diff.difference,
      remark: diff.remark
    })))
    stocktake.totalCount = book.length
    stocktake.diffCount = diffs.filter((item) => item.difference !== 'NORMAL').length
    stocktake.status = 'FINISHED'
    const saved = await this.stocktakeRepo.save(stocktake)
    await this.auditService.record({
      bizType: 'hr_asset_stocktake',
      bizId: id,
      action: 'SUBMIT_STOCKTAKE',
      afterValue: { totalCount: saved.totalCount, diffCount: saved.diffCount }
    }, user)
    return { stocktake: saved, items }
  }

  /** 维修台账登记：资产转入维修状态 */
  async createAssetRepair(dto: CreateAssetRepairDto, user: JwtUser): Promise<HrAssetRepairEntity> {
    const asset = await this.adminAssetRepo.findOne({ where: { id: dto.assetId, tenantId: user.tenantId } })
    if (!asset) throw new NotFoundException('行政资产不存在')
    const saved = await this.assetRepairRepo.save(this.assetRepairRepo.create({
      tenantId: user.tenantId,
      assetId: dto.assetId,
      repairType: dto.repairType ?? 'MAINTENANCE',
      repairReason: dto.repairReason,
      vendor: dto.vendor ?? null,
      amount: dto.amount ?? '0',
      repairDate: dto.repairDate,
      finishedAt: null,
      handlerId: user.userId,
      status: 'REPAIRING',
      createdBy: user.userId
    }))
    asset.status = 'REPAIRING'
    await this.adminAssetRepo.save(asset)
    await this.auditService.record({ bizType: 'hr_asset_repair', bizId: saved.id, action: 'CREATE_ASSET_REPAIR', afterValue: saved }, user)
    return saved
  }

  /** 维修台账列表 */
  async listAssetRepairs(query: QueryCollaborationDto, user: JwtUser): Promise<PageResult<HrAssetRepairEntity>> {
    const [list, total] = await this.assetRepairRepo.findAndCount({
      where: { tenantId: user.tenantId },
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 维修完工：登记维修金额与供应商，资产恢复闲置 */
  async finishAssetRepair(id: number, dto: FinishAssetRepairDto, user: JwtUser): Promise<HrAssetRepairEntity> {
    const repair = await this.assetRepairRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!repair) throw new NotFoundException('维修记录不存在')
    if (repair.status === 'FINISHED') throw new BadRequestException('该维修记录已完工')
    repair.status = 'FINISHED'
    repair.finishedAt = new Date()
    repair.handlerId = user.userId
    if (dto.amount !== undefined) repair.amount = dto.amount
    if (dto.vendor !== undefined) repair.vendor = dto.vendor
    const saved = await this.assetRepairRepo.save(repair)
    const asset = await this.adminAssetRepo.findOne({ where: { id: repair.assetId, tenantId: user.tenantId } })
    if (asset) {
      asset.status = 'IDLE'
      await this.adminAssetRepo.save(asset)
    }
    await this.auditService.record({ bizType: 'hr_asset_repair', bizId: id, action: 'FINISH_ASSET_REPAIR', afterValue: saved }, user)
    return saved
  }

  /** 用车申请审批：审批通过时复核车辆时段冲突 */
  async approveVehicleUse(id: number, dto: HrApprovalDto, user: JwtUser): Promise<VehicleUseEntity> {
    const use = await this.vehicleUseRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!use) throw new NotFoundException('用车申请不存在')
    assertRejectReason(dto.decision, dto.comment)
    const judgement = evaluateHrApproval(use.status, dto.decision)
    if (!judgement.ok) throw new BadRequestException(judgement.reason)
    if (dto.decision === 'APPROVE') {
      const others = await this.vehicleUseRepo.find({ where: { tenantId: user.tenantId } })
      const candidates = others.filter((item) => item.id !== use.id && ['PENDING', 'APPROVED'].includes(item.status))
      const result = detectVehicleConflict(candidates, {
        vehicleId: use.vehicleId,
        applyUserId: use.applyUserId,
        startTime: use.startTime,
        endTime: use.endTime
      })
      if (result.conflict) {
        const reason = result.types.includes('SAME_VEHICLE') ? '该车辆已被占用' : '申请人已有用车安排'
        throw new BadRequestException(`车辆时段冲突：${reason}`)
      }
      use.status = 'APPROVED'
      const vehicle = await this.vehicleRepo.findOne({ where: { id: use.vehicleId, tenantId: user.tenantId } })
      if (vehicle) {
        vehicle.status = 'IN_USE'
        await this.vehicleRepo.save(vehicle)
      }
    } else {
      use.status = 'REJECTED'
    }
    use.approverId = user.userId
    use.approvedAt = new Date()
    use.approveComment = dto.comment ?? null
    const saved = await this.vehicleUseRepo.save(use)
    await this.auditService.record({ bizType: 'hr_vehicle_use', bizId: id, action: `VEHICLE_USE_${dto.decision}`, afterValue: saved }, user)
    return saved
  }

  /** 车队费用审批 */
  async approveVehicleExpense(id: number, dto: HrApprovalDto, user: JwtUser): Promise<VehicleExpenseEntity> {
    const expense = await this.vehicleExpenseRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!expense) throw new NotFoundException('车队费用不存在')
    assertRejectReason(dto.decision, dto.comment)
    const judgement = evaluateHrApproval(expense.status, dto.decision)
    if (!judgement.ok) throw new BadRequestException(judgement.reason)
    expense.status = dto.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED'
    expense.approverId = user.userId
    expense.approvedAt = new Date()
    expense.approveComment = dto.comment ?? null
    const saved = await this.vehicleExpenseRepo.save(expense)
    await this.auditService.record({ bizType: 'hr_vehicle_expense', bizId: id, action: `VEHICLE_EXPENSE_${dto.decision}`, afterValue: saved }, user)
    return saved
  }

  /** 回填用车里程与事由 */
  async updateVehicleUse(id: number, dto: UpdateVehicleUseDto, user: JwtUser): Promise<VehicleUseEntity> {
    const use = await this.vehicleUseRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!use) throw new NotFoundException('用车申请不存在')
    if (dto.mileage !== undefined) use.mileage = dto.mileage
    if (dto.reason !== undefined) use.reason = dto.reason
    const saved = await this.vehicleUseRepo.save(use)
    await this.auditService.record({ bizType: 'hr_vehicle_use', bizId: id, action: 'UPDATE_VEHICLE_USE', afterValue: saved }, user)
    return saved
  }

  /** 车辆油耗分析：按车辆汇总加油量、里程与百公里油耗 */
  async vehicleFuelStats(user: JwtUser): Promise<Array<Record<string, unknown>>> {
    const vehicles = await this.vehicleRepo.find({ where: { tenantId: user.tenantId } })
    const expenses = await this.vehicleExpenseRepo.find({ where: { tenantId: user.tenantId, status: 'APPROVED' } })
    const uses = await this.vehicleUseRepo.find({ where: { tenantId: user.tenantId, status: 'APPROVED' } })
    return vehicles.map((vehicle) => {
      const litres = expenses
        .filter((item) => item.vehicleId === vehicle.id)
        .reduce((sum, item) => sum + Number(item.fuelLitres ?? 0), 0)
      const mileage = uses
        .filter((item) => item.vehicleId === vehicle.id)
        .reduce((sum, item) => sum + Number(item.mileage ?? 0), 0)
      const fuel = vehicleFuelConsumption(litres, mileage)
      return {
        vehicleId: vehicle.id,
        plateNo: vehicle.plateNo,
        vehicleName: vehicle.vehicleName,
        litres: Math.round(litres * 100) / 100,
        mileage: Math.round(mileage * 100) / 100,
        per100km: fuel.per100km,
        warning: fuel.warning
      }
    })
  }
}
