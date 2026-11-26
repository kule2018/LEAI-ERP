import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { ALERT_METRIC } from '../../common/alert-rule-engine'
import { AlertService } from '../alert/alert.service'
import {
  detectApprovalTimeout, detectArRisk, detectCreditRisk, detectStockRisk, detectSyncRisk,
  riskKey, severityWeight, type RiskCandidate
} from '../../common/risk-engine'
import { AuditService } from '../audit/audit.service'
import { SchedulerService } from '../ops/scheduler.service'
import { TenantEntity } from '../platform/entities/tenant.entity'
import { FlowInstanceEntity, FlowTaskEntity } from '../collaboration/entities/collaboration.entities'
import { ReceivableEntity } from '../finance/entities/finance.entities'
import { StockAlertEntity } from '../inventory/entities/inventory.entities'
import { CustomerEntity } from '../master-data/entities/customer.entity'
import { ShopSyncLogEntity } from '../shop/entities/shop.entities'
import type { QueryRiskDto } from './dto'
import { RiskAlertEntity } from './entities/risk-alert.entity'

interface CustomerCreditRow { id: number; customerName: string; creditLimit: string; creditUsed: string }

@Injectable()
export class RiskService implements OnModuleInit {
  constructor(
    @InjectRepository(RiskAlertEntity) private readonly alertRepo: Repository<RiskAlertEntity>,
    @InjectRepository(CustomerEntity) private readonly customerRepo: Repository<CustomerEntity>,
    @InjectRepository(StockAlertEntity) private readonly stockAlertRepo: Repository<StockAlertEntity>,
    @InjectRepository(ReceivableEntity) private readonly receivableRepo: Repository<ReceivableEntity>,
    @InjectRepository(FlowInstanceEntity) private readonly flowInstanceRepo: Repository<FlowInstanceEntity>,
    @InjectRepository(FlowTaskEntity) private readonly flowTaskRepo: Repository<FlowTaskEntity>,
    @InjectRepository(ShopSyncLogEntity) private readonly syncLogRepo: Repository<ShopSyncLogEntity>,
    @InjectRepository(TenantEntity) private readonly tenantRepo: Repository<TenantEntity>,
    private readonly auditService: AuditService,
    private readonly scheduler: SchedulerService,
    private readonly alertService: AlertService
  ) {}

  onModuleInit(): void {
    this.scheduler.register({
      code: 'risk.scan',
      name: '业务风险自动扫描',
      intervalMinutes: 60,
      enabled: true,
      handler: async () => {
        const tenants = await this.tenantRepo.find()
        let total = 0
        for (const tenant of tenants) {
          const systemUser: JwtUser = {
            userId: 0, tenantId: tenant.id, username: 'system', realName: '系统',
            orgId: null, roles: [], permissions: [], isSuperAdmin: true, dataScopeLevel: 'ALL'
          }
          const result = await this.scan(systemUser)
          total += result.created + result.reopened
        }
        return `已扫描 ${tenants.length} 个租户，新增/重开风险 ${total} 条`
      }
    })
  }

