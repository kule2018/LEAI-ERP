import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import type { JwtUser } from '../../common/contracts'
import {
  daysUntil,
  evaluateSafetyStock,
  evaluateSlowMoving,
  mergeAlertState,
  resolveExpiryLevel,
  resolvePolicy,
  type ExpiryAlert,
  type ResolvedPolicy,
  type SafetyStockAlert,
  type SlowMovingAlert
} from '../../common/inventory-alert-engine'
import { AuditService } from '../audit/audit.service'
import { ProductEntity } from '../master-data/entities/product.entity'
import { TenantEntity } from '../platform/entities/tenant.entity'
import { SchedulerService } from '../ops/scheduler.service'
import { CreateBatchProfileDto, QueryBatchProfileDto, SaveAlertPolicyDto } from './dto'
import { BatchProfileEntity } from './entities/batch-profile.entity'
import { StockAlertEntity, StockBalanceEntity } from './entities/inventory.entities'
import { StockAlertPolicyEntity } from './entities/stock-alert-policy.entity'

export interface BatchProfileRow {
  id: number
  productId: number
  productName: string
  variantId: number | null
  batchNo: string
  warehouseId: number | null
  expiryDate: string | null
  shelfLifeDays: number | null
  qty: string
  status: string
  daysLeft: number | null
}

export interface AlertScanResult {
  expiry: ExpiryAlert[]
  safety: SafetyStockAlert[]
  slowMoving: SlowMovingAlert[]
  created: number
  updated: number
  reopened: number
  skipped: number
  closed: number
}

const DEFAULT_POLICY: ResolvedPolicy = { warnDays: 30, urgentDays: 7, safetyStock: 0, slowMovingDays: 0 }

interface PolicyRow {
  productId: number
  warehouseId: number
  warnDays: number
  urgentDays: number
  safetyStock: number
  slowMovingDays: number
}

/**
 * 库存预警巡检服务：
 * - 批次效期档案登记（到期日 / 保质期）
 * - 临期、过期、安全库存、呆滞库存预警的策略化巡检与落库
 * - 预警关闭原因留痕
 */
@Injectable()
export class InventoryAlertService implements OnModuleInit {
  constructor(
    @InjectRepository(BatchProfileEntity) private readonly batchRepo: Repository<BatchProfileEntity>,
    @InjectRepository(StockAlertEntity) private readonly alertRepo: Repository<StockAlertEntity>,
    @InjectRepository(StockBalanceEntity) private readonly balanceRepo: Repository<StockBalanceEntity>,
    @InjectRepository(StockAlertPolicyEntity) private readonly policyRepo: Repository<StockAlertPolicyEntity>,
    @InjectRepository(ProductEntity) private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(TenantEntity) private readonly tenantRepo: Repository<TenantEntity>,
    private readonly scheduler: SchedulerService,
    private readonly auditService: AuditService
  ) {}

  /** 注册每小时一次的库存预警定时巡检 */
  onModuleInit(): void {
    this.scheduler.register({
      code: 'inventory.alert.scan',
      name: '库存预警定时巡检',
      intervalMinutes: 60,
      enabled: true,
      handler: async () => this.scanAllTenants()
    })
  }

  /** 遍历启用中的租户执行巡检 */
  private async scanAllTenants(): Promise<string> {
    const tenants = await this.tenantRepo.find({ where: { status: 'ACTIVE', isDeleted: 0 } })
    let created = 0
    for (const tenant of tenants) {
      const result = await this.runScan(tenant.id, {})
      created += result.created
    }
    return `租户 ${tenants.length} 个，新增预警 ${created} 条`
  }

  /** 登记或更新批次效期档案 */
  async saveBatchProfile(dto: CreateBatchProfileDto, user: JwtUser): Promise<BatchProfileEntity> {
    if (!dto.batchNo?.trim()) throw new BadRequestException('批次号不能为空')
    const existing = await this.batchRepo.findOne({
      where: { tenantId: user.tenantId, productId: dto.productId, batchNo: dto.batchNo.trim() }
    })
    const payload = {
      tenantId: user.tenantId,
      productId: dto.productId,
      variantId: dto.variantId ?? null,
      batchNo: dto.batchNo.trim(),
      warehouseId: dto.warehouseId ?? null,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
      shelfLifeDays: dto.shelfLifeDays ?? null,
      qty: dto.qty ?? '0',
      status: dto.status ?? 'NORMAL',
      remark: dto.remark ?? null,
      createdBy: user.userId
    }
    const entity = existing ? Object.assign(existing, payload) : this.batchRepo.create(payload)
    const saved = await this.batchRepo.save(entity)
    await this.auditService.record({
      bizType: 'batch_profile',
      bizId: saved.id,
      action: existing ? 'UPDATE_BATCH_PROFILE' : 'CREATE_BATCH_PROFILE',
      afterValue: saved
    }, user)
    return saved
  }

