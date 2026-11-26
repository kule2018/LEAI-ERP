import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Between, Repository } from 'typeorm'
import { type JwtUser } from '../../common/contracts'
import {
  canExecuteCostJob,
  canRetryCostJob,
  evaluateJobProgress,
  recalculateProductCost,
  resolveJobError,
  summarizeRecalculation,
  type RecalcProductInput,
  type RecalcProductResult
} from '../../common/cost-recalculation-rules'
import { COST_JOB_STATUS, type CostJobStatus } from '../../common/asset-cost-rules'
import { isCostingMethod, type CostingMethod } from '../../common/inventory-costing-rules'
import { AuditService } from '../audit/audit.service'
import { ProductEntity } from '../master-data/entities/product.entity'
import { FinCostPeriodLockEntity, StockCostLayerEntity } from '../inventory/entities/stock-cost-layer.entity'
import { StockBalanceEntity, StockLedgerEntity } from '../inventory/entities/inventory.entities'
import { CostJobEntity } from './entities/cost-job.entity'
import { FinCostEntity } from './entities/finance.entities'

/** 重算写入的期间成本类型 */
const RECALC_COST_TYPE = 'PERIOD'

/**
 * 成本重算执行器
 *
 * 规范要求：成本重算 —— 任务队列、进度、失败重试、回滚；重算期间需锁定。
 * 执行流程：校验任务状态 → 锁定期间 → 汇总期间流水与结存 → 重算成本 → 回写 fin_cost → 更新进度 → 释放期间。
 */
@Injectable()
export class CostRecalculationService {
  constructor(
    @InjectRepository(CostJobEntity) private readonly jobRepo: Repository<CostJobEntity>,
    @InjectRepository(FinCostEntity) private readonly costRepo: Repository<FinCostEntity>,
    @InjectRepository(StockLedgerEntity) private readonly ledgerRepo: Repository<StockLedgerEntity>,
    @InjectRepository(StockBalanceEntity) private readonly balanceRepo: Repository<StockBalanceEntity>,
    @InjectRepository(StockCostLayerEntity) private readonly layerRepo: Repository<StockCostLayerEntity>,
    @InjectRepository(FinCostPeriodLockEntity) private readonly periodLockRepo: Repository<FinCostPeriodLockEntity>,
    @InjectRepository(ProductEntity) private readonly productRepo: Repository<ProductEntity>,
    private readonly auditService: AuditService
  ) {}

  /** 执行成本重算任务 */
  async execute(id: number, user: JwtUser): Promise<CostJobEntity> {
    const job = await this.jobRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!job) throw new NotFoundException('成本重算任务不存在')
    if (!canExecuteCostJob(job.status)) {
      throw new BadRequestException(`任务状态 ${job.status} 不允许执行，仅待执行任务可执行`)
    }

    await this.lockPeriod(job.period, job.id, user)

    job.status = COST_JOB_STATUS.RUNNING
    job.progress = 0
    job.errorMessage = null
    job.finishedAt = null
    await this.jobRepo.save(job)

