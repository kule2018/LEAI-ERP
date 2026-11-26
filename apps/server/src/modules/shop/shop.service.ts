import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { sealSensitiveFields } from '../../common/utils/sensitive.util'
import {
  allocateActivityStock as allocateStock, applyCouponToLines, availableActivityStock,
  confirmActivityStock as confirmStock, releaseActivityStock as releaseStock,
  resolveSeckillPrice, validateCoupon
} from '../../common/shop-promotion-engine'
import {
  allocateRefundAmount, canTransitionRefund, checkRefundEligibility, compareAmounts
} from '../../common/shop-reconcile-engine'
import {
  detectCarrier, detectLogisticsException, scoreCsQuality, sortTrackingEvents
} from '../../common/shop-service-engine'
import { buildActivityCalendar, generateWaybillNo, quickReply } from '../../common/business-extension-engine'
import { AuditService } from '../audit/audit.service'
import { SchedulerService } from '../ops/scheduler.service'
import { InventoryService } from '../inventory/inventory.service'
import { CustomerEntity } from '../master-data/entities/customer.entity'
import { SalesService } from '../sales/sales.service'
import {
  ApproveRefundDto, CreateCouponDto, CreateCsConversationDto, CreateGoodsMapDto, CreatePaymentConfigDto,
  CreatePromotionDto, CreateRefundDto, CreateSeckillDto, CreateShopOrderDto, CreateStoreDto,
  CreateCsQcDto, GenerateWaybillDto, ImportReconcileDto, PushTrackingDto, QueryShopDto,
  QuickReplyDto, ReconcileDto, RejectRefundDto, ReplyCsDto, ReserveActivityStockDto,
  ResolveReconcileDto, SetActivityStockDto, ValidateCouponDto, ShipShopOrderDto
} from './dto'
import {
  CsConversationStatus, ShopActivityOrderEntity, ShopActivityStockEntity, ShopCouponEntity,
  ShopCsConversationEntity, ShopGoodsMapEntity, ShopOrderEntity, ShopPaymentConfigEntity,
  ShopCsQualityReviewEntity, ShopPromotionEntity, ShopReconcileBillEntity, ShopRefundEntity,
  ShopSeckillEntity, ShopStoreEntity, ShopSyncLogEntity, ShopTrackingEventEntity, ShopWaybillEntity
} from './entities/shop.entities'

interface ShopOrderPayloadLine {
  productId: number
  variantId?: number
  qty: string
  unitPrice: string
  activityId?: number
}

interface PromotionPreparation {
  lines: CreateShopOrderDto['lines']
  discount: number
  coupon: ShopCouponEntity | null
  reservations: ShopActivityOrderEntity[]
}

@Injectable()
export class ShopService implements OnModuleInit {
  constructor(
    @InjectRepository(ShopStoreEntity) private readonly storeRepo: Repository<ShopStoreEntity>,
    @InjectRepository(ShopGoodsMapEntity) private readonly mapRepo: Repository<ShopGoodsMapEntity>,
    @InjectRepository(ShopOrderEntity) private readonly orderRepo: Repository<ShopOrderEntity>,
    @InjectRepository(ShopSyncLogEntity) private readonly logRepo: Repository<ShopSyncLogEntity>,
    @InjectRepository(ShopPromotionEntity) private readonly promotionRepo: Repository<ShopPromotionEntity>,
    @InjectRepository(ShopPaymentConfigEntity) private readonly paymentRepo: Repository<ShopPaymentConfigEntity>,
    @InjectRepository(ShopWaybillEntity) private readonly waybillRepo: Repository<ShopWaybillEntity>,
    @InjectRepository(ShopCsConversationEntity) private readonly csRepo: Repository<ShopCsConversationEntity>,
    @InjectRepository(ShopCouponEntity) private readonly couponRepo: Repository<ShopCouponEntity>,
    @InjectRepository(ShopSeckillEntity) private readonly seckillRepo: Repository<ShopSeckillEntity>,
    @InjectRepository(ShopActivityStockEntity) private readonly activityStockRepo: Repository<ShopActivityStockEntity>,
    @InjectRepository(ShopActivityOrderEntity) private readonly activityOrderRepo: Repository<ShopActivityOrderEntity>,
    @InjectRepository(ShopReconcileBillEntity) private readonly reconcileRepo: Repository<ShopReconcileBillEntity>,
    @InjectRepository(ShopRefundEntity) private readonly refundRepo: Repository<ShopRefundEntity>,
    @InjectRepository(ShopTrackingEventEntity) private readonly trackingRepo: Repository<ShopTrackingEventEntity>,
    @InjectRepository(ShopCsQualityReviewEntity) private readonly csQcRepo: Repository<ShopCsQualityReviewEntity>,
    @InjectRepository(CustomerEntity) private readonly customerRepo: Repository<CustomerEntity>,
    private readonly salesService: SalesService,
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
    private readonly scheduler: SchedulerService
  ) {}

  onModuleInit(): void {
    this.scheduler.register({
      code: 'shop.order.retry',
      name: '商城订单同步失败重试',
      intervalMinutes: 15,
      enabled: true,
      handler: () => this.retryFailedOrdersBatch()
    })
  }