  /** 批次档案列表（含剩余天数与产品名） */
  async listBatchProfiles(query: QueryBatchProfileDto, user: JwtUser): Promise<BatchProfileRow[]> {
    const list = await this.batchRepo.find({
      where: {
        tenantId: user.tenantId,
        ...(query.productId ? { productId: query.productId } : {}),
        ...(query.batchNo ? { batchNo: query.batchNo } : {})
      },
      order: { id: 'DESC' },
      take: query.pageSize ?? 100
    })
    const productIds = [...new Set(list.map((item) => item.productId))]
    const balances = productIds.length > 0
      ? await this.balanceRepo.find({ where: { tenantId: user.tenantId, productId: In(productIds) } })
      : []
    const nameMap = await this.productNameMap(productIds)
    const qtyMap = new Map<string, number>()
    for (const balance of balances) {
      const key = `${balance.productId}:${balance.batchNo ?? ''}`
      qtyMap.set(key, (qtyMap.get(key) ?? 0) + Number(balance.qtyOnHand ?? 0))
    }
    const now = new Date()
    return list.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: nameMap.get(item.productId) ?? '',
      variantId: item.variantId,
      batchNo: item.batchNo,
      warehouseId: item.warehouseId,
      expiryDate: item.expiryDate ? item.expiryDate.toISOString() : null,
      shelfLifeDays: item.shelfLifeDays,
      qty: (qtyMap.get(`${item.productId}:${item.batchNo}`) ?? Number(item.qty ?? 0)).toFixed(3),
      status: item.status,
      daysLeft: item.expiryDate ? daysUntil(item.expiryDate, now) : null
    }))
  }

  /** 查询预警策略列表 */
  async listPolicies(user: JwtUser): Promise<StockAlertPolicyEntity[]> {
    return this.policyRepo.find({
      where: { tenantId: user.tenantId },
      order: { id: 'ASC' }
    })
  }

  /** 保存预警策略（同一产品+仓库覆盖更新） */
  async savePolicy(dto: SaveAlertPolicyDto, user: JwtUser): Promise<StockAlertPolicyEntity> {
    if ((dto.urgentDays ?? 0) > (dto.warnDays ?? 0)) throw new BadRequestException('紧急阈值不能大于预警阈值')
    const existing = await this.policyRepo.findOne({
      where: {
        tenantId: user.tenantId,
        productId: dto.productId ?? 0,
        warehouseId: dto.warehouseId ?? 0
      }
    })
    const payload = {
      tenantId: user.tenantId,
      productId: dto.productId ?? 0,
      warehouseId: dto.warehouseId ?? 0,
      warnDays: dto.warnDays ?? 30,
      urgentDays: dto.urgentDays ?? 7,
      safetyStock: dto.safetyStock ?? '0',
      slowMovingDays: dto.slowMovingDays ?? 0,
      status: dto.status ?? 'ENABLED',
      remark: dto.remark ?? null
    }
    const entity = existing ? Object.assign(existing, payload) : this.policyRepo.create(payload)
    const saved = await this.policyRepo.save(entity)
    await this.auditService.record({
      bizType: 'stock_alert_policy',
      bizId: saved.id,
      action: existing ? 'UPDATE_ALERT_POLICY' : 'CREATE_ALERT_POLICY',
      afterValue: saved
    }, user)
    return saved
  }

  /**
   * 全量巡检：临期/过期、安全库存、呆滞库存预警落库。
   * - 预警级别变化时刷新（WARNING → URGENT → EXPIRED）
   * - 已关闭但条件仍成立的预警重新开启
   * - 条件不再成立的过期/临期预警自动关闭
   */
  async scanAlerts(override: Partial<ResolvedPolicy>, user: JwtUser): Promise<AlertScanResult> {
    return this.runScan(user.tenantId, override)
  }

  /** 定时巡检：遍历启用中的租户执行预警巡检 */
  private async runScan(tenantId: number, override: Partial<ResolvedPolicy>): Promise<AlertScanResult> {
    const now = new Date()
    const policies = await this.policyRows(tenantId)
    const profiles = await this.batchRepo.find({ where: { tenantId } })
    const balances = await this.balanceRepo.find({ where: { tenantId } })
    const productIds = [...new Set([...profiles.map((p) => p.productId), ...balances.map((b) => b.productId)])]
    const nameMap = await this.productNameMap(productIds)

    const qtyByBatch = new Map<string, number>()
    const qtyByProductWarehouse = new Map<string, number>()
    const lastMovedByProductWarehouse = new Map<string, number>()
    for (const balance of balances) {
      const batchKey = `${balance.productId}:${balance.batchNo ?? ''}`
      qtyByBatch.set(batchKey, (qtyByBatch.get(batchKey) ?? 0) + Number(balance.qtyOnHand ?? 0))
      const pwKey = `${balance.productId}:${balance.warehouseId}`
      qtyByProductWarehouse.set(pwKey, (qtyByProductWarehouse.get(pwKey) ?? 0) + Number(balance.qtyOnHand ?? 0))
      const movedDays = balance.updatedAt
        ? Math.floor((now.getTime() - balance.updatedAt.getTime()) / 86400000)
        : 0
      const prev = lastMovedByProductWarehouse.get(pwKey) ?? Number.POSITIVE_INFINITY
      lastMovedByProductWarehouse.set(pwKey, Math.min(prev, movedDays))
    }

    // 1. 临期/过期批次
    const expiry: ExpiryAlert[] = []
    const batchStatusUpdates: Array<{ id: number; status: string }> = []
    for (const profile of profiles) {
      if (!profile.expiryDate) continue
      if (profile.status === 'FROZEN') continue
      const policy = this.policyOf(policies, profile.productId, profile.warehouseId ?? 0, override)
      const left = daysUntil(profile.expiryDate, now)
      const level = resolveExpiryLevel(left, policy.warnDays, policy.urgentDays)
      const qty = qtyByBatch.get(`${profile.productId}:${profile.batchNo}`) ?? Number(profile.qty ?? 0)
      if (level) {
        expiry.push({
          productId: profile.productId,
          productName: nameMap.get(profile.productId) ?? '',
          batchNo: profile.batchNo,
          expiryDate: profile.expiryDate.toISOString(),
          daysLeft: left,
          qty,
          level
        })
      }
      const status = level === 'EXPIRED' ? 'EXPIRED' : level ? 'EXPIRING' : 'NORMAL'
      if (profile.status !== status) batchStatusUpdates.push({ id: profile.id, status })
    }
    if (batchStatusUpdates.length > 0) {
      await this.batchRepo.save(batchStatusUpdates.map((item) => this.batchRepo.create({ id: item.id, status: item.status })))
    }

    // 2. 安全库存与呆滞库存
    const safety: SafetyStockAlert[] = []
    const slowMoving: SlowMovingAlert[] = []
    const policyTargets = new Map<string, PolicyRow>()
    for (const policy of policies) {
      if (policy.safetyStock > 0 || policy.slowMovingDays > 0) {
        policyTargets.set(`${policy.productId}:${policy.warehouseId}`, policy)
      }
    }
    for (const [key, policy] of policyTargets) {
      const [productIdText, warehouseIdText] = key.split(':')
      const productId = Number(productIdText)
      const warehouseId = Number(warehouseIdText)
      const onHand = warehouseId > 0
        ? qtyByProductWarehouse.get(`${productId}:${warehouseId}`) ?? 0
        : [...qtyByProductWarehouse.entries()]
          .filter(([k]) => k.startsWith(`${productId}:`))
          .reduce((sum, [, qty]) => sum + qty, 0)
      if (policy.safetyStock > 0) {
        safety.push(...evaluateSafetyStock([{
          productId,
          productName: nameMap.get(productId) ?? '',
          warehouseId,
          onHand,
          safetyStock: policy.safetyStock
        }]))
      }
      if (policy.slowMovingDays > 0) {
        const lastOutboundDays = lastMovedByProductWarehouse.get(`${productId}:${warehouseId}`) ?? 0
        slowMoving.push(...evaluateSlowMoving([{
          productId,
          productName: nameMap.get(productId) ?? '',
          warehouseId,
          qty: onHand,
          lastOutboundDays,
          thresholdDays: policy.slowMovingDays
        }]))
      }
    }

    // 3. 落库与生命周期维护
    const existing = await this.alertRepo.find({ where: { tenantId } })
    const counters = { created: 0, updated: 0, reopened: 0, skipped: 0, closed: 0 }
    const seen = new Set<string>()

    const upsert = async (
      key: string,
      alertType: string,
      alertLevel: string,
      productId: number,
      warehouseId: number,
      batchNo: string | null,
      thresholdQty: number,
      currentQty: string,
      suggestQty: string,
      message: string
    ): Promise<void> => {
      seen.add(key)
      const previous = existing.find((item) => this.alertKey(item) === key)
      const action = mergeAlertState(previous ?? null, alertLevel, thresholdQty)
      if (action === 'SKIP') { counters.skipped += 1; return }
      if (action === 'CREATE') {
        await this.alertRepo.save(this.alertRepo.create({
          tenantId,
          alertType,
          alertLevel,
          productId,
          warehouseId,
          batchNo,
          thresholdQty: String(thresholdQty),
          currentQty,
          suggestQty,
          status: 'OPEN',
          message
        }))
        counters.created += 1
        return
      }
      if (!previous) return
      if (action === 'REOPEN') {
        previous.status = 'OPEN'
        previous.closeReason = null
        previous.closedBy = null
        previous.closedAt = null
        counters.reopened += 1
      } else {
        counters.updated += 1
      }
      previous.alertLevel = alertLevel
      previous.thresholdQty = String(thresholdQty)
      previous.currentQty = currentQty
      previous.suggestQty = suggestQty
      previous.message = message
      await this.alertRepo.save(previous)
    }

    for (const alert of expiry) {
      const key = `EXPIRY:${alert.productId}:${alert.batchNo}`
      const text = alert.level === 'EXPIRED' ? '已过期' : '即将过期'
      await upsert(
        key,
        'EXPIRY',
        alert.level,
        alert.productId,
        0,
        alert.batchNo,
        alert.daysLeft,
        alert.qty.toFixed(3),
        '0',
        `批次 ${alert.batchNo} ${text}（剩余 ${alert.daysLeft} 天）`
      )
    }
    for (const alert of safety) {
      const key = `LOW_STOCK:${alert.productId}:${alert.warehouseId}`
      await upsert(
        key,
        'LOW_STOCK',
        'WARNING',
        alert.productId,
        alert.warehouseId,
        null,
        alert.safetyStock,
        String(alert.onHand),
        String(alert.suggestQty),
        `低于安全库存，缺口 ${alert.shortage}`
      )
    }
    for (const alert of slowMoving) {
      const key = `SLOW_MOVING:${alert.productId}:${alert.warehouseId}`
      await upsert(
        key,
        'SLOW_MOVING',
        'INFO',
        alert.productId,
        alert.warehouseId,
        null,
        alert.thresholdDays,
        String(alert.qty),
        '0',
        `超过 ${alert.thresholdDays} 天未出库`
      )
    }

    // 条件不再成立的历史预警自动关闭
    for (const item of existing) {
      if (item.status !== 'OPEN') continue
      if (!['EXPIRY', 'LOW_STOCK', 'SLOW_MOVING'].includes(item.alertType)) continue
      if (seen.has(this.alertKey(item))) continue
      item.status = 'CLOSED'
      item.closeReason = '巡检发现条件不再成立，系统自动关闭'
      item.closedAt = new Date()
      await this.alertRepo.save(item)
      counters.closed += 1
    }

    return { expiry, safety, slowMoving, ...counters }
  }

  /** 关闭预警（必须记录原因） */
  async closeAlert(id: number, reason: string, user: JwtUser): Promise<StockAlertEntity> {
    const alert = await this.alertRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!alert) throw new BadRequestException('预警不存在')
    alert.status = 'CLOSED'
    alert.closeReason = reason
    alert.closedBy = user.userId
    alert.closedAt = new Date()
    const saved = await this.alertRepo.save(alert)
    await this.auditService.record({ bizType: 'stock_alert', bizId: id, action: 'CLOSE_ALERT', afterValue: { reason } }, user)
    return saved
  }

  private alertKey(alert: StockAlertEntity): string {
    return `${alert.alertType}:${alert.productId}:${alert.batchNo ?? alert.warehouseId ?? 0}`
  }

  private async policyRows(tenantId: number): Promise<PolicyRow[]> {
    const rows = await this.policyRepo.find({ where: { tenantId, status: 'ENABLED' } })
    return rows.map((row) => ({
      productId: row.productId,
      warehouseId: row.warehouseId,
      warnDays: row.warnDays,
      urgentDays: row.urgentDays,
      safetyStock: Number(row.safetyStock ?? 0),
      slowMovingDays: row.slowMovingDays
    }))
  }

  private policyOf(policies: PolicyRow[], productId: number, warehouseId: number, override: Partial<ResolvedPolicy>): ResolvedPolicy {
    const resolved = resolvePolicy(policies, productId, warehouseId, DEFAULT_POLICY)
    return {
      warnDays: override.warnDays ?? resolved.warnDays,
      urgentDays: override.urgentDays ?? resolved.urgentDays,
      safetyStock: resolved.safetyStock,
      slowMovingDays: resolved.slowMovingDays
    }
  }

  private async productNameMap(productIds: number[]): Promise<Map<number, string>> {
    const map = new Map<number, string>()
    if (productIds.length === 0) return map
    const products = await this.productRepo.find({ where: { id: In(productIds) } })
    for (const product of products) map.set(product.id, product.productName)
    return map
  }
}
