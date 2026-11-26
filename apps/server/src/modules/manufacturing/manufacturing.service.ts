import { randomBytes } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { scopeWhere } from '../../common/data-scope-context'
import { assertBizEditable } from '../../common/approval-guard'
import { computeNetDemand, explodeBom, mrpExceptions } from '../../common/mrp-engine'
import { resolvePolicy } from '../../common/inventory-alert-engine'
import { checkKitting } from '../../common/business-closure-engine'
import { computeBackflush, rollupBomCost, validateRouting } from '../../common/production-rules'
import { evaluateOverIssue, parseScanCode } from '../../common/manufacturing-extension-engine'
import { evaluateMaterialReturn, buildDemandSummary, type DemandSummaryRow } from '../../common/manufacturing-demand-rules'
import {
  buildDemandsFromMrp, filterStockByFactories, mergeDemandRows, validateMrpFactoryFilter
} from '../../common/mrp-factory-rules'
import { canConcession, judgeSampling, samplingPlan } from '../../common/finance-quality-rules'
import { computeOee, maintenanceDue } from '../../common/asset-cost-rules'
import { resolveSubstitute, isRoutingEffective } from '../../common/procurement-rules'
import { canTransition } from '../../common/state-machine'
import { AuditService } from '../audit/audit.service'
import { InventoryService } from '../inventory/inventory.service'
import { RevisionService } from '../revision/revision.service'
import { StockBalanceEntity } from '../inventory/entities/inventory.entities'
import { StockAlertPolicyEntity } from '../inventory/entities/stock-alert-policy.entity'
import { ProductEntity } from '../master-data/entities/product.entity'
import { WarehouseEntity } from '../master-data/entities/warehouse.entity'
import { EquipmentInspectionEntity } from './entities/equipment-inspection.entity'
import { MesOverIssueApprovalEntity } from './entities/manufacturing-extension.entity'
import { MesMaterialReturnEntity, MesMaterialReturnLineEntity } from './entities/mes-material-return.entity'
import {
  BomEntity, EquipmentEntity, MrpRunEntity, MrpSuggestEntity, OperationEntity, PlanTaskEntity,
  ProductionExceptionEntity, QcEntity, RoutingEntity, WorkCenterEntity, WorkOrderCompleteEntity,
  WorkOrderEntity, WorkOrderIssueEntity, WorkOrderReportEntity, BomItemEntity
} from './entities/manufacturing.entities'
import { PurchaseDemandEntity, PurchaseOrderLineEntity } from '../purchase/entities/purchase.entities'
import { SaleOrderLineEntity } from '../sales/entities/sales.entities'
import {
  CloseExceptionDto, CompleteDto, CreateBomDto, CreateEquipmentDto, CreateExceptionDto,
  CreateMaterialReturnDto, CreatePlanTaskDto, CreateQcDto, CreateRoutingDto, CreateWorkCenterDto,
  CreateWorkOrderDto, IssueDto, QueryManufacturingDto, QueryMaterialReturnDto, ReportDto, RunMrpDto,
  UpdatePlanTaskDto, UpdateWorkOrderDto
} from './dto'

@Injectable()
export class ManufacturingService {
  constructor(
    @InjectRepository(BomEntity) private readonly bomRepo: Repository<BomEntity>,
    @InjectRepository(BomItemEntity) private readonly bomItemRepo: Repository<BomItemEntity>,
    @InjectRepository(WorkCenterEntity) private readonly centerRepo: Repository<WorkCenterEntity>,
    @InjectRepository(RoutingEntity) private readonly routingRepo: Repository<RoutingEntity>,
    @InjectRepository(OperationEntity) private readonly operationRepo: Repository<OperationEntity>,
    @InjectRepository(MrpRunEntity) private readonly mrpRunRepo: Repository<MrpRunEntity>,
    @InjectRepository(MrpSuggestEntity) private readonly mrpSuggestRepo: Repository<MrpSuggestEntity>,
    @InjectRepository(PlanTaskEntity) private readonly planTaskRepo: Repository<PlanTaskEntity>,
    @InjectRepository(WorkOrderEntity) private readonly workOrderRepo: Repository<WorkOrderEntity>,
    @InjectRepository(WorkOrderIssueEntity) private readonly issueRepo: Repository<WorkOrderIssueEntity>,
    @InjectRepository(WorkOrderReportEntity) private readonly reportRepo: Repository<WorkOrderReportEntity>,
    @InjectRepository(WorkOrderCompleteEntity) private readonly completeRepo: Repository<WorkOrderCompleteEntity>,
    @InjectRepository(QcEntity) private readonly qcRepo: Repository<QcEntity>,
    @InjectRepository(EquipmentEntity) private readonly equipmentRepo: Repository<EquipmentEntity>,
    @InjectRepository(EquipmentInspectionEntity) private readonly inspectionRepo: Repository<EquipmentInspectionEntity>,
    @InjectRepository(ProductionExceptionEntity) private readonly exceptionRepo: Repository<ProductionExceptionEntity>,
    @InjectRepository(ProductEntity) private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(WarehouseEntity) private readonly warehouseRepo: Repository<WarehouseEntity>,
    @InjectRepository(SaleOrderLineEntity) private readonly saleLineRepo: Repository<SaleOrderLineEntity>,
    @InjectRepository(PurchaseOrderLineEntity) private readonly purchaseLineRepo: Repository<PurchaseOrderLineEntity>,
    @InjectRepository(PurchaseDemandEntity) private readonly demandRepo: Repository<PurchaseDemandEntity>,
    @InjectRepository(StockBalanceEntity) private readonly balanceRepo: Repository<StockBalanceEntity>,
    @InjectRepository(StockAlertPolicyEntity) private readonly alertPolicyRepo: Repository<StockAlertPolicyEntity>,
    @InjectRepository(MesOverIssueApprovalEntity) private readonly overIssueRepo: Repository<MesOverIssueApprovalEntity>,
    @InjectRepository(MesMaterialReturnEntity) private readonly materialReturnRepo: Repository<MesMaterialReturnEntity>,
    @InjectRepository(MesMaterialReturnLineEntity) private readonly materialReturnLineRepo: Repository<MesMaterialReturnLineEntity>,
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
    private readonly revisionService: RevisionService
  ) {}