  /** 扫描各业务域数据生成风险项，按 riskKey 去重后落库（已关闭风险重新出现时重新打开） */
  async scan(user: JwtUser): Promise<{ found: number; created: number; reopened: number }> {
    const now = new Date()
    const candidates: RiskCandidate[] = []
    // 风险阈值统一取自告警规则表，未配置时回落到内置默认值
    const thresholds = await this.alertService.thresholds(user.tenantId, [
      ALERT_METRIC.CREDIT_OVER_RATIO,
      ALERT_METRIC.STOCK_CRITICAL_RATIO,
      ALERT_METRIC.AR_MEDIUM_DAYS,
      ALERT_METRIC.AR_HIGH_DAYS
    ])
    const riskOptions = {
      creditOverHighRatio: thresholds[ALERT_METRIC.CREDIT_OVER_RATIO],
      stockCriticalRatio: thresholds[ALERT_METRIC.STOCK_CRITICAL_RATIO],
      arMediumDays: thresholds[ALERT_METRIC.AR_MEDIUM_DAYS],
      arHighDays: thresholds[ALERT_METRIC.AR_HIGH_DAYS]
    }

    // 信用超限
    const customers = await this.customerRepo.find({
      where: { tenantId: user.tenantId, isDeleted: 0 },
      take: 1000
    }) as unknown as CustomerCreditRow[]
    for (const c of customers) {
      const risk = detectCreditRisk({
        customerId: c.id,
        customerName: c.customerName,
        creditLimit: c.creditLimit,
        creditUsed: c.creditUsed
      }, 0, riskOptions)
      if (risk) candidates.push(risk)
    }

    // 库存低于安全线
    const stockAlerts = await this.stockAlertRepo.find({
      where: { tenantId: user.tenantId, status: 'OPEN' },
      take: 1000
    })
    for (const alert of stockAlerts) {
      const risk = detectStockRisk({
        productId: alert.productId,
        warehouseId: alert.warehouseId,
        currentQty: alert.currentQty,
        thresholdQty: alert.thresholdQty
      }, riskOptions)
      if (risk) candidates.push(risk)
    }

    // 逾期应收
    const receivables = await this.receivableRepo.find({
      where: { tenantId: user.tenantId, status: 'OPEN' },
      take: 1000
    })
    for (const ar of receivables) {
      const risk = detectArRisk({
        receivableId: ar.id,
        customerId: ar.customerId,
        amount: ar.amount,
        receivedAmount: ar.receivedAmount,
        dueDate: ar.dueDate
      }, now, riskOptions)
      if (risk) candidates.push(risk)
    }

    // 审批超时
    const overdueTasks = await this.flowTaskRepo.find({
      where: { tenantId: user.tenantId, status: 'PENDING' },
      take: 1000
    })
    const instances = await this.flowInstanceRepo.find({
      where: { tenantId: user.tenantId, status: 'RUNNING' },
      take: 1000
    })
    const instanceMap = new Map(instances.map((item) => [item.id, item]))
    for (const task of overdueTasks) {
      const instance = instanceMap.get(task.instanceId)
      if (!instance) continue
      const risk = detectApprovalTimeout({
        instanceId: instance.id,
        bizType: instance.bizType,
        bizId: instance.bizId,
        dueAt: task.dueAt,
        escalated: instance.escalated
      }, now)
      if (risk) candidates.push(risk)
    }

    // 商城同步失败
    const syncLogs = await this.syncLogRepo.find({
      where: { tenantId: user.tenantId },
      order: { id: 'DESC' },
      take: 200
    })
    for (const log of syncLogs) {
      const risk = detectSyncRisk({
        logId: log.id,
        storeId: log.storeId,
        bizType: log.bizType,
        result: log.result,
        errorText: log.errorText
      })
      if (risk) candidates.push(risk)
    }

    // 去重落库
    const seen = new Set<string>()
    let created = 0
    let reopened = 0
    for (const candidate of candidates) {
      const key = riskKey(candidate)
      if (seen.has(key)) continue
      seen.add(key)

      const existing = await this.alertRepo.findOne({ where: { tenantId: user.tenantId, riskKey: key } })
      if (existing) {
        if (existing.status === 'CLOSED') {
          existing.status = 'OPEN'
          existing.closedBy = null
          existing.closeReason = null
          existing.closedAt = null
          existing.message = candidate.message
          existing.severity = candidate.severity
          existing.updatedAt = now
          await this.alertRepo.save(existing)
          reopened++
        } else {
          existing.message = candidate.message
          existing.severity = candidate.severity
          existing.updatedAt = now
          await this.alertRepo.save(existing)
        }
        continue
      }
      await this.alertRepo.save(this.alertRepo.create({
        tenantId: user.tenantId,
        riskKey: key,
        riskType: candidate.type,
        bizType: candidate.bizType,
        bizId: candidate.bizId,
        severity: candidate.severity,
        title: candidate.title,
        message: candidate.message,
        evidence: candidate.evidence,
        suggestion: candidate.suggestion ?? null,
        status: 'OPEN',
        createdBy: user.userId
      }))
      created++
    }

    await this.auditService.record({
      bizType: 'risk_alert', bizId: 0, action: 'SCAN_RISKS',
      afterValue: { found: candidates.length, created, reopened }
    }, user)
    return { found: candidates.length, created, reopened }
  }

  async list(query: QueryRiskDto, user: JwtUser): Promise<PageResult<RiskAlertEntity>> {
    const where = {
      tenantId: user.tenantId,
      ...(query.riskType ? { riskType: query.riskType } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.status ? { status: query.status } : {})
    }
    const [list, total] = await this.alertRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    list.sort((a, b) => severityWeight(b.severity as never) - severityWeight(a.severity as never))
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async assign(id: number, assigneeId: number, user: JwtUser): Promise<RiskAlertEntity> {
    const alert = await this.findAlert(id, user)
    if (alert.status === 'CLOSED') throw new BadRequestException('已关闭的风险不可指派')
    alert.assigneeId = assigneeId
    alert.status = 'ASSIGNED'
    alert.updatedAt = new Date()
    const saved = await this.alertRepo.save(alert)
    await this.auditService.record({ bizType: 'risk_alert', bizId: id, action: 'ASSIGN_RISK', afterValue: { assigneeId } }, user)
    return saved
  }

  async close(id: number, reason: string, user: JwtUser): Promise<RiskAlertEntity> {
    if (!reason?.trim()) throw new BadRequestException('关闭风险必须填写原因')
    const alert = await this.findAlert(id, user)
    if (alert.status === 'CLOSED') throw new BadRequestException('该风险已关闭')
    alert.status = 'CLOSED'
    alert.closedBy = user.userId
    alert.closeReason = reason.trim()
    alert.closedAt = new Date()
    alert.updatedAt = new Date()
    const saved = await this.alertRepo.save(alert)
    await this.auditService.record({ bizType: 'risk_alert', bizId: id, action: 'CLOSE_RISK', afterValue: { reason } }, user)
    return saved
  }

  private async findAlert(id: number, user: JwtUser): Promise<RiskAlertEntity> {
    const alert = await this.alertRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!alert) throw new NotFoundException('风险预警不存在')
    return alert
  }
}
