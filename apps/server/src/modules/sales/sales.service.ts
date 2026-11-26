import { randomBytes } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Between, Like, Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { scopeWhere } from '../../common/data-scope-context'
import { checkFloorPrice, resolveAgreementPrice } from '../../common/pricing-engine'
import { checkSplitSelection, checkSubstituteCategory } from '../../common/sales-pricing-rules'
import { canTransition } from '../../common/state-machine'
import { assertBizEditable } from '../../common/approval-guard'
import {
  buildCollectionPlan, collectionLetter, smartWriteoffSuggestion
} from '../../common/business-extension-engine'
import {
  buildCustomerProfile360, buildRedInvoice, checkCustomerMerge, checkQuotationValidity, checkStatementReverse,
  churnRisk, isDuplicateLead, isIdempotent, opportunityGate, posMemberPrice,
  posPaymentSplit, quotationVersionDiff, salesTargetAlert, scoreLead, targetProgress
} from '../../common/sales-extension-engine'
import { AiDraftApplierRegistry } from '../ai/ai-draft-applier'
import { AuditService } from '../audit/audit.service'
import { RevisionService } from '../revision/revision.service'
import { CollaborationService } from '../collaboration/collaboration.service'
import { FlowBizCallbackRegistry } from '../collaboration/flow-biz-callback'
import { createDomainEvent, DomainEventBus } from '../events/domain-event.module'
import { FinanceIntegrationService } from '../finance/finance-integration.service'
import { InventoryService } from '../inventory/inventory.service'
import { CustomerEntity } from '../master-data/entities/customer.entity'
import { ProductEntity } from '../master-data/entities/product.entity'
import { WarehouseEntity } from '../master-data/entities/warehouse.entity'
import {
  CreateContractDto,
  CreateFollowDto,
  CreateSaleClauseDto,
  RenewContractDto,
  SignContractDto,
  CreateLeadDto,
  CreateOpportunityDto,
  CreatePriceAgreementDto,
  CreateQuotationDto,
  CreateSaleOrderDto,
  CreateSaleReturnDto,
  CreateShipmentDto,
  CreateStatementDto,
  SplitSaleOrderDto,
  SignShipmentDto,
  CreateTargetDto,
  AdvanceOpportunityDto, ApproveMergeDto, ApproveQuotationDto, ApproveReturnDto,
  CreateCustomerMergeDto, HangPosOrderDto, PosOrderDto,
  CompareQuotationVersionDto,
  CreateCustomerContactDto,
  CreateMemberPriceDto,
  CreateRedInvoiceDto,
  HandleChurnWarningDto,
  PosPaymentDto,
  QuerySalesDto,
  QueryFollowTimelineDto,
  ReturnQcDto,
  ReverseStatementDto,
  SettleStatementDto,
  UpdateContractDto,
  UpdateLeadDto,
  UpdateOpportunityDto,
  UpdateQuotationDto,
  UpdateSaleOrderDto,
  UpdateSaleReturnDto,
  UpdateShipmentDto
} from './dto'
import { nextDayText, resolveRenewPeriod, resolveRenewTitle, shiftMonthsText } from './sales-contract-engine'
import { SalesCounterService } from './sales-counter.service'
import { checkWaveShippable } from '../../common/sales-delivery-engine'
import {
  CustomerMergeRequestEntity,
  CustomerStatementEntity,
  CrmChurnWarningEntity,
  CrmCustomerContactEntity,
  CrmQuotationVersionEntity,
  FollowEntity,
  LeadEntity,
  OpportunityEntity,
  PosHangOrderEntity,
  PosMemberPriceEntity,
  PosPaymentRecordEntity,
  SaleRedInvoiceEntity,
  QuotationEntity,
  QuotationLineEntity,
  SaleContractEntity,
  SaleClauseEntity,
  SaleOrderEntity,
  SaleOrderLineEntity,
  SalePriceAgreementEntity,
  SaleReturnEntity,
  SaleReturnLineEntity,
  SaleTargetEntity,
  ShipmentEntity,
  ShipmentLineEntity
} from './entities/sales.entities'

@Injectable()
export class SalesService implements OnModuleInit {
  constructor(
    @InjectRepository(LeadEntity) private readonly leadRepo: Repository<LeadEntity>,
    @InjectRepository(OpportunityEntity) private readonly opportunityRepo: Repository<OpportunityEntity>,
    @InjectRepository(FollowEntity) private readonly followRepo: Repository<FollowEntity>,
    @InjectRepository(QuotationEntity) private readonly quotationRepo: Repository<QuotationEntity>,
    @InjectRepository(QuotationLineEntity) private readonly quotationLineRepo: Repository<QuotationLineEntity>,
    @InjectRepository(SaleContractEntity) private readonly contractRepo: Repository<SaleContractEntity>,
    @InjectRepository(SaleOrderEntity) private readonly orderRepo: Repository<SaleOrderEntity>,
    @InjectRepository(SaleOrderLineEntity) private readonly orderLineRepo: Repository<SaleOrderLineEntity>,
    @InjectRepository(CustomerStatementEntity) private readonly statementRepo: Repository<CustomerStatementEntity>,
    @InjectRepository(ShipmentEntity) private readonly shipmentRepo: Repository<ShipmentEntity>,
    @InjectRepository(ShipmentLineEntity) private readonly shipmentLineRepo: Repository<ShipmentLineEntity>,
    @InjectRepository(SaleReturnEntity) private readonly returnRepo: Repository<SaleReturnEntity>,
    @InjectRepository(SaleReturnLineEntity) private readonly returnLineRepo: Repository<SaleReturnLineEntity>,
    @InjectRepository(SalePriceAgreementEntity) private readonly agreementRepo: Repository<SalePriceAgreementEntity>,
    @InjectRepository(SaleTargetEntity) private readonly targetRepo: Repository<SaleTargetEntity>,
    @InjectRepository(CustomerMergeRequestEntity) private readonly mergeRepo: Repository<CustomerMergeRequestEntity>,
    @InjectRepository(PosHangOrderEntity) private readonly hangRepo: Repository<PosHangOrderEntity>,
    @InjectRepository(CrmCustomerContactEntity) private readonly contactRepo: Repository<CrmCustomerContactEntity>,
    @InjectRepository(CrmChurnWarningEntity) private readonly churnRepo: Repository<CrmChurnWarningEntity>,
    @InjectRepository(CrmQuotationVersionEntity) private readonly quotationVersionRepo: Repository<CrmQuotationVersionEntity>,
    @InjectRepository(PosMemberPriceEntity) private readonly memberPriceRepo: Repository<PosMemberPriceEntity>,
    @InjectRepository(PosPaymentRecordEntity) private readonly paymentRepo: Repository<PosPaymentRecordEntity>,
    @InjectRepository(SaleRedInvoiceEntity) private readonly redInvoiceRepo: Repository<SaleRedInvoiceEntity>,
    @InjectRepository(CustomerEntity) private readonly customerRepo: Repository<CustomerEntity>,
    @InjectRepository(ProductEntity) private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(WarehouseEntity) private readonly warehouseRepo: Repository<WarehouseEntity>,
    private readonly auditService: AuditService,
    private readonly inventoryService: InventoryService,
    private readonly financeIntegrationService: FinanceIntegrationService,
    private readonly eventBus: DomainEventBus,
    private readonly draftRegistry: AiDraftApplierRegistry,
    private readonly collaborationService: CollaborationService,
    private readonly flowCallbackRegistry: FlowBizCallbackRegistry,
    @InjectRepository(SaleClauseEntity) private readonly clauseRepo: Repository<SaleClauseEntity>,
    private readonly counterService: SalesCounterService,
    private readonly revisionService: RevisionService
  ) {}

  onModuleInit(): void {
    this.draftRegistry.register({
      targetType: 'SALE_ORDER',
      requiredPerm: 'sales:order:create',
      apply: async ({ draft, user, auditId }) => {
        const customerName = String(draft.customerName ?? '').trim()
        const customer = await this.customerRepo.findOne({
          where: { tenantId: user.tenantId, isDeleted: 0, customerName: Like(`%${customerName}%`) }
        })
        if (!customer) throw new BadRequestException(`未找到客户：${customerName}，请先建档`)

        const rawLines = Array.isArray(draft.lines) ? draft.lines : []
        if (rawLines.length === 0) throw new BadRequestException('草稿未包含明细行')
        const lines: Array<{ productId: number; qty: string; unitPrice: string }> = []
        for (const raw of rawLines) {
          const row = raw as Record<string, unknown>
          const productName = String(row.productName ?? '').trim()
          const product = await this.productRepo.findOne({
            where: { tenantId: user.tenantId, isDeleted: 0, productName: Like(`%${productName}%`) }
          })
          if (!product) throw new BadRequestException(`未找到产品：${productName}，请先建档`)
          const qty = Number(row.qty ?? 0)
          const unitPrice = Number(row.unitPrice ?? 0)
          if (!(qty > 0) || !(unitPrice > 0)) {
            throw new BadRequestException(`产品 ${productName} 的数量或单价无效`)
          }
          lines.push({ productId: product.id, qty: String(qty), unitPrice: String(unitPrice) })
        }

        const order = await this.createOrder({
          customerId: customer.id,
          warehouseId: draft.warehouseId ? Number(draft.warehouseId) : undefined,
          orderDate: typeof draft.orderDate === 'string' && draft.orderDate
            ? draft.orderDate
            : new Date().toISOString().slice(0, 10),
          sourceType: 'AI_DRAFT',
          remark: `AI 草稿写回（审计 ${auditId}）${draft.remark ? `：${String(draft.remark)}` : ''}`,
          lines
        }, user)
        return { bizType: 'sale_order', bizId: order.id, bizNo: order.orderNo }
      }
    })

    this.flowCallbackRegistry.register({
      bizType: 'sale_order',
      onApproved: async ({ bizId, user, comment }) => {
        await this.doApproveOrder(bizId, user, comment)
      },
      onRejected: async ({ bizId, user }) => {
        const order = await this.orderRepo.findOne({ where: { id: bizId, tenantId: user.tenantId } })
        if (!order || order.status !== 'SUBMITTED') return
        if (!canTransition('sale_order', order.status, 'CANCELLED')) return
        order.status = 'CANCELLED'
        await this.orderRepo.save(order)
        if (typeof (this.inventoryService as { unlockStock?: unknown }).unlockStock === 'function') await this.releaseStockForOrder(bizId, user)
        await this.auditService.record({ bizType: 'sale_order', bizId, action: 'FLOW_REJECTED', afterValue: { status: 'CANCELLED' } }, user)
      }
    })
  }

