import { randomBytes } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Between, In, Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { scopeWhere } from '../../common/data-scope-context'
import {
  buildStatementAiSuggestion,
  buildStatementDiff,
  computeShiftClose,
  matchPromotionBundles,
  selectPromotionBundles,
  type BundleRule,
  type StatementSuggestion
} from '../../common/sales-delivery-engine'
import { AuditService } from '../audit/audit.service'
import { ProductEntity } from '../master-data/entities/product.entity'
import {
  CloseShiftDto,
  CreatePromotionBundleDto,
  OpenShiftDto,
  PreviewBundleDto,
  QuerySalesDto,
  StatementAnalysisDto,
  UpdatePromotionBundleDto
} from './dto'
import {
  CustomerStatementEntity,
  PosPaymentRecordEntity,
  SaleOrderEntity
} from './entities/sales.entities'
import {
  PosShiftEntity,
  SalePromotionBundleEntity,
  SalePromotionBundleItemEntity
} from './entities/sales-delivery.entities'

/**
 * 销售柜面扩展服务：
 * - POS 交接班（开班 / 交班 / 现金差异 / 大额差异主管审批）
 * - 组合促销（套装 / 满减）配置、试算与开单自动应用
 * - 客户对账差异标记与 AI 对账建议（依据 + 置信度）
 */
@Injectable()
export class SalesCounterService {
  constructor(
    @InjectRepository(SaleOrderEntity) private readonly orderRepo: Repository<SaleOrderEntity>,
    @InjectRepository(PosPaymentRecordEntity) private readonly paymentRepo: Repository<PosPaymentRecordEntity>,
    @InjectRepository(CustomerStatementEntity) private readonly statementRepo: Repository<CustomerStatementEntity>,
    @InjectRepository(PosShiftEntity) private readonly shiftRepo: Repository<PosShiftEntity>,
    @InjectRepository(SalePromotionBundleEntity) private readonly bundleRepo: Repository<SalePromotionBundleEntity>,
    @InjectRepository(SalePromotionBundleItemEntity) private readonly bundleItemRepo: Repository<SalePromotionBundleItemEntity>,
    @InjectRepository(ProductEntity) private readonly productRepo: Repository<ProductEntity>,
    private readonly auditService: AuditService
  ) {}

  /* ------------------------------ POS 交接班 ------------------------------ */

