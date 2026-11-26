import { randomBytes } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Like, Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { scopeWhere } from '../../common/data-scope-context'
import {
  buildTrackingTimeline,
  checkExceptionInput,
  checkExchangeAllowed,
  checkWaveShippable,
  exceptionSeverity,
  type TrackingTimelineNode
} from '../../common/sales-delivery-engine'
import { AuditService } from '../audit/audit.service'
import { InventoryService } from '../inventory/inventory.service'
import { ProductEntity } from '../master-data/entities/product.entity'
import {
  CreateShipmentExceptionDto,
  CreateTrackingNodeDto,
  ExchangeReturnDto,
  HandleShipmentExceptionDto,
  LinkWaveDto,
  QuerySalesDto
} from './dto'
import {
  SaleReturnEntity,
  SaleReturnLineEntity,
  ShipmentEntity,
  ShipmentLineEntity
} from './entities/sales.entities'
import {
  SaleReturnExchangeEntity,
  ShipmentExceptionEntity,
  ShipmentTrackingNodeEntity
} from './entities/sales-delivery.entities'
import { SalesService } from './sales.service'

/**
 * 销售交付扩展服务（出货域）：
 * - 出货单拣货波次联动（复核后才可发货）
 * - 出货物流轨迹节点与时间轴
 * - 出货异常回单（必填凭证，异常可一键转售后退货）
 * - 销售退货换货（生成换货销售单与换货出库单）
 */
@Injectable()
export class SalesDeliveryService {
  constructor(
    @InjectRepository(ShipmentEntity) private readonly shipmentRepo: Repository<ShipmentEntity>,
    @InjectRepository(ShipmentLineEntity) private readonly shipmentLineRepo: Repository<ShipmentLineEntity>,
    @InjectRepository(SaleReturnEntity) private readonly returnRepo: Repository<SaleReturnEntity>,
    @InjectRepository(SaleReturnLineEntity) private readonly returnLineRepo: Repository<SaleReturnLineEntity>,
    @InjectRepository(ShipmentTrackingNodeEntity) private readonly trackingRepo: Repository<ShipmentTrackingNodeEntity>,
    @InjectRepository(ShipmentExceptionEntity) private readonly exceptionRepo: Repository<ShipmentExceptionEntity>,
    @InjectRepository(SaleReturnExchangeEntity) private readonly exchangeRepo: Repository<SaleReturnExchangeEntity>,
    @InjectRepository(ProductEntity) private readonly productRepo: Repository<ProductEntity>,
    private readonly auditService: AuditService,
    private readonly inventoryService: InventoryService,
    private readonly salesService: SalesService
  ) {}

  /* ------------------------------ 拣货波次 ------------------------------ */

  /** 可关联的拣货波次：附带拣货进度、复核状态与是否允许发货 */
  async listShippableWaves(user: JwtUser): Promise<Array<{
    id: number
    waveNo: string
    status: string
    priority: number
    totalTasks: number
    pickedTasks: number
    shippable: boolean
    reason: string
  }>> {
    const waves = await this.inventoryService.listWaveStates(user)
    return waves.map((wave) => ({
      id: wave.id,
      waveNo: wave.waveNo,
      status: wave.status,
      priority: wave.priority,
      totalTasks: wave.totalTasks,
      pickedTasks: wave.pickedTasks,
      shippable: wave.shippable,
      reason: wave.reason
    }))
  }

