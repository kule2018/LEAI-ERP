import { randomBytes } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import type { JwtUser } from '../../common/contracts'
import { scopeWhere } from '../../common/data-scope-context'
import {
  buildWipBoard, computeCapacityLoad, computeProductionMetrics, computeStopLineImpact, detectScheduleConflicts,
  diffBomVersions, evaluateOverIssue, evaluateQcItems, parseScanCode, rankMrpDemands, splitWorkOrder,
  canTransitionEquipment, type BomItemSnapshot
} from '../../common/manufacturing-extension-engine'
import { explodeBom, computeNetDemand } from '../../common/mrp-engine'
import {
  cascadeAfterMove, computeGanttRows, matchChangeoverMinutes, toTime,
  type GanttTaskRow, type ScheduleTaskView
} from '../../common/scheduling-changeover-rules'
import { AuditService } from '../audit/audit.service'
import { StockBalanceEntity } from '../inventory/entities/inventory.entities'
import { PurchaseOrderLineEntity } from '../purchase/entities/purchase.entities'
import { SaleOrderLineEntity } from '../sales/entities/sales.entities'
import {
  BomEntity, BomItemEntity, EquipmentEntity, MrpRunEntity, MrpSuggestEntity, OperationEntity, PlanTaskEntity,
  ProductionExceptionEntity, QcEntity, WorkCenterEntity, WorkOrderEntity, WorkOrderIssueEntity,
  WorkOrderReportEntity
} from './entities/manufacturing.entities'
import {
  MesBomChangeEntity, MesChangeoverLogEntity, MesChangeoverRuleEntity, MesEquipmentFaultEntity,
  MesEquipmentMaintenanceEntity, MesOverIssueApprovalEntity, MesPlanTaskLockEntity, MesQcItemEntity,
  MesWorkOrderChangeEntity
} from './entities/manufacturing-extension.entity'
import {
  ApproveBomChangeDto, ApproveWorkOrderChangeDto, BomVersionDiffDto, CreateBomChangeDto, CreateChangeoverRuleDto,
  CreateEquipmentFaultDto, CreateMaintenanceDto, CreateQcItemDto, CreateWorkOrderChangeDto, ExecuteMaintenanceDto,
  LockPlanTaskDto, MrpSimulateDto, OverIssueApproveDto, ProductionAnalysisQueryDto, QueryChangeoverLogDto,
  QueryManufacturingExtensionDto, RepairEquipmentFaultDto, ReschedulePlanTaskDto, ScanReportDto, ScheduleQueryDto,
  SplitWorkOrderDto, StopLineDto
} from './manufacturing-extension.dto'

@Injectable()
export class ManufacturingExtensionService {
  constructor(
    @InjectRepository(BomEntity) private readonly bomRepo: Repository<BomEntity>,
    @InjectRepository(BomItemEntity) private readonly bomItemRepo: Repository<BomItemEntity>,
    @InjectRepository(OperationEntity) private readonly operationRepo: Repository<OperationEntity>,
    @InjectRepository(WorkCenterEntity) private readonly centerRepo: Repository<WorkCenterEntity>,
    @InjectRepository(PlanTaskEntity) private readonly planTaskRepo: Repository<PlanTaskEntity>,
    @InjectRepository(MrpRunEntity) private readonly mrpRunRepo: Repository<MrpRunEntity>,
    @InjectRepository(MrpSuggestEntity) private readonly mrpSuggestRepo: Repository<MrpSuggestEntity>,
    @InjectRepository(WorkOrderEntity) private readonly workOrderRepo: Repository<WorkOrderEntity>,
    @InjectRepository(WorkOrderIssueEntity) private readonly issueRepo: Repository<WorkOrderIssueEntity>,
    @InjectRepository(WorkOrderReportEntity) private readonly reportRepo: Repository<WorkOrderReportEntity>,
    @InjectRepository(QcEntity) private readonly qcRepo: Repository<QcEntity>,
    @InjectRepository(EquipmentEntity) private readonly equipmentRepo: Repository<EquipmentEntity>,
    @InjectRepository(ProductionExceptionEntity) private readonly exceptionRepo: Repository<ProductionExceptionEntity>,
    @InjectRepository(SaleOrderLineEntity) private readonly saleLineRepo: Repository<SaleOrderLineEntity>,
    @InjectRepository(PurchaseOrderLineEntity) private readonly purchaseLineRepo: Repository<PurchaseOrderLineEntity>,
    @InjectRepository(MesBomChangeEntity) private readonly bomChangeRepo: Repository<MesBomChangeEntity>,
    @InjectRepository(MesWorkOrderChangeEntity) private readonly workOrderChangeRepo: Repository<MesWorkOrderChangeEntity>,
    @InjectRepository(MesQcItemEntity) private readonly qcItemRepo: Repository<MesQcItemEntity>,
    @InjectRepository(MesEquipmentFaultEntity) private readonly faultRepo: Repository<MesEquipmentFaultEntity>,
    @InjectRepository(MesEquipmentMaintenanceEntity) private readonly maintenanceRepo: Repository<MesEquipmentMaintenanceEntity>,
    @InjectRepository(MesPlanTaskLockEntity) private readonly planLockRepo: Repository<MesPlanTaskLockEntity>,
    @InjectRepository(MesOverIssueApprovalEntity) private readonly overIssueRepo: Repository<MesOverIssueApprovalEntity>,
    @InjectRepository(MesChangeoverRuleEntity) private readonly changeoverRuleRepo: Repository<MesChangeoverRuleEntity>,
    @InjectRepository(MesChangeoverLogEntity) private readonly changeoverLogRepo: Repository<MesChangeoverLogEntity>,
    @InjectRepository(StockBalanceEntity) private readonly balanceRepo: Repository<StockBalanceEntity>,
    private readonly auditService: AuditService
  ) {}

  /* ============ BOM 版本对比与变更审批 ============ */

  /** BOM 版本对比：返回子件新增/删除/变更明细 */
  async bomVersionDiff(dto: BomVersionDiffDto, user: JwtUser): Promise<Record<string, unknown>> {
    const [base, target] = await Promise.all([
      this.bomRepo.findOne({ where: { id: dto.baseId, tenantId: user.tenantId, isDeleted: 0 } }),
      this.bomRepo.findOne({ where: { id: dto.targetId, tenantId: user.tenantId, isDeleted: 0 } })
    ])
    if (!base) throw new NotFoundException('基准 BOM 不存在')
    if (!target) throw new NotFoundException('目标 BOM 不存在')
    const [baseItems, targetItems] = await Promise.all([
      this.bomItemRepo.find({ where: { tenantId: user.tenantId, bomId: base.id } }),
      this.bomItemRepo.find({ where: { tenantId: user.tenantId, bomId: target.id } })
    ])
    const snapshot = (items: BomItemEntity[]): BomItemSnapshot[] => items.map((item) => ({
      materialId: item.materialId,
      qty: this.num(item.qty),
      lossRate: this.num(item.lossRate),
      substituteMaterialId: item.substituteMaterialId
    }))
    const diff = diffBomVersions(snapshot(baseItems), snapshot(targetItems))
    await this.auditService.record({ bizType: 'bom', bizId: target.id, action: 'DIFF_BOM_VERSION', afterValue: { baseId: base.id, targetId: target.id, changedCount: diff.changedCount } }, user)
    return { baseBom: base, targetBom: target, ...diff }
  }