  /** 班次列表 */
  async listShifts(query: QuerySalesDto, user: JwtUser): Promise<PageResult<PosShiftEntity>> {
    const where = scopeWhere<PosShiftEntity>({
      tenantId: user.tenantId,
      ...(query.status ? { status: query.status } : {})
    }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.shiftRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 当前未交班班次 */
  async currentShift(user: JwtUser): Promise<PosShiftEntity | null> {
    return this.shiftRepo.findOne({ where: { tenantId: user.tenantId, status: 'OPEN' }, order: { id: 'DESC' } })
  }

  /** 开班：登记备用金，同一用户仅允许一个开班班次 */
  async openShift(dto: OpenShiftDto, user: JwtUser): Promise<PosShiftEntity> {
    const opened = await this.shiftRepo.findOne({ where: { tenantId: user.tenantId, status: 'OPEN', cashierUserId: user.userId } })
    if (opened) throw new BadRequestException(`存在未交班的班次 ${opened.shiftNo}，请先交班`)
    const shift = await this.shiftRepo.save(this.shiftRepo.create({
      tenantId: user.tenantId,
      shiftNo: this.number('SHIFT'),
      storeName: dto.storeName ?? '',
      cashierUserId: user.userId,
      openAt: new Date(),
      openingCash: this.money(this.num(dto.openingCash)),
      status: 'OPEN',
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'pos_shift', bizId: shift.id, action: 'OPEN_SHIFT', afterValue: shift }, user)
    return shift
  }

  /** 交班：按本班 POS 收款汇总计算应存现金，与实盘比对得出差异 */
  async closeShift(id: number, dto: CloseShiftDto, user: JwtUser): Promise<PosShiftEntity> {
    const shift = await this.shiftRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!shift) throw new NotFoundException('班次不存在')
    if (shift.status !== 'OPEN') throw new BadRequestException('该班次已交班')
    const summary = await this.collectShiftSummary(shift, user)
    const result = computeShiftClose({
      openingCash: this.num(shift.openingCash),
      cashReceived: summary.cashReceived,
      otherIncome: this.num(dto.otherIncome ?? '0'),
      actualCash: this.num(dto.actualCash),
      orderCount: summary.orderCount,
      orderAmount: summary.orderAmount
    })
    if (result.level !== 'OK' && !dto.remark?.trim()) {
      throw new BadRequestException('现金存在差异，交班必须填写差异说明')
    }
    shift.cashReceived = this.money(summary.cashReceived)
    shift.otherIncome = this.money(this.num(dto.otherIncome ?? '0'))
    shift.expectedCash = this.money(result.expectedCash)
    shift.actualCash = this.money(this.num(dto.actualCash))
    shift.differenceAmount = this.money(result.difference)
    shift.level = result.level
    shift.orderCount = summary.orderCount
    shift.orderAmount = this.money(summary.orderAmount)
    shift.paymentSummary = summary.paymentSummary
    shift.closeAt = new Date()
    shift.remark = dto.remark ?? shift.remark
    shift.status = result.requireApproval ? 'PENDING_APPROVAL' : 'CLOSED'
    const saved = await this.shiftRepo.save(shift)
    await this.auditService.record({
      bizType: 'pos_shift',
      bizId: saved.id,
      action: 'CLOSE_SHIFT',
      afterValue: { ...result, paymentSummary: summary.paymentSummary }
    }, user)
    return saved
  }

  /** 大额差异班次的主管审批 */
  async approveShift(id: number, remark: string, user: JwtUser): Promise<PosShiftEntity> {
    const shift = await this.shiftRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!shift) throw new NotFoundException('班次不存在')
    if (shift.status !== 'PENDING_APPROVAL') throw new BadRequestException('该班次无需审批')
    if (!remark?.trim()) throw new BadRequestException('审批必须填写说明')
    shift.status = 'CLOSED'
    shift.remark = `${shift.remark ?? ''} | 审批：${remark}`.trim()
    const saved = await this.shiftRepo.save(shift)
    await this.auditService.record({ bizType: 'pos_shift', bizId: saved.id, action: 'APPROVE_SHIFT', afterValue: saved }, user)
    return saved
  }

  /* ------------------------------ 组合促销 ------------------------------ */

  /** 组合促销列表（含套装成分） */
  async listBundles(query: QuerySalesDto, user: JwtUser): Promise<PageResult<SalePromotionBundleEntity>> {
    const where = scopeWhere<SalePromotionBundleEntity>({
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.status ? { status: query.status } : {})
    }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.bundleRepo.findAndCount({ where, order: { priority: 'DESC', id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    const items = list.length > 0
      ? await this.bundleItemRepo.find({ where: { tenantId: user.tenantId, bundleId: In(list.map((bundle) => bundle.id)) } })
      : []
    const grouped = new Map<number, SalePromotionBundleItemEntity[]>()
    for (const item of items) {
      const bucket = grouped.get(item.bundleId) ?? []
      bucket.push(item)
      grouped.set(item.bundleId, bucket)
    }
    const data = list.map((bundle) => ({ ...bundle, items: grouped.get(bundle.id) ?? [] }))
    return { list: data as unknown as SalePromotionBundleEntity[], total, page: query.page, pageSize: query.pageSize }
  }

  /** 新建组合促销：套装需成分与套装价，满减需门槛与优惠额 */
  async createBundle(dto: CreatePromotionBundleDto, user: JwtUser): Promise<SalePromotionBundleEntity> {
    const exists = await this.bundleRepo.findOne({ where: { tenantId: user.tenantId, promotionCode: dto.promotionCode, isDeleted: 0 } })
    if (exists) throw new BadRequestException(`促销编码已存在：${dto.promotionCode}`)
    this.validateBundle(dto.bundleType, dto.items?.length ?? 0, dto.thresholdAmount, dto.discountAmount, dto.comboPrice)
    const bundle = await this.bundleRepo.save(this.bundleRepo.create({
      tenantId: user.tenantId,
      promotionCode: dto.promotionCode,
      promotionName: dto.promotionName,
      bundleType: dto.bundleType,
      thresholdAmount: dto.thresholdAmount ?? null,
      discountAmount: dto.discountAmount ?? null,
      comboPrice: dto.comboPrice ?? null,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
      status: 'ENABLED',
      priority: dto.priority ?? 0,
      remark: dto.remark ?? null,
      createdBy: user.userId
    }))
    await this.saveBundleItems(bundle.id, dto.items ?? [], user)
    await this.auditService.record({ bizType: 'sale_promotion_bundle', bizId: bundle.id, action: 'CREATE_BUNDLE', afterValue: bundle }, user)
    return bundle
  }

  /** 更新组合促销 */
  async updateBundle(id: number, dto: UpdatePromotionBundleDto, user: JwtUser): Promise<SalePromotionBundleEntity> {
    const bundle = await this.bundleRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!bundle) throw new NotFoundException('组合促销不存在')
    const items = dto.items ?? (await this.bundleItemRepo.find({ where: { tenantId: user.tenantId, bundleId: id } })).map((item) => ({
      productId: item.productId,
      qty: item.qty
    }))
    this.validateBundle(bundle.bundleType, items.length, dto.thresholdAmount ?? bundle.thresholdAmount, dto.discountAmount ?? bundle.discountAmount, dto.comboPrice ?? bundle.comboPrice)
    const before = { ...bundle }
    if (dto.promotionName !== undefined) bundle.promotionName = dto.promotionName
    if (dto.status !== undefined) bundle.status = dto.status
    if (dto.thresholdAmount !== undefined) bundle.thresholdAmount = dto.thresholdAmount
    if (dto.discountAmount !== undefined) bundle.discountAmount = dto.discountAmount
    if (dto.comboPrice !== undefined) bundle.comboPrice = dto.comboPrice
    if (dto.startDate !== undefined) bundle.startDate = dto.startDate
    if (dto.endDate !== undefined) bundle.endDate = dto.endDate
    if (dto.priority !== undefined) bundle.priority = dto.priority
    if (dto.remark !== undefined) bundle.remark = dto.remark
    const saved = await this.bundleRepo.save(bundle)
    if (dto.items !== undefined) {
      await this.bundleItemRepo.delete({ tenantId: user.tenantId, bundleId: id })
      await this.saveBundleItems(id, dto.items, user)
    }
    await this.auditService.record({ bizType: 'sale_promotion_bundle', bizId: id, action: 'UPDATE_BUNDLE', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  /** 组合促销试算：按当前订单行匹配可用促销并给出最优组合 */
  async previewBundle(dto: PreviewBundleDto, user: JwtUser): Promise<{
    candidates: Array<Record<string, unknown>>
    applied: Array<Record<string, unknown>>
    totalDiscount: number
    orderAmount: number
  }> {
    const lines: Array<{ productId: number; qty: number; unitPrice: number }> = []
    for (const line of dto.lines) {
      const product = await this.productRepo.findOne({ where: { id: line.productId, tenantId: user.tenantId, isDeleted: 0 } })
      if (!product) throw new NotFoundException(`商品不存在：${line.productId}`)
      lines.push({ productId: line.productId, qty: this.num(line.qty), unitPrice: this.num(product.price) })
    }
    const rules = await this.loadBundleRules(user)
    const at = dto.at ?? this.today()
    const selected = selectPromotionBundles(lines, rules, at)
    const orderAmount = Math.round(lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0) * 10000) / 10000
    return {
      candidates: matchPromotionBundles(lines, rules, at) as unknown as Array<Record<string, unknown>>,
      applied: selected.applied as unknown as Array<Record<string, unknown>>,
      totalDiscount: selected.totalDiscount,
      orderAmount
    }
  }

  /** 开单时组合促销自动应用：返回命中的促销与优惠金额 */
  async resolveOrderPromotion(
    lines: Array<{ productId: number; qty: number; unitPrice: number }>,
    user: JwtUser
  ): Promise<{ promotionCode: string | null; promotionDiscount: number; detail: Record<string, unknown> | null }> {
    if (lines.length === 0) return { promotionCode: null, promotionDiscount: 0, detail: null }
    const rules = await this.loadBundleRules(user)
    const selected = selectPromotionBundles(lines, rules, this.today())
    if (selected.applied.length === 0) return { promotionCode: null, promotionDiscount: 0, detail: null }
    const primary = selected.applied[0]
    return {
      promotionCode: primary.code,
      promotionDiscount: selected.totalDiscount,
      detail: {
        bundles: selected.applied.map((item) => ({
          code: item.code,
          name: item.name,
          type: item.type,
          discountAmount: item.discountAmount,
          reason: item.reason,
          matchedLines: item.matchedLines
        })),
        totalDiscount: selected.totalDiscount
      }
    }
  }

  /* ------------------------------ 对账差异与 AI 建议 ------------------------------ */

  /** 对账单差异分析与 AI 对账建议（建议含依据与置信度，低置信需人工确认） */
  async analyzeStatement(dto: StatementAnalysisDto, user: JwtUser): Promise<{
    statement: CustomerStatementEntity
    diff: Record<string, unknown>
    suggestions: StatementSuggestion[]
  }> {
    const statement = await this.statementRepo.findOne({ where: { id: dto.statementId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!statement) throw new NotFoundException('对账单不存在')
    const orders = await this.orderRepo.find({
      where: { tenantId: user.tenantId, customerId: statement.customerId, isDeleted: 0 },
      order: { id: 'DESC' }
    })
    const inPeriod = orders.filter((order) => this.inPeriod(order.orderDate, statement.period))
    const orderAmount = Math.round(inPeriod.reduce((sum, order) => sum + this.num(order.totalAmount), 0) * 10000) / 10000
    const input = {
      statementAmount: this.num(statement.amount),
      orderAmount,
      settledAmount: this.num(statement.settledAmount),
      reversedAmount: this.num(statement.reversedAmount),
      itemCount: inPeriod.length
    }
    const diff = buildStatementDiff(input)
    const suggestions = buildStatementAiSuggestion(diff, input)
    statement.diffFlag = diff.flag
    statement.diffDetail = { ...diff, orderAmount, itemCount: input.itemCount } as unknown as Record<string, unknown>
    if (dto.withSuggestion !== false) {
      statement.aiSuggestion = suggestions as unknown as Array<Record<string, unknown>>
    }
    await this.statementRepo.save(statement)
    await this.auditService.record({ bizType: 'customer_statement', bizId: statement.id, action: 'ANALYZE_STATEMENT', afterValue: { diff, suggestions } }, user)
    return { statement, diff: diff as unknown as Record<string, unknown>, suggestions }
  }

  /* ------------------------------ 内部方法 ------------------------------ */

  /** 汇总本班 POS 订单与收款 */
  private async collectShiftSummary(shift: PosShiftEntity, user: JwtUser): Promise<{
    orderCount: number
    orderAmount: number
    cashReceived: number
    paymentSummary: Array<{ payType: string; amount: number; count: number }>
  }> {
    const orders = await this.orderRepo.find({
      where: {
        tenantId: user.tenantId,
        sourceType: 'POS',
        createdAt: Between(shift.openAt, new Date())
      }
    })
    const orderIds = orders.map((order) => order.id)
    const payments = orderIds.length > 0
      ? await this.paymentRepo.find({ where: { tenantId: user.tenantId, orderId: In(orderIds), status: 'SUCCESS' } })
      : []
    const summaryMap = new Map<string, { payType: string; amount: number; count: number }>()
    let cashReceived = 0
    for (const payment of payments) {
      const amount = this.num(payment.amount)
      const bucket = summaryMap.get(payment.payType) ?? { payType: payment.payType, amount: 0, count: 0 }
      bucket.amount = Math.round((bucket.amount + amount) * 10000) / 10000
      bucket.count += 1
      summaryMap.set(payment.payType, bucket)
      if (payment.payType === 'CASH') cashReceived = Math.round((cashReceived + amount) * 10000) / 10000
    }
    return {
      orderCount: orders.length,
      orderAmount: Math.round(orders.reduce((sum, order) => sum + this.num(order.totalAmount), 0) * 10000) / 10000,
      cashReceived,
      paymentSummary: [...summaryMap.values()]
    }
  }

  /** 加载当前租户启用中的组合促销规则 */
  private async loadBundleRules(user: JwtUser): Promise<BundleRule[]> {
    const bundles = await this.bundleRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0, status: 'ENABLED' } })
    if (bundles.length === 0) return []
    const items = await this.bundleItemRepo.find({ where: { tenantId: user.tenantId, bundleId: In(bundles.map((bundle) => bundle.id)) } })
    const grouped = new Map<number, Array<{ productId: number; qty: number }>>()
    for (const item of items) {
      const bucket = grouped.get(item.bundleId) ?? []
      bucket.push({ productId: item.productId, qty: this.num(item.qty) })
      grouped.set(item.bundleId, bucket)
    }
    return bundles.map((bundle) => ({
      id: bundle.id,
      code: bundle.promotionCode,
      name: bundle.promotionName,
      type: bundle.bundleType === 'FULL_REDUCTION' ? 'FULL_REDUCTION' : 'COMBO',
      items: grouped.get(bundle.id) ?? [],
      thresholdAmount: bundle.thresholdAmount === null ? null : this.num(bundle.thresholdAmount),
      discountAmount: bundle.discountAmount === null ? null : this.num(bundle.discountAmount),
      comboPrice: bundle.comboPrice === null ? null : this.num(bundle.comboPrice),
      priority: bundle.priority,
      startDate: bundle.startDate,
      endDate: bundle.endDate,
      status: bundle.status
    }))
  }

  /** 组合促销规则合法性校验 */
  private validateBundle(type: string, itemCount: number, threshold?: string | null, discount?: string | null, comboPrice?: string | null): void {
    if (type === 'COMBO') {
      if (itemCount <= 0) throw new BadRequestException('套装促销需至少配置一个成分商品')
      if (!comboPrice || this.num(comboPrice) <= 0) throw new BadRequestException('套装促销必须配置套装价')
    } else if (type === 'FULL_REDUCTION') {
      if (!threshold || this.num(threshold) <= 0) throw new BadRequestException('满减促销必须配置门槛金额')
      if (!discount || this.num(discount) <= 0) throw new BadRequestException('满减促销必须配置优惠金额')
      if (this.num(discount) > this.num(threshold)) throw new BadRequestException('满减优惠金额不可超过门槛金额')
    } else {
      throw new BadRequestException(`不支持的促销类型：${type}`)
    }
  }

  /** 保存套装成分明细 */
  private async saveBundleItems(bundleId: number, items: Array<{ productId: number; qty: string }>, user: JwtUser): Promise<void> {
    for (const item of items) {
      const product = await this.productRepo.findOne({ where: { id: item.productId, tenantId: user.tenantId, isDeleted: 0 } })
      if (!product) throw new NotFoundException(`商品不存在：${item.productId}`)
      await this.bundleItemRepo.save(this.bundleItemRepo.create({
        tenantId: user.tenantId,
        bundleId,
        productId: item.productId,
        qty: this.money(this.num(item.qty))
      }))
    }
  }

  /** 期间匹配：支持 2026-01 与 2026-01-01 两种写法 */
  private inPeriod(orderDate: string, period: string): boolean {
    if (!orderDate || !period) return false
    const month = period.slice(0, 7)
    return orderDate.slice(0, 7) === month
  }

  private num(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  private money(value: number): string {
    return value.toFixed(4)
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10)
  }

  private number(prefix: string): string {
    const suffix = `${Date.now().toString(36)}${randomBytes(2).toString('hex')}`.toUpperCase()
    return `${prefix}${suffix}`
  }
}
