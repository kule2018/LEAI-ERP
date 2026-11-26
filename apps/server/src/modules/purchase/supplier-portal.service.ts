import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import type Redis from 'ioredis'
import { Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult, type PortalUser } from '../../common/contracts'
import { PORTAL_TOKEN_TYPE } from '../../common/guards/supplier-portal.guard'
import { env } from '../../config/env'
import { comparePassword, hashPassword, validatePasswordPolicy } from '../../common/utils/password.util'
import { checkPortalDuplicate, checkPortalOrderConfirm, checkPortalStatementConfirm } from './purchase-portal-rules'
import {
  evaluatePortalAccountStatus,
  evaluatePortalLogin,
  evaluatePortalLoginFailure,
  evaluateSupplierOwnership,
  PORTAL_LOCK_MINUTES
} from '../../common/supplier-portal-rules'
import {
  CreatePortalAccountDto,
  PortalAccountQueryDto,
  PortalInvoiceInputDto,
  PortalLoginDto,
  PortalQueryDto,
  PortalShipmentInputDto,
  ResetPortalPasswordDto,
  UpdatePortalAccountDto
} from './supplier-portal.dto'
import {
  GoodsReceiptEntity,
  LogisticsWaybillEntity,
  PurchaseOrderEntity,
  PurchaseOrderLineEntity,
  SupplierPortalActionEntity,
  VendorStatementEntity
} from './entities/purchase.entities'
import { SupplierPortalUserEntity } from './entities/supplier-portal.entities'
import { SupplierEntity } from '../master-data/entities/supplier.entity'
import { FinInvoiceEntity } from '../finance/entities/finance.entities'
import { TenantEntity } from '../platform/entities/tenant.entity'
import { AuditService } from '../audit/audit.service'

const MAX_FAILED_ATTEMPTS = 5
const LOCK_MINUTES = 15
const PORTAL_TOKEN_TTL = '8h'

interface PortalProfile {
  portalUserId: number
  tenantId: number
  supplierId: number
  supplierName: string
  username: string
  displayName: string
  phone: string | null
  email: string | null
}

/**
 * 供应商门户独立账号服务：
 * 外部供应商人员使用独立账号登录，只能访问自身供应商的订单、对账、运单与发票；
 * 所有写操作均留门户协同动作与审计日志。
 */
@Injectable()
export class SupplierPortalService {
  constructor(
    @InjectRepository(SupplierPortalUserEntity) private readonly portalUserRepo: Repository<SupplierPortalUserEntity>,
    @InjectRepository(TenantEntity) private readonly tenantRepo: Repository<TenantEntity>,
    @InjectRepository(SupplierEntity) private readonly supplierRepo: Repository<SupplierEntity>,
    @InjectRepository(PurchaseOrderEntity) private readonly orderRepo: Repository<PurchaseOrderEntity>,
    @InjectRepository(PurchaseOrderLineEntity) private readonly orderLineRepo: Repository<PurchaseOrderLineEntity>,
    @InjectRepository(GoodsReceiptEntity) private readonly receiptRepo: Repository<GoodsReceiptEntity>,
    @InjectRepository(VendorStatementEntity) private readonly statementRepo: Repository<VendorStatementEntity>,
    @InjectRepository(LogisticsWaybillEntity) private readonly waybillRepo: Repository<LogisticsWaybillEntity>,
    @InjectRepository(FinInvoiceEntity) private readonly invoiceRepo: Repository<FinInvoiceEntity>,
    @InjectRepository(SupplierPortalActionEntity) private readonly portalActionRepo: Repository<SupplierPortalActionEntity>,
    private readonly jwtService: JwtService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly auditService: AuditService
  ) {}

  // ---------------------------------------------------------------- 门户认证