  async listStores(query: QueryShopDto, user: JwtUser): Promise<PageResult<ShopStoreEntity>> {
    const where = { tenantId: user.tenantId, isDeleted: 0, ...(query.status ? { status: query.status } : {}) }
    const [list, total] = await this.storeRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createStore(dto: CreateStoreDto, user: JwtUser): Promise<ShopStoreEntity> {
    const existing = await this.storeRepo.findOne({ where: { tenantId: user.tenantId, storeCode: dto.storeCode, isDeleted: 0 } })
    if (existing) throw new BadRequestException('店铺编码已存在')
    const sealed = sealSensitiveFields({ secret: dto.secret }, ['secret'])
    const secretMask = sealed.masked.secretMask ?? null
    const authConfig: Record<string, unknown> = { platform: dto.platform, strategy: dto.syncStrategy ?? 'MANUAL' }
    if (sealed.encrypted.secretEncrypted) authConfig.secretEncrypted = sealed.encrypted.secretEncrypted
    const entity = this.storeRepo.create({
      ...dto,
      tenantId: user.tenantId,
      authConfig,
      secretMask,
      syncStrategy: dto.syncStrategy ?? 'MANUAL',
      healthStatus: 'UNKNOWN'
    })
    const saved = await this.storeRepo.save(entity)
    await this.auditService.record({ bizType: 'shop_store', bizId: saved.id, action: 'CREATE_STORE', afterValue: { id: saved.id, storeCode: saved.storeCode } }, user)
    return saved
  }

  async checkStore(id: number, user: JwtUser): Promise<ShopStoreEntity> {
    const store = await this.findStore(id, user)
    store.healthStatus = store.status === 'ACTIVE' ? 'HEALTHY' : 'WARNING'
    const saved = await this.storeRepo.save(store)
    await this.log(user, store.id, 'STORE_HEALTH', 0, null, 'SUCCESS')
    return saved
  }

  /** 授权到期预警：30 天内到期或已过期的店铺 */
  async authExpiryAlerts(user: JwtUser, days = 30): Promise<Array<{ storeId: number; storeName: string; expireAt: string; expired: boolean }>> {
    const stores = await this.storeRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const threshold = Date.now() + days * 86400000
    const alerts: Array<{ storeId: number; storeName: string; expireAt: string; expired: boolean }> = []
    for (const store of stores) {
      if (!store.authExpireAt) continue
      const expire = store.authExpireAt.getTime()
      if (expire <= threshold) {
        alerts.push({
          storeId: store.id,
          storeName: store.storeName,
          expireAt: store.authExpireAt.toISOString(),
          expired: expire < Date.now()
        })
      }
    }
    return alerts
  }

  async listGoodsMaps(query: QueryShopDto, user: JwtUser): Promise<PageResult<ShopGoodsMapEntity>> {
    const where = { tenantId: user.tenantId, isDeleted: 0, ...(query.status ? { status: query.status } : {}) }
    const [list, total] = await this.mapRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createGoodsMap(dto: CreateGoodsMapDto, user: JwtUser): Promise<ShopGoodsMapEntity> {
    await this.findStore(dto.storeId, user)
    const existing = await this.mapRepo.findOne({
      where: { tenantId: user.tenantId, storeId: dto.storeId, platformGoodsId: dto.platformGoodsId, isDeleted: 0 }
    })
    if (existing) throw new BadRequestException('该平台商品已映射')
    const entity = this.mapRepo.create({
      ...dto,
      tenantId: user.tenantId,
      platformSkuId: dto.platformSkuId ?? null,
      variantId: dto.variantId ?? 0,
      priceRule: dto.priceRule ?? null,
      stockRule: dto.stockRule ?? null
    })
    const saved = await this.mapRepo.save(entity)
    await this.auditService.record({ bizType: 'shop_goods_map', bizId: saved.id, action: 'CREATE_MAP', afterValue: saved }, user)
    return saved
  }

  /** 商品映射同步：校验价格/库存规则并落同步日志，失败可重试 */
  async syncGoodsMap(id: number, user: JwtUser): Promise<ShopGoodsMapEntity> {
    const map = await this.mapRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!map) throw new NotFoundException('商品映射不存在')
    let errorText: string | null = null
    try {
      if (map.priceRule) {
        const rule = this.parseRule(map.priceRule)
        const value = Number(rule?.multiplier ?? rule?.value)
        if (!rule || !Number.isFinite(value) || value < 0) throw new Error('价格规则格式无效')
      }
      if (map.stockRule) {
        const rule = this.parseRule(map.stockRule)
        const value = Number(rule?.offset ?? rule?.value)
        if (!rule || !Number.isFinite(value) || value < 0) throw new Error('库存规则格式无效')
      }
    } catch (cause) {
      errorText = cause instanceof Error ? cause.message : String(cause)
    }
    map.syncStatus = errorText ? 'FAILED' : 'SUCCESS'
    map.errorText = errorText
    map.lastSyncAt = new Date()
    const saved = await this.mapRepo.save(map)
    await this.log(user, map.storeId, 'GOODS_SYNC', saved.id, map.platformGoodsId, saved.syncStatus, errorText)
    await this.auditService.record({ bizType: 'shop_goods_map', bizId: id, action: 'SYNC_MAP', afterValue: { status: saved.syncStatus, errorText } }, user)
    return saved
  }

  private parseRule(raw: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(raw) as unknown
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
    } catch {
      return { value: Number(raw) }
    }
  }

