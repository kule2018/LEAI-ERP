import { randomBytes } from 'node:crypto'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Between, In, Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { scopeWhere } from '../../common/data-scope-context'
import {
  allocateBudgetOccupation, applyVoucherTemplate, buildAgingRisk, buildDashboardMetrics, buildStatementNotes,
  canReopenPeriod, compareStatements, evaluateCostRollback, evaluateExpensePolicy, evaluatePeriodChecklist,
  buildAuxTrialBalance, evaluateTrialBalance, evaluateVoucherBalances, matchBankTransactions,
  parseReceiptText, simulateCashFlow,
  suggestBadDebtProvision, suggestSubjects, validateSubjectUsage,
  type AgingReceivable, type CashFlowScenario, type CashFlowSimulation, type ExpensePolicySnapshot,
  type PeriodCheckItem, type ReceiptOcrResult, type StatementItem, type SubjectSnapshot,
  type TrialBalanceRow, type VoucherEntrySnapshot, type VoucherTemplateItem
} from '../../common/finance-extension-engine'
import { AuditService } from '../audit/audit.service'
import { createDomainEvent, DomainEventBus } from '../events/domain-event.module'
import {
  bucketByMonth, buildRollingForecast, type RollingForecastResult
} from '../../common/cashflow-rolling-forecast-rules'
import {
  allocateClaimToDepartments, canTransitionClaim, checkDepreciationCompleteness, evaluateClaimApproval
} from '../../common/finance-closure-rules'
import { BankTransactionEntity } from './entities/bank-transaction.entity'
import { CostJobEntity } from './entities/cost-job.entity'
import {
  FinAssetDepreciationEntity, FinAssetEntity, FinBudgetEntity, FinCostEntity, FinInvoiceEntity, FinPaymentEntity,
  FinPeriodEntity, FinReceiptEntity, PayableEntity, ReceivableEntity, VoucherEntity, VoucherEntryEntity,
  AccountSubjectEntity, FinAccountEntity
} from './entities/finance.entities'
import {
  FinBadDebtProvisionEntity, FinBankMatchEntity, FinBudgetOccupationEntity, FinCashflowCalendarEntity,
  FinCashflowScenarioEntity, FinCollectionPlanEntity, FinExpenseClaimAllocEntity, FinExpenseClaimEntity,
  FinExpensePolicyEntity, FinPeriodCheckEntity, FinVoucherAttachmentEntity, FinVoucherTemplateEntity
} from './entities/finance-extension.entity'
import {
  AllocateClaimDto, ApplyVoucherTemplateDto, ApproveClaimDto, ApproveProvisionDto, ConfirmBankMatchDto,
  CreateCashflowCalendarDto, CreateCashflowScenarioDto, CreateCollectionPlanDto, CreateExpenseClaimDto,
  CreateExpensePolicyDto, CreateVoucherAttachmentDto, CreateVoucherTemplateDto, OccupyBudgetDto, PayClaimDto,
  QueryFinExtensionDto, ReleaseBudgetDto, ReopenPeriodDto, RollingForecastDto, RunBankMatchDto,
  SimulateCashflowDto, SubmitProvisionDto, SuggestSubjectDto, ValidateVoucherDto
} from './finance-extension.dto'

@Injectable()
export class FinanceExtensionService {
  constructor(
    @InjectRepository(AccountSubjectEntity) private readonly subjectRepo: Repository<AccountSubjectEntity>,
    @InjectRepository(FinAccountEntity) private readonly accountRepo: Repository<FinAccountEntity>,
    @InjectRepository(VoucherEntity) private readonly voucherRepo: Repository<VoucherEntity>,
    @InjectRepository(VoucherEntryEntity) private readonly entryRepo: Repository<VoucherEntryEntity>,
    @InjectRepository(ReceivableEntity) private readonly arRepo: Repository<ReceivableEntity>,
    @InjectRepository(PayableEntity) private readonly apRepo: Repository<PayableEntity>,
    @InjectRepository(FinReceiptEntity) private readonly receiptRepo: Repository<FinReceiptEntity>,
    @InjectRepository(FinPaymentEntity) private readonly paymentRepo: Repository<FinPaymentEntity>,
    @InjectRepository(FinInvoiceEntity) private readonly invoiceRepo: Repository<FinInvoiceEntity>,
    @InjectRepository(FinPeriodEntity) private readonly periodRepo: Repository<FinPeriodEntity>,
    @InjectRepository(FinBudgetEntity) private readonly budgetRepo: Repository<FinBudgetEntity>,
    @InjectRepository(FinCostEntity) private readonly costRepo: Repository<FinCostEntity>,
    @InjectRepository(CostJobEntity) private readonly costJobRepo: Repository<CostJobEntity>,
    @InjectRepository(BankTransactionEntity) private readonly bankTxRepo: Repository<BankTransactionEntity>,
    @InjectRepository(FinVoucherTemplateEntity) private readonly templateRepo: Repository<FinVoucherTemplateEntity>,
    @InjectRepository(FinVoucherAttachmentEntity) private readonly attachmentRepo: Repository<FinVoucherAttachmentEntity>,
    @InjectRepository(FinExpensePolicyEntity) private readonly policyRepo: Repository<FinExpensePolicyEntity>,
    @InjectRepository(FinExpenseClaimEntity) private readonly claimRepo: Repository<FinExpenseClaimEntity>,
    @InjectRepository(FinExpenseClaimAllocEntity) private readonly claimAllocRepo: Repository<FinExpenseClaimAllocEntity>,
    @InjectRepository(FinBadDebtProvisionEntity) private readonly provisionRepo: Repository<FinBadDebtProvisionEntity>,
    @InjectRepository(FinCollectionPlanEntity) private readonly collectionRepo: Repository<FinCollectionPlanEntity>,
    @InjectRepository(FinBankMatchEntity) private readonly bankMatchRepo: Repository<FinBankMatchEntity>,
    @InjectRepository(FinCashflowScenarioEntity) private readonly scenarioRepo: Repository<FinCashflowScenarioEntity>,
    @InjectRepository(FinCashflowCalendarEntity) private readonly calendarRepo: Repository<FinCashflowCalendarEntity>,
    @InjectRepository(FinPeriodCheckEntity) private readonly periodCheckRepo: Repository<FinPeriodCheckEntity>,
    @InjectRepository(FinBudgetOccupationEntity) private readonly occupationRepo: Repository<FinBudgetOccupationEntity>,
    @InjectRepository(FinAssetEntity) private readonly assetRepo: Repository<FinAssetEntity>,
    @InjectRepository(FinAssetDepreciationEntity) private readonly depreciationRepo: Repository<FinAssetDepreciationEntity>,
    private readonly auditService: AuditService,
    private readonly eventBus: DomainEventBus
  ) {}

  /* ==================== 科目停用校验与辅助核算 ==================== */

  /** 凭证分录科目校验：停用科目、非末级科目、辅助核算缺失均拦截 */
  async validateVoucher(dto: ValidateVoucherDto, user: JwtUser): Promise<Record<string, unknown>> {
    const subjects = await this.subjectRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const entries: VoucherEntrySnapshot[] = dto.entries.map((item) => ({
      subjectId: item.subjectId,
      summary: item.summary,
      debit: this.num(item.debit),
      credit: this.num(item.credit),
      auxType: item.auxType ?? null,
      auxId: item.auxId ?? null
    }))
    const result = validateSubjectUsage(this.subjectSnapshots(subjects), entries)
    return {
      ...result,
      disabledSubjects: subjects
        .filter((item) => item.status !== 'ENABLED')
        .map((item) => ({ id: item.id, subjectCode: item.subjectCode, subjectName: item.subjectName, disableReason: item.disableReason }))
    }
  }