  async listBoms(query: QueryManufacturingDto, user: JwtUser): Promise<PageResult<BomEntity>> {
    const where = scopeWhere<BomEntity>({ tenantId: user.tenantId, isDeleted: 0, ...(query.productId ? { productId: query.productId } : {}) }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.bomRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async bomDetail(id: number, user: JwtUser): Promise<{ bom: BomEntity; items: BomItemEntity[] }> {
    const bom = await this.bomRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!bom) throw new NotFoundException('BOM 不存在')
    const items = await this.bomItemRepo.find({ where: { tenantId: user.tenantId, bomId: id }, order: { id: 'ASC' } })
    return { bom, items }
  }

  async createBom(dto: CreateBomDto, user: JwtUser): Promise<BomEntity> {
    await this.findProduct(dto.productId, user)
    const duplicate = await this.bomRepo.findOne({ where: { tenantId: user.tenantId, productId: dto.productId, version: dto.version, isDeleted: 0 } })
    if (duplicate) throw new BadRequestException('该产品版本已存在')
    const bom = await this.bomRepo.save(this.bomRepo.create({
      tenantId: user.tenantId,
      productId: dto.productId,
      version: dto.version,
      baseQty: dto.baseQty ?? '1',
      remark: dto.remark ?? null,
      createdBy: user.userId
    }))
    for (const item of dto.items) {
      await this.bomItemRepo.save(this.bomItemRepo.create({
        tenantId: user.tenantId,
        bomId: bom.id,
        materialId: item.materialId,
        qty: item.qty,
        lossRate: item.lossRate ?? '0',
        substituteMaterialId: item.substituteMaterialId ?? null
      }))
    }
    await this.auditService.record({ bizType: 'bom', bizId: bom.id, action: 'CREATE_BOM', afterValue: bom }, user)
    return bom
  }

  /** BOM 成本卷算：按层级累加子件成本×用量，返回成品单位成本 */
  async rollupBomCost(bomId: number, user: JwtUser): Promise<{ bomId: number; unitCost: number }> {
    const bom = await this.bomRepo.findOne({ where: { id: bomId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!bom) throw new NotFoundException('BOM 不存在')
    const boms = await this.bomRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const items = await this.bomItemRepo.find({ where: { tenantId: user.tenantId } })
    const bomProductMap = new Map(boms.map((b) => [b.id, b.productId]))
    const products = await this.productRepo.find({ where: { tenantId: user.tenantId } })
    const costMap = new Map(products.map((p) => [p.id, this.num(p.cost)]))
    const edges = items.map((item) => ({
      parentId: bomProductMap.get(item.bomId) ?? 0,
      childId: item.materialId,
      qtyPerUnit: this.num(item.qty) * (1 + this.num(item.lossRate) / 100),
      childCost: costMap.get(item.materialId) ?? 0
    })).filter((edge) => edge.parentId > 0)
    const unitCost = rollupBomCost(bom.productId, edges)
    await this.auditService.record({ bizType: 'bom', bizId: bomId, action: 'ROLLUP_BOM_COST', afterValue: { unitCost } }, user)
    return { bomId, unitCost }
  }

  /** 替代料解析：主料可用量不足时按替代比例换算替代料需求 */
  async resolveMaterialSubstitute(
    bomItemId: number,
    requiredQty: number,
    user: JwtUser
  ): Promise<{ materialId: number; qty: number; usedSubstitute: boolean } | null> {
    const item = await this.bomItemRepo.findOne({ where: { id: bomItemId, tenantId: user.tenantId } })
    if (!item) throw new NotFoundException('BOM 明细不存在')
    const mainBalance = await this.balanceRepo.findOne({ where: { tenantId: user.tenantId, productId: item.materialId } })
    const mainAvailable = mainBalance
      ? this.num(mainBalance.qtyOnHand) - this.num(mainBalance.qtyOccupied) - this.num(mainBalance.qtyFrozen)
      : 0
    if (!item.substituteMaterialId) {
      return resolveSubstitute(item.materialId, mainAvailable, requiredQty, null)
    }
    const subBalance = await this.balanceRepo.findOne({ where: { tenantId: user.tenantId, productId: item.substituteMaterialId } })
    const subAvailable = subBalance
      ? this.num(subBalance.qtyOnHand) - this.num(subBalance.qtyOccupied) - this.num(subBalance.qtyFrozen)
      : 0
    return resolveSubstitute(item.materialId, mainAvailable, requiredQty, {
      materialId: item.substituteMaterialId,
      availableQty: Math.max(0, subAvailable),
      ratio: 1
    })
  }

  async activateBom(id: number, user: JwtUser): Promise<BomEntity> {
    const bom = await this.bomRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!bom) throw new NotFoundException('BOM 不存在')
    const others = await this.bomRepo.find({ where: { tenantId: user.tenantId, productId: bom.productId, isActive: 1 } })
    for (const item of others) {
      item.isActive = 0
      await this.bomRepo.save(item)
    }
    bom.isActive = 1
    bom.status = 'APPROVED'
    const saved = await this.bomRepo.save(bom)
    await this.auditService.record({ bizType: 'bom', bizId: id, action: 'ACTIVATE_BOM' }, user)
    return saved
  }

  async listCenters(query: QueryManufacturingDto, user: JwtUser): Promise<PageResult<WorkCenterEntity>> {
    const where = scopeWhere<WorkCenterEntity>({ tenantId: user.tenantId, isDeleted: 0 }, user)
    const [list, total] = await this.centerRepo.findAndCount({ where, order: { id: 'ASC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createCenter(dto: CreateWorkCenterDto, user: JwtUser): Promise<WorkCenterEntity> {
    const entity = this.centerRepo.create({ ...dto, tenantId: user.tenantId, capacity: dto.capacity ?? '0' })
    const saved = await this.centerRepo.save(entity)
    await this.auditService.record({ bizType: 'work_center', bizId: saved.id, action: 'CREATE_CENTER', afterValue: saved }, user)
    return saved
  }

  async listRoutings(query: QueryManufacturingDto, user: JwtUser): Promise<PageResult<RoutingEntity>> {
    const where = scopeWhere<RoutingEntity>({ tenantId: user.tenantId, isDeleted: 0, ...(query.productId ? { productId: query.productId } : {}) }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.routingRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async routingDetail(id: number, user: JwtUser): Promise<{ routing: RoutingEntity; operations: OperationEntity[] }> {
    const routing = await this.routingRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!routing) throw new NotFoundException('工艺路线不存在')
    const operations = await this.operationRepo.find({ where: { tenantId: user.tenantId, routingId: id }, order: { sortNo: 'ASC', id: 'ASC' } })
    return { routing, operations }
  }

  async createRouting(dto: CreateRoutingDto, user: JwtUser): Promise<RoutingEntity> {
    await this.findProduct(dto.productId, user)
    const validation = validateRouting(dto.operations.map((op) => ({
      sortNo: op.sortNo ?? 0,
      workCenterId: op.workCenterId ?? null,
      standardMinutes: Number(op.standardMinutes ?? 0)
    })))
    if (!validation.ok) throw new BadRequestException(validation.reason ?? '工艺路线校验失败')
    const routing = await this.routingRepo.save(this.routingRepo.create({
      tenantId: user.tenantId,
      productId: dto.productId,
      version: dto.version,
      effectiveFrom: dto.effectiveFrom ?? null,
      effectiveTo: dto.effectiveTo ?? null,
      createdBy: user.userId
    }))
    for (const operation of dto.operations) {
      await this.operationRepo.save(this.operationRepo.create({
        ...operation,
        tenantId: user.tenantId,
        routingId: routing.id,
        workCenterId: operation.workCenterId ?? null,
        standardMinutes: operation.standardMinutes ?? '0',
        sortNo: operation.sortNo ?? 0
      }))
    }
    await this.auditService.record({ bizType: 'routing', bizId: routing.id, action: 'CREATE_ROUTING', afterValue: routing }, user)
    return routing
  }

  /** 按日期查找生效的工艺版本（ACTIVE 且在生效区间内） */
  async findEffectiveRouting(productId: number, date: string, user: JwtUser): Promise<RoutingEntity | null> {
    const routings = await this.routingRepo.find({
      where: { tenantId: user.tenantId, productId, status: 'ACTIVE', isDeleted: 0 },
      order: { id: 'DESC' }
    })
    return routings.find((r) => isRoutingEffective(r.effectiveFrom, r.effectiveTo, date)) ?? null
  }

  async listMrpRuns(query: QueryManufacturingDto, user: JwtUser): Promise<PageResult<MrpRunEntity>> {
    const where = scopeWhere<MrpRunEntity>({ tenantId: user.tenantId }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.mrpRunRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async listMrpSuggests(runId: number, user: JwtUser): Promise<MrpSuggestEntity[]> {
    return this.mrpSuggestRepo.find({ where: scopeWhere<MrpSuggestEntity>({ tenantId: user.tenantId, runId }, user), order: { netQty: 'DESC' } })
  }

  async runMrp(dto: RunMrpDto, user: JwtUser): Promise<MrpRunEntity> {
    const saleLines = await this.saleLineRepo.find({ where: { tenantId: user.tenantId } })
    const purchaseLines = await this.purchaseLineRepo.find({ where: { tenantId: user.tenantId } })
    const purchaseDemands = await this.demandRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const allBalances = await this.balanceRepo.find({ where: { tenantId: user.tenantId } })
    const filterCheck = validateMrpFactoryFilter({
      factoryId: dto.factoryId ?? null,
      warehouseIds: dto.warehouseIds ?? []
    })
    if (!filterCheck.ok) throw new BadRequestException(filterCheck.reason)
    const balances = filterStockByFactories(allBalances, filterCheck.factoryWarehouseIds)
    const bomItems = await this.bomItemRepo.find({ where: { tenantId: user.tenantId } })
    const demand = new Map<number, number>()
    for (const line of saleLines) {
      const remain = this.num(line.qty) - this.num(line.shippedQty)
      if (remain > 0) demand.set(line.productId, (demand.get(line.productId) ?? 0) + remain)
    }
    // 采购需求合并：非草稿/取消的独立需求计入毛需求（与销售需求合并，保留来源）
    for (const item of purchaseDemands) {
      if (item.status === 'DRAFT' || item.status === 'CANCELLED') continue
      demand.set(item.productId, (demand.get(item.productId) ?? 0) + this.num(item.qty))
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

    // 安全库存来自库存预警策略：产品+仓库 > 产品 > 全局默认（此处按产品级策略取值）
    const policyRows = await this.alertPolicyRepo.find({ where: { tenantId: user.tenantId, status: 'ENABLED' } })
    const policies = policyRows.map((item) => ({
      productId: Number(item.productId),
      warehouseId: Number(item.warehouseId),
      warnDays: item.warnDays,
      urgentDays: item.urgentDays,
      safetyStock: this.num(item.safetyStock),
      slowMovingDays: item.slowMovingDays
    }))

    const results = [...new Set([...demand.keys(), ...onway.keys(), ...available.keys()])].map((productId) =>
      computeNetDemand({
        productId,
        grossQty: demand.get(productId) ?? 0,
        safetyQty: resolvePolicy(policies, productId, 0).safetyStock,
        availableQty: available.get(productId) ?? 0,
        onWayQty: onway.get(productId) ?? 0,
        allocatedQty: allocated.get(productId) ?? 0
      })
    )
    // BOM 缺料树展开：对顶层需求产品展开子件毛需求并计入建议
    const bomEntityIds = await this.bomRepo.find({ where: { tenantId: user.tenantId } })
    const bomProductMap = new Map(bomEntityIds.map((b) => [b.id, b.productId]))
    const edges = bomItems
      .map((item) => ({
        parentId: bomProductMap.get(item.bomId) ?? 0,
        childId: item.materialId,
        qtyPerUnit: this.num(item.qty)
      }))
      .filter((edge) => edge.parentId > 0)
    const shortageTree = new Map<number, number>()
    for (const [productId, grossQty] of demand) {
      if (grossQty <= 0) continue
      for (const [childId, qty] of explodeBom(productId, grossQty, edges)) {
        shortageTree.set(childId, (shortageTree.get(childId) ?? 0) + qty)
      }
    }
    const exceptions = mrpExceptions(results)

    const run = await this.mrpRunRepo.save(this.mrpRunRepo.create({
      tenantId: user.tenantId,
      runNo: this.number('MRP'),
      planDate: dto.planDate ?? null,
      params: {
        generatedAt: new Date().toISOString(),
        exceptionMessages: exceptions,
        shortageTree: Object.fromEntries([...shortageTree].map(([k, v]) => [String(k), Number(v.toFixed(4))])),
        demandSources: ['SALE_ORDER', 'PURCHASE_DEMAND'],
        factoryId: dto.factoryId ?? null,
        warehouseIds: filterCheck.factoryWarehouseIds
      },
      createdBy: user.userId
    }))

    for (const result of results) {
      await this.mrpSuggestRepo.save(this.mrpSuggestRepo.create({
        tenantId: user.tenantId,
        runId: run.id,
        productId: result.productId,
        demandQty: this.money(result.grossQty),
        availableQty: this.money(available.get(result.productId) ?? 0),
        onwayQty: this.money(onway.get(result.productId) ?? 0),
        allocatedQty: this.money(allocated.get(result.productId) ?? 0),
        netQty: this.money(result.netQty),
        suggestType: result.netQty > 0 ? 'PURCHASE' : 'NONE'
      }))
    }
    // 缺料树子件单独生成建议（不与顶层重复）
    for (const [childId, qty] of shortageTree) {
      if (results.some((r) => r.productId === childId)) continue
      await this.mrpSuggestRepo.save(this.mrpSuggestRepo.create({
        tenantId: user.tenantId,
        runId: run.id,
        productId: childId,
        demandQty: this.money(qty),
        availableQty: '0', onwayQty: '0', allocatedQty: '0',
        netQty: this.money(qty),
        suggestType: 'PURCHASE'
      }))
    }
    let generatedDemands = 0
    if (dto.generateDemands === true) {
      generatedDemands = await this.generatePurchaseDemands(run.id, user)
    }
    await this.auditService.record({
      bizType: 'mrp_run', bizId: run.id, action: 'RUN_MRP',
      afterValue: { runNo: run.runNo, exceptions: exceptions.length, generatedDemands }
    }, user)
    return run
  }

  /** 按 MRP 采购建议自动生成采购需求（幂等：同一 run 仅生成一次） */
  async generatePurchaseDemands(runId: number, user: JwtUser): Promise<number> {
    const run = await this.mrpRunRepo.findOne({ where: { id: runId, tenantId: user.tenantId } })
    if (!run) throw new NotFoundException('MRP 运行记录不存在')
    const existing = await this.demandRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    if (existing.some((item) => item.sourceType === 'MRP' && item.sourceId === runId)) return 0
    const suggests = await this.mrpSuggestRepo.find({ where: { tenantId: user.tenantId, runId } })
    const rows = mergeDemandRows(buildDemandsFromMrp(
      suggests.map((item) => ({
        productId: item.productId,
        netQty: this.num(item.netQty),
        suggestType: item.suggestType
      }))
    ))
    for (const row of rows) {
      await this.demandRepo.save(this.demandRepo.create({
        tenantId: user.tenantId,
        demandNo: this.number('PD'),
        productId: row.productId,
        qty: row.qty.toFixed(3),
        sourceType: 'MRP',
        sourceId: runId,
        sourceRunNo: run.runNo,
        status: 'CONFIRMED',
        createdBy: user.userId
      }))
    }
    await this.auditService.record({
      bizType: 'purchase_demand', bizId: runId, action: 'GENERATE_DEMANDS_FROM_MRP',
      afterValue: { runNo: run.runNo, demandCount: rows.length }
    }, user)
    return rows.length
  }

  async listPlanTasks(query: QueryManufacturingDto, user: JwtUser): Promise<PageResult<PlanTaskEntity>> {
    const where = scopeWhere<PlanTaskEntity>({ tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.planTaskRepo.findAndCount({ where, order: { startAt: 'ASC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createPlanTasks(dto: CreatePlanTaskDto, user: JwtUser): Promise<PlanTaskEntity[]> {
    const saved: PlanTaskEntity[] = []
    for (const task of dto.tasks) {
      const entity = await this.planTaskRepo.save(this.planTaskRepo.create({
        ...task,
        tenantId: user.tenantId,
        workOrderId: task.workOrderId ?? null,
        workCenterId: task.workCenterId ?? null,
        startAt: new Date(task.startAt),
        endAt: new Date(task.endAt),
        createdBy: user.userId
      }))
      saved.push(entity)
    }
    await this.auditService.record({ bizType: 'plan_task', action: 'CREATE_PLAN_TASKS', afterValue: { count: saved.length } }, user)
    return saved
  }

  async updatePlanTask(id: number, dto: UpdatePlanTaskDto, user: JwtUser): Promise<PlanTaskEntity> {
    const entity = await this.planTaskRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('计划任务不存在')
    if (entity.locked === 1) throw new BadRequestException('排产任务已锁定，不可拖拽或改期')
    const before = { ...entity }
    if (dto.startAt) entity.startAt = new Date(dto.startAt)
    if (dto.endAt) entity.endAt = new Date(dto.endAt)
    if (dto.taskName) entity.taskName = dto.taskName
    if (dto.workCenterId !== undefined) entity.workCenterId = dto.workCenterId ? Number(dto.workCenterId) : null
    if (dto.status) entity.status = dto.status
    const saved = await this.planTaskRepo.save(entity)
    await this.auditService.record({ bizType: 'plan_task', bizId: id, action: 'UPDATE_PLAN_TASK', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  async removePlanTask(id: number, user: JwtUser): Promise<{ deleted: boolean }> {
    const entity = await this.planTaskRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('计划任务不存在')
    await this.planTaskRepo.remove(entity)
    await this.auditService.record({ bizType: 'plan_task', bizId: id, action: 'DELETE_PLAN_TASK', beforeValue: entity }, user)
    return { deleted: true }
  }

  async listWorkOrders(query: QueryManufacturingDto, user: JwtUser): Promise<PageResult<WorkOrderEntity>> {
    const where = scopeWhere<WorkOrderEntity>({ tenantId: user.tenantId, isDeleted: 0, ...(query.status ? { status: query.status } : {}), ...(query.productId ? { productId: query.productId } : {}) }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.workOrderRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async workOrderDetail(id: number, user: JwtUser): Promise<Record<string, unknown>> {
    const workOrder = await this.findWorkOrder(id, user)
    const [issues, reports, completes] = await Promise.all([
      this.issueRepo.find({ where: { tenantId: user.tenantId, workOrderId: id }, order: { id: 'ASC' } }),
      this.reportRepo.find({ where: { tenantId: user.tenantId, workOrderId: id }, order: { id: 'ASC' } }),
      this.completeRepo.find({ where: { tenantId: user.tenantId, workOrderId: id }, order: { id: 'ASC' } })
    ])
    return { workOrder, issues, reports, completes }
  }

  async createWorkOrder(dto: CreateWorkOrderDto, user: JwtUser): Promise<WorkOrderEntity> {
    await this.findProduct(dto.productId, user)
    await this.findWarehouse(dto.warehouseId, user)
    if (dto.bomId) await this.bomRepo.findOne({ where: { id: dto.bomId, tenantId: user.tenantId } })
    if (dto.routingId) await this.routingRepo.findOne({ where: { id: dto.routingId, tenantId: user.tenantId } })
    const entity = this.workOrderRepo.create({
      ...dto,
      tenantId: user.tenantId,
      bomId: dto.bomId ?? null,
      routingId: dto.routingId ?? null,
      planStart: dto.planStart ? new Date(dto.planStart) : null,
      planEnd: dto.planEnd ? new Date(dto.planEnd) : null,
      createdBy: user.userId
    })
    const saved = await this.workOrderRepo.save(entity)
    await this.auditService.record({ bizType: 'work_order', bizId: saved.id, action: 'CREATE_WORK_ORDER', afterValue: saved }, user)
    return saved
  }

  async updateWorkOrder(id: number, dto: UpdateWorkOrderDto, user: JwtUser): Promise<WorkOrderEntity> {
    const entity = await this.findWorkOrder(id, user)
    const before = { ...entity }
    const after: Record<string, unknown> = { ...before }
    if (dto.planStart) after.planStart = new Date(dto.planStart)
    if (dto.planEnd) after.planEnd = new Date(dto.planEnd)
    if (dto.status) after.status = dto.status
    assertBizEditable(before, after, ['status', 'planStart', 'planEnd'], { status: entity.status })
    if (dto.planStart) entity.planStart = new Date(dto.planStart)
    if (dto.planEnd) entity.planEnd = new Date(dto.planEnd)
    if (dto.status) entity.status = dto.status
    entity.updatedAt = new Date()
    const saved = await this.workOrderRepo.save(entity)
    await this.auditService.record({ bizType: 'work_order', bizId: id, action: 'UPDATE_WORK_ORDER', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  /**
   * 齐套检查：按工单 BOM 展开子件需求，对比库存可用量。
   * 未齐套默认阻止提交（allowShortage 时需审批，此处如实记录缺料）。
   */
  async checkWorkOrderKitting(id: number, user: JwtUser): Promise<{
    complete: boolean
    shortfalls: Array<{ materialId: number; short: number }>
  }> {
    const order = await this.findWorkOrder(id, user)
    if (!order.bomId) return { complete: true, shortfalls: [] }
    const items = await this.bomItemRepo.find({ where: { tenantId: user.tenantId, bomId: order.bomId } })
    const balances = await this.balanceRepo.find({ where: { tenantId: user.tenantId } })
    const qty = this.num(order.qty)
    const materials = items.map((item) => {
      const balance = balances.find((b) => b.productId === item.materialId)
      const available = balance
        ? this.num(balance.qtyOnHand) - this.num(balance.qtyOccupied) - this.num(balance.qtyFrozen)
        : 0
      return {
        materialId: item.materialId,
        requiredQty: qty * this.num(item.qty),
        availableQty: Math.max(0, available)
      }
    })
    return checkKitting(materials)
  }

  async submitWorkOrder(id: number, user: JwtUser): Promise<WorkOrderEntity> {
    const order = await this.findWorkOrder(id, user)
    if (!canTransition('work_order', order.status, 'SUBMITTED')) throw new BadRequestException('只有草稿工单可以提交')
    const kitting = await this.checkWorkOrderKitting(id, user)
    if (!kitting.complete) {
      const detail = kitting.shortfalls.map((s) => `物料 ${s.materialId} 缺 ${s.short}`).join('；')
      throw new BadRequestException(`工单未齐套，禁止提交：${detail}`)
    }
    order.status = 'SUBMITTED'
    const saved = await this.workOrderRepo.save(order)
    await this.auditService.record({ bizType: 'work_order', bizId: id, action: 'SUBMIT_WORK_ORDER' }, user)
    // 统一版本快照：工单提交时锁定排产依据，避免后续改单影响在途生产
    await this.revisionService.recordSafe({
      entityCode: 'WORK_ORDER',
      bizId: saved.id,
      action: 'SUBMIT',
      source: 'MANUFACTURING',
      snapshot: {
        orderNo: saved.orderNo,
        status: saved.status,
        productId: saved.productId,
        bomId: saved.bomId ?? null,
        routingId: saved.routingId ?? null,
        warehouseId: saved.warehouseId,
        qty: saved.qty,
        planStart: saved.planStart ?? null,
        planEnd: saved.planEnd ?? null,
        changeVersion: saved.changeVersion,
        remark: saved.remark ?? null
      }
    }, user)
    return saved
  }

  async approveWorkOrder(id: number, user: JwtUser): Promise<WorkOrderEntity> {
    const order = await this.findWorkOrder(id, user)
    if (!canTransition('work_order', order.status, 'APPROVED')) throw new BadRequestException('只有已提交工单可以审核')
    order.status = 'APPROVED'
    const saved = await this.workOrderRepo.save(order)
    await this.auditService.record({ bizType: 'work_order', bizId: id, action: 'APPROVE_WORK_ORDER' }, user)
    return saved
  }

  async issue(id: number, dto: IssueDto, user: JwtUser): Promise<WorkOrderIssueEntity> {
    const order = await this.findWorkOrder(id, user)
    if (!['APPROVED', 'RUNNING', 'PARTIAL'].includes(order.status)) throw new BadRequestException('工单未进入生产状态')
    // 扫码校验：条码中的产品/批次必须与领料单一致
    if (dto.scanCode?.trim()) {
      const parsed = parseScanCode(dto.scanCode)
      if (!parsed.ok) throw new BadRequestException(parsed.reason ?? '条码无法识别')
      if (parsed.batchNo && dto.batchNo && parsed.batchNo !== dto.batchNo) throw new BadRequestException('条码批次与领料批次不一致')
    }
    // 超额领料校验：累计领料超过 BOM 应耗量需先审批
    let overApproved = 0
    if (dto.issueType === 'PICK') {
      const over = await this.checkOverIssue(id, dto.materialId, user)
      if (over.over) {
        const approvals = await this.overIssueRepo.find({ where: { tenantId: user.tenantId, workOrderId: id, materialId: dto.materialId, status: 'APPROVED' } })
        const allowed = approvals.reduce((sum, item) => sum + this.num(item.overQty), 0)
        const exceed = over.overQty - allowed
        if (exceed > 0) {
          throw new BadRequestException(`超额领料 ${exceed}，请先提交超额领料审批`)
        }
        overApproved = 1
      }
    }
    const entity = this.issueRepo.create({
      tenantId: user.tenantId,
      workOrderId: id,
      issueType: dto.issueType,
      materialId: dto.materialId,
      qty: dto.qty,
      batchNo: dto.batchNo ?? null,
      scanCode: dto.scanCode ?? null,
      overApproved,
      createdBy: user.userId
    })
    const saved = await this.issueRepo.save(entity)
    await this.inventoryService.postMovement({
      voucherType: dto.issueType === 'PICK' ? 'MFG_PICK' : 'MFG_RETURN',
      voucherId: id,
      voucherLineId: saved.id,
      warehouseId: order.warehouseId,
      productId: dto.materialId,
      batchNo: dto.batchNo ?? '',
      ...(dto.issueType === 'PICK' ? { qtyOut: dto.qty } : { qtyIn: dto.qty }),
      remark: `工单 ${order.orderNo} ${dto.issueType === 'PICK' ? '领料' : '退料'}`
    }, user)
    if (order.status === 'APPROVED') order.status = 'RUNNING'
    await this.workOrderRepo.save(order)
    await this.auditService.record({ bizType: 'work_order_issue', bizId: saved.id, action: 'CREATE_ISSUE', afterValue: saved }, user)
    return saved
  }

  async report(id: number, dto: ReportDto, user: JwtUser): Promise<WorkOrderReportEntity> {
    const order = await this.findWorkOrder(id, user)
    if (!['RUNNING', 'PARTIAL'].includes(order.status)) throw new BadRequestException('工单未进入报工状态')
    const entity = await this.reportRepo.save(this.reportRepo.create({
      tenantId: user.tenantId,
      workOrderId: id,
      operationId: dto.operationId ?? null,
      qty: dto.qty,
      defectQty: dto.defectQty ?? '0',
      workHours: dto.workHours ?? '0',
      scanCode: dto.scanCode ?? null,
      userId: user.userId
    }))
    order.producedQty = this.money(this.num(order.producedQty) + this.num(dto.qty))
    await this.workOrderRepo.save(order)
    await this.auditService.record({ bizType: 'work_order_report', bizId: entity.id, action: 'REPORT_WORK', afterValue: entity }, user)
    return entity
  }

  async complete(id: number, dto: CompleteDto, user: JwtUser): Promise<WorkOrderCompleteEntity> {
    const order = await this.findWorkOrder(id, user)
    if (this.num(dto.qty) > this.num(order.producedQty)) throw new BadRequestException('完工数量超过已报工数量')
    const entity = await this.completeRepo.save(this.completeRepo.create({
      tenantId: user.tenantId,
      workOrderId: id,
      productId: order.productId,
      warehouseId: order.warehouseId,
      qty: dto.qty,
      qcResult: dto.qcResult ?? 'PENDING',
      createdBy: user.userId
    }))
    await this.inventoryService.postMovement({
      voucherType: 'FINISH_IN',
      voucherId: id,
      voucherLineId: entity.id,
      warehouseId: order.warehouseId,
      productId: order.productId,
      qtyIn: dto.qty,
      remark: `工单 ${order.orderNo} 完工入库`
    }, user)
    // 联副产品入库：按完工数量同步生成副产品流水
    for (const byProduct of dto.byProducts ?? []) {
      await this.inventoryService.postMovement({
        voucherType: 'BYPRODUCT_IN',
        voucherId: id,
        voucherLineId: entity.id,
        warehouseId: order.warehouseId,
        productId: byProduct.productId,
        qtyIn: byProduct.qty,
        remark: `工单 ${order.orderNo} 联副产品入库`
      }, user)
    }

    order.actualQty = this.money(this.num(order.actualQty) + this.num(dto.qty))
    order.status = this.num(order.actualQty) >= this.num(order.qty) ? 'DONE' : 'PARTIAL'
    await this.workOrderRepo.save(order)

    // 倒冲：完工时按 BOM 应耗量自动扣减子件库存（减去已领量）
    if (order.bomId) {
      const items = await this.bomItemRepo.find({ where: { tenantId: user.tenantId, bomId: order.bomId } })
      const issues = await this.issueRepo.find({ where: { tenantId: user.tenantId, workOrderId: id, issueType: 'PICK' } })
      const balances = await this.balanceRepo.find({ where: { tenantId: user.tenantId } })
      const backflushItems = computeBackflush(items.map((item) => {
        const issued = issues.filter((i) => i.materialId === item.materialId)
          .reduce((sum, i) => sum + this.num(i.qty), 0)
        const balance = balances.find((b) => b.productId === item.materialId)
        const available = balance ? this.num(balance.qtyOnHand) - this.num(balance.qtyOccupied) - this.num(balance.qtyFrozen) : 0
        return {
          materialId: item.materialId,
          requiredQty: this.num(dto.qty) * this.num(item.qty),
          alreadyIssuedQty: issued,
          availableQty: Math.max(0, available)
        }
      }))
      for (const item of backflushItems) {
        if (item.qty <= 0) continue
        if (!item.sufficient) throw new BadRequestException(`物料 ${item.materialId} 库存不足，无法倒冲 ${item.qty}，请先领料`)
        const issue = await this.issueRepo.save(this.issueRepo.create({
          tenantId: user.tenantId,
          workOrderId: id,
          issueType: 'BACKFLUSH',
          materialId: item.materialId,
          qty: this.money(item.qty),
          createdBy: user.userId
        }))
        await this.inventoryService.postMovement({
          voucherType: 'MFG_BACKFLUSH',
          voucherId: id,
          voucherLineId: issue.id,
          warehouseId: order.warehouseId,
          productId: item.materialId,
          qtyOut: this.money(item.qty),
          remark: `工单 ${order.orderNo} 倒冲`
        }, user)
      }
    }
    await this.auditService.record({ bizType: 'work_order_complete', bizId: entity.id, action: 'COMPLETE_WORK_ORDER', afterValue: entity }, user)
    return entity
  }

  /** 抽样建议：按批量与 AQL 级别给出建议样本量和允收不良数 */
  suggestSampling(lotQty: number, aql: 'NORMAL' | 'STRICT' | 'LOOSE' = 'NORMAL') {
    return samplingPlan(lotQty, aql)
  }

  async createQc(dto: CreateQcDto, user: JwtUser): Promise<QcEntity> {
    const sampleQty = this.num(dto.sampleQty ?? 0)
    const defectQty = this.num(dto.defectQty ?? 0)
    // 抽样判定：样本量>0 时按允收不良数自动判定，覆盖手填结果
    let result = dto.result
    if (sampleQty > 0) {
      const plan = samplingPlan(sampleQty)
      result = judgeSampling(defectQty, plan.acceptDefects)
    }
    const entity = this.qcRepo.create({ ...dto, tenantId: user.tenantId, sampleQty: dto.sampleQty ?? '0', defectQty: dto.defectQty ?? '0', result, inspectorId: user.userId })
    const saved = await this.qcRepo.save(entity)
    if (result === 'FAIL' && dto.bizType === 'WORK_ORDER_COMPLETE') {
      const complete = await this.completeRepo.findOne({ where: { id: dto.bizId, tenantId: user.tenantId } })
      if (complete) await this.inventoryService.freezeStock(complete.warehouseId, complete.productId, complete.qty, user)
    }
    await this.auditService.record({ bizType: 'mes_qc', bizId: saved.id, action: 'CREATE_QC', afterValue: saved }, user)
    return saved
  }

  /** 让步接收：不合格批次经审批后解冻放行 */
  async concessionQc(id: number, reason: string, user: JwtUser): Promise<QcEntity> {
    const entity = await this.qcRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('质检记录不存在')
    const check = canConcession(entity.result, user.userId, false)
    if (!check.ok) throw new BadRequestException(check.reason ?? '不可让步接收')
    if (!reason?.trim()) throw new BadRequestException('让步接收必须填写原因')
    entity.concessionBy = user.userId
    entity.concessionReason = reason.trim()
    entity.concessionAt = new Date()
    entity.result = 'CONCESSION'
    const saved = await this.qcRepo.save(entity)
    // 解冻之前因质检失败冻结的库存
    if (entity.bizType === 'WORK_ORDER_COMPLETE') {
      const complete = await this.completeRepo.findOne({ where: { id: entity.bizId, tenantId: user.tenantId } })
      if (complete) {
        await this.inventoryService.unfreezeStock(complete.warehouseId, complete.productId, complete.qty, user)
      }
    }
    await this.auditService.record({ bizType: 'mes_qc', bizId: id, action: 'CONCESSION_QC', afterValue: { reason } }, user)
    return saved
  }

  async listQcs(query: QueryManufacturingDto, user: JwtUser): Promise<PageResult<QcEntity>> {
    const where = scopeWhere<QcEntity>({ tenantId: user.tenantId }, user)
    const [list, total] = await this.qcRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async listEquipment(query: QueryManufacturingDto, user: JwtUser): Promise<PageResult<EquipmentEntity>> {
    const where = scopeWhere<EquipmentEntity>({ tenantId: user.tenantId, isDeleted: 0 }, user)
    const [list, total] = await this.equipmentRepo.findAndCount({ where, order: { id: 'ASC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createEquipment(dto: CreateEquipmentDto, user: JwtUser): Promise<EquipmentEntity> {
    const entity = this.equipmentRepo.create({ ...dto, tenantId: user.tenantId, workCenterId: dto.workCenterId ?? null, oee: dto.oee ?? '0', lastMaintenance: dto.lastMaintenance ?? null })
    const saved = await this.equipmentRepo.save(entity)
    await this.auditService.record({ bizType: 'mes_equipment', bizId: saved.id, action: 'CREATE_EQUIPMENT', afterValue: saved }, user)
    return saved
  }

  /** 设备点检：记录可用率/性能/质量并自动计算 OEE，同步更新设备主档 */
  async inspectEquipment(
    equipmentId: number,
    dto: { availability: number; performanceRate: number; qualityRate: number; result?: string; remark?: string },
    user: JwtUser
  ): Promise<EquipmentInspectionEntity> {
    const equipment = await this.equipmentRepo.findOne({ where: { id: equipmentId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!equipment) throw new NotFoundException('设备不存在')
    const oee = computeOee(dto.availability, dto.performanceRate, dto.qualityRate)
    const entity = await this.inspectionRepo.save(this.inspectionRepo.create({
      tenantId: user.tenantId,
      equipmentId,
      availability: String(dto.availability),
      performanceRate: String(dto.performanceRate),
      qualityRate: String(dto.qualityRate),
      oee: String(oee),
      result: dto.result ?? 'NORMAL',
      remark: dto.remark ?? null,
      inspectorId: user.userId,
      inspectAt: new Date()
    }))
    equipment.oee = String(oee)
    await this.equipmentRepo.save(equipment)
    await this.auditService.record({ bizType: 'mes_equipment', bizId: equipmentId, action: 'INSPECT_EQUIPMENT', afterValue: { oee } }, user)
    return entity
  }

  /** 保养到期提醒：扫描 devices 的 lastMaintenance 与周期 */
  async maintenanceAlerts(cycleDays: number, user: JwtUser): Promise<Array<{ equipmentId: number; overdueDays: number }>> {
    const equipments = await this.equipmentRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const alerts: Array<{ equipmentId: number; overdueDays: number }> = []
    for (const equipment of equipments) {
      const result = maintenanceDue(equipment.lastMaintenance, cycleDays)
      if (result.due) alerts.push({ equipmentId: equipment.id, overdueDays: result.overdueDays })
    }
    return alerts
  }

  async listExceptions(query: QueryManufacturingDto, user: JwtUser): Promise<PageResult<ProductionExceptionEntity>> {
    const where = scopeWhere<ProductionExceptionEntity>({ tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.exceptionRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createException(dto: CreateExceptionDto, user: JwtUser): Promise<ProductionExceptionEntity> {
    const entity = this.exceptionRepo.create({
      tenantId: user.tenantId,
      exceptionNo: this.number('EX'),
      exceptionType: dto.exceptionType,
      workOrderId: dto.workOrderId ?? null,
      reason: dto.reason ?? null,
      createdBy: user.userId
    })
    const saved = await this.exceptionRepo.save(entity)
    await this.auditService.record({ bizType: 'production_exception', bizId: saved.id, action: 'CREATE_EXCEPTION', afterValue: saved }, user)
    return saved
  }

  async closeException(id: number, dto: CloseExceptionDto, user: JwtUser): Promise<ProductionExceptionEntity> {
    const entity = await this.exceptionRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('生产异常不存在')
    entity.status = 'CLOSED'
    entity.closedNote = dto.closedNote
    const saved = await this.exceptionRepo.save(entity)
    await this.auditService.record({ bizType: 'production_exception', bizId: id, action: 'CLOSE_EXCEPTION', afterValue: saved }, user)
    return saved
  }

  async reportSummary(user: JwtUser): Promise<Record<string, unknown>> {
    const orders = await this.workOrderRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const reports = await this.reportRepo.find({ where: { tenantId: user.tenantId } })
    const exceptions = await this.exceptionRepo.find({ where: { tenantId: user.tenantId, status: 'OPEN' } })
    return {
      workOrderCount: orders.length,
      doneCount: orders.filter((item) => item.status === 'DONE').length,
      producedQty: this.money(orders.reduce((sum, item) => sum + this.num(item.producedQty), 0)),
      actualQty: this.money(orders.reduce((sum, item) => sum + this.num(item.actualQty), 0)),
      defectQty: this.money(reports.reduce((sum, item) => sum + this.num(item.defectQty), 0)),
      openExceptions: exceptions.length
    }
  }

  private number(prefix: string): string {
    return `${prefix}${`${Date.now().toString(36)}${randomBytes(2).toString('hex')}`.toUpperCase()}`
  }

  private num(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  private money(value: number): string { return value.toFixed(3) }

  /** 超额领料预检：按 BOM 应耗量（含损耗率）计算累计领料与超额数量 */
  private async checkOverIssue(workOrderId: number, materialId: number, user: JwtUser): Promise<ReturnType<typeof evaluateOverIssue>> {
    const order = await this.findWorkOrder(workOrderId, user)
    let required = 0
    if (order.bomId) {
      const item = await this.bomItemRepo.findOne({ where: { tenantId: user.tenantId, bomId: order.bomId, materialId } })
      if (item) {
        const perUnit = this.num(item.qty) * (1 + this.num(item.lossRate) / 100)
        required = Number((this.num(order.qty) * perUnit).toFixed(4))
      }
    }
    const issues = await this.issueRepo.find({ where: { tenantId: user.tenantId, workOrderId, materialId } })
    const issued = issues
      .filter((issue) => issue.issueType === 'PICK')
      .reduce((sum, issue) => sum + this.num(issue.qty), 0)
    return evaluateOverIssue(issued, required)
  }

  private async findProduct(id: number, user: JwtUser): Promise<ProductEntity> {
    const entity = await this.productRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('产品不存在')
    return entity
  }

  private async findWarehouse(id: number, user: JwtUser): Promise<WarehouseEntity> {
    const entity = await this.warehouseRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('仓库不存在')
    return entity
  }

  private async findWorkOrder(id: number, user: JwtUser): Promise<WorkOrderEntity> {
    const entity = await this.workOrderRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('工单不存在')
    return entity
  }

  /* ------------------------------ 生产退料单 ------------------------------ */

  /** 退料单列表 */
  async listMaterialReturns(query: QueryMaterialReturnDto, user: JwtUser): Promise<PageResult<MesMaterialReturnEntity>> {
    const where = scopeWhere<MesMaterialReturnEntity>({
      tenantId: user.tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.workOrderId ? { workOrderId: query.workOrderId } : {})
    }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.materialReturnRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 退料单明细（含行） */
  async materialReturnDetail(id: number, user: JwtUser): Promise<{ order: MesMaterialReturnEntity; lines: MesMaterialReturnLineEntity[] }> {
    const order = await this.findMaterialReturn(id, user)
    const lines = await this.materialReturnLineRepo.find({ where: { tenantId: user.tenantId, returnId: id }, order: { id: 'ASC' } })
    return { order, lines }
  }

  /** 创建退料单：校验累计退料量不得超过已领料量 */
  async createMaterialReturn(dto: CreateMaterialReturnDto, user: JwtUser): Promise<MesMaterialReturnEntity> {
    const workOrder = await this.findWorkOrder(dto.workOrderId, user)
    const issued = await this.issueRepo.find({ where: { tenantId: user.tenantId, workOrderId: workOrder.id } })
    const netIssued = new Map<number, number>()
    for (const issue of issued) {
      const qty = Number(issue.qty ?? 0)
      const current = netIssued.get(issue.materialId) ?? 0
      netIssued.set(issue.materialId, issue.issueType === 'RETURN' ? current - qty : current + qty)
    }
    const posted = await this.materialReturnRepo.find({ where: { tenantId: user.tenantId, status: 'POSTED' } })
    const postedIds = posted.map((item) => item.id)
    const postedLines = postedIds.length > 0
      ? await this.materialReturnLineRepo.find({ where: { tenantId: user.tenantId, returnId: In(postedIds) } })
      : []
    const returned = new Map<number, number>()
    for (const line of postedLines) {
      returned.set(line.materialId, (returned.get(line.materialId) ?? 0) + Number(line.qty ?? 0))
    }
    const lines: Array<{ materialId: number; qty: string; batchNo: string | null; remark: string | null }> = []
    let totalQty = 0
    for (const item of dto.lines) {
      const check = evaluateMaterialReturn({
        issuedQty: netIssued.get(item.materialId) ?? 0,
        returningQty: Number(item.qty),
        alreadyReturnedQty: returned.get(item.materialId) ?? 0
      })
      if (!check.ok) throw new BadRequestException(check.reason)
      totalQty += Number(item.qty)
      lines.push({ materialId: item.materialId, qty: item.qty, batchNo: item.batchNo ?? null, remark: item.remark ?? null })
    }
    const order = await this.materialReturnRepo.save(this.materialReturnRepo.create({
      tenantId: user.tenantId,
      returnNo: this.materialReturnNo(),
      workOrderId: workOrder.id,
      warehouseId: dto.warehouseId ?? workOrder.warehouseId,
      status: 'DRAFT',
      totalQty: totalQty.toFixed(3),
      reason: dto.reason ?? null,
      createdBy: user.userId
    }))
    for (const line of lines) {
      await this.materialReturnLineRepo.save(this.materialReturnLineRepo.create({
        tenantId: user.tenantId,
        returnId: order.id,
        materialId: line.materialId,
        qty: line.qty,
        batchNo: line.batchNo,
        remark: line.remark
      }))
    }
    await this.auditService.record({
      bizType: 'mes_material_return', bizId: order.id, action: 'CREATE_MATERIAL_RETURN',
      afterValue: { returnNo: order.returnNo, workOrderId: workOrder.id, totalQty: order.totalQty }
    }, user)
    return order
  }

  /** 退料过账：物料回流入库 */
  async postMaterialReturn(id: number, user: JwtUser): Promise<MesMaterialReturnEntity> {
    const order = await this.findMaterialReturn(id, user)
    if (order.status !== 'DRAFT') throw new BadRequestException('仅草稿退料单可过账')
    const lines = await this.materialReturnLineRepo.find({ where: { tenantId: user.tenantId, returnId: id }, order: { id: 'ASC' } })
    if (lines.length === 0) throw new BadRequestException('退料单没有明细行')
    for (const line of lines) {
      await this.inventoryService.postMovement({
        voucherType: 'MATERIAL_RETURN',
        voucherId: order.id,
        warehouseId: order.warehouseId as number,
        productId: line.materialId,
        batchNo: line.batchNo ?? undefined,
        qtyIn: line.qty,
        remark: line.remark ?? `生产退料 ${order.returnNo}`
      }, user)
    }
    order.status = 'POSTED'
    order.postedAt = new Date()
    const saved = await this.materialReturnRepo.save(order)
    await this.auditService.record({
      bizType: 'mes_material_return', bizId: saved.id, action: 'POST_MATERIAL_RETURN',
      afterValue: { returnNo: saved.returnNo, lineCount: lines.length }
    }, user)
    return saved
  }

  /** 作废退料单（仅草稿） */
  async cancelMaterialReturn(id: number, user: JwtUser): Promise<MesMaterialReturnEntity> {
    const order = await this.findMaterialReturn(id, user)
    if (order.status !== 'DRAFT') throw new BadRequestException('仅草稿退料单可作废')
    order.status = 'CANCELLED'
    const saved = await this.materialReturnRepo.save(order)
    await this.auditService.record({
      bizType: 'mes_material_return', bizId: saved.id, action: 'CANCEL_MATERIAL_RETURN',
      afterValue: { returnNo: saved.returnNo }
    }, user)
    return saved
  }

  private async findMaterialReturn(id: number, user: JwtUser): Promise<MesMaterialReturnEntity> {
    const entity = await this.materialReturnRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('退料单不存在')
    return entity
  }

  /**
   * 需求汇总：按产品聚合毛需求（MRP 建议，无 MRP 时取销售未交量）、现有库存与在途量，
   * 得出净需求与建议采购/生产数量。
   */
  async demandSummary(user: JwtUser): Promise<{
    runId: number | null
    rows: DemandSummaryRow[]
    totalNetDemand: number
    totalSuggestedQty: number
  }> {
    const runs = await this.mrpRunRepo.find({ where: { tenantId: user.tenantId }, order: { id: 'DESC' }, take: 1 })
    const run = runs[0]
    const suggests = run
      ? await this.mrpSuggestRepo.find({ where: { tenantId: user.tenantId, runId: run.id } })
      : []
    const balances = await this.balanceRepo.find({ where: { tenantId: user.tenantId } })
    const onHand = new Map<number, number>()
    for (const item of balances) onHand.set(item.productId, (onHand.get(item.productId) ?? 0) + Number(item.qtyOnHand ?? 0))
    const saleLines = await this.saleLineRepo.find({ where: { tenantId: user.tenantId } })
    const openDemand = new Map<number, number>()
    for (const line of saleLines) {
      const open = Number(line.qty ?? 0) - Number(line.shippedQty ?? 0)
      if (open > 0) openDemand.set(line.productId, (openDemand.get(line.productId) ?? 0) + open)
    }
    const inputs = new Map<number, { productId: number; grossDemand: number; onHand: number; inTransit: number }>()
    const ensure = (productId: number): { productId: number; grossDemand: number; onHand: number; inTransit: number } => {
      const current = inputs.get(productId) ?? { productId, grossDemand: 0, onHand: 0, inTransit: 0 }
      inputs.set(productId, current)
      return current
    }
    if (suggests.length > 0) {
      for (const item of suggests) {
        const row = ensure(item.productId)
        row.grossDemand += Number(item.demandQty ?? 0)
        row.inTransit += Number(item.onwayQty ?? 0)
      }
    } else {
      for (const [productId, qty] of openDemand) ensure(productId).grossDemand += qty
    }
    for (const [productId, qty] of onHand) ensure(productId).onHand = qty
    const products = await this.productRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const productMap = new Map(products.map((item) => [item.id, item]))
    const rows = buildDemandSummary([...inputs.values()].map((item) => ({
      productId: item.productId,
      productCode: productMap.get(item.productId)?.productCode,
      productName: productMap.get(item.productId)?.productName,
      grossDemand: item.grossDemand,
      onHand: item.onHand,
      inTransit: item.inTransit
    })))
    const totalNetDemand = Number(rows.reduce((sum, item) => sum + item.netDemand, 0).toFixed(3))
    const totalSuggestedQty = Number(rows.reduce((sum, item) => sum + item.suggestedQty, 0).toFixed(3))
    return { runId: run?.id ?? null, rows, totalNetDemand, totalSuggestedQty }
  }

  private materialReturnNo(): string {
    const suffix = `${Date.now().toString(36)}${randomBytes(2).toString('hex')}`.toUpperCase()
    return `MRN${suffix}`
  }
}