  async listLeads(query: QuerySalesDto, user: JwtUser): Promise<PageResult<LeadEntity>> {
    const where = scopeWhere<LeadEntity>({
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { name: Like(`%${query.keyword}%`) } : {})
    }, user, { ownerField: 'ownerUserId' })
    const [list, total] = await this.leadRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createLead(dto: CreateLeadDto, user: JwtUser): Promise<LeadEntity> {
    const entity = this.leadRepo.create({
      ...dto,
      tenantId: user.tenantId,
      leadNo: this.number('LD'),
      phone: dto.phone ?? null,
      source: dto.source ?? null,
      score: dto.score ?? 0,
      ownerUserId: dto.ownerUserId ?? user.userId,
      createdBy: user.userId
    })
    const saved = await this.leadRepo.save(entity)
    await this.auditService.record({ bizType: 'lead', bizId: saved.id, action: 'CREATE_LEAD', afterValue: saved }, user)
    return saved
  }

  async updateLead(id: number, dto: UpdateLeadDto, user: JwtUser): Promise<LeadEntity> {
    const entity = await this.findLead(id, user)
    const before = { ...entity }
    Object.assign(entity, dto)
    entity.updatedAt = new Date()
    const saved = await this.leadRepo.save(entity)
    await this.auditService.record({ bizType: 'lead', bizId: id, action: 'UPDATE_LEAD', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  async convertLead(id: number, user: JwtUser): Promise<LeadEntity> {
    const lead = await this.findLead(id, user)
    if (lead.status === 'CONVERTED') return lead
    let customerId = lead.customerId
    if (!customerId) {
      const customer = await this.customerRepo.save(this.customerRepo.create({
        tenantId: user.tenantId,
        customerCode: this.number('C'),
        customerName: lead.name,
        creditLimit: '0',
        createdBy: user.userId
      }))
      customerId = customer.id
    }
    lead.customerId = customerId
    lead.status = 'CONVERTED'
    lead.updatedAt = new Date()
    const saved = await this.leadRepo.save(lead)
    await this.auditService.record({ bizType: 'lead', bizId: id, action: 'CONVERT_LEAD', afterValue: { customerId } }, user)
    return saved
  }

  async listOpportunities(query: QuerySalesDto, user: JwtUser): Promise<PageResult<OpportunityEntity>> {
    const where = scopeWhere<OpportunityEntity>({
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.status ? { stage: query.status } : {}),
      ...(query.keyword ? { title: Like(`%${query.keyword}%`) } : {})
    }, user, { ownerField: 'ownerUserId' })
    const [list, total] = await this.opportunityRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createOpportunity(dto: CreateOpportunityDto, user: JwtUser): Promise<OpportunityEntity> {
    const entity = this.opportunityRepo.create({
      ...dto,
      tenantId: user.tenantId,
      oppNo: this.number('OP'),
      expectedAmount: dto.expectedAmount ?? '0',
      winRate: dto.winRate ?? 10,
      ownerUserId: dto.ownerUserId ?? user.userId,
      closeDate: dto.closeDate ?? null,
      createdBy: user.userId
    })
    const saved = await this.opportunityRepo.save(entity)
    await this.auditService.record({ bizType: 'opportunity', bizId: saved.id, action: 'CREATE_OPPORTUNITY', afterValue: saved }, user)
    return saved
  }

  async updateOpportunity(id: number, dto: UpdateOpportunityDto, user: JwtUser): Promise<OpportunityEntity> {
    const entity = await this.findOpportunity(id, user)
    const before = { ...entity }
    Object.assign(entity, dto)
    entity.updatedAt = new Date()
    const saved = await this.opportunityRepo.save(entity)
    await this.auditService.record({ bizType: 'opportunity', bizId: id, action: 'UPDATE_OPPORTUNITY', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  async createFollow(dto: CreateFollowDto, user: JwtUser): Promise<FollowEntity> {
    const entity = this.followRepo.create({
      ...dto,
      tenantId: user.tenantId,
      followType: dto.followType ?? 'NOTE',
      nextTime: dto.nextTime ? new Date(dto.nextTime) : null,
      createdBy: user.userId
    })
    return this.followRepo.save(entity)
  }

  async listFollows(bizType: string, bizId: number, user: JwtUser): Promise<FollowEntity[]> {
    return this.followRepo.find({ where: { tenantId: user.tenantId, bizType, bizId }, order: { createdAt: 'DESC' } })
  }

  /** 跟进流水：跨线索 / 商机 / 客户汇总的跟进记录流水 */
  async listFollowTimeline(query: QueryFollowTimelineDto, user: JwtUser): Promise<PageResult<FollowEntity>> {
    const where = scopeWhere<FollowEntity>({
      tenantId: user.tenantId,
      ...(query.bizType ? { bizType: query.bizType } : {}),
      ...(query.bizId ? { bizId: query.bizId } : {}),
      ...(query.followType ? { followType: query.followType } : {}),
      ...(query.keyword ? { content: Like(`%${query.keyword}%`) } : {}),
      ...(query.startDate || query.endDate
        ? {
          createdAt: Between(
            query.startDate ? new Date(`${query.startDate} 00:00:00`) : new Date('1970-01-01'),
            query.endDate ? new Date(`${query.endDate} 23:59:59`) : new Date('2999-12-31')
          )
        }
        : {})
    }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.followRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async listQuotations(query: QuerySalesDto, user: JwtUser): Promise<PageResult<QuotationEntity>> {
    const where = scopeWhere<QuotationEntity>({
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { quoteNo: Like(`%${query.keyword}%`) } : {})
    }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.quotationRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async quotationDetail(id: number, user: JwtUser): Promise<{ quotation: QuotationEntity; lines: QuotationLineEntity[] }> {
    const quotation = await this.findQuotation(id, user)
    const lines = await this.quotationLineRepo.find({ where: { tenantId: user.tenantId, quotationId: id }, order: { id: 'ASC' } })
    return { quotation, lines }
  }

  async createQuotation(dto: CreateQuotationDto, user: JwtUser): Promise<QuotationEntity> {
    const total = dto.lines.reduce((sum, line) => sum + this.num(line.qty) * this.num(line.unitPrice), 0)
    const quotation = await this.quotationRepo.save(this.quotationRepo.create({
      tenantId: user.tenantId,
      quoteNo: this.number('QT'),
      customerId: dto.customerId,
      quoteDate: dto.quoteDate,
      expireDate: dto.expireDate ?? null,
      totalAmount: this.money(total),
      remark: dto.remark ?? null,
      createdBy: user.userId
    }))
    for (const line of dto.lines) {
      await this.quotationLineRepo.save(this.quotationLineRepo.create({
        tenantId: user.tenantId,
        quotationId: quotation.id,
        productId: line.productId,
        qty: line.qty,
        unitPrice: line.unitPrice,
        amount: this.money(this.num(line.qty) * this.num(line.unitPrice))
      }))
    }
    await this.auditService.record({ bizType: 'quotation', bizId: quotation.id, action: 'CREATE_QUOTATION', afterValue: quotation }, user)
    return quotation
  }

  async updateQuotation(id: number, dto: UpdateQuotationDto, user: JwtUser): Promise<QuotationEntity> {
    const entity = await this.findQuotation(id, user)
    const before = { ...entity }
    Object.assign(entity, dto)
    entity.updatedAt = new Date()
    const saved = await this.quotationRepo.save(entity)
    await this.auditService.record({ bizType: 'quotation', bizId: id, action: 'UPDATE_QUOTATION', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  /** 续签起始日：原合同到期次日 */
  private nextDay(endDate: Date | string): string {
    return nextDayText(endDate)
  }

  /** 按月数平移日期 */
  private shiftDate(endDate: Date | string, months: number): string {
    return shiftMonthsText(endDate, months)
  }

  /** 条款库列表 */
  async listClauses(query: QuerySalesDto, user: JwtUser): Promise<PageResult<SaleClauseEntity>> {
    const where = {
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { clauseTitle: Like(`%${query.keyword}%`) } : {})
    }
    const [list, total] = await this.clauseRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 保存条款（新增或更新） */
  async saveClause(dto: CreateSaleClauseDto, id: number | null, user: JwtUser): Promise<SaleClauseEntity> {
    if (id) {
      const entity = await this.clauseRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
      if (!entity) throw new NotFoundException('条款不存在')
      entity.clauseCode = dto.clauseCode
      entity.clauseTitle = dto.clauseTitle
      entity.clauseContent = dto.clauseContent ?? null
      entity.category = dto.category ?? null
      entity.status = dto.status ?? entity.status
      entity.updatedAt = new Date()
      const saved = await this.clauseRepo.save(entity)
      await this.auditService.record({ bizType: 'sale_clause', bizId: saved.id, action: 'UPDATE_CLAUSE', afterValue: saved }, user)
      return saved
    }
    const duplicate = await this.clauseRepo.findOne({ where: { tenantId: user.tenantId, clauseCode: dto.clauseCode, isDeleted: 0 } })
    if (duplicate) throw new BadRequestException('条款编码已存在')
    const saved = await this.clauseRepo.save(this.clauseRepo.create({
      tenantId: user.tenantId,
      clauseCode: dto.clauseCode,
      clauseTitle: dto.clauseTitle,
      clauseContent: dto.clauseContent ?? null,
      category: dto.category ?? null,
      isSystem: 0,
      status: dto.status ?? 'ACTIVE',
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'sale_clause', bizId: saved.id, action: 'CREATE_CLAUSE', afterValue: saved }, user)
    return saved
  }

  /** 合同续签：继承原合同条款与金额生成新合同，原合同置为已续签 */
  async renewContract(id: number, dto: RenewContractDto, user: JwtUser): Promise<SaleContractEntity> {
    const source = await this.findContract(id, user)
    if (source.status === 'RENEWED') throw new BadRequestException('该合同已续签')
    const startDate = dto.startDate ?? (source.endDate ? this.nextDay(source.endDate) : null)
    const endDate = dto.endDate ?? (source.endDate ? this.shiftDate(source.endDate, dto.termMonths ?? 12) : null)
    const period = resolveRenewPeriod(source.endDate, dto.termMonths ?? 12, startDate, endDate)
    const renewed = await this.contractRepo.save(this.contractRepo.create({
      tenantId: user.tenantId,
      contractNo: this.number('CT'),
      title: resolveRenewTitle(source.title, dto.title),
      customerId: source.customerId,
      clauseIds: source.clauseIds,
      startDate: period.startDate,
      endDate: period.endDate,
      totalAmount: dto.totalAmount ?? source.totalAmount,
      status: 'ACTIVE',
      version: 1,
      renewedFromId: source.id,
      renewCount: source.renewCount + 1,
      createdBy: user.userId
    }))
    source.status = 'RENEWED'
    source.renewedFromId = renewed.id
    await this.contractRepo.save(source)
    await this.auditService.record({ bizType: 'sale_contract', bizId: renewed.id, action: 'RENEW_CONTRACT', afterValue: { sourceId: source.id, renewedId: renewed.id } }, user)
    return renewed
  }

  /** 合同电子签署登记 */
  async signContract(id: number, dto: SignContractDto, user: JwtUser): Promise<SaleContractEntity> {
    const entity = await this.findContract(id, user)
    entity.esignNo = dto.esignNo
    entity.signedAt = new Date()
    entity.status = 'SIGNED'
    const saved = await this.contractRepo.save(entity)
    await this.auditService.record({ bizType: 'sale_contract', bizId: id, action: 'SIGN_CONTRACT', afterValue: { esignNo: dto.esignNo } }, user)
    return saved
  }

  /** 即将到期合同提醒（30 天内到期） */
  async listExpiringContracts(user: JwtUser, days = 30): Promise<SaleContractEntity[]> {
    const contracts = await this.contractRepo.find({ where: { tenantId: user.tenantId, status: 'ACTIVE', isDeleted: 0 } })
    const deadline = new Date()
    deadline.setDate(deadline.getDate() + days)
    return contracts.filter((item) => item.endDate && new Date(item.endDate) <= deadline)
  }

  async listContracts(query: QuerySalesDto, user: JwtUser): Promise<PageResult<SaleContractEntity>> {
    const where = scopeWhere<SaleContractEntity>({
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { title: Like(`%${query.keyword}%`) } : {})
    }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.contractRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createContract(dto: CreateContractDto, user: JwtUser): Promise<SaleContractEntity> {
    const entity = this.contractRepo.create({
      ...dto,
      tenantId: user.tenantId,
      contractNo: this.number('CT'),
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
      totalAmount: dto.totalAmount ?? '0',
      createdBy: user.userId
    })
    const saved = await this.contractRepo.save(entity)
    await this.auditService.record({ bizType: 'sale_contract', bizId: saved.id, action: 'CREATE_CONTRACT', afterValue: saved }, user)
    return saved
  }

  async updateContract(id: number, dto: UpdateContractDto, user: JwtUser): Promise<SaleContractEntity> {
    const entity = await this.findContract(id, user)
    const before = { ...entity }
    Object.assign(entity, dto)
    entity.updatedAt = new Date()
    const saved = await this.contractRepo.save(entity)
    await this.auditService.record({ bizType: 'sale_contract', bizId: id, action: 'UPDATE_CONTRACT', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  async listOrders(query: QuerySalesDto, user: JwtUser): Promise<PageResult<SaleOrderEntity>> {
    const where = scopeWhere<SaleOrderEntity>({
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { orderNo: Like(`%${query.keyword}%`) } : {})
    }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.orderRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async orderDetail(id: number, user: JwtUser): Promise<{ order: SaleOrderEntity; lines: SaleOrderLineEntity[] }> {
    const order = await this.findOrder(id, user)
    const lines = await this.orderLineRepo.find({ where: { tenantId: user.tenantId, orderId: id }, order: { id: 'ASC' } })
    return { order, lines }
  }

  /** 提交销售单时按明细预占可用库存（逐行锁定，任一行不足则整体失败） */
  private async reserveStockForOrder(orderId: number, user: JwtUser): Promise<void> {
    const lines = await this.orderLineRepo.find({ where: { tenantId: user.tenantId, orderId } })
    for (const line of lines) {
      await this.inventoryService.lockStock({
        sourceType: 'SALE_ORDER',
        sourceId: orderId,
        warehouseId: line.warehouseId ?? 0,
        productId: line.productId,
        variantId: line.variantId ?? 0,
        batchNo: '',
        qty: line.qty
      }, user)
    }
  }

  /** 释放销售单预占（出货、取消、驳回时调用） */
  private async releaseStockForOrder(orderId: number, user: JwtUser): Promise<void> {
    await this.inventoryService.unlockStock('SALE_ORDER', orderId, user)
  }

  async createOrder(dto: CreateSaleOrderDto, user: JwtUser): Promise<SaleOrderEntity> {
    const customer = await this.findCustomer(dto.customerId, user)
    if (customer.status !== 'ACTIVE') throw new BadRequestException('客户已停用')
    const warehouseId = await this.resolveWarehouseId(dto.warehouseId, user)
    const orderDate = dto.orderDate || new Date().toISOString().slice(0, 10)

    // 协议价优先：加载客户生效协议，开单时自动取价覆盖手填单价
    const agreementRows = await this.agreementRepo.find({
      where: { tenantId: user.tenantId, customerId: dto.customerId, isDeleted: 0 }
    })
    const agreements = Array.isArray(agreementRows) ? agreementRows : []
    const agreementInputs = agreements.map((a) => ({
      id: a.id,
      customerId: a.customerId,
      productId: a.productId ?? 0,
      categoryId: a.categoryId,
      price: a.price,
      effectiveFrom: a.startDate,
      effectiveTo: a.endDate,
      status: a.status
    }))
    const finalUnitPrice = new Map<number, string>()
    const belowFloor: Array<{ productName: string; unitPrice: string; floorPrice: string }> = []
    const canOverridePrice = user.isSuperAdmin || user.permissions.includes('sales:price:override')
    // 缺货替代：原产品ID → 实际出库产品ID
    const substituteMap = new Map<number, number>()
    const substituteItems: Array<{ originProductId: number; originProductName: string; substituteProductId: number; substituteProductName: string }> = []
    for (const line of dto.lines) {
      const substituteId = dto.substitutes ? Number(dto.substitutes[String(line.productId)] ?? 0) : 0
      const effectiveProductId = substituteId > 0 ? substituteId : line.productId
      const product = await this.findProduct(effectiveProductId, user)
      if (product.isActive !== 1) throw new BadRequestException(`产品已停用：${product.productName}`)
      if (substituteId > 0) {
        const origin = await this.findProduct(line.productId, user)
        const categoryError = checkSubstituteCategory(
          origin.productName,
          origin.categoryId,
          product.productName,
          product.categoryId
        )
        if (categoryError) throw new BadRequestException(categoryError)
        substituteMap.set(line.productId, effectiveProductId)
        substituteItems.push({ originProductId: origin.id, originProductName: origin.productName, substituteProductId: product.id, substituteProductName: product.productName })
      }
      const agreed = resolveAgreementPrice(
        agreementInputs,
        effectiveProductId,
        product.categoryId ?? null,
        this.num(line.qty),
        orderDate
      )
      const unitPrice = agreed ? String(agreed.unitPrice) : line.unitPrice
      finalUnitPrice.set(line.productId, unitPrice)
      // 底价校验：低于底价需具备价格权限，否则禁止提交
      const floorPrice = this.num(product.floorPrice ?? '0')
      const floorCheck = checkFloorPrice(this.num(unitPrice), floorPrice)
      if (!floorCheck.ok) {
        if (!canOverridePrice) {
          throw new BadRequestException(`产品「${product.productName}」单价 ${unitPrice} 低于底价 ${this.money(floorPrice)}，需价格权限或审批后下单`)
        }
        belowFloor.push({ productName: product.productName, unitPrice, floorPrice: this.money(floorPrice) })
      }
    }
    if (substituteItems.length) {
      await this.auditService.record({
        bizType: 'sale_order',
        bizId: 0,
        action: 'SUBSTITUTE_PRODUCT',
        afterValue: { items: substituteItems }
      }, user)
    }
    if (belowFloor.length) {
      await this.auditService.record({
        bizType: 'sale_order',
        bizId: 0,
        action: 'PRICE_OVERRIDE',
        afterValue: { items: belowFloor, operator: user.username ?? user.userId }
      }, user)
    }

    let total = 0
    for (const line of dto.lines) {
      const unitPrice = finalUnitPrice.get(line.productId) ?? line.unitPrice
      const discount = line.discount ? this.num(line.discount) : 0
      total += this.num(line.qty) * this.num(unitPrice) * (1 - discount / 100)
    }

    // 组合促销自动应用：套装 / 满减命中后按整单优惠金额扣减，并留存命中依据
    const promotionLines = dto.lines.map((line) => ({
      productId: substituteMap.get(line.productId) ?? line.productId,
      qty: this.num(line.qty),
      unitPrice: this.num(finalUnitPrice.get(line.productId) ?? line.unitPrice)
    }))
    const promotion = await this.counterService.resolveOrderPromotion(promotionLines, user)
    const promotionDiscount = Math.min(promotion.promotionDiscount, total)
    const payableTotal = Math.max(0, total - promotionDiscount)

    const order = await this.orderRepo.save(this.orderRepo.create({
      tenantId: user.tenantId,
      orderNo: this.number('SO'),
      customerId: dto.customerId,
      warehouseId,
      orderDate: dto.orderDate,
      sourceType: dto.sourceType ?? 'MANUAL',
      totalAmount: this.money(payableTotal),
      promotionCode: promotion.promotionCode,
      promotionDiscount: this.money(promotionDiscount),
      promotionDetail: promotion.detail,
      remark: dto.remark ?? null,
      createdBy: user.userId
    }))

    for (const line of dto.lines) {
      const unitPrice = finalUnitPrice.get(line.productId) ?? line.unitPrice
      const discount = line.discount ? this.num(line.discount) : 0
      const amount = this.num(line.qty) * this.num(unitPrice) * (1 - discount / 100)
      const effectiveProductId = substituteMap.get(line.productId) ?? line.productId
      const product = await this.findProduct(effectiveProductId, user)
      await this.orderLineRepo.save(this.orderLineRepo.create({
        tenantId: user.tenantId,
        orderId: order.id,
        productId: effectiveProductId,
        variantId: line.variantId ?? null,
        warehouseId: line.warehouseId ?? warehouseId,
        qty: line.qty,
        unitPrice,
        discount: line.discount ?? '0',
        amount: this.money(amount),
        cost: product.cost
      }))
    }
    await this.auditService.record({ bizType: 'sale_order', bizId: order.id, action: 'CREATE_ORDER', afterValue: order }, user)
    await this.eventBus.emit(createDomainEvent('sales.order.created', user, 'sale_order', order.id, { orderNo: order.orderNo, totalAmount: order.totalAmount }))
    return order
  }

  /**
   * 销售单拆单：按明细行拆出新单，原单保留剩余行；拆分批次号用于追溯同源单据。
   */
  async splitOrder(id: number, dto: SplitSaleOrderDto, user: JwtUser): Promise<{ source: SaleOrderEntity; created: SaleOrderEntity }> {
    const order = await this.findOrder(id, user)
    if (order.status !== 'DRAFT') throw new BadRequestException('只有草稿状态的销售单可以拆单（已提交单据请先取消提交）')
    const lines = await this.orderLineRepo.find({ where: { tenantId: user.tenantId, orderId: id }, order: { id: 'ASC' } })
    const picked = lines.filter((line) => dto.lineIds.includes(line.id))
    const splitError = checkSplitSelection(picked.length, lines.length)
    if (splitError) throw new BadRequestException(splitError)
    const splitBatchNo = `SPLIT-${order.orderNo}`

    let splitTotal = 0
    for (const line of picked) splitTotal += this.num(line.amount)
    const created = await this.orderRepo.save(this.orderRepo.create({
      tenantId: user.tenantId,
      orderNo: this.number('SO'),
      customerId: order.customerId,
      warehouseId: order.warehouseId,
      orderDate: order.orderDate,
      sourceType: 'SPLIT',
      totalAmount: this.money(splitTotal),
      parentOrderId: order.id,
      splitBatchNo,
      remark: dto.remark ?? `由 ${order.orderNo} 拆单生成`,
      createdBy: user.userId
    }))
    for (const line of picked) {
      await this.orderLineRepo.save(this.orderLineRepo.create({
        tenantId: user.tenantId,
        orderId: created.id,
        productId: line.productId,
        variantId: line.variantId,
        warehouseId: line.warehouseId,
        qty: line.qty,
        unitPrice: line.unitPrice,
        discount: line.discount,
        amount: line.amount,
        cost: line.cost
      }))
    }
    // 原单删除已拆出的明细行并重算金额
    for (const line of picked) {
      await this.orderLineRepo.delete(line.id)
    }
    const restTotal = lines.filter((line) => !dto.lineIds.includes(line.id)).reduce((sum, line) => sum + this.num(line.amount), 0)
    order.totalAmount = this.money(restTotal)
    order.splitBatchNo = splitBatchNo
    await this.orderRepo.save(order)
    await this.auditService.record({
      bizType: 'sale_order',
      bizId: id,
      action: 'SPLIT_ORDER',
      afterValue: { sourceOrderNo: order.orderNo, createdOrderId: created.id, createdOrderNo: created.orderNo, lineIds: dto.lineIds, splitBatchNo }
    }, user)
    return { source: order, created }
  }

  /**
   * 缺货替代推荐：同品类、启用且在指定仓库有可用库存的候选产品，按与原品价格差排序。
   */
  async recommendSubstitutes(productId: number, warehouseId: number, user: JwtUser): Promise<Array<{
    productId: number
    productName: string
    price: string
    availableQty: string
    priceDiff: string
  }>> {
    const origin = await this.findProduct(productId, user)
    if (!origin.categoryId) return []
    const candidates = await this.productRepo.find({
      where: { tenantId: user.tenantId, categoryId: origin.categoryId, isDeleted: 0, isActive: 1 }
    })
    const usable = candidates.filter((item) => item.id !== origin.id)
    if (usable.length === 0) return []
    const balances = await this.inventoryService.listBalances({
      page: 1,
      pageSize: 200,
      warehouseId,
      keyword: ''
    } as never, user)
    const availableByProduct = new Map<number, number>()
    for (const balance of balances.list) {
      const available = this.num(balance.qtyOnHand) - this.num(balance.qtyOccupied) - this.num(balance.qtyFrozen)
      if (available > 0) availableByProduct.set(balance.productId, (availableByProduct.get(balance.productId) ?? 0) + available)
    }
    const originPrice = this.num(origin.price)
    return usable
      .filter((item) => (availableByProduct.get(item.id) ?? 0) > 0)
      .map((item) => ({
        productId: item.id,
        productName: item.productName,
        price: item.price,
        availableQty: this.money(availableByProduct.get(item.id) ?? 0),
        priceDiff: this.money(this.num(item.price) - originPrice)
      }))
      .sort((a, b) => Math.abs(this.num(a.priceDiff)) - Math.abs(this.num(b.priceDiff)))
      .slice(0, 10)
  }

  async submitOrder(id: number, user: JwtUser): Promise<SaleOrderEntity> {    const order = await this.findOrder(id, user)
    if (!canTransition('sale_order', order.status, 'SUBMITTED')) throw new BadRequestException('只有草稿单据可以提交')
    order.status = 'SUBMITTED'
    const saved = await this.orderRepo.save(order)
    await this.auditService.record({ bizType: 'sale_order', bizId: id, action: 'SUBMIT_ORDER' }, user)

    // 预占可用库存：库存不足时提交失败，单据保持已提交但可由调用方取消
    if (typeof (this.inventoryService as { lockStock?: unknown }).lockStock === 'function') {
      try {
        await this.reserveStockForOrder(saved.id, user)
        await this.auditService.record({ bizType: 'sale_order', bizId: id, action: 'STOCK_RESERVED' }, user)
      } catch (cause) {
        order.status = 'DRAFT'
        await this.orderRepo.save(order)
        throw new BadRequestException(`库存预占失败：${cause instanceof Error ? cause.message : cause}`)
      }
    }

    // 提交时留存版本快照：已发起的审批流以该快照为准，避免单据后续变更影响审批依据
    await this.revisionService.recordSafe({
      entityCode: 'SALE_ORDER',
      bizId: saved.id,
      action: 'SUBMIT',
      source: 'SALES',
      snapshot: {
        orderNo: saved.orderNo,
        status: saved.status,
        customerId: saved.customerId,
        warehouseId: saved.warehouseId,
        totalAmount: saved.totalAmount,
        remark: saved.remark ?? null
      }
    }, user)

    // 配置了审批流时自动发起，业务单据与流程实例双向关联
    if (this.collaborationService?.hasActiveDefinition && await this.collaborationService.hasActiveDefinition('sale_order', user.tenantId)) {
      const instance = await this.collaborationService.startFlow({
        bizType: 'sale_order',
        bizId: saved.id,
        bizNo: saved.orderNo
      }, user)
      saved.flowInstanceId = instance.id
      await this.orderRepo.save(saved)
      await this.auditService.record({ bizType: 'sale_order', bizId: id, action: 'FLOW_STARTED', afterValue: { flowInstanceId: instance.id } }, user)
    }
    return saved
  }

  async approveOrder(id: number, user: JwtUser): Promise<SaleOrderEntity> {
    const order = await this.findOrder(id, user)
    // 关联了审批流的单据必须通过工作流审批，禁止直接改状态
    if (order.flowInstanceId && this.collaborationService?.findInstanceByBiz) {
      const instance = await this.collaborationService.findInstanceByBiz('sale_order', id, user.tenantId)
      if (!instance || instance.status !== 'APPROVED') {
        throw new BadRequestException('该单据已进入审批流，请在流程审批通过后由系统自动生效')
      }
    }
    return this.doApproveOrder(id, user)
  }

  /** 审批业务核心（信用占用、应收生成、审计、事件）。供直接审批与工作流回调复用 */
  private async doApproveOrder(id: number, user: JwtUser, comment?: string): Promise<SaleOrderEntity> {
    const order = await this.findOrder(id, user)
    if (!canTransition('sale_order', order.status, 'APPROVED')) throw new BadRequestException('只有已提交单据可以审核')
    const customer = await this.findCustomer(order.customerId, user)
    const limit = this.num(customer.creditLimit)
    const used = this.num(customer.creditUsed)
    const amount = this.num(order.totalAmount)
    if (limit > 0 && used + amount > limit) {
      throw new BadRequestException('客户信用额度不足')
    }
    customer.creditUsed = this.money(used + amount)
    await this.customerRepo.save(customer)
    order.status = 'APPROVED'
    order.creditOccupied = order.totalAmount
    const saved = await this.orderRepo.save(order)
    await this.financeIntegrationService.ensureSaleReceivable({
      customerId: order.customerId,
      sourceId: order.id,
      sourceNo: order.orderNo,
      amount: order.totalAmount,
      dueDate: null
    }, user)
    await this.auditService.record({ bizType: 'sale_order', bizId: id, action: 'APPROVE_ORDER', afterValue: { creditUsed: customer.creditUsed, comment: comment ?? null } }, user)
    await this.eventBus.emit(createDomainEvent('sales.order.approved', user, 'sale_order', id, { orderNo: order.orderNo, amount: Number(order.totalAmount) }))
    return saved
  }

  async posOrder(dto: PosOrderDto, user: JwtUser): Promise<SaleOrderEntity> {
    const order = await this.createOrder({
      customerId: dto.customerId,
      warehouseId: dto.warehouseId,
      orderDate: new Date().toISOString().slice(0, 10),
      sourceType: 'POS',
      lines: dto.lines
    }, user)
    await this.submitOrder(order.id, user)
    return this.approveOrder(order.id, user)
  }

  async updateOrder(id: number, dto: UpdateSaleOrderDto, user: JwtUser): Promise<SaleOrderEntity> {
    const order = await this.findOrder(id, user)
    assertBizEditable(
      order as unknown as Record<string, unknown>,
      dto as unknown as Record<string, unknown>,
      ['status', 'customerId', 'warehouseId', 'totalAmount'],
      { status: order.status, flowInstanceId: order.flowInstanceId }
    )
    const before = { ...order }
    Object.assign(order, dto)
    const saved = await this.orderRepo.save(order)
    await this.auditService.record({ bizType: 'sale_order', bizId: id, action: 'UPDATE_ORDER', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  async listStatements(query: QuerySalesDto, user: JwtUser): Promise<PageResult<CustomerStatementEntity>> {
    const where = scopeWhere<CustomerStatementEntity>({
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { statementNo: Like(`%${query.keyword}%`) } : {})
    }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.statementRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createStatement(dto: CreateStatementDto, user: JwtUser): Promise<CustomerStatementEntity> {
    const entity = this.statementRepo.create({
      ...dto,
      tenantId: user.tenantId,
      statementNo: this.number('ST'),
      dueDate: dto.dueDate ?? null,
      createdBy: user.userId
    })
    const saved = await this.statementRepo.save(entity)
    await this.auditService.record({ bizType: 'customer_statement', bizId: saved.id, action: 'CREATE_STATEMENT', afterValue: saved }, user)
    return saved
  }

  async settleStatement(id: number, dto: SettleStatementDto, user: JwtUser): Promise<CustomerStatementEntity> {
    const statement = await this.statementRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!statement) throw new NotFoundException('对账单不存在')
    const settled = this.num(statement.settledAmount) + this.num(dto.amount)
    if (settled > this.num(statement.amount)) throw new BadRequestException('核销金额超过账单金额')
    statement.settledAmount = this.money(settled)
    statement.status = settled >= this.num(statement.amount) ? 'DONE' : 'PARTIAL'
    const saved = await this.statementRepo.save(statement)

    const customer = await this.findCustomer(statement.customerId, user)
    const released = Math.max(0, this.num(customer.creditUsed) - this.num(dto.amount))
    customer.creditUsed = this.money(released)
    await this.customerRepo.save(customer)

    await this.auditService.record({ bizType: 'customer_statement', bizId: id, action: 'SETTLE_STATEMENT', afterValue: { amount: dto.amount, creditUsed: customer.creditUsed } }, user)
    return saved
  }

  /** 客户对账单红冲：核销 + 已红冲金额不得超过账单金额，红冲留原因 */
  async reverseStatement(id: number, dto: ReverseStatementDto, user: JwtUser): Promise<CustomerStatementEntity> {
    const statement = await this.statementRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!statement) throw new NotFoundException('对账单不存在')
    const check = checkStatementReverse({
      amount: this.num(dto.amount),
      statementAmount: this.num(statement.amount),
      settledAmount: this.num(statement.settledAmount),
      reversedAmount: this.num(statement.reversedAmount),
      status: statement.status,
      reason: dto.reason
    })
    if (!check.allowed) throw new BadRequestException(check.reason)
    statement.reversedAmount = this.money(this.num(statement.reversedAmount) + this.num(dto.amount))
    statement.reverseReason = dto.reason
    statement.reversedAt = new Date()
    if (this.num(statement.reversedAmount) + this.num(statement.settledAmount) >= this.num(statement.amount)) {
      statement.status = 'REVERSED'
    }
    const saved = await this.statementRepo.save(statement)

    // 红冲金额从客户信用占用中释放
    const customer = await this.findCustomer(statement.customerId, user)
    customer.creditUsed = this.money(Math.max(0, this.num(customer.creditUsed) - this.num(dto.amount)))
    await this.customerRepo.save(customer)

    await this.auditService.record({
      bizType: 'customer_statement',
      bizId: id,
      action: 'REVERSE_STATEMENT',
      afterValue: { amount: dto.amount, reason: dto.reason, reversedAmount: saved.reversedAmount, creditUsed: customer.creditUsed }
    }, user)
    return saved
  }

  /** 智能核销建议：不超过账单余额与可用信用额度 */
  async smartWriteoff(id: number, user: JwtUser): Promise<Record<string, unknown>> {
    const statement = await this.statementRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!statement) throw new NotFoundException('对账单不存在')
    const customer = await this.findCustomer(statement.customerId, user)
    const availableCredit = Math.max(0, this.num(customer.creditLimit) - this.num(customer.creditUsed))
    const suggested = smartWriteoffSuggestion(statement.amount, statement.settledAmount, availableCredit)
    return {
      statementId: id,
      amount: statement.amount,
      settledAmount: statement.settledAmount,
      remaining: Math.max(0, this.num(statement.amount) - this.num(statement.settledAmount)),
      availableCredit,
      suggested
    }
  }

  /** 收款计划：按逾期天数分级并给出下一次动作日期 */
  async collectionPlan(user: JwtUser): Promise<Array<Record<string, unknown>>> {
    const statements = await this.statementRepo.find({
      where: scopeWhere<CustomerStatementEntity>({ tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' }),
      order: { dueDate: 'ASC' }
    })
    return buildCollectionPlan(statements.filter((item) => item.status !== 'DONE' && item.dueDate).map((item) => ({
      id: item.id,
      amount: item.amount,
      dueDate: item.dueDate as string,
      level: item.status
    })))
  }

  /** 催收函：按客户与逾期天数生成可发送文本 */
  async collectionLetter(id: number, user: JwtUser): Promise<{ statementId: number; content: string }> {
    const statement = await this.statementRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!statement) throw new NotFoundException('对账单不存在')
    const customer = await this.findCustomer(statement.customerId, user)
    const overdueDays = statement.dueDate ? Math.max(0, Math.floor((Date.now() - new Date(statement.dueDate).getTime()) / 86400000)) : 0
    const content = collectionLetter(customer.customerName, statement.amount, overdueDays)
    await this.auditService.record({ bizType: 'customer_statement', bizId: id, action: 'GENERATE_COLLECTION_LETTER', afterValue: { content } }, user)
    return { statementId: id, content }
  }

  async listShipments(query: QuerySalesDto, user: JwtUser): Promise<PageResult<ShipmentEntity>> {
    const where = scopeWhere<ShipmentEntity>({
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { shipmentNo: Like(`%${query.keyword}%`) } : {})
    }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.shipmentRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createShipment(dto: CreateShipmentDto, user: JwtUser): Promise<ShipmentEntity> {
    const order = await this.findOrder(dto.orderId, user)
    if (!['APPROVED', 'PARTIAL'].includes(order.status)) throw new BadRequestException('订单未审核或未进入发货状态')

    // 波次校验：指定拣货波次时，波次必须已复核，避免未复核商品直接出库
    if (dto.waveId) {
      const { wave, tasks } = await this.inventoryService.waveDetail(dto.waveId, user)
      const waveCheck = checkWaveShippable({
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
      if (!waveCheck.allowed) throw new BadRequestException(waveCheck.reason)
    }

    const shipment = await this.shipmentRepo.save(this.shipmentRepo.create({
      tenantId: user.tenantId,
      shipmentNo: this.number('SH'),
      orderId: order.id,
      customerId: order.customerId,
      trackingNo: dto.trackingNo ?? null,
      waveId: dto.waveId ?? null,
      createdBy: user.userId
    }))

    let allShipped = true
    for (const line of dto.lines) {
      const orderLine = await this.orderLineRepo.findOne({ where: { id: line.orderLineId, orderId: order.id, tenantId: user.tenantId } })
      if (!orderLine) throw new BadRequestException('发货明细未匹配到订单行')
      const remain = this.num(orderLine.qty) - this.num(orderLine.shippedQty)
      if (this.num(line.qty) > remain) throw new BadRequestException('发货数量超过未发数量')
      orderLine.shippedQty = this.money(this.num(orderLine.shippedQty) + this.num(line.qty))
      await this.orderLineRepo.save(orderLine)
      if (this.num(orderLine.shippedQty) < this.num(orderLine.qty)) allShipped = false
      const shipmentLine = await this.shipmentLineRepo.save(this.shipmentLineRepo.create({
        tenantId: user.tenantId,
        shipmentId: shipment.id,
        orderLineId: orderLine.id,
        productId: orderLine.productId,
        variantId: orderLine.variantId,
        qty: line.qty,
        batchNo: line.batchNo ?? null
      }))
      const movementWarehouseId = orderLine.warehouseId ?? order.warehouseId
      if (!movementWarehouseId) throw new BadRequestException('销售单未指定仓库，无法发货过账')
      await this.inventoryService.postMovement({
        voucherType: 'SALE_OUT',
        voucherId: shipment.id,
        voucherLineId: shipmentLine.id,
        warehouseId: movementWarehouseId,
        productId: orderLine.productId,
        variantId: orderLine.variantId ?? 0,
        batchNo: line.batchNo ?? '',
        qtyOut: line.qty,
        remark: `销售发货 ${order.orderNo}`
      }, user)
    }

    order.shipStatus = allShipped ? 'DONE' : 'PARTIAL'
    order.status = allShipped ? 'DONE' : 'PARTIAL'
    await this.orderRepo.save(order)
    // 全部发货完成后释放该订单的库存预占（避免重复占用）
    if (allShipped && typeof (this.inventoryService as { unlockStock?: unknown }).unlockStock === 'function') {
      await this.releaseStockForOrder(order.id, user)
    }
    await this.auditService.record({ bizType: 'shipment', bizId: shipment.id, action: 'CREATE_SHIPMENT', afterValue: shipment }, user)
    return shipment
  }

  async updateShipment(id: number, dto: UpdateShipmentDto, user: JwtUser): Promise<ShipmentEntity> {
    const shipment = await this.shipmentRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!shipment) throw new NotFoundException('发货单不存在')
    const before = { ...shipment }
    Object.assign(shipment, dto)
    if (dto.status === 'DONE') shipment.shippedAt = new Date()
    const saved = await this.shipmentRepo.save(shipment)
    await this.auditService.record({ bizType: 'shipment', bizId: id, action: 'UPDATE_SHIPMENT', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  /** 出货签收：记录签收人、签收时间与签收凭证（照片等），并留审计 */
  async signShipment(id: number, dto: SignShipmentDto, user: JwtUser): Promise<ShipmentEntity> {
    const shipment = await this.shipmentRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!shipment) throw new NotFoundException('发货单不存在')
    if (shipment.status === 'DRAFT') throw new BadRequestException('发货单尚未发货，不能签收')
    if (shipment.signedAt) throw new BadRequestException('该发货单已签收')
    shipment.signedAt = new Date()
    shipment.signedBy = dto.signedBy ?? user.username ?? String(user.userId)
    shipment.signEvidence = {
      evidenceUrls: dto.evidenceUrls ?? [],
      remark: dto.remark ?? null,
      signedByUserId: user.userId
    }
    const saved = await this.shipmentRepo.save(shipment)
    await this.auditService.record({ bizType: 'shipment', bizId: id, action: 'SIGN_SHIPMENT', afterValue: saved }, user)
    return saved
  }

  async listReturns(query: QuerySalesDto, user: JwtUser): Promise<PageResult<SaleReturnEntity>> {
    const where = scopeWhere<SaleReturnEntity>({
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.status ? { status: query.status } : {}),
      ...(query.keyword ? { returnNo: Like(`%${query.keyword}%`) } : {})
    }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.returnRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createReturn(dto: CreateSaleReturnDto, user: JwtUser): Promise<SaleReturnEntity> {
    const refund = dto.lines.reduce((sum, line) => sum + this.num(line.amount), 0)
    const entity = await this.returnRepo.save(this.returnRepo.create({
      tenantId: user.tenantId,
      returnNo: this.number('SR'),
      customerId: dto.customerId,
      orderId: dto.orderId ?? null,
      reason: dto.reason ?? null,
      refundAmount: this.money(refund),
      createdBy: user.userId
    }))
    for (const line of dto.lines) {
      await this.returnLineRepo.save(this.returnLineRepo.create({
        tenantId: user.tenantId,
        returnId: entity.id,
        productId: line.productId,
        qty: line.qty,
        amount: line.amount,
        disposal: line.disposal ?? 'RESTOCK'
      }))
    }
    await this.auditService.record({ bizType: 'sale_return', bizId: entity.id, action: 'CREATE_RETURN', afterValue: entity }, user)
    return entity
  }

  async updateReturn(id: number, dto: UpdateSaleReturnDto, user: JwtUser): Promise<SaleReturnEntity> {
    const entity = await this.returnRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('退货单不存在')
    const before = { ...entity }
    Object.assign(entity, dto)
    const saved = await this.returnRepo.save(entity)
    await this.auditService.record({ bizType: 'sale_return', bizId: id, action: 'UPDATE_RETURN', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  /** 退货质检：RESTOCK 处置的明细必须质检合格才能入库 */
  async qcReturnLine(returnId: number, dto: ReturnQcDto, user: JwtUser): Promise<SaleReturnLineEntity> {
    const entity = await this.returnRepo.findOne({ where: { id: returnId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('退货单不存在')
    const line = await this.returnLineRepo.findOne({ where: { id: dto.lineId, tenantId: user.tenantId, returnId } })
    if (!line) throw new NotFoundException('退货明细不存在')
    line.qcStatus = dto.result
    const saved = await this.returnLineRepo.save(line)
    await this.auditService.record({ bizType: 'sale_return', bizId: returnId, action: 'QC_RETURN', afterValue: { lineId: line.id, result: dto.result, note: dto.note ?? null } }, user)
    return saved
  }

  /** 退货审批：质检全通过后才可审批，执行退款（冲减应收）与合格品回补库存 */
  async approveReturn(id: number, dto: ApproveReturnDto, user: JwtUser): Promise<SaleReturnEntity> {
    const entity = await this.returnRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('退货单不存在')
    if (entity.status !== 'SUBMITTED') throw new BadRequestException('只有已提交退货单可以审批')
    const lines = await this.returnLineRepo.find({ where: { tenantId: user.tenantId, returnId: id } })
    const restockLines = lines.filter((line) => line.disposal === 'RESTOCK')
    if (restockLines.some((line) => line.qcStatus !== 'PASS')) {
      throw new BadRequestException('存在未质检合格的退货明细，禁止审批')
    }

    // 回补库存（合格且处置为 RESTOCK）
    const returnWarehouseId = await this.resolveWarehouseId(undefined, user)
    for (const line of restockLines) {
      await this.inventoryService.postMovement({
        voucherType: 'SALE_RETURN_IN',
        voucherId: id,
        voucherLineId: line.id,
        warehouseId: returnWarehouseId,
        productId: line.productId,
        qtyIn: line.qty,
        remark: `退货入库 ${entity.returnNo}`
      }, user)
    }

    // 冲减应收（退款）
    const refund = this.num(entity.refundAmount)
    if (refund > 0) {
      const customer = await this.findCustomer(entity.customerId, user)
      customer.creditUsed = this.money(Math.max(0, this.num(customer.creditUsed) - refund))
      await this.customerRepo.save(customer)
      await this.financeIntegrationService.ensureSaleReceivable({
        customerId: entity.customerId,
        sourceId: entity.id,
        sourceNo: entity.returnNo,
        amount: this.money(-refund),
        dueDate: null
      }, user)
    }

    entity.status = 'APPROVED'
    entity.approvedBy = user.userId
    entity.approvedAt = new Date()
    entity.redInvoiceNo = dto.redInvoiceNo ?? null
    const saved = await this.returnRepo.save(entity)
    await this.auditService.record({ bizType: 'sale_return', bizId: id, action: 'APPROVE_RETURN', afterValue: { refundAmount: entity.refundAmount, redInvoiceNo: entity.redInvoiceNo } }, user)
    return saved
  }

  async listAgreements(query: QuerySalesDto, user: JwtUser): Promise<PageResult<SalePriceAgreementEntity>> {
    const where = {
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.keyword ? { productId: Number(query.keyword) || undefined } : {})
    }
    const [list, total] = await this.agreementRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createAgreement(dto: CreatePriceAgreementDto, user: JwtUser): Promise<SalePriceAgreementEntity> {
    const entity = this.agreementRepo.create({
      ...dto,
      tenantId: user.tenantId,
      productId: dto.productId ?? null,
      categoryId: dto.categoryId ?? null,
      qtyStep: dto.qtyStep ?? '1',
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null
    })
    const saved = await this.agreementRepo.save(entity)
    await this.auditService.record({ bizType: 'sale_price_agreement', bizId: saved.id, action: 'CREATE_AGREEMENT', afterValue: saved }, user)
    return saved
  }

  async listTargets(query: QuerySalesDto, user: JwtUser): Promise<PageResult<SaleTargetEntity>> {
    const where = {
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.keyword ? { period: Like(`%${query.keyword}%`) } : {})
    }
    const [list, total] = await this.targetRepo.findAndCount({ where, order: { period: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createTarget(dto: CreateTargetDto, user: JwtUser): Promise<SaleTargetEntity> {
    const entity = this.targetRepo.create({
      ...dto,
      tenantId: user.tenantId,
      orgId: dto.orgId ?? null,
      userId: dto.userId ?? user.userId
    })
    const saved = await this.targetRepo.save(entity)
    await this.auditService.record({ bizType: 'sale_target', bizId: saved.id, action: 'CREATE_TARGET', afterValue: saved }, user)
    return saved
  }

  async summary(user: JwtUser): Promise<Record<string, unknown>> {
    const orders = await this.orderRepo.find({
      where: scopeWhere<SaleOrderEntity>({ tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' }),
      order: { createdAt: 'DESC' }
    })
    const effective = orders.filter((order) => ['APPROVED', 'PARTIAL', 'DONE'].includes(order.status))
    const customers = await this.customerRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const products = await this.productRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const lines = await this.orderLineRepo.find({ where: { tenantId: user.tenantId } })

    const byCustomer = new Map<string, number>()
    for (const order of effective) {
      const name = customers.find((customer) => customer.id === order.customerId)?.customerName ?? String(order.customerId)
      byCustomer.set(name, (byCustomer.get(name) ?? 0) + this.num(order.totalAmount))
    }
    const byProduct = new Map<string, number>()
    for (const line of lines) {
      const order = effective.find((item) => item.id === line.orderId)
      if (!order) continue
      const name = products.find((product) => product.id === line.productId)?.productName ?? String(line.productId)
      byProduct.set(name, (byProduct.get(name) ?? 0) + this.num(line.amount))
    }
    const byMonth = new Map<string, number>()
    for (const order of effective) {
      const month = order.orderDate.slice(0, 7)
      byMonth.set(month, (byMonth.get(month) ?? 0) + this.num(order.totalAmount))
    }

    return {
      orderCount: effective.length,
      totalAmount: this.money(effective.reduce((sum, order) => sum + this.num(order.totalAmount), 0)),
      byCustomer: [...byCustomer.entries()].map(([name, amount]) => ({ name, amount: this.money(amount) })),
      byProduct: [...byProduct.entries()].map(([name, amount]) => ({ name, amount: this.money(amount) })),
      byMonth: [...byMonth.entries()].map(([month, amount]) => ({ month, amount: this.money(amount) }))
    }
  }

  /** 线索评分与自动分配：按来源、跟进次数动态打分 */
  async smartAssignLead(id: number, user: JwtUser): Promise<LeadEntity> {
    const lead = await this.leadRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!lead) throw new NotFoundException('线索不存在')
    const follows = await this.followRepo.count({ where: { tenantId: user.tenantId, bizType: 'LEAD', bizId: id } })
    const score = scoreLead({ source: lead.source, followers: follows })
    lead.score = score
    if (!lead.ownerUserId) lead.ownerUserId = user.userId
    lead.updatedAt = new Date()
    const saved = await this.leadRepo.save(lead)
    await this.auditService.record({ bizType: 'crm_lead', bizId: id, action: 'SMART_ASSIGN', afterValue: { score, ownerUserId: saved.ownerUserId } }, user)
    return saved
  }

  /** 重复线索检测：姓名或手机号归一化后命中即禁止重复分配 */
  async duplicateLeads(id: number, user: JwtUser): Promise<LeadEntity[]> {
    const lead = await this.leadRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!lead) throw new NotFoundException('线索不存在')
    const all = await this.leadRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    return all.filter((item) => item.id !== lead.id && isDuplicateLead(item, [lead]))
  }

  async advanceOpportunity(id: number, dto: AdvanceOpportunityDto, user: JwtUser): Promise<OpportunityEntity> {
    const opportunity = await this.opportunityRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!opportunity) throw new NotFoundException('商机不存在')
    const followCount = await this.followRepo.count({ where: { tenantId: user.tenantId, bizType: 'OPPORTUNITY', bizId: id } })
    const missing = opportunityGate({
      stage: dto.stage,
      expectedAmount: dto.expectedAmount ? this.num(dto.expectedAmount) : this.num(opportunity.expectedAmount),
      closeDate: dto.closeDate ?? opportunity.closeDate,
      followCount
    })
    if (missing.length) throw new BadRequestException(`阶段推进缺少必填项：${missing.join('、')}`)
    const winRates: Record<string, number> = { PROSPECT: 10, QUALIFIED: 25, PROPOSAL: 50, NEGOTIATION: 75, WON: 100, LOST: 0 }
    opportunity.stage = dto.stage
    opportunity.winRate = winRates[dto.stage] ?? opportunity.winRate
    opportunity.competitor = dto.competitor ?? opportunity.competitor
    opportunity.lostReason = dto.lostReason ?? opportunity.lostReason
    opportunity.teamMemberIds = dto.teamMemberIds ?? opportunity.teamMemberIds
    if (dto.expectedAmount) opportunity.expectedAmount = dto.expectedAmount
    if (dto.closeDate) opportunity.closeDate = dto.closeDate
    opportunity.updatedAt = new Date()
    const saved = await this.opportunityRepo.save(opportunity)
    await this.auditService.record({ bizType: 'crm_opportunity', bizId: id, action: 'ADVANCE_STAGE', afterValue: { stage: saved.stage, winRate: saved.winRate } }, user)
    return saved
  }

  async approveQuotation(id: number, dto: ApproveQuotationDto, user: JwtUser): Promise<QuotationEntity> {
    const quotation = await this.quotationRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!quotation) throw new NotFoundException('报价单不存在')
    quotation.status = dto.status
    quotation.approvalStatus = dto.status
    quotation.updatedAt = new Date()
    const saved = await this.quotationRepo.save(quotation)
    await this.auditService.record({ bizType: 'crm_quotation', bizId: id, action: 'APPROVE_QUOTATION', afterValue: { status: saved.status } }, user)
    return saved
  }

  async convertQuotation(id: number, user: JwtUser): Promise<SaleOrderEntity> {
    const quotation = await this.quotationRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!quotation) throw new NotFoundException('报价单不存在')
    if (quotation.approvalStatus !== 'APPROVED') throw new BadRequestException('报价单未审批通过，不能转单')
    const validity = checkQuotationValidity(quotation.expireDate)
    if (!validity.valid) throw new BadRequestException(validity.reason ?? '报价单不可用')
    const lines = await this.quotationLineRepo.find({ where: { tenantId: user.tenantId, quotationId: id } })
    if (lines.length === 0) throw new BadRequestException('报价单缺少明细')
    const order = await this.createOrder({
      customerId: quotation.customerId,
      orderDate: this.today(),
      lines: lines.map((line) => ({ productId: line.productId, qty: line.qty, unitPrice: line.unitPrice }))
    }, user)
    quotation.convertedOrderId = order.id
    quotation.status = 'CONVERTED'
    await this.quotationRepo.save(quotation)
    await this.auditService.record({ bizType: 'crm_quotation', bizId: id, action: 'CONVERT_QUOTATION', afterValue: { saleOrderId: order.id } }, user)
    return order
  }

  async createMergeRequest(dto: CreateCustomerMergeDto, user: JwtUser): Promise<CustomerMergeRequestEntity> {
    if (dto.fromCustomerId === dto.toCustomerId) throw new BadRequestException('不能合并同一客户')
    const from = await this.findCustomer(dto.fromCustomerId, user)
    const to = await this.findCustomer(dto.toCustomerId, user)
    const openOrders = await this.orderRepo.count({ where: { tenantId: user.tenantId, customerId: dto.fromCustomerId, isDeleted: 0 } })
    const check = checkCustomerMerge(this.num(from.creditUsed), this.num(to.creditUsed), openOrders > 0, false)
    const entity = this.mergeRepo.create({
      tenantId: user.tenantId,
      fromCustomerId: dto.fromCustomerId,
      toCustomerId: dto.toCustomerId,
      reason: dto.reason ?? null,
      status: 'PENDING',
      checkResult: check as unknown as Record<string, unknown>,
      createdBy: user.userId
    })
    const saved = await this.mergeRepo.save(entity)
    await this.auditService.record({ bizType: 'crm_customer_merge', bizId: saved.id, action: 'CREATE_MERGE', afterValue: saved }, user)
    return saved
  }

  async approveMergeRequest(id: number, dto: ApproveMergeDto, user: JwtUser): Promise<CustomerMergeRequestEntity> {
    const request = await this.mergeRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!request) throw new NotFoundException('客户合并申请不存在')
    if (request.status !== 'PENDING') throw new BadRequestException('该申请已处理')
    if (dto.status === 'APPROVED') {
      const from = await this.findCustomer(request.fromCustomerId, user)
      const to = await this.findCustomer(request.toCustomerId, user)
      const openOrders = await this.orderRepo.count({ where: { tenantId: user.tenantId, customerId: request.fromCustomerId, isDeleted: 0 } })
      const check = checkCustomerMerge(this.num(from.creditUsed), this.num(to.creditUsed), openOrders > 0, true)
      if (!check.allowed) throw new BadRequestException(check.reasons.join('；'))
      to.creditUsed = this.money(this.num(to.creditUsed) + this.num(from.creditUsed))
      await this.customerRepo.save(to)
      from.status = 'MERGED'
      await this.customerRepo.save(from)
    }
    request.status = dto.status
    request.approvedBy = user.userId
    request.checkResult = { approved: dto.status === 'APPROVED' }
    const saved = await this.mergeRepo.save(request)
    await this.auditService.record({ bizType: 'crm_customer_merge', bizId: id, action: 'APPROVE_MERGE', afterValue: saved }, user)
    return saved
  }

  async hangPosOrder(dto: HangPosOrderDto, user: JwtUser): Promise<PosHangOrderEntity> {
    const existing = await this.hangRepo.find({ where: { tenantId: user.tenantId } })
    if (!isIdempotent(existing.map((item) => item.hangKey), dto.hangKey)) {
      const entity = this.hangRepo.create({
        tenantId: user.tenantId,
        hangKey: dto.hangKey,
        customerId: dto.customerId ?? null,
        payload: JSON.parse(dto.payload) as Record<string, unknown>,
        createdBy: user.userId
      })
      const saved = await this.hangRepo.save(entity)
      await this.auditService.record({ bizType: 'pos_hang_order', bizId: saved.id, action: 'HANG_ORDER', afterValue: { hangKey: saved.hangKey } }, user)
      return saved
    }
    return existing.find((item) => item.hangKey === dto.hangKey)!
  }

  async resumePosHang(id: number, user: JwtUser): Promise<SaleOrderEntity> {
    const hang = await this.hangRepo.findOne({ where: { id, tenantId: user.tenantId, status: 'HUNG' } })
    if (!hang) throw new NotFoundException('挂单不存在或已恢复')
    const payload = hang.payload as { lines?: CreateSaleOrderDto['lines']; customerId?: number }
    if (!payload.lines?.length) throw new BadRequestException('挂单缺少可恢复明细')
    const order = await this.createOrder({ customerId: payload.customerId ?? hang.customerId ?? 0, orderDate: this.today(), lines: payload.lines }, user)
    hang.status = 'RESUMED'
    hang.resumedOrderId = order.id
    await this.hangRepo.save(hang)
    await this.auditService.record({ bizType: 'pos_hang_order', bizId: id, action: 'RESUME_ORDER', afterValue: { saleOrderId: order.id } }, user)
    return order
  }

  async refreshTarget(id: number, user: JwtUser): Promise<SaleTargetEntity> {
    const target = await this.targetRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!target) throw new NotFoundException('销售目标不存在')
    const orders = await this.orderRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0, orderDate: Like(`${target.period}%`), ...(target.userId ? { createdBy: target.userId } : {}) } })
    const actual = orders.reduce((sum, item) => sum + this.num(item.totalAmount), 0)
    target.actualAmount = this.money(actual)
    const progress = targetProgress(actual, this.num(target.targetAmount))
    const saved = await this.targetRepo.save(target)
    await this.auditService.record({ bizType: 'sale_target', bizId: id, action: 'REFRESH_TARGET', afterValue: { actual: saved.actualAmount, ...progress } }, user)
    return saved
  }

  private number(prefix: string): string {
    const suffix = `${Date.now().toString(36)}${randomBytes(2).toString('hex')}`.toUpperCase()
    return `${prefix}${suffix}`
  }

  /** 客户 360 联系人图谱与画像 */
  async customerProfile360(customerId: number, user: JwtUser): Promise<Record<string, unknown>> {
    const customer = await this.findCustomer(customerId, user)
    const contacts = await this.contactRepo.find({ where: { tenantId: user.tenantId, customerId, isDeleted: 0 } })
    const orders = await this.orderRepo.find({ where: { tenantId: user.tenantId, customerId, isDeleted: 0 } })
    const statements = await this.statementRepo.find({ where: { tenantId: user.tenantId, customerId, isDeleted: 0 } })
    const followCount = await this.followRepo.count({ where: { tenantId: user.tenantId, bizType: 'CUSTOMER', bizId: customerId } })
    const totalAmount = orders.reduce((sum, item) => sum + this.num(item.totalAmount), 0)
    const lastOrderDate = orders.map((item) => item.orderDate).sort().reverse()[0] ?? null
    const overdueAmount = statements
      .filter((item) => item.status !== 'SETTLED')
      .reduce((sum, item) => sum + Math.max(0, this.num(item.amount) - this.num(item.settledAmount)), 0)
    const profile = buildCustomerProfile360({
      contactCount: contacts.length,
      orderCount: orders.length,
      totalAmount,
      lastOrderDate,
      overdueAmount,
      followCount
    })
    const risk = churnRisk(profile)
    return {
      customer: { id: customer.id, name: customer.customerName, levelId: customer.levelId },
      profile,
      risk,
      contacts
    }
  }

  async addCustomerContact(dto: CreateCustomerContactDto, user: JwtUser): Promise<CrmCustomerContactEntity> {
    await this.findCustomer(dto.customerId, user)
    const entity = this.contactRepo.create({
      tenantId: user.tenantId,
      customerId: dto.customerId,
      contactName: dto.contactName,
      contactRole: dto.contactRole ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      isPrimary: dto.isPrimary ?? 0
    })
    const saved = await this.contactRepo.save(entity)
    await this.auditService.record({ bizType: 'crm_customer_contact', bizId: saved.id, action: 'CREATE_CONTACT', afterValue: saved }, user)
    return saved
  }

  async listCustomerContacts(customerId: number, user: JwtUser): Promise<CrmCustomerContactEntity[]> {
    return this.contactRepo.find({ where: { tenantId: user.tenantId, customerId, isDeleted: 0 } })
  }

  /** 客户流失预警扫描：按活跃度与应收逾期生成预警 */
  async scanChurnWarnings(user: JwtUser): Promise<CrmChurnWarningEntity[]> {
    const customers = await this.customerRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const created: CrmChurnWarningEntity[] = []
    for (const customer of customers) {
      const orders = await this.orderRepo.find({ where: { tenantId: user.tenantId, customerId: customer.id, isDeleted: 0 } })
      const statements = await this.statementRepo.find({ where: { tenantId: user.tenantId, customerId: customer.id, isDeleted: 0 } })
      const contacts = await this.contactRepo.count({ where: { tenantId: user.tenantId, customerId: customer.id, isDeleted: 0 } })
      const followCount = await this.followRepo.count({ where: { tenantId: user.tenantId, bizType: 'CUSTOMER', bizId: customer.id } })
      const profile = buildCustomerProfile360({
        contactCount: contacts,
        orderCount: orders.length,
        totalAmount: orders.reduce((sum, item) => sum + this.num(item.totalAmount), 0),
        lastOrderDate: orders.map((item) => item.orderDate).sort().reverse()[0] ?? null,
        overdueAmount: statements
          .filter((item) => item.status !== 'SETTLED')
          .reduce((sum, item) => sum + Math.max(0, this.num(item.amount) - this.num(item.settledAmount)), 0),
        followCount
      })
      const risk = churnRisk(profile)
      if (risk.level === 'LOW') continue
      const existing = await this.churnRepo.findOne({
        where: { tenantId: user.tenantId, customerId: customer.id, status: 'OPEN' }
      })
      if (existing) {
        existing.level = risk.level
        existing.score = String(risk.score)
        existing.riskDetail = { profile, reasons: risk.reasons, actions: risk.actions }
        await this.churnRepo.save(existing)
        continue
      }
      const entity = this.churnRepo.create({
        tenantId: user.tenantId,
        customerId: customer.id,
        customerName: customer.customerName,
        level: risk.level,
        score: String(risk.score),
        riskDetail: { profile, reasons: risk.reasons, actions: risk.actions }
      })
      created.push(await this.churnRepo.save(entity))
    }
    await this.auditService.record({ bizType: 'crm_churn_warning', bizId: 0, action: 'SCAN_CHURN', afterValue: { count: created.length } }, user)
    return created
  }

  async handleChurnWarning(id: number, dto: HandleChurnWarningDto, user: JwtUser): Promise<CrmChurnWarningEntity> {
    const warning = await this.churnRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!warning) throw new NotFoundException('流失预警不存在')
    warning.status = dto.status
    warning.handledBy = user.userId
    warning.handledAt = new Date()
    const saved = await this.churnRepo.save(warning)
    await this.auditService.record({ bizType: 'crm_churn_warning', bizId: id, action: 'HANDLE_CHURN_WARNING', afterValue: saved }, user)
    return saved
  }

  /** 报价版本快照与版本对比 */
  async saveQuotationVersion(id: number, user: JwtUser, changeReason?: string): Promise<CrmQuotationVersionEntity> {
    const quotation = await this.quotationRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!quotation) throw new NotFoundException('报价单不存在')
    const lines = await this.quotationLineRepo.find({ where: { tenantId: user.tenantId, quotationId: id } })
    const version = quotation.version ?? 1
    const exists = await this.quotationVersionRepo.findOne({ where: { tenantId: user.tenantId, quotationId: id, version } })
    if (exists) return exists
    const entity = this.quotationVersionRepo.create({
      tenantId: user.tenantId,
      quotationId: id,
      version,
      totalAmount: quotation.totalAmount,
      snapshot: { lines: lines.map((line) => ({ productId: line.productId, qty: line.qty, unitPrice: line.unitPrice })) },
      changeReason: changeReason ?? null,
      createdBy: user.userId
    })
    const saved = await this.quotationVersionRepo.save(entity)
    await this.auditService.record({ bizType: 'crm_quotation_version', bizId: saved.id, action: 'SAVE_VERSION', afterValue: { version } }, user)
    return saved
  }

  async compareQuotationVersions(id: number, dto: CompareQuotationVersionDto, user: JwtUser): Promise<Record<string, unknown>> {
    const quotation = await this.quotationRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!quotation) throw new NotFoundException('报价单不存在')
    const lines = await this.quotationLineRepo.find({ where: { tenantId: user.tenantId, quotationId: id } })
    const current = lines.map((line) => ({ productId: line.productId, qty: this.num(line.qty), unitPrice: this.num(line.unitPrice) }))
    const versions = await this.quotationVersionRepo.find({
      where: { tenantId: user.tenantId, quotationId: id },
      order: { version: 'DESC' }
    })
    const base = dto.baseVersion
      ? versions.find((item) => item.version === dto.baseVersion)
      : versions[0]
    if (!base) throw new BadRequestException('缺少可对比的历史版本')
    const before = ((base.snapshot?.lines ?? []) as Array<{ productId: number; qty: string | number; unitPrice: string | number }>)
      .map((line) => ({ productId: line.productId, qty: this.num(line.qty), unitPrice: this.num(line.unitPrice) }))
    return { baseVersion: base.version, currentVersion: quotation.version, diff: quotationVersionDiff(before, current) }
  }

  /** POS 会员价维护与取价 */
  async setMemberPrice(dto: CreateMemberPriceDto, user: JwtUser): Promise<PosMemberPriceEntity> {
    const existing = await this.memberPriceRepo.findOne({
      where: { tenantId: user.tenantId, customerId: dto.customerId, productId: dto.productId, status: 'ACTIVE' }
    })
    const entity = existing ?? this.memberPriceRepo.create({
      tenantId: user.tenantId,
      customerId: dto.customerId,
      productId: dto.productId
    })
    entity.memberLevel = dto.memberLevel ?? 'NORMAL'
    entity.price = dto.price
    entity.effectiveDate = dto.effectiveDate ?? null
    entity.expireDate = dto.expireDate ?? null
    entity.createdBy = user.userId
    const saved = await this.memberPriceRepo.save(entity)
    await this.auditService.record({ bizType: 'pos_member_price', bizId: saved.id, action: 'SET_MEMBER_PRICE', afterValue: saved }, user)
    return saved
  }

  async memberPriceOf(customerId: number, productId: number, user: JwtUser): Promise<Record<string, unknown>> {
    const product = await this.productRepo.findOne({ where: { id: productId, tenantId: user.tenantId } })
    if (!product) throw new NotFoundException('产品不存在')
    const member = await this.memberPriceRepo.findOne({
      where: { tenantId: user.tenantId, customerId, productId, status: 'ACTIVE' }
    })
    const basePrice = this.num(product.price)
    const memberPrice = member ? this.num(member.price) : null
    return { basePrice, memberPrice, finalPrice: posMemberPrice(basePrice, memberPrice) }
  }

  /** POS 多支付：校验合计后登记支付流水 */
  async posPay(dto: PosPaymentDto, user: JwtUser): Promise<Record<string, unknown>> {
    const order = await this.orderRepo.findOne({ where: { id: dto.orderId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!order) throw new NotFoundException('销售单不存在')
    const total = this.num(order.totalAmount)
    const split = posPaymentSplit(total, dto.payments.map((item) => ({ payType: item.payType, amount: this.num(item.amount) })))
    if (!split.valid) throw new BadRequestException(split.reason ?? '支付金额校验失败')
    for (const item of dto.payments) {
      const entity = this.paymentRepo.create({
        tenantId: user.tenantId,
        orderId: order.id,
        payType: item.payType,
        amount: item.amount,
        tradeNo: item.tradeNo ?? null,
        createdBy: user.userId
      })
      await this.paymentRepo.save(entity)
    }
    order.paidAmount = this.money(total)
    order.payStatus = 'PAID'
    await this.orderRepo.save(order)
    await this.auditService.record({ bizType: 'pos_payment', bizId: order.id, action: 'POS_PAY', afterValue: { split, orderNo: order.orderNo } }, user)
    return { orderId: order.id, split }
  }

  /** 退货红字发票生成 */
  async createRedInvoice(dto: CreateRedInvoiceDto, user: JwtUser): Promise<SaleRedInvoiceEntity> {
    const invoice = buildRedInvoice({
      invoiceNo: dto.originInvoiceNo ?? 'ORIGIN',
      amount: this.num(dto.amount),
      taxAmount: dto.taxAmount ? this.num(dto.taxAmount) : 0,
      reason: dto.reason ?? null
    })
    const entity = this.redInvoiceRepo.create({
      tenantId: user.tenantId,
      returnId: dto.returnId ?? null,
      originInvoiceNo: dto.originInvoiceNo ?? null,
      invoiceNo: invoice.invoiceNo,
      amount: invoice.amount.toFixed(4),
      taxAmount: invoice.taxAmount.toFixed(4),
      invoiceType: invoice.invoiceType,
      reason: invoice.reason,
      createdBy: user.userId
    })
    const saved = await this.redInvoiceRepo.save(entity)
    if (dto.returnId) {
      const returnEntity = await this.returnRepo.findOne({ where: { id: dto.returnId, tenantId: user.tenantId, isDeleted: 0 } })
      if (returnEntity) {
        returnEntity.redInvoiceNo = saved.invoiceNo
        await this.returnRepo.save(returnEntity)
      }
    }
    await this.auditService.record({ bizType: 'sale_red_invoice', bizId: saved.id, action: 'CREATE_RED_INVOICE', afterValue: saved }, user)
    return saved
  }

  /** 销售目标达成预警 */
  async targetAlerts(user: JwtUser): Promise<Array<Record<string, unknown>>> {
    const targets = await this.targetRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    return targets.map((target) => ({
      id: target.id,
      userId: target.userId,
      period: target.period,
      targetAmount: target.targetAmount,
      actualAmount: target.actualAmount,
      ...salesTargetAlert(this.num(target.targetAmount), this.num(target.actualAmount))
    }))
  }

  private num(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10)
  }

  private money(value: number): string {
    return value.toFixed(4)
  }

  private async findLead(id: number, user: JwtUser): Promise<LeadEntity> {
    const entity = await this.leadRepo.findOne({ where: scopeWhere<LeadEntity>({ id, tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'ownerUserId' }) })
    if (!entity) throw new NotFoundException('线索不存在')
    return entity
  }

  private async findOpportunity(id: number, user: JwtUser): Promise<OpportunityEntity> {
    const entity = await this.opportunityRepo.findOne({ where: scopeWhere<OpportunityEntity>({ id, tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'ownerUserId' }) })
    if (!entity) throw new NotFoundException('商机不存在')
    return entity
  }

  private async findQuotation(id: number, user: JwtUser): Promise<QuotationEntity> {
    const entity = await this.quotationRepo.findOne({ where: scopeWhere<QuotationEntity>({ id, tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' }) })
    if (!entity) throw new NotFoundException('报价单不存在')
    return entity
  }

  private async findContract(id: number, user: JwtUser): Promise<SaleContractEntity> {
    const entity = await this.contractRepo.findOne({ where: scopeWhere<SaleContractEntity>({ id, tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' }) })
    if (!entity) throw new NotFoundException('销售合同不存在')
    return entity
  }

  private async findOrder(id: number, user: JwtUser): Promise<SaleOrderEntity> {
    const entity = await this.orderRepo.findOne({ where: scopeWhere<SaleOrderEntity>({ id, tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' }) })
    if (!entity) throw new NotFoundException('销售单不存在')
    return entity
  }

  private async findCustomer(id: number, user: JwtUser): Promise<CustomerEntity> {
    const entity = await this.customerRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('客户不存在')
    return entity
  }

  private async findProduct(id: number, user: JwtUser): Promise<ProductEntity> {
    const entity = await this.productRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('产品不存在')
    return entity
  }

  private async resolveWarehouseId(id: number | undefined, user: JwtUser): Promise<number> {
    if (id) {
      await this.findWarehouse(id, user)
      return id
    }
    const warehouses = await this.warehouseRepo.find({
      where: { tenantId: user.tenantId, isDeleted: 0, status: 'ACTIVE' },
      order: { isDefault: 'DESC', id: 'ASC' }
    })
    if (warehouses.length === 0) throw new BadRequestException('请先创建仓库')
    return warehouses[0].id
  }

  private async findWarehouse(id: number, user: JwtUser): Promise<WarehouseEntity> {
    const entity = await this.warehouseRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('仓库不存在')
    return entity
  }
}