  async login(dto: PortalLoginDto, meta: { ip?: string; userAgent?: string } = {}): Promise<{
    accessToken: string
    expiresIn: string
    profile: PortalProfile
  }> {
    const tenantCode = dto.tenantCode?.trim() || 'default'
    const tenant = await this.tenantRepo.findOne({ where: { tenantCode, isDeleted: 0 } })
    if (!tenant) {
      throw new UnauthorizedException('租户不存在')
    }

    const lockKey = `portal:lock:${tenant.id}:${dto.username}`
    const lockedTtl = await this.redis.ttl(lockKey)
    if (lockedTtl > 0) {
      throw new ForbiddenException(`登录已锁定，请 ${lockedTtl} 秒后重试`)
    }

    const account = await this.portalUserRepo.findOne({
      where: { tenantId: tenant.id, username: dto.username }
    })
    if (!account || !comparePassword(dto.password, account.passwordHash)) {
      const failure = evaluatePortalLoginFailure(account?.failedLoginCount ?? 0)
      if (account && failure.shouldLock) {
        account.lockUntil = new Date(Date.now() + PORTAL_LOCK_MINUTES * 60 * 1000)
        account.failedLoginCount = 0
        await this.portalUserRepo.save(account)
      } else if (account) {
        account.failedLoginCount = (account.failedLoginCount ?? 0) + 1
        await this.portalUserRepo.save(account)
      }
      await this.registerFailure(lockKey)
      await this.auditService.record({
        bizType: 'supplier_portal_user',
        bizId: account?.id ?? 0,
        action: 'PORTAL_LOGIN_FAIL',
        afterValue: { username: dto.username, tenantCode, ip: meta.ip ?? null }
      }, this.auditUser({
        portalUserId: account?.id ?? 0,
        tenantId: tenant.id,
        supplierId: account?.supplierId ?? 0,
        username: dto.username,
        displayName: account?.displayName ?? ''
      }))
      throw new UnauthorizedException('账号或密码错误')
    }
    const stateCheck = evaluatePortalLogin(account)
    if (!stateCheck.allowed) {
      throw new ForbiddenException(stateCheck.reason)
    }

    account.failedLoginCount = 0
    account.lockUntil = null
    account.lastLoginAt = new Date()
    await this.portalUserRepo.save(account)
    await this.redis.del(lockKey)

    const accessToken = await this.jwtService.signAsync({
      sub: String(account.id),
      tenantId: account.tenantId,
      supplierId: account.supplierId,
      username: account.username,
      displayName: account.displayName,
      type: PORTAL_TOKEN_TYPE
    }, { secret: env.jwt.secret, expiresIn: PORTAL_TOKEN_TTL })

    await this.auditService.record({
      bizType: 'supplier_portal_user',
      bizId: account.id,
      action: 'PORTAL_LOGIN',
      afterValue: { username: account.username, supplierId: account.supplierId, ip: meta.ip ?? null }
    }, this.auditUser({
      portalUserId: account.id,
      tenantId: account.tenantId,
      supplierId: account.supplierId,
      username: account.username,
      displayName: account.displayName
    }))

    return {
      accessToken,
      expiresIn: PORTAL_TOKEN_TTL,
      profile: await this.buildProfile({
        portalUserId: account.id,
        tenantId: account.tenantId,
        supplierId: account.supplierId,
        username: account.username,
        displayName: account.displayName
      })
    }
  }

  async logout(portalUser: PortalUser): Promise<void> {
    await this.auditService.record({
      bizType: 'supplier_portal_user',
      bizId: portalUser.portalUserId,
      action: 'PORTAL_LOGOUT',
      afterValue: { username: portalUser.username }
    }, this.auditUser(portalUser))
  }

  /** 门户当前登录人信息 */
  async profile(portalUser: PortalUser): Promise<PortalProfile> {
    const account = await this.portalUserRepo.findOne({ where: { id: portalUser.portalUserId } })
    if (!account || account.status !== 'ACTIVE') {
      throw new UnauthorizedException('门户账号不可用')
    }
    return this.buildProfile(portalUser)
  }

  // ---------------------------------------------------------------- 门户业务