  /** BOM 变更申请：保存版本差异与变更原因，等待审批 */
  async createBomChange(dto: CreateBomChangeDto, user: JwtUser): Promise<MesBomChangeEntity> {
    const bom = await this.bomRepo.findOne({ where: { id: dto.bomId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!bom) throw new NotFoundException('BOM 不存在')
    const target = await this.bomRepo.findOne({ where: { tenantId: user.tenantId, productId: bom.productId, version: dto.toVersion, isDeleted: 0 } })
    if (!target) throw new NotFoundException('目标版本 BOM 不存在')
    if (target.id === bom.id) throw new BadRequestException('目标版本与当前版本相同')
    const baseItems = await this.bomItemRepo.find({ where: { tenantId: user.tenantId, bomId: bom.id } })
    const targetItems = await this.bomItemRepo.find({ where: { tenantId: user.tenantId, bomId: target.id } })
    const snapshot = (items: BomItemEntity[]): BomItemSnapshot[] => items.map((item) => ({
      materialId: item.materialId,
      qty: this.num(item.qty),
      lossRate: this.num(item.lossRate),
      substituteMaterialId: item.substituteMaterialId
    }))
    const diff = diffBomVersions(snapshot(baseItems), snapshot(targetItems))
    const entity = await this.bomChangeRepo.save(this.bomChangeRepo.create({
      tenantId: user.tenantId,
      bomId: bom.id,
      fromVersion: bom.version,
      toVersion: target.version,
      changeType: dto.changeType ?? 'UPDATE',
      diff: diff as unknown as Record<string, unknown>,
      changeReason: dto.changeReason ?? null,
      status: 'PENDING',
      submittedBy: user.userId
    }))
    await this.auditService.record({ bizType: 'mes_bom_change', bizId: entity.id, action: 'CREATE_BOM_CHANGE', afterValue: entity }, user)
    return entity
  }

  async listBomChanges(query: QueryManufacturingExtensionDto, user: JwtUser): Promise<MesBomChangeEntity[]> {
    const where = scopeWhere<MesBomChangeEntity>({ tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }, user, { ownerField: 'submittedBy' })
    return this.bomChangeRepo.find({ where, order: { id: 'DESC' }, take: 200 })
  }

  /** BOM 变更审批：通过后启用目标版本并停用旧版本 */
  async approveBomChange(id: number, dto: ApproveBomChangeDto, user: JwtUser): Promise<MesBomChangeEntity> {
    const entity = await this.bomChangeRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('BOM 变更单不存在')
    if (entity.status !== 'PENDING') throw new BadRequestException('该变更单已处理')
    entity.status = dto.approve ? 'APPROVED' : 'REJECTED'
    entity.approvedBy = user.userId
    entity.approvedAt = new Date()
    entity.approveComment = dto.comment ?? null
    if (dto.approve) {
      const target = await this.bomRepo.findOne({ where: { tenantId: user.tenantId, productId: (await this.bomRepo.findOne({ where: { id: entity.bomId, tenantId: user.tenantId } }))?.productId, version: entity.toVersion, isDeleted: 0 } })
      if (target) {
        const olds = await this.bomRepo.find({ where: { tenantId: user.tenantId, productId: target.productId, isActive: 1 } })
        for (const old of olds) {
          old.isActive = 0
          await this.bomRepo.save(old)
        }
        target.isActive = 1
        target.status = 'APPROVED'
        await this.bomRepo.save(target)
      }
    }
    const saved = await this.bomChangeRepo.save(entity)
    await this.auditService.record({ bizType: 'mes_bom_change', bizId: id, action: dto.approve ? 'APPROVE_BOM_CHANGE' : 'REJECT_BOM_CHANGE', afterValue: saved }, user)
    return saved
  }

  /* ============ 工单变更与拆分 ============ */

  /** 工单变更申请：变更未审批前不修改工单主档 */
  async createWorkOrderChange(workOrderId: number, dto: CreateWorkOrderChangeDto, user: JwtUser): Promise<MesWorkOrderChangeEntity> {
    const order = await this.workOrderRepo.findOne({ where: { id: workOrderId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!order) throw new NotFoundException('工单不存在')
    const version = await this.workOrderChangeRepo.count({ where: { tenantId: user.tenantId, workOrderId } })
    const entity = await this.workOrderChangeRepo.save(this.workOrderChangeRepo.create({
      tenantId: user.tenantId,
      workOrderId,
      changeVersion: version + 1,
      changeType: dto.changeType,
      beforeValue: { qty: order.qty, planStart: order.planStart, planEnd: order.planEnd, routingId: order.routingId, status: order.status },
      afterValue: {
        qty: dto.qty ?? order.qty,
        planStart: dto.planStart ?? order.planStart,
        planEnd: dto.planEnd ?? order.planEnd,
        routingId: dto.routingId ?? order.routingId,
        status: dto.changeType === 'CANCEL' ? 'CANCELLED' : order.status
      },
      changeReason: dto.changeReason ?? null,
      status: 'PENDING',
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'mes_work_order_change', bizId: entity.id, action: 'CREATE_WORK_ORDER_CHANGE', afterValue: entity }, user)
    return entity
  }

  async listWorkOrderChanges(workOrderId: number, user: JwtUser): Promise<MesWorkOrderChangeEntity[]> {
    return this.workOrderChangeRepo.find({ where: scopeWhere<MesWorkOrderChangeEntity>({ tenantId: user.tenantId, workOrderId }, user), order: { id: 'DESC' } })
  }

  /** 工单变更审批：通过后把变更写回工单并累加变更版本 */
  async approveWorkOrderChange(id: number, dto: ApproveWorkOrderChangeDto, user: JwtUser): Promise<MesWorkOrderChangeEntity> {
    const entity = await this.workOrderChangeRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('工单变更单不存在')
    if (entity.status !== 'PENDING') throw new BadRequestException('该变更单已处理')
    entity.status = dto.approve ? 'APPROVED' : 'REJECTED'
    entity.approvedBy = user.userId
    entity.approvedAt = new Date()
    if (dto.approve) {
      const order = await this.workOrderRepo.findOne({ where: { id: entity.workOrderId, tenantId: user.tenantId, isDeleted: 0 } })
      if (!order) throw new NotFoundException('工单不存在')
      const after = (entity.afterValue ?? {}) as Record<string, unknown>
      if (after.qty != null) order.qty = String(after.qty)
      if (after.planStart != null) order.planStart = new Date(String(after.planStart))
      if (after.planEnd != null) order.planEnd = new Date(String(after.planEnd))
      if (after.routingId != null) order.routingId = Number(after.routingId)
      if (after.status != null) order.status = String(after.status)
      order.changeVersion = entity.changeVersion
      order.updatedAt = new Date()
      await this.workOrderRepo.save(order)
    }
    const saved = await this.workOrderChangeRepo.save(entity)
    await this.auditService.record({ bizType: 'mes_work_order_change', bizId: id, action: dto.approve ? 'APPROVE_WORK_ORDER_CHANGE' : 'REJECT_WORK_ORDER_CHANGE', afterValue: saved }, user)
    return saved
  }

  /** 工单拆分：按数量拆出新工单，原工单保留剩余数量 */
  async splitWorkOrder(id: number, dto: SplitWorkOrderDto, user: JwtUser): Promise<{ parent: WorkOrderEntity; child: WorkOrderEntity }> {
    const order = await this.workOrderRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!order) throw new NotFoundException('工单不存在')
    const check = splitWorkOrder({
      qty: this.num(order.qty),
      producedQty: this.num(order.producedQty),
      actualQty: this.num(order.actualQty),
      status: order.status,
      splitQty: this.num(dto.splitQty)
    })
    if (!check.ok) throw new BadRequestException(check.reason ?? '工单不可拆分')
    const child = await this.workOrderRepo.save(this.workOrderRepo.create({
      tenantId: user.tenantId,
      orderNo: `${order.orderNo}-S${randomBytes(2).toString('hex').toUpperCase()}`,
      productId: order.productId,
      bomId: order.bomId,
      routingId: order.routingId,
      warehouseId: order.warehouseId,
      qty: this.money(this.num(dto.splitQty)),
      planStart: order.planStart,
      planEnd: order.planEnd,
      status: 'DRAFT',
      parentWorkOrderId: order.id,
      createdBy: user.userId,
      remark: dto.reason ?? null
    }))
    order.qty = this.money(check.remainingQty)
    order.updatedAt = new Date()
    await this.workOrderRepo.save(order)
    await this.auditService.record({ bizType: 'work_order', bizId: id, action: 'SPLIT_WORK_ORDER', beforeValue: { qty: order.qty }, afterValue: { parent: order.id, child: child.id } }, user)
    return { parent: order, child }
  }

  /* ============ 排产冲突、产能负荷与锁定 ============ */

  /** 排产冲突检测：同一工作中心/工单时间重叠 */
  async scheduleConflicts(query: ScheduleQueryDto, user: JwtUser): Promise<Record<string, unknown>> {
    const tasks = await this.planTaskRepo.find({
      where: { tenantId: user.tenantId, ...(query.from ? { startAt: new Date(query.from) } : {}) },
      order: { startAt: 'ASC' }
    })
    const toTime = query.to ? new Date(query.to).getTime() : null
    const scoped = toTime ? tasks.filter((task) => task.startAt.getTime() <= toTime) : tasks
    const conflicts = detectScheduleConflicts(scoped.map((task) => ({
      id: task.id,
      workOrderId: task.workOrderId,
      workCenterId: task.workCenterId,
      startAt: task.startAt,
      endAt: task.endAt,
      status: task.status,
      locked: task.locked === 1
    })))
    return { conflicts, conflictCount: conflicts.length, taskCount: scoped.length }
  }

  /** 产能负荷分析：按工作中心统计排产工时占比 */
  async capacityLoad(query: ScheduleQueryDto, user: JwtUser): Promise<Record<string, unknown>> {
    const days = query.days ?? 7
    const [tasks, centers] = await Promise.all([
      this.planTaskRepo.find({ where: { tenantId: user.tenantId }, order: { startAt: 'ASC' } }),
      this.centerRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    ])
    const from = query.from ? new Date(query.from).getTime() : Number.NEGATIVE_INFINITY
    const to = query.to ? new Date(query.to).getTime() : Number.POSITIVE_INFINITY
    const scoped = tasks.filter((task) => {
      const start = task.startAt.getTime()
      return start >= from && start <= to
    })
    const loads = computeCapacityLoad(
      scoped.map((task) => ({ id: task.id, workCenterId: task.workCenterId, startAt: task.startAt, endAt: task.endAt, status: task.status })),
      centers.map((center) => ({
        id: center.id,
        centerName: center.centerName,
        capacity: this.num(center.capacity),
        standardCapacity: this.num(center.standardCapacity),
        shiftHours: this.num(center.shiftHours) || 8
      })),
      days
    )
    return { loads, days, overloadedCount: loads.filter((load) => load.overloaded).length }
  }

  /** 排产任务锁定/解锁：锁定后不可拖拽改期 */
  async lockPlanTask(id: number, dto: LockPlanTaskDto, user: JwtUser): Promise<PlanTaskEntity> {
    const task = await this.planTaskRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!task) throw new NotFoundException('排产任务不存在')
    if (dto.lock) {
      task.locked = 1
      task.lockedAt = new Date()
      task.lockedBy = user.userId
      await this.planLockRepo.save(this.planLockRepo.create({
        tenantId: user.tenantId,
        planTaskId: id,
        lockedBy: user.userId,
        lockReason: dto.reason ?? null
      }))
    } else {
      task.locked = 0
      task.lockedAt = null
      task.lockedBy = null
      const lock = await this.planLockRepo.findOne({ where: { tenantId: user.tenantId, planTaskId: id, status: 'LOCKED' }, order: { id: 'DESC' } })
      if (lock) {
        lock.status = 'UNLOCKED'
        lock.unlockedAt = new Date()
        lock.unlockedBy = user.userId
        await this.planLockRepo.save(lock)
      }
    }
    const saved = await this.planTaskRepo.save(task)
    await this.auditService.record({ bizType: 'plan_task', bizId: id, action: dto.lock ? 'LOCK_PLAN_TASK' : 'UNLOCK_PLAN_TASK', afterValue: saved }, user)
    return saved
  }

  /* ============ 拖拽排产与换线 ============ */

  /** 甘特排程数据：按工作中心分组，含换线时间与冲突标记 */
  async ganttSchedule(query: ScheduleQueryDto, user: JwtUser): Promise<Record<string, unknown>> {
    const [tasks, orders, centers, rules] = await Promise.all([
      this.planTaskRepo.find({ where: { tenantId: user.tenantId }, order: { startAt: 'ASC' } }),
      this.workOrderRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } }),
      this.centerRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } }),
      this.changeoverRuleRepo.find({ where: { tenantId: user.tenantId, status: 'ACTIVE' } })
    ])
    const orderMap = new Map(orders.map((order) => [order.id, order]))
    const from = query.from ? new Date(query.from).getTime() : Number.NEGATIVE_INFINITY
    const to = query.to ? new Date(query.to).getTime() : Number.POSITIVE_INFINITY
    const views: ScheduleTaskView[] = tasks
      .filter((task) => {
        const start = task.startAt.getTime()
        return start >= from && start <= to
      })
      .map((task) => ({
        id: task.id,
        taskName: task.taskName,
        workCenterId: task.workCenterId ? Number(task.workCenterId) : null,
        workOrderId: task.workOrderId,
        productId: task.workOrderId ? orderMap.get(task.workOrderId)?.productId ?? null : null,
        startAt: task.startAt,
        endAt: task.endAt,
        locked: task.locked === 1,
        status: task.status
      }))
    const rows = computeGanttRows(views, rules.map((rule) => ({
      id: rule.id,
      workCenterId: rule.workCenterId,
      fromProductId: rule.fromProductId,
      toProductId: rule.toProductId,
      minutes: rule.minutes
    })))
    const grouped = new Map<string, GanttTaskRow[]>()
    for (const row of rows) {
      const key = row.workCenterId === null ? 'none' : String(row.workCenterId)
      const list = grouped.get(key) ?? []
      list.push(row)
      grouped.set(key, list)
    }
    const centerRows = centers.map((center) => ({
      workCenterId: center.id,
      centerName: center.centerName,
      centerCode: center.centerCode,
      capacity: center.capacity,
      tasks: grouped.get(String(center.id)) ?? []
    }))
    const unassigned = [...(grouped.get('none') ?? [])]
    const centerIds = new Set(centers.map((center) => String(center.id)))
    for (const [key, list] of grouped) {
      if (key !== 'none' && !centerIds.has(key)) unassigned.push(...list)
    }
    if (unassigned.length > 0) {
      centerRows.unshift({
        workCenterId: 0,
        centerName: '未分配工作中心',
        centerCode: 'UNASSIGNED',
        capacity: '',
        tasks: unassigned
      })
    }
    const changeoverTotal = rows.reduce((sum, row) => sum + row.changeoverMinutes, 0)
    return {
      rows,
      centers: centerRows,
      unassigned,
      conflictCount: rows.filter((row) => row.conflict).length,
      changeoverTotal,
      ruleCount: rules.length
    }
  }

  /**
   * 拖拽排产改期：
   * - 锁定任务不可拖拽；
   * - 自动累加换线时间（上一任务结束 + 换线耗时）；
   * - 时间重叠需提示，ignoreConflict=true 才落库；
   * - 同工作中心后续任务按顺序级联顺延；
   * - 生成换线记录并留审计。
   */
  async reschedulePlanTask(id: number, dto: ReschedulePlanTaskDto, user: JwtUser): Promise<Record<string, unknown>> {
    const task = await this.planTaskRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!task) throw new NotFoundException('排产任务不存在')
    if (task.locked === 1) throw new BadRequestException('排产任务已锁定，不可拖拽或改期')
    const newStart = new Date(dto.startAt)
    if (Number.isNaN(newStart.getTime())) throw new BadRequestException('开始时间格式不正确')

    const [tasks, orders, rules] = await Promise.all([
      this.planTaskRepo.find({ where: { tenantId: user.tenantId }, order: { startAt: 'ASC' } }),
      this.workOrderRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } }),
      this.changeoverRuleRepo.find({ where: { tenantId: user.tenantId, status: 'ACTIVE' } })
    ])
    const orderMap = new Map(orders.map((order) => [order.id, order]))
    const productOf = (taskId: number): number | null => {
      const target = tasks.find((item) => item.id === taskId)
      if (!target?.workOrderId) return null
      return orderMap.get(target.workOrderId)?.productId ?? null
    }
    const views: ScheduleTaskView[] = tasks.map((item) => ({
      id: item.id,
      taskName: item.taskName,
      workCenterId: item.workCenterId,
      workOrderId: item.workOrderId,
      productId: item.workOrderId ? orderMap.get(item.workOrderId)?.productId ?? null : null,
      startAt: item.startAt,
      endAt: item.endAt,
      locked: item.locked === 1,
      status: item.status
    }))
    const ruleViews = rules.map((rule) => ({
      id: rule.id,
      workCenterId: rule.workCenterId,
      fromProductId: rule.fromProductId,
      toProductId: rule.toProductId,
      minutes: rule.minutes
    }))
    const centerKey = task.workCenterId === null ? 'none' : String(task.workCenterId)
    const siblings = views
      .filter((item) => item.id !== id)
      .filter((item) => (item.workCenterId === null ? 'none' : String(item.workCenterId)) === centerKey)
      .sort((a, b) => toTime(a.startAt) - toTime(b.startAt))
    const previous = siblings.filter((item) => toTime(item.endAt) <= newStart.getTime()).pop() ?? null
    const changeoverMinutes = previous
      ? matchChangeoverMinutes(ruleViews, {
        workCenterId: task.workCenterId,
        fromProductId: previous.productId,
        toProductId: productOf(id)
      })
      : 0
    const readyAt = previous ? toTime(previous.endAt) + changeoverMinutes * 60000 : newStart.getTime()
    const effectiveStart = Math.max(newStart.getTime(), readyAt)
    const newEnd = dto.endAt ? new Date(dto.endAt) : null
    if (newEnd && Number.isNaN(newEnd.getTime())) throw new BadRequestException('结束时间格式不正确')
    const requestedDuration = newEnd
      ? newEnd.getTime() - newStart.getTime()
      : task.endAt.getTime() - task.startAt.getTime()
    const effectiveEnd = effectiveStart + Math.max(requestedDuration, 0)

    const moved: ScheduleTaskView = {
      ...views.find((item) => item.id === id)!,
      startAt: new Date(effectiveStart),
      endAt: new Date(effectiveEnd)
    }
    const cascade = cascadeAfterMove(views, id, moved.startAt, moved.endAt)
    if (cascade.conflicts.length > 0 && !dto.ignoreConflict) {
      return {
        applied: false,
        task,
        changeoverMinutes,
        conflicts: cascade.conflicts,
        message: `改期后与 ${cascade.conflicts.length} 个任务时间重叠，请确认后重试`
      }
    }

    const before = { startAt: task.startAt, endAt: task.endAt }
    task.startAt = new Date(effectiveStart)
    task.endAt = new Date(effectiveEnd)
    await this.planTaskRepo.save(task)
    for (const shifted of cascade.shifted) {
      const target = tasks.find((item) => item.id === shifted.id)
      if (!target) continue
      target.startAt = shifted.startAt
      target.endAt = shifted.endAt
      await this.planTaskRepo.save(target)
    }
    if (changeoverMinutes > 0 && previous) {
      await this.changeoverLogRepo.save(this.changeoverLogRepo.create({
        tenantId: user.tenantId,
        planTaskId: id,
        workCenterId: task.workCenterId,
        fromProductId: previous.productId,
        toProductId: productOf(id),
        minutes: changeoverMinutes,
        startAt: new Date(toTime(previous.endAt)),
        endAt: new Date(toTime(previous.endAt) + changeoverMinutes * 60000),
        status: 'PLANNED',
        source: 'DRAG',
        operatorId: user.userId
      }))
    }
    if (task.workOrderId) {
      const order = orderMap.get(task.workOrderId)
      await this.workOrderChangeRepo.save(this.workOrderChangeRepo.create({
        tenantId: user.tenantId,
        workOrderId: task.workOrderId,
        changeVersion: (order?.changeVersion ?? 0) + 1,
        changeType: 'SCHEDULE',
        beforeValue: { startAt: before.startAt, endAt: before.endAt },
        afterValue: { startAt: task.startAt, endAt: task.endAt, changeoverMinutes },
        changeReason: dto.reason ?? '拖拽排产改期',
        status: 'PENDING',
        createdBy: user.userId
      }))
    }
    await this.auditService.record({
      bizType: 'plan_task',
      bizId: id,
      action: 'RESCHEDULE_PLAN_TASK',
      beforeValue: { startAt: before.startAt, endAt: before.endAt },
      afterValue: { startAt: task.startAt, endAt: task.endAt, changeoverMinutes, cascaded: cascade.shifted.length }
    }, user)
    return {
      applied: true,
      task,
      changeoverMinutes,
      shifted: cascade.shifted,
      conflicts: cascade.conflicts
    }
  }

  /** 换线时间主数据列表 */
  async listChangeoverRules(user: JwtUser): Promise<MesChangeoverRuleEntity[]> {
    return this.changeoverRuleRepo.find({ where: { tenantId: user.tenantId }, order: { id: 'DESC' }, take: 500 })
  }

  /** 新增换线时间主数据 */
  async createChangeoverRule(dto: CreateChangeoverRuleDto, user: JwtUser): Promise<MesChangeoverRuleEntity> {
    const saved = await this.changeoverRuleRepo.save(this.changeoverRuleRepo.create({
      tenantId: user.tenantId,
      workCenterId: dto.workCenterId ?? null,
      fromProductId: dto.fromProductId ?? null,
      toProductId: dto.toProductId ?? null,
      minutes: dto.minutes,
      remark: dto.remark ?? null,
      status: 'ACTIVE',
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'mes_changeover_rule', bizId: saved.id, action: 'CREATE_CHANGEOVER_RULE', afterValue: saved }, user)
    return saved
  }

  /** 停用换线时间主数据 */
  async disableChangeoverRule(id: number, user: JwtUser): Promise<MesChangeoverRuleEntity> {
    const rule = await this.changeoverRuleRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!rule) throw new NotFoundException('换线规则不存在')
    rule.status = 'DISABLED'
    const saved = await this.changeoverRuleRepo.save(rule)
    await this.auditService.record({ bizType: 'mes_changeover_rule', bizId: id, action: 'DISABLE_CHANGEOVER_RULE', afterValue: saved }, user)
    return saved
  }

  /** 换线记录列表 */
  async listChangeoverLogs(query: QueryChangeoverLogDto, user: JwtUser): Promise<MesChangeoverLogEntity[]> {
    const where = scopeWhere<MesChangeoverLogEntity>({
      tenantId: user.tenantId,
      ...(query.workCenterId ? { workCenterId: query.workCenterId } : {}),
      ...(query.planTaskId ? { planTaskId: query.planTaskId } : {}),
      ...(query.fromProductId ? { fromProductId: query.fromProductId } : {}),
      ...(query.toProductId ? { toProductId: query.toProductId } : {})
    }, user, { ownerField: 'operatorId' })
    return this.changeoverLogRepo.find({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
  }

  /* ============ 超额领料与扫码领料 ============ */

  /** 超额领料预检：按 BOM 应耗量计算累计领料与超额数量 */
  async overIssueCheck(workOrderId: number, materialId: number, user: JwtUser): Promise<Record<string, unknown>> {
    const order = await this.workOrderRepo.findOne({ where: { id: workOrderId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!order) throw new NotFoundException('工单不存在')
    const required = await this.requiredMaterialQty(order, materialId)
    const issued = await this.issuedQty(user.tenantId, workOrderId, materialId)
    const result = evaluateOverIssue(issued, required)
    const approvals = await this.overIssueRepo.find({ where: { tenantId: user.tenantId, workOrderId, materialId, status: 'APPROVED' } })
    const approvedQty = approvals.reduce((sum, item) => sum + this.num(item.overQty), 0)
    return { ...result, requiredQty: required, issuedQty: issued, approvedOverQty: approvedQty, remainingAllowance: Number(Math.max(0, approvedQty - result.overQty).toFixed(4)) }
  }

  /** 超额领料审批：通过后允许在额度内继续领料 */
  async requestOverIssue(workOrderId: number, materialId: number, reason: string, user: JwtUser): Promise<MesOverIssueApprovalEntity> {
    const check = await this.overIssueCheck(workOrderId, materialId, user)
    const entity = await this.overIssueRepo.save(this.overIssueRepo.create({
      tenantId: user.tenantId,
      workOrderId,
      materialId,
      requiredQty: this.money(check.requiredQty as number),
      issuedQty: this.money(check.issuedQty as number),
      overQty: this.money(check.overQty as number),
      requestReason: reason ?? null,
      status: 'PENDING',
      requestedBy: user.userId
    }))
    await this.auditService.record({ bizType: 'mes_over_issue_approval', bizId: entity.id, action: 'REQUEST_OVER_ISSUE', afterValue: entity }, user)
    return entity
  }

  async approveOverIssue(id: number, dto: OverIssueApproveDto, user: JwtUser): Promise<MesOverIssueApprovalEntity> {
    const entity = await this.overIssueRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('超额领料审批单不存在')
    if (entity.status !== 'PENDING') throw new BadRequestException('该审批单已处理')
    entity.status = dto.approve ? 'APPROVED' : 'REJECTED'
    entity.approvedBy = user.userId
    entity.approvedAt = new Date()
    entity.approveComment = dto.comment ?? null
    const saved = await this.overIssueRepo.save(entity)
    await this.auditService.record({ bizType: 'mes_over_issue_approval', bizId: id, action: dto.approve ? 'APPROVE_OVER_ISSUE' : 'REJECT_OVER_ISSUE', afterValue: saved }, user)
    return saved
  }

  async listOverIssues(query: QueryManufacturingExtensionDto, user: JwtUser): Promise<MesOverIssueApprovalEntity[]> {
    const where = scopeWhere<MesOverIssueApprovalEntity>({ tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }, user, { ownerField: 'requestedBy' })
    return this.overIssueRepo.find({ where, order: { id: 'DESC' }, take: 200 })
  }

  /* ============ 扫码报工与在制看板 ============ */

  /** 扫码报工：解析条码校验产品/批次，记录报工数量与实际工时 */
  async scanReport(workOrderId: number, dto: ScanReportDto, user: JwtUser): Promise<WorkOrderReportEntity> {
    const order = await this.workOrderRepo.findOne({ where: { id: workOrderId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!order) throw new NotFoundException('工单不存在')
    if (!['RUNNING', 'PARTIAL'].includes(order.status)) throw new BadRequestException('工单未进入报工状态')
    let scanCode: string | null = null
    if (dto.scanCode?.trim()) {
      const parsed = parseScanCode(dto.scanCode)
      if (!parsed.ok) throw new BadRequestException(parsed.reason ?? '条码无法识别')
      scanCode = parsed.code
    }
    const entity = await this.reportRepo.save(this.reportRepo.create({
      tenantId: user.tenantId,
      workOrderId,
      operationId: dto.operationId ?? null,
      qty: dto.qty,
      defectQty: dto.defectQty ?? '0',
      workHours: dto.workHours ?? '0',
      scanCode,
      userId: user.userId
    }))
    order.producedQty = this.money(this.num(order.producedQty) + this.num(dto.qty))
    await this.workOrderRepo.save(order)
    await this.auditService.record({ bizType: 'work_order_report', bizId: entity.id, action: 'SCAN_REPORT_WORK', afterValue: entity }, user)
    return entity
  }

  /** 在制看板：按工单统计在制数量、进度与逾期情况 */
  async wipBoard(user: JwtUser): Promise<Record<string, unknown>> {
    const orders = await this.workOrderRepo.find({ where: scopeWhere<WorkOrderEntity>({ tenantId: user.tenantId, isDeleted: 0 }, user) })
    const rows = buildWipBoard(orders.map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
      productId: order.productId,
      status: order.status,
      qty: this.num(order.qty),
      producedQty: this.num(order.producedQty),
      actualQty: this.num(order.actualQty),
      planStart: order.planStart,
      planEnd: order.planEnd
    })))
    return {
      rows,
      wipQty: this.money(rows.reduce((sum, row) => sum + row.wipQty, 0)),
      overdueCount: rows.filter((row) => row.overdue).length
    }
  }

  /* ============ 生产指标分析 ============ */

  /** 生产分析：良率 / 效率 / 工时 / 达成率 / 成本 */
  async productionAnalysis(query: ProductionAnalysisQueryDto, user: JwtUser): Promise<Record<string, unknown>> {
    const orders = await this.workOrderRepo.find({ where: scopeWhere<WorkOrderEntity>({ tenantId: user.tenantId, isDeleted: 0 }, user) })
    const scoped = orders.filter((order) => {
      if (query.productId && order.productId !== query.productId) return false
      if (query.from && order.planStart && order.planStart.getTime() < new Date(query.from).getTime()) return false
      if (query.to && order.planStart && order.planStart.getTime() > new Date(query.to).getTime()) return false
      return true
    })
    const orderIds = scoped.map((order) => order.id)
    const reports = orderIds.length
      ? await this.reportRepo.find({ where: { tenantId: user.tenantId, workOrderId: In(orderIds) } })
      : []
    const issues = orderIds.length
      ? await this.issueRepo.find({ where: { tenantId: user.tenantId, workOrderId: In(orderIds) } })
      : []
    const standardHours = await this.standardHoursOf(scoped)
    const actualHours = reports.reduce((sum, item) => sum + this.num(item.workHours), 0)
    const outputQty = reports.reduce((sum, item) => sum + this.num(item.qty), 0)
    const defectQty = reports.reduce((sum, item) => sum + this.num(item.defectQty), 0)
    const onTime = scoped.filter((order) => order.status === 'DONE' && (!order.planEnd || order.planEnd.getTime() >= (order.updatedAt?.getTime() ?? 0))).length
    const metrics = computeProductionMetrics({
      plannedQty: scoped.reduce((sum, order) => sum + this.num(order.qty), 0),
      outputQty,
      defectQty,
      standardHours,
      actualHours,
      completedOnTime: onTime,
      totalOrders: scoped.length
    })
    const materialCost = await this.materialCostOf(issues, user.tenantId)
    return {
      ...metrics,
      standardHours: Number(standardHours.toFixed(2)),
      materialCost: Number(materialCost.toFixed(4)),
      unitCost: outputQty > 0 ? Number((materialCost / outputQty).toFixed(4)) : 0,
      orderCount: scoped.length,
      doneCount: scoped.filter((order) => order.status === 'DONE').length
    }
  }

  /* ============ 质检检验项 ============ */

  /** 质检检验项录入：逐项判定并回写质检结论 */
  async createQcItems(dto: CreateQcItemDto, user: JwtUser): Promise<Record<string, unknown>> {
    const qc = await this.qcRepo.findOne({ where: { id: dto.qcId, tenantId: user.tenantId } })
    if (!qc) throw new NotFoundException('质检记录不存在')
    await this.qcItemRepo.save(this.qcItemRepo.create({
      tenantId: user.tenantId,
      qcId: dto.qcId,
      itemCode: dto.itemCode,
      itemName: dto.itemName,
      standardValue: dto.standardValue ?? null,
      measuredValue: dto.measuredValue ?? null,
      upperLimit: dto.upperLimit ?? null,
      lowerLimit: dto.lowerLimit ?? null,
      isQualified: dto.qualified ? 1 : 0,
      itemResult: null
    }))
    const items = await this.qcItemRepo.find({ where: { tenantId: user.tenantId, qcId: dto.qcId }, order: { id: 'ASC' } })
    const evaluation = evaluateQcItems(items.map((item) => ({
      itemCode: item.itemCode,
      itemName: item.itemName,
      standardValue: item.standardValue == null ? null : this.num(item.standardValue),
      measuredValue: item.measuredValue == null ? null : this.num(item.measuredValue),
      upperLimit: item.upperLimit == null ? null : this.num(item.upperLimit),
      lowerLimit: item.lowerLimit == null ? null : this.num(item.lowerLimit),
      qualified: item.isQualified === 1 ? true : undefined
    })))
    for (const item of evaluation.items) {
      const entity = items.find((row) => row.itemCode === item.itemCode)
      if (!entity) continue
      entity.isQualified = item.qualified ? 1 : 0
      entity.itemResult = item.reason
      await this.qcItemRepo.save(entity)
    }
    qc.result = evaluation.result
    const savedQc = await this.qcRepo.save(qc)
    await this.auditService.record({ bizType: 'mes_qc', bizId: qc.id, action: 'CREATE_QC_ITEM', afterValue: { result: evaluation.result, passed: evaluation.passed, failed: evaluation.failed } }, user)
    return { qc: savedQc, ...evaluation }
  }

  async listQcItems(qcId: number, user: JwtUser): Promise<MesQcItemEntity[]> {
    return this.qcItemRepo.find({ where: { tenantId: user.tenantId, qcId }, order: { id: 'ASC' } })
  }

  /* ============ 设备故障与保养 ============ */

  /** 设备故障报修：登记故障并记录停机时间与交期影响 */
  async createEquipmentFault(dto: CreateEquipmentFaultDto, user: JwtUser): Promise<MesEquipmentFaultEntity> {
    const equipment = await this.equipmentRepo.findOne({ where: { id: dto.equipmentId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!equipment) throw new NotFoundException('设备不存在')
    const transition = canTransitionEquipment(equipment.status, 'FAULT')
    if (!transition.ok) throw new BadRequestException(transition.reason ?? '设备状态不允许报修')
    const stopLineAt = dto.stopLineAt ? new Date(dto.stopLineAt) : new Date()
    const stopLineEnd = dto.stopLineEnd ? new Date(dto.stopLineEnd) : null
    const impact = computeStopLineImpact({
      startAt: stopLineAt,
      endAt: stopLineEnd ?? stopLineAt,
      planEnd: null,
      dailyCapacity: dto.dailyCapacity ? this.num(dto.dailyCapacity) : 0
    })
    const entity = await this.faultRepo.save(this.faultRepo.create({
      tenantId: user.tenantId,
      equipmentId: dto.equipmentId,
      faultNo: this.number('FLT'),
      faultType: dto.faultType ?? 'MECHANICAL',
      faultDesc: dto.faultDesc ?? null,
      stopLineAt,
      stopLineEnd,
      downtimeMinutes: impact.downtimeMinutes,
      delayDays: String(impact.delayDays),
      workOrderId: dto.workOrderId ?? null,
      status: 'OPEN',
      reportedBy: user.userId
    }))
    equipment.status = 'FAULT'
    equipment.faultStatus = 'FAULT'
    await this.equipmentRepo.save(equipment)
    await this.auditService.record({ bizType: 'mes_equipment_fault', bizId: entity.id, action: 'REPORT_EQUIPMENT_FAULT', afterValue: entity }, user)
    return entity
  }

  /** 设备故障维修完成：恢复设备状态并回写停机时长 */
  async repairEquipmentFault(id: number, dto: RepairEquipmentFaultDto, user: JwtUser): Promise<MesEquipmentFaultEntity> {
    const entity = await this.faultRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('故障单不存在')
    if (entity.status === 'CLOSED') throw new BadRequestException('故障单已关闭')
    const repairedAt = dto.repairedAt ? new Date(dto.repairedAt) : new Date()
    const stopLineEnd = entity.stopLineAt ? repairedAt : null
    const impact = computeStopLineImpact({
      startAt: entity.stopLineAt ?? repairedAt,
      endAt: stopLineEnd ?? repairedAt,
      planEnd: null,
      dailyCapacity: 0
    })
    entity.status = 'CLOSED'
    entity.repairedAt = repairedAt
    entity.repairedBy = user.userId
    entity.repairResult = dto.repairResult
    entity.stopLineEnd = stopLineEnd
    entity.downtimeMinutes = impact.downtimeMinutes
    entity.delayDays = String(impact.delayDays)
    const saved = await this.faultRepo.save(entity)
    const equipment = await this.equipmentRepo.findOne({ where: { id: entity.equipmentId, tenantId: user.tenantId } })
    if (equipment) {
      equipment.status = 'IDLE'
      equipment.faultStatus = 'NORMAL'
      await this.equipmentRepo.save(equipment)
    }
    await this.auditService.record({ bizType: 'mes_equipment_fault', bizId: id, action: 'REPAIR_EQUIPMENT_FAULT', afterValue: saved }, user)
    return saved
  }

  async listEquipmentFaults(query: QueryManufacturingExtensionDto, user: JwtUser): Promise<MesEquipmentFaultEntity[]> {
    const where = scopeWhere<MesEquipmentFaultEntity>({ tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}), ...(query.equipmentId ? { equipmentId: query.equipmentId } : {}) }, user, { ownerField: 'reportedBy' })
    return this.faultRepo.find({ where, order: { id: 'DESC' }, take: 200 })
  }

  /** 保养计划登记 */
  async createMaintenance(dto: CreateMaintenanceDto, user: JwtUser): Promise<MesEquipmentMaintenanceEntity> {
    const equipment = await this.equipmentRepo.findOne({ where: { id: dto.equipmentId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!equipment) throw new NotFoundException('设备不存在')
    const entity = await this.maintenanceRepo.save(this.maintenanceRepo.create({
      tenantId: user.tenantId,
      equipmentId: dto.equipmentId,
      maintenanceNo: this.number('MTN'),
      planDate: dto.planDate ?? null,
      cycleDays: dto.cycleDays ?? equipment.maintenanceCycleDays ?? 30,
      maintenanceType: dto.maintenanceType ?? 'ROUTINE',
      maintenanceContent: dto.maintenanceContent ?? null,
      status: 'PLANNED'
    }))
    await this.auditService.record({ bizType: 'mes_equipment_maintenance', bizId: entity.id, action: 'CREATE_MAINTENANCE', afterValue: entity }, user)
    return entity
  }

  /** 保养执行：回写上次保养日期并推进周期 */
  async executeMaintenance(id: number, dto: ExecuteMaintenanceDto, user: JwtUser): Promise<MesEquipmentMaintenanceEntity> {
    const entity = await this.maintenanceRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('保养单不存在')
    if (entity.status === 'EXECUTED') throw new BadRequestException('保养单已执行')
    const executedAt = dto.executedAt ? new Date(dto.executedAt) : new Date()
    entity.status = 'EXECUTED'
    entity.executedAt = executedAt
    entity.executorId = user.userId
    entity.executeResult = dto.executeResult ?? null
    const saved = await this.maintenanceRepo.save(entity)
    const equipment = await this.equipmentRepo.findOne({ where: { id: entity.equipmentId, tenantId: user.tenantId } })
    if (equipment) {
      equipment.lastMaintenance = executedAt.toISOString().slice(0, 10)
      equipment.maintenanceCycleDays = entity.cycleDays
      await this.equipmentRepo.save(equipment)
    }
    await this.auditService.record({ bizType: 'mes_equipment_maintenance', bizId: id, action: 'EXECUTE_MAINTENANCE', afterValue: saved }, user)
    return saved
  }

  async listMaintenances(query: QueryManufacturingExtensionDto, user: JwtUser): Promise<MesEquipmentMaintenanceEntity[]> {
    const where = scopeWhere<MesEquipmentMaintenanceEntity>({ tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}), ...(query.equipmentId ? { equipmentId: query.equipmentId } : {}) }, user)
    return this.maintenanceRepo.find({ where, order: { id: 'DESC' }, take: 200 })
  }

  /* ============ 生产异常停线与交期顺延 ============ */

  /** 停线记录：记录停线起止并按日产能顺延工单交期 */
  async recordStopLine(exceptionId: number, dto: StopLineDto, user: JwtUser): Promise<ProductionExceptionEntity> {
    const entity = await this.exceptionRepo.findOne({ where: { id: exceptionId, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('生产异常不存在')
    const startAt = new Date(dto.stopLineAt)
    const endAt = dto.stopLineEnd ? new Date(dto.stopLineEnd) : new Date()
    const impactOrderId = dto.impactOrderId ?? entity.workOrderId ?? null
    const order = impactOrderId
      ? await this.workOrderRepo.findOne({ where: { id: impactOrderId, tenantId: user.tenantId, isDeleted: 0 } })
      : null
    const impact = computeStopLineImpact({
      startAt,
      endAt,
      planEnd: order?.planEnd ?? null,
      dailyCapacity: dto.dailyCapacity ? this.num(dto.dailyCapacity) : 0
    })
    entity.stopLineAt = startAt
    entity.stopLineEnd = endAt
    entity.downtimeMinutes = impact.downtimeMinutes
    entity.delayDays = String(impact.delayDays)
    entity.impactOrderId = impactOrderId
    const saved = await this.exceptionRepo.save(entity)
    if (order && impact.newPlanEnd) {
      order.planEnd = new Date(impact.newPlanEnd)
      order.updatedAt = new Date()
      await this.workOrderRepo.save(order)
    }
    await this.auditService.record({ bizType: 'production_exception', bizId: exceptionId, action: 'RECORD_STOP_LINE', afterValue: { downtimeMinutes: impact.downtimeMinutes, delayDays: impact.delayDays } }, user)
    return saved
  }

  /* ============ MRP 模拟运算与优先级 ============ */

  /** MRP 模拟运算：按当前库存/在途/需求试算净需求，不落库 */
  async simulateMrp(dto: MrpSimulateDto, user: JwtUser): Promise<Record<string, unknown>> {
    const [saleLines, purchaseLines, balances, bomItems] = await Promise.all([
      this.saleLineRepo.find({ where: { tenantId: user.tenantId } }),
      this.purchaseLineRepo.find({ where: { tenantId: user.tenantId } }),
      this.balanceRepo.find({ where: { tenantId: user.tenantId } }),
      this.bomItemRepo.find({ where: { tenantId: user.tenantId } })
    ])
    const demand = new Map<number, number>()
    for (const line of saleLines) {
      const remain = this.num(line.qty) - this.num(line.shippedQty)
      if (remain > 0) demand.set(line.productId, (demand.get(line.productId) ?? 0) + remain)
    }
    const onway = new Map<number, number>()
    for (const line of purchaseLines) {
      const remain = this.num(line.qty) - this.num(line.receivedQty)
      if (remain > 0) onway.set(line.productId, (onway.get(line.productId) ?? 0) + remain)
    }
    const available = new Map<number, number>()
    const allocated = new Map<number, number>()
    for (const balance of balances) {
      available.set(balance.productId, (available.get(balance.productId) ?? 0) + this.num(balance.qtyOnHand))
      allocated.set(balance.productId, (allocated.get(balance.productId) ?? 0) + this.num(balance.qtyOccupied))
    }
    const safetyQty = this.num(dto.safetyQty)
    const results = [...new Set([...demand.keys(), ...onway.keys(), ...available.keys()])].map((productId) => {
      const grossQty = demand.get(productId) ?? 0
      const availableQty = available.get(productId) ?? 0
      const onWayQty = onway.get(productId) ?? 0
      const allocatedQty = allocated.get(productId) ?? 0
      const net = computeNetDemand({ productId, grossQty, safetyQty, availableQty, onWayQty, allocatedQty })
      return { ...net, availableQty, onWayQty, allocatedQty }
    })
    const boms = await this.bomRepo.find({ where: { tenantId: user.tenantId } })
    const bomProductMap = new Map(boms.map((b) => [b.id, b.productId]))
    const edges = bomItems
      .map((item) => ({ parentId: bomProductMap.get(item.bomId) ?? 0, childId: item.materialId, qtyPerUnit: this.num(item.qty) }))
      .filter((edge) => edge.parentId > 0)
    const shortageTree = new Map<number, number>()
    for (const [productId, grossQty] of demand) {
      if (grossQty <= 0) continue
      for (const [childId, qty] of explodeBom(productId, grossQty, edges)) {
        shortageTree.set(childId, (shortageTree.get(childId) ?? 0) + qty)
      }
    }
    const priorities = rankMrpDemands(results.map((result) => ({
      productId: result.productId,
      netQty: result.netQty,
      demandQty: result.grossQty,
      dueDate: dto.planDate ?? null
    })))
    const priorityMap = new Map(priorities.map((row) => [row.productId, row]))
    await this.auditService.record({ bizType: 'mrp_simulate', action: 'SIMULATE_MRP', afterValue: { safetyQty, factoryId: dto.factoryId ?? null, netCount: results.length } }, user)
    return {
      safetyQty,
      factoryId: dto.factoryId ?? null,
      planDate: dto.planDate ?? null,
      rows: results.map((result) => ({
        productId: result.productId,
        grossQty: result.grossQty,
        availableQty: result.availableQty,
        onWayQty: result.onWayQty,
        allocatedQty: result.allocatedQty,
        netQty: result.netQty,
        priority: priorityMap.get(result.productId)?.priority ?? 0,
        priorityLabel: priorityMap.get(result.productId)?.priorityLabel ?? 'LOW',
        priorityReason: priorityMap.get(result.productId)?.reason ?? ''
      })),
      shortageTree: Object.fromEntries([...shortageTree].map(([k, v]) => [String(k), Number(v.toFixed(4))])),
      netDemandTotal: Number(results.reduce((sum, item) => sum + Math.max(0, item.netQty), 0).toFixed(3))
    }
  }

  /** MRP 建议优先级回写：按优先级排序更新建议记录 */
  async rankMrpRun(runId: number, user: JwtUser): Promise<Array<Record<string, unknown>>> {
    const run = await this.mrpRunRepo.findOne({ where: { id: runId, tenantId: user.tenantId } })
    if (!run) throw new NotFoundException('MRP 运算记录不存在')
    const suggests = await this.mrpSuggestRepo.find({ where: { tenantId: user.tenantId, runId } })
    const ranked = rankMrpDemands(suggests.map((item) => ({
      productId: item.productId,
      netQty: this.num(item.netQty),
      demandQty: this.num(item.demandQty)
    })))
    const map = new Map(ranked.map((row) => [row.productId, row]))
    const rows: Array<Record<string, unknown>> = []
    for (const suggest of suggests) {
      const row = map.get(suggest.productId)
      if (!row) continue
      suggest.priority = row.priority
      suggest.priorityLabel = row.priorityLabel
      suggest.priorityReason = row.reason
      await this.mrpSuggestRepo.save(suggest)
      rows.push({ productId: suggest.productId, priority: row.priority, priorityLabel: row.priorityLabel, reason: row.reason })
    }
    await this.auditService.record({ bizType: 'mrp_run', bizId: runId, action: 'RANK_MRP_SUGGESTS', afterValue: { count: rows.length } }, user)
    return rows
  }

  /* ============ 私有工具 ============ */

  /** BOM 应耗量：按工单数量 × 子件用量（含损耗率） */
  private async requiredMaterialQty(order: WorkOrderEntity, materialId: number): Promise<number> {
    if (!order.bomId) return 0
    const item = await this.bomItemRepo.findOne({ where: { tenantId: order.tenantId, bomId: order.bomId, materialId } })
    if (!item) return 0
    const perUnit = this.num(item.qty) * (1 + this.num(item.lossRate) / 100)
    return Number((this.num(order.qty) * perUnit).toFixed(4))
  }

  /** 已领量（不含退料与倒冲） */
  private async issuedQty(tenantId: number, workOrderId: number, materialId: number): Promise<number> {
    const issues = await this.issueRepo.find({ where: { tenantId, workOrderId, materialId } })
    return issues
      .filter((issue) => issue.issueType === 'PICK')
      .reduce((sum, issue) => sum + this.num(issue.qty), 0)
  }

  /** 标准工时：按工单工艺路线工序工时 × 工单数量 */
  private async standardHoursOf(orders: WorkOrderEntity[]): Promise<number> {
    const routingIds = [...new Set(orders.map((order) => order.routingId).filter((id): id is number => id != null))]
    if (routingIds.length === 0) return 0
    const operations = await this.operationRepo.find({ where: { tenantId: orders[0].tenantId, routingId: In(routingIds) } })
    const map = new Map<number, number>()
    for (const operation of operations) {
      map.set(operation.routingId, (map.get(operation.routingId) ?? 0) + this.num(operation.standardMinutes))
    }
    return orders.reduce((sum, order) => {
      const minutes = order.routingId ? map.get(order.routingId) ?? 0 : 0
      return sum + (minutes * this.num(order.qty)) / 60
    }, 0)
  }

  /** 材料成本：按领料数量 × 库存移动加权成本估算 */
  private async materialCostOf(issues: WorkOrderIssueEntity[], tenantId: number): Promise<number> {
    const materialIds = [...new Set(issues.map((issue) => issue.materialId))]
    if (materialIds.length === 0) return 0
    const balances = await this.balanceRepo.find({ where: { tenantId, productId: In(materialIds) } })
    const costMap = new Map<number, number>()
    for (const balance of balances) {
      const qty = this.num(balance.qtyOnHand)
      const cost = this.num(balance.avgCost)
      const previous = costMap.get(balance.productId) ?? 0
      costMap.set(balance.productId, qty > 0 ? (previous * qty + cost * qty) / (qty + 1) : previous || cost)
    }
    return issues
      .filter((issue) => issue.issueType === 'PICK')
      .reduce((sum, issue) => sum + this.num(issue.qty) * (costMap.get(issue.materialId) ?? 0), 0)
  }

  private number(prefix: string): string {
    return `${prefix}${`${Date.now().toString(36)}${randomBytes(2).toString('hex')}`.toUpperCase()}`
  }

  private num(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  private money(value: number): string {
    return value.toFixed(3)
  }
}