  /** 科目停用影响面：返回该科目已引用的凭证数量 */
  async subjectUsage(subjectId: number, user: JwtUser): Promise<Record<string, unknown>> {
    const subject = await this.subjectRepo.findOne({ where: { id: subjectId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!subject) throw new NotFoundException('科目不存在')
    const entries = await this.entryRepo.find({ where: { tenantId: user.tenantId, subjectId } })
    const voucherIds = [...new Set(entries.map((item) => item.voucherId))]
    const vouchers = voucherIds.length > 0
      ? await this.voucherRepo.find({ where: { id: In(voucherIds), tenantId: user.tenantId } })
      : []
    const posted = vouchers.filter((item) => item.status === 'POSTED')
    return {
      subjectId,
      subjectCode: subject.subjectCode,
      subjectName: subject.subjectName,
      status: subject.status,
      disableReason: subject.disableReason,
      disabledAt: subject.disabledAt,
      entryCount: entries.length,
      voucherCount: voucherIds.length,
      postedVoucherCount: posted.length,
      canDisable: posted.length === 0
    }
  }

  /* ==================== 凭证模板与 AI 科目建议 ==================== */

  async listTemplates(query: QueryFinExtensionDto, user: JwtUser): Promise<PageResult<FinVoucherTemplateEntity>> {
    const where = scopeWhere<FinVoucherTemplateEntity>({ tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }, user)
    const [list, total] = await this.templateRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createTemplate(dto: CreateVoucherTemplateDto, user: JwtUser): Promise<FinVoucherTemplateEntity> {
    const existing = await this.templateRepo.findOne({ where: { tenantId: user.tenantId, templateCode: dto.templateCode } })
    if (existing) throw new BadRequestException('凭证模板编码已存在')
    const entity = await this.templateRepo.save(this.templateRepo.create({
      tenantId: user.tenantId,
      templateCode: dto.templateCode,
      templateName: dto.templateName,
      bizType: dto.bizType ?? 'GENERAL',
      status: 'ENABLED',
      items: dto.items as unknown as VoucherTemplateItem[],
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'fin_voucher_template', bizId: entity.id, action: 'CREATE_VOUCHER_TEMPLATE', afterValue: entity }, user)
    return entity
  }

  /** 套用凭证模板生成凭证草稿 */
  async applyTemplate(dto: ApplyVoucherTemplateDto, user: JwtUser): Promise<Record<string, unknown>> {
    const template = await this.templateRepo.findOne({ where: { id: dto.templateId, tenantId: user.tenantId } })
    if (!template) throw new NotFoundException('凭证模板不存在')
    const subjects = await this.subjectRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const subjectMap: Record<string, number> = {}
    for (const subject of subjects) subjectMap[subject.subjectCode] = subject.id
    const result = applyVoucherTemplate(
      { templateCode: template.templateCode, templateName: template.templateName, bizType: template.bizType, items: (template.items ?? []) as VoucherTemplateItem[] },
      { amount: this.num(dto.amount), subjectMap, summary: dto.summary, auxMap: dto.auxMap }
    )
    await this.auditService.record({ bizType: 'fin_voucher_template', bizId: template.id, action: 'APPLY_VOUCHER_TEMPLATE', afterValue: { amount: dto.amount, balanced: result.balanced } }, user)
    return { templateId: template.id, templateName: template.templateName, ...result }
  }

  /** AI 科目建议：按历史凭证 + 关键词给出候选科目 */
  async suggestSubject(dto: SuggestSubjectDto, user: JwtUser): Promise<Record<string, unknown>> {
    const subjects = await this.subjectRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const entries = await this.entryRepo.find({ where: { tenantId: user.tenantId }, order: { id: 'DESC' }, take: 500 })
    const subjectMap = new Map(subjects.map((item) => [item.id, item]))
    const history = entries
      .filter((entry) => subjectMap.has(entry.subjectId))
      .map((entry) => {
        const subject = subjectMap.get(entry.subjectId)!
        return {
          subjectId: subject.id,
          subjectCode: subject.subjectCode,
          subjectName: subject.subjectName,
          summary: entry.summary ?? '',
          amount: this.num(entry.debit) - this.num(entry.credit)
        }
      })
    const suggestions = suggestSubjects(history, dto.keyword, this.subjectSnapshots(subjects), dto.limit ?? 3)
    return { keyword: dto.keyword, suggestions }
  }

  /* ==================== 凭证附件 ==================== */

  async listAttachments(voucherId: number, user: JwtUser): Promise<FinVoucherAttachmentEntity[]> {
    return this.attachmentRepo.find({ where: { tenantId: user.tenantId, voucherId }, order: { id: 'ASC' } })
  }

  async addAttachment(dto: CreateVoucherAttachmentDto, user: JwtUser): Promise<FinVoucherAttachmentEntity> {
    const voucher = await this.voucherRepo.findOne({ where: { id: dto.voucherId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!voucher) throw new NotFoundException('凭证不存在')
    const entity = await this.attachmentRepo.save(this.attachmentRepo.create({
      tenantId: user.tenantId,
      voucherId: dto.voucherId,
      fileName: dto.fileName,
      fileUrl: dto.fileUrl,
      fileSize: dto.fileSize ?? 0,
      attachmentType: dto.attachmentType ?? 'OTHER',
      uploadedBy: user.userId
    }))
    await this.auditService.record({ bizType: 'fin_voucher_attachment', bizId: entity.id, action: 'ADD_VOUCHER_ATTACHMENT', afterValue: entity }, user)
    return entity
  }

  /* ==================== 试算平衡高亮与凭证下钻 ==================== */

  /** 试算平衡分析：不平衡科目高亮并给出可下钻的凭证 */
  async trialBalanceAnalysis(query: QueryFinExtensionDto, user: JwtUser): Promise<Record<string, unknown>> {
    const period = query.period ?? new Date().toISOString().slice(0, 7)
    const vouchers = await this.voucherRepo.find({ where: { tenantId: user.tenantId, period, isDeleted: 0 } })
    const voucherIds = vouchers.map((item) => item.id)
    const entries = voucherIds.length > 0
      ? await this.entryRepo.find({ where: { tenantId: user.tenantId, voucherId: In(voucherIds) } })
      : []
    const subjects = await this.subjectRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const subjectMap = new Map(subjects.map((item) => [item.id, item]))

    const balance = evaluateVoucherBalances(vouchers.map((item) => ({
      voucherId: item.id,
      voucherNo: item.voucherNo,
      debit: this.num(item.totalDebit),
      credit: this.num(item.totalCredit)
    })))
    const unbalancedIds = balance.unbalanced.map((item) => item.voucherId)

    const map = new Map<number, TrialBalanceRow>()
    for (const entry of entries) {
      const subject = subjectMap.get(entry.subjectId)
      const row = map.get(entry.subjectId) ?? {
        subjectId: entry.subjectId,
        subjectCode: subject?.subjectCode ?? '',
        subjectName: subject?.subjectName ?? '',
        debit: 0,
        credit: 0,
        voucherIds: []
      }
      row.debit += this.num(entry.debit)
      row.credit += this.num(entry.credit)
      row.voucherIds!.push(entry.voucherId)
      map.set(entry.subjectId, row)
    }
    const rows = [...map.values()]
    const analysis = evaluateTrialBalance(rows, unbalancedIds)
    const auxRows = buildAuxTrialBalance(
      entries.map((entry) => ({
        subjectId: entry.subjectId,
        auxType: entry.auxType ?? null,
        auxId: entry.auxId ?? null,
        debit: this.num(entry.debit),
        credit: this.num(entry.credit)
      })),
      new Map(subjects.map((item) => [item.id, { subjectCode: item.subjectCode, subjectName: item.subjectName }]))
    )
    return {
      period,
      ...analysis,
      unbalancedVouchers: balance.unbalanced,
      rows: rows.map((row) => ({
        ...row,
        debit: this.money(row.debit),
        credit: this.money(row.credit),
        balance: this.money(row.debit - row.credit),
        highlighted: analysis.highlightedSubjectIds.includes(row.subjectId)
      })),
      auxRows: auxRows.map((row) => ({
        ...row,
        debit: this.money(row.debit),
        credit: this.money(row.credit),
        balance: this.money(row.balance)
      })),
      auxDimensions: [...new Set(auxRows.map((row) => row.auxType).filter(Boolean))]
    }
  }

  /* ==================== 三大报表同环比与附注 ==================== */

  /** 三大报表同环比、附注与科目下钻 */
  async statementComparison(query: QueryFinExtensionDto, user: JwtUser): Promise<Record<string, unknown>> {
    const period = query.period ?? new Date().toISOString().slice(0, 7)
    const previousPeriod = this.previousPeriod(period)
    const current = await this.statementItems(period, user)
    const previous = await this.statementItems(previousPeriod, user)
    const comparisons = compareStatements(current, previous)
    const notes = buildStatementNotes(comparisons)
    return { period, previousPeriod, comparisons, notes }
  }

  /* ==================== 收支 OCR 与费用政策 ==================== */

  /** 收支单据 OCR 解析 */
  ocrReceipt(text: string): ReceiptOcrResult {
    return parseReceiptText(text)
  }

  async listPolicies(query: QueryFinExtensionDto, user: JwtUser): Promise<PageResult<FinExpensePolicyEntity>> {
    const where = scopeWhere<FinExpensePolicyEntity>({ tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }, user)
    const [list, total] = await this.policyRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createPolicy(dto: CreateExpensePolicyDto, user: JwtUser): Promise<FinExpensePolicyEntity> {
    const existing = await this.policyRepo.findOne({ where: { tenantId: user.tenantId, policyCode: dto.policyCode } })
    if (existing) throw new BadRequestException('费用政策编码已存在')
    const entity = await this.policyRepo.save(this.policyRepo.create({
      tenantId: user.tenantId,
      policyCode: dto.policyCode,
      policyName: dto.policyName,
      category: dto.category ?? null,
      maxAmount: dto.maxAmount ?? null,
      requireInvoice: dto.requireInvoice ? 1 : 0,
      requireApproval: dto.requireApproval ? 1 : 0,
      keywords: dto.keywords ?? null,
      status: 'ENABLED',
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'fin_expense_policy', bizId: entity.id, action: 'CREATE_EXPENSE_POLICY', afterValue: entity }, user)
    return entity
  }

  /** 提交费用单：OCR 解析 + 费用政策判定 */
  async createClaim(dto: CreateExpenseClaimDto, user: JwtUser): Promise<Record<string, unknown>> {
    const ocr = dto.sourceText ? parseReceiptText(dto.sourceText) : null
    const amount = this.num(dto.amount ?? ocr?.amount ?? 0)
    if (amount <= 0) throw new BadRequestException('费用金额无效，请提供金额或可识别的单据文本')
    const policy = await this.matchPolicy(dto.category ?? dto.summary ?? dto.sourceText ?? '', user)
    const evaluation = evaluateExpensePolicy(amount, policy ? this.policySnapshot(policy) : null, {
      hasInvoice: dto.hasInvoice ?? false,
      approved: false,
      category: dto.category,
      summary: dto.summary
    })
    const entity = await this.claimRepo.save(this.claimRepo.create({
      tenantId: user.tenantId,
      claimNo: this.number('EC'),
      deptId: dto.deptId ?? null,
      direction: dto.direction ?? ocr?.direction ?? 'OUT',
      amount: this.money(amount),
      occurredAt: dto.occurredAt ?? ocr?.date ?? null,
      summary: dto.summary ?? ocr?.summary ?? null,
      counterparty: dto.counterparty ?? ocr?.counterparty ?? null,
      sourceText: dto.sourceText ?? null,
      ocrResult: ocr as unknown as Record<string, unknown>,
      policyId: policy?.id ?? null,
      policyLevel: evaluation.level,
      hasInvoice: dto.hasInvoice ? 1 : 0,
      status: evaluation.level === 'REJECT' ? 'REJECTED' : 'SUBMITTED',
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'fin_expense_claim', bizId: entity.id, action: 'CREATE_EXPENSE_CLAIM', afterValue: { amount, policyLevel: evaluation.level } }, user)
    // 预算占用串联：无匹配预算时跳过占用，STRICT 超预算则驳回单据
    try {
      const occupation = await this.occupyClaimBudget(entity, [{ deptId: entity.deptId, amount, subjectId: null }], user)
      return { claim: entity, ocr, policy: evaluation, occupation }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '预算占用失败'
      entity.status = 'REJECTED'
      entity.approveRemark = `预算占用失败：${message}`
      await this.claimRepo.save(entity)
      await this.releaseClaimBudget(entity, user)
      throw new BadRequestException(message)
    }
  }

  async listClaims(query: QueryFinExtensionDto, user: JwtUser): Promise<PageResult<FinExpenseClaimEntity>> {
    const where = scopeWhere<FinExpenseClaimEntity>({ tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }, user)
    const [list, total] = await this.claimRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 报销审批：政策校验 + 状态流转 */
  async approveClaim(id: number, dto: ApproveClaimDto, user: JwtUser): Promise<{ claim: FinExpenseClaimEntity; evaluation: Record<string, unknown> }> {
    const claim = await this.findClaim(id, user)
    if (claim.status !== 'SUBMITTED' && claim.status !== 'APPROVED') {
      throw new BadRequestException(`报销单当前状态 ${claim.status} 不可审批`)
    }
    const policy = claim.policyId ? await this.policyRepo.findOne({ where: { id: claim.policyId, tenantId: user.tenantId } }) : null
    const requiresInvoice = policy ? this.policyRequiresInvoice(policy) : false
    const limit = policy ? Number((policy as unknown as { maxAmount?: string }).maxAmount ?? 0) : 0
    const evaluation = evaluateClaimApproval({
      amount: this.num(claim.amount),
      policyLevel: claim.policyLevel,
      hasInvoice: claim.hasInvoice === 1,
      policyRequiresInvoice: requiresInvoice,
      policyLimit: limit || undefined,
      approveRemark: dto.remark
    })
    const target = dto.status === 'APPROVED' || dto.status === 'REJECTED' || dto.status === 'CANCELLED'
      ? dto.status
      : evaluation.approved ? 'APPROVED' : 'REJECTED'
    const check = canTransitionClaim(claim.status, target)
    if (!check.allowed) throw new BadRequestException(check.reason)
    claim.status = target
    claim.approvedBy = target === 'APPROVED' ? user.userId : null
    claim.approvedAt = target === 'APPROVED' ? new Date() : null
    claim.approveRemark = dto.remark ?? evaluation.reason
    const saved = await this.claimRepo.save(claim)
    // 驳回或取消时释放预算占用；审批通过保持占用直到付款
    if (target === 'REJECTED' || target === 'CANCELLED') {
      await this.releaseClaimBudget(saved, user)
    }
    await this.auditService.record({
      bizType: 'fin_expense_claim', bizId: saved.id, action: 'APPROVE_EXPENSE_CLAIM',
      afterValue: { status: saved.status, evaluation, level: evaluation.level }
    }, user)
    return { claim: saved, evaluation: { ...evaluation, target } }
  }

  /** 报销部门分摊：比例合计必须为 1，仅已审批未付款可分摊 */
  async allocateClaim(
    id: number,
    dto: AllocateClaimDto,
    user: JwtUser
  ): Promise<{ claimId: number; allocations: FinExpenseClaimAllocEntity[]; occupation: { occupied: string; skipped: number; level: string } }> {
    const claim = await this.findClaim(id, user)
    if (claim.status !== 'APPROVED') throw new BadRequestException('仅已审批的报销单可分摊')
    let rows: Array<{ deptId: number; ratio: number; amount: number; subjectId?: number }>
    try {
      rows = allocateClaimToDepartments(this.num(claim.amount), dto.items)
    } catch (cause) {
      throw new BadRequestException(cause instanceof Error ? cause.message : '分摊比例无效')
    }
    await this.claimAllocRepo.delete({ tenantId: user.tenantId, claimId: id })
    const saved: FinExpenseClaimAllocEntity[] = []
    for (const row of rows) {
      saved.push(await this.claimAllocRepo.save(this.claimAllocRepo.create({
        tenantId: user.tenantId,
        claimId: id,
        deptId: row.deptId,
        ratio: row.ratio.toFixed(4),
        amount: this.money(row.amount),
        subjectId: row.subjectId ?? null
      })))
    }
    await this.auditService.record({
      bizType: 'fin_expense_claim', bizId: id, action: 'ALLOCATE_EXPENSE_CLAIM',
      afterValue: { lineCount: saved.length, totalAmount: this.num(claim.amount) }
    }, user)
    // 分摊后按各部门重新占用预算，替换提交时的单部门占用
    await this.releaseClaimBudget(claim, user)
    const occupation = await this.occupyClaimBudget(claim, saved.map((row) => ({
      deptId: row.deptId,
      amount: this.num(row.amount),
      subjectId: row.subjectId
    })), user)
    return { claimId: id, allocations: saved, occupation }
  }

  /** 报销付款：已审批后生成付款单并扣减账户余额，关联报销单 */
  async payClaim(id: number, dto: PayClaimDto, user: JwtUser): Promise<{ claim: FinExpenseClaimEntity; payment: FinPaymentEntity; allocations: FinExpenseClaimAllocEntity[] }> {
    const claim = await this.findClaim(id, user)
    const check = canTransitionClaim(claim.status, 'PAID')
    if (!check.allowed) throw new BadRequestException(check.reason)
    const amount = this.num(dto.amount ?? claim.amount)
    if (amount <= 0) throw new BadRequestException('付款金额无效')
    const account = await this.accountRepo.findOne({ where: { id: dto.accountId, tenantId: user.tenantId, isDeleted: 0 } })
    if (!account) throw new NotFoundException('资金账户不存在')
    const payment = await this.paymentRepo.save(this.paymentRepo.create({
      tenantId: user.tenantId,
      paymentNo: this.number('PAY'),
      supplierId: dto.supplierId,
      accountId: dto.accountId,
      amount: this.money(amount),
      paidAt: new Date().toISOString().slice(0, 10),
      remark: `费用报销 ${claim.claimNo}`,
      createdBy: user.userId
    }))
    account.balance = this.money(this.num(account.balance) - amount)
    await this.accountRepo.save(account)
    const existingAllocations = await this.claimAllocRepo.find({ where: { tenantId: user.tenantId, claimId: id }, order: { id: 'ASC' } })
    if (existingAllocations.length === 0 && claim.deptId) {
      // 未分摊的报销单按申报部门生成默认分摊；已有分摊不再覆盖
      await this.claimAllocRepo.save(this.claimAllocRepo.create({
        tenantId: user.tenantId,
        claimId: id,
        deptId: claim.deptId,
        ratio: '1.0000',
        amount: this.money(amount),
        subjectId: null
      }))
    }
    claim.status = 'PAID'
    claim.paymentId = payment.id
    claim.approvedBy = claim.approvedBy ?? user.userId
    claim.approvedAt = claim.approvedAt ?? new Date()
    const saved = await this.claimRepo.save(claim)
    const allocations = await this.claimAllocRepo.find({ where: { tenantId: user.tenantId, claimId: id }, order: { id: 'ASC' } })
    // 付款即占用转实际使用：释放占用并回写预算已用额
    await this.consumeClaimBudget(saved, amount, user)
    await this.auditService.record({
      bizType: 'fin_expense_claim', bizId: saved.id, action: 'PAY_EXPENSE_CLAIM',
      afterValue: { paymentId: payment.id, amount: this.money(amount) }
    }, user)
    await this.eventBus.emit(createDomainEvent('finance.claim.paid', user, 'fin_expense_claim', saved.id, { amount }))
    return { claim: saved, payment, allocations }
  }

  /* ==================== 报销 × 预算占用 ==================== */

  /** 报销单所属会计期间：取发生月份，缺省为当前月 */
  private claimPeriod(claim: FinExpenseClaimEntity): string {
    const occurred = claim.occurredAt ? String(claim.occurredAt) : ''
    const period = occurred.slice(0, 7)
    return /^\d{4}-\d{2}$/.test(period) ? period : new Date().toISOString().slice(0, 7)
  }

  /**
   * 报销预算占用：按「期间 + 部门(+科目)」匹配预算并落库占用明细。
   * 无匹配预算时跳过（未编制预算的科目不阻断报销）；STRICT 规则超预算直接拒绝。
   */
  private async occupyClaimBudget(
    claim: FinExpenseClaimEntity,
    items: Array<{ deptId: number | null; amount: number; subjectId: number | null }>,
    user: JwtUser
  ): Promise<{ occupied: string; skipped: number; level: string }> {
    const period = this.claimPeriod(claim)
    const budgets = await this.budgetRepo.find({ where: { tenantId: user.tenantId, period } })
    if (budgets.length === 0) return { occupied: '0.0000', skipped: items.length, level: 'SKIP' }
    const snapshots = budgets.map((item) => ({
      id: item.id,
      period: item.period,
      deptId: item.deptId,
      subjectId: item.subjectId,
      budgetAmount: this.num(item.budgetAmount),
      usedAmount: this.num(item.usedAmount),
      occupiedAmount: this.num(item.occupiedAmount),
      controlRule: (item.controlRule as 'WARN' | 'STRICT') ?? 'WARN'
    }))
    let occupied = 0
    let skipped = 0
    for (const item of items) {
      const amount = this.num(item.amount)
      if (amount <= 0) continue
      const allocation = allocateBudgetOccupation(snapshots, {
        period,
        deptId: item.deptId ?? null,
        subjectId: item.subjectId ?? null,
        amount,
        bizType: 'EXPENSE',
        bizId: claim.id
      })
      if (allocation.level === 'REJECT') {
        throw new BadRequestException(`预算占用被拒绝：${allocation.allocations[0]?.reason ?? '超出可用预算'}`)
      }
      if (allocation.allocations.length === 0) {
        skipped += 1
        continue
      }
      const target = allocation.allocations[0]
      await this.occupationRepo.save(this.occupationRepo.create({
        tenantId: user.tenantId,
        budgetId: target.budgetId,
        period,
        deptId: item.deptId ?? null,
        subjectId: item.subjectId ?? null,
        amount: this.money(target.amount),
        bizType: 'EXPENSE',
        bizId: claim.id,
        released: 0,
        createdBy: user.userId
      }))
      const budget = budgets.find((row) => row.id === target.budgetId)
      if (budget) {
        budget.occupiedAmount = this.money(this.num(budget.occupiedAmount) + target.amount)
        await this.budgetRepo.save(budget)
        const snapshot = snapshots.find((row) => row.id === target.budgetId)
        if (snapshot) snapshot.occupiedAmount = this.num(snapshot.occupiedAmount) + target.amount
      }
      occupied += target.amount
    }
    await this.auditService.record({
      bizType: 'fin_expense_claim', bizId: claim.id, action: 'OCCUPY_CLAIM_BUDGET',
      afterValue: { period, occupied: this.money(occupied), skipped }
    }, user)
    return { occupied: this.money(occupied), skipped, level: occupied > 0 ? 'PASS' : 'SKIP' }
  }

  /** 释放报销单的预算占用（驳回、取消、重新分摊前调用） */
  private async releaseClaimBudget(claim: FinExpenseClaimEntity, user: JwtUser): Promise<void> {
    const occupations = await this.occupationRepo.find({
      where: { tenantId: user.tenantId, bizType: 'EXPENSE', bizId: claim.id, released: 0 }
    })
    if (occupations.length === 0) return
    for (const occupation of occupations) {
      occupation.released = 1
      await this.occupationRepo.save(occupation)
      const budget = await this.budgetRepo.findOne({ where: { id: occupation.budgetId, tenantId: user.tenantId } })
      if (budget) {
        budget.occupiedAmount = this.money(Math.max(0, this.num(budget.occupiedAmount) - this.num(occupation.amount)))
        await this.budgetRepo.save(budget)
      }
    }
    await this.auditService.record({
      bizType: 'fin_expense_claim', bizId: claim.id, action: 'RELEASE_CLAIM_BUDGET',
      afterValue: { released: occupations.length }
    }, user)
  }

  /** 付款后把预算占用转为实际使用：释放占用并回写已用额 */
  private async consumeClaimBudget(claim: FinExpenseClaimEntity, amount: number, user: JwtUser): Promise<void> {
    const occupations = await this.occupationRepo.find({
      where: { tenantId: user.tenantId, bizType: 'EXPENSE', bizId: claim.id, released: 0 }
    })
    const total = this.num(amount)
    let remaining = total
    for (const occupation of occupations) {
      if (remaining <= 0) break
      const used = Math.min(this.num(occupation.amount), remaining)
      if (used <= 0) continue
      remaining -= used
      const budget = await this.budgetRepo.findOne({ where: { id: occupation.budgetId, tenantId: user.tenantId } })
      if (budget) {
        budget.usedAmount = this.money(this.num(budget.usedAmount) + used)
        await this.budgetRepo.save(budget)
      }
    }
    await this.releaseClaimBudget(claim, user)
    await this.auditService.record({
      bizType: 'fin_expense_claim', bizId: claim.id, action: 'CONSUME_CLAIM_BUDGET',
      afterValue: { amount: this.money(total) }
    }, user)
  }

  private async findClaim(id: number, user: JwtUser): Promise<FinExpenseClaimEntity> {
    const claim = await this.claimRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!claim) throw new NotFoundException('报销单不存在')
    return claim
  }

  private policyRequiresInvoice(policy: FinExpensePolicyEntity): boolean {
    const value = (policy as unknown as { requireInvoice?: number | boolean }).requireInvoice
    return value === 1 || value === true
  }

  /* ==================== 账龄风险、催收与坏账计提 ==================== */

  /** 账龄 AI 催收建议 */
  async agingRisk(query: QueryFinExtensionDto, user: JwtUser): Promise<Record<string, unknown>> {
    const customerId = query.customerId ? Number(query.customerId) : null
    const receivables = await this.arRepo.find({
      where: { tenantId: user.tenantId, status: In(['OPEN', 'PARTIAL']), ...(customerId ? { customerId } : {}) }
    })
    const rows: AgingReceivable[] = receivables.map((item) => ({
      customerId: item.customerId,
      customerName: `客户 ${item.customerId}`,
      receivableId: item.id,
      amount: this.num(item.amount),
      receivedAmount: this.num(item.receivedAmount),
      dueDate: item.dueDate,
      lastContactAt: item.lastContactAt
    }))
    const risks = buildAgingRisk(rows, new Date())
    for (const receivable of receivables) {
      const risk = risks.find((item) => item.receivableId === receivable.id)
      if (!risk) continue
      receivable.riskLevel = risk.level
      await this.arRepo.save(receivable)
    }
    const provision = suggestBadDebtProvision(risks, { current: 0, days31: 0.05, days61: 0.1, days91: 0.3 })
    return { risks, provision }
  }

  async createCollectionPlan(dto: CreateCollectionPlanDto, user: JwtUser): Promise<FinCollectionPlanEntity> {
    const overdue = dto.overdueDays ?? 0
    const entity = await this.collectionRepo.save(this.collectionRepo.create({
      tenantId: user.tenantId,
      customerId: dto.customerId,
      customerName: dto.customerName ?? null,
      receivableId: dto.receivableId ?? null,
      amount: this.money(this.num(dto.amount)),
      overdueDays: overdue,
      riskLevel: overdue > 90 ? 'HIGH' : overdue > 60 ? 'MEDIUM' : overdue > 0 ? 'LOW' : 'NORMAL',
      suggestion: dto.suggestion ?? null,
      action: dto.suggestion ?? '继续跟进',
      plannedAt: dto.plannedAt ?? null,
      status: 'PLANNED',
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'fin_collection_plan', bizId: entity.id, action: 'CREATE_COLLECTION_PLAN', afterValue: entity }, user)
    return entity
  }

  async listCollectionPlans(query: QueryFinExtensionDto, user: JwtUser): Promise<PageResult<FinCollectionPlanEntity>> {
    const where = scopeWhere<FinCollectionPlanEntity>({ tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }, user, { ownerField: 'createdBy' })
    const [list, total] = await this.collectionRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 坏账计提建议（按账龄比例） */
  async suggestProvision(period: string, user: JwtUser): Promise<Record<string, unknown>> {
    const receivables = await this.arRepo.find({ where: { tenantId: user.tenantId, status: In(['OPEN', 'PARTIAL']) } })
    const rows: AgingReceivable[] = receivables.map((item) => ({
      customerId: item.customerId,
      customerName: `客户 ${item.customerId}`,
      receivableId: item.id,
      amount: this.num(item.amount),
      receivedAmount: this.num(item.receivedAmount),
      dueDate: item.dueDate
    }))
    const risks = buildAgingRisk(rows, new Date())
    const suggestion = suggestBadDebtProvision(risks, { current: 0, days31: 0.05, days61: 0.1, days91: 0.3 })
    return { period, ...suggestion }
  }

  async listProvisions(query: QueryFinExtensionDto, user: JwtUser): Promise<PageResult<FinBadDebtProvisionEntity>> {
    const where = scopeWhere<FinBadDebtProvisionEntity>({ tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }, user, { ownerField: 'submittedBy' })
    const [list, total] = await this.provisionRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async submitProvision(dto: SubmitProvisionDto, user: JwtUser): Promise<FinBadDebtProvisionEntity> {
    const amount = this.num(dto.receivableAmount) * (this.num(dto.provisionRate) / 100)
    const entity = await this.provisionRepo.save(this.provisionRepo.create({
      tenantId: user.tenantId,
      period: dto.period,
      customerId: dto.customerId,
      customerName: dto.customerName ?? null,
      agingBucket: dto.agingBucket,
      receivableAmount: this.money(this.num(dto.receivableAmount)),
      provisionRate: this.money(this.num(dto.provisionRate)),
      provisionAmount: this.money(amount),
      status: 'PENDING',
      reason: dto.reason ?? null,
      submittedBy: user.userId
    }))
    await this.auditService.record({ bizType: 'fin_bad_debt_provision', bizId: entity.id, action: 'SUBMIT_PROVISION', afterValue: { amount } }, user)
    return entity
  }

  /** 坏账计提审批：通过后回写应收单的计提金额与风险等级 */
  async approveProvision(id: number, dto: ApproveProvisionDto, user: JwtUser): Promise<FinBadDebtProvisionEntity> {
    const entity = await this.provisionRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('坏账计提单不存在')
    if (entity.status !== 'PENDING') throw new BadRequestException('该计提单已处理')
    entity.status = dto.approved ? 'APPROVED' : 'REJECTED'
    entity.approvedBy = user.userId
    entity.approvedAt = new Date()
    if (dto.comment) entity.reason = dto.comment
    const saved = await this.provisionRepo.save(entity)
    if (dto.approved) {
      const receivables = await this.arRepo.find({ where: { tenantId: user.tenantId, customerId: entity.customerId, status: In(['OPEN', 'PARTIAL']) } })
      for (const receivable of receivables) {
        receivable.provisionAmount = this.money(this.num(receivable.provisionAmount) + this.num(entity.provisionAmount))
        receivable.riskLevel = entity.agingBucket === 'D91' ? 'HIGH' : entity.agingBucket === 'D61' ? 'MEDIUM' : 'LOW'
        await this.arRepo.save(receivable)
      }
    }
    await this.auditService.record({ bizType: 'fin_bad_debt_provision', bizId: id, action: 'APPROVE_PROVISION', afterValue: { approved: dto.approved } }, user)
    return saved
  }

  /* ==================== 银行流水自动匹配 ==================== */

  /** 银行流水自动匹配：与应收/应付/收付款单据按金额、日期、对手方比对 */
  async runBankMatch(dto: RunBankMatchDto, user: JwtUser): Promise<Record<string, unknown>> {
    const transactions = await this.bankTxRepo.find({
      where: {
        tenantId: user.tenantId,
        matched: 0,
        ...(dto.accountId ? { accountId: dto.accountId } : {}),
        ...(dto.dateFrom && dto.dateTo ? { txDate: Between(dto.dateFrom, dto.dateTo) } : {})
      },
      order: { id: 'ASC' }
    })
    if (transactions.length === 0) return { matched: 0, unmatched: 0, results: [] }

    const receivables = await this.arRepo.find({ where: { tenantId: user.tenantId, status: In(['OPEN', 'PARTIAL']) } })
    const payables = await this.apRepo.find({ where: { tenantId: user.tenantId, status: In(['OPEN', 'PARTIAL']) } })
    const receipts = await this.receiptRepo.find({ where: { tenantId: user.tenantId } })
    const payments = await this.paymentRepo.find({ where: { tenantId: user.tenantId } })
    const candidates = [
      ...receivables.map((item) => ({ bizType: 'RECEIVABLE', bizId: item.id, amount: this.num(item.amount) - this.num(item.receivedAmount), date: item.dueDate ?? null, counterparty: null, refNo: item.sourceNo })),
      ...payables.map((item) => ({ bizType: 'PAYABLE', bizId: item.id, amount: this.num(item.amount) - this.num(item.paidAmount), date: item.dueDate ?? null, counterparty: null, refNo: item.sourceNo })),
      ...receipts.map((item) => ({ bizType: 'RECEIPT', bizId: item.id, amount: this.num(item.amount), date: item.receivedAt, counterparty: null, refNo: item.receiptNo })),
      ...payments.map((item) => ({ bizType: 'PAYMENT', bizId: item.id, amount: this.num(item.amount), date: item.paidAt, counterparty: null, refNo: item.paymentNo }))
    ]
    const results = matchBankTransactions(
      transactions.map((item) => ({
        id: item.id,
        externalNo: item.externalNo,
        direction: item.direction === 'OUT' ? 'OUT' : 'IN',
        amount: this.num(item.amount),
        txDate: item.txDate,
        summary: item.summary
      })),
      candidates,
      dto.threshold ?? 60
    )
    let matched = 0
    for (const result of results) {
      const transaction = transactions.find((item) => item.id === result.transactionId)
      if (!transaction) continue
      if (!result.matched) continue
      matched += 1
      transaction.matchTargetType = result.bizType
      transaction.matchTargetId = result.bizId
      transaction.matchScore = this.money(result.score)
      await this.bankTxRepo.save(transaction)
      await this.bankMatchRepo.save(this.bankMatchRepo.create({
        tenantId: user.tenantId,
        transactionId: transaction.id,
        externalNo: transaction.externalNo,
        bizType: result.bizType,
        bizId: result.bizId,
        score: this.money(result.score),
        difference: this.money(result.difference),
        reason: result.reason,
        status: 'SUGGESTED',
        matchedBy: user.userId,
        matchedAt: new Date()
      }))
    }
    await this.auditService.record({ bizType: 'fin_bank_match', action: 'RUN_BANK_MATCH', afterValue: { total: transactions.length, matched } }, user)
    return { total: transactions.length, matched, unmatched: transactions.length - matched, results }
  }

  /** 银行流水匹配确认：回写流水匹配状态 */
  async confirmBankMatch(dto: ConfirmBankMatchDto, user: JwtUser): Promise<FinBankMatchEntity> {
    const transaction = await this.bankTxRepo.findOne({ where: { id: dto.transactionId, tenantId: user.tenantId } })
    if (!transaction) throw new NotFoundException('银行流水不存在')
    transaction.matched = 1
    transaction.matchTargetType = dto.bizType
    transaction.matchTargetId = dto.bizId
    transaction.matchScore = transaction.matchScore ?? '100'
    transaction.matchedAt = new Date()
    await this.bankTxRepo.save(transaction)
    const record = await this.bankMatchRepo.save(this.bankMatchRepo.create({
      tenantId: user.tenantId,
      transactionId: transaction.id,
      externalNo: transaction.externalNo,
      bizType: dto.bizType,
      bizId: dto.bizId,
      score: transaction.matchScore,
      difference: '0',
      reason: '人工确认',
      status: 'CONFIRMED',
      matchedBy: user.userId,
      matchedAt: new Date()
    }))
    await this.auditService.record({ bizType: 'fin_bank_match', bizId: record.id, action: 'CONFIRM_BANK_MATCH', afterValue: { bizType: dto.bizType, bizId: dto.bizId } }, user)
    return record
  }

  async listBankMatches(query: QueryFinExtensionDto, user: JwtUser): Promise<PageResult<FinBankMatchEntity>> {
    const where = scopeWhere<FinBankMatchEntity>({ tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }, user)
    const [list, total] = await this.bankMatchRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /* ==================== 现金流日历与情景模拟 ==================== */

  async listCashflowScenarios(query: QueryFinExtensionDto, user: JwtUser): Promise<PageResult<FinCashflowScenarioEntity>> {
    const where = scopeWhere<FinCashflowScenarioEntity>({ tenantId: user.tenantId, ...(query.status ? { status: query.status } : {}) }, user)
    const [list, total] = await this.scenarioRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createCashflowScenario(dto: CreateCashflowScenarioDto, user: JwtUser): Promise<FinCashflowScenarioEntity> {
    const entity = await this.scenarioRepo.save(this.scenarioRepo.create({
      tenantId: user.tenantId,
      scenarioName: dto.scenarioName,
      scenarioType: dto.scenarioType,
      inflowFactor: this.money(dto.inflowFactor ?? 1),
      outflowFactor: this.money(dto.outflowFactor ?? 1),
      oneOff: this.money(dto.oneOff ?? 0),
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
      remark: dto.remark ?? null,
      status: 'ENABLED',
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'fin_cashflow_scenario', bizId: entity.id, action: 'CREATE_CASHFLOW_SCENARIO', afterValue: entity }, user)
    return entity
  }

  async createCashflowCalendar(dto: CreateCashflowCalendarDto, user: JwtUser): Promise<FinCashflowCalendarEntity> {
    const entity = await this.calendarRepo.save(this.calendarRepo.create({
      tenantId: user.tenantId,
      scenarioId: dto.scenarioId ?? null,
      bizDate: dto.bizDate,
      direction: dto.direction,
      amount: this.money(this.num(dto.amount)),
      summary: dto.summary ?? null,
      sourceType: dto.sourceType ?? null,
      sourceId: dto.sourceId ?? null,
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'fin_cashflow_calendar', bizId: entity.id, action: 'CREATE_CASHFLOW_CALENDAR', afterValue: entity }, user)
    return entity
  }

  /** 现金流日历：按日汇总收支 */
  async cashflowCalendar(query: QueryFinExtensionDto, user: JwtUser): Promise<Record<string, unknown>> {
    const where = { tenantId: user.tenantId }
    const items = await this.calendarRepo.find({
      where: {
        ...where,
        ...(query.period ? { bizDate: Between(`${query.period}-01`, `${query.period}-31`) } : {})
      },
      order: { bizDate: 'ASC' }
    })
    const map = new Map<string, { inflow: number; outflow: number }>()
    for (const item of items) {
      const current = map.get(item.bizDate) ?? { inflow: 0, outflow: 0 }
      if (item.direction === 'OUT') current.outflow += this.num(item.amount)
      else current.inflow += this.num(item.amount)
      map.set(item.bizDate, current)
    }
    const rows = [...map.entries()].map(([date, value]) => ({
      date,
      inflow: this.money(value.inflow),
      outflow: this.money(value.outflow),
      net: this.money(value.inflow - value.outflow)
    }))
    return { rows, totalInflow: this.money(rows.reduce((sum, item) => sum + Number(item.inflow), 0)), totalOutflow: this.money(rows.reduce((sum, item) => sum + Number(item.outflow), 0)) }
  }

  /** 现金流情景模拟：基准/乐观/悲观三套情景 */
  async simulateCashflow(dto: SimulateCashflowDto, user: JwtUser): Promise<CashFlowSimulation> {
    let scenario: CashFlowScenario = {
      scenarioType: (dto.scenarioType ?? 'BASE') as CashFlowScenario['scenarioType'],
      inflowFactor: dto.inflowFactor ?? 1,
      outflowFactor: dto.outflowFactor ?? 1,
      oneOff: dto.oneOff ?? 0
    }
    if (dto.scenarioId) {
      const entity = await this.scenarioRepo.findOne({ where: { id: dto.scenarioId, tenantId: user.tenantId } })
      if (!entity) throw new NotFoundException('现金流情景不存在')
      scenario = {
        scenarioType: entity.scenarioType as CashFlowScenario['scenarioType'],
        inflowFactor: this.num(entity.inflowFactor),
        outflowFactor: this.num(entity.outflowFactor),
        oneOff: this.num(entity.oneOff)
      }
    }
    const items = await this.calendarRepo.find({
      where: {
        tenantId: user.tenantId,
        ...(dto.startDate && dto.endDate ? { bizDate: Between(dto.startDate, dto.endDate) } : {})
      },
      order: { bizDate: 'ASC' }
    })
    const map = new Map<string, { date: string; inflow: number; outflow: number }>()
    for (const item of items) {
      const current = map.get(item.bizDate) ?? { date: item.bizDate, inflow: 0, outflow: 0 }
      if (item.direction === 'OUT') current.outflow += this.num(item.amount)
      else current.inflow += this.num(item.amount)
      map.set(item.bizDate, current)
    }
    const days = [...map.values()].map((item) => ({ date: item.date, inflow: item.inflow, outflow: item.outflow }))
    const result = simulateCashFlow(days, scenario, dto.openingBalance ?? 0)
    await this.auditService.record({ bizType: 'fin_cashflow_scenario', action: 'SIMULATE_CASHFLOW', afterValue: { scenarioType: scenario.scenarioType, endingBalance: result.endingBalance } }, user)
    return result
  }

  /**
   * 资金滚动预测
   *
   * 以现金流日历中 sourceType=ACTUAL 的历史实际作为基线，按月滚动推演未来 N 个月：
   * - 未来月份已有资金计划（sourceType 为 PLAN 或其他）→ 以计划金额为准
   * - 无计划月份 → 按历史基线均值推算
   * - 期初余额默认取资金账户余额合计
   */
  async rollingForecast(dto: RollingForecastDto, user: JwtUser): Promise<RollingForecastResult> {
    const months = Math.max(1, Math.min(24, dto.months ?? 6))
    let inflowFactor = dto.inflowFactor ?? 1
    let outflowFactor = dto.outflowFactor ?? 1
    if (dto.scenarioId) {
      const entity = await this.scenarioRepo.findOne({ where: { id: dto.scenarioId, tenantId: user.tenantId } })
      if (!entity) throw new NotFoundException('现金流情景不存在')
      inflowFactor = this.num(entity.inflowFactor)
      outflowFactor = this.num(entity.outflowFactor)
    }

    // 基线月：优先取指定月，其次取最近有实际现金流的月份，最后取当前月
    const lookBackMonths = 12
    const windowStart = this.monthShift(dto.baseMonth ?? this.currentMonth(), -lookBackMonths)
    const windowEnd = this.monthShift(dto.baseMonth ?? this.currentMonth(), months + 12)
    const items = await this.calendarRepo.find({
      where: {
        tenantId: user.tenantId,
        bizDate: Between(`${windowStart}-01`, `${windowEnd}-31`)
      },
      order: { bizDate: 'ASC' }
    })

    const actualItems = items.filter((item) => item.sourceType === 'ACTUAL')
    const actualBuckets = bucketByMonth(actualItems.map((item) => ({ bizDate: item.bizDate, direction: item.direction, amount: this.num(item.amount) })))
    const baseMonth = dto.baseMonth ?? actualBuckets[actualBuckets.length - 1]?.month ?? this.currentMonth()
    const planItems = items.filter((item) => item.sourceType !== 'ACTUAL' && item.bizDate.slice(0, 7) > baseMonth)
    const planBuckets = bucketByMonth(planItems.map((item) => ({ bizDate: item.bizDate, direction: item.direction, amount: this.num(item.amount) })))

    let openingBalance = dto.openingBalance
    if (openingBalance === undefined || openingBalance === null) {
      const accounts = await this.accountRepo.find({ where: { tenantId: user.tenantId, status: 'ACTIVE', isDeleted: 0 } })
      openingBalance = accounts.reduce((sum, item) => sum + this.num(item.balance), 0)
    }

    const result = buildRollingForecast({
      actuals: actualBuckets,
      plans: planBuckets,
      options: {
        months,
        baseMonth,
        openingBalance: this.num(openingBalance),
        inflowFactor,
        outflowFactor,
        baselineMonths: dto.baselineMonths ?? 3
      }
    })
    await this.auditService.record({
      bizType: 'fin_cashflow_scenario',
      action: 'ROLLING_FORECAST',
      afterValue: { baseMonth, months, endingBalance: result.endingBalance }
    }, user)
    return result
  }

  /* ==================== 成本重算任务队列与回滚 ==================== */

  /** 成本重算任务回滚：按任务快照还原成本明细 */
  async rollbackCostJob(id: number, user: JwtUser): Promise<Record<string, unknown>> {
    const job = await this.costJobRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!job) throw new NotFoundException('成本重算任务不存在')
    const check = evaluateCostRollback({ id: job.id, status: job.status, period: job.period, snapshot: job.snapshot }, 0)
    if (!check.ok) throw new BadRequestException(check.reason ?? '该任务不支持回滚')
    const snapshot = (job.snapshot ?? {}) as { items?: Array<{ productId: number; period: string; costType: string; amount: string }> }
    const items = snapshot.items ?? []
    await this.costRepo.delete({ tenantId: user.tenantId, period: job.period })
    let restored = 0
    for (const item of items) {
      await this.costRepo.save(this.costRepo.create({
        tenantId: user.tenantId,
        productId: item.productId,
        period: item.period,
        costType: item.costType,
        amount: item.amount
      }))
      restored += 1
    }
    job.rollbackStatus = 'ROLLED_BACK'
    job.rolledBackAt = new Date()
    await this.costJobRepo.save(job)
    await this.auditService.record({ bizType: 'fin_cost_job', bizId: id, action: 'ROLLBACK_COST_JOB', afterValue: { period: job.period, restored } }, user)
    return { jobId: id, period: job.period, restored, rollbackStatus: job.rollbackStatus }
  }

  /* ==================== 月结检查清单与反结账 ==================== */

  /** 月结检查清单：生成并落库检查结果 */
  async runPeriodChecks(period: string, user: JwtUser): Promise<Record<string, unknown>> {
    const drafts = await this.voucherRepo.count({ where: { tenantId: user.tenantId, period, status: 'DRAFT', isDeleted: 0 } })
    const posted = await this.voucherRepo.find({ where: { tenantId: user.tenantId, period, status: 'POSTED', isDeleted: 0 } })
    const unbalanced = posted.filter((item) => Math.abs(this.num(item.totalDebit) - this.num(item.totalCredit)) > 0.0001)
    const pendingInvoices = await this.invoiceRepo.count({ where: { tenantId: user.tenantId, status: 'PENDING' } })
    const pendingJobs = await this.costJobRepo.count({ where: { tenantId: user.tenantId, period, status: In(['PENDING', 'RUNNING']) } })
    const overBudget = await this.budgetRepo.count({ where: { tenantId: user.tenantId, period } })
    const exceeded = overBudget > 0
      ? (await this.budgetRepo.find({ where: { tenantId: user.tenantId, period } })).filter((item) => this.num(item.usedAmount) + this.num(item.occupiedAmount) > this.num(item.budgetAmount)).length
      : 0
    // 折旧计提完整性：期间内应计提而未计提的资产
    const assets = await this.assetRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const periodDepreciations = await this.depreciationRepo.find({ where: { tenantId: user.tenantId, period } })
    const depreciatedIds = new Set(periodDepreciations.map((item) => item.assetId))
    const depreciationCheck = checkDepreciationCompleteness(
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
    const missingDepreciation = depreciationCheck.missing

    const items: PeriodCheckItem[] = [
      { code: 'NO_DRAFT_VOUCHER', name: '无未过账凭证', passed: drafts === 0, detail: drafts > 0 ? `${drafts} 张草稿` : undefined, severity: 'BLOCK' },
      { code: 'VOUCHER_BALANCED', name: '已过账凭证借贷平衡', passed: unbalanced.length === 0, detail: unbalanced.length > 0 ? `${unbalanced.length} 张不平` : undefined, severity: 'BLOCK' },
      { code: 'COST_JOB_DONE', name: '成本重算任务已完成', passed: pendingJobs === 0, detail: pendingJobs > 0 ? `${pendingJobs} 个任务未完成` : undefined, severity: 'BLOCK' },
      { code: 'DEPRECIATION_COMPLETE', name: '折旧计提完整', passed: missingDepreciation.length === 0, detail: missingDepreciation.length > 0 ? `${missingDepreciation.length} 项资产未计提：${missingDepreciation.slice(0, 5).join('、')}` : undefined, severity: 'BLOCK' },
      { code: 'NO_PENDING_INVOICE', name: '无待认证发票', passed: pendingInvoices === 0, detail: pendingInvoices > 0 ? `${pendingInvoices} 张待认证` : undefined, severity: 'WARN' },
      { code: 'BUDGET_NOT_EXCEEDED', name: '预算未超限', passed: exceeded === 0, detail: exceeded > 0 ? `${exceeded} 项预算超限` : undefined, severity: 'WARN' }
    ]
    const result = evaluatePeriodChecklist(items)

    await this.periodCheckRepo.delete({ tenantId: user.tenantId, period })
    for (const item of items) {
      await this.periodCheckRepo.save(this.periodCheckRepo.create({
        tenantId: user.tenantId,
        period,
        checkCode: item.code,
        checkName: item.name,
        passed: item.passed ? 1 : 0,
        detail: item.detail ?? null,
        severity: item.severity,
        checkedBy: user.userId
      }))
    }
    let periodEntity = await this.periodRepo.findOne({ where: { tenantId: user.tenantId, period } })
    if (!periodEntity) periodEntity = this.periodRepo.create({ tenantId: user.tenantId, period, status: 'OPEN' })
    periodEntity.checkStatus = result.ok ? 'PASS' : 'FAILED'
    await this.periodRepo.save(periodEntity)
    await this.auditService.record({ bizType: 'fin_period_check', action: 'RUN_PERIOD_CHECKS', afterValue: { period, ok: result.ok } }, user)
    return { period, ...result }
  }

  async listPeriodChecks(query: QueryFinExtensionDto, user: JwtUser): Promise<FinPeriodCheckEntity[]> {
    return this.periodCheckRepo.find({ where: { tenantId: user.tenantId, ...(query.period ? { period: query.period } : {}) }, order: { id: 'ASC' } })
  }

  /** 反结账：校验阻断项后把期间退回 OPEN */
  async reopenPeriod(dto: ReopenPeriodDto, user: JwtUser): Promise<FinPeriodEntity> {
    const periodEntity = await this.periodRepo.findOne({ where: { tenantId: user.tenantId, period: dto.period } })
    if (!periodEntity) throw new NotFoundException('会计期间不存在')
    const pendingJobs = await this.costJobRepo.count({ where: { tenantId: user.tenantId, period: dto.period, status: In(['PENDING', 'RUNNING']) } })
    const redFlush = await this.voucherRepo.count({ where: { tenantId: user.tenantId, period: dto.period, sourceType: 'REVERSE', status: 'POSTED', isDeleted: 0 } })
    const occupations = await this.occupationRepo.count({ where: { tenantId: user.tenantId, period: dto.period, released: 0 } })
    const closedAt = periodEntity.closedAt ? periodEntity.closedAt.getTime() : 0
    const postedAfterClose = closedAt > 0
      ? await this.voucherRepo.count({ where: { tenantId: user.tenantId, period: dto.period, status: 'POSTED', isDeleted: 0 } })
      : 0
    const check = canReopenPeriod({
      periodStatus: periodEntity.status,
      hasPendingCostJob: pendingJobs > 0,
      hasUnreversedRedFlush: redFlush > 0,
      hasOccupiedBudget: occupations > 0,
      hasPostedVoucherAfterClose: postedAfterClose > 0
    })
    if (!check.ok) throw new BadRequestException(check.reason ?? '该期间不可反结账')
    periodEntity.status = 'OPEN'
    periodEntity.checkStatus = 'OPEN'
    periodEntity.reopenCount = periodEntity.reopenCount + 1
    periodEntity.reopenedBy = user.userId
    periodEntity.reopenedAt = new Date()
    const saved = await this.periodRepo.save(periodEntity)
    await this.auditService.record({ bizType: 'fin_period', bizId: saved.id, action: 'REOPEN_PERIOD', afterValue: { period: dto.period, reason: dto.reason ?? null } }, user)
    return saved
  }

  /* ==================== 预算编制控制占用 ==================== */

  /** 预算占用：按控制规则判定并落库占用明细 */
  async occupyBudget(dto: OccupyBudgetDto, user: JwtUser): Promise<Record<string, unknown>> {
    const budgets = await this.budgetRepo.find({ where: { tenantId: user.tenantId, period: dto.period } })
    const allocation = allocateBudgetOccupation(
      budgets.map((item) => ({
        id: item.id,
        period: item.period,
        deptId: item.deptId,
        subjectId: item.subjectId,
        budgetAmount: this.num(item.budgetAmount),
        usedAmount: this.num(item.usedAmount),
        occupiedAmount: this.num(item.occupiedAmount),
        controlRule: (item.controlRule as 'WARN' | 'STRICT') ?? 'WARN'
      })),
      {
        period: dto.period,
        deptId: dto.deptId ?? null,
        subjectId: dto.subjectId ?? null,
        amount: this.num(dto.amount),
        bizType: dto.bizType ?? null,
        bizId: dto.bizId ?? null
      }
    )
    if (allocation.level === 'REJECT') throw new BadRequestException('预算占用被拒绝：超出可用预算')
    if (allocation.allocations.length === 0) {
      throw new BadRequestException('未找到匹配的预算，无法占用')
    }
    const target = allocation.allocations[0]
    const entity = await this.occupationRepo.save(this.occupationRepo.create({
      tenantId: user.tenantId,
      budgetId: target.budgetId,
      period: dto.period,
      deptId: dto.deptId ?? null,
      subjectId: dto.subjectId ?? null,
      amount: this.money(target.amount),
      bizType: dto.bizType ?? null,
      bizId: dto.bizId ?? null,
      released: 0,
      createdBy: user.userId
    }))
    const budget = await this.budgetRepo.findOne({ where: { id: target.budgetId, tenantId: user.tenantId } })
    if (budget) {
      budget.occupiedAmount = this.money(this.num(budget.occupiedAmount) + target.amount)
      await this.budgetRepo.save(budget)
    }
    await this.auditService.record({ bizType: 'fin_budget_occupation', bizId: entity.id, action: 'OCCUPY_BUDGET', afterValue: { amount: target.amount, level: target.level } }, user)
    return { occupation: entity, level: allocation.level, reason: target.reason }
  }

  /** 释放预算占用 */
  async releaseBudget(dto: ReleaseBudgetDto, user: JwtUser): Promise<FinBudgetOccupationEntity> {
    const entity = await this.occupationRepo.findOne({ where: { id: dto.occupationId, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('预算占用记录不存在')
    if (entity.released === 1) throw new BadRequestException('该占用记录已释放')
    entity.released = 1
    const saved = await this.occupationRepo.save(entity)
    const budget = await this.budgetRepo.findOne({ where: { id: entity.budgetId, tenantId: user.tenantId } })
    if (budget) {
      budget.occupiedAmount = this.money(Math.max(0, this.num(budget.occupiedAmount) - this.num(entity.amount)))
      await this.budgetRepo.save(budget)
    }
    await this.auditService.record({ bizType: 'fin_budget_occupation', bizId: entity.id, action: 'RELEASE_BUDGET', afterValue: { amount: entity.amount } }, user)
    return saved
  }

  async listBudgetOccupations(query: QueryFinExtensionDto, user: JwtUser): Promise<PageResult<FinBudgetOccupationEntity>> {
    const where = scopeWhere<FinBudgetOccupationEntity>({ tenantId: user.tenantId, ...(query.period ? { period: query.period } : {}) }, user)
    const [list, total] = await this.occupationRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /* ==================== 财务仪表盘指标下钻 ==================== */

  /** 仪表盘指标：每个指标附带下钻键与健康度 */
  async dashboard(user: JwtUser): Promise<Record<string, unknown>> {
    const period = new Date().toISOString().slice(0, 7)
    const receivables = await this.arRepo.find({ where: { tenantId: user.tenantId, status: In(['OPEN', 'PARTIAL']) } })
    const payables = await this.apRepo.find({ where: { tenantId: user.tenantId, status: In(['OPEN', 'PARTIAL']) } })
    const accounts = await this.accountRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const vouchers = await this.voucherRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const drafts = vouchers.filter((item) => item.status === 'DRAFT').length
    const metrics = buildDashboardMetrics([
      { key: 'receivableAmount', label: '应收余额', value: receivables.reduce((sum, item) => sum + this.num(item.amount) - this.num(item.receivedAmount), 0), unit: '元', drillKey: 'receivable' },
      { key: 'payableAmount', label: '应付余额', value: payables.reduce((sum, item) => sum + this.num(item.amount) - this.num(item.paidAmount), 0), unit: '元', drillKey: 'payable' },
      { key: 'fundBalance', label: '资金余额', value: accounts.reduce((sum, item) => sum + this.num(item.balance), 0), unit: '元', drillKey: 'fund-account' },
      { key: 'voucherCount', label: '凭证总数', value: vouchers.length, unit: '张', drillKey: 'voucher' },
      { key: 'draftVoucherCount', label: '待过账凭证', value: drafts, unit: '张', target: 0, drillKey: 'voucher-draft' }
    ])
    return { period, metrics }
  }

  /* ==================== 内部工具 ==================== */

  private subjectSnapshots(subjects: AccountSubjectEntity[]): SubjectSnapshot[] {
    return subjects.map((item) => ({
      id: item.id,
      subjectCode: item.subjectCode,
      subjectName: item.subjectName,
      category: item.category,
      auxType: item.auxType,
      isLeaf: item.isLeaf,
      status: item.status
    }))
  }

  private policySnapshot(policy: FinExpensePolicyEntity): ExpensePolicySnapshot {
    return {
      policyCode: policy.policyCode,
      policyName: policy.policyName,
      category: policy.category,
      maxAmount: policy.maxAmount ? this.num(policy.maxAmount) : null,
      requireInvoice: policy.requireInvoice === 1,
      requireApproval: policy.requireApproval === 1,
      keywords: policy.keywords ?? undefined
    }
  }

  /** 按类别或关键词匹配费用政策 */
  private async matchPolicy(text: string, user: JwtUser): Promise<FinExpensePolicyEntity | null> {
    const policies = await this.policyRepo.find({ where: { tenantId: user.tenantId, status: 'ENABLED' } })
    if (policies.length === 0) return null
    const lower = (text ?? '').toLowerCase()
    return policies.find((policy) => policy.keywords?.some((keyword) => keyword && lower.includes(keyword.toLowerCase())))
      ?? policies.find((policy) => policy.category && lower.includes(policy.category.toLowerCase()))
      ?? null
  }

  /** 三大报表指标项：收入、费用、利润、资产、负债、权益与现金流 */
  private async statementItems(period: string, user: JwtUser): Promise<StatementItem[]> {
    const vouchers = await this.voucherRepo.find({ where: { tenantId: user.tenantId, status: 'POSTED', period, isDeleted: 0 } })
    const voucherIds = vouchers.map((item) => item.id)
    const entries = voucherIds.length > 0
      ? await this.entryRepo.find({ where: { tenantId: user.tenantId, voucherId: In(voucherIds) } })
      : []
    const subjects = await this.subjectRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const subjectMap = new Map(subjects.map((item) => [item.id, item]))
    let income = 0
    let expense = 0
    let assets = 0
    let liabilities = 0
    let equity = 0
    for (const entry of entries) {
      const subject = subjectMap.get(entry.subjectId)
      const debit = this.num(entry.debit)
      const credit = this.num(entry.credit)
      if (subject?.category === 'INCOME') income += credit - debit
      if (subject?.category === 'EXPENSE') expense += debit - credit
      if (subject?.category === 'ASSET') assets += debit - credit
      if (subject?.category === 'LIABILITY') liabilities += credit - debit
      if (subject?.category === 'EQUITY') equity += credit - debit
    }
    const receipts = await this.receiptRepo.find({ where: { tenantId: user.tenantId } })
    const payments = await this.paymentRepo.find({ where: { tenantId: user.tenantId } })
    const inflow = receipts.filter((item) => item.receivedAt.startsWith(period)).reduce((sum, item) => sum + this.num(item.amount), 0)
    const outflow = payments.filter((item) => item.paidAt.startsWith(period)).reduce((sum, item) => sum + this.num(item.amount), 0)
    return [
      { key: 'income', label: '营业收入', current: income },
      { key: 'expense', label: '营业成本费用', current: expense },
      { key: 'profit', label: '利润总额', current: income - expense },
      { key: 'assets', label: '资产总额', current: assets },
      { key: 'liabilities', label: '负债总额', current: liabilities },
      { key: 'equity', label: '所有者权益', current: equity },
      { key: 'cashInflow', label: '现金流入', current: inflow },
      { key: 'cashOutflow', label: '现金流出', current: outflow }
    ]
  }

  private previousPeriod(period: string): string {
    const [year, month] = period.split('-').map((item) => Number(item))
    if (!year || !month) return period
    const date = new Date(Date.UTC(year, month - 2, 1))
    return date.toISOString().slice(0, 7)
  }

  private number(prefix: string): string {
    return `${prefix}${`${Date.now().toString(36)}${randomBytes(2).toString('hex')}`.toUpperCase()}`
  }

  private num(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  private money(value: number): string {
    return value.toFixed(4)
  }

  /** 当前月份 YYYY-MM */
  private currentMonth(): string {
    return new Date().toISOString().slice(0, 7)
  }

  /** 月份偏移：delta 为正向后、为负向前 */
  private monthShift(month: string, delta: number): string {
    const matched = /^(\d{4})-(\d{1,2})$/.exec(String(month ?? '').trim())
    const year = matched ? Number(matched[1]) : new Date().getUTCFullYear()
    const mon = matched ? Number(matched[2]) : 1
    const index = mon - 1 + Math.trunc(delta)
    const targetYear = year + Math.floor(index / 12)
    const targetMonth = ((index % 12) + 12) % 12 + 1
    return `${targetYear}-${String(targetMonth).padStart(2, '0')}`
  }
}