    try {
      const inputs = await this.collectInputs(job.period, user)
      job.totalItems = inputs.length
      await this.jobRepo.save(job)

      const results: RecalcProductResult[] = []
      for (const input of inputs) {
        const result = recalculateProductCost(input)
        await this.saveCost(job.period, result, user)
        results.push(result)
        job.progress = evaluateJobProgress(results.length, inputs.length)
        await this.jobRepo.save(job)
      }

      job.status = COST_JOB_STATUS.DONE
      job.progress = 100
      job.finishedAt = new Date()
      job.snapshot = { ...(job.snapshot ?? {}), summary: summarizeRecalculation(results) }
      const saved = await this.jobRepo.save(job)
      await this.releasePeriod(job.period, user)
      await this.auditService.record({
        bizType: 'fin_cost_job',
        bizId: id,
        action: 'EXECUTE_COST_JOB',
        afterValue: { period: job.period, totalItems: inputs.length }
      }, user)
      return saved
    } catch (error) {
      job.status = COST_JOB_STATUS.FAILED
      job.errorMessage = resolveJobError(error)
      job.finishedAt = new Date()
      await this.jobRepo.save(job)
      await this.releasePeriod(job.period, user)
      await this.auditService.record({
        bizType: 'fin_cost_job',
        bizId: id,
        action: 'FAIL_COST_JOB',
        afterValue: { period: job.period, errorMessage: job.errorMessage }
      }, user)
      throw new BadRequestException(`成本重算失败：${job.errorMessage}`)
    }
  }

  /** 失败任务重试：流转回 PENDING 后重新执行 */
  async retry(id: number, user: JwtUser): Promise<CostJobEntity> {
    const job = await this.jobRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!job) throw new NotFoundException('成本重算任务不存在')
    if (!canRetryCostJob(job.status)) {
      throw new BadRequestException(`任务状态 ${job.status} 不允许重试`)
    }
    job.status = COST_JOB_STATUS.PENDING as CostJobStatus
    job.errorMessage = null
    job.progress = 0
    job.finishedAt = null
    await this.jobRepo.save(job)
    await this.auditService.record({ bizType: 'fin_cost_job', bizId: id, action: 'RETRY_COST_JOB' }, user)
    return this.execute(id, user)
  }

  /* ------------------------------ 内部实现 ------------------------------ */

  /** 汇总期间内的重算输入 */
  private async collectInputs(period: string, user: JwtUser): Promise<RecalcProductInput[]> {
    const [start, end] = this.periodRange(period)
    const [ledgers, balances, costs, layers, products] = await Promise.all([
      this.ledgerRepo.find({
        where: { tenantId: user.tenantId, occurredAt: Between(start, end) },
        order: { occurredAt: 'ASC', id: 'ASC' }
      }),
      this.balanceRepo.find({ where: { tenantId: user.tenantId } }),
      this.costRepo.find({ where: { tenantId: user.tenantId, period } }),
      this.layerRepo.find({ where: { tenantId: user.tenantId, status: 'OPEN' } }),
      this.productRepo.find({ where: { tenantId: user.tenantId } })
    ])

    const methodMap = new Map<number, CostingMethod>()
    for (const product of products) {
      methodMap.set(product.id, isCostingMethod(product.costingMethod) ? product.costingMethod : 'MOVING_WEIGHTED')
    }

    const ledgerMap = new Map<number, typeof ledgers>()
    for (const ledger of ledgers) {
      const list = ledgerMap.get(ledger.productId) ?? []
      list.push(ledger)
      ledgerMap.set(ledger.productId, list)
    }

    const balanceMap = new Map<number, { qty: number; amount: number }>()
    for (const balance of balances) {
      const current = balanceMap.get(balance.productId) ?? { qty: 0, amount: 0 }
      const qty = this.num(balance.qtyOnHand)
      current.qty += qty
      current.amount += qty * this.num(balance.avgCost)
      balanceMap.set(balance.productId, current)
    }

    const layerMap = new Map<number, typeof layers>()
    for (const layer of layers) {
      const list = layerMap.get(layer.productId) ?? []
      list.push(layer)
      layerMap.set(layer.productId, list)
    }

    const bookMap = new Map<number, number>()
    for (const cost of costs) {
      bookMap.set(cost.productId, this.num(cost.amount))
    }

    const productIds = new Set<number>([
      ...ledgerMap.keys(),
      ...balanceMap.keys(),
      ...bookMap.keys()
    ])

    const inputs: RecalcProductInput[] = []
    for (const productId of productIds) {
      const movements = ledgerMap.get(productId) ?? []
      const balance = balanceMap.get(productId) ?? { qty: 0, amount: 0 }
      const first = movements[0]
      const inQty = movements.reduce((sum, item) => sum + this.num(item.qtyIn), 0)
      const outQty = movements.reduce((sum, item) => sum + this.num(item.qtyOut), 0)
      const openingQty = first
        ? this.num(first.balanceQty) - this.num(first.qtyDelta)
        : balance.qty
      const openingUnitCost = first
        ? this.num(first.cost)
        : balance.qty > 0 ? balance.amount / balance.qty : 0
      const openingAmount = openingQty * openingUnitCost
      const closingQty = balance.qty > 0 ? balance.qty : openingQty + inQty - outQty

      inputs.push({
        productId,
        method: methodMap.get(productId) ?? 'MOVING_WEIGHTED',
        openingQty,
        openingAmount,
        closingQty,
        movements: movements.map((item) => ({
          qtyIn: this.num(item.qtyIn),
          qtyOut: this.num(item.qtyOut),
          unitCost: this.num(item.cost),
          occurredAt: item.occurredAt
        })),
        layers: (layerMap.get(productId) ?? []).map((item) => ({
          id: item.id,
          qtyAvailable: this.num(item.qtyAvailable),
          unitCost: this.num(item.unitCost),
          occurredAt: item.occurredAt,
          batchNo: item.batchNo
        })),
        bookAmount: bookMap.has(productId) ? bookMap.get(productId)! : null
      })
    }
    return inputs
  }

  /** 回写重算结果到期间成本 */
  private async saveCost(period: string, result: RecalcProductResult, user: JwtUser): Promise<void> {
    const existing = await this.costRepo.findOne({
      where: { tenantId: user.tenantId, productId: result.productId, period, costType: RECALC_COST_TYPE }
    })
    if (existing) {
      existing.amount = result.closingAmount.toFixed(4)
      await this.costRepo.save(existing)
      return
    }
    await this.costRepo.save(this.costRepo.create({
      tenantId: user.tenantId,
      productId: result.productId,
      period,
      costType: RECALC_COST_TYPE,
      amount: result.closingAmount.toFixed(4)
    }))
  }

  /** 锁定成本期间 */
  private async lockPeriod(period: string, jobId: number, user: JwtUser): Promise<void> {
    const existing = await this.periodLockRepo.findOne({ where: { tenantId: user.tenantId, period } })
    if (existing && existing.lockStatus === 'LOCKED') {
      throw new BadRequestException(`成本期间 ${period} 已锁定，无法执行成本重算`)
    }
    const entity = existing ?? this.periodLockRepo.create({ tenantId: user.tenantId, period })
    entity.lockStatus = 'LOCKED'
    entity.reason = `成本重算任务 #${jobId}`
    entity.lockedBy = user.userId
    entity.lockedAt = new Date()
    await this.periodLockRepo.save(entity)
  }

  /** 释放成本期间 */
  private async releasePeriod(period: string, user: JwtUser): Promise<void> {
    const existing = await this.periodLockRepo.findOne({ where: { tenantId: user.tenantId, period } })
    if (!existing) return
    existing.lockStatus = 'RELEASED'
    existing.reason = null
    existing.lockedAt = null
    await this.periodLockRepo.save(existing)
  }

  /** 期间起止时间 */
  private periodRange(period: string): [Date, Date] {
    const [year, month] = period.split('-').map((item) => Number(item))
    const safeYear = Number.isFinite(year) ? year : new Date().getUTCFullYear()
    const safeMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : 1
    const start = new Date(Date.UTC(safeYear, safeMonth - 1, 1, 0, 0, 0))
    const end = new Date(Date.UTC(safeYear, safeMonth, 1, 0, 0, 0))
    return [start, end]
  }

  private num(value: number | string | null | undefined): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }
}
