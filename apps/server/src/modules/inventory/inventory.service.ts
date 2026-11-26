import { randomBytes } from 'node:crypto'
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import type Redis from 'ioredis'
import { DataSource, type EntityManager, In, MoreThan, Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { scopeWhere } from '../../common/data-scope-context'
import { recallList, traceBackward, traceForward, type TraceEntry } from '../../common/trace-engine'
import { canTransitionTransfer, TRANSFER_STATUS, type TransferStatus } from '../../common/business-closure-engine'
import { computeStocktakeLines } from '../../common/production-rules'
import {
  abcAnalysis, buildPutawayRules, inTransitSummary, inventoryAging, optimizePickPath,
  putawayStrategyMatch, stockInOutReport, type PutawayRuleType
} from '../../common/inventory-extension-engine'
import {
  allocateAssemblyCost, applyStocktakeScans, buildBatchLocationMatrix, computeAvailableQty,
  evaluateTransferReceipt, type BalanceMatrixRow, type StocktakeScanResult
} from '../../common/inventory-ops-engine'
import { buildWaveReviewPlan, checkWaveShippable } from '../../common/sales-delivery-engine'
import { AuditService } from '../audit/audit.service'
import { ConfigService } from '../config/config.service'
import { IoService } from '../io/io.service'
import type { ExportConfig } from '../io/io.types'
import { createDomainEvent, DomainEventBus } from '../events/domain-event.module'
import { ProductEntity } from '../master-data/entities/product.entity'
import { WarehouseEntity } from '../master-data/entities/warehouse.entity'
import {
  canCancelAdjustment, canPostAdjustment, validateAdjustmentLines, type AdjustmentLineInput
} from '../../common/stock-adjustment-rules'
import {
  computeMovingWeightedCost, isCostingMethod, resolveOutboundCost, validateCostingMethodChange,
  type CostingMethod
} from '../../common/inventory-costing-rules'
import {
  ALLOW_NEGATIVE_STOCK_KEY, ALLOW_NEGATIVE_STOCK_PERM, evaluateNegativeStock,
  resolveAllowNegativeStock, summarizeNegativeStock, type NegativeStockEvaluation
} from '../../common/negative-stock-rules'
import {
  canApproveStocktakeDiff, canRejectStocktakeDiff, evaluateStocktakeApproval, summarizeStocktakeDiff,
  STOCKTAKE_STATUS, type StocktakeApprovalLine
} from '../../common/stocktake-approval-rules'
import {
  CreateAdjustmentDto, CreateAlertDto, CreateAssemblyDto, CreatePutawayDto, CreatePutawayStrategyDto,
  CreateStocktakeDto, CreateTransferDto, CreateWaveDto, InventoryReportDto, LockStockDto, PickDto,
  PostAdjustmentDto, PutawayRecommendDto, QueryInventoryDto, ReceiveTransferDto, ScanStocktakeDto,
  StockMovementDto
} from './dto'
import { StockAdjustmentEntity, StockAdjustmentLineEntity } from './entities/stock-adjustment.entity'
import { FinCostPeriodLockEntity, StockCostLayerEntity } from './entities/stock-cost-layer.entity'
import {
  StockAlertEntity, StockAssemblyEntity, StockAssemblyLineEntity, StockBalanceEntity,
  StockLedgerEntity, StockLockEntity, StocktakeEntity, StocktakeLineEntity,
  StockTransferEntity, StockTransferLineEntity, WmsPickTaskEntity, WmsPickWaveEntity, WmsPutawayEntity,
  WmsPutawayStrategyEntity
} from './entities/inventory.entities'

const STOCK_LOCK_TTL_SECONDS = 30
const RELEASE_STOCK_LOCK_SCRIPT = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end"

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(StockBalanceEntity) private readonly balanceRepo: Repository<StockBalanceEntity>,
    @InjectRepository(StockLedgerEntity) private readonly ledgerRepo: Repository<StockLedgerEntity>,
    @InjectRepository(StockLockEntity) private readonly lockRepo: Repository<StockLockEntity>,
    @InjectRepository(StockAlertEntity) private readonly alertRepo: Repository<StockAlertEntity>,
    @InjectRepository(StocktakeEntity) private readonly stocktakeRepo: Repository<StocktakeEntity>,
    @InjectRepository(StocktakeLineEntity) private readonly stocktakeLineRepo: Repository<StocktakeLineEntity>,
    @InjectRepository(StockTransferEntity) private readonly transferRepo: Repository<StockTransferEntity>,
    @InjectRepository(StockTransferLineEntity) private readonly transferLineRepo: Repository<StockTransferLineEntity>,
    @InjectRepository(WmsPutawayEntity) private readonly putawayRepo: Repository<WmsPutawayEntity>,
    @InjectRepository(WmsPutawayStrategyEntity) private readonly putawayStrategyRepo: Repository<WmsPutawayStrategyEntity>,
    @InjectRepository(WmsPickWaveEntity) private readonly waveRepo: Repository<WmsPickWaveEntity>,
    @InjectRepository(WmsPickTaskEntity) private readonly pickTaskRepo: Repository<WmsPickTaskEntity>,
    @InjectRepository(StockAssemblyEntity) private readonly assemblyRepo: Repository<StockAssemblyEntity>,
    @InjectRepository(StockAssemblyLineEntity) private readonly assemblyLineRepo: Repository<StockAssemblyLineEntity>,
    @InjectRepository(StockAdjustmentEntity) private readonly adjustmentRepo: Repository<StockAdjustmentEntity>,
    @InjectRepository(StockAdjustmentLineEntity) private readonly adjustmentLineRepo: Repository<StockAdjustmentLineEntity>,
    @InjectRepository(StockCostLayerEntity) private readonly costLayerRepo: Repository<StockCostLayerEntity>,
    @InjectRepository(FinCostPeriodLockEntity) private readonly costPeriodLockRepo: Repository<FinCostPeriodLockEntity>,
    private readonly configService: ConfigService,
    @InjectRepository(ProductEntity) private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(WarehouseEntity) private readonly warehouseRepo: Repository<WarehouseEntity>,
    private readonly auditService: AuditService,
    private readonly eventBus: DomainEventBus,
    private readonly dataSource: DataSource,
    private readonly ioService: IoService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis
  ) {}

  async listBalances(query: QueryInventoryDto, user: JwtUser): Promise<PageResult<StockBalanceEntity>> {
    const where = scopeWhere<StockBalanceEntity>({
      tenantId: user.tenantId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productId ? { productId: query.productId } : {})
    }, user)
    const [list, total] = await this.balanceRepo.findAndCount({ where, order: { productId: 'ASC', id: 'ASC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async listLedger(query: QueryInventoryDto, user: JwtUser): Promise<PageResult<StockLedgerEntity>> {
    const where = scopeWhere<StockLedgerEntity>({
      tenantId: user.tenantId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.voucherType ? { voucherType: query.voucherType } : {}),
      ...(query.batchNo ? { batchNo: query.batchNo } : {})
    }, user)
    const [list, total] = await this.ledgerRepo.findAndCount({ where, order: { occurredAt: 'DESC', id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 库存流水导出：带水印与导出审计，仅导出当前数据权限范围内流水 */
  async exportLedger(query: QueryInventoryDto, user: JwtUser): Promise<{ filename: string; content: string }> {
    const where = scopeWhere<StockLedgerEntity>({
      tenantId: user.tenantId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.voucherType ? { voucherType: query.voucherType } : {}),
      ...(query.batchNo ? { batchNo: query.batchNo } : {})
    }, user)
    const rows = await this.ledgerRepo.find({ where, order: { occurredAt: 'DESC', id: 'DESC' }, take: 5000 })
    const config: ExportConfig<Record<string, unknown>> = {
      code: 'inventory_ledger',
      name: '库存流水',
      fields: [
        { header: '单据类型', key: 'voucherType' },
        { header: '单据ID', key: 'voucherId' },
        { header: '仓库ID', key: 'warehouseId' },
        { header: '库位ID', key: 'locationId' },
        { header: '产品ID', key: 'productId' },
        { header: '规格ID', key: 'variantId' },
        { header: '批次号', key: 'batchNo' },
        { header: '入库数量', key: 'qtyIn' },
        { header: '出库数量', key: 'qtyOut' },
        { header: '结存数量', key: 'balanceQty' },
        { header: '成本', key: 'cost' },
        { header: '发生时间', key: 'occurredAt', format: (value) => (value instanceof Date ? value.toISOString() : String(value ?? '')) },
        { header: '来源凭证追溯', key: 'voucherId', format: (_value, row) => `${String(row.voucherType ?? '')}-${String(row.voucherId ?? '')}` },
        { header: '备注', key: 'remark' }
      ]
    }
    const records = rows.map((row) => ({ ...row }) as unknown as Record<string, unknown>)
    return this.ioService.export(config, records, user)
  }

  /** 批次正反向追溯：返回该批次的来源入库、出库去向与召回清单 */
  async traceBatch(batchNo: string, user: JwtUser): Promise<{
    batchNo: string
    sources: TraceEntry[]
    destinations: TraceEntry[]
    recall: Array<{ voucherType: string; voucherId: number }>
  }> {
    const ledgers = await this.ledgerRepo.find({
      where: { tenantId: user.tenantId, batchNo },
      order: { occurredAt: 'ASC', id: 'ASC' },
      take: 2000
    })
    const entries: TraceEntry[] = ledgers.map((item) => ({
      id: item.id,
      batchNo: item.batchNo,
      voucherType: item.voucherType,
      voucherId: item.voucherId,
      direction: this.num(item.qtyIn) > 0 ? 'IN' : 'OUT',
      qty: this.num(item.qtyIn) > 0 ? this.num(item.qtyIn) : this.num(item.qtyOut),
      productId: item.productId,
      occurredAt: item.occurredAt
    }))
    return {
      batchNo,
      sources: traceBackward(entries, batchNo),
      destinations: traceForward(entries, batchNo),
      recall: recallList(entries, batchNo)
    }
  }

  /** 召回冻结：冻结指定产品当前批次涉及的库存余额 */
  async recallFreeze(productId: number, batchNo: string, qty: string, user: JwtUser): Promise<{ frozen: boolean }> {
    const ledgers = await this.ledgerRepo.find({ where: { tenantId: user.tenantId, productId, batchNo }, take: 1 })
    if (ledgers.length === 0) throw new NotFoundException('未找到该批次流水')
    await this.freezeStock(ledgers[0].warehouseId, productId, qty, user)
    await this.auditService.record({
      bizType: 'stock_recall', bizId: productId,
      action: 'RECALL_FREEZE', afterValue: { productId, batchNo, qty }
    }, user)
    return { frozen: true }
  }

  async postMovement(dto: StockMovementDto, user: JwtUser): Promise<StockLedgerEntity> {
    const qtyIn = this.num(dto.qtyIn)
    const qtyOut = this.num(dto.qtyOut)
    if (qtyIn <= 0 && qtyOut <= 0) throw new BadRequestException('入库数量和出库数量至少有一个大于零')
    const product = await this.findProduct(dto.productId, user)
    await this.findWarehouse(dto.warehouseId, user)
    const costingMethod = (product.costingMethod || 'MOVING_WEIGHTED') as CostingMethod
    await this.assertCostPeriodUnlocked(user)
    const allowNegative = await this.resolveAllowNegativeStock(user)
    let costSource = 'NONE'
    let unitCost = 0

    const ledger = await this.withStockLock(
      this.stockLockKey(user.tenantId, dto.warehouseId, dto.locationId ?? 0, dto.productId, dto.variantId ?? 0, dto.batchNo ?? ''),
      () => this.dataSource.transaction(async (manager) => {
      const balanceRepo = manager.getRepository(StockBalanceEntity)
      const ledgerRepo = manager.getRepository(StockLedgerEntity)
      const layerRepo = manager.getRepository(StockCostLayerEntity)
      const balance = await this.getBalanceLocked(manager, user.tenantId, dto.warehouseId, dto.locationId ?? 0, dto.productId, dto.variantId ?? 0, dto.batchNo ?? '')
      const available = this.num(balance.qtyOnHand) - this.num(balance.qtyOccupied) - this.num(balance.qtyFrozen)
      if (qtyOut > available && !allowNegative) {
        throw new BadRequestException(
          `可用库存不足（可用 ${available}${allowNegative ? '' : '，如需负库存请开启系统参数并具备放行权限'}）`
        )
      }
      const beforeQty = this.num(balance.qtyOnHand)
      const nextQty = beforeQty + qtyIn - qtyOut
      balance.qtyOnHand = this.money(nextQty)

      // 入库计价：移动加权平均维护结存成本，并登记成本层
      unitCost = 0
      if (qtyIn > 0 && dto.cost !== undefined && dto.cost !== null && dto.cost !== '') {
        const inboundCost = this.num(dto.cost)
        const moving = computeMovingWeightedCost({
          beforeQty,
          beforeAvgCost: this.num(balance.avgCost),
          qtyIn,
          unitCost: inboundCost
        })
        balance.avgCost = moving.avgCost.toFixed(4)
        unitCost = inboundCost
        costSource = 'INBOUND'
        if (inboundCost > 0) {
          await layerRepo.save(layerRepo.create({
            tenantId: user.tenantId,
            warehouseId: dto.warehouseId,
            locationId: dto.locationId ?? 0,
            productId: dto.productId,
            variantId: dto.variantId ?? 0,
            batchNo: dto.batchNo ?? '',
            qtyIn: this.money(qtyIn),
            qtyAvailable: this.money(qtyIn),
            unitCost: inboundCost.toFixed(4),
            amount: moving.inAmount.toFixed(4),
            sourceVoucherType: dto.voucherType,
            sourceVoucherId: dto.voucherId ?? 0,
            sourceVoucherLineId: dto.voucherLineId ?? 0,
            status: 'OPEN',
            createdBy: user.userId
          }))
        }
      }

      // 出库计价：移动加权取结存均价；先进先出 / 分批实际成本消耗成本层
      if (qtyOut > 0) {
        const layers = await layerRepo.find({
          where: {
            tenantId: user.tenantId,
            warehouseId: dto.warehouseId,
            locationId: dto.locationId ?? 0,
            productId: dto.productId,
            variantId: dto.variantId ?? 0,
            status: 'OPEN'
          }
        })
        const resolved = resolveOutboundCost({
          method: costingMethod,
          avgCost: this.num(balance.avgCost),
          layers: layers.map((item) => ({
            id: item.id,
            qtyAvailable: this.num(item.qtyAvailable),
            unitCost: this.num(item.unitCost),
            occurredAt: item.occurredAt,
            batchNo: item.batchNo
          })),
          qtyOut,
          batchNo: dto.batchNo ?? '',
          fallbackCost: dto.cost !== undefined && dto.cost !== null && dto.cost !== '' ? this.num(dto.cost) : null
        })
        unitCost = resolved.unitCost
        costSource = resolved.source
        for (const consumption of resolved.consumptions) {
          const layer = layers.find((item) => item.id === consumption.layerId)
          if (!layer) continue
          const left = this.num(layer.qtyAvailable) - consumption.qty
          layer.qtyAvailable = this.money(left)
          if (left <= 0) layer.status = 'CLOSED'
          await layerRepo.save(layer)
        }
      }

      const balanceUpdate = balanceRepo.createQueryBuilder()
        .update(StockBalanceEntity)
        .set({
          qtyOnHand: this.money(nextQty),
          avgCost: balance.avgCost,
          updatedAt: new Date()
        })
        .where('id = :id', { id: balance.id })
      if (qtyOut > 0 && !allowNegative) {
        balanceUpdate.andWhere('qty_on_hand - qty_occupied - qty_frozen >= :qtyOut', { qtyOut })
      }
      const affected = await balanceUpdate.execute()
      if (affected.affected === 0) throw new BadRequestException('可用库存不足（并发扣减冲突，请重试）')
      return ledgerRepo.save(ledgerRepo.create({
        tenantId: user.tenantId,
        voucherType: dto.voucherType,
        voucherId: dto.voucherId ?? 0,
        voucherLineId: dto.voucherLineId ?? 0,
        warehouseId: dto.warehouseId,
        locationId: dto.locationId ?? 0,
        productId: dto.productId,
        variantId: dto.variantId ?? 0,
        batchNo: dto.batchNo ?? '',
        qtyIn: this.money(qtyIn),
        qtyOut: this.money(qtyOut),
        qtyDelta: this.money(qtyIn - qtyOut),
        balanceQty: this.money(nextQty),
        cost: unitCost.toFixed(4),
        remark: dto.remark ?? null,
        operatorId: user.userId
        }))
      })
    )

    await this.auditService.record({ bizType: 'stock_ledger', bizId: ledger.id, action: dto.voucherType, afterValue: { dto, balanceQty: ledger.balanceQty, cost: ledger.cost, costSource } }, user)
    await this.eventBus.emit(createDomainEvent('inventory.moved', user, 'stock_ledger', dto.voucherId ?? ledger.id, {
      voucherType: dto.voucherType,
      productId: dto.productId,
      warehouseId: dto.warehouseId,
      qtyIn: dto.qtyIn ?? '0',
      qtyOut: dto.qtyOut ?? '0'
    }))
    if (dto.voucherType === 'SALE_OUT') {
      const costAmount = this.num(unitCost) * this.num(dto.qtyOut ?? 0)
      if (costAmount > 0) {
        await this.eventBus.emit(createDomainEvent('finance.cost.carrying', user, 'stock_ledger', dto.voucherId ?? ledger.id, { amount: costAmount }))
      }
    }
    return ledger
  }

  async listLocks(query: QueryInventoryDto, user: JwtUser): Promise<PageResult<StockLockEntity>> {
    const where = scopeWhere<StockLockEntity>({ tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }, user)
    const [list, total] = await this.lockRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async lockStock(dto: LockStockDto, user: JwtUser): Promise<StockLockEntity> {
    const lock = await this.dataSource.transaction(async (manager) => {
      const balance = await this.getBalanceLocked(manager, user.tenantId, dto.warehouseId, 0, dto.productId, dto.variantId ?? 0, dto.batchNo ?? '')
      const available = this.num(balance.qtyOnHand) - this.num(balance.qtyOccupied) - this.num(balance.qtyFrozen)
      if (this.num(dto.qty) > available) throw new BadRequestException('可锁定库存不足')
      const qty = this.num(dto.qty)
      const affected = await manager.getRepository(StockBalanceEntity).createQueryBuilder()
        .update(StockBalanceEntity)
        .set({
          qtyOccupied: this.money(this.num(balance.qtyOccupied) + qty),
          updatedAt: new Date()
        })
        .where('id = :id', { id: balance.id })
        .andWhere('qty_on_hand - qty_occupied - qty_frozen >= :qty', { qty })
        .execute()
      if (affected.affected === 0) throw new BadRequestException('可锁定库存不足（并发冲突，请重试）')
      return manager.getRepository(StockLockEntity).save(this.lockRepo.create({ ...dto, tenantId: user.tenantId, variantId: dto.variantId ?? 0, batchNo: dto.batchNo ?? '' }))
    })
    await this.auditService.record({ bizType: 'stock_lock', bizId: lock.id, action: 'LOCK_STOCK', afterValue: lock }, user)
    return lock
  }

  async unlockStock(sourceType: string, sourceId: number, user: JwtUser): Promise<void> {
    const locks = await this.dataSource.transaction(async (manager) => {
      const lockRepo = manager.getRepository(StockLockEntity)
      const found = await lockRepo.find({ where: { tenantId: user.tenantId, sourceType, sourceId, status: 'LOCKED' } })
      for (const lock of found) {
        const balance = await this.getBalanceLocked(manager, user.tenantId, lock.warehouseId, 0, lock.productId, lock.variantId, lock.batchNo)
        balance.qtyOccupied = this.money(Math.max(0, this.num(balance.qtyOccupied) - this.num(lock.lockedQty)))
        await manager.getRepository(StockBalanceEntity).save(balance)
        lock.status = 'RELEASED'
        await lockRepo.save(lock)
      }
      return found
    })
    for (const lock of locks) {
      await this.auditService.record({ bizType: 'stock_lock', bizId: lock.id, action: 'UNLOCK_STOCK' }, user)
    }
  }

  async freezeStock(warehouseId: number, productId: number, qty: string, user: JwtUser): Promise<StockBalanceEntity> {
    const balance = await this.getBalance(user.tenantId, warehouseId, 0, productId, 0, '')
    balance.qtyFrozen = this.money(this.num(balance.qtyFrozen) + this.num(qty))
    balance.updatedAt = new Date()
    const saved = await this.balanceRepo.save(balance)
    await this.auditService.record({ bizType: 'stock_freeze', bizId: saved.id, action: 'FREEZE_STOCK', afterValue: { warehouseId, productId, qty } }, user)
    return saved
  }

  /** 解冻库存（让步接收/质检复检通过时调用） */
  async unfreezeStock(warehouseId: number, productId: number, qty: string, user: JwtUser): Promise<StockBalanceEntity> {
    const balance = await this.getBalance(user.tenantId, warehouseId, 0, productId, 0, '')
    balance.qtyFrozen = this.money(Math.max(0, this.num(balance.qtyFrozen) - this.num(qty)))
    balance.updatedAt = new Date()
    const saved = await this.balanceRepo.save(balance)
    await this.auditService.record({ bizType: 'stock_freeze', bizId: saved.id, action: 'UNFREEZE_STOCK', afterValue: { warehouseId, productId, qty } }, user)
    return saved
  }

  async listAlerts(query: QueryInventoryDto, user: JwtUser): Promise<PageResult<StockAlertEntity>> {
    const where = scopeWhere<StockAlertEntity>({ tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }, user)
    const [list, total] = await this.alertRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createAlert(dto: CreateAlertDto, user: JwtUser): Promise<StockAlertEntity> {
    const entity = this.alertRepo.create({ ...dto, tenantId: user.tenantId, warehouseId: dto.warehouseId ?? 0, message: dto.message ?? null })
    const saved = await this.alertRepo.save(entity)
    await this.auditService.record({ bizType: 'stock_alert', bizId: saved.id, action: 'CREATE_ALERT', afterValue: saved }, user)
    return saved
  }

  async closeAlert(id: number, user: JwtUser): Promise<StockAlertEntity> {
    const alert = await this.alertRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!alert) throw new NotFoundException('预警不存在')
    alert.status = 'CLOSED'
    const saved = await this.alertRepo.save(alert)
    await this.auditService.record({ bizType: 'stock_alert', bizId: id, action: 'CLOSE_ALERT' }, user)
    return saved
  }

  async listStocktakes(query: QueryInventoryDto, user: JwtUser): Promise<PageResult<StocktakeEntity>> {
    const where = scopeWhere<StocktakeEntity>({ tenantId: user.tenantId, isDeleted: 0, ...(query.status ? { status: query.status } : {}) }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.stocktakeRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async stocktakeDetail(id: number, user: JwtUser): Promise<{ stocktake: StocktakeEntity; lines: StocktakeLineEntity[] }> {
    const stocktake = await this.stocktakeRepo.findOne({
      where: scopeWhere({ id, tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' })
    })
    if (!stocktake) throw new NotFoundException('盘点单不存在')
    const lines = await this.stocktakeLineRepo.find({ where: { tenantId: user.tenantId, stocktakeId: id }, order: { id: 'ASC' } })
    return { stocktake, lines }
  }

  async createStocktake(dto: CreateStocktakeDto, user: JwtUser): Promise<StocktakeEntity> {
    await this.findWarehouse(dto.warehouseId, user)
    const stocktake = await this.stocktakeRepo.save(this.stocktakeRepo.create({
      tenantId: user.tenantId,
      stocktakeNo: this.number('STK'),
      warehouseId: dto.warehouseId,
      planDate: dto.planDate ?? null,
      blindMode: dto.blindMode ?? 0,
      createdBy: user.userId
    }))
    for (const line of dto.lines) {
      const diff = this.num(line.actualQty) - this.num(line.bookQty)
      await this.stocktakeLineRepo.save(this.stocktakeLineRepo.create({
        tenantId: user.tenantId,
        stocktakeId: stocktake.id,
        productId: line.productId,
        variantId: line.variantId ?? 0,
        batchNo: line.batchNo ?? '',
        bookQty: line.bookQty,
        actualQty: line.actualQty,
        diffQty: this.money(diff)
      }))
    }
    await this.auditService.record({ bizType: 'stocktake', bizId: stocktake.id, action: 'CREATE_STOCKTAKE', afterValue: stocktake }, user)
    return stocktake
  }

  /** 复盘：盲盘后二次实盘，以复盘数量重算差异（过账后不可复盘） */
  async recountStocktake(id: number, lines: Array<{ lineId: number; recountQty: string }>, user: JwtUser): Promise<StocktakeEntity> {
    const stocktake = await this.stocktakeRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!stocktake) throw new NotFoundException('盘点单不存在')
    if (stocktake.status === 'DONE') throw new BadRequestException('已过账盘点单不可复盘')
    if ([STOCKTAKE_STATUS.PENDING_APPROVAL, STOCKTAKE_STATUS.APPROVED].includes(stocktake.status as never)) {
      throw new BadRequestException('差异审批中或已审批的盘点单不可复盘')
    }
    for (const item of lines) {
      const line = await this.stocktakeLineRepo.findOne({ where: { id: item.lineId, tenantId: user.tenantId, stocktakeId: id } })
      if (!line) throw new BadRequestException(`盘点明细 ${item.lineId} 不存在`)
      const [computed] = computeStocktakeLines([{
        productId: line.productId,
        bookQty: this.num(line.bookQty),
        actualQty: this.num(line.actualQty),
        recountQty: this.num(item.recountQty)
      }], stocktake.blindMode === 1)
      line.recountQty = this.money(this.num(item.recountQty))
      line.diffQty = this.money(computed.diffQty)
      await this.stocktakeLineRepo.save(line)
    }
    stocktake.status = 'RECOUNTED'
    const saved = await this.stocktakeRepo.save(stocktake)
    await this.auditService.record({ bizType: 'stocktake', bizId: id, action: 'RECOUNT_STOCKTAKE', afterValue: { lines: lines.length } }, user)
    return saved
  }

  /** 扫码实盘：按条码/产品明细累加实盘数量；盲盘下不返回账面数量 */
  async scanStocktake(id: number, dto: ScanStocktakeDto, user: JwtUser): Promise<{ stocktake: StocktakeEntity; result: StocktakeScanResult }> {
    const stocktake = await this.stocktakeRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!stocktake) throw new NotFoundException('盘点单不存在')
    if (stocktake.status === 'DONE') throw new BadRequestException('已过账盘点单不可扫码录入')
    if ([STOCKTAKE_STATUS.PENDING_APPROVAL, STOCKTAKE_STATUS.APPROVED].includes(stocktake.status as never)) {
      throw new BadRequestException('差异审批中或已审批的盘点单不可扫码录入')
    }
    const lines = await this.stocktakeLineRepo.find({ where: { tenantId: user.tenantId, stocktakeId: id } })
    if (!lines.length) throw new BadRequestException('盘点单没有明细，无法扫码录入')
    const scans = await this.resolveScans(dto, user)
    const scanLines = lines.map((line) => ({
      lineId: line.id,
      productId: line.productId,
      variantId: line.variantId,
      batchNo: line.batchNo,
      bookQty: this.num(line.bookQty),
      actualQty: this.num(line.actualQty),
      recountQty: line.recountQty === null ? null : this.num(line.recountQty),
      diffQty: this.num(line.diffQty)
    }))
    const result = applyStocktakeScans(scanLines, scans, stocktake.blindMode === 1)
    for (const item of result.lines) {
      const line = lines.find((row) => row.id === item.lineId)
      if (!line) continue
      line.actualQty = this.money(item.actualQty)
      line.diffQty = this.money(item.diffQty)
      await this.stocktakeLineRepo.save(line)
    }
    if (stocktake.status === 'DRAFT') stocktake.status = 'COUNTING'
    const saved = await this.stocktakeRepo.save(stocktake)
    await this.auditService.record({ bizType: 'stocktake', bizId: id, action: 'SCAN_STOCKTAKE', afterValue: { scannedCount: result.scannedCount, scannedQty: result.scannedQty, blindMode: result.blindMode } }, user)
    return { stocktake: saved, result }
  }

  /** 扫码明细解析：条码优先解析为产品/变体，未识别条码直接拒绝 */
  private async resolveScans(dto: ScanStocktakeDto, user: JwtUser): Promise<Array<{ lineId?: number; productId?: number; batchNo?: string; qty: string }>> {
    const scans: Array<{ lineId?: number; productId?: number; batchNo?: string; qty: string }> = []
    for (const scan of dto.scans) {
      if (scan.lineId !== undefined || scan.productId !== undefined) {
        scans.push({ lineId: scan.lineId, productId: scan.productId, batchNo: scan.batchNo, qty: scan.qty })
        continue
      }
      if (!scan.barcode) throw new BadRequestException('扫码缺少条码或产品信息')
      const product = await this.productRepo.findOne({ where: { tenantId: user.tenantId, barcode: scan.barcode, isDeleted: 0 } })
      if (!product) throw new BadRequestException(`条码未匹配到产品：${scan.barcode}`)
      scans.push({ productId: product.id, batchNo: scan.batchNo, qty: scan.qty })
    }
    return scans
  }

  /** 可用量查询：实物量 - 锁定量 - 冻结量 */
  async availableStock(query: QueryInventoryDto, user: JwtUser): Promise<Array<Record<string, unknown>>> {
    const where = scopeWhere<StockBalanceEntity>({
      tenantId: user.tenantId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productId ? { productId: query.productId } : {})
    }, user)
    const balances = await this.balanceRepo.find({ where })
    return balances.map((balance) => {
      const available = computeAvailableQty(balance)
      return {
        productId: balance.productId,
        variantId: balance.variantId,
        warehouseId: balance.warehouseId,
        locationId: balance.locationId,
        batchNo: balance.batchNo,
        qtyOnHand: available.onHand,
        qtyOccupied: available.occupied,
        qtyFrozen: available.frozen,
        qtyAvailable: available.available
      }
    })
  }

  /** 批次 × 库位矩阵 */
  async batchLocationMatrix(query: QueryInventoryDto, user: JwtUser): Promise<BalanceMatrixRow[]> {
    const where = scopeWhere<StockBalanceEntity>({
      tenantId: user.tenantId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productId ? { productId: query.productId } : {})
    }, user)
    const balances = await this.balanceRepo.find({ where })
    return buildBatchLocationMatrix(balances.map((balance) => ({
      productId: balance.productId,
      variantId: balance.variantId,
      warehouseId: balance.warehouseId,
      locationId: balance.locationId,
      batchNo: balance.batchNo,
      qtyOnHand: balance.qtyOnHand,
      qtyOccupied: balance.qtyOccupied,
      qtyFrozen: balance.qtyFrozen
    })))
  }

  /**
   * 提交盘点差异审批
   *
   * - 无差异（差异行数为 0）：无需审批，直接过账
   * - 存在差异：置为 PENDING_APPROVAL，等待审批通过后过账
   */
  async submitStocktakeApproval(id: number, user: JwtUser): Promise<StocktakeEntity> {
    const stocktake = await this.stocktakeRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!stocktake) throw new NotFoundException('盘点单不存在')
    const lines = await this.stocktakeLineRepo.find({ where: { tenantId: user.tenantId, stocktakeId: id } })
    const approvalLines = await this.buildStocktakeApprovalLines(stocktake, lines)
    const evaluation = evaluateStocktakeApproval({
      status: stocktake.status,
      blindMode: stocktake.blindMode === 1,
      lines: approvalLines
    })
    if (!evaluation.ok) throw new BadRequestException(evaluation.reason ?? '盘点差异不允许提交审批')
    if (!evaluation.needApproval) {
      const saved = await this.postStocktakeDiff(stocktake, lines, user)
      await this.auditService.record({
        bizType: 'stocktake',
        bizId: id,
        action: 'POST_STOCKTAKE_DIFF_NO_APPROVAL',
        afterValue: { summary: evaluation.summary }
      }, user)
      return saved
    }
    stocktake.status = STOCKTAKE_STATUS.PENDING_APPROVAL
    const saved = await this.stocktakeRepo.save(stocktake)
    await this.auditService.record({
      bizType: 'stocktake',
      bizId: id,
      action: 'SUBMIT_STOCKTAKE_APPROVAL',
      afterValue: { summary: evaluation.summary }
    }, user)
    return saved
  }

  /**
   * 盘点差异审批通过并过账
   */
  async approveStocktake(id: number, user: JwtUser): Promise<StocktakeEntity> {
    const stocktake = await this.stocktakeRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!stocktake) throw new NotFoundException('盘点单不存在')
    if (stocktake.status === STOCKTAKE_STATUS.DONE) throw new BadRequestException('已过账盘点单不可重复过账')
    const lines = await this.stocktakeLineRepo.find({ where: { tenantId: user.tenantId, stocktakeId: id } })
    const approvalLines = await this.buildStocktakeApprovalLines(stocktake, lines)
    const summary = summarizeStocktakeDiff(approvalLines)
    if (summary.diffLines > 0 && !canApproveStocktakeDiff(stocktake.status)) {
      throw new BadRequestException('存在盘点差异，请先提交差异审批后再过账')
    }
    if (stocktake.blindMode === 1 && ![STOCKTAKE_STATUS.RECOUNTED, STOCKTAKE_STATUS.PENDING_APPROVAL, STOCKTAKE_STATUS.APPROVED].includes(stocktake.status as never)) {
      throw new BadRequestException('盲盘必须先完成复盘才能过账')
    }
    return this.postStocktakeDiff(stocktake, lines, user)
  }

  /**
   * 驳回盘点差异审批（回到可继续盘点状态）
   */
  async rejectStocktakeApproval(id: number, reason: string | undefined, user: JwtUser): Promise<StocktakeEntity> {
    const stocktake = await this.stocktakeRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!stocktake) throw new NotFoundException('盘点单不存在')
    if (!canRejectStocktakeDiff(stocktake.status)) {
      throw new BadRequestException(`当前状态 ${stocktake.status} 不允许驳回差异审批`)
    }
    stocktake.status = STOCKTAKE_STATUS.REJECTED
    const saved = await this.stocktakeRepo.save(stocktake)
    await this.auditService.record({
      bizType: 'stocktake',
      bizId: id,
      action: 'REJECT_STOCKTAKE_APPROVAL',
      afterValue: { reason: reason ?? null }
    }, user)
    return saved
  }

  /** 盘点差异过账：写入库存流水并结转盘点单 */
  private async postStocktakeDiff(
    stocktake: StocktakeEntity,
    lines: StocktakeLineEntity[],
    user: JwtUser
  ): Promise<StocktakeEntity> {
    for (const line of lines) {
      const diff = this.num(line.diffQty)
      if (diff === 0) continue
      await this.postMovement({
        voucherType: 'STOCKTAKE_DIFF',
        voucherId: stocktake.id,
        voucherLineId: line.id,
        warehouseId: stocktake.warehouseId,
        productId: line.productId,
        variantId: line.variantId,
        batchNo: line.batchNo,
        ...(diff > 0 ? { qtyIn: this.money(diff) } : { qtyOut: this.money(-diff) }),
        remark: '盘点差异过账'
      }, user)
    }
    stocktake.status = STOCKTAKE_STATUS.DONE
    const saved = await this.stocktakeRepo.save(stocktake)
    await this.auditService.record({ bizType: 'stocktake', bizId: stocktake.id, action: 'APPROVE_STOCKTAKE' }, user)
    return saved
  }

  /** 构造盘点差异审批行（补充账面均价用于差异金额折算） */
  private async buildStocktakeApprovalLines(
    stocktake: StocktakeEntity,
    lines: StocktakeLineEntity[]
  ): Promise<StocktakeApprovalLine[]> {
    const balances = await this.balanceRepo.find({
      where: { tenantId: stocktake.tenantId, warehouseId: stocktake.warehouseId }
    })
    const costMap = new Map<string, number>()
    for (const balance of balances) {
      costMap.set(`${balance.productId}:${balance.variantId}:${balance.batchNo ?? ''}`, this.num(balance.avgCost))
    }
    return lines.map((line) => ({
      productId: line.productId,
      bookQty: this.num(line.bookQty),
      actualQty: this.num(line.actualQty),
      recountQty: line.recountQty === null ? null : this.num(line.recountQty),
      diffQty: this.num(line.diffQty),
      unitCost: costMap.get(`${line.productId}:${line.variantId}:${line.batchNo ?? ''}`) ?? 0
    }))
  }

  async listTransfers(query: QueryInventoryDto, user: JwtUser): Promise<PageResult<StockTransferEntity>> {
    const where = scopeWhere<StockTransferEntity>({ tenantId: user.tenantId, isDeleted: 0, ...(query.status ? { status: query.status } : {}) }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.transferRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createTransfer(dto: CreateTransferDto, user: JwtUser): Promise<StockTransferEntity> {
    await this.findWarehouse(dto.fromWarehouseId, user)
    await this.findWarehouse(dto.toWarehouseId, user)
    const transfer = await this.transferRepo.save(this.transferRepo.create({
      tenantId: user.tenantId,
      transferNo: this.number('TR'),
      fromWarehouseId: dto.fromWarehouseId,
      toWarehouseId: dto.toWarehouseId,
      status: TRANSFER_STATUS.DRAFT,
      createdBy: user.userId
    }))
    for (const line of dto.lines) {
      await this.transferLineRepo.save(this.transferLineRepo.create({
        tenantId: user.tenantId,
        transferId: transfer.id,
        productId: line.productId,
        variantId: line.variantId ?? 0,
        batchNo: line.batchNo ?? '',
        qty: line.qty
      }))
    }
    await this.auditService.record({ bizType: 'stock_transfer', bizId: transfer.id, action: 'CREATE_TRANSFER', afterValue: transfer }, user)
    return transfer
  }

  /** 调拨发货：DRAFT → IN_TRANSIT，执行调出仓库出库（形成在途库存） */
  async submitTransfer(id: number, user: JwtUser): Promise<StockTransferEntity> {
    const transfer = await this.transferRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!transfer) throw new NotFoundException('调拨单不存在')
    const from = (transfer.status || TRANSFER_STATUS.DRAFT) as TransferStatus
    if (!canTransitionTransfer(from, TRANSFER_STATUS.IN_TRANSIT)) {
      throw new BadRequestException(`调拨单当前状态 ${from} 不允许发货`)
    }
    const lines = await this.transferLineRepo.find({ where: { tenantId: user.tenantId, transferId: id } })
    for (const line of lines) {
      if (line.shippedQty && this.num(line.shippedQty) >= this.num(line.qty)) continue
      await this.postMovement({ voucherType: 'TRANSFER_OUT', voucherId: transfer.id, voucherLineId: line.id, warehouseId: transfer.fromWarehouseId, productId: line.productId, variantId: line.variantId, batchNo: line.batchNo, qtyOut: line.qty, remark: '调拨出库（在途）' }, user)
      line.shippedQty = line.qty
      await this.transferLineRepo.save(line)
    }
    transfer.status = TRANSFER_STATUS.IN_TRANSIT
    const saved = await this.transferRepo.save(transfer)
    await this.auditService.record({ bizType: 'stock_transfer', bizId: id, action: 'SHIP_TRANSFER' }, user)
    return saved
  }

  async receiveTransfer(id: number, user: JwtUser, dto?: ReceiveTransferDto): Promise<StockTransferEntity> {
    const transfer = await this.transferRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!transfer) throw new NotFoundException('调拨单不存在')
    const from = (transfer.status || TRANSFER_STATUS.DRAFT) as TransferStatus
    // 新流程必须先在途再签收；兼容历史 DONE/空状态直接签收
    if ((from as string) !== 'DONE' && from !== TRANSFER_STATUS.DRAFT && !canTransitionTransfer(from, TRANSFER_STATUS.RECEIVED)) {
      throw new BadRequestException(`调拨单当前状态 ${from} 不允许签收`)
    }
    const lines = await this.transferLineRepo.find({ where: { tenantId: user.tenantId, transferId: id } })
    const receiptMap = new Map((dto?.lines ?? []).map((item) => [item.lineId, item.receivedQty]))
    const judgement = evaluateTransferReceipt(lines.map((line) => ({
      lineId: line.id,
      qty: line.qty,
      receivedQty: receiptMap.get(line.id) ?? line.receivedQty ?? line.qty,
      shippedQty: line.shippedQty
    })))
    if (judgement.hasOverage) {
      const detail = judgement.judgements.filter((item) => item.abnormal).map((item) => `明细 ${item.lineId} 超出 ${item.diffQty}`).join('；')
      throw new BadRequestException(`签收数量超出调拨数量，需先处理调拨差异：${detail}`)
    }
    for (const line of lines) {
      const item = judgement.judgements.find((entry) => entry.lineId === line.id)
      const expectedQty = item ? item.expectedQty : this.num(line.qty)
      const receivedQty = item ? item.receivedQty : this.num(line.qty)
      const alreadyReceived = this.num(line.receivedQty)
      const toReceive = receivedQty - alreadyReceived
      if (toReceive > 0) {
        // 若未走发货步骤（历史数据/直接签收），补做出库过账
        if (!line.shippedQty || this.num(line.shippedQty) <= 0) {
          await this.postMovement({ voucherType: 'TRANSFER_OUT', voucherId: transfer.id, voucherLineId: line.id, warehouseId: transfer.fromWarehouseId, productId: line.productId, variantId: line.variantId, batchNo: line.batchNo, qtyOut: this.money(toReceive), remark: '调拨出库' }, user)
        }
        await this.postMovement({ voucherType: 'TRANSFER_IN', voucherId: transfer.id, voucherLineId: line.id, warehouseId: transfer.toWarehouseId, productId: line.productId, variantId: line.variantId, batchNo: line.batchNo, qtyIn: this.money(toReceive), remark: '调拨入库' }, user)
      }
      line.receivedQty = this.money(receivedQty)
      line.shippedQty = this.money(expectedQty)
      line.diffQty = this.money(receivedQty - expectedQty)
      line.diffReason = item && item.reason ? item.reason : null
      await this.transferLineRepo.save(line)
    }
    transfer.status = TRANSFER_STATUS.RECEIVED
    const saved = await this.transferRepo.save(transfer)
    await this.auditService.record({
      bizType: 'stock_transfer',
      bizId: id,
      action: 'RECEIVE_TRANSFER',
      afterValue: {
        hasShortage: judgement.hasShortage,
        totalShortage: judgement.totalShortage,
        remark: dto?.remark ?? null,
        differences: judgement.judgements.filter((entry) => entry.diffQty !== 0)
      }
    }, user)
    return saved
  }

  async listPutaways(query: QueryInventoryDto, user: JwtUser): Promise<PageResult<WmsPutawayEntity>> {
    const where = scopeWhere<WmsPutawayEntity>({ tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }, user)
    const [list, total] = await this.putawayRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createPutaway(dto: CreatePutawayDto, user: JwtUser): Promise<WmsPutawayEntity> {
    const entity = this.putawayRepo.create({ ...dto, tenantId: user.tenantId, strategyCode: dto.strategyCode ?? 'FIFO' })
    const saved = await this.putawayRepo.save(entity)
    await this.auditService.record({ bizType: 'wms_putaway', bizId: saved.id, action: 'CREATE_PUTAWAY', afterValue: saved }, user)
    return saved
  }

  async completePutaway(id: number, user: JwtUser): Promise<WmsPutawayEntity> {
    const putaway = await this.putawayRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!putaway) throw new NotFoundException('上架任务不存在')
    putaway.status = 'DONE'
    const saved = await this.putawayRepo.save(putaway)
    await this.auditService.record({ bizType: 'wms_putaway', bizId: id, action: 'COMPLETE_PUTAWAY' }, user)
    return saved
  }

  async listWaves(query: QueryInventoryDto, user: JwtUser): Promise<PageResult<WmsPickWaveEntity>> {
    const where = scopeWhere<WmsPickWaveEntity>({ tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.waveRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async waveDetail(id: number, user: JwtUser): Promise<{ wave: WmsPickWaveEntity; tasks: WmsPickTaskEntity[] }> {
    const wave = await this.waveRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!wave) throw new NotFoundException('拣货波次不存在')
    const tasks = await this.pickTaskRepo.find({ where: { tenantId: user.tenantId, waveId: id }, order: { id: 'ASC' } })
    return { wave, tasks }
  }

  async createWave(dto: CreateWaveDto, user: JwtUser): Promise<WmsPickWaveEntity> {
    const wave = await this.waveRepo.save(this.waveRepo.create({
      tenantId: user.tenantId,
      waveNo: this.number('WAVE'),
      priority: dto.priority ?? 0,
      createdBy: user.userId
    }))
    for (const task of dto.tasks) {
      await this.pickTaskRepo.save(this.pickTaskRepo.create({
        ...task,
        tenantId: user.tenantId,
        waveId: wave.id,
        sourceType: task.sourceType ?? 'SALE_ORDER',
        locationId: task.locationId ?? 0
      }))
    }
    await this.auditService.record({ bizType: 'wms_pick_wave', bizId: wave.id, action: 'CREATE_WAVE', afterValue: wave }, user)
    return wave
  }

  async pickTask(waveId: number, taskId: number, dto: PickDto, user: JwtUser): Promise<WmsPickTaskEntity> {
    const task = await this.pickTaskRepo.findOne({ where: { id: taskId, waveId, tenantId: user.tenantId } })
    if (!task) throw new NotFoundException('拣货任务不存在')
    const picked = this.num(task.pickedQty) + this.num(dto.qty)
    if (picked > this.num(task.qty)) throw new BadRequestException('拣货数量超过任务数量')
    task.pickedQty = this.money(picked)
    task.status = picked >= this.num(task.qty) ? 'DONE' : 'PICKING'
    const saved = await this.pickTaskRepo.save(task)
    await this.auditService.record({ bizType: 'wms_pick_task', bizId: taskId, action: 'PICK_TASK', afterValue: saved }, user)
    return saved
  }

  async completeWave(id: number, user: JwtUser): Promise<WmsPickWaveEntity> {
    const tasks = await this.pickTaskRepo.find({ where: { tenantId: user.tenantId, waveId: id } })
    if (tasks.some((task) => this.num(task.pickedQty) < this.num(task.qty))) throw new BadRequestException('存在未完成拣货任务')
    const wave = await this.waveRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!wave) throw new NotFoundException('拣货波次不存在')
    wave.status = 'DONE'
    const saved = await this.waveRepo.save(wave)
    await this.auditService.record({ bizType: 'wms_pick_wave', bizId: id, action: 'COMPLETE_WAVE' }, user)
    return saved
  }

  /**
   * 波次复核：拣货任务全部拣足后方可复核，复核后波次才允许发货。
   * 未复核的波次发货将被拦截，避免未复核商品直接出库。
   */
  async reviewWave(id: number, user: JwtUser): Promise<WmsPickWaveEntity> {
    const wave = await this.waveRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!wave) throw new NotFoundException('拣货波次不存在')
    if (wave.status === 'DONE') throw new BadRequestException('波次已完成，无需复核')
    const tasks = await this.pickTaskRepo.find({ where: { tenantId: user.tenantId, waveId: id } })
    if (tasks.length === 0) throw new BadRequestException('波次无拣货任务，无法复核')
    const plan = buildWaveReviewPlan({
      waveNo: wave.waveNo,
      status: wave.status,
      tasks: tasks.map((task) => ({
        id: task.id,
        productId: task.productId,
        qty: this.num(task.qty),
        pickedQty: this.num(task.pickedQty),
        status: task.status
      }))
    })
    if (!plan.ready) throw new BadRequestException(plan.reason)
    for (const task of tasks) {
      task.status = 'REVIEWED'
      await this.pickTaskRepo.save(task)
    }
    wave.status = 'REVIEWED'
    const saved = await this.waveRepo.save(wave)
    await this.auditService.record({ bizType: 'wms_pick_wave', bizId: id, action: 'REVIEW_WAVE', afterValue: { status: 'REVIEWED', taskCount: tasks.length } }, user)
    return saved
  }

  /** 波次发货就绪状态：供销售出货单关联波次时校验 */
  async listWaveStates(user: JwtUser): Promise<Array<{
    id: number
    waveNo: string
    status: string
    priority: number
    totalTasks: number
    pickedTasks: number
    shippable: boolean
    reason: string
  }>> {
    const waves = await this.waveRepo.find({ where: { tenantId: user.tenantId }, order: { id: 'DESC' }, take: 100 })
    if (waves.length === 0) return []
    const tasks = await this.pickTaskRepo.find({ where: { tenantId: user.tenantId, waveId: In(waves.map((wave) => wave.id)) } })
    return waves.map((wave) => {
      const waveTasks = tasks.filter((task) => task.waveId === wave.id)
      const check = checkWaveShippable({
        waveNo: wave.waveNo,
        status: wave.status,
        tasks: waveTasks.map((task) => ({
          id: task.id,
          productId: task.productId,
          qty: this.num(task.qty),
          pickedQty: this.num(task.pickedQty),
          status: task.status
        }))
      })
      return {
        id: wave.id,
        waveNo: wave.waveNo,
        status: wave.status,
        priority: wave.priority,
        totalTasks: waveTasks.length,
        pickedTasks: waveTasks.filter((task) => task.pickedQty === task.qty).length,
        shippable: check.allowed,
        reason: check.reason
      }
    })
  }

  async listAssemblies(query: QueryInventoryDto, user: JwtUser): Promise<PageResult<StockAssemblyEntity>> {
    const where = scopeWhere<StockAssemblyEntity>({ tenantId: user.tenantId, isDeleted: 0, ...(query.status ? { status: query.status } : {}) }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.assemblyRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createAssembly(dto: CreateAssemblyDto, user: JwtUser): Promise<StockAssemblyEntity> {
    await this.findWarehouse(dto.warehouseId, user)
    const entity = await this.assemblyRepo.save(this.assemblyRepo.create({
      tenantId: user.tenantId,
      assemblyNo: this.number('ASM'),
      ...dto,
      createdBy: user.userId
    }))
    for (const line of dto.lines) {
      await this.assemblyLineRepo.save(this.assemblyLineRepo.create({
        tenantId: user.tenantId,
        assemblyId: entity.id,
        productId: line.productId,
        variantId: line.variantId ?? 0,
        batchNo: line.batchNo ?? '',
        qty: line.qty
      }))
    }
    await this.auditService.record({ bizType: 'stock_assembly', bizId: entity.id, action: 'CREATE_ASSEMBLY', afterValue: entity }, user)
    return entity
  }

  async approveAssembly(id: number, user: JwtUser): Promise<StockAssemblyEntity> {
    const assembly = await this.assemblyRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!assembly) throw new NotFoundException('拆装单不存在')
    if (assembly.status === 'DONE') throw new BadRequestException('拆装单已过账，不可重复过账')
    const lines = await this.assemblyLineRepo.find({ where: { tenantId: user.tenantId, assemblyId: id } })
    // 成本分摊：子件按批次移动平均成本核算，摊到成品单位成本
    const components = await Promise.all(lines.map(async (line) => {
      const balance = await this.balanceRepo.findOne({
        where: {
          tenantId: user.tenantId,
          warehouseId: assembly.warehouseId,
          productId: line.productId,
          variantId: line.variantId,
          batchNo: line.batchNo
        }
      })
      return {
        productId: line.productId,
        batchNo: line.batchNo,
        variantId: line.variantId,
        unitCost: balance ? this.num(balance.avgCost) : 0,
        qtyPerOutput: this.num(line.qty)
      }
    }))
    const cost = allocateAssemblyCost(components, this.num(assembly.qty))
    if (assembly.assemblyType === 'ASSEMBLY') {
      for (const line of lines) {
        await this.postMovement({ voucherType: 'ASSEMBLY', voucherId: id, voucherLineId: line.id, warehouseId: assembly.warehouseId, productId: line.productId, variantId: line.variantId, batchNo: line.batchNo, qtyOut: this.money(this.num(line.qty) * this.num(assembly.qty)), remark: '组装领料（批次继承）' }, user)
      }
      await this.postMovement({ voucherType: 'ASSEMBLY', voucherId: id, warehouseId: assembly.warehouseId, productId: assembly.productId, qtyIn: assembly.qty, cost: this.money(cost.unitCost), remark: '组装完工（成本分摊）' }, user)
    } else {
      await this.postMovement({ voucherType: 'DISASSEMBLY', voucherId: id, warehouseId: assembly.warehouseId, productId: assembly.productId, qtyOut: assembly.qty, cost: this.money(cost.unitCost), remark: '拆解投入（成本结转）' }, user)
      for (const line of lines) {
        await this.postMovement({ voucherType: 'DISASSEMBLY', voucherId: id, voucherLineId: line.id, warehouseId: assembly.warehouseId, productId: line.productId, variantId: line.variantId, batchNo: line.batchNo, qtyIn: this.money(this.num(line.qty) * this.num(assembly.qty)), remark: '拆解产出（批次继承）' }, user)
      }
    }
    assembly.status = 'DONE'
    const saved = await this.assemblyRepo.save(assembly)
    await this.auditService.record({ bizType: 'stock_assembly', bizId: id, action: 'APPROVE_ASSEMBLY', afterValue: { totalCost: cost.totalCost, unitCost: cost.unitCost, components: cost.components } }, user)
    return saved
  }

  async report(user: JwtUser): Promise<Record<string, unknown>> {
    const balances = await this.balanceRepo.find({ where: { tenantId: user.tenantId } })
    const ledger = await this.ledgerRepo.find({ where: { tenantId: user.tenantId }, order: { occurredAt: 'DESC' }, take: 500 })
    const warehouses = await this.warehouseRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const products = await this.productRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const byWarehouse = warehouses.map((warehouse) => ({
      name: warehouse.warehouseName,
      qty: this.money(balances.filter((item) => item.warehouseId === warehouse.id).reduce((sum, item) => sum + this.num(item.qtyOnHand), 0))
    }))
    const byProduct = products.map((product) => ({
      name: product.productName,
      qty: this.money(balances.filter((item) => item.productId === product.id).reduce((sum, item) => sum + this.num(item.qtyOnHand), 0))
    })).filter((item) => Number(item.qty) !== 0)
    return {
      totalQty: this.money(balances.reduce((sum, item) => sum + this.num(item.qtyOnHand), 0)),
      lockedQty: this.money(balances.reduce((sum, item) => sum + this.num(item.qtyOccupied), 0)),
      frozenQty: this.money(balances.reduce((sum, item) => sum + this.num(item.qtyFrozen), 0)),
      ledgerCount: ledger.length,
      byWarehouse,
      byProduct,
      recentLedger: ledger.slice(0, 50)
    }
  }

  // ------------------------------------------- 仓储扩展：上架策略 / 拣货路径 / 库存分析报表

  /** 上架策略规则建档 */
  async createPutawayStrategy(dto: CreatePutawayStrategyDto, user: JwtUser): Promise<WmsPutawayStrategyEntity> {
    const entity = this.putawayStrategyRepo.create({
      tenantId: user.tenantId,
      warehouseId: dto.warehouseId ?? 0,
      strategyName: dto.strategyName,
      ruleType: dto.ruleType,
      priority: dto.priority ?? 1,
      ruleValue: dto.ruleValue ?? '',
      status: 'ACTIVE',
      createdBy: user.userId
    })
    const saved = await this.putawayStrategyRepo.save(entity)
    await this.auditService.record({ bizType: 'wms_putaway_strategy', bizId: saved.id, action: 'CREATE_STRATEGY', afterValue: saved }, user)
    return saved
  }

  /** 上架策略列表 */
  async listPutawayStrategies(query: QueryInventoryDto, user: JwtUser): Promise<WmsPutawayStrategyEntity[]> {
    return this.putawayStrategyRepo.find({
      where: scopeWhere<WmsPutawayStrategyEntity>({
        tenantId: user.tenantId,
        ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(query.status ? { status: query.status } : {})
      }, user),
      order: { priority: 'ASC', id: 'ASC' }
    })
  }

  /** 上架库位推荐：按仓库策略规则判定候选库位是否可用 */
  async recommendPutaway(dto: PutawayRecommendDto, user: JwtUser): Promise<Record<string, unknown>> {
    await this.findProduct(dto.productId, user)
    await this.findWarehouse(dto.warehouseId, user)
    const strategies = await this.putawayStrategyRepo.find({
      where: { tenantId: user.tenantId, warehouseId: dto.warehouseId, status: 'ACTIVE' },
      order: { priority: 'ASC', id: 'ASC' }
    })
    const rules = strategies.length
      ? strategies.map((item) => ({ id: item.id, ruleType: item.ruleType as PutawayRuleType, priority: item.priority, ruleValue: item.ruleValue }))
      : buildPutawayRules({
        temperatureControlled: Boolean(dto.temperatureZone),
        mixedBatch: !dto.batchNo,
        bigItemFirst: (dto.volume ?? 0) > 0,
        fastTurnoverFirst: (dto.turnoverDays ?? 0) > 0
      })
    const balances = await this.balanceRepo.find({
      where: { tenantId: user.tenantId, warehouseId: dto.warehouseId, productId: dto.productId }
    })
    const locations = balances.map((item) => ({
      locationId: item.locationId,
      occupied: this.num(item.qtyOnHand),
      maxWeight: 0,
      maxVolume: 0
    }))
    const candidates = locations.length
      ? locations
      : [{ locationId: dto.locationId ?? 0, occupied: 0, maxWeight: 0, maxVolume: 0 }]
    const decisions = candidates.map((location) => ({
      ...location,
      decision: putawayStrategyMatch(rules, {
        temperatureZone: dto.temperatureZone,
        volume: dto.volume,
        turnoverDays: dto.turnoverDays,
        batchNo: dto.batchNo,
        weight: dto.weight,
        location
      })
    }))
    const matched = decisions.find((item) => item.decision.matched) ?? null
    await this.auditService.record({
      bizType: 'wms_putaway',
      bizId: dto.productId,
      action: 'RECOMMEND_LOCATION',
      afterValue: { matched, total: decisions.length }
    }, user)
    return { productId: dto.productId, warehouseId: dto.warehouseId, strategyCount: rules.length, matched, candidates: decisions }
  }

  /** 拣货路径优化：按波次任务库位生成蛇形拣货顺序 */
  async optimizePickPath(waveId: number, user: JwtUser): Promise<Record<string, unknown>> {
    const wave = await this.waveRepo.findOne({ where: { id: waveId, tenantId: user.tenantId } })
    if (!wave) throw new NotFoundException('拣货波次不存在')
    const tasks = await this.pickTaskRepo.find({ where: { tenantId: user.tenantId, waveId } })
    const result = optimizePickPath(
      tasks.map((task) => ({
        taskId: task.id,
        locationCode: String(task.locationId ?? 0).padStart(3, '0'),
        qty: this.num(task.qty)
      }))
    )
    await this.auditService.record({
      bizType: 'wms_pick_wave',
      bizId: waveId,
      action: 'OPTIMIZE_PICK_PATH',
      afterValue: { distance: result.distance, savedDistance: result.savedDistance, savedRatio: result.savedRatio }
    }, user)
    return { waveId, ...result }
  }

  /** 库存库龄分析报表 */
  async agingReport(dto: InventoryReportDto, user: JwtUser): Promise<Record<string, unknown>> {
    const balances = await this.balanceRepo.find({
      where: scopeWhere<StockBalanceEntity>({
        tenantId: user.tenantId,
        ...(dto.warehouseId ? { warehouseId: dto.warehouseId } : {}),
        ...(dto.productId ? { productId: dto.productId } : {})
      }, user)
    })
    const ledger = await this.ledgerRepo.find({
      where: scopeWhere<StockLedgerEntity>({
        tenantId: user.tenantId,
        ...(dto.warehouseId ? { warehouseId: dto.warehouseId } : {}),
        ...(dto.productId ? { productId: dto.productId } : {})
      }, user)
    })
    const items = balances
      .filter((item) => this.num(item.qtyOnHand) > 0)
      .map((item) => {
        const firstIn = ledger
          .filter((entry) => entry.productId === item.productId && this.num(entry.qtyIn) > 0)
          .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())[0]
        return {
          productId: item.productId,
          qty: this.num(item.qtyOnHand),
          amount: Math.round(this.num(item.qtyOnHand) * this.num(item.avgCost) * 10000) / 10000,
          firstInDate: firstIn ? firstIn.occurredAt.toISOString().slice(0, 10) : this.today()
        }
      })
    return inventoryAging(items, this.today())
  }

  /** ABC 分类报表 */
  async abcReport(dto: InventoryReportDto, user: JwtUser): Promise<Record<string, unknown>> {
    const balances = await this.balanceRepo.find({
      where: scopeWhere<StockBalanceEntity>({
        tenantId: user.tenantId,
        ...(dto.warehouseId ? { warehouseId: dto.warehouseId } : {}),
        ...(dto.productId ? { productId: dto.productId } : {})
      }, user)
    })
    const items = balances
      .filter((item) => this.num(item.qtyOnHand) > 0)
      .map((item) => ({
        productId: item.productId,
        qty: this.num(item.qtyOnHand),
        amount: Math.round(this.num(item.qtyOnHand) * this.num(item.avgCost) * 10000) / 10000
      }))
    return abcAnalysis(items)
  }

  /** 收发存报表 */
  async inOutReport(dto: InventoryReportDto, user: JwtUser): Promise<Record<string, unknown>> {
    const ledger = await this.ledgerRepo.find({
      where: scopeWhere<StockLedgerEntity>({
        tenantId: user.tenantId,
        ...(dto.warehouseId ? { warehouseId: dto.warehouseId } : {}),
        ...(dto.productId ? { productId: dto.productId } : {})
      }, user)
    })
    return stockInOutReport(
      ledger.map((entry) => ({
        productId: entry.productId,
        qtyIn: this.num(entry.qtyIn),
        qtyOut: this.num(entry.qtyOut),
        occurredAt: entry.occurredAt.toISOString()
      })),
      dto.from ?? '',
      dto.to ?? ''
    )
  }

  /** 在途量报表：按产品统计已发未收数量与超期批次 */
  async inTransitReport(dto: InventoryReportDto, user: JwtUser): Promise<Record<string, unknown>> {
    const balances = await this.balanceRepo.find({
      where: scopeWhere<StockBalanceEntity>({
        tenantId: user.tenantId,
        ...(dto.warehouseId ? { warehouseId: dto.warehouseId } : {}),
        ...(dto.productId ? { productId: dto.productId } : {})
      }, user)
    })
    const items = balances
      .filter((item) => this.num(item.qtyInTransit) > 0)
      .map((item) => ({
        productId: item.productId,
        qty: this.num(item.qtyInTransit),
        etaDate: null,
        status: 'IN_TRANSIT'
      }))
    return inTransitSummary(items, this.today())
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10)
  }

  /** 库存锁粒度：租户 + 仓库 + 库位 + 商品 + 规格 + 批次 */
  private stockLockKey(
    tenantId: number,
    warehouseId: number,
    locationId: number,
    productId: number,
    variantId: number,
    batchNo: string
  ): string {
    return `stock:lock:${tenantId}:${warehouseId}:${locationId}:${productId}:${variantId}:${encodeURIComponent(batchNo)}`
  }

  /**
   * 库存维度分布式锁。Redis 不可用时降级放行，由事务内条件 UPDATE 兜底防超卖。
   */
  private async withStockLock<T>(key: string, task: () => Promise<T>): Promise<T> {
    const token = randomBytes(8).toString('hex')
    let redisAvailable = true
    let acquired = false
    try {
      acquired = (await this.redis.set(key, token, 'EX', STOCK_LOCK_TTL_SECONDS, 'NX')) === 'OK'
    } catch {
      redisAvailable = false
    }
    if (redisAvailable && !acquired) throw new ConflictException('库存正在处理中，请稍后重试')
    try {
      return await task()
    } finally {
      if (acquired) {
        try {
          await this.redis.eval(RELEASE_STOCK_LOCK_SCRIPT, 1, key, token)
        } catch {
          // TTL 到期后 Redis 会自动释放，忽略释放异常
        }
      }
    }
  }

  private async getBalanceLocked(
    manager: EntityManager,
    tenantId: number,
    warehouseId: number,
    locationId: number,
    productId: number,
    variantId: number,
    batchNo: string
  ): Promise<StockBalanceEntity> {
    const repo = manager.getRepository(StockBalanceEntity)
    let balance = await repo.createQueryBuilder('balance')
      .setLock('pessimistic_write')
      .where('balance.tenantId = :tenantId', { tenantId })
      .andWhere('balance.warehouseId = :warehouseId', { warehouseId })
      .andWhere('balance.locationId = :locationId', { locationId })
      .andWhere('balance.productId = :productId', { productId })
      .andWhere('balance.variantId = :variantId', { variantId })
      .andWhere('balance.batchNo = :batchNo', { batchNo })
      .getOne()
    if (!balance) {
      await repo.save(repo.create({ tenantId, warehouseId, locationId, productId, variantId, batchNo, qtyOnHand: '0', qtyOccupied: '0', qtyFrozen: '0', avgCost: '0' }))
      balance = await repo.createQueryBuilder('balance')
        .setLock('pessimistic_write')
        .where('balance.tenantId = :tenantId', { tenantId })
        .andWhere('balance.warehouseId = :warehouseId', { warehouseId })
        .andWhere('balance.locationId = :locationId', { locationId })
        .andWhere('balance.productId = :productId', { productId })
        .andWhere('balance.variantId = :variantId', { variantId })
        .andWhere('balance.batchNo = :batchNo', { batchNo })
        .getOne()
    }
    if (!balance) throw new BadRequestException('库存余额初始化失败')
    return balance
  }

  private async getBalance(tenantId: number, warehouseId: number, locationId: number, productId: number, variantId: number, batchNo: string): Promise<StockBalanceEntity> {
    let balance = await this.balanceRepo.findOne({ where: { tenantId, warehouseId, locationId, productId, variantId, batchNo } })
    if (!balance) {
      balance = this.balanceRepo.create({ tenantId, warehouseId, locationId, productId, variantId, batchNo, qtyOnHand: '0', qtyOccupied: '0', qtyFrozen: '0', avgCost: '0' })
      balance = await this.balanceRepo.save(balance)
    }
    return balance
  }

  private number(prefix: string): string {
    return `${prefix}${`${Date.now().toString(36)}${randomBytes(2).toString('hex')}`.toUpperCase()}`
  }

  private num(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  private money(value: number): string { return value.toFixed(3) }

  /* ---------------- 库存调整单：盘盈 / 盘亏 / 系统差异修正 ---------------- */

  async listAdjustments(query: QueryInventoryDto, user: JwtUser): Promise<PageResult<StockAdjustmentEntity>> {
    const where = scopeWhere<StockAdjustmentEntity>({ tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }, user)
    const [list, total] = await this.adjustmentRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async adjustmentDetail(id: number, user: JwtUser): Promise<{ adjustment: StockAdjustmentEntity; lines: StockAdjustmentLineEntity[] }> {
    const adjustment = await this.adjustmentRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!adjustment) throw new NotFoundException('库存调整单不存在')
    const lines = await this.adjustmentLineRepo.find({ where: { tenantId: user.tenantId, adjustmentId: id } })
    return { adjustment, lines }
  }

  /** 新建库存调整单（草稿） */
  async createAdjustment(dto: CreateAdjustmentDto, user: JwtUser): Promise<{ adjustment: StockAdjustmentEntity; lines: StockAdjustmentLineEntity[] }> {
    if (!dto.lines?.length) throw new BadRequestException('调整明细不能为空')
    const warehouseId = dto.warehouseId ?? 0
    if (warehouseId > 0) await this.findWarehouse(warehouseId, user)
    const prepared: AdjustmentLineInput[] = []
    for (const line of dto.lines) {
      await this.findProduct(line.productId, user)
      const qty = this.num(line.qty)
      if (qty === 0) throw new BadRequestException('调整数量不能为 0')
      const balance = warehouseId > 0
        ? await this.balanceRepo.findOne({ where: { tenantId: user.tenantId, warehouseId, locationId: 0, productId: line.productId, variantId: line.variantId ?? 0, batchNo: line.batchNo ?? '' } })
        : null
      const available = balance
        ? this.num(balance.qtyOnHand) - this.num(balance.qtyOccupied) - this.num(balance.qtyFrozen)
        : 0
      prepared.push({
        productId: line.productId,
        variantId: line.variantId ?? 0,
        batchNo: line.batchNo ?? '',
        qty,
        cost: line.cost === undefined ? undefined : this.num(line.cost),
        availableQty: available,
        availableCost: balance ? this.num(balance.avgCost) : 0,
        reason: line.reason ?? dto.reason ?? ''
      })
    }
    const validation = validateAdjustmentLines(prepared)
    const errors = validation.violations.filter((item) => item.level === 'ERROR')
    if (errors.length > 0) throw new BadRequestException(errors.map((item) => item.message).join('；'))
    const adjustment = await this.adjustmentRepo.save(this.adjustmentRepo.create({
      tenantId: user.tenantId,
      adjustNo: this.number('ADJ'),
      adjustType: dto.adjustType,
      warehouseId: warehouseId > 0 ? warehouseId : null,
      status: 'DRAFT',
      totalQtyIn: this.money(validation.totalQtyIn),
      totalQtyOut: this.money(validation.totalQtyOut),
      totalAmount: this.money(validation.totalAmount),
      reason: dto.reason ?? null,
      createdBy: user.userId
    }))
    const lines = await this.adjustmentLineRepo.save(prepared.map((line) => this.adjustmentLineRepo.create({
      tenantId: user.tenantId,
      adjustmentId: adjustment.id,
      productId: line.productId,
      variantId: line.variantId ?? 0,
      batchNo: line.batchNo ?? '',
      qty: this.money(line.qty),
      cost: this.money(line.cost ?? 0),
      amount: this.money(Math.abs(line.qty) * (line.cost ?? 0)),
      reason: line.reason ?? null
    })))
    await this.auditService.record({ bizType: 'stock_adjustment', bizId: adjustment.id, action: 'CREATE_ADJUSTMENT', afterValue: { adjustType: dto.adjustType, lines: lines.length } }, user)
    return { adjustment, lines }
  }

  /** 过账库存调整单：写库存流水并更新结存 */
  async postAdjustment(id: number, dto: PostAdjustmentDto, user: JwtUser): Promise<StockAdjustmentEntity> {
    const adjustment = await this.adjustmentRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!adjustment) throw new NotFoundException('库存调整单不存在')
    if (!canPostAdjustment(adjustment.status)) throw new BadRequestException('仅草稿状态的调整单可以过账')
    const lines = await this.adjustmentLineRepo.find({ where: { tenantId: user.tenantId, adjustmentId: id } })
    if (lines.length === 0) throw new BadRequestException('调整单没有明细，无法过账')
    const warehouseId = adjustment.warehouseId ?? 0
    if (warehouseId <= 0) throw new BadRequestException('调整单必须指定仓库才能过账')
    const prepared: AdjustmentLineInput[] = []
    for (const line of lines) {
      const balance = await this.balanceRepo.findOne({ where: { tenantId: user.tenantId, warehouseId, locationId: 0, productId: line.productId, variantId: line.variantId, batchNo: line.batchNo } })
      const available = balance
        ? this.num(balance.qtyOnHand) - this.num(balance.qtyOccupied) - this.num(balance.qtyFrozen)
        : 0
      prepared.push({
        productId: line.productId,
        variantId: line.variantId,
        batchNo: line.batchNo,
        qty: this.num(line.qty),
        cost: this.num(line.cost) > 0 ? this.num(line.cost) : undefined,
        availableQty: available,
        availableCost: balance ? this.num(balance.avgCost) : 0,
        reason: line.reason ?? adjustment.reason ?? ''
      })
    }
    const validation = validateAdjustmentLines(prepared)
    const errors = validation.violations.filter((item) => item.level === 'ERROR')
    if (errors.length > 0) throw new BadRequestException(errors.map((item) => item.message).join('；'))
    for (const posting of validation.postings) {
      const cost = posting.cost > 0 ? posting.cost : undefined
      await this.postMovement({
        voucherType: 'STOCK_ADJUSTMENT',
        voucherId: adjustment.id,
        voucherLineId: posting.productId,
        warehouseId,
        productId: posting.productId,
        variantId: posting.variantId,
        batchNo: posting.batchNo,
        qtyIn: this.money(posting.qtyIn),
        qtyOut: this.money(posting.qtyOut),
        ...(cost !== undefined ? { cost: this.money(cost) } : {}),
        remark: posting.reason || '库存调整过账'
      }, user)
    }
    adjustment.status = 'POSTED'
    adjustment.postedAt = new Date()
    adjustment.totalQtyIn = this.money(validation.totalQtyIn)
    adjustment.totalQtyOut = this.money(validation.totalQtyOut)
    adjustment.totalAmount = this.money(validation.totalAmount)
    const saved = await this.adjustmentRepo.save(adjustment)
    await this.auditService.record({
      bizType: 'stock_adjustment', bizId: id, action: 'POST_ADJUSTMENT',
      afterValue: { totalQtyIn: saved.totalQtyIn, totalQtyOut: saved.totalQtyOut, totalAmount: saved.totalAmount, reason: dto.reason ?? null }
    }, user)
    return saved
  }

  /** 作废库存调整单（仅草稿） */
  async cancelAdjustment(id: number, dto: PostAdjustmentDto, user: JwtUser): Promise<StockAdjustmentEntity> {
    const adjustment = await this.adjustmentRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!adjustment) throw new NotFoundException('库存调整单不存在')
    if (!canCancelAdjustment(adjustment.status)) throw new BadRequestException('仅草稿状态的调整单可以作废')
    adjustment.status = 'CANCELLED'
    adjustment.reason = dto.reason ?? adjustment.reason
    const saved = await this.adjustmentRepo.save(adjustment)
    await this.auditService.record({ bizType: 'stock_adjustment', bizId: id, action: 'CANCEL_ADJUSTMENT', afterValue: { reason: dto.reason ?? null } }, user)
    return saved
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

  /* ---------------- 成本核算：成本层 / 成本方法 / 期间锁 ---------------- */

  /** 成本层列表：可用于成本追溯与先进先出消耗核对 */
  async listCostLayers(query: QueryInventoryDto, user: JwtUser): Promise<PageResult<StockCostLayerEntity>> {
    const where = scopeWhere<StockCostLayerEntity>({
      tenantId: user.tenantId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.batchNo ? { batchNo: query.batchNo } : {}),
      ...(query.status ? { status: query.status } : {})
    }, user)
    const [list, total] = await this.costLayerRepo.findAndCount({
      where, order: { occurredAt: 'DESC', id: 'DESC' },
      skip: (query.page - 1) * query.pageSize, take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 成本层消耗明细（按先进先出顺序预览下一次出库将消耗哪些层） */
  async previewCostLayerConsumption(productId: number, qtyOut: string, user: JwtUser): Promise<{
    method: CostingMethod
    unitCost: number
    amount: number
    source: string
    consumptions: Array<{ layerId: number; qty: number; unitCost: number; amount: number }>
  }> {
    const product = await this.findProduct(productId, user)
    const method = (product.costingMethod || 'MOVING_WEIGHTED') as CostingMethod
    const layers = await this.costLayerRepo.find({
      where: { tenantId: user.tenantId, productId, status: 'OPEN' }
    })
    const resolved = resolveOutboundCost({
      method,
      avgCost: 0,
      layers: layers.map((item) => ({
        id: item.id,
        qtyAvailable: this.num(item.qtyAvailable),
        unitCost: this.num(item.unitCost),
        occurredAt: item.occurredAt,
        batchNo: item.batchNo
      })),
      qtyOut: this.num(qtyOut),
      batchNo: ''
    })
    return {
      method,
      unitCost: resolved.unitCost,
      amount: resolved.amount,
      source: resolved.source,
      consumptions: resolved.consumptions
    }
  }

  /** 切换产品成本核算方法 */
  async updateCostingMethod(productId: number, method: string, user: JwtUser): Promise<ProductEntity> {
    if (!isCostingMethod(method)) throw new BadRequestException(`不支持的成本核算方法：${method}`)
    const product = await this.findProduct(productId, user)
    const current = (product.costingMethod || 'MOVING_WEIGHTED') as CostingMethod
    const openLayers = await this.costLayerRepo.count({
      where: { tenantId: user.tenantId, productId, status: 'OPEN', qtyAvailable: MoreThan('0') }
    })
    const check = validateCostingMethodChange(current, method, openLayers)
    if (!check.allowed) throw new BadRequestException(check.reason)
    product.costingMethod = method
    const saved = await this.productRepo.save(product)
    await this.auditService.record({
      bizType: 'product', bizId: saved.id, action: 'CHANGE_COSTING_METHOD',
      afterValue: { from: current, to: method, openLayers }
    }, user)
    return saved
  }

  /** 锁定 / 释放成本重算期间 */
  async setCostPeriodLock(period: string, lock: boolean, reason: string | undefined, user: JwtUser): Promise<FinCostPeriodLockEntity> {
    const existing = await this.costPeriodLockRepo.findOne({ where: { tenantId: user.tenantId, period } })
    if (lock) {
      const entity = existing ?? this.costPeriodLockRepo.create({ tenantId: user.tenantId, period })
      entity.lockStatus = 'LOCKED'
      entity.reason = reason ?? null
      entity.lockedBy = user.userId
      entity.lockedAt = new Date()
      const saved = await this.costPeriodLockRepo.save(entity)
      await this.auditService.record({ bizType: 'cost_period_lock', bizId: saved.id, action: 'LOCK_COST_PERIOD', afterValue: { period, reason: reason ?? null } }, user)
      return saved
    }
    if (!existing) throw new NotFoundException('该期间未处于成本锁定状态')
    existing.lockStatus = 'RELEASED'
    existing.lockedBy = user.userId
    existing.lockedAt = new Date()
    const saved = await this.costPeriodLockRepo.save(existing)
    await this.auditService.record({ bizType: 'cost_period_lock', bizId: saved.id, action: 'RELEASE_COST_PERIOD', afterValue: { period } }, user)
    return saved
  }

  /** 成本期间锁列表 */
  async listCostPeriodLocks(user: JwtUser): Promise<FinCostPeriodLockEntity[]> {
    return this.costPeriodLockRepo.find({ where: { tenantId: user.tenantId }, order: { period: 'DESC' } })
  }

  /** 校验当前期间未被成本重算锁定 */
  private async assertCostPeriodUnlocked(user: JwtUser): Promise<void> {
    const period = new Date().toISOString().slice(0, 7)
    const lock = await this.costPeriodLockRepo.findOne({ where: { tenantId: user.tenantId, period, lockStatus: 'LOCKED' } })
    if (lock) throw new BadRequestException(`期间 ${period} 处于成本重算锁定状态，禁止库存过账`)
  }

  /** 负库存放行判定：系统参数开启且用户具备权限 */
  private async resolveAllowNegativeStock(user: JwtUser): Promise<boolean> {
    const configAllowed = await this.configService.getBoolean(user.tenantId, ALLOW_NEGATIVE_STOCK_KEY, false)
    return resolveAllowNegativeStock({
      configAllowed,
      hasPermission: user.permissions.includes(ALLOW_NEGATIVE_STOCK_PERM),
      isSuperAdmin: user.isSuperAdmin
    })
  }

  /**
   * 负库存清单：实物量为负，或可用量（实物 - 占用 - 冻结）为负的结存记录。
   */
  async listNegativeStock(query: QueryInventoryDto, user: JwtUser): Promise<{
    list: Array<NegativeStockEvaluation & {
      warehouseId: number
      locationId: number
      productId: number
      variantId: number
      batchNo: string
      productName: string
      warehouseName: string
    }>
    summary: ReturnType<typeof summarizeNegativeStock>
    config: { allowNegativeStock: boolean; permitRequired: boolean }
  }> {
    const qb = this.balanceRepo.createQueryBuilder('b')
      .where('b.tenant_id = :tenantId', { tenantId: user.tenantId })
      .andWhere('(b.qty_on_hand < 0 OR (b.qty_on_hand - b.qty_occupied - b.qty_frozen) < 0)')
    if (query.warehouseId) qb.andWhere('b.warehouse_id = :warehouseId', { warehouseId: query.warehouseId })
    if (query.productId) qb.andWhere('b.product_id = :productId', { productId: query.productId })
    if (query.batchNo) qb.andWhere('b.batch_no = :batchNo', { batchNo: query.batchNo })
    const rows = await qb.orderBy('b.qty_on_hand', 'ASC').getMany()

    const products = await this.productRepo.find({ where: { tenantId: user.tenantId } })
    const warehouses = await this.warehouseRepo.find({ where: { tenantId: user.tenantId } })
    const productNames = new Map(products.map((item) => [item.id, item.productName]))
    const warehouseNames = new Map(warehouses.map((item) => [item.id, item.warehouseName]))

    const list = rows.map((row) => ({
      ...evaluateNegativeStock({
        qtyOnHand: row.qtyOnHand,
        qtyOccupied: row.qtyOccupied,
        qtyFrozen: row.qtyFrozen
      }),
      warehouseId: row.warehouseId,
      locationId: row.locationId,
      productId: row.productId,
      variantId: row.variantId,
      batchNo: row.batchNo,
      productName: productNames.get(row.productId) ?? '',
      warehouseName: warehouseNames.get(row.warehouseId) ?? ''
    }))

    const configAllowed = await this.configService.getBoolean(user.tenantId, ALLOW_NEGATIVE_STOCK_KEY, false)
    return {
      list,
      summary: summarizeNegativeStock(list),
      config: {
        allowNegativeStock: configAllowed,
        permitRequired: !user.isSuperAdmin && !user.permissions.includes(ALLOW_NEGATIVE_STOCK_PERM)
      }
    }
  }
}
