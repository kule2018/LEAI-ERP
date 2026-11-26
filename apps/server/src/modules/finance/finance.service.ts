import { randomBytes } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { scopeWhere } from '../../common/data-scope-context'
import { canUnpost, provisionalReversal } from '../../common/business-closure-engine'
import { evaluateCloseChecks, matchInvoice, reconcileBalance } from '../../common/finance-quality-rules'
import {
  buildAssetChangeDiff, buildCarryForwardPlan, buildDetailLedger, buildGroupedDetailLedger,
  buildSubjectBalanceTable, buildSubjectCarryForwardPlan, evaluateCarryForwardReversal, mergeOpeningBalances,
  validateAccountTransfer, type LedgerEntrySnapshot
} from '../../common/finance-period-rules'
import { validateSubjectUsage } from '../../common/finance-extension-engine'
import {
  buildDocumentRedLinePlan, buildRedLineEntries, buildSubjectMergePlan, canDisableSubject,
  canReleaseWriteoff, evaluateVoidVoucher, type RedLineEntryInput
} from '../../common/finance-redline-rules'
import { assetStocktakeDiff, allocateLandedCost, canTransitionCostJob, COST_JOB_STATUS, type CostJobStatus } from '../../common/asset-cost-rules'
import {
  buildCashFlowStatement, buildDepreciationVoucherEntries, canRunDepreciation,
  checkDepreciationCompleteness, computeMonthlyDepreciation, isAssetDepreciableInPeriod,
  type DepreciationMethod
} from '../../common/finance-closure-rules'
import {
  buildDrilldownQuery, buildFinanceCsv, REPORT_DRILLDOWN_CONFIG,
  summarizeDrilldownRows, type ReportMetricKey
} from '../../common/finance-report-drilldown-rules'
import { dedupeBankTransactions } from '../../common/procurement-rules'
import {
  buildTaxDeclaration, computeTaxAmount, validateCategory, validateTaxCode, type TaxDeclarationInput
} from '../../common/finance-tax-rules'
import { AuditService } from '../audit/audit.service'
import { createDomainEvent, DomainEventBus } from '../events/domain-event.module'
import { RevisionService } from '../revision/revision.service'
import { CostJobEntity } from './entities/cost-job.entity'
import { BankTransactionEntity } from './entities/bank-transaction.entity'
import {
  AccountTransferDto, AssetChangeDto, BuildTaxDeclarationDto, CarryForwardDto, ClosePeriodDto,
  CreateAccountDto, CreateAssetDto, CreateBudgetDto, CreateCategoryDto, CreateCostDto, CreateInvoiceDto,
  CreatePayableDto, CreateReceivableDto, CreateSubjectDto, CreateTaxCodeDto, CreateVoucherDto,
  QueryFinanceDto, QueryLedgerDto, SetOpeningBalanceDto
} from './dto'
import { FinOpeningBalanceEntity } from './entities/finance-ledger.entity'
import { FinCashFlowReportEntity } from './entities/finance-extension.entity'
import {
  FinAccountTransferEntity, FinAssetChangeEntity, FinPeriodCarryEntity
} from './entities/finance-period.entity'
import {
  AccountSubjectEntity, FinAccountEntity, FinAssetDepreciationEntity, FinAssetEntity,
  FinBudgetEntity, FinCategoryEntity, FinCostEntity, FinInvoiceEntity, FinPaymentEntity,
  FinPeriodEntity, FinReceiptEntity, FinTaxCodeEntity, FinTaxDeclarationEntity,
  FinWriteoffEntity, PayableEntity, ReceivableEntity, VoucherEntity, VoucherEntryEntity
} from './entities/finance.entities'

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(AccountSubjectEntity) private readonly subjectRepo: Repository<AccountSubjectEntity>,
    @InjectRepository(FinAccountEntity) private readonly accountRepo: Repository<FinAccountEntity>,
    @InjectRepository(VoucherEntity) private readonly voucherRepo: Repository<VoucherEntity>,
    @InjectRepository(VoucherEntryEntity) private readonly entryRepo: Repository<VoucherEntryEntity>,
    @InjectRepository(ReceivableEntity) private readonly arRepo: Repository<ReceivableEntity>,
    @InjectRepository(PayableEntity) private readonly apRepo: Repository<PayableEntity>,
    @InjectRepository(FinReceiptEntity) private readonly receiptRepo: Repository<FinReceiptEntity>,
    @InjectRepository(FinPaymentEntity) private readonly paymentRepo: Repository<FinPaymentEntity>,
    @InjectRepository(FinWriteoffEntity) private readonly writeoffRepo: Repository<FinWriteoffEntity>,
    @InjectRepository(FinInvoiceEntity) private readonly invoiceRepo: Repository<FinInvoiceEntity>,
    @InjectRepository(FinAssetEntity) private readonly assetRepo: Repository<FinAssetEntity>,
    @InjectRepository(FinAssetDepreciationEntity) private readonly depreciationRepo: Repository<FinAssetDepreciationEntity>,
    @InjectRepository(FinPeriodEntity) private readonly periodRepo: Repository<FinPeriodEntity>,
    @InjectRepository(FinCostEntity) private readonly costRepo: Repository<FinCostEntity>,
    @InjectRepository(CostJobEntity) private readonly costJobRepo: Repository<CostJobEntity>,
    @InjectRepository(BankTransactionEntity) private readonly bankTxRepo: Repository<BankTransactionEntity>,
    @InjectRepository(FinBudgetEntity) private readonly budgetRepo: Repository<FinBudgetEntity>,
    @InjectRepository(FinPeriodCarryEntity) private readonly carryRepo: Repository<FinPeriodCarryEntity>,
    @InjectRepository(FinAccountTransferEntity) private readonly transferRepo: Repository<FinAccountTransferEntity>,
    @InjectRepository(FinAssetChangeEntity) private readonly assetChangeRepo: Repository<FinAssetChangeEntity>,
    @InjectRepository(FinCashFlowReportEntity) private readonly cashFlowReportRepo: Repository<FinCashFlowReportEntity>,
    @InjectRepository(FinOpeningBalanceEntity) private readonly openingRepo: Repository<FinOpeningBalanceEntity>,
    @InjectRepository(FinTaxCodeEntity) private readonly taxCodeRepo: Repository<FinTaxCodeEntity>,
    @InjectRepository(FinTaxDeclarationEntity) private readonly taxDeclRepo: Repository<FinTaxDeclarationEntity>,
    @InjectRepository(FinCategoryEntity) private readonly categoryRepo: Repository<FinCategoryEntity>,
    private readonly auditService: AuditService,
    private readonly revisionService: RevisionService,
    private readonly eventBus: DomainEventBus
  ) {}

  /* ------------------------------ 税码税率与税务申报 ------------------------------ */

  async listTaxCodes(user: JwtUser): Promise<FinTaxCodeEntity[]> {
    return this.taxCodeRepo.find({ where: { tenantId: user.tenantId }, order: { taxCode: 'ASC' } })
  }

  async createTaxCode(dto: CreateTaxCodeDto, user: JwtUser): Promise<FinTaxCodeEntity> {
    const check = validateTaxCode({
      code: dto.taxCode, name: dto.taxName, rate: Number(dto.rate),
      taxType: dto.taxType as 'VAT', direction: (dto.direction ?? 'BOTH') as 'BOTH', status: 'ENABLED'
    })
    if (!check.ok) throw new BadRequestException(check.reason)
    const existing = await this.taxCodeRepo.findOne({ where: { tenantId: user.tenantId, taxCode: dto.taxCode } })
    if (existing) throw new BadRequestException('税码已存在')
    const saved = await this.taxCodeRepo.save(this.taxCodeRepo.create({
      tenantId: user.tenantId,
      taxCode: dto.taxCode,
      taxName: dto.taxName,
      taxType: dto.taxType,
      rate: Number(dto.rate).toFixed(6),
      direction: dto.direction ?? 'BOTH',
      subjectId: dto.subjectId ?? null,
      remark: dto.remark ?? null,
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'fin_tax_code', bizId: saved.id, action: 'CREATE_TAX_CODE', afterValue: saved }, user)
    return saved
  }

  /** 生成期间税务申报汇总：按税码汇总销项/进项税额 */
  async buildTaxDeclaration(dto: BuildTaxDeclarationDto, user: JwtUser): Promise<FinTaxDeclarationEntity> {
    const existing = await this.taxDeclRepo.findOne({ where: { tenantId: user.tenantId, period: dto.period } })
    if (existing && dto.declare !== true) return existing
    const codes = await this.taxCodeRepo.find({ where: { tenantId: user.tenantId, status: 'ENABLED' } })
    const invoices = await this.invoiceRepo.find({ where: { tenantId: user.tenantId } })
    const inputs: TaxDeclarationInput[] = []
    for (const invoice of invoices) {
      const period = this.periodOf(invoice.createdAt)
      if (period !== dto.period) continue
      const code = codes.find((item) => item.taxCode === (invoice.bizType ?? 'VAT')) ?? codes.find((item) => item.taxType === 'VAT')
      if (!code) continue
      inputs.push({
        taxCode: code.taxCode,
        taxName: code.taxName,
        taxType: code.taxType,
        direction: (code.direction === 'INPUT' ? 'INPUT' : 'OUTPUT') as 'INPUT' | 'OUTPUT',
        taxableAmount: this.num(invoice.amount),
        taxAmount: this.num(invoice.taxAmount)
      })
    }
    const result = buildTaxDeclaration(inputs)
    const entity = existing ?? this.taxDeclRepo.create({
      tenantId: user.tenantId,
      period: dto.period,
      declarationNo: `TAX${dto.period.replace('-', '')}${randomBytes(2).toString('hex').toUpperCase()}`,
      createdBy: user.userId
    })
    entity.totalOutputTax = result.totalOutputTax.toFixed(4)
    entity.totalInputTax = result.totalInputTax.toFixed(4)
    entity.taxPayable = result.taxPayable.toFixed(4)
    entity.details = result.rows as unknown as Array<Record<string, unknown>>
    if (dto.declare === true) {
      entity.status = 'DECLARED'
      entity.declaredAt = new Date()
    }
    const saved = await this.taxDeclRepo.save(entity)
    await this.auditService.record({
      bizType: 'fin_tax_declaration', bizId: saved.id, action: 'BUILD_TAX_DECLARATION',
      afterValue: { period: dto.period, taxPayable: saved.taxPayable, declared: dto.declare === true }
    }, user)
    return saved
  }

  /** 价税分离试算 */
  calcTax(amount: number, rate: number, inclusive = false): { netAmount: number; taxAmount: number; grossAmount: number } {
    return computeTaxAmount(amount, rate, inclusive)
  }

  /* ------------------------------ 费用/收入类别主数据 ------------------------------ */

  async listCategories(categoryType?: string, user?: JwtUser): Promise<FinCategoryEntity[]> {
    const tenantId = user?.tenantId
    if (tenantId === undefined) return []
    return this.categoryRepo.find({
      where: { tenantId, ...(categoryType ? { categoryType } : {}) },
      order: { categoryType: 'ASC', sortNo: 'ASC', categoryCode: 'ASC' }
    })
  }

  async createCategory(dto: CreateCategoryDto, user: JwtUser): Promise<FinCategoryEntity> {
    const check = validateCategory({
      code: dto.categoryCode, name: dto.categoryName,
      categoryType: dto.categoryType as 'EXPENSE', parentCode: dto.parentCode ?? null
    })
    if (!check.ok) throw new BadRequestException(check.reason)
    const existing = await this.categoryRepo.findOne({
      where: { tenantId: user.tenantId, categoryType: dto.categoryType, categoryCode: dto.categoryCode }
    })
    if (existing) throw new BadRequestException('类别编码已存在')
    const saved = await this.categoryRepo.save(this.categoryRepo.create({
      tenantId: user.tenantId,
      categoryType: dto.categoryType,
      categoryCode: dto.categoryCode,
      categoryName: dto.categoryName,
      parentCode: dto.parentCode ?? null,
      subjectId: dto.subjectId ?? null,
      sortNo: dto.sortNo ?? 0,
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'fin_category', bizId: saved.id, action: 'CREATE_CATEGORY', afterValue: saved }, user)
    return saved
  }

  async listSubjects(query: QueryFinanceDto, user: JwtUser): Promise<PageResult<AccountSubjectEntity>> {
    const where = scopeWhere<AccountSubjectEntity>({ tenantId: user.tenantId, isDeleted: 0, ...(query.status ? { status: query.status } : {}) }, user)
    const [list, total] = await this.subjectRepo.findAndCount({ where, order: { subjectCode: 'ASC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createSubject(dto: CreateSubjectDto, user: JwtUser): Promise<AccountSubjectEntity> {
    const existing = await this.subjectRepo.findOne({ where: { tenantId: user.tenantId, subjectCode: dto.subjectCode, isDeleted: 0 } })
    if (existing) throw new BadRequestException('科目编码已存在')
    const entity = this.subjectRepo.create({
      ...dto,
      tenantId: user.tenantId,
      parentId: dto.parentId ?? null,
      direction: dto.direction ?? (dto.category === 'LIABILITY' || dto.category === 'EQUITY' || dto.category === 'INCOME' ? 'CREDIT' : 'DEBIT'),
      auxType: dto.auxType ?? null,
      isLeaf: 1
    })
    const saved = await this.subjectRepo.save(entity)
    await this.auditService.record({ bizType: 'account_subject', bizId: saved.id, action: 'CREATE_SUBJECT', afterValue: saved }, user)
    return saved
  }

  /** 科目启用/停用与基础信息更新：停用前校验科目余额 */
  async updateSubject(
    id: number,
    dto: { subjectName?: string; status?: string; disableReason?: string },
    user: JwtUser
  ): Promise<AccountSubjectEntity> {
    const subject = await this.subjectRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!subject) throw new NotFoundException('科目不存在')
    if (dto.subjectName) subject.subjectName = dto.subjectName
    if (dto.status && dto.status !== subject.status) {
      if (dto.status === 'DISABLED') {
        const balance = await this.subjectBalanceOf(id, user)
        const check = canDisableSubject({ status: subject.status, balance, usedInVoucher: balance !== 0 })
        if (!check.ok) throw new BadRequestException(check.reason ?? '无法停用科目')
        subject.status = 'DISABLED'
        subject.disabledAt = new Date()
        subject.disableReason = dto.disableReason ?? null
      } else {
        subject.status = dto.status
        subject.disabledAt = null
        subject.disableReason = null
      }
    }
    const saved = await this.subjectRepo.save(subject)
    await this.auditService.record({
      bizType: 'account_subject', bizId: id, action: 'UPDATE_SUBJECT',
      afterValue: { subjectName: saved.subjectName, status: saved.status, disableReason: saved.disableReason }
    }, user)
    return saved
  }

  /**
   * 科目合并：把源科目的分录迁移到目标科目，源科目置为 MERGED。
   * 已被过账凭证引用的科目需先反审核，避免篡改历史账。
   */
  async mergeSubjects(dto: { sourceSubjectId: number; targetSubjectId: number }, user: JwtUser): Promise<Record<string, unknown>> {
    if (dto.sourceSubjectId === dto.targetSubjectId) throw new BadRequestException('源科目与目标科目不能相同')
    const source = await this.subjectRepo.findOne({ where: { id: dto.sourceSubjectId, tenantId: user.tenantId, isDeleted: 0 } })
    const target = await this.subjectRepo.findOne({ where: { id: dto.targetSubjectId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!source) throw new NotFoundException('源科目不存在')
    if (!target) throw new NotFoundException('目标科目不存在')
    const entries = await this.entryRepo.find({ where: { tenantId: user.tenantId, subjectId: source.id } })
    const voucherIds = [...new Set(entries.map((item) => item.voucherId))]
    const vouchers = voucherIds.length > 0
      ? await this.voucherRepo.find({ where: { tenantId: user.tenantId, id: In(voucherIds) } })
      : []
    if (vouchers.some((item) => item.status === 'POSTED')) {
      throw new BadRequestException('源科目已被过账凭证引用，请先反审核相关凭证再合并')
    }
    const sourceBalance = await this.subjectBalanceOf(source.id, user)
    const targetBalance = await this.subjectBalanceOf(target.id, user)
    const plan = buildSubjectMergePlan({
      sourceBalance,
      targetBalance,
      sourceCategory: source.category,
      targetCategory: target.category,
      sourceUsed: entries.length > 0
    }, entries.length)
    if (!plan.ok) throw new BadRequestException(plan.reason ?? '无法合并科目')
    for (const entry of entries) {
      entry.subjectId = target.id
      await this.entryRepo.save(entry)
    }
    source.status = 'MERGED'
    source.disabledAt = new Date()
    source.disableReason = `合并至科目 ${target.subjectCode} ${target.subjectName}`
    await this.subjectRepo.save(source)
    await this.auditService.record({
      bizType: 'account_subject', bizId: source.id, action: 'MERGE_SUBJECT',
      afterValue: { targetSubjectId: target.id, migratedEntryCount: plan.migratedEntryCount, mergedBalance: plan.mergedBalance }
    }, user)
    return {
      source: { id: source.id, subjectCode: source.subjectCode, subjectName: source.subjectName, status: source.status },
      target: { id: target.id, subjectCode: target.subjectCode, subjectName: target.subjectName },
      migratedEntryCount: plan.migratedEntryCount,
      mergedBalance: plan.mergedBalance
    }
  }

  async listAccounts(query: QueryFinanceDto, user: JwtUser): Promise<PageResult<FinAccountEntity>> {
    const where = scopeWhere<FinAccountEntity>({ tenantId: user.tenantId, isDeleted: 0 }, user)
    const [list, total] = await this.accountRepo.findAndCount({ where, order: { id: 'ASC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createAccount(dto: CreateAccountDto, user: JwtUser): Promise<FinAccountEntity> {
    const existing = await this.accountRepo.findOne({ where: { tenantId: user.tenantId, accountCode: dto.accountCode, isDeleted: 0 } })
    if (existing) throw new BadRequestException('资金账户编码已存在')
    const entity = this.accountRepo.create({
      ...dto,
      tenantId: user.tenantId,
      accountType: dto.accountType ?? 'BANK',
      currencyCode: dto.currencyCode ?? 'CNY',
      balance: dto.balance ?? '0'
    })
    const saved = await this.accountRepo.save(entity)
    await this.auditService.record({ bizType: 'fin_account', bizId: saved.id, action: 'CREATE_ACCOUNT', afterValue: saved }, user)
    return saved
  }

  async listVouchers(query: QueryFinanceDto, user: JwtUser): Promise<PageResult<VoucherEntity>> {
    const where = scopeWhere<VoucherEntity>({
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.status ? { status: query.status } : {}),
      ...(query.period ? { period: query.period } : {})
    }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.voucherRepo.findAndCount({ where, order: { voucherDate: 'DESC', id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async voucherDetail(id: number, user: JwtUser): Promise<{ voucher: VoucherEntity; entries: VoucherEntryEntity[] }> {
    const voucher = await this.voucherRepo.findOne({ where: scopeWhere<VoucherEntity>({ id, tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' }) })
    if (!voucher) throw new NotFoundException('凭证不存在')
    const entries = await this.entryRepo.find({ where: { tenantId: user.tenantId, voucherId: id }, order: { lineNo: 'ASC' } })
    return { voucher, entries }
  }

  async createVoucher(dto: CreateVoucherDto, user: JwtUser): Promise<VoucherEntity> {
    const debit = dto.entries.reduce((sum, line) => sum + this.num(line.debit), 0)
    const credit = dto.entries.reduce((sum, line) => sum + this.num(line.credit), 0)
    if (Math.abs(debit - credit) > 0.00001) {
      throw new BadRequestException(`借贷不平衡，无法保存凭证，差额 ${this.money(debit - credit)}`)
    }
    await this.validateEntries(dto.entries, user, dto.sourceType)

    const voucher = await this.voucherRepo.save(this.voucherRepo.create({
      tenantId: user.tenantId,
      voucherNo: this.number('V'),
      voucherDate: dto.voucherDate,
      period: dto.period,
      sourceType: dto.sourceType ?? null,
      sourceId: dto.sourceId ?? null,
      totalDebit: this.money(debit),
      totalCredit: this.money(credit),
      remark: dto.remark ?? null,
      createdBy: user.userId
    }))
    for (let index = 0; index < dto.entries.length; index += 1) {
      const line = dto.entries[index]
      await this.entryRepo.save(this.entryRepo.create({
        tenantId: user.tenantId,
        voucherId: voucher.id,
        lineNo: index + 1,
        subjectId: line.subjectId,
        summary: line.summary,
        debit: line.debit ?? '0',
        credit: line.credit ?? '0',
        period: dto.period,
        auxType: line.auxType ?? null,
        auxId: line.auxId ?? null
      }))
    }
    await this.auditService.record({ bizType: 'voucher', bizId: voucher.id, action: 'CREATE_VOUCHER', afterValue: voucher }, user)
    // 统一版本快照：凭证留存版本，便于追溯过账前后的分录变化
    await this.revisionService.recordSafe({
      entityCode: 'FIN_VOUCHER',
      bizId: voucher.id,
      action: 'CREATE',
      source: 'FINANCE',
      snapshot: {
        voucherNo: voucher.voucherNo,
        status: voucher.status,
        voucherDate: voucher.voucherDate,
        period: voucher.period,
        sourceType: voucher.sourceType ?? null,
        sourceId: voucher.sourceId ?? null,
        totalDebit: voucher.totalDebit,
        totalCredit: voucher.totalCredit,
        remark: voucher.remark ?? null,
        entries: dto.entries.map((line) => ({
          subjectId: line.subjectId,
          summary: line.summary ?? null,
          debit: line.debit ?? '0',
          credit: line.credit ?? '0',
          auxType: line.auxType ?? null,
          auxId: line.auxId ?? null
        }))
      }
    }, user)
    return voucher
  }

  async postVoucher(id: number, user: JwtUser): Promise<VoucherEntity> {
    const voucher = await this.voucherRepo.findOne({ where: scopeWhere<VoucherEntity>({ id, tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' }) })
    if (!voucher) throw new NotFoundException('凭证不存在')
    if (voucher.status !== 'DRAFT') throw new BadRequestException('只有草稿凭证可以过账')
    await this.ensurePeriodOpen(voucher.period, user)
    voucher.status = 'POSTED'
    voucher.postedAt = new Date()
    const saved = await this.voucherRepo.save(voucher)
    await this.auditService.record({ bizType: 'voucher', bizId: id, action: 'POST_VOUCHER' }, user)
    // 统一版本快照：过账是财务关键节点，留存当时的凭证版本供追溯
    await this.revisionService.recordSafe({
      entityCode: 'FIN_VOUCHER',
      bizId: saved.id,
      action: 'POST',
      source: 'FINANCE',
      snapshot: {
        voucherNo: saved.voucherNo,
        status: saved.status,
        voucherDate: saved.voucherDate,
        period: saved.period,
        sourceType: saved.sourceType ?? null,
        sourceId: saved.sourceId ?? null,
        totalDebit: saved.totalDebit,
        totalCredit: saved.totalCredit,
        remark: saved.remark ?? null
      }
    }, user)
    return saved
  }

  /** 反审核：已过账凭证退回草稿，期间已结账或有红冲引用时禁止 */
  async unpostVoucher(id: number, user: JwtUser): Promise<VoucherEntity> {
    const voucher = await this.voucherRepo.findOne({ where: scopeWhere<VoucherEntity>({ id, tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' }) })
    if (!voucher) throw new NotFoundException('凭证不存在')
    const periodEntity = await this.periodRepo.findOne({ where: { tenantId: user.tenantId, period: voucher.period } })
    const periodClosed = periodEntity?.status === 'CLOSED'
    const references = await this.voucherRepo.count({ where: { tenantId: user.tenantId, sourceId: voucher.id, isDeleted: 0 } })
    const check = canUnpost(voucher.status, periodClosed, references > 0)
    if (!check.ok) throw new BadRequestException(check.reason ?? '无法反审核')
    voucher.status = 'DRAFT'
    voucher.postedAt = null as unknown as Date
    const saved = await this.voucherRepo.save(voucher)
    await this.auditService.record({ bizType: 'voucher', bizId: id, action: 'UNPOST_VOUCHER' }, user)
    return saved
  }

  /** 暂估差额校验：发票与暂估金额差异，供暂估入库调整使用 */
  checkProvisionalDifference(provisionalAmount: number, invoiceAmount: number) {
    return provisionalReversal(provisionalAmount, invoiceAmount)
  }

  /** 凭证作废：仅草稿可作废；已过账需先反审核，期间已结账或被引用时拒绝 */
  async voidVoucher(id: number, dto: { reason?: string }, user: JwtUser): Promise<VoucherEntity> {
    const voucher = await this.voucherRepo.findOne({ where: scopeWhere<VoucherEntity>({ id, tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' }) })
    if (!voucher) throw new NotFoundException('凭证不存在')
    const periodEntity = await this.periodRepo.findOne({ where: { tenantId: user.tenantId, period: voucher.period } })
    const references = await this.voucherRepo.count({ where: { tenantId: user.tenantId, sourceId: voucher.id, isDeleted: 0 } })
    const check = evaluateVoidVoucher({
      status: voucher.status,
      periodClosed: periodEntity?.status === 'CLOSED',
      hasReferences: references > 0
    })
    if (!check.ok) throw new BadRequestException(check.reason ?? '无法作废凭证')
    voucher.status = 'VOID'
    voucher.voidedAt = new Date()
    voucher.voidReason = dto.reason ?? null
    const saved = await this.voucherRepo.save(voucher)
    await this.auditService.record({ bizType: 'voucher', bizId: id, action: 'VOID_VOUCHER', afterValue: { reason: dto.reason ?? null } }, user)
    return saved
  }

  async reverseVoucher(id: number, user: JwtUser): Promise<VoucherEntity> {
    const voucher = await this.voucherRepo.findOne({ where: scopeWhere<VoucherEntity>({ id, tenantId: user.tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' }) })
    if (!voucher) throw new NotFoundException('凭证不存在')
    if (voucher.status !== 'POSTED') throw new BadRequestException('只有已过账凭证可以红冲')
    const entries = await this.entryRepo.find({ where: { tenantId: user.tenantId, voucherId: id }, order: { lineNo: 'ASC' } })
    const reversed = await this.createVoucher({
      voucherDate: voucher.voucherDate,
      period: voucher.period,
      sourceType: 'REVERSE',
      sourceId: voucher.id,
      remark: `红冲凭证 ${voucher.voucherNo}`,
      entries: entries.map((line) => ({
        subjectId: line.subjectId,
        summary: `红冲：${line.summary}`,
        debit: line.credit,
        credit: line.debit,
        auxType: line.auxType ?? undefined,
        auxId: line.auxId ?? undefined
      }))
    }, user)
    voucher.status = 'CANCELLED'
    await this.voucherRepo.save(voucher)
    return this.postVoucher(reversed.id, user)
  }

  async trialBalance(query: QueryFinanceDto, user: JwtUser): Promise<Array<Record<string, unknown>>> {
    const period = query.period ?? new Date().toISOString().slice(0, 7)
    const vouchers = await this.voucherRepo.find({ where: { tenantId: user.tenantId, status: 'POSTED', period, isDeleted: 0 } })
    if (vouchers.length === 0) return []
    const entries = await this.entryRepo.find({ where: { tenantId: user.tenantId, period } })
    const voucherIds = new Set(vouchers.map((item) => item.id))
    const subjects = await this.subjectRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const map = new Map<number, { debit: number; credit: number }>()
    for (const entry of entries) {
      if (!voucherIds.has(entry.voucherId)) continue
      const current = map.get(entry.subjectId) ?? { debit: 0, credit: 0 }
      current.debit += this.num(entry.debit)
      current.credit += this.num(entry.credit)
      map.set(entry.subjectId, current)
    }
    return [...map.entries()].map(([subjectId, value]) => {
      const subject = subjects.find((item) => item.id === subjectId)
      return {
        subjectId,
        subjectCode: subject?.subjectCode ?? '',
        subjectName: subject?.subjectName ?? '',
        debit: this.money(value.debit),
        credit: this.money(value.credit),
        balance: this.money(value.debit - value.credit)
      }
    })
  }

  async statements(query: QueryFinanceDto, user: JwtUser): Promise<Record<string, unknown>> {
    const period = query.period ?? new Date().toISOString().slice(0, 7)
    const balance = await this.trialBalance({ ...query, period }, user)
    const subjects = await this.subjectRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    let income = 0
    let expense = 0
    let assets = 0
    let liabilities = 0
    let equity = 0
    for (const row of balance) {
      const subject = subjects.find((item) => item.id === Number(row.subjectId))
      const debit = Number(row.debit)
      const credit = Number(row.credit)
      if (subject?.category === 'INCOME') income += credit - debit
      if (subject?.category === 'EXPENSE') expense += debit - credit
      if (subject?.category === 'ASSET') assets += debit - credit
      if (subject?.category === 'LIABILITY') liabilities += credit - debit
      if (subject?.category === 'EQUITY') equity += credit - debit
    }
    const receipts = await this.receiptRepo.find({ where: { tenantId: user.tenantId } })
    const payments = await this.paymentRepo.find({ where: { tenantId: user.tenantId } })
    return {
      period,
      incomeStatement: { income: this.money(income), expense: this.money(expense), profit: this.money(income - expense) },
      balanceSheet: { assets: this.money(assets), liabilities: this.money(liabilities), equity: this.money(equity), balanced: Math.abs(assets - liabilities - equity - (income - expense)) < 0.00001 },
      cashFlow: {
        inflow: this.money(receipts.filter((item) => item.receivedAt.startsWith(period)).reduce((sum, item) => sum + this.num(item.amount), 0)),
        outflow: this.money(payments.filter((item) => item.paidAt.startsWith(period)).reduce((sum, item) => sum + this.num(item.amount), 0))
      }
    }
  }

  /** 正式现金流量表：按经营/投资/筹资活动分类汇总，期初余额取账户期初+上期净增 */
  async cashFlowStatement(period: string, user: JwtUser): Promise<Record<string, unknown>> {
    const accounts = await this.accountRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const receipts = await this.receiptRepo.find({ where: { tenantId: user.tenantId } })
    const payments = await this.paymentRepo.find({ where: { tenantId: user.tenantId } })
    const inPeriod = (date: string | null): boolean => !!date && String(date).slice(0, 7) === period
    const transactions = [
      ...receipts.filter((item) => inPeriod(item.receivedAt)).map((item) => ({
        id: item.id, sourceType: (item as { sourceType?: string | null }).sourceType ?? 'RECEIPT',
        amount: this.num(item.amount), date: String(item.receivedAt), direction: 'IN' as const
      })),
      ...payments.filter((item) => inPeriod(item.paidAt)).map((item) => ({
        id: item.id, sourceType: (item as { sourceType?: string | null }).sourceType ?? 'PAYMENT',
        amount: this.num(item.amount), date: String(item.paidAt), direction: 'OUT' as const
      }))
    ]
    const currentBalance = accounts.reduce((sum, item) => sum + this.num(item.balance), 0)
    const currentNet = transactions.reduce((sum, item) => sum + (item.direction === 'IN' ? item.amount : -item.amount), 0)
    const openingBalance = Number((currentBalance - currentNet).toFixed(4))
    const statement = buildCashFlowStatement({ transactions, openingBalance, period })
    return {
      ...statement,
      sections: statement.sections.map((section) => ({ ...section, label: { OPERATING: '经营活动', INVESTING: '投资活动', FINANCING: '筹资活动' }[section.category] })),
      accountCount: accounts.length
    }
  }

  /**
   * 出具正式现金流量表：固化快照并留痕。
   * 正式报表要求会计期间已结账（数据锁定），未结账时仅允许出具预览版。
   */
  async issueCashFlowReport(
    period: string,
    user: JwtUser,
    options?: { remark?: string; reportType?: 'OFFICIAL' | 'PREVIEW' }
  ): Promise<FinCashFlowReportEntity> {
    const closed = await this.isPeriodClosed(period, user)
    const reportType = options?.reportType ?? 'OFFICIAL'
    if (reportType === 'OFFICIAL' && !closed) {
      throw new BadRequestException('会计期间未结账，不能出具正式现金流量表')
    }
    const statement = await this.cashFlowStatement(period, user)
    const snapshot = {
      period,
      reportType,
      issuedAt: new Date().toISOString(),
      sections: statement.sections,
      openingBalance: statement.openingBalance,
      endingBalance: statement.endingBalance,
      netIncrease: statement.netIncrease,
      accountCount: statement.accountCount ?? null
    }
    const seq = await this.cashFlowReportRepo.count({ where: { tenantId: user.tenantId, period } })
    const entity = this.cashFlowReportRepo.create({
      tenantId: user.tenantId,
      reportNo: `CFR-${period}-${String(seq + 1).padStart(3, '0')}`,
      period,
      reportType,
      snapshot,
      status: 'ISSUED',
      issuedBy: user.userId,
      issuedAt: new Date(),
      remark: options?.remark ?? null
    })
    const saved = await this.cashFlowReportRepo.save(entity)
    await this.auditService.record({
      bizType: 'fin_cashflow_report', bizId: saved.id, action: 'ISSUE_CASHFLOW_REPORT',
      afterValue: { period, reportType, reportNo: saved.reportNo }
    }, user)
    return saved
  }

  /** 现金流量表出具记录（含作废） */
  async listCashFlowReports(query: { period?: string }, user: JwtUser): Promise<FinCashFlowReportEntity[]> {
    const where: Record<string, unknown> = { tenantId: user.tenantId }
    if (query.period) where.period = query.period
    return this.cashFlowReportRepo.find({ where: where as never, order: { id: 'DESC' } })
  }

  /** 现金流量表出具详情 */
  async getCashFlowReport(id: number, user: JwtUser): Promise<FinCashFlowReportEntity> {
    const entity = await this.cashFlowReportRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('现金流量表出具记录不存在')
    return entity
  }

  /** 作废已出具的现金流量表（保留留痕，不物理删除） */
  async voidCashFlowReport(id: number, reason: string, user: JwtUser): Promise<FinCashFlowReportEntity> {
    const entity = await this.getCashFlowReport(id, user)
    if (entity.status === 'VOID') throw new BadRequestException('该报表已作废')
    entity.status = 'VOID'
    entity.remark = reason
    const saved = await this.cashFlowReportRepo.save(entity)
    await this.auditService.record({
      bizType: 'fin_cashflow_report', bizId: id, action: 'VOID_CASHFLOW_REPORT',
      afterValue: { reason }
    }, user)
    return saved
  }

  /**
   * 报表指标下钻：指标 → 科目类别 → 科目余额，返回可继续下钻明细账的科目列表
   */
  async statementDrilldown(
    key: ReportMetricKey,
    period: string,
    user: JwtUser
  ): Promise<Record<string, unknown>> {
    const config = REPORT_DRILLDOWN_CONFIG[key]
    if (!config) throw new BadRequestException(`未知的报表指标：${key}`)
    const subjects = await this.subjectRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const balance = await this.trialBalance({ period, page: 1, pageSize: 1 }, user)
    const balanceMap = new Map(balance.map((row) => [Number(row.subjectId), row]))
    const rows = subjects
      .filter((subject) => config.categories.includes(subject.category) && balanceMap.has(subject.id))
      .map((subject) => {
        const entry = balanceMap.get(subject.id)
        return {
          subjectId: subject.id,
          subjectCode: subject.subjectCode,
          subjectName: subject.subjectName,
          debit: this.num(entry?.debit as string | number | null | undefined),
          credit: this.num(entry?.credit as string | number | null | undefined)
        }
      })
    const result = summarizeDrilldownRows(rows, config.side)
    const query = buildDrilldownQuery(key, period, result.rows.map((row) => row.subjectId))
    return { ...query, rows: result.rows, total: result.total }
  }

  /** 报表导出：三大报表 / 科目余额表 / 明细账，附导出水印与敏感字段脱敏 */
  async exportReportCsv(
    dto: { type: string; period: string; subjectId?: number; subjectIds?: number[] },
    user: JwtUser
  ): Promise<{ filename: string; content: string }> {
    const period = dto.period || new Date().toISOString().slice(0, 7)
    let header: string[]
    let rows: Array<Array<string | number | boolean | null | undefined>>
    if (dto.type === 'statements') {
      const report = await this.statements({ period, page: 1, pageSize: 1 }, user)
      const cashFlow = await this.cashFlowStatement(period, user)
      header = ['报表', '指标', '金额', '期间']
      rows = [
        ['利润表', '收入', String((report.incomeStatement as Record<string, unknown>).income ?? ''), period],
        ['利润表', '费用', String((report.incomeStatement as Record<string, unknown>).expense ?? ''), period],
        ['利润表', '利润', String((report.incomeStatement as Record<string, unknown>).profit ?? ''), period],
        ['资产负债表', '资产', String((report.balanceSheet as Record<string, unknown>).assets ?? ''), period],
        ['资产负债表', '负债', String((report.balanceSheet as Record<string, unknown>).liabilities ?? ''), period],
        ['资产负债表', '权益', String((report.balanceSheet as Record<string, unknown>).equity ?? ''), period]
      ]
      for (const section of (cashFlow.sections ?? []) as Array<Record<string, unknown>>) {
        rows.push(['现金流量表', String(section.label ?? ''), String(section.net ?? ''), period])
      }
    } else if (dto.type === 'balance') {
      const report = await this.subjectBalance({ period, page: 1, pageSize: 1, subjectId: dto.subjectId }, user)
      header = ['科目编码', '科目名称', '期初余额', '本期借方', '本期贷方', '期末余额', '方向']
      rows = (report.rows as Array<Record<string, unknown>>).map((row) => [
        String(row.subjectCode ?? ''), String(row.subjectName ?? ''), String(row.openingBalance ?? ''),
        String(row.periodDebit ?? ''), String(row.periodCredit ?? ''), String(row.closingBalance ?? ''),
        String(row.balanceDirection ?? '')
      ])
    } else if (dto.type === 'ledger') {
      if (!dto.subjectId && (!dto.subjectIds || dto.subjectIds.length === 0)) {
        throw new BadRequestException('导出明细账需指定科目')
      }
      const report = await this.detailLedger({ period, page: 1, pageSize: 1, subjectId: dto.subjectId, subjectIds: dto.subjectIds } as never, user)
      header = ['科目编码', '科目名称', '日期', '凭证号', '摘要', '借方', '贷方', '累计余额']
      rows = []
      const cell = (value: unknown): string => String(value ?? '')
      const groups = (report.groups ?? []) as Array<Record<string, unknown>>
      if (groups.length > 0) {
        for (const group of groups) {
          const groupRows = (group.rows ?? []) as Array<Record<string, unknown>>
          for (const row of groupRows) {
            rows.push([
              cell(group.subjectCode), cell(group.subjectName), cell(row.date), cell(row.voucherNo),
              cell(row.summary), cell(row.debit), cell(row.credit), cell(row.runningBalance)
            ])
          }
        }
      } else {
        for (const row of ((report.rows ?? []) as Array<Record<string, unknown>>)) {
          rows.push([
            cell(report.subjectCode), cell(report.subjectName), cell(row.date), cell(row.voucherNo),
            cell(row.summary), cell(row.debit), cell(row.credit), cell(row.runningBalance)
          ])
        }
      }
    } else {
      throw new BadRequestException('不支持的报表导出类型')
    }
    const content = buildFinanceCsv(header, rows, user)
    const filename = `finance-${dto.type}-${period}.csv`
    await this.auditService.record({
      bizType: 'finance_report', bizId: 0, action: 'EXPORT_REPORT',
      afterValue: { type: dto.type, period, rowCount: rows.length }
    }, user)
    return { filename, content }
  }

  async listReceivables(query: QueryFinanceDto, user: JwtUser): Promise<PageResult<ReceivableEntity>> {
    const where = scopeWhere<ReceivableEntity>({ tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }, user)
    const [list, total] = await this.arRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createReceivable(dto: CreateReceivableDto, user: JwtUser): Promise<ReceivableEntity> {
    const entity = this.arRepo.create({ ...dto, tenantId: user.tenantId, sourceType: dto.sourceType ?? null, sourceId: dto.sourceId ?? null, sourceNo: dto.sourceNo ?? null, dueDate: dto.dueDate ?? null })
    const saved = await this.arRepo.save(entity)
    await this.auditService.record({ bizType: 'receivable', bizId: saved.id, action: 'CREATE_RECEIVABLE', afterValue: saved }, user)
    return saved
  }

  async listPayables(query: QueryFinanceDto, user: JwtUser): Promise<PageResult<PayableEntity>> {
    const where = scopeWhere<PayableEntity>({ tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }, user)
    const [list, total] = await this.apRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createPayable(dto: CreatePayableDto, user: JwtUser): Promise<PayableEntity> {
    const entity = this.apRepo.create({ ...dto, tenantId: user.tenantId, sourceType: dto.sourceType ?? null, sourceId: dto.sourceId ?? null, sourceNo: dto.sourceNo ?? null, dueDate: dto.dueDate ?? null })
    const saved = await this.apRepo.save(entity)
    await this.auditService.record({ bizType: 'payable', bizId: saved.id, action: 'CREATE_PAYABLE', afterValue: saved }, user)
    return saved
  }

  async createReceipt(dto: { customerId: number; accountId: number; amount: string; receivedAt: string; writeoffs?: Array<{ bizType: string; bizId: number; amount: string }> }, user: JwtUser): Promise<FinReceiptEntity> {
    const account = await this.accountRepo.findOne({ where: { id: dto.accountId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!account) throw new NotFoundException('资金账户不存在')
    const receipt = await this.receiptRepo.save(this.receiptRepo.create({
      tenantId: user.tenantId,
      receiptNo: this.number('RCP'),
      customerId: dto.customerId,
      accountId: dto.accountId,
      amount: dto.amount,
      receivedAt: dto.receivedAt,
      createdBy: user.userId
    }))
    account.balance = this.money(this.num(account.balance) + this.num(dto.amount))
    await this.accountRepo.save(account)
    for (const item of dto.writeoffs ?? []) {
      await this.applyWriteoff(item, 'RECEIPT', receipt.id, user)
    }
    await this.auditService.record({ bizType: 'fin_receipt', bizId: receipt.id, action: 'CREATE_RECEIPT', afterValue: receipt }, user)
    await this.eventBus.emit(createDomainEvent('finance.receipt.created', user, 'fin_receipt', receipt.id, { amount: this.num(receipt.amount) }))
    return receipt
  }

  async createPayment(dto: { supplierId: number; accountId: number; amount: string; paidAt: string; writeoffs?: Array<{ bizType: string; bizId: number; amount: string }> }, user: JwtUser): Promise<FinPaymentEntity> {
    const account = await this.accountRepo.findOne({ where: { id: dto.accountId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!account) throw new NotFoundException('资金账户不存在')
    const payment = await this.paymentRepo.save(this.paymentRepo.create({
      tenantId: user.tenantId,
      paymentNo: this.number('PAY'),
      supplierId: dto.supplierId,
      accountId: dto.accountId,
      amount: dto.amount,
      paidAt: dto.paidAt,
      createdBy: user.userId
    }))
    account.balance = this.money(this.num(account.balance) - this.num(dto.amount))
    await this.accountRepo.save(account)
    for (const item of dto.writeoffs ?? []) {
      await this.applyWriteoff(item, 'PAYMENT', payment.id, user)
    }
    await this.auditService.record({ bizType: 'fin_payment', bizId: payment.id, action: 'CREATE_PAYMENT', afterValue: payment }, user)
    await this.eventBus.emit(createDomainEvent('finance.payment.created', user, 'fin_payment', payment.id, { amount: this.num(payment.amount) }))
    return payment
  }

  /** 应收单红冲：释放核销、登记红字应收单，并按需生成红字凭证 */
  async reverseReceivable(id: number, dto: { reason?: string; entries?: RedLineEntryInput[] }, user: JwtUser): Promise<Record<string, unknown>> {
    const ar = await this.arRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!ar) throw new NotFoundException('应收单不存在')
    const period = this.periodOf(ar.createdAt)
    const plan = buildDocumentRedLinePlan({
      type: 'RECEIVABLE',
      amount: ar.amount,
      settledAmount: ar.receivedAmount,
      status: ar.status,
      periodClosed: await this.isPeriodClosed(period, user),
      provisionAmount: ar.provisionAmount
    })
    if (!plan.ok) throw new BadRequestException(plan.reason ?? '无法红冲应收单')
    const writeoffs = await this.writeoffRepo.find({ where: { tenantId: user.tenantId, bizType: 'RECEIVABLE', bizId: ar.id } })
    const writeoffTotal = writeoffs.reduce((sum, item) => sum + this.num(item.amount), 0)
    const releaseCheck = canReleaseWriteoff({ settledAmount: ar.receivedAmount, writeoffAmount: writeoffTotal })
    if (!releaseCheck.ok) throw new BadRequestException(releaseCheck.reason ?? '核销数据不一致，无法红冲')
    const released = await this.releaseWriteoffs('RECEIPT', ar.id, user)
    ar.receivedAmount = '0.0000'
    ar.status = 'REVERSED'
    ar.reversedAt = new Date()
    ar.remark = dto.reason ?? null
    await this.arRepo.save(ar)
    const red = await this.arRepo.save(this.arRepo.create({
      tenantId: user.tenantId,
      customerId: ar.customerId,
      sourceType: 'REVERSAL',
      sourceId: ar.id,
      sourceNo: ar.sourceNo,
      amount: this.money(-this.num(ar.amount)),
      receivedAmount: '0.0000',
      dueDate: ar.dueDate,
      status: 'RED',
      reverseOfId: ar.id,
      reversedAt: new Date(),
      remark: `红冲应收单 ${ar.id}`
    }))
    const voucher = await this.createRedLineVoucher(dto.entries, period, `红冲应收单 ${ar.id}`, user)
    await this.auditService.record({
      bizType: 'receivable', bizId: id, action: 'REVERSE_RECEIVABLE',
      afterValue: { redId: red.id, releasedWriteoffAmount: released, voucherId: voucher?.id ?? null }
    }, user)
    return { original: ar, redLine: red, releasedWriteoffAmount: released, voucher }
  }

  /** 应付单红冲：释放核销、登记红字应付单，并按需生成红字凭证 */
  async reversePayable(id: number, dto: { reason?: string; entries?: RedLineEntryInput[] }, user: JwtUser): Promise<Record<string, unknown>> {
    const ap = await this.apRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!ap) throw new NotFoundException('应付单不存在')
    const period = this.periodOf(ap.createdAt)
    const plan = buildDocumentRedLinePlan({
      type: 'PAYABLE',
      amount: ap.amount,
      settledAmount: ap.paidAmount,
      status: ap.status,
      periodClosed: await this.isPeriodClosed(period, user)
    })
    if (!plan.ok) throw new BadRequestException(plan.reason ?? '无法红冲应付单')
    const writeoffs = await this.writeoffRepo.find({ where: { tenantId: user.tenantId, bizType: 'PAYABLE', bizId: ap.id } })
    const writeoffTotal = writeoffs.reduce((sum, item) => sum + this.num(item.amount), 0)
    const releaseCheck = canReleaseWriteoff({ settledAmount: ap.paidAmount, writeoffAmount: writeoffTotal })
    if (!releaseCheck.ok) throw new BadRequestException(releaseCheck.reason ?? '核销数据不一致，无法红冲')
    const released = await this.releaseWriteoffs('PAYMENT', ap.id, user)
    ap.paidAmount = '0.0000'
    ap.status = 'REVERSED'
    ap.reversedAt = new Date()
    ap.remark = dto.reason ?? null
    await this.apRepo.save(ap)
    const red = await this.apRepo.save(this.apRepo.create({
      tenantId: user.tenantId,
      supplierId: ap.supplierId,
      sourceType: 'REVERSAL',
      sourceId: ap.id,
      sourceNo: ap.sourceNo,
      amount: this.money(-this.num(ap.amount)),
      paidAmount: '0.0000',
      dueDate: ap.dueDate,
      status: 'RED',
      reverseOfId: ap.id,
      reversedAt: new Date(),
      remark: `红冲应付单 ${ap.id}`
    }))
    const voucher = await this.createRedLineVoucher(dto.entries, period, `红冲应付单 ${ap.id}`, user)
    await this.auditService.record({
      bizType: 'payable', bizId: id, action: 'REVERSE_PAYABLE',
      afterValue: { redId: red.id, releasedWriteoffAmount: released, voucherId: voucher?.id ?? null }
    }, user)
    return { original: ap, redLine: red, releasedWriteoffAmount: released, voucher }
  }

  /** 收款单红冲：冲回资金账户余额、释放核销并登记红字收款单 */
  async reverseReceipt(id: number, dto: { reason?: string; entries?: RedLineEntryInput[] }, user: JwtUser): Promise<Record<string, unknown>> {
    const receipt = await this.receiptRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!receipt) throw new NotFoundException('收款单不存在')
    const period = this.periodOf(receipt.receivedAt)
    const plan = buildDocumentRedLinePlan({
      type: 'RECEIPT',
      amount: receipt.amount,
      settledAmount: receipt.amount,
      status: receipt.status ?? 'POSTED',
      periodClosed: await this.isPeriodClosed(period, user)
    })
    if (!plan.ok) throw new BadRequestException(plan.reason ?? '无法红冲收款单')
    const account = await this.accountRepo.findOne({ where: { id: receipt.accountId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!account) throw new NotFoundException('资金账户不存在')
    const released = await this.releaseWriteoffs('RECEIPT', receipt.id, user)
    account.balance = this.money(this.num(account.balance) + plan.accountBalanceDelta)
    await this.accountRepo.save(account)
    receipt.status = 'REVERSED'
    receipt.reversedAt = new Date()
    receipt.remark = dto.reason ?? null
    await this.receiptRepo.save(receipt)
    const red = await this.receiptRepo.save(this.receiptRepo.create({
      tenantId: user.tenantId,
      receiptNo: this.number('RCP'),
      customerId: receipt.customerId,
      accountId: receipt.accountId,
      amount: this.money(-this.num(receipt.amount)),
      receivedAt: receipt.receivedAt,
      status: 'RED',
      reverseOfId: receipt.id,
      reversedAt: new Date(),
      remark: `红冲收款单 ${receipt.receiptNo}`,
      createdBy: user.userId
    }))
    const voucher = await this.createRedLineVoucher(dto.entries, period, `红冲收款单 ${receipt.receiptNo}`, user)
    await this.auditService.record({
      bizType: 'fin_receipt', bizId: id, action: 'REVERSE_RECEIPT',
      afterValue: { redId: red.id, releasedWriteoffAmount: released, balance: account.balance, voucherId: voucher?.id ?? null }
    }, user)
    return { original: receipt, redLine: red, releasedWriteoffAmount: released, accountBalance: account.balance, voucher }
  }

  /** 付款单红冲：冲回资金账户余额、释放核销并登记红字付款单 */
  async reversePayment(id: number, dto: { reason?: string; entries?: RedLineEntryInput[] }, user: JwtUser): Promise<Record<string, unknown>> {
    const payment = await this.paymentRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!payment) throw new NotFoundException('付款单不存在')
    const period = this.periodOf(payment.paidAt)
    const plan = buildDocumentRedLinePlan({
      type: 'PAYMENT',
      amount: payment.amount,
      settledAmount: payment.amount,
      status: payment.status ?? 'POSTED',
      periodClosed: await this.isPeriodClosed(period, user)
    })
    if (!plan.ok) throw new BadRequestException(plan.reason ?? '无法红冲付款单')
    const account = await this.accountRepo.findOne({ where: { id: payment.accountId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!account) throw new NotFoundException('资金账户不存在')
    const released = await this.releaseWriteoffs('PAYMENT', payment.id, user)
    account.balance = this.money(this.num(account.balance) + plan.accountBalanceDelta)
    await this.accountRepo.save(account)
    payment.status = 'REVERSED'
    payment.reversedAt = new Date()
    payment.remark = dto.reason ?? null
    await this.paymentRepo.save(payment)
    const red = await this.paymentRepo.save(this.paymentRepo.create({
      tenantId: user.tenantId,
      paymentNo: this.number('PAY'),
      supplierId: payment.supplierId,
      accountId: payment.accountId,
      amount: this.money(-this.num(payment.amount)),
      paidAt: payment.paidAt,
      status: 'RED',
      reverseOfId: payment.id,
      reversedAt: new Date(),
      remark: `红冲付款单 ${payment.paymentNo}`,
      createdBy: user.userId
    }))
    const voucher = await this.createRedLineVoucher(dto.entries, period, `红冲付款单 ${payment.paymentNo}`, user)
    await this.auditService.record({
      bizType: 'fin_payment', bizId: id, action: 'REVERSE_PAYMENT',
      afterValue: { redId: red.id, releasedWriteoffAmount: released, balance: account.balance, voucherId: voucher?.id ?? null }
    }, user)
    return { original: payment, redLine: red, releasedWriteoffAmount: released, accountBalance: account.balance, voucher }
  }

  async listReceipts(query: QueryFinanceDto, user: JwtUser): Promise<PageResult<FinReceiptEntity>> {    const where = scopeWhere<FinReceiptEntity>({ tenantId: user.tenantId }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.receiptRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async listPayments(query: QueryFinanceDto, user: JwtUser): Promise<PageResult<FinPaymentEntity>> {
    const where = scopeWhere<FinPaymentEntity>({ tenantId: user.tenantId }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.paymentRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async aging(type: 'RECEIVABLE' | 'PAYABLE', user: JwtUser): Promise<Record<string, unknown>> {
    const repo = type === 'RECEIVABLE' ? this.arRepo : this.apRepo
    const rows = await repo.find({ where: { tenantId: user.tenantId, status: 'OPEN' } })
    const buckets = { current: 0, days31: 0, days61: 0, days91: 0 }
    const today = Date.now()
    for (const row of rows) {
      const remain = this.num(type === 'RECEIVABLE' ? (row as ReceivableEntity).amount : (row as PayableEntity).amount) - this.num(type === 'RECEIVABLE' ? (row as ReceivableEntity).receivedAmount : (row as PayableEntity).paidAmount)
      const due = (row as ReceivableEntity).dueDate ?? (row as PayableEntity).dueDate
      const days = due ? Math.floor((today - new Date(due).getTime()) / 86400000) : 0
      if (days <= 30) buckets.current += remain
      else if (days <= 60) buckets.days31 += remain
      else if (days <= 90) buckets.days61 += remain
      else buckets.days91 += remain
    }
    return {
      type,
      current: this.money(buckets.current),
      days31: this.money(buckets.days31),
      days61: this.money(buckets.days61),
      days91: this.money(buckets.days91)
    }
  }

  async listInvoices(query: QueryFinanceDto, user: JwtUser): Promise<PageResult<FinInvoiceEntity>> {
    const where = scopeWhere<FinInvoiceEntity>({ tenantId: user.tenantId }, user)
    const [list, total] = await this.invoiceRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createInvoice(dto: CreateInvoiceDto, user: JwtUser): Promise<FinInvoiceEntity> {
    const entity = this.invoiceRepo.create({
      ...dto,
      tenantId: user.tenantId,
      bizType: dto.bizType ?? null,
      bizId: dto.bizId ?? null,
      taxAmount: dto.taxAmount ?? '0'
    })
    const saved = await this.invoiceRepo.save(entity)
    await this.auditService.record({ bizType: 'fin_invoice', bizId: saved.id, action: 'CREATE_INVOICE', afterValue: saved }, user)
    return saved
  }

  async listAssets(query: QueryFinanceDto, user: JwtUser): Promise<PageResult<FinAssetEntity>> {
    const where = scopeWhere<FinAssetEntity>({ tenantId: user.tenantId, isDeleted: 0 }, user)
    const [list, total] = await this.assetRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createAsset(dto: CreateAssetDto, user: JwtUser): Promise<FinAssetEntity> {
    const entity = this.assetRepo.create({
      ...dto,
      tenantId: user.tenantId,
      purchaseDate: dto.purchaseDate ?? null,
      depreciatedValue: '0',
      netValue: this.money(this.num(dto.originalValue)),
      usefulMonths: dto.usefulMonths ?? 0
    })
    const saved = await this.assetRepo.save(entity)
    await this.auditService.record({ bizType: 'fin_asset', bizId: saved.id, action: 'CREATE_ASSET', afterValue: saved }, user)
    return saved
  }

  /** 月度折旧计提：按资产折旧方法/残值率计算，可选生成并过账折旧凭证 */
  async runDepreciation(
    period: string,
    user: JwtUser,
    options?: { withVoucher?: boolean; expenseSubjectId?: number; accumulatedSubjectId?: number }
  ): Promise<{ records: FinAssetDepreciationEntity[]; totalAmount: number; voucherIds: number[]; skipped: number }> {
    const periodClosed = await this.isPeriodClosed(period, user)
    if (periodClosed) throw new BadRequestException('会计期间已结账，无法计提折旧')
    const assets = await this.assetRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const records: FinAssetDepreciationEntity[] = []
    const voucherIds: number[] = []
    let skipped = 0
    for (const asset of assets) {
      const existing = await this.depreciationRepo.findOne({ where: { tenantId: user.tenantId, assetId: asset.id, period } })
      const check = canRunDepreciation({
        status: asset.status,
        isDeleted: asset.isDeleted,
        periodClosed,
        alreadyPosted: !!existing
      })
      if (!check.ok) { skipped++; continue }
      if (asset.usefulMonths <= 0) { skipped++; continue }
      const result = computeMonthlyDepreciation({
        originalValue: this.num(asset.originalValue),
        residualRate: this.num(asset.residualRate),
        usefulMonths: asset.usefulMonths,
        alreadyDepreciated: this.num(asset.depreciatedValue),
        method: (asset.depreciationMethod ?? 'STRAIGHT_LINE') as DepreciationMethod
      })
      if (result.amount <= 0) { skipped++; continue }
      const expenseSubjectId = options?.expenseSubjectId ?? asset.expenseSubjectId
      const accumulatedSubjectId = options?.accumulatedSubjectId ?? asset.accumulatedSubjectId
      let voucherId: number | null = null
      if (options?.withVoucher && expenseSubjectId && accumulatedSubjectId) {
        const entries = buildDepreciationVoucherEntries({
          expenseSubjectId,
          accumulatedSubjectId,
          amount: result.amount,
          summary: `计提折旧 ${period} ${asset.assetName}`
        })
        const voucher = await this.createVoucher({
          voucherDate: this.lastDayOfPeriod(period),
          period,
          sourceType: 'DEPRECIATION',
          sourceId: asset.id,
          remark: `折旧计提 ${period} ${asset.assetNo}`,
          entries
        }, user)
        await this.postVoucher(voucher.id, user)
        voucherId = voucher.id
        voucherIds.push(voucher.id)
      }
      const entity = await this.depreciationRepo.save(this.depreciationRepo.create({
        tenantId: user.tenantId,
        assetId: asset.id,
        period,
        amount: this.money(result.amount),
        voucherId,
        method: result.method
      }))
      asset.depreciatedValue = this.money(this.num(asset.depreciatedValue) + result.amount)
      asset.netValue = this.money(Math.max(0, this.num(asset.originalValue) - this.num(asset.depreciatedValue)))
      await this.assetRepo.save(asset)
      records.push(entity)
    }
    const totalAmount = Number(records.reduce((sum, item) => sum + this.num(item.amount), 0).toFixed(4))
    await this.auditService.record({
      bizType: 'fin_asset_depreciation', action: 'RUN_DEPRECIATION',
      afterValue: { period, count: records.length, totalAmount, voucherCount: voucherIds.length }
    }, user)
    return { records, totalAmount, voucherIds, skipped }
  }

  /** 折旧台账：按期间/资产查询计提明细，并给出折旧与净值汇总 */
  async listDepreciations(
    query: { period?: string; assetId?: number; page?: number; pageSize?: number },
    user: JwtUser
  ): Promise<{
    rows: Array<Record<string, unknown>>
    total: number
    summary: {
      period: string | null
      periodAmount: number
      accumulatedAmount: number
      netValueAmount: number
      assetCount: number
      depreciatedAssetCount: number
      missingAssetCount: number
      missingAssetNos: string[]
    }
  }> {
    const period = query.period ?? null
    const assets = await this.assetRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 }, order: { id: 'ASC' } })
    const depreciationWhere: Record<string, unknown> = { tenantId: user.tenantId }
    if (period) depreciationWhere.period = period
    if (query.assetId) depreciationWhere.assetId = query.assetId
    const records = await this.depreciationRepo.find({ where: depreciationWhere as never, order: { id: 'DESC' } })
    const assetMap = new Map(assets.map((item) => [item.id, item]))
    const rows = records.map((item) => {
      const asset = assetMap.get(item.assetId)
      return {
        id: item.id,
        assetId: item.assetId,
        assetNo: asset?.assetNo ?? '',
        assetName: asset?.assetName ?? '',
        method: item.method,
        period: item.period,
        amount: item.amount,
        voucherId: item.voucherId,
        originalValue: asset?.originalValue ?? '0',
        depreciatedValue: asset?.depreciatedValue ?? '0',
        netValue: asset?.netValue ?? '0'
      }
    })
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 50
    const periodAmount = records.reduce((sum, item) => sum + this.num(item.amount), 0)
    const depreciatedAssets = assets.filter((item) => this.num(item.depreciatedValue) > 0)
    const periodRecords = period
      ? records.filter((item) => item.period === period)
      : records
    const depreciatedIds = new Set(periodRecords.map((item) => item.assetId))
    const missingAssets = period
      ? assets.filter((item) => item.status === 'ACTIVE' && item.usefulMonths > 0 && !depreciatedIds.has(item.id) && this.isDepreciableInPeriod(item, period))
      : []
    const summary = {
      period,
      periodAmount: Number(periodAmount.toFixed(4)),
      accumulatedAmount: Number(depreciatedAssets.reduce((sum, item) => sum + this.num(item.depreciatedValue), 0).toFixed(4)),
      netValueAmount: Number(assets.reduce((sum, item) => sum + this.num(item.netValue), 0).toFixed(4)),
      assetCount: assets.length,
      depreciatedAssetCount: depreciatedAssets.length,
      missingAssetCount: missingAssets.length,
      missingAssetNos: missingAssets.map((item) => item.assetNo)
    }
    return { rows: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, summary }
  }

  /** 折旧计提完整性：期间内应计提而未计提的资产清单（用于月结检查） */
  async checkDepreciationCompleteness(period: string, user: JwtUser): Promise<{ complete: boolean; missing: string[] }> {
    const assets = await this.assetRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const records = await this.depreciationRepo.find({ where: { tenantId: user.tenantId, period } })
    const depreciatedIds = new Set(records.map((item) => item.assetId))
    return checkDepreciationCompleteness(
      assets.map((item) => ({
        assetNo: item.assetNo,
        status: item.status,
        usefulMonths: item.usefulMonths,
        purchaseDate: item.purchaseDate,
        disposeDate: item.disposeDate,
        depreciated: depreciatedIds.has(item.id)
      })),
      period
    )
  }

  /** 资产在指定期间是否应计提折旧：购置日期不晚于期间末且未处置 */
  private isDepreciableInPeriod(asset: FinAssetEntity, period: string): boolean {
    return isAssetDepreciableInPeriod({
      assetNo: asset.assetNo,
      status: asset.status,
      usefulMonths: asset.usefulMonths,
      purchaseDate: asset.purchaseDate,
      disposeDate: asset.disposeDate,
      depreciated: false
    }, period)
  }

  /** 固定资产盘点：记录实盘数量与差异 */
  async stocktakeAsset(id: number, actualQuantity: number, user: JwtUser): Promise<{ assetId: number; diff: number }> {
    const asset = await this.assetRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!asset) throw new NotFoundException('固定资产不存在')
    const diff = assetStocktakeDiff(asset.bookQuantity, actualQuantity)
    asset.actualQuantity = actualQuantity
    asset.lastStocktake = new Date().toISOString().slice(0, 10)
    await this.assetRepo.save(asset)
    await this.auditService.record({ bizType: 'fin_asset', bizId: id, action: 'STOCKTAKE_ASSET', afterValue: { actualQuantity, diff } }, user)
    return { assetId: id, diff }
  }

  /** 固定资产处置：需处置金额，改状态为 DISPOSED */
  async disposeAsset(id: number, disposeAmount: number, user: JwtUser): Promise<FinAssetEntity> {
    const asset = await this.assetRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!asset) throw new NotFoundException('固定资产不存在')
    if (asset.status === 'DISPOSED') throw new BadRequestException('该资产已处置')
    if (!Number.isFinite(disposeAmount) || disposeAmount < 0) throw new BadRequestException('处置金额无效')
    asset.status = 'DISPOSED'
    asset.disposeDate = new Date().toISOString().slice(0, 10)
    asset.disposeAmount = this.money(disposeAmount)
    const saved = await this.assetRepo.save(asset)
    await this.auditService.record({ bizType: 'fin_asset', bizId: id, action: 'DISPOSE_ASSET', afterValue: { disposeAmount } }, user)
    return saved
  }

  /** 采购入库落地成本分摊：把额外费用按数量权重分摊到各行 */
  allocateFreightCost(lines: Array<{ id: number; qty: number; amount: number }>, extraCost: number): Array<{ id: number; allocatedCost: number }> {
    return allocateLandedCost(lines, extraCost)
  }

  /** 资金流水导入：批次内与外部流水号去重，已存在的跳过，不重复落库 */
  async importBankTransactions(
    accountId: number,
    rows: Array<{ externalNo: string; direction: string; amount: string; txDate?: string; summary?: string }>,
    user: JwtUser
  ): Promise<{ imported: number; skipped: number; duplicates: string[] }> {
    const account = await this.accountRepo.findOne({ where: { id: accountId, tenantId: user.tenantId } })
    if (!account) throw new NotFoundException('资金账户不存在')
    const { unique, duplicates } = dedupeBankTransactions(rows)
    const existing = await this.bankTxRepo.find({ where: { tenantId: user.tenantId } })
    const existingNos = new Set(existing.map((item) => item.externalNo))
    let imported = 0
    let skipped = 0
    for (const row of unique) {
      if (existingNos.has(row.externalNo)) { skipped++; continue }
      await this.bankTxRepo.save(this.bankTxRepo.create({
        tenantId: user.tenantId,
        accountId,
        externalNo: row.externalNo,
        direction: row.direction === 'OUT' ? 'OUT' : 'IN',
        amount: this.money(this.num(row.amount)),
        txDate: row.txDate ?? null,
        summary: row.summary ?? null,
        createdBy: user.userId
      }))
      existingNos.add(row.externalNo)
      imported++
    }
    await this.auditService.record({
      bizType: 'fin_bank_transaction', bizId: accountId, action: 'IMPORT_BANK_TX',
      afterValue: { accountId, imported, skipped, duplicates }
    }, user)
    return { imported, skipped, duplicates }
  }

  /** 创建成本重算任务（异步任务，执行器可消费；此处置 PENDING 并记录总数） */
  async createCostJob(period: string, user: JwtUser): Promise<CostJobEntity> {
    const totalItems = await this.costRepo.count({ where: { tenantId: user.tenantId, period } })
    // 保存重算前的成本快照，供扩展服务按任务回滚
    const snapshotRows = await this.costRepo.find({ where: { tenantId: user.tenantId, period } })
    const snapshot = {
      items: snapshotRows.map((row) => ({
        productId: row.productId,
        period: row.period,
        costType: row.costType,
        amount: row.amount
      }))
    }
    const job = await this.costJobRepo.save(this.costJobRepo.create({
      tenantId: user.tenantId,
      period,
      status: COST_JOB_STATUS.PENDING,
      totalItems,
      snapshot,
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'fin_cost_job', bizId: job.id, action: 'CREATE_COST_JOB', afterValue: { period, totalItems } }, user)
    return job
  }

  /** 成本重算任务状态推进（状态机校验） */
  async transitionCostJob(id: number, to: CostJobStatus, user: JwtUser, errorMessage?: string): Promise<CostJobEntity> {
    const job = await this.costJobRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!job) throw new NotFoundException('成本重算任务不存在')
    if (!canTransitionCostJob(job.status as CostJobStatus, to)) {
      throw new BadRequestException(`任务状态 ${job.status} 不允许流转到 ${to}`)
    }
    job.status = to
    job.errorMessage = errorMessage ?? null
    if (to === COST_JOB_STATUS.DONE || to === COST_JOB_STATUS.FAILED) job.finishedAt = new Date()
    const saved = await this.costJobRepo.save(job)
    await this.auditService.record({ bizType: 'fin_cost_job', bizId: id, action: 'TRANSITION_COST_JOB', afterValue: { status: to } }, user)
    return saved
  }

  async listCostJobs(query: QueryFinanceDto, user: JwtUser): Promise<PageResult<CostJobEntity>> {
    const where = { tenantId: user.tenantId, ...(query.period ? { period: query.period } : {}) }
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const [list, total] = await this.costJobRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (page - 1) * pageSize, take: pageSize })
    return buildPageResult(list, total, page, pageSize)
  }

  async listPeriods(query: QueryFinanceDto, user: JwtUser): Promise<PageResult<FinPeriodEntity>> {
    const where = scopeWhere<FinPeriodEntity>({ tenantId: user.tenantId }, user)
    const [list, total] = await this.periodRepo.findAndCount({ where, order: { period: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 月结检查清单：未过账凭证、借贷不平凭证、未认证发票等，全部通过才允许结账 */
  async closePeriodChecks(period: string, user: JwtUser): Promise<{ ok: boolean; failures: string[] }> {
    const drafts = await this.voucherRepo.count({ where: { tenantId: user.tenantId, period, status: 'DRAFT', isDeleted: 0 } })
    const posted = await this.voucherRepo.find({ where: { tenantId: user.tenantId, period, status: 'POSTED', isDeleted: 0 } })
    const unbalanced = posted.filter((v) => Math.abs(this.num(v.totalDebit) - this.num(v.totalCredit)) > 0.0001)
    const pendingInvoices = await this.invoiceRepo.count({ where: { tenantId: user.tenantId, status: 'PENDING' } })
    const depreciation = await this.checkDepreciationCompleteness(period, user)
    const result = evaluateCloseChecks([
      { name: '无未过账凭证', passed: drafts === 0, detail: drafts > 0 ? `${drafts} 张草稿` : undefined },
      { name: '已过账凭证借贷平衡', passed: unbalanced.length === 0, detail: unbalanced.length > 0 ? `${unbalanced.length} 张不平` : undefined },
      { name: '无待认证发票', passed: pendingInvoices === 0, detail: pendingInvoices > 0 ? `${pendingInvoices} 张待认证` : undefined },
      { name: '折旧计提完整', passed: depreciation.complete, detail: depreciation.missing.length > 0 ? `${depreciation.missing.length} 项资产未计提折旧` : undefined }
    ])
    return result
  }

  /** 资金账户余额调节：账面余额与银行余额按未达账项调节 */
  async reconcileAccount(accountId: number, bankBalance: number, outstandingIncome: number, outstandingPayment: number, user: JwtUser) {
    const account = await this.accountRepo.findOne({ where: { id: accountId, tenantId: user.tenantId } })
    if (!account) throw new NotFoundException('资金账户不存在')
    const result = reconcileBalance(this.num(account.balance), bankBalance, outstandingIncome, outstandingPayment)
    await this.auditService.record({
      bizType: 'fin_account', bizId: accountId, action: 'RECONCILE_ACCOUNT',
      afterValue: { bankBalance, outstandingIncome, outstandingPayment, ...result }
    }, user)
    return result
  }

  /** 发票认证勾稽：发票含税金额与业务单据金额比对 */
  matchInvoiceToDocument(invoiceId: number, documentAmount: number, user: JwtUser) {
    void user
    return this.invoiceRepo.findOne({ where: { id: invoiceId, tenantId: user.tenantId } }).then((invoice) => {
      if (!invoice) throw new NotFoundException('发票不存在')
      return {
        invoiceId,
        ...matchInvoice(this.num(invoice.amount), this.num(invoice.taxAmount), documentAmount)
      }
    })
  }

  async closePeriod(dto: ClosePeriodDto, user: JwtUser): Promise<FinPeriodEntity> {
    const checks = await this.closePeriodChecks(dto.period, user)
    if (!checks.ok) throw new BadRequestException(`月结检查未通过：${checks.failures.join('；')}`)
    let period = await this.periodRepo.findOne({ where: { tenantId: user.tenantId, period: dto.period } })
    if (!period) period = this.periodRepo.create({ tenantId: user.tenantId, period: dto.period, status: 'OPEN' })
    period.status = 'CLOSED'
    period.closedBy = user.userId
    period.closedAt = new Date()
    const saved = await this.periodRepo.save(period)
    await this.auditService.record({ bizType: 'fin_period', bizId: saved.id, action: 'CLOSE_PERIOD', afterValue: saved }, user)
    return saved
  }

  async listCosts(query: QueryFinanceDto, user: JwtUser): Promise<PageResult<FinCostEntity>> {
    const where = scopeWhere<FinCostEntity>({ tenantId: user.tenantId, ...(query.period ? { period: query.period } : {}) }, user)
    const [list, total] = await this.costRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createCost(dto: CreateCostDto, user: JwtUser): Promise<FinCostEntity> {
    const entity = this.costRepo.create({ ...dto, tenantId: user.tenantId })
    const saved = await this.costRepo.save(entity)
    await this.auditService.record({ bizType: 'fin_cost', bizId: saved.id, action: 'CREATE_COST', afterValue: saved }, user)
    return saved
  }

  async listBudgets(query: QueryFinanceDto, user: JwtUser): Promise<PageResult<FinBudgetEntity>> {
    const where = scopeWhere<FinBudgetEntity>({ tenantId: user.tenantId, ...(query.period ? { period: query.period } : {}) }, user)
    const [list, total] = await this.budgetRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createBudget(dto: CreateBudgetDto, user: JwtUser): Promise<FinBudgetEntity> {
    const entity = this.budgetRepo.create({
      ...dto,
      tenantId: user.tenantId,
      deptId: dto.deptId ?? null,
      subjectId: dto.subjectId ?? null,
      controlRule: dto.controlRule ?? 'WARN'
    })
    const saved = await this.budgetRepo.save(entity)
    await this.auditService.record({ bizType: 'fin_budget', bizId: saved.id, action: 'CREATE_BUDGET', afterValue: saved }, user)
    return saved
  }

  async dashboard(user: JwtUser): Promise<Record<string, unknown>> {
    const receivables = await this.arRepo.find({ where: { tenantId: user.tenantId, status: 'OPEN' } })
    const payables = await this.apRepo.find({ where: { tenantId: user.tenantId, status: 'OPEN' } })
    const accounts = await this.accountRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const vouchers = await this.voucherRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const budgets = await this.budgetRepo.find({ where: { tenantId: user.tenantId } })
    const today = new Date()

    // 预算执行：按预算口径汇总已用与占用金额，标记超支项
    const budgetAmount = budgets.reduce((sum, item) => sum + this.num(item.budgetAmount), 0)
    const budgetUsed = budgets.reduce((sum, item) => sum + this.num(item.usedAmount), 0)
    const budgetOccupied = budgets.reduce((sum, item) => sum + this.num(item.occupiedAmount), 0)
    const overBudgetItems = budgets.filter((item) => this.num(item.usedAmount) > this.num(item.budgetAmount))

    // 风险指标：逾期应收应付、高风险应收、坏账计提与未过账凭证
    const overdueReceivables = receivables.filter((item) => item.dueDate && new Date(item.dueDate) < today)
    const overduePayables = payables.filter((item) => item.dueDate && new Date(item.dueDate) < today)
    const highRiskReceivables = receivables.filter((item) => item.riskLevel === 'HIGH')

    return {
      receivableAmount: this.money(receivables.reduce((sum, item) => sum + this.num(item.amount) - this.num(item.receivedAmount), 0)),
      payableAmount: this.money(payables.reduce((sum, item) => sum + this.num(item.amount) - this.num(item.paidAmount), 0)),
      fundBalance: this.money(accounts.reduce((sum, item) => sum + this.num(item.balance), 0)),
      voucherCount: vouchers.length,
      postedCount: vouchers.filter((item) => item.status === 'POSTED').length,
      budgetExecution: {
        budgetAmount: this.money(budgetAmount),
        usedAmount: this.money(budgetUsed),
        occupiedAmount: this.money(budgetOccupied),
        executionRate: budgetAmount > 0 ? Number((budgetUsed / budgetAmount).toFixed(4)) : 0,
        overBudgetCount: overBudgetItems.length,
        controlRules: [...new Set(budgets.map((item) => item.controlRule))]
      },
      riskMetrics: {
        overdueReceivableAmount: this.money(overdueReceivables.reduce((sum, item) => sum + this.num(item.amount) - this.num(item.receivedAmount), 0)),
        overdueReceivableCount: overdueReceivables.length,
        overduePayableAmount: this.money(overduePayables.reduce((sum, item) => sum + this.num(item.amount) - this.num(item.paidAmount), 0)),
        overduePayableCount: overduePayables.length,
        highRiskReceivableCount: highRiskReceivables.length,
        provisionAmount: this.money(receivables.reduce((sum, item) => sum + this.num(item.provisionAmount), 0)),
        unpostedVoucherCount: vouchers.filter((item) => item.status !== 'POSTED').length
      }
    }
  }

  /* ---------------- 科目余额表 / 明细账 / 期末结转 / 资金转账 / 资产变更 ---------------- */

  /** 上一期间（2026-11 → 2026-10，2026-01 → 2025-12） */
  private previousPeriod(period: string): string {
    const [year, month] = period.split('-').map((item) => Number(item))
    if (!year || !month) return period
    const date = new Date(Date.UTC(year, month - 2, 1))
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  }

  /** 取截止指定期间的已过账分录快照 */
  private async loadLedgerSnapshot(untilPeriod: string, user: JwtUser): Promise<LedgerEntrySnapshot[]> {
    const vouchers = await this.voucherRepo.createQueryBuilder('voucher')
      .where('voucher.tenantId = :tenantId', { tenantId: user.tenantId })
      .andWhere('voucher.status = :status', { status: 'POSTED' })
      .andWhere('voucher.isDeleted = :deleted', { deleted: 0 })
      .andWhere('voucher.period <= :period', { period: untilPeriod })
      .getMany()
    if (vouchers.length === 0) return []
    const voucherMap = new Map(vouchers.map((item) => [item.id, item]))
    const voucherIds = vouchers.map((item) => item.id)
    const entries = await this.entryRepo
      .createQueryBuilder('entry')
      .where('entry.tenantId = :tenantId', { tenantId: user.tenantId })
      .andWhere('entry.voucherId IN (:...ids)', { ids: voucherIds })
      .getMany()
    return entries.map((entry) => {
      const voucher = voucherMap.get(entry.voucherId)
      return {
        subjectId: entry.subjectId,
        voucherId: entry.voucherId,
        voucherNo: voucher?.voucherNo ?? '',
        voucherDate: voucher?.voucherDate ?? '',
        period: entry.period,
        summary: entry.summary,
        debit: this.num(entry.debit),
        credit: this.num(entry.credit),
        auxType: entry.auxType,
        auxId: entry.auxId
      }
    })
  }

  /** 科目余额表：期初余额 + 本期借贷发生额 = 期末余额 */
  async subjectBalance(query: QueryLedgerDto, user: JwtUser): Promise<Record<string, unknown>> {
    const period = query.period ?? new Date().toISOString().slice(0, 7)
    const beginPeriod = query.beginPeriod ?? this.previousPeriod(period)
    const subjects = await this.subjectRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 }, order: { subjectCode: 'ASC' } })
    const history = await this.loadLedgerSnapshot(period, user)
    const derived = new Map<number, number>()
    for (const entry of history) {
      if (entry.period >= period) continue
      derived.set(entry.subjectId, Number((this.num(derived.get(entry.subjectId) ?? 0) + entry.debit - entry.credit).toFixed(4)))
    }
    const opening = mergeOpeningBalances(await this.loadOpeningBalanceMap(period, user), derived)
    const current = history.filter((entry) => entry.period === period)
    const rows = buildSubjectBalanceTable(
      subjects.map((item) => ({
        id: item.id,
        subjectCode: item.subjectCode,
        subjectName: item.subjectName,
        category: item.category,
        direction: (item.direction === 'CREDIT' ? 'CREDIT' : 'DEBIT') as 'DEBIT' | 'CREDIT'
      })),
      current,
      opening
    )
    const filtered = query.subjectId ? rows.filter((row) => row.subjectId === Number(query.subjectId)) : rows
    return {
      period,
      beginPeriod,
      rows: filtered,
      totals: {
        openingBalance: this.money(filtered.reduce((sum, row) => sum + row.openingBalance, 0)),
        periodDebit: this.money(filtered.reduce((sum, row) => sum + row.periodDebit, 0)),
        periodCredit: this.money(filtered.reduce((sum, row) => sum + row.periodCredit, 0)),
        closingBalance: this.money(filtered.reduce((sum, row) => sum + row.closingBalance, 0))
      }
    }
  }

  /** 明细账：按凭证逐笔累计，含期初余额；支持多科目、日期区间与凭证号过滤 */
  async detailLedger(query: QueryLedgerDto, user: JwtUser): Promise<Record<string, unknown>> {
    const subjectIds = this.parseSubjectIds(query.subjectIds)
    if (!query.subjectId && subjectIds.length === 0) throw new BadRequestException('请选择需要查询的科目')
    const period = query.period ?? new Date().toISOString().slice(0, 7)
    const subjects = await this.subjectRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 }, order: { subjectCode: 'ASC' } })
    const history = await this.loadLedgerSnapshot(period, user)
    const derived = new Map<number, number>()
    for (const entry of history) {
      if (entry.period >= period) continue
      derived.set(entry.subjectId, Number((this.num(derived.get(entry.subjectId) ?? 0) + entry.debit - entry.credit).toFixed(4)))
    }
    const opening = mergeOpeningBalances(await this.loadOpeningBalanceMap(period, user), derived)
    const subjectSnapshots = subjects.map((item) => ({
      id: item.id,
      subjectCode: item.subjectCode,
      subjectName: item.subjectName,
      category: item.category,
      direction: (item.direction === 'CREDIT' ? 'CREDIT' : 'DEBIT') as 'DEBIT' | 'CREDIT'
    }))

    // 多科目模式
    if (subjectIds.length > 0) {
      const groups = buildGroupedDetailLedger(history, subjectSnapshots, {
        openingBalances: opening,
        subjectIds,
        beginDate: query.beginDate,
        endDate: query.endDate,
        voucherNo: query.voucherNo
      })
      return {
        period,
        subjectIds,
        groups,
        totals: {
          openingBalance: this.money(groups.reduce((sum, group) => sum + group.openingBalance, 0)),
          periodDebit: this.money(groups.reduce((sum, group) => sum + group.periodDebit, 0)),
          periodCredit: this.money(groups.reduce((sum, group) => sum + group.periodCredit, 0)),
          closingBalance: this.money(groups.reduce((sum, group) => sum + group.closingBalance, 0))
        }
      }
    }

    const subjectId = Number(query.subjectId)
    const subject = subjects.find((item) => item.id === subjectId)
    if (!subject) throw new NotFoundException('科目不存在')
    const entries = history.filter((entry) => entry.period === period && entry.subjectId === subjectId)
    const rows = buildDetailLedger(
      entries.filter((entry) =>
        (!query.beginDate || entry.voucherDate >= query.beginDate) &&
        (!query.endDate || entry.voucherDate <= query.endDate) &&
        (!query.voucherNo || entry.voucherNo.includes(query.voucherNo))
      ),
      opening.get(subjectId) ?? 0,
      subject.direction === 'CREDIT' ? 'CREDIT' : 'DEBIT'
    )
    return {
      period,
      subjectId,
      subjectCode: subject.subjectCode,
      subjectName: subject.subjectName,
      openingBalance: this.money(opening.get(subjectId) ?? 0),
      rows,
      totals: {
        periodDebit: this.money(rows.reduce((sum, row) => sum + row.debit, 0)),
        periodCredit: this.money(rows.reduce((sum, row) => sum + row.credit, 0)),
        closingBalance: this.money(rows.length > 0 ? rows[rows.length - 1].runningBalance : (opening.get(subjectId) ?? 0))
      }
    }
  }

  /** 期初余额录入：按期间与科目覆盖写入，供科目余额表/明细账取期初 */
  async setOpeningBalances(dto: SetOpeningBalanceDto, user: JwtUser): Promise<Record<string, unknown>> {
    const period = dto.period
    const subjects = await this.subjectRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const subjectMap = new Map(subjects.map((item) => [item.id, item]))
    const items = dto.items ?? []
    if (items.length === 0) throw new BadRequestException('请至少录入一条期初余额')
    for (const item of items) {
      if (!subjectMap.has(item.subjectId)) throw new NotFoundException(`科目 ${item.subjectId} 不存在`)
    }
    const auxKey = (subjectId: number, auxId: string): string => `${subjectId}:${auxId ?? ''}`
    const existing = await this.openingRepo.find({ where: { tenantId: user.tenantId, period } })
    const existingMap = new Map(existing.map((row) => [auxKey(row.subjectId, row.auxId), row]))
    const saved: FinOpeningBalanceEntity[] = []
    for (const item of items) {
      const subject = subjectMap.get(item.subjectId)
      const direction = item.direction ?? (subject?.direction === 'CREDIT' ? 'CREDIT' : 'DEBIT')
      const key = auxKey(item.subjectId, item.auxId ?? '')
      const current = existingMap.get(key)
      const row = current
        ? Object.assign(current, {
          direction,
          amount: this.money(this.num(item.amount)),
          remark: item.remark ?? current.remark,
          createdBy: user.userId
        })
        : this.openingRepo.create({
          tenantId: user.tenantId,
          period,
          subjectId: item.subjectId,
          auxType: item.auxType ?? '',
          auxId: item.auxId ?? '',
          direction,
          amount: this.money(this.num(item.amount)),
          remark: item.remark ?? null,
          createdBy: user.userId
        })
      saved.push(await this.openingRepo.save(row))
    }
    await this.auditService.record({
      bizType: 'fin_opening_balance', bizId: 0, action: 'SET_OPENING_BALANCE',
      afterValue: { period, count: saved.length }
    }, user)
    return { period, items: saved, count: saved.length }
  }

  /** 期初余额查询 */
  async listOpeningBalances(period: string, user: JwtUser): Promise<FinOpeningBalanceEntity[]> {
    return this.openingRepo.find({ where: { tenantId: user.tenantId, period }, order: { subjectId: 'ASC' } })
  }

  /** 读取期初余额表：取查询期间之前最近一期的余额（借贷方向换算为借正贷负） */
  private async loadOpeningBalanceMap(period: string, user: JwtUser): Promise<Map<number, number>> {
    const rows = await this.openingRepo.find({ where: { tenantId: user.tenantId }, order: { period: 'DESC' } })
    const candidates = rows.filter((row) => row.period <= period)
    if (candidates.length === 0) return new Map()
    const latest = candidates[0].period
    const map = new Map<number, number>()
    for (const row of candidates.filter((item) => item.period === latest)) {
      const amount = this.num(row.amount) * (row.direction === 'CREDIT' ? -1 : 1)
      map.set(row.subjectId, Number((this.num(map.get(row.subjectId) ?? 0) + amount).toFixed(4)))
    }
    return map
  }

  /** 解析逗号分隔的科目 ID */
  private parseSubjectIds(value: string | undefined): number[] {
    if (!value) return []
    return value
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item) && item > 0)
  }

  /** 期末结转：把损益类科目本期净额结转到本年利润科目，生成过账凭证 */
  async carryForwardPeriod(dto: CarryForwardDto, user: JwtUser): Promise<Record<string, unknown>> {
    const period = dto.period
    const periodRow = await this.periodRepo.findOne({ where: { tenantId: user.tenantId, period } })
    if (periodRow && periodRow.status === 'CLOSED') throw new BadRequestException('该期间已结账，不可结转')
    const existing = await this.carryRepo.findOne({ where: { tenantId: user.tenantId, period } })
    if (existing) throw new BadRequestException('该期间已结转，不可重复结转')
    const checks = await this.closePeriodChecks(period, user)
    if (!checks.ok) throw new BadRequestException(`月结检查未通过：${checks.failures.join('；')}`)
    const profitSubject = await this.subjectRepo.findOne({ where: { id: dto.profitSubjectId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!profitSubject) throw new NotFoundException('本年利润科目不存在')
    if (profitSubject.category !== 'EQUITY' && profitSubject.category !== 'INCOME') {
      throw new BadRequestException('本年利润科目必须为权益类或损益类科目')
    }
    const subjects = await this.subjectRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const history = await this.loadLedgerSnapshot(period, user)
    const balances = new Map<number, number>()
    for (const entry of history) {
      balances.set(entry.subjectId, Number((this.num(balances.get(entry.subjectId) ?? 0) + entry.debit - entry.credit).toFixed(4)))
    }
    const plan = buildCarryForwardPlan(
      subjects
        .filter((item) => item.category === 'INCOME' || item.category === 'EXPENSE')
        .map((item) => ({
          subjectId: item.id,
          subjectCode: item.subjectCode,
          subjectName: item.subjectName,
          category: item.category,
          balance: balances.get(item.id) ?? 0
        })),
      { profitSubjectId: dto.profitSubjectId }
    )
    // 指定科目结转（库存/往来等资产负债类科目）
    const carrySubjectIds = (dto.carrySubjectIds ?? []).filter((id) => id > 0)
    let subjectPlan: ReturnType<typeof buildSubjectCarryForwardPlan> | null = null
    if (carrySubjectIds.length > 0) {
      if (!dto.targetSubjectId) throw new BadRequestException('指定科目结转必须提供目标科目')
      subjectPlan = buildSubjectCarryForwardPlan(
        subjects
          .filter((item) => carrySubjectIds.includes(item.id))
          .map((item) => ({
            subjectId: item.id,
            subjectCode: item.subjectCode,
            subjectName: item.subjectName,
            category: item.category,
            balance: balances.get(item.id) ?? 0
          })),
        { targetSubjectId: dto.targetSubjectId }
      )
      if (subjectPlan.entries.length === 0) throw new BadRequestException(subjectPlan.warnings.join('；') || '指定科目无余额，无需结转')
      if (!subjectPlan.balanced) throw new BadRequestException('指定科目结转分录借贷不平衡')
    }
    const allEntries = [...plan.entries, ...(subjectPlan?.entries ?? [])]
    if (allEntries.length === 0) throw new BadRequestException(plan.warnings.join('；') || '本期无损益发生额，无需结转')
    const totalDebit = Number(allEntries.reduce((sum, entry) => sum + entry.debit, 0).toFixed(4))
    const totalCredit = Number(allEntries.reduce((sum, entry) => sum + entry.credit, 0).toFixed(4))
    if (Math.abs(totalDebit - totalCredit) > 0.0001) throw new BadRequestException('结转分录借贷不平衡')

    const voucherDate = this.lastDayOfPeriod(period)
    const voucher = await this.voucherRepo.save(this.voucherRepo.create({
      tenantId: user.tenantId,
      voucherNo: this.number('V'),
      voucherDate,
      period,
      sourceType: 'PERIOD_CARRY',
      status: 'POSTED',
      totalDebit: this.money(totalDebit),
      totalCredit: this.money(totalCredit),
      createdBy: user.userId,
      postedAt: new Date(),
      checkStatus: 'PASS',
      remark: `${period} 期末结转`
    }))
    await this.entryRepo.save(allEntries.map((entry, index) => this.entryRepo.create({
      tenantId: user.tenantId,
      voucherId: voucher.id,
      lineNo: index + 1,
      subjectId: entry.subjectId,
      summary: entry.summary,
      debit: this.money(entry.debit),
      credit: this.money(entry.credit),
      period
    })))
    const carry = await this.carryRepo.save(this.carryRepo.create({
      tenantId: user.tenantId,
      period,
      voucherId: voucher.id,
      totalAmount: this.money(totalDebit),
      profitAmount: this.money(plan.profit),
      subjectCount: new Set(allEntries.map((entry) => entry.subjectId)).size,
      status: 'DONE',
      createdBy: user.userId
    }))
    voucher.sourceId = carry.id
    await this.voucherRepo.save(voucher)
    if (!periodRow) {
      await this.periodRepo.save(this.periodRepo.create({ tenantId: user.tenantId, period, status: 'CARRIED' }))
    } else if (periodRow.status === 'OPEN') {
      periodRow.status = 'CARRIED'
      await this.periodRepo.save(periodRow)
    }
    await this.auditService.record({
      bizType: 'fin_period', bizId: carry.id, action: 'PERIOD_CARRY',
      afterValue: { period, voucherId: voucher.id, totalAmount: carry.totalAmount, profitAmount: carry.profitAmount }
    }, user)
    return { carry, voucher, warnings: plan.warnings }
  }

  /** 期间结转记录 */
  async listPeriodCarries(query: QueryFinanceDto, user: JwtUser): Promise<PageResult<FinPeriodCarryEntity>> {
    const where = scopeWhere<FinPeriodCarryEntity>({ tenantId: user.tenantId, ...(query.period ? { period: query.period } : {}) }, user)
    const [list, total] = await this.carryRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 期末结转反结转：生成红字冲销凭证，冲回已结转金额 */
  async reverseCarryForward(period: string, user: JwtUser): Promise<Record<string, unknown>> {
    const carry = await this.carryRepo.findOne({ where: { tenantId: user.tenantId, period } })
    if (!carry) throw new NotFoundException('该期间没有结转记录')
    const periodRow = await this.periodRepo.findOne({ where: { tenantId: user.tenantId, period } })
    const voucher = await this.voucherRepo.findOne({ where: { id: carry.voucherId, tenantId: user.tenantId } })
    const check = evaluateCarryForwardReversal({
      carryStatus: carry.status,
      periodStatus: periodRow?.status,
      voucherStatus: voucher?.status
    })
    if (!check.ok) throw new BadRequestException(check.reason ?? '当前状态不可反结转')
    const entries = await this.entryRepo.find({ where: { tenantId: user.tenantId, voucherId: carry.voucherId } })
    if (entries.length === 0) throw new BadRequestException('结转凭证没有分录，无法反结转')
    const totalDebit = this.money(entries.reduce((sum, entry) => sum + this.num(entry.credit), 0))
    const totalCredit = this.money(entries.reduce((sum, entry) => sum + this.num(entry.debit), 0))
    const reversal = await this.voucherRepo.save(this.voucherRepo.create({
      tenantId: user.tenantId,
      voucherNo: this.number('V'),
      voucherDate: this.lastDayOfPeriod(period),
      period,
      sourceType: 'PERIOD_CARRY_REVERSE',
      status: 'POSTED',
      totalDebit,
      totalCredit,
      createdBy: user.userId,
      postedAt: new Date(),
      checkStatus: 'PASS',
      remark: `${period} 期末结转反结转`
    }))
    await this.entryRepo.save(entries.map((entry, index) => this.entryRepo.create({
      tenantId: user.tenantId,
      voucherId: reversal.id,
      lineNo: index + 1,
      subjectId: entry.subjectId,
      summary: `冲回${entry.summary ?? ''}`,
      debit: this.money(this.num(entry.credit)),
      credit: this.money(this.num(entry.debit)),
      period
    })))
    carry.status = 'REVERSED'
    await this.carryRepo.save(carry)
    if (periodRow && periodRow.status === 'CARRIED') {
      periodRow.status = 'OPEN'
      await this.periodRepo.save(periodRow)
    }
    await this.auditService.record({
      bizType: 'fin_period', bizId: carry.id, action: 'REVERSE_PERIOD_CARRY',
      afterValue: { period, voucherId: reversal.id, totalAmount: totalDebit }
    }, user)
    return { carry, voucher: reversal }
  }

  /** 期间最后一天（结转凭证日期） */
  private lastDayOfPeriod(period: string): string {
    const [year, month] = period.split('-').map((item) => Number(item))
    if (!Number.isFinite(year) || !Number.isFinite(month)) return `${period}-01`
    const date = new Date(Date.UTC(year, month, 0))
    return `${period}-${String(date.getUTCDate()).padStart(2, '0')}`
  }

  /** 资金账户间转账 */
  async transferBetweenAccounts(dto: AccountTransferDto, user: JwtUser): Promise<Record<string, unknown>> {
    const from = await this.accountRepo.findOne({ where: { id: dto.fromAccountId, tenantId: user.tenantId, isDeleted: 0 } })
    const to = await this.accountRepo.findOne({ where: { id: dto.toAccountId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!from) throw new NotFoundException('转出资金账户不存在')
    if (!to) throw new NotFoundException('转入资金账户不存在')
    const amount = this.num(dto.amount)
    const check = validateAccountTransfer({
      fromAccountId: dto.fromAccountId,
      toAccountId: dto.toAccountId,
      amount,
      fromBalance: this.num(from.balance),
      fromStatus: from.status,
      toStatus: to.status
    })
    if (!check.ok) throw new BadRequestException(check.reason ?? '转账参数不合法')
    from.balance = this.money(this.num(from.balance) - amount)
    to.balance = this.money(this.num(to.balance) + amount)
    await this.accountRepo.save([from, to])

    let voucherId: number | null = null
    const customEntries = dto.entries ?? []
    if (customEntries.length > 0) {
      // 自定义多科目转账凭证（可跨科目，如手续费）
      const totalDebit = customEntries.reduce((sum, entry) => sum + this.num(entry.debit), 0)
      const totalCredit = customEntries.reduce((sum, entry) => sum + this.num(entry.credit), 0)
      if (totalDebit <= 0 && totalCredit <= 0) throw new BadRequestException('转账凭证至少需要一条金额')
      if (Math.abs(totalDebit - totalCredit) > 0.0001) throw new BadRequestException('转账凭证借贷不平衡')
      const subjectIds = [...new Set(customEntries.map((entry) => entry.subjectId))]
      const subjects = await this.subjectRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
      for (const subjectId of subjectIds) {
        if (!subjects.some((item) => item.id === subjectId)) throw new NotFoundException(`科目 ${subjectId} 不存在`)
      }
      const period = dto.transferDate.slice(0, 7)
      const voucher = await this.voucherRepo.save(this.voucherRepo.create({
        tenantId: user.tenantId,
        voucherNo: this.number('V'),
        voucherDate: dto.transferDate,
        period,
        sourceType: 'ACCOUNT_TRANSFER',
        status: 'POSTED',
        totalDebit: this.money(totalDebit),
        totalCredit: this.money(totalCredit),
        createdBy: user.userId,
        postedAt: new Date(),
        checkStatus: 'PASS',
        remark: dto.remark ?? '资金账户间转账'
      }))
      await this.entryRepo.save(customEntries.map((entry, index) => this.entryRepo.create({
        tenantId: user.tenantId,
        voucherId: voucher.id,
        lineNo: index + 1,
        subjectId: entry.subjectId,
        summary: entry.summary ?? `资金转账 ${from.accountName} → ${to.accountName}`,
        debit: this.money(this.num(entry.debit)),
        credit: this.money(this.num(entry.credit)),
        period
      })))
      voucherId = voucher.id
    } else if (dto.bankSubjectId) {
      const subject = await this.subjectRepo.findOne({ where: { id: dto.bankSubjectId, tenantId: user.tenantId, isDeleted: 0 } })
      if (!subject) throw new NotFoundException('银行存款科目不存在')
      const period = dto.transferDate.slice(0, 7)
      const voucher = await this.voucherRepo.save(this.voucherRepo.create({
        tenantId: user.tenantId,
        voucherNo: this.number('V'),
        voucherDate: dto.transferDate,
        period,
        sourceType: 'ACCOUNT_TRANSFER',
        status: 'POSTED',
        totalDebit: this.money(amount),
        totalCredit: this.money(amount),
        createdBy: user.userId,
        postedAt: new Date(),
        checkStatus: 'PASS',
        remark: dto.remark ?? '资金账户间转账'
      }))
      await this.entryRepo.save([
        this.entryRepo.create({
          tenantId: user.tenantId, voucherId: voucher.id, lineNo: 1, subjectId: subject.id,
          summary: `转入 ${to.accountName}`, debit: '0', credit: this.money(amount), period
        }),
        this.entryRepo.create({
          tenantId: user.tenantId, voucherId: voucher.id, lineNo: 2, subjectId: subject.id,
          summary: `转出 ${from.accountName}`, debit: this.money(amount), credit: '0', period
        })
      ])
      voucherId = voucher.id
    }
    const transfer = await this.transferRepo.save(this.transferRepo.create({
      tenantId: user.tenantId,
      transferNo: this.number('TRF'),
      fromAccountId: dto.fromAccountId,
      toAccountId: dto.toAccountId,
      amount: this.money(amount),
      transferDate: dto.transferDate,
      voucherId,
      remark: dto.remark ?? null,
      createdBy: user.userId
    }))
    await this.auditService.record({
      bizType: 'fin_account_transfer', bizId: transfer.id, action: 'TRANSFER_FUNDS',
      afterValue: { fromAccountId: dto.fromAccountId, toAccountId: dto.toAccountId, amount: transfer.amount, voucherId }
    }, user)
    return { transfer, fromBalance: from.balance, toBalance: to.balance, voucherId }
  }

  /** 转账流水 */
  async listAccountTransfers(query: QueryFinanceDto, user: JwtUser): Promise<PageResult<FinAccountTransferEntity>> {
    const where = scopeWhere<FinAccountTransferEntity>({ tenantId: user.tenantId }, user)
    const [list, total] = await this.transferRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 固定资产变更：变更留痕，折旧规则变更后生效 */
  async changeAsset(id: number, dto: AssetChangeDto, user: JwtUser): Promise<Record<string, unknown>> {
    const asset = await this.assetRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!asset) throw new NotFoundException('固定资产不存在')
    if (asset.status === 'DISPOSED') throw new BadRequestException('已处置资产不可变更')
    const before = { assetName: asset.assetName, originalValue: asset.originalValue, usefulMonths: asset.usefulMonths }
    if (dto.assetName !== undefined) asset.assetName = dto.assetName
    if (dto.originalValue !== undefined) {
      if (this.num(dto.originalValue) < this.num(asset.depreciatedValue)) throw new BadRequestException('变更后原值不得小于已折旧金额')
      asset.originalValue = dto.originalValue
    }
    if (dto.usefulMonths !== undefined) asset.usefulMonths = dto.usefulMonths
    const after = { assetName: asset.assetName, originalValue: asset.originalValue, usefulMonths: asset.usefulMonths }
    const changes = buildAssetChangeDiff(before, after, { assetName: '资产名称', originalValue: '原值', usefulMonths: '使用月数' })
    if (changes.length === 0) throw new BadRequestException('未检测到变更内容')
    const saved = await this.assetRepo.save(asset)
    const change = await this.assetChangeRepo.save(this.assetChangeRepo.create({
      tenantId: user.tenantId,
      assetId: id,
      changeType: dto.changeType,
      beforeValue: before,
      afterValue: after,
      changes,
      reason: dto.reason ?? null,
      createdBy: user.userId
    }))
    await this.auditService.record({
      bizType: 'fin_asset', bizId: id, action: 'CHANGE_ASSET',
      afterValue: { changes, reason: dto.reason ?? null, changeType: dto.changeType }
    }, user)
    return { asset: saved, change }
  }

  /** 资产变更记录 */
  async listAssetChanges(query: QueryFinanceDto, user: JwtUser): Promise<PageResult<FinAssetChangeEntity>> {
    const where = scopeWhere<FinAssetChangeEntity>({ tenantId: user.tenantId }, user)
    const [list, total] = await this.assetChangeRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  private async applyWriteoff(item: { bizType: string; bizId: number; amount: string }, sourceType: string, sourceId: number, user: JwtUser): Promise<void> {
    if (item.bizType === 'RECEIVABLE') {
      const ar = await this.arRepo.findOne({ where: { id: item.bizId, tenantId: user.tenantId } })
      if (!ar) throw new NotFoundException('应收单不存在')
      const received = this.num(ar.receivedAmount) + this.num(item.amount)
      if (received > this.num(ar.amount)) throw new BadRequestException('核销金额超过应收金额')
      ar.receivedAmount = this.money(received)
      ar.status = received >= this.num(ar.amount) ? 'CLOSED' : 'PARTIAL'
      await this.arRepo.save(ar)
    } else if (item.bizType === 'PAYABLE') {
      const ap = await this.apRepo.findOne({ where: { id: item.bizId, tenantId: user.tenantId } })
      if (!ap) throw new NotFoundException('应付单不存在')
      const paid = this.num(ap.paidAmount) + this.num(item.amount)
      if (paid > this.num(ap.amount)) throw new BadRequestException('核销金额超过应付金额')
      ap.paidAmount = this.money(paid)
      ap.status = paid >= this.num(ap.amount) ? 'CLOSED' : 'PARTIAL'
      await this.apRepo.save(ap)
    } else {
      throw new BadRequestException('核销业务类型不正确')
    }
    await this.writeoffRepo.save(this.writeoffRepo.create({
      tenantId: user.tenantId,
      bizType: item.bizType,
      bizId: item.bizId,
      writeoffType: sourceType,
      sourceId,
      amount: item.amount,
      reason: `关联单据 ${sourceId}`,
      createdBy: user.userId
    }))
  }

  /** 单据所属会计期间 */
  private periodOf(date: string | Date | null | undefined): string {
    if (!date) return new Date().toISOString().slice(0, 7)
    return new Date(date).toISOString().slice(0, 7)
  }

  /** 期间是否已结账 */
  private async isPeriodClosed(period: string, user: JwtUser): Promise<boolean> {
    const entity = await this.periodRepo.findOne({ where: { tenantId: user.tenantId, period } })
    return entity?.status === 'CLOSED'
  }

  /**
   * 释放某个收/付款单产生的核销记录，并回退应收/应付的已核销金额。
   */
  private async releaseWriteoffs(writeoffType: 'RECEIPT' | 'PAYMENT', sourceId: number, user: JwtUser): Promise<number> {
    const records = await this.writeoffRepo.find({ where: { tenantId: user.tenantId, writeoffType, sourceId } })
    let released = 0
    for (const record of records) {
      const amount = this.num(record.amount)
      if (record.bizType === 'RECEIVABLE') {
        const ar = await this.arRepo.findOne({ where: { id: record.bizId, tenantId: user.tenantId } })
        if (ar) {
          const received = Math.max(0, this.num(ar.receivedAmount) - amount)
          ar.receivedAmount = this.money(received)
          ar.status = received <= 0 ? 'OPEN' : received >= this.num(ar.amount) ? 'CLOSED' : 'PARTIAL'
          await this.arRepo.save(ar)
        }
      } else if (record.bizType === 'PAYABLE') {
        const ap = await this.apRepo.findOne({ where: { id: record.bizId, tenantId: user.tenantId } })
        if (ap) {
          const paid = Math.max(0, this.num(ap.paidAmount) - amount)
          ap.paidAmount = this.money(paid)
          ap.status = paid <= 0 ? 'OPEN' : paid >= this.num(ap.amount) ? 'CLOSED' : 'PARTIAL'
          await this.apRepo.save(ap)
        }
      }
      released += amount
      await this.writeoffRepo.remove(record)
    }
    return Number(released.toFixed(4))
  }

  /**
   * 生成红字凭证：按传入的原分录借贷互换生成红字分录并过账；未传分录则只登记单据红冲。
   */
  private async createRedLineVoucher(
    entries: RedLineEntryInput[] | undefined,
    period: string,
    remark: string,
    user: JwtUser
  ): Promise<VoucherEntity | null> {
    if (!entries || entries.length === 0) return null
    const redEntries = buildRedLineEntries(entries)
    const voucher = await this.createVoucher({
      voucherDate: this.lastDayOfPeriod(period),
      period,
      sourceType: 'REVERSAL',
      remark,
      entries: redEntries.map((item) => ({
        subjectId: item.subjectId,
        summary: item.summary,
        debit: item.debit,
        credit: item.credit,
        auxType: item.auxType ?? undefined,
        auxId: item.auxId ?? undefined
      }))
    }, user)
    return this.postVoucher(voucher.id, user)
  }

  /** 科目期末余额（已过账凭证累计 + 最新期间期初余额） */
  private async subjectBalanceOf(subjectId: number, user: JwtUser): Promise<number> {
    const history = await this.loadLedgerSnapshot('9999-12', user)
    let balance = 0
    for (const entry of history) {
      if (entry.subjectId !== subjectId) continue
      balance += this.num(entry.debit) - this.num(entry.credit)
    }
    const openings = await this.openingRepo.find({ where: { tenantId: user.tenantId, subjectId } })
    const latest = openings.reduce((max, item) => (item.period > max ? item.period : max), '')
    for (const item of openings) {
      if (item.period !== latest) continue
      balance += item.direction === 'CREDIT' ? -this.num(item.amount) : this.num(item.amount)
    }
    return Number(balance.toFixed(4))
  }

  private async ensurePeriodOpen(period: string, user: JwtUser): Promise<void> {
    const entity = await this.periodRepo.findOne({ where: { tenantId: user.tenantId, period } })
    if (entity?.status === 'CLOSED') throw new BadRequestException('会计期间已结账')
  }

  /**
   * 凭证分录科目校验：停用科目、非末级科目与缺失的辅助核算均拦截。
   * 红冲凭证允许引用已停用科目，否则历史凭证将无法冲销。
   */
  private async validateEntries(entries: Array<{ subjectId: number; summary?: string; debit?: string; credit?: string; auxType?: string; auxId?: string }>, user: JwtUser, sourceType?: string): Promise<void> {
    const subjects = await this.subjectRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const usage = validateSubjectUsage(
      subjects.map((item) => ({
        id: item.id,
        subjectCode: item.subjectCode,
        subjectName: item.subjectName,
        category: item.category,
        auxType: item.auxType,
        isLeaf: item.isLeaf,
        status: item.status
      })),
      entries.map((line) => ({
        subjectId: line.subjectId,
        summary: line.summary,
        debit: this.num(line.debit),
        credit: this.num(line.credit),
        auxType: line.auxType ?? null,
        auxId: line.auxId ?? null
      }))
    )
    const issues = sourceType === 'REVERSE'
      ? usage.issues.filter((issue) => issue.type !== 'DISABLED')
      : usage.issues
    if (issues.length > 0) throw new BadRequestException(`科目校验未通过：${issues.map((issue) => issue.message).join('；')}`)
  }

  private number(prefix: string): string {
    return `${prefix}${`${Date.now().toString(36)}${randomBytes(2).toString('hex')}`.toUpperCase()}`
  }

  private num(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  private money(value: number): string { return value.toFixed(4) }
}