  /** 门户概览：仅统计自身供应商数据 */
  async summary(portalUser: PortalUser): Promise<Record<string, unknown>> {
    const scope = { tenantId: portalUser.tenantId, supplierId: portalUser.supplierId }
    const [orders, statements, receipts, invoices] = await Promise.all([
      this.orderRepo.find({ where: { ...scope, isDeleted: 0 } }),
      this.statementRepo.find({ where: scope }),
      this.receiptRepo.find({ where: { ...scope, isDeleted: 0 } }),
      this.invoiceRepo.find({ where: { ...scope, invoiceType: 'PURCHASE' } })
    ])
    const pendingOrders = orders.filter((item) => !item.portalConfirmedAt)
    return {
      supplierId: portalUser.supplierId,
      orderCount: orders.length,
      pendingConfirmCount: pendingOrders.length,
      orderAmount: this.money(orders.reduce((sum, item) => sum + this.num(item.totalAmount), 0)),
      statementCount: statements.length,
      unpaidAmount: this.money(statements.reduce((sum, item) => sum + this.num(item.amount) - this.num(item.settledAmount), 0)),
      receiptCount: receipts.length,
      invoiceCount: invoices.length
    }
  }

  /** 门户采购订单列表（仅本供应商） */
  async listOrders(portalUser: PortalUser, query: PortalQueryDto): Promise<PageResult<PurchaseOrderEntity>> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const where = {
      tenantId: portalUser.tenantId,
      supplierId: portalUser.supplierId,
      isDeleted: 0,
      ...(query.status ? { status: query.status } : {})
    }
    const [list, total] = await this.orderRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
    return buildPageResult(list, total, page, pageSize)
  }

  /** 门户订单明细：校验订单归属，跨供应商访问直接拒绝 */
  async orderDetail(portalUser: PortalUser, orderId: number): Promise<Record<string, unknown>> {
    const order = await this.findOwnedOrder(portalUser, orderId)
    const lines = await this.orderLineRepo.find({ where: { tenantId: portalUser.tenantId, orderId } })
    const receipts = await this.receiptRepo.find({ where: { tenantId: portalUser.tenantId, supplierId: portalUser.supplierId, orderId, isDeleted: 0 } })
    return { order, lines, receipts }
  }

  /** 门户订单确认 */
  async confirmOrder(portalUser: PortalUser, orderId: number): Promise<PurchaseOrderEntity> {
    const order = await this.findOwnedOrder(portalUser, orderId)
    const check = checkPortalOrderConfirm(order.status, !!order.portalConfirmedAt)
    if (!check.allowed) throw new BadRequestException(check.reason)
    order.portalConfirmedAt = new Date()
    order.portalConfirmedBy = portalUser.portalUserId
    const saved = await this.orderRepo.save(order)
    await this.recordPortalAction(portalUser, 'ORDER_CONFIRM', 'PURCHASE_ORDER', saved.id, { orderNo: saved.orderNo })
    await this.auditService.record({
      bizType: 'purchase_order',
      bizId: saved.id,
      action: 'PORTAL_CONFIRM_ORDER',
      afterValue: { orderNo: saved.orderNo, supplierId: portalUser.supplierId }
    }, this.auditUser(portalUser))
    return saved
  }

  /** 门户对账单列表 */
  async listStatements(portalUser: PortalUser, query: PortalQueryDto): Promise<PageResult<VendorStatementEntity>> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const where = {
      tenantId: portalUser.tenantId,
      supplierId: portalUser.supplierId,
      ...(query.status ? { status: query.status } : {})
    }
    const [list, total] = await this.statementRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
    return buildPageResult(list, total, page, pageSize)
  }

  /** 门户对账确认 */
  async confirmStatement(portalUser: PortalUser, id: number): Promise<VendorStatementEntity> {
    const statement = await this.statementRepo.findOne({
      where: { id, tenantId: portalUser.tenantId, supplierId: portalUser.supplierId }
    })
    if (!statement) throw new NotFoundException('对账单不存在或不属于当前供应商')
    const check = checkPortalStatementConfirm(statement.status, !!statement.portalConfirmedAt)
    if (!check.allowed) throw new BadRequestException(check.reason)
    statement.portalConfirmedAt = new Date()
    const saved = await this.statementRepo.save(statement)
    await this.recordPortalAction(portalUser, 'STATEMENT_CONFIRM', 'VENDOR_STATEMENT', saved.id, { statementNo: saved.statementNo })
    await this.auditService.record({
      bizType: 'vendor_statement',
      bizId: saved.id,
      action: 'PORTAL_CONFIRM_STATEMENT',
      afterValue: { statementNo: saved.statementNo, supplierId: portalUser.supplierId }
    }, this.auditUser(portalUser))
    return saved
  }

  /** 门户发货通知：运单归属当前供应商，运单号唯一 */
  async createShipment(portalUser: PortalUser, dto: PortalShipmentInputDto): Promise<LogisticsWaybillEntity> {
    const duplicated = await this.waybillRepo.findOne({
      where: { tenantId: portalUser.tenantId, waybillNo: dto.waybillNo }
    })
    const duplicateCheck = checkPortalDuplicate('WAYBILL', !!duplicated)
    if (!duplicateCheck.allowed) throw new BadRequestException(duplicateCheck.reason)
    if (dto.sourceType === 'PURCHASE' && dto.sourceId) {
      await this.findOwnedOrder(portalUser, dto.sourceId)
    }
    const waybill = this.waybillRepo.create({
      tenantId: portalUser.tenantId,
      waybillNo: dto.waybillNo,
      carrierId: dto.carrierId,
      supplierId: portalUser.supplierId,
      sourceType: dto.sourceType ?? 'PURCHASE',
      sourceId: dto.sourceId ?? null,
      status: 'IN_TRANSIT',
      freightAmount: dto.freightAmount ?? '0'
    })
    const saved = await this.waybillRepo.save(waybill)
    await this.recordPortalAction(portalUser, 'SHIPMENT_NOTICE', 'LOGISTICS_WAYBILL', saved.id, { waybillNo: saved.waybillNo })
    await this.auditService.record({
      bizType: 'logistics_waybill',
      bizId: saved.id,
      action: 'PORTAL_SHIPMENT',
      afterValue: { waybillNo: saved.waybillNo, supplierId: portalUser.supplierId }
    }, this.auditUser(portalUser))
    return saved
  }

  /** 门户运单列表（仅本供应商） */
  async listShipments(portalUser: PortalUser, query: PortalQueryDto): Promise<PageResult<LogisticsWaybillEntity>> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const where = {
      tenantId: portalUser.tenantId,
      supplierId: portalUser.supplierId,
      isDeleted: 0,
      ...(query.status ? { status: query.status } : {})
    }
    const [list, total] = await this.waybillRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
    return buildPageResult(list, total, page, pageSize)
  }

  /** 门户发票上传：发票号唯一并归属当前供应商 */
  async createInvoice(portalUser: PortalUser, dto: PortalInvoiceInputDto): Promise<FinInvoiceEntity> {
    const duplicated = await this.invoiceRepo.findOne({
      where: { tenantId: portalUser.tenantId, invoiceNo: dto.invoiceNo }
    })
    const duplicateCheck = checkPortalDuplicate('INVOICE', !!duplicated)
    if (!duplicateCheck.allowed) throw new BadRequestException(duplicateCheck.reason)
    if (dto.receiptId) {
      const receipt = await this.receiptRepo.findOne({
        where: { id: dto.receiptId, tenantId: portalUser.tenantId, supplierId: portalUser.supplierId, isDeleted: 0 }
      })
      if (!receipt) throw new NotFoundException('收货单不存在或不属于当前供应商')
    }
    const invoice = this.invoiceRepo.create({
      tenantId: portalUser.tenantId,
      invoiceNo: dto.invoiceNo,
      invoiceType: 'PURCHASE',
      supplierId: portalUser.supplierId,
      amount: dto.amount,
      taxAmount: dto.taxAmount ?? '0',
      status: 'PENDING',
      bizType: dto.receiptId ? 'PURCHASE_RECEIPT' : 'PURCHASE',
      bizId: dto.receiptId ?? null
    })
    const saved = await this.invoiceRepo.save(invoice)
    await this.recordPortalAction(portalUser, 'INVOICE_UPLOAD', 'FIN_INVOICE', saved.id, { invoiceNo: saved.invoiceNo, amount: saved.amount })
    await this.auditService.record({
      bizType: 'fin_invoice',
      bizId: saved.id,
      action: 'PORTAL_UPLOAD_INVOICE',
      afterValue: { invoiceNo: saved.invoiceNo, amount: saved.amount, supplierId: portalUser.supplierId }
    }, this.auditUser(portalUser))
    return saved
  }

  /** 门户发票列表（仅本供应商上传的） */
  async listInvoices(portalUser: PortalUser, query: PortalQueryDto): Promise<PageResult<FinInvoiceEntity>> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const where = {
      tenantId: portalUser.tenantId,
      supplierId: portalUser.supplierId,
      invoiceType: 'PURCHASE',
      ...(query.status ? { status: query.status } : {})
    }
    const [list, total] = await this.invoiceRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
    return buildPageResult(list, total, page, pageSize)
  }

  // ---------------------------------------------------------------- 账号管理（内部）

  /** 门户账号列表 */
  async listAccounts(query: PortalAccountQueryDto, user: JwtUser): Promise<PageResult<SupplierPortalUserEntity>> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const where = {
      tenantId: user.tenantId,
      ...(query.supplierId ? { supplierId: query.supplierId } : {})
    }
    const [list, total] = await this.portalUserRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
    return buildPageResult(
      list.map((item) => ({ ...item, passwordHash: '' })),
      total,
      page,
      pageSize
    )
  }

  /** 创建门户账号：账号在租户内唯一，密码需满足强度策略 */
  async createAccount(dto: CreatePortalAccountDto, user: JwtUser): Promise<SupplierPortalUserEntity> {
    const supplier = await this.supplierRepo.findOne({
      where: { id: dto.supplierId, tenantId: user.tenantId, isDeleted: 0 }
    })
    if (!supplier) throw new NotFoundException('供应商不存在')
    const existed = await this.portalUserRepo.findOne({
      where: { tenantId: user.tenantId, username: dto.username }
    })
    if (existed) throw new BadRequestException('该登录账号已存在')
    const errors = validatePasswordPolicy(dto.password)
    if (errors.length > 0) throw new BadRequestException(errors.join('；'))

    const account = this.portalUserRepo.create({
      tenantId: user.tenantId,
      supplierId: dto.supplierId,
      username: dto.username,
      passwordHash: hashPassword(dto.password),
      displayName: dto.displayName ?? '',
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      status: 'ACTIVE',
      failedLoginCount: 0,
      passwordUpdatedAt: new Date(),
      createdBy: user.userId
    })
    const saved = await this.portalUserRepo.save(account)
    await this.auditService.record({
      bizType: 'supplier_portal_user',
      bizId: saved.id,
      action: 'PORTAL_ACCOUNT_CREATE',
      afterValue: { username: saved.username, supplierId: saved.supplierId }
    }, user)
    return { ...saved, passwordHash: '' }
  }

  /** 门户账号启停：停用后令牌立即失效 */
  async updateAccountStatus(id: number, dto: UpdatePortalAccountDto, user: JwtUser): Promise<SupplierPortalUserEntity> {
    const account = await this.findAccount(user, id)
    const statusCheck = evaluatePortalAccountStatus(dto.status)
    if (!statusCheck.allowed) throw new BadRequestException(statusCheck.reason)
    const before = { status: account.status }
    account.status = dto.status
    account.updatedAt = new Date()
    const saved = await this.portalUserRepo.save(account)
    await this.auditService.record({
      bizType: 'supplier_portal_user',
      bizId: saved.id,
      action: 'PORTAL_ACCOUNT_STATUS',
      beforeValue: before,
      afterValue: { status: saved.status }
    }, user)
    return { ...saved, passwordHash: '' }
  }

  /** 重置门户账号密码 */
  async resetPassword(id: number, dto: ResetPortalPasswordDto, user: JwtUser): Promise<{ reset: boolean }> {
    const account = await this.findAccount(user, id)
    const errors = validatePasswordPolicy(dto.password)
    if (errors.length > 0) throw new BadRequestException(errors.join('；'))
    account.passwordHash = hashPassword(dto.password)
    account.passwordUpdatedAt = new Date()
    account.failedLoginCount = 0
    account.lockUntil = null
    account.updatedAt = new Date()
    await this.portalUserRepo.save(account)
    await this.auditService.record({
      bizType: 'supplier_portal_user',
      bizId: account.id,
      action: 'PORTAL_ACCOUNT_RESET_PASSWORD',
      afterValue: { username: account.username }
    }, user)
    return { reset: true }
  }

  /** 门户账号操作日志 */
  async listPortalActions(portalUser: PortalUser, page = 1, pageSize = 20): Promise<PageResult<SupplierPortalActionEntity>> {
    const [list, total] = await this.portalActionRepo.findAndCount({
      where: { tenantId: portalUser.tenantId, supplierId: portalUser.supplierId },
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
    return buildPageResult(list, total, page, pageSize)
  }

  // ---------------------------------------------------------------- 私有方法

  private async findAccount(user: JwtUser, id: number): Promise<SupplierPortalUserEntity> {
    const account = await this.portalUserRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!account) throw new NotFoundException('门户账号不存在')
    return account
  }

  private async findOwnedOrder(portalUser: PortalUser, orderId: number): Promise<PurchaseOrderEntity> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, tenantId: portalUser.tenantId, isDeleted: 0 }
    })
    const ownership = evaluateSupplierOwnership(order?.supplierId ?? null, portalUser.supplierId)
    if (!order || !ownership.allowed) throw new NotFoundException(ownership.reason || '采购订单不存在')
    return order
  }

  private async buildProfile(portalUser: PortalUser): Promise<PortalProfile> {
    const account = await this.portalUserRepo.findOne({ where: { id: portalUser.portalUserId } })
    const supplier = await this.supplierRepo.findOne({
      where: { id: portalUser.supplierId, tenantId: portalUser.tenantId, isDeleted: 0 }
    })
    return {
      portalUserId: portalUser.portalUserId,
      tenantId: portalUser.tenantId,
      supplierId: portalUser.supplierId,
      supplierName: supplier?.supplierName ?? '',
      username: portalUser.username,
      displayName: account?.displayName || portalUser.displayName || portalUser.username,
      phone: account?.phone ?? null,
      email: account?.email ?? null
    }
  }

  private async recordPortalAction(
    portalUser: PortalUser,
    actionType: string,
    bizType: string,
    bizId: number | null,
    content: unknown
  ): Promise<void> {
    await this.portalActionRepo.save(this.portalActionRepo.create({
      tenantId: portalUser.tenantId,
      supplierId: portalUser.supplierId,
      actionType,
      bizType,
      bizId,
      content,
      status: 'RECEIVED',
      createdBy: portalUser.portalUserId
    }))
  }

  /** 门户用户转换为审计身份：操作人记录为门户账号，权限域与员工隔离 */
  private auditUser(portalUser: PortalUser): JwtUser {
    return {
      userId: portalUser.portalUserId,
      tenantId: portalUser.tenantId,
      username: `portal:${portalUser.username}`,
      realName: portalUser.displayName || portalUser.username,
      orgId: null,
      roles: ['SUPPLIER_PORTAL'],
      permissions: [],
      isSuperAdmin: false,
      dataScopeLevel: 'SELF'
    }
  }

  private async registerFailure(lockKey: string): Promise<void> {
    try {
      const attempts = await this.redis.incr(`portal:fail:${lockKey}`)
      if (attempts === 1) {
        await this.redis.expire(`portal:fail:${lockKey}`, 300)
      }
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        await this.redis.set(lockKey, '1', 'EX', LOCK_MINUTES * 60)
        await this.redis.del(`portal:fail:${lockKey}`)
      }
    } catch {
      // Redis 异常时不阻断登录主流程
    }
  }

  private num(value: string | null | undefined): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  private money(value: number): string {
    return value.toFixed(4)
  }
}