  async retryFailedGoodsMaps(user: JwtUser): Promise<number> {
    const failed = await this.mapRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0, syncStatus: 'FAILED' } })
    for (const item of failed) await this.syncGoodsMap(item.id, user)
    return failed.length
  }

  async listOrders(query: QueryShopDto, user: JwtUser): Promise<PageResult<ShopOrderEntity>> {
    const where = { tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }
    const [list, total] = await this.orderRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async syncOrder(dto: CreateShopOrderDto, user: JwtUser): Promise<ShopOrderEntity> {
    const store = await this.findStore(dto.storeId, user)
    const idempotentKey = `${store.id}:${dto.platformOrderNo}`
    const existing = await this.orderRepo.findOne({ where: { tenantId: user.tenantId, idempotentKey } })
    if (existing) return existing

    let customerId = dto.customerId
    if (!customerId) {
      const customer = await this.customerRepo.findOne({ where: { tenantId: user.tenantId, isDeleted: 0, status: 'ACTIVE' }, order: { id: 'ASC' } })
      if (!customer) throw new BadRequestException('请先创建客户，再同步商城订单')
      customerId = customer.id
    }

    let prepared: PromotionPreparation | null = null
    try {
      prepared = await this.preparePromotionLines(store.id, customerId, dto.couponCode, dto.lines, user)
      const effectiveAmount = prepared.lines.reduce((sum, line) => sum + this.num(line.qty) * this.num(line.unitPrice), 0)
      const saleOrder = await this.salesService.createOrder({
        customerId,
        orderDate: dto.orderDate ?? new Date().toISOString().slice(0, 10),
        lines: prepared.lines
      }, user)
      const entity = this.orderRepo.create({
        tenantId: user.tenantId,
        storeId: store.id,
        platformOrderNo: dto.platformOrderNo,
        idempotentKey,
        customerId,
        saleOrderId: saleOrder.id,
        orderAmount: effectiveAmount > 0 ? effectiveAmount.toFixed(4) : dto.orderAmount,
        payload: {
          lines: dto.lines,
          effectiveLines: prepared.lines,
          couponCode: dto.couponCode ?? null,
          couponDiscount: prepared.discount,
          activityReservations: prepared.reservations.map((item) => item.id),
          orderDate: dto.orderDate
        },
        syncedAt: new Date(),
        status: 'SYNCED',
        shipStatus: 'UNSHIPPED',
        retryCount: 0,
        errorText: null
      })
      const saved = await this.orderRepo.save(entity)
      await this.confirmReservations(prepared.reservations, saved.id, user, dto.couponCode)
      await this.log(user, store.id, 'ORDER_SYNC', saved.id, idempotentKey, 'SUCCESS')
      await this.auditService.record({ bizType: 'shop_order', bizId: saved.id, action: 'SYNC_ORDER', afterValue: { platformOrderNo: saved.platformOrderNo, saleOrderId: saleOrder.id, couponDiscount: prepared.discount } }, user)
      return saved
    } catch (cause) {
      if (prepared) await this.rollbackPromotion(prepared, user)
      // 同步失败落库为 FAILED，保留幂等键与原始 payload，供重试/手工补单消费
      const entity = this.orderRepo.create({
        tenantId: user.tenantId,
        storeId: store.id,
        platformOrderNo: dto.platformOrderNo,
        idempotentKey,
        customerId,
        saleOrderId: null,
        orderAmount: dto.orderAmount,
        payload: { lines: dto.lines, couponCode: dto.couponCode ?? null, orderDate: dto.orderDate },
        syncedAt: null,
        status: 'FAILED',
        shipStatus: 'UNSHIPPED',
        retryCount: 0,
        errorText: String(cause instanceof Error ? cause.message : cause).slice(0, 500)
      })
      const saved = await this.orderRepo.save(entity)
      await this.log(user, store.id, 'ORDER_SYNC', saved.id, idempotentKey, 'FAIL', saved.errorText)
      return saved
    }
  }

  /** 失败重试：重新执行 FAILED 订单的同步，成功则转为 SYNCED */
  async retryFailedOrder(id: number, user: JwtUser): Promise<ShopOrderEntity> {
    const order = await this.orderRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!order) throw new NotFoundException('商城订单不存在')
    if (order.status !== 'FAILED') throw new BadRequestException('只有失败订单可以重试')
    const payload = (order.payload ?? {}) as { lines?: CreateShopOrderDto['lines']; couponCode?: string | null; orderDate?: string }
    const lines = payload.lines ?? []
    if (lines.length === 0) throw new BadRequestException('失败订单缺少可重试的明细数据')
    let prepared: PromotionPreparation | null = null
    try {
      prepared = await this.preparePromotionLines(order.storeId, order.customerId ?? 0, payload.couponCode ?? undefined, lines, user)
      const saleOrder = await this.salesService.createOrder({
        customerId: order.customerId ?? 0,
        orderDate: payload.orderDate ?? new Date().toISOString().slice(0, 10),
        lines: prepared.lines
      }, user)
      order.saleOrderId = saleOrder.id
      order.status = 'SYNCED'
      order.syncedAt = new Date()
      order.errorText = null
      order.retryCount += 1
      order.payload = {
        ...order.payload,
        effectiveLines: prepared.lines,
        couponDiscount: prepared.discount,
        activityReservations: prepared.reservations.map((item) => item.id)
      }
      await this.orderRepo.save(order)
      await this.confirmReservations(prepared.reservations, order.id, user, payload.couponCode ?? undefined)
      await this.log(user, order.storeId, 'ORDER_RETRY', order.id, order.idempotentKey, 'SUCCESS')
      await this.auditService.record({ bizType: 'shop_order', bizId: id, action: 'RETRY_ORDER', afterValue: { saleOrderId: saleOrder.id, couponDiscount: prepared.discount } }, user)
      return order
    } catch (cause) {
      if (prepared) await this.rollbackPromotion(prepared, user)
      order.retryCount += 1
      order.errorText = String(cause instanceof Error ? cause.message : cause).slice(0, 500)
      await this.orderRepo.save(order)
      await this.log(user, order.storeId, 'ORDER_RETRY', order.id, order.idempotentKey, 'FAIL', order.errorText)
      return order
    }
  }

  /** 定时重试：扫描所有租户的 FAILED 订单（每次最多 20 条，重试次数 < 5） */
  async retryFailedOrdersBatch(): Promise<string> {
    const failed = await this.orderRepo.find({ where: { status: 'FAILED' }, take: 20 })
    let success = 0
    for (const order of failed) {
      if (order.retryCount >= 5) continue
      const systemUser: JwtUser = {
        userId: 0, tenantId: order.tenantId, username: 'system', realName: '系统重试',
        orgId: null, roles: [], permissions: [], isSuperAdmin: true, dataScopeLevel: 'ALL'
      }
      const result = await this.retryFailedOrder(order.id, systemUser)
      if (result.status === 'SYNCED') success++
    }
    return `重试 ${failed.length} 条，成功 ${success} 条`
  }

  async shipOrder(id: number, dto: ShipShopOrderDto, user: JwtUser): Promise<ShopWaybillEntity> {
    const order = await this.orderRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!order) throw new NotFoundException('商城订单不存在')
    if (!order.saleOrderId) throw new BadRequestException('商城订单未生成销售单')

    const detail = await this.salesService.orderDetail(order.saleOrderId, user)
    const payloadLines = ((order.payload?.lines ?? []) as ShopOrderPayloadLine[])
    for (const payloadLine of payloadLines) {
      const line = detail.lines.find((item) => item.productId === payloadLine.productId)
      const warehouseId = line?.warehouseId ?? detail.order.warehouseId
      if (!warehouseId) throw new BadRequestException('销售单未指定仓库，无法发货')
      await this.inventoryService.postMovement({
        voucherType: 'SALE_OUT',
        voucherId: order.id,
        productId: payloadLine.productId,
        variantId: payloadLine.variantId ?? 0,
        warehouseId,
        qtyOut: payloadLine.qty,
        remark: `商城订单 ${order.platformOrderNo} 发货`
      }, user)
    }
    order.shipStatus = 'SHIPPED'
    order.status = 'SHIPPED'
    await this.orderRepo.save(order)

    const waybill = await this.waybillRepo.save(this.waybillRepo.create({
      tenantId: user.tenantId,
      storeId: order.storeId,
      shopOrderId: order.id,
      waybillNo: dto.waybillNo,
      carrier: dto.carrier ?? null
    }))
    await this.log(user, order.storeId, 'ORDER_SHIP', order.id, order.idempotentKey, 'SUCCESS')
    await this.auditService.record({ bizType: 'shop_waybill', bizId: waybill.id, action: 'CREATE_WAYBILL', afterValue: waybill }, user)
    return waybill
  }

  /** 电子面单：按承运商生成唯一运单号并预置标签地址 */
  async generateWaybillLabel(id: number, dto: GenerateWaybillDto, user: JwtUser): Promise<ShopWaybillEntity> {
    const order = await this.orderRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!order) throw new NotFoundException('商城订单不存在')
    const waybillNo = generateWaybillNo(dto.carrier, order.platformOrderNo)
    const existing = await this.waybillRepo.findOne({ where: { tenantId: user.tenantId, waybillNo } })
    if (existing) return existing
    const entity = this.waybillRepo.create({
      tenantId: user.tenantId,
      storeId: order.storeId,
      shopOrderId: order.id,
      waybillNo,
      carrier: dto.carrier,
      labelUrl: `/api/v1/shop/waybills/${waybillNo}/label`
    })
    const saved = await this.waybillRepo.save(entity)
    await this.log(user, order.storeId, 'WAYBILL_LABEL', saved.id, waybillNo, 'SUCCESS')
    await this.auditService.record({ bizType: 'shop_waybill', bizId: saved.id, action: 'GENERATE_LABEL', afterValue: saved }, user)
    return saved
  }

  /** 活动日历：按开始日期聚合优惠券与秒杀活动 */
  async activityCalendar(user: JwtUser): Promise<Array<Record<string, unknown>>> {
    const [coupons, seckills] = await Promise.all([
      this.couponRepo.find({ where: { tenantId: user.tenantId, status: 'ACTIVE' } }),
      this.seckillRepo.find({ where: { tenantId: user.tenantId, status: 'ACTIVE' } })
    ])
    return buildActivityCalendar([
      ...coupons.map((item) => ({ code: item.couponCode, startTime: item.startTime, endTime: item.endTime })),
      ...seckills.map((item) => ({ code: item.seckillCode, startTime: item.startTime, endTime: item.endTime }))
    ])
  }

  /** 客服快捷回复：按关键词匹配推荐话术 */
  quickReplies(dto: QuickReplyDto, _user: JwtUser): Array<Record<string, unknown>> {
    return quickReply(dto.message, [
      { code: 'REFUND', keywords: ['退款', '退货'], content: '您好，请提供订单号与退款原因，我们将在 1 个工作日内处理。' },
      { code: 'LOGISTICS', keywords: ['物流', '快递', '运单'], content: '您好，运单轨迹已同步，若超过 48 小时未更新我们会为您催件。' },
      { code: 'INVOICE', keywords: ['发票', '开票'], content: '您好，请提供抬头与税号，我们会在审核后开具电子发票。' }
    ])
  }

  async listPromotions(query: QueryShopDto, user: JwtUser): Promise<PageResult<ShopPromotionEntity>> {
    const where = { tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }
    const [list, total] = await this.promotionRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createPromotion(dto: CreatePromotionDto, user: JwtUser): Promise<ShopPromotionEntity> {
    await this.findStore(dto.storeId, user)
    const entity = this.promotionRepo.create({
      ...dto,
      tenantId: user.tenantId,
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
      stockLimit: dto.stockLimit ?? '0'
    })
    const saved = await this.promotionRepo.save(entity)
    await this.auditService.record({ bizType: 'shop_promotion', bizId: saved.id, action: 'CREATE_PROMOTION', afterValue: saved }, user)
    return saved
  }

  async listCoupons(query: QueryShopDto, user: JwtUser): Promise<PageResult<ShopCouponEntity>> {
    const where = { tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }
    const [list, total] = await this.couponRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createCoupon(dto: CreateCouponDto, user: JwtUser): Promise<ShopCouponEntity> {
    await this.findStore(dto.storeId, user)
    const start = new Date(dto.startTime)
    const end = new Date(dto.endTime)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) throw new BadRequestException('优惠券有效期配置错误')
    const existing = await this.couponRepo.findOne({ where: { tenantId: user.tenantId, storeId: dto.storeId, couponCode: dto.couponCode } })
    if (existing) throw new BadRequestException('优惠券编码已存在')
    const entity = this.couponRepo.create({
      tenantId: user.tenantId,
      storeId: dto.storeId,
      couponCode: dto.couponCode,
      couponType: dto.couponType,
      discountValue: dto.discountValue,
      minAmount: dto.minAmount,
      maxDiscount: dto.maxDiscount ?? '0',
      startTime: start,
      endTime: end,
      stackable: dto.stackable ? 1 : 0,
      usedCount: 0,
      status: 'ACTIVE'
    })
    const saved = await this.couponRepo.save(entity)
    await this.auditService.record({ bizType: 'shop_coupon', bizId: saved.id, action: 'CREATE_COUPON', afterValue: saved }, user)
    return saved
  }

  async validateCouponOrder(dto: ValidateCouponDto, user: JwtUser): Promise<{ valid: boolean; discount: number; reason?: string }> {
    const coupon = await this.couponRepo.findOne({ where: { tenantId: user.tenantId, storeId: dto.storeId, couponCode: dto.couponCode } })
    if (!coupon) throw new NotFoundException('优惠券不存在')
    const maxDiscount = this.num(coupon.maxDiscount)
    return validateCoupon({
      code: coupon.couponCode,
      type: coupon.couponType === 'PERCENT' ? 'PERCENT' : 'FIXED',
      value: this.num(coupon.discountValue),
      minAmount: this.num(coupon.minAmount),
      maxDiscount: maxDiscount > 0 ? maxDiscount : undefined,
      startTime: coupon.startTime,
      endTime: coupon.endTime,
      status: coupon.status,
      stackable: coupon.stackable === 1
    }, { amount: this.num(dto.amount), at: dto.at ? new Date(dto.at) : new Date() })
  }

  async listSeckills(query: QueryShopDto, user: JwtUser): Promise<PageResult<ShopSeckillEntity>> {
    const where = { tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }
    const [list, total] = await this.seckillRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createSeckill(dto: CreateSeckillDto, user: JwtUser): Promise<ShopSeckillEntity> {
    await this.findStore(dto.storeId, user)
    const map = await this.mapRepo.findOne({ where: { tenantId: user.tenantId, storeId: dto.storeId, productId: dto.productId, isDeleted: 0 } })
    if (!map) throw new BadRequestException('商品未映射到该店铺，无法创建秒杀')
    const start = new Date(dto.startTime)
    const end = new Date(dto.endTime)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) throw new BadRequestException('秒杀有效期配置错误')
    if (this.num(dto.seckillPrice) >= this.num(dto.basePrice)) throw new BadRequestException('秒杀价必须低于原价')
    const existing = await this.seckillRepo.findOne({ where: { tenantId: user.tenantId, storeId: dto.storeId, seckillCode: dto.seckillCode } })
    if (existing) throw new BadRequestException('秒杀编码已存在')
    const entity = this.seckillRepo.create({
      tenantId: user.tenantId,
      storeId: dto.storeId,
      seckillCode: dto.seckillCode,
      productId: dto.productId,
      variantId: dto.variantId ?? 0,
      basePrice: dto.basePrice,
      seckillPrice: dto.seckillPrice,
      limitPerUser: dto.limitPerUser,
      startTime: start,
      endTime: end,
      status: 'ACTIVE'
    })
    const saved = await this.seckillRepo.save(entity)
    await this.auditService.record({ bizType: 'shop_seckill', bizId: saved.id, action: 'CREATE_SECKILL', afterValue: saved }, user)
    return saved
  }

  async setActivityStock(dto: SetActivityStockDto, user: JwtUser): Promise<ShopActivityStockEntity> {
    await this.findStore(dto.storeId, user)
    if (dto.activityType === 'SECKILL') {
      const seckill = await this.seckillRepo.findOne({ where: { id: dto.activityId, tenantId: user.tenantId, storeId: dto.storeId } })
      if (!seckill) throw new NotFoundException('秒杀活动不存在')
      if (seckill.productId !== dto.productId || seckill.variantId !== (dto.variantId ?? 0)) throw new BadRequestException('活动库存商品与秒杀活动不一致')
    } else {
      const promotion = await this.promotionRepo.findOne({ where: { id: dto.activityId, tenantId: user.tenantId, storeId: dto.storeId } })
      if (!promotion) throw new NotFoundException('营销活动不存在')
    }
    if (this.num(dto.totalStock) < 0) throw new BadRequestException('活动库存不能为负数')
    const existing = await this.activityStockRepo.findOne({
      where: {
        tenantId: user.tenantId, storeId: dto.storeId, activityType: dto.activityType,
        activityId: dto.activityId, productId: dto.productId, variantId: dto.variantId ?? 0
      }
    })
    const total = this.num(dto.totalStock)
    const sold = existing ? this.num(existing.soldStock) : 0
    const locked = existing ? this.num(existing.lockedStock) : 0
    if (total < sold + locked) throw new BadRequestException('活动库存不能小于已售与锁定数量')
    const entity = existing ?? this.activityStockRepo.create({
      tenantId: user.tenantId,
      storeId: dto.storeId,
      activityType: dto.activityType,
      activityId: dto.activityId,
      productId: dto.productId,
      variantId: dto.variantId ?? 0,
      soldStock: '0',
      lockedStock: '0',
      status: 'ACTIVE'
    })
    entity.totalStock = total.toFixed(3)
    const saved = await this.activityStockRepo.save(entity)
    await this.auditService.record({ bizType: 'shop_activity_stock', bizId: saved.id, action: 'SET_ACTIVITY_STOCK', afterValue: { totalStock: saved.totalStock, soldStock: saved.soldStock, lockedStock: saved.lockedStock } }, user)
    return saved
  }

  async listActivityStocks(query: QueryShopDto, user: JwtUser): Promise<PageResult<ShopActivityStockEntity>> {
    const where = { tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }
    const [list, total] = await this.activityStockRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 活动库存预留：秒杀校验 + 独立库存池锁定，超卖直接拒绝 */
  async reserveActivityStock(dto: ReserveActivityStockDto, user: JwtUser): Promise<{ order: ShopActivityOrderEntity; stock: ShopActivityStockEntity; price: number }> {
    await this.findStore(dto.storeId, user)
    try {
      const result = await this.activityStockRepo.manager.transaction(async (manager) => {
        const stockRepo = manager.getRepository(ShopActivityStockEntity)
        const orderRepo = manager.getRepository(ShopActivityOrderEntity)
        const stock = await stockRepo.createQueryBuilder('stock')
          .setLock('pessimistic_write')
          .where('stock.tenantId = :tenantId', { tenantId: user.tenantId })
          .andWhere('stock.storeId = :storeId', { storeId: dto.storeId })
          .andWhere('stock.activityType = :activityType', { activityType: dto.activityType })
          .andWhere('stock.activityId = :activityId', { activityId: dto.activityId })
          .andWhere('stock.productId = :productId', { productId: dto.productId })
          .andWhere('stock.variantId = :variantId', { variantId: dto.variantId ?? 0 })
          .getOne()
        if (!stock) throw new BadRequestException('活动库存未配置')
        let seckillPrice = 0
        if (dto.activityType === 'SECKILL') {
          const seckill = await manager.getRepository(ShopSeckillEntity).findOne({
            where: { id: dto.activityId, tenantId: user.tenantId, storeId: dto.storeId, status: 'ACTIVE' }
          })
          if (!seckill) throw new NotFoundException('秒杀活动不存在或未启用')
          const buyerKey = dto.buyerKey ?? 'ANONYMOUS'
          const history = await orderRepo.find({
            where: {
              tenantId: user.tenantId, storeId: dto.storeId, activityType: 'SECKILL',
              activityId: dto.activityId, productId: dto.productId, variantId: dto.variantId ?? 0, buyerKey
            }
          })
          const purchased = history.filter((item) => item.status !== 'RELEASED').reduce((sum, item) => sum + this.num(item.qty), 0)
          const seckillResult = resolveSeckillPrice({
            status: seckill.status,
            startTime: seckill.startTime,
            endTime: seckill.endTime,
            basePrice: this.num(seckill.basePrice),
            seckillPrice: this.num(seckill.seckillPrice),
            limitPerUser: seckill.limitPerUser
          }, { qty: this.num(dto.qty), purchased })
          if (!seckillResult.active || !seckillResult.allowed) throw new BadRequestException(seckillResult.reason ?? '秒杀活动不可购买')
          seckillPrice = seckillResult.price
        }
        const allocation = allocateStock({
          total: this.num(stock.totalStock), sold: this.num(stock.soldStock), locked: this.num(stock.lockedStock)
        }, this.num(dto.qty))
        if (!allocation.ok || availableActivityStock(allocation.state) < 0) throw new BadRequestException('活动库存不足，禁止超卖')
        stock.lockedStock = String(allocation.state.locked)
        const savedStock = await stockRepo.save(stock)
        const order = await orderRepo.save(orderRepo.create({
          tenantId: user.tenantId,
          storeId: dto.storeId,
          activityType: dto.activityType,
          activityId: dto.activityId,
          productId: dto.productId,
          variantId: dto.variantId ?? 0,
          qty: this.num(dto.qty).toFixed(3),
          buyerKey: dto.buyerKey ?? 'ANONYMOUS',
          price: seckillPrice.toFixed(4),
          status: 'LOCKED'
        }))
        return { stock: savedStock, order, price: seckillPrice }
      })
      await this.log(user, dto.storeId, 'ACTIVITY_STOCK', result.order.id, `RESERVE:${dto.activityId}`, 'SUCCESS')
      return result
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause)
      await this.log(user, dto.storeId, 'ACTIVITY_STOCK', 0, `RESERVE:${dto.activityId}`, 'FAIL', reason)
      throw cause
    }
  }

  async releaseActivityStock(id: number, user: JwtUser, note?: string): Promise<{ order: ShopActivityOrderEntity; stock: ShopActivityStockEntity }> {
    const order = await this.activityOrderRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!order) throw new NotFoundException('活动订单不存在')
    if (order.status !== 'LOCKED') throw new BadRequestException('只有锁定中的活动库存可以释放')
    const result = await this.activityStockRepo.manager.transaction(async (manager) => {
      const stockRepo = manager.getRepository(ShopActivityStockEntity)
      const orderRepo = manager.getRepository(ShopActivityOrderEntity)
      const stock = await stockRepo.createQueryBuilder('stock')
        .setLock('pessimistic_write')
        .where('stock.tenantId = :tenantId', { tenantId: user.tenantId })
        .andWhere('stock.storeId = :storeId', { storeId: order.storeId })
        .andWhere('stock.activityType = :activityType', { activityType: order.activityType })
        .andWhere('stock.activityId = :activityId', { activityId: order.activityId })
        .andWhere('stock.productId = :productId', { productId: order.productId })
        .andWhere('stock.variantId = :variantId', { variantId: order.variantId })
        .getOne()
      if (!stock) throw new NotFoundException('活动库存不存在')
      const released = releaseStock({
        total: this.num(stock.totalStock), sold: this.num(stock.soldStock), locked: this.num(stock.lockedStock)
      }, this.num(order.qty))
      if (!released.ok) throw new BadRequestException('活动库存锁定量不足，无法释放')
      stock.lockedStock = String(released.state.locked)
      const savedStock = await stockRepo.save(stock)
      order.status = 'RELEASED'
      const savedOrder = await orderRepo.save(order)
      return { order: savedOrder, stock: savedStock }
    })
    await this.log(user, order.storeId, 'ACTIVITY_RELEASE', result.order.id, `RELEASE:${order.activityId}`, 'SUCCESS', note ?? null)
    return result
  }

  async promotionEffect(user: JwtUser, storeId?: number): Promise<Record<string, unknown>> {
    const scope = { tenantId: user.tenantId, ...(storeId ? { storeId } : {}) }
    const [coupons, seckills, stocks, orders, failLogs] = await Promise.all([
      this.couponRepo.find({ where: scope }),
      this.seckillRepo.find({ where: scope }),
      this.activityStockRepo.find({ where: scope }),
      this.activityOrderRepo.find({ where: scope }),
      this.logRepo.find({ where: { tenantId: user.tenantId, bizType: 'ACTIVITY_STOCK', result: 'FAIL' } })
    ])
    return {
      couponCount: coupons.length,
      couponUsedCount: coupons.reduce((sum, item) => sum + item.usedCount, 0),
      seckillCount: seckills.length,
      activityStockCount: stocks.length,
      totalActivityStock: stocks.reduce((sum, item) => sum + this.num(item.totalStock), 0).toFixed(3),
      reservedQty: orders.filter((item) => item.status === 'LOCKED').reduce((sum, item) => sum + this.num(item.qty), 0).toFixed(3),
      soldQty: orders.filter((item) => item.status === 'CONFIRMED').reduce((sum, item) => sum + this.num(item.qty), 0).toFixed(3),
      releasedQty: orders.filter((item) => item.status === 'RELEASED').reduce((sum, item) => sum + this.num(item.qty), 0).toFixed(3),
      oversellBlockedCount: failLogs.length,
      discountAmount: orders.reduce((sum, item) => sum + this.num(item.discountAmount), 0).toFixed(4)
    }
  }

  async listPaymentConfigs(query: QueryShopDto, user: JwtUser): Promise<PageResult<ShopPaymentConfigEntity>> {
    const [list, total] = await this.paymentRepo.findAndCount({ where: { tenantId: user.tenantId }, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createPaymentConfig(dto: CreatePaymentConfigDto, user: JwtUser): Promise<ShopPaymentConfigEntity> {
    await this.findStore(dto.storeId, user)
    const existing = await this.paymentRepo.findOne({ where: { tenantId: user.tenantId, storeId: dto.storeId, channel: dto.channel } })
    if (existing) throw new BadRequestException('该渠道已配置')
    const secretMask = sealSensitiveFields({ secret: dto.secret }, ['secret']).masked.secretMask ?? null
    const entity = this.paymentRepo.create({ ...dto, tenantId: user.tenantId, merchantId: dto.merchantId ?? null, secretMask })
    const saved = await this.paymentRepo.save(entity)
    await this.auditService.record({ bizType: 'shop_payment_config', bizId: saved.id, action: 'CREATE_CONFIG', afterValue: { id: saved.id, channel: saved.channel } }, user)
    return saved
  }

  async reconcile(storeId: number, dto: ReconcileDto, user: JwtUser): Promise<ShopSyncLogEntity> {
    await this.findStore(storeId, user)
    return this.log(user, storeId, 'PAYMENT_RECONCILE', 0, null, dto.result, dto.note ?? null)
  }

  async importReconcileBills(dto: ImportReconcileDto, user: JwtUser): Promise<ShopReconcileBillEntity[]> {
    const saved: ShopReconcileBillEntity[] = []
    for (const item of dto.bills) {
      await this.findStore(item.storeId, user)
      const result = compareAmounts(this.num(item.platformAmount), this.num(item.localAmount))
      const existing = await this.reconcileRepo.findOne({ where: { tenantId: user.tenantId, storeId: item.storeId, billNo: item.billNo } })
      const entity = existing ?? this.reconcileRepo.create({
        tenantId: user.tenantId,
        storeId: item.storeId,
        billNo: item.billNo,
        channel: item.channel,
        currency: item.currency ?? 'CNY'
      })
      entity.period = item.period ?? null
      entity.platformAmount = this.num(item.platformAmount).toFixed(4)
      entity.localAmount = this.num(item.localAmount).toFixed(4)
      entity.diffAmount = result.diff.toFixed(4)
      entity.status = result.status
      entity.diffReason = result.reason ?? null
      const bill = await this.reconcileRepo.save(entity)
      await this.log(user, item.storeId, 'RECONCILE_IMPORT', bill.id, bill.billNo, result.status, result.reason ?? null)
      saved.push(bill)
    }
    await this.auditService.record({ bizType: 'shop_reconcile_bill', bizId: saved[0]?.id ?? 0, action: 'IMPORT_RECONCILE', afterValue: { count: saved.length, diffCount: saved.filter((item) => item.status === 'DIFF').length } }, user)
    return saved
  }

  async listReconcileBills(query: QueryShopDto, user: JwtUser): Promise<PageResult<ShopReconcileBillEntity>> {
    const where = { tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }
    const [list, total] = await this.reconcileRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async resolveReconcileBill(id: number, dto: ResolveReconcileDto, user: JwtUser): Promise<ShopReconcileBillEntity> {
    const bill = await this.reconcileRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!bill) throw new NotFoundException('对账单不存在')
    if (bill.status !== 'DIFF') throw new BadRequestException('只有差异账单可以处理')
    bill.status = 'RESOLVED'
    bill.diffReason = dto.note
    bill.resolvedBy = user.userId
    bill.resolvedAt = new Date()
    const saved = await this.reconcileRepo.save(bill)
    await this.log(user, bill.storeId, 'RECONCILE_RESOLVE', saved.id, saved.billNo, 'SUCCESS', dto.note)
    await this.auditService.record({ bizType: 'shop_reconcile_bill', bizId: id, action: 'RESOLVE_RECONCILE', afterValue: { status: saved.status, note: dto.note } }, user)
    return saved
  }

  async createRefund(dto: CreateRefundDto, user: JwtUser): Promise<ShopRefundEntity> {
    const order = await this.orderRepo.findOne({ where: { id: dto.shopOrderId, tenantId: user.tenantId } })
    if (!order) throw new NotFoundException('商城订单不存在')
    if (!order.saleOrderId) throw new BadRequestException('商城订单未生成销售单，无法退款')
    if (dto.reconcileBillId) {
      const bill = await this.reconcileRepo.findOne({ where: { id: dto.reconcileBillId, tenantId: user.tenantId } })
      if (!bill) throw new NotFoundException('对账单不存在')
    }
    const paid = this.num(order.paidAmount) > 0 ? this.num(order.paidAmount) : this.num(order.orderAmount)
    const refunded = await this.refundRepo.find({ where: { tenantId: user.tenantId, shopOrderId: order.id, status: 'APPROVED' } })
    const refundedAmount = refunded.reduce((sum, item) => sum + this.num(item.amount), 0)
    const eligibility = checkRefundEligibility({
      orderAmount: this.num(order.orderAmount),
      paidAmount: paid,
      refundedAmount,
      amount: this.num(dto.amount),
      orderStatus: order.status
    })
    if (!eligibility.allowed) throw new BadRequestException(eligibility.reason ?? '订单不满足退款条件')
    const entity = this.refundRepo.create({
      tenantId: user.tenantId,
      storeId: order.storeId,
      shopOrderId: order.id,
      reconcileBillId: dto.reconcileBillId ?? null,
      refundNo: `RF${Date.now()}${Math.floor(Math.random() * 1000)}`,
      amount: this.num(dto.amount).toFixed(4),
      reason: dto.reason ?? null,
      status: 'SUBMITTED',
      createdBy: user.userId
    })
    const saved = await this.refundRepo.save(entity)
    await this.log(user, order.storeId, 'REFUND_SUBMIT', saved.id, saved.refundNo, 'SUCCESS')
    await this.auditService.record({ bizType: 'shop_refund', bizId: saved.id, action: 'SUBMIT_REFUND', afterValue: saved }, user)
    return saved
  }

  async listRefunds(query: QueryShopDto, user: JwtUser): Promise<PageResult<ShopRefundEntity>> {
    const where = { tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }
    const [list, total] = await this.refundRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async approveRefund(id: number, dto: ApproveRefundDto, user: JwtUser): Promise<ShopRefundEntity> {
    const refund = await this.refundRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!refund) throw new NotFoundException('退款单不存在')
    if (!canTransitionRefund(refund.status, 'APPROVED')) throw new BadRequestException('当前退款状态不允许审批')
    const order = await this.orderRepo.findOne({ where: { id: refund.shopOrderId, tenantId: user.tenantId } })
    if (!order || !order.saleOrderId) throw new BadRequestException('退款关联的商城订单或销售单不存在')
    const payloadLines = ((order.payload?.lines ?? []) as ShopOrderPayloadLine[])
    if (payloadLines.length === 0) throw new BadRequestException('商城订单缺少可退款明细')
    const allocations = allocateRefundAmount(payloadLines.map((line) => ({
      qty: this.num(line.qty), unitPrice: this.num(line.unitPrice)
    })), this.num(refund.amount))
    if (allocations.every((item) => item.amount <= 0)) throw new BadRequestException('退款明细金额无效')
    let customerId = order.customerId
    if (!customerId) {
      const customer = await this.customerRepo.findOne({ where: { tenantId: user.tenantId, isDeleted: 0, status: 'ACTIVE' }, order: { id: 'ASC' } })
      if (!customer) throw new BadRequestException('请先创建客户，再审批退款')
      customerId = customer.id
    }
    const saleReturn = await this.salesService.createReturn({
      customerId,
      orderId: order.saleOrderId,
      reason: refund.reason ?? '商城退款审批',
      lines: payloadLines.map((line, index) => ({
        productId: line.productId,
        qty: line.qty,
        amount: allocations[index].amount.toFixed(4),
        disposal: 'REFUND_ONLY'
      }))
    }, user)
    await this.salesService.updateReturn(saleReturn.id, { status: 'SUBMITTED' }, user)
    await this.salesService.approveReturn(saleReturn.id, { redInvoiceNo: dto.redInvoiceNo }, user)
    refund.status = 'APPROVED'
    refund.saleReturnId = saleReturn.id
    refund.redInvoiceNo = dto.redInvoiceNo ?? null
    refund.reviewNote = dto.note ?? null
    refund.reviewedBy = user.userId
    refund.reviewedAt = new Date()
    const saved = await this.refundRepo.save(refund)
    await this.log(user, refund.storeId, 'REFUND_APPROVE', saved.id, saved.refundNo, 'SUCCESS')
    await this.auditService.record({ bizType: 'shop_refund', bizId: id, action: 'APPROVE_REFUND', afterValue: { saleReturnId: saleReturn.id, amount: saved.amount } }, user)
    return saved
  }

  async rejectRefund(id: number, dto: RejectRefundDto, user: JwtUser): Promise<ShopRefundEntity> {
    const refund = await this.refundRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!refund) throw new NotFoundException('退款单不存在')
    if (!canTransitionRefund(refund.status, 'REJECTED')) throw new BadRequestException('当前退款状态不允许驳回')
    refund.status = 'REJECTED'
    refund.reviewNote = dto.note
    refund.reviewedBy = user.userId
    refund.reviewedAt = new Date()
    const saved = await this.refundRepo.save(refund)
    await this.log(user, refund.storeId, 'REFUND_REJECT', saved.id, saved.refundNo, 'SUCCESS', dto.note)
    await this.auditService.record({ bizType: 'shop_refund', bizId: id, action: 'REJECT_REFUND', afterValue: { note: dto.note } }, user)
    return saved
  }

  async listWaybills(query: QueryShopDto, user: JwtUser): Promise<PageResult<ShopWaybillEntity>> {
    const [list, total] = await this.waybillRepo.findAndCount({ where: { tenantId: user.tenantId }, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async markWaybillException(id: number, user: JwtUser): Promise<ShopWaybillEntity> {
    const waybill = await this.waybillRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!waybill) throw new NotFoundException('运单不存在')
    waybill.exceptionFlag = 'YES'
    waybill.status = 'EXCEPTION'
    const saved = await this.waybillRepo.save(waybill)
    await this.log(user, waybill.storeId, 'WAYBILL_EXCEPTION', saved.id, saved.waybillNo, 'SUCCESS')
    return saved
  }

  async listConversations(query: QueryShopDto, user: JwtUser): Promise<PageResult<ShopCsConversationEntity>> {
    const where = { tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }
    const [list, total] = await this.csRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createConversation(dto: CreateCsConversationDto, user: JwtUser): Promise<ShopCsConversationEntity> {
    await this.findStore(dto.storeId, user)
    const entity = this.csRepo.create({
      tenantId: user.tenantId,
      storeId: dto.storeId,
      platformBuyerId: dto.platformBuyerId ?? null,
      lastMessage: dto.message ?? null,
      status: CsConversationStatus.OPEN
    })
    const saved = await this.csRepo.save(entity)
    await this.auditService.record({ bizType: 'shop_cs', bizId: saved.id, action: 'CREATE_CONVERSATION', afterValue: saved }, user)
    return saved
  }

  async replyConversation(id: number, dto: ReplyCsDto, user: JwtUser): Promise<ShopCsConversationEntity> {
    const entity = await this.csRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('客服会话不存在')
    entity.lastMessage = dto.message
    entity.updatedAt = new Date()
    const saved = await this.csRepo.save(entity)
    await this.log(user, entity.storeId, 'CS_REPLY', saved.id, null, 'SUCCESS', dto.message)
    return saved
  }

  /** 物流轨迹推送：自动识别承运商、更新运单状态并检测滞留异常 */
  async pushTracking(waybillId: number, dto: PushTrackingDto, user: JwtUser): Promise<Record<string, unknown>> {
    const waybill = await this.waybillRepo.findOne({ where: { id: waybillId, tenantId: user.tenantId } })
    if (!waybill) throw new NotFoundException('运单不存在')
    const carrier = detectCarrier(waybill.waybillNo)
    const eventAt = dto.eventAt ? new Date(dto.eventAt) : new Date()
    const event = await this.trackingRepo.save(this.trackingRepo.create({
      tenantId: user.tenantId,
      storeId: waybill.storeId,
      waybillId,
      eventNo: `${waybill.waybillNo}-${eventAt.getTime()}`,
      carrierStatus: dto.status,
      location: dto.location ?? null,
      description: dto.description ?? null,
      eventAt
    }))
    const history = await this.trackingRepo.find({ where: { tenantId: user.tenantId, waybillId } })
    const exception = detectLogisticsException(history.map((item) => ({
      status: item.carrierStatus, location: item.location, description: item.description, eventAt: item.eventAt
    })))
    const status = dto.status.toUpperCase()
    waybill.carrier = carrier
    waybill.status = status === 'SIGNED' || status === 'DELIVERED' ? 'SIGNED' : exception.exception ? 'EXCEPTION' : 'IN_TRANSIT'
    waybill.exceptionFlag = exception.exception ? 'YES' : 'NO'
    const savedWaybill = await this.waybillRepo.save(waybill)
    await this.log(user, waybill.storeId, 'WAYBILL_TRACKING', event.id, waybill.waybillNo, exception.exception ? 'FAIL' : 'SUCCESS', exception.reason ?? null)
    await this.auditService.record({ bizType: 'shop_waybill', bizId: savedWaybill.id, action: 'PUSH_TRACKING', afterValue: { status: savedWaybill.status, carrier, exception } }, user)
    return { event, waybill: savedWaybill, exception, carrier }
  }

  async listTracking(waybillId: number, user: JwtUser): Promise<ShopTrackingEventEntity[]> {
    const waybill = await this.waybillRepo.findOne({ where: { id: waybillId, tenantId: user.tenantId } })
    if (!waybill) throw new NotFoundException('运单不存在')
    const events = await this.trackingRepo.find({ where: { tenantId: user.tenantId, waybillId } })
    return sortTrackingEvents(events.map((item) => ({
      ...item,
      status: item.carrierStatus,
      location: item.location,
      description: item.description,
      eventAt: item.eventAt
    }))).map((item) => {
      const { status, ...entity } = item
      void status
      return entity as ShopTrackingEventEntity
    })
  }

  /** 客服质检：首次响应 SLA、解决状态与服务态度评分 */
  async createCsQc(conversationId: number, dto: CreateCsQcDto, user: JwtUser): Promise<ShopCsQualityReviewEntity> {
    const conversation = await this.csRepo.findOne({ where: { id: conversationId, tenantId: user.tenantId } })
    if (!conversation) throw new NotFoundException('客服会话不存在')
    const scored = scoreCsQuality({
      responseMinutes: dto.responseMinutes,
      resolved: dto.resolved,
      politeness: dto.politeness,
      firstReplySlaMinutes: dto.firstReplySlaMinutes
    })
    const entity = this.csQcRepo.create({
      tenantId: user.tenantId,
      storeId: conversation.storeId,
      conversationId,
      score: scored.score,
      result: scored.result,
      reviewNote: [dto.note, ...scored.reasons].filter(Boolean).join('；') || null,
      reviewedBy: user.userId
    })
    const saved = await this.csQcRepo.save(entity)
    await this.auditService.record({ bizType: 'shop_cs_qc', bizId: saved.id, action: 'CREATE_CS_QC', afterValue: saved }, user)
    return saved
  }

  async listCsQc(query: QueryShopDto, user: JwtUser): Promise<PageResult<ShopCsQualityReviewEntity>> {
    const where = { tenantId: user.tenantId, ...(query.status ? { result: query.status } : {}) }
    const [list, total] = await this.csQcRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async listLogs(query: QueryShopDto, user: JwtUser): Promise<PageResult<ShopSyncLogEntity>> {
    const [list, total] = await this.logRepo.findAndCount({ where: { tenantId: user.tenantId }, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async report(user: JwtUser): Promise<Record<string, unknown>> {
    const stores = await this.storeRepo.count({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const orders = await this.orderRepo.find({ where: { tenantId: user.tenantId } })
    return {
      storeCount: stores,
      orderCount: orders.length,
      syncedCount: orders.filter((item) => item.status === 'SYNCED').length,
      shippedCount: orders.filter((item) => item.shipStatus === 'SHIPPED').length,
      orderAmount: orders.reduce((sum, item) => sum + this.num(item.orderAmount), 0).toFixed(4)
    }
  }

  private async preparePromotionLines(
    storeId: number, customerId: number, couponCode: string | undefined,
    input: CreateShopOrderDto['lines'], user: JwtUser
  ): Promise<PromotionPreparation> {
    const lines = input.map((line) => ({ ...line }))
    const prepared: PromotionPreparation = { lines, discount: 0, coupon: null, reservations: [] }
    try {
      for (const line of lines) {
        if (!line.activityId) continue
        const reserved = await this.reserveActivityStock({
          storeId,
          activityType: 'SECKILL',
          activityId: line.activityId,
          productId: line.productId,
          variantId: line.variantId ?? 0,
          qty: line.qty,
          buyerKey: `CUSTOMER_${customerId}`
        }, user)
        line.unitPrice = reserved.price.toFixed(4)
        prepared.reservations.push(reserved.order)
      }
      if (couponCode) {
        const coupon = await this.couponRepo.findOne({ where: { tenantId: user.tenantId, storeId, couponCode } })
        if (!coupon) throw new NotFoundException('优惠券不存在')
        const total = lines.reduce((sum, line) => sum + this.num(line.qty) * this.num(line.unitPrice), 0)
        const maxDiscount = this.num(coupon.maxDiscount)
        const result = validateCoupon({
          code: coupon.couponCode,
          type: coupon.couponType === 'PERCENT' ? 'PERCENT' : 'FIXED',
          value: this.num(coupon.discountValue),
          minAmount: this.num(coupon.minAmount),
          maxDiscount: maxDiscount > 0 ? maxDiscount : undefined,
          startTime: coupon.startTime,
          endTime: coupon.endTime,
          status: coupon.status,
          stackable: coupon.stackable === 1
        }, { amount: total })
        if (!result.valid) throw new BadRequestException(result.reason ?? '优惠券不可用')
        const priced = applyCouponToLines(lines.map((line) => ({ qty: this.num(line.qty), unitPrice: this.num(line.unitPrice) })), result.discount)
        lines.forEach((line, index) => { line.unitPrice = priced[index].unitPrice.toFixed(4) })
        coupon.usedCount += 1
        prepared.coupon = await this.couponRepo.save(coupon)
        prepared.discount = result.discount
      }
      return prepared
    } catch (cause) {
      await this.rollbackPromotion(prepared, user)
      throw cause
    }
  }

  private async rollbackPromotion(prepared: PromotionPreparation, user: JwtUser): Promise<void> {
    for (const reservation of prepared.reservations) {
      if (reservation.status !== 'LOCKED') continue
      try {
        await this.releaseActivityStock(reservation.id, user, 'ORDER_FAILED')
      } catch {
        await this.log(user, reservation.storeId, 'ACTIVITY_RELEASE', reservation.id, `RELEASE:${reservation.activityId}`, 'FAIL', '订单失败回滚活动库存失败')
      }
    }
    if (!prepared.coupon) return
    const coupon = await this.couponRepo.findOne({ where: { id: prepared.coupon.id, tenantId: user.tenantId } })
    if (coupon) {
      coupon.usedCount = Math.max(0, coupon.usedCount - 1)
      await this.couponRepo.save(coupon)
    }
  }

  private async confirmReservations(reservations: ShopActivityOrderEntity[], shopOrderId: number, user: JwtUser, couponCode?: string): Promise<void> {
    for (const item of reservations) {
      try {
        await this.activityStockRepo.manager.transaction(async (manager) => {
          const orderRepo = manager.getRepository(ShopActivityOrderEntity)
          const stockRepo = manager.getRepository(ShopActivityStockEntity)
          const order = await orderRepo.findOne({ where: { id: item.id, tenantId: user.tenantId } })
          const stock = await stockRepo.createQueryBuilder('stock')
            .setLock('pessimistic_write')
            .where('stock.tenantId = :tenantId', { tenantId: user.tenantId })
            .andWhere('stock.storeId = :storeId', { storeId: item.storeId })
            .andWhere('stock.activityType = :activityType', { activityType: item.activityType })
            .andWhere('stock.activityId = :activityId', { activityId: item.activityId })
            .andWhere('stock.productId = :productId', { productId: item.productId })
            .andWhere('stock.variantId = :variantId', { variantId: item.variantId })
            .getOne()
          if (!order || order.status !== 'LOCKED' || !stock) return
          const confirmed = confirmStock({
            total: this.num(stock.totalStock), sold: this.num(stock.soldStock), locked: this.num(stock.lockedStock)
          }, this.num(order.qty))
          if (!confirmed.ok) throw new BadRequestException('活动库存锁定量不足，无法确认')
          stock.soldStock = String(confirmed.state.sold)
          stock.lockedStock = String(confirmed.state.locked)
          await stockRepo.save(stock)
          order.status = 'CONFIRMED'
          order.shopOrderId = shopOrderId
          if (couponCode) order.couponCode = couponCode
          await orderRepo.save(order)
        })
      } catch (cause) {
        await this.log(user, item.storeId, 'ACTIVITY_CONFIRM', item.id, `CONFIRM:${item.activityId}`, 'FAIL', cause instanceof Error ? cause.message : String(cause))
      }
    }
  }

  private async findStore(id: number, user: JwtUser): Promise<ShopStoreEntity> {
    const entity = await this.storeRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('店铺不存在')
    return entity
  }

  private async log(user: JwtUser, storeId: number, bizType: string, bizId: number, key: string | null, result: string, error?: string | null): Promise<ShopSyncLogEntity> {
    return this.logRepo.save(this.logRepo.create({
      tenantId: user.tenantId,
      storeId,
      bizType,
      bizId,
      idempotentKey: key,
      result,
      errorText: error ?? null
    }))
  }

  private num(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }
}