  /** 出货单关联拣货波次：波次未复核不允许关联 */
  async linkShipmentWave(shipmentId: number, dto: LinkWaveDto, user: JwtUser): Promise<ShipmentEntity> {
    const shipment = await this.findShipment(shipmentId, user)
    const { wave, tasks } = await this.inventoryService.waveDetail(dto.waveId, user)
    const check = checkWaveShippable({
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
    if (!check.allowed) throw new BadRequestException(check.reason)
    shipment.waveId = wave.id
    const saved = await this.shipmentRepo.save(shipment)
    await this.auditService.record({ bizType: 'shipment', bizId: saved.id, action: 'LINK_PICK_WAVE', afterValue: { waveId: wave.id, waveNo: wave.waveNo } }, user)
    return saved
  }

  /* ------------------------------ 物流轨迹 ------------------------------ */

  /** 出货物流轨迹时间轴 */
  async shipmentTimeline(shipmentId: number, user: JwtUser): Promise<TrackingTimelineNode[]> {
    await this.findShipment(shipmentId, user)
    const nodes = await this.trackingRepo.find({ where: { tenantId: user.tenantId, shipmentId }, order: { id: 'ASC' } })
    return buildTrackingTimeline(nodes.map((node) => ({
      nodeCode: node.nodeCode,
      nodeName: node.nodeName,
      nodeTime: new Date(node.nodeTime).toISOString(),
      location: node.location,
      operator: node.operator,
      source: node.source,
      remark: node.remark
    })))
  }

  /** 登记物流轨迹节点；签收节点自动回写出货单签收信息 */
  async addTrackingNode(shipmentId: number, dto: CreateTrackingNodeDto, user: JwtUser): Promise<ShipmentTrackingNodeEntity> {
    const shipment = await this.findShipment(shipmentId, user)
    const node = await this.trackingRepo.save(this.trackingRepo.create({
      tenantId: user.tenantId,
      shipmentId,
      nodeCode: dto.nodeCode,
      nodeName: dto.nodeName,
      nodeTime: dto.nodeTime ? new Date(dto.nodeTime) : new Date(),
      location: dto.location ?? null,
      operator: dto.operator ?? user.username ?? String(user.userId),
      source: dto.source ?? 'MANUAL',
      remark: dto.remark ?? null,
      createdBy: user.userId
    }))
    if (dto.nodeCode === 'DELIVERED' && !shipment.signedAt) {
      shipment.signedAt = new Date()
      shipment.signedBy = dto.operator ?? user.username ?? String(user.userId)
      await this.shipmentRepo.save(shipment)
    }
    await this.auditService.record({ bizType: 'shipment', bizId: shipmentId, action: 'ADD_TRACKING_NODE', afterValue: node }, user)
    return node
  }

  /* ------------------------------ 异常回单 ------------------------------ */

  /** 出货异常列表 */
  async listExceptions(query: QuerySalesDto, user: JwtUser): Promise<PageResult<ShipmentExceptionEntity>> {
    const where = scopeWhere<ShipmentExceptionEntity>({
      tenantId: user.tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { description: Like(`%${query.keyword}%`) } : {})
    }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.exceptionRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 登记出货异常回单：必填描述与凭证照片，严重度自动判定 */
  async registerException(shipmentId: number, dto: CreateShipmentExceptionDto, user: JwtUser): Promise<ShipmentExceptionEntity> {
    const shipment = await this.findShipment(shipmentId, user)
    const check = checkExceptionInput({ type: dto.exceptionType, description: dto.description, evidenceUrls: dto.evidenceUrls })
    if (!check.allowed) throw new BadRequestException(check.reason)
    const exception = await this.exceptionRepo.save(this.exceptionRepo.create({
      tenantId: user.tenantId,
      shipmentId,
      orderId: shipment.orderId,
      exceptionType: dto.exceptionType,
      severity: exceptionSeverity(dto.exceptionType),
      description: dto.description,
      evidence: dto.evidenceUrls,
      status: 'PENDING',
      createdBy: user.userId
    }))
    shipment.exceptionFlag = 'HAS_EXCEPTION'
    await this.shipmentRepo.save(shipment)
    await this.trackingRepo.save(this.trackingRepo.create({
      tenantId: user.tenantId,
      shipmentId,
      nodeCode: 'EXCEPTION',
      nodeName: `异常回单：${dto.exceptionType}`,
      nodeTime: new Date(),
      operator: user.username ?? String(user.userId),
      source: 'MANUAL',
      remark: dto.description,
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'shipment_exception', bizId: exception.id, action: 'REGISTER_EXCEPTION', afterValue: exception }, user)
    return exception
  }

  /** 处理出货异常：可一键转为售后退货单 */
  async handleException(id: number, dto: HandleShipmentExceptionDto, user: JwtUser): Promise<{
    exception: ShipmentExceptionEntity
    returnId: number | null
  }> {
    const exception = await this.exceptionRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!exception) throw new NotFoundException('异常回单不存在')
    if (exception.status === 'DONE') throw new BadRequestException('该异常已处理完成')
    let returnId: number | null = exception.returnId
    if (dto.createReturn) {
      if (returnId) throw new BadRequestException('该异常已生成售后退货单')
      const shipment = await this.findShipment(exception.shipmentId, user)
      const lines = await this.shipmentLineRepo.find({ where: { tenantId: user.tenantId, shipmentId: shipment.id } })
      if (lines.length === 0) throw new BadRequestException('出货单无明细，无法生成售后退货单')
      const ret = await this.returnRepo.save(this.returnRepo.create({
        tenantId: user.tenantId,
        returnNo: this.number('SR'),
        customerId: shipment.customerId,
        orderId: shipment.orderId,
        reason: `出货异常转售后：${exception.description}`,
        refundAmount: '0.0000',
        returnType: 'REFUND',
        createdBy: user.userId
      }))
      for (const line of lines) {
        await this.returnLineRepo.save(this.returnLineRepo.create({
          tenantId: user.tenantId,
          returnId: ret.id,
          productId: line.productId,
          qty: line.qty,
          amount: '0.0000',
          disposal: 'RESTOCK',
          qcStatus: 'PENDING'
        }))
      }
      returnId = ret.id
      exception.returnId = ret.id
    }
    exception.status = dto.status
    exception.handleRemark = dto.handleRemark ?? null
    exception.handledBy = user.userId
    exception.handledAt = new Date()
    const saved = await this.exceptionRepo.save(exception)
    await this.auditService.record({ bizType: 'shipment_exception', bizId: saved.id, action: 'HANDLE_EXCEPTION', afterValue: { status: dto.status, returnId } }, user)
    return { exception: saved, returnId }
  }

  /* ------------------------------ 退货换货 ------------------------------ */

  /** 退货单详情：含明细行与换货记录，供换货操作选择明细行 */
  async getReturnDetail(returnId: number, user: JwtUser): Promise<{
    ret: SaleReturnEntity
    lines: SaleReturnLineEntity[]
    exchanges: SaleReturnExchangeEntity[]
  }> {
    const ret = await this.returnRepo.findOne({ where: { id: returnId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!ret) throw new NotFoundException('退货单不存在')
    const lines = await this.returnLineRepo.find({ where: { returnId, tenantId: user.tenantId }, order: { id: 'ASC' } })
    const exchanges = await this.exchangeRepo.find({ where: { returnId, tenantId: user.tenantId }, order: { id: 'ASC' } })
    return { ret, lines, exchanges }
  }

  /** 换货记录查询 */
  async listExchanges(returnId: number, user: JwtUser): Promise<SaleReturnExchangeEntity[]> {
    const ret = await this.returnRepo.findOne({ where: { id: returnId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!ret) throw new NotFoundException('退货单不存在')
    return this.exchangeRepo.find({ where: { returnId, tenantId: user.tenantId }, order: { id: 'ASC' } })
  }

  /** 退货换货：生成换货销售单与换货出库单，并保留换货链路 */
  async exchangeReturn(returnId: number, dto: ExchangeReturnDto, user: JwtUser): Promise<{
    exchange: SaleReturnExchangeEntity
    orderId: number
    shipmentId: number
  }> {
    const ret = await this.returnRepo.findOne({ where: { id: returnId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!ret) throw new NotFoundException('退货单不存在')
    const line = await this.returnLineRepo.findOne({ where: { id: dto.lineId, returnId, tenantId: user.tenantId } })
    if (!line) throw new NotFoundException('退货明细不存在')
    const check = checkExchangeAllowed({
      returnStatus: ret.status,
      approved: ret.status === 'APPROVED' || ret.status === 'DONE',
      qcPassed: line.qcStatus === 'PASS',
      returnQty: this.num(line.qty),
      exchangeQty: this.num(dto.qty)
    })
    if (!check.allowed) throw new BadRequestException(check.reason)

    const product = await this.productRepo.findOne({ where: { id: dto.exchangeProductId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!product) throw new NotFoundException('换货商品不存在')
    if (product.isActive !== 1) throw new BadRequestException(`换货商品已停用：${product.productName}`)

    const unitPrice = dto.exchangeUnitPrice ?? product.price ?? '0'
    const order = await this.salesService.createOrder({
      customerId: ret.customerId,
      orderDate: this.today(),
      sourceType: 'EXCHANGE',
      lines: [{ productId: dto.exchangeProductId, variantId: dto.exchangeVariantId, qty: dto.qty, unitPrice }],
      remark: `换货出库，来源退货单 ${ret.returnNo}`
    }, user)

    const shipment = await this.shipmentRepo.save(this.shipmentRepo.create({
      tenantId: user.tenantId,
      shipmentNo: this.number('SH'),
      orderId: order.id,
      customerId: ret.customerId,
      status: 'DRAFT',
      createdBy: user.userId
    }))
    await this.shipmentLineRepo.save(this.shipmentLineRepo.create({
      tenantId: user.tenantId,
      shipmentId: shipment.id,
      orderLineId: 0,
      productId: dto.exchangeProductId,
      variantId: dto.exchangeVariantId ?? null,
      qty: dto.qty,
      batchNo: null
    }))

    ret.returnType = 'EXCHANGE'
    await this.returnRepo.save(ret)

    const exchange = await this.exchangeRepo.save(this.exchangeRepo.create({
      tenantId: user.tenantId,
      returnId: ret.id,
      exchangeOrderId: order.id,
      exchangeShipmentId: shipment.id,
      exchangeQty: dto.qty,
      exchangeStatus: 'CREATED',
      remark: dto.remark ?? null,
      createdBy: user.userId
    }))
    await this.auditService.record({
      bizType: 'sale_return',
      bizId: ret.id,
      action: 'EXCHANGE_RETURN',
      afterValue: { orderId: order.id, shipmentId: shipment.id, qty: dto.qty }
    }, user)
    return { exchange, orderId: order.id, shipmentId: shipment.id }
  }

  /* ------------------------------ 内部方法 ------------------------------ */

  private async findShipment(id: number, user: JwtUser): Promise<ShipmentEntity> {
    const shipment = await this.shipmentRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!shipment) throw new NotFoundException('出货单不存在')
    return shipment
  }

  private num(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10)
  }

  private number(prefix: string): string {
    const suffix = `${Date.now().toString(36)}${randomBytes(2).toString('hex')}`.toUpperCase()
    return `${prefix}${suffix}`
  }
}
