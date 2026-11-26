import { randomBytes } from 'node:crypto'
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, type MessageEvent } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { from, of, switchMap, type Observable } from 'rxjs'
import { In, Like, MoreThanOrEqual, type FindOptionsWhere, type Repository } from 'typeorm'
import { AI_CAPABILITY, buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { scopeWhere } from '../../common/data-scope-context'
import {
  applyOcrCorrections, buildAttributionDrill, buildReportExport,
  parseDocumentFile, selectGrayModel
} from '../../common/ai-extension-engine'
import {
  buildModelProbeRequest,
  buildReplenishmentSuggestion,
  checkSuggestionState,
  evaluateForecastAccuracy,
  evaluateModelEndpoint
} from '../../common/ai-forecast-engine'
import { AuditService } from '../audit/audit.service'
import { ConfigService } from '../config/config.service'
import { AccountSubjectEntity, ReceivableEntity, VoucherEntity } from '../finance/entities/finance.entities'
import { PurchaseService } from '../purchase/purchase.service'
import { SaleOrderLineEntity } from '../sales/entities/sales.entities'
import { ShopSyncLogEntity } from '../shop/entities/shop.entities'
import { StockBalanceEntity } from '../inventory/entities/inventory.entities'
import {
  AiAnomalyDto,
  AiCsDto,
  AiDocParseDto,
  AiFileParseDto,
  AiForecastDto,
  AiGrayModelDto,
  AiReportDrillDto,
  AiReportExportDto,
  AiRerecognizeDto,
  AiLabelDto,
  AiOcrDto,
  AiReconcileDto,
  AiRecommendDto,
  AiReportInsightDto,
  AiResumeDto,
  AiRagFeedbackDto,
  AiRagQueryDto,
  AiRagUpsertDto,
  AiSubjectMatchDto,
  ConfirmAiDto,
  ConfirmForecastSuggestionDto,
  CopilotDto,
  CreateAiModelConfigDto,
  CreateAiPromptDto,
  QueryAiPromptDto,
  QueryAiTaskDto,
  QueryForecastSuggestionDto,
  TestModelEndpointDto,
  UpdateAiConfigDto,
  UpdateAiModelConfigDto,
  UpdateAiPromptDto
} from './dto'
import {
  AiForecastSuggestionEntity,
  AiKnowledgeChunkEntity,
  AiKnowledgeDocEntity,
  AiModelConfigEntity,
  AiTaskEntity
} from './entities/ai-extension.entities'
import { AiAuditLogEntity } from './entities/ai-audit-log.entity'
import { AiConversationEntity } from './entities/ai-conversation.entity'
import { AiMessageEntity } from './entities/ai-message.entity'
import { AiPromptEntity } from './entities/ai-prompt.entity'
import { AiAnomalyEntity } from './entities/ai-anomaly.entity'
import { AiDraftApplierRegistry } from './ai-draft-applier'
import { checkApplyPermission, checkConfirmState, checkDraftCompleteness, extractDraft } from './ai-draft-apply'

/** AI 运行时配置存储键（租户级 sys_config） */
export const AI_CONFIG_KEY = 'ai.runtime.config'

export interface AiRuntimeConfig {
  enabled: boolean
  defaultModelId: number | null
  temperature: number
  maxTokens: number
  timeoutMs: number
  sseEnabled: boolean
  confirmWriteRequired: boolean
}

const DEFAULT_AI_CONFIG: AiRuntimeConfig = {
  enabled: true,
  defaultModelId: null,
  temperature: 0.2,
  maxTokens: 2048,
  timeoutMs: 60000,
  sseEnabled: true,
  confirmWriteRequired: true
}

export interface CopilotResult {
  auditId: number
  suggestion: string
  conversationId?: number
}

export interface AiExecutionResult<T> {
  taskId: number
  taskNo: string
  auditId: number
  capability: string
  confidence: string
  evidence: Record<string, unknown>[]
  result: T
}

interface OcrField {
  key: string
  label: string
  value: string | null
  confidence: number
}

interface ForecastPoint {
  period: string
  qty: number
}

@Injectable()
export class AiService {
  constructor(
    @InjectRepository(AiPromptEntity) private readonly promptRepo: Repository<AiPromptEntity>,
    @InjectRepository(AiAuditLogEntity) private readonly auditLogRepo: Repository<AiAuditLogEntity>,
    @InjectRepository(AiConversationEntity) private readonly conversationRepo: Repository<AiConversationEntity>,
    @InjectRepository(AiMessageEntity) private readonly messageRepo: Repository<AiMessageEntity>,
    @InjectRepository(AiTaskEntity) private readonly taskRepo: Repository<AiTaskEntity>,
    @InjectRepository(AiAnomalyEntity) private readonly anomalyRepo: Repository<AiAnomalyEntity>,
    @InjectRepository(AiModelConfigEntity) private readonly modelRepo: Repository<AiModelConfigEntity>,
    @InjectRepository(AiKnowledgeDocEntity) private readonly docRepo: Repository<AiKnowledgeDocEntity>,
    @InjectRepository(AiKnowledgeChunkEntity) private readonly chunkRepo: Repository<AiKnowledgeChunkEntity>,
    @InjectRepository(AiForecastSuggestionEntity) private readonly suggestionRepo: Repository<AiForecastSuggestionEntity>,
    @InjectRepository(SaleOrderLineEntity) private readonly saleLineRepo: Repository<SaleOrderLineEntity>,
    @InjectRepository(StockBalanceEntity) private readonly stockRepo: Repository<StockBalanceEntity>,
    @InjectRepository(ReceivableEntity) private readonly receivableRepo: Repository<ReceivableEntity>,
    @InjectRepository(VoucherEntity) private readonly voucherRepo: Repository<VoucherEntity>,
    @InjectRepository(ShopSyncLogEntity) private readonly syncLogRepo: Repository<ShopSyncLogEntity>,
    @InjectRepository(AccountSubjectEntity) private readonly subjectRepo: Repository<AccountSubjectEntity>,
    private readonly auditService: AuditService,
    private readonly draftRegistry: AiDraftApplierRegistry,
    private readonly purchaseService: PurchaseService,
    private readonly configService: ConfigService
  ) {}

  /** 读取租户级 AI 运行时配置，未配置时返回系统默认值 */
  async getConfig(user: JwtUser): Promise<AiRuntimeConfig> {
    const raw = await this.configService.getRaw(user.tenantId, AI_CONFIG_KEY)
    if (!raw) return { ...DEFAULT_AI_CONFIG }
    try {
      const parsed = JSON.parse(raw) as Partial<AiRuntimeConfig>
      return { ...DEFAULT_AI_CONFIG, ...parsed }
    } catch {
      return { ...DEFAULT_AI_CONFIG }
    }
  }

  /** 更新租户级 AI 运行时配置，配置立即生效并留审计 */
  async updateConfig(dto: UpdateAiConfigDto, user: JwtUser): Promise<AiRuntimeConfig> {
    const current = await this.getConfig(user)
    const patch = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined)
    ) as Partial<AiRuntimeConfig>
    const next: AiRuntimeConfig = { ...current, ...patch }
    await this.configService.upsert(user.tenantId, {
      configKey: AI_CONFIG_KEY,
      configValue: JSON.stringify(next),
      valueType: 'JSON',
      category: 'AI',
      isSystem: true,
      remark: 'AI 运行时配置（开关、默认模型、生成参数）'
    }, user.userId)
    await this.auditService.record({
      bizType: 'ai_config',
      bizId: user.tenantId,
      action: 'UPDATE_AI_CONFIG',
      beforeValue: current,
      afterValue: next
    }, user)
    return next
  }

  async listPrompts(query: QueryAiPromptDto, user: JwtUser): Promise<PageResult<AiPromptEntity>> {
    const where = {
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.keyword ? { name: Like(`%${query.keyword}%`) } : {})
    }
    const [list, total] = await this.promptRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async createPrompt(dto: CreateAiPromptDto, user: JwtUser): Promise<AiPromptEntity> {
    const siblings = await this.promptRepo.find({
      where: { tenantId: user.tenantId, code: dto.code, isDeleted: 0 },
      order: { version: 'DESC' }
    })
    const latest = siblings[0]
    const entity = this.promptRepo.create({
      ...dto,
      tenantId: user.tenantId,
      model: dto.model ?? 'local-rule-engine',
      temperature: (dto.temperature ?? 0.2).toFixed(2),
      version: latest ? latest.version + 1 : 1,
      status: latest ? 'DRAFT' : 'PUBLISHED',
      parentId: latest?.id ?? null,
      publishedAt: latest ? null : new Date(),
      isActive: latest ? 0 : 1,
      createdBy: user.userId
    })
    const saved = await this.promptRepo.save(entity)
    await this.auditService.record({ bizType: 'ai_prompt', bizId: saved.id, action: 'CREATE_PROMPT', afterValue: saved }, user)
    return saved
  }

  /** 某个 Prompt 编码的全部版本（按版本号倒序） */
  async listPromptVersions(code: string, user: JwtUser): Promise<AiPromptEntity[]> {
    return this.promptRepo.find({
      where: { tenantId: user.tenantId, code, isDeleted: 0 },
      order: { version: 'DESC' }
    })
  }

  /**
   * 发布指定版本：同编码下仅该版本生效，其余版本归档。
   * 灰度：isActive=0 的版本不参与调用，可通过再次发布完成灰度切换。
   */
  async publishPrompt(id: number, user: JwtUser): Promise<AiPromptEntity> {
    const entity = await this.findPrompt(id, user)
    const before = { ...entity }
    await this.promptRepo.update(
      { tenantId: user.tenantId, code: entity.code, isDeleted: 0 },
      { isActive: 0, status: 'ARCHIVED' }
    )
    entity.isActive = 1
    entity.status = 'PUBLISHED'
    entity.publishedAt = new Date()
    const saved = await this.promptRepo.save(entity)
    await this.auditService.record({
      bizType: 'ai_prompt',
      bizId: saved.id,
      action: 'PUBLISH_PROMPT',
      beforeValue: before,
      afterValue: saved
    }, user)
    return saved
  }

  /** 回滚到历史版本：等同发布该版本 */
  async rollbackPrompt(id: number, user: JwtUser): Promise<AiPromptEntity> {
    const entity = await this.findPrompt(id, user)
    const before = { ...entity }
    await this.promptRepo.update(
      { tenantId: user.tenantId, code: entity.code, isDeleted: 0 },
      { isActive: 0, status: 'ARCHIVED' }
    )
    entity.isActive = 1
    entity.status = 'PUBLISHED'
    entity.publishedAt = new Date()
    const saved = await this.promptRepo.save(entity)
    await this.auditService.record({
      bizType: 'ai_prompt',
      bizId: saved.id,
      action: 'ROLLBACK_PROMPT',
      beforeValue: before,
      afterValue: saved
    }, user)
    return saved
  }

  async updatePrompt(id: number, dto: UpdateAiPromptDto, user: JwtUser): Promise<AiPromptEntity> {
    const entity = await this.findPrompt(id, user)
    const before = { ...entity }
    if (dto.isActive !== undefined) {
      entity.isActive = dto.isActive === 'YES' ? 1 : 0
    }
    if (dto.temperature !== undefined) {
      entity.temperature = dto.temperature.toFixed(2)
    }
    const { isActive: _isActive, temperature: _temperature, ...rest } = dto
    void _isActive
    void _temperature
    Object.assign(entity, rest)
    entity.version += 1
    entity.updatedAt = new Date()
    const saved = await this.promptRepo.save(entity)
    await this.auditService.record({ bizType: 'ai_prompt', bizId: id, action: 'UPDATE_PROMPT', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  async removePrompt(id: number, user: JwtUser): Promise<void> {
    const entity = await this.findPrompt(id, user)
    entity.isDeleted = 1
    await this.promptRepo.save(entity)
    await this.auditService.record({ bizType: 'ai_prompt', bizId: id, action: 'DELETE_PROMPT', beforeValue: entity }, user)
  }

  async copilot(dto: CopilotDto, user: JwtUser): Promise<CopilotResult> {
    const started = Date.now()
    if (dto.conversationId) {
      const conversation = await this.conversationRepo.findOne({
        where: { id: dto.conversationId, tenantId: user.tenantId, userId: user.userId, status: 'ACTIVE' }
      })
      if (!conversation) {
        throw new NotFoundException('AI 会话不存在')
      }
      await this.messageRepo.save(
        this.messageRepo.create({
          tenantId: user.tenantId,
          conversationId: conversation.id,
          role: 'USER',
          content: dto.prompt,
          toolCalls: null
        })
      )
    }

    const suggestion = this.buildSuggestion(dto.prompt)
    const audit = await this.recordAudit(AI_CAPABILITY.COPILOT, dto.prompt, suggestion, user, started)

    if (dto.conversationId) {
      await this.messageRepo.save(
        this.messageRepo.create({
          tenantId: user.tenantId,
          conversationId: dto.conversationId,
          role: 'ASSISTANT',
          content: suggestion,
          toolCalls: [{ auditId: audit.id, confirmed: false }]
        })
      )
    }

    return { auditId: audit.id, suggestion, conversationId: dto.conversationId }
  }

  stream(dto: CopilotDto, user: JwtUser): Observable<MessageEvent> {
    return from(this.copilot(dto, user)).pipe(
      switchMap((result) =>
        of(
          { data: { delta: '正在分析你的问题……' } },
          { data: { delta: result.suggestion } },
          { data: { done: true, auditId: result.auditId } }
        )
      )
    )
  }

  async confirm(auditId: number, dto: ConfirmAiDto, user: JwtUser): Promise<AiAuditLogEntity> {
    const audit = await this.auditLogRepo.findOne({ where: { id: auditId, tenantId: user.tenantId } })
    if (!audit) {
      throw new NotFoundException('AI 建议不存在')
    }
    if (audit.userId !== user.userId) {
      throw new ForbiddenException('只能确认本人生成的建议')
    }
    const state = checkConfirmState(audit.accepted, audit.appliedBizId ?? null)
    if (!state.ok) throw new BadRequestException(state.reason ?? '状态不允许确认')

    // 拒绝：仅记录态度，不写回
    if (dto.accepted === 'NO') {
      audit.accepted = 'NO'
      const saved = await this.auditLogRepo.save(audit)
      await this.auditService.record(
        { bizType: 'ai_audit', bizId: saved.id, action: 'REJECT_AI', afterValue: { accepted: 'NO' } },
        user
      )
      return saved
    }

    // 采纳：解析草稿与目标类型，查找注册的写回处理器
    const parsed = this.parseAuditResponse(audit.response)
    const draft = extractDraft(audit.response)
    const targetType = String(parsed.targetType ?? '')
    const applier = targetType ? this.draftRegistry.get(targetType) : undefined
    if (!applier) {
      throw new BadRequestException(`目标类型 ${targetType || '未知'} 未接入草稿写回，无法确认采纳`)
    }
    const perm = checkApplyPermission(applier, user)
    if (!perm.ok) throw new ForbiddenException(perm.reason ?? '无写回权限')
    const complete = checkDraftCompleteness(draft, applier.targetType === 'SALE_ORDER'
      ? ['customerName', 'lines']
      : [])
    if (!complete.ok) throw new BadRequestException(complete.reason ?? '草稿信息不完整')

    try {
      const result = await applier.apply({ draft, user, auditId })
      audit.accepted = 'YES'
      audit.appliedBizType = result.bizType
      audit.appliedBizId = result.bizId
      audit.appliedAt = new Date()
      audit.applyError = null
      const saved = await this.auditLogRepo.save(audit)
      await this.auditService.record(
        { bizType: 'ai_audit', bizId: saved.id, action: 'APPLY_AI_DRAFT', afterValue: { accepted: 'YES', ...result } },
        user
      )
      return saved
    } catch (cause) {
      audit.applyError = String(cause instanceof Error ? cause.message : cause).slice(0, 1000)
      await this.auditLogRepo.save(audit)
      throw new BadRequestException(`草稿写回失败：${audit.applyError}`)
    }
  }

  /** 安全解析审计响应中的目标类型 */
  private parseAuditResponse(response: string | null | undefined): Record<string, unknown> {
    if (!response) return {}
    try {
      const parsed = JSON.parse(response)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }

  async listTasks(query: QueryAiTaskDto, user: JwtUser): Promise<PageResult<AiTaskEntity>> {
    const where: FindOptionsWhere<AiTaskEntity> = { tenantId: user.tenantId }
    if (query.capability) where.capability = query.capability
    if (query.status) where.status = query.status
    const [list, total] = await this.taskRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async ocr(dto: AiOcrDto, user: JwtUser): Promise<AiExecutionResult<Record<string, unknown>>> {
    const started = Date.now()
    const text = dto.text ?? ''
    const docType = dto.docType ?? (text.includes('发票') ? 'INVOICE' : text.includes('营业执照') ? 'LICENSE' : 'DOCUMENT')
    const fields: OcrField[] = [
      { key: 'invoiceNo', label: '单据号码', value: this.extract(/发票号(?:码)?[:：\s]*([A-Za-z0-9-]{6,})/i, text), confidence: 0.94 },
      { key: 'invoiceDate', label: '开票日期', value: this.extract(/(?:开票日期|日期)[:：\s]*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})/, text), confidence: 0.92 },
      { key: 'amount', label: '价税合计', value: this.extract(/(?:价税合计|合计金额|金额)[:：\s]*([￥¥]?\d+(?:\.\d{1,2})?)/, text), confidence: 0.9 },
      { key: 'taxNo', label: '税号', value: this.extract(/纳税人识别号[:：\s]*([A-Za-z0-9]{15,20})/i, text), confidence: 0.88 },
      { key: 'seller', label: '销方名称', value: this.extract(/销(?:售|货)方(?:名称)?[:：\s]*([^\n，,；;]+)/, text), confidence: 0.82 },
      { key: 'buyer', label: '购方名称', value: this.extract(/购(?:买|货)方(?:名称)?[:：\s]*([^\n，,；;]+)/, text), confidence: 0.82 }
    ]
    for (const field of fields) {
      if (!field.value) field.confidence = 0
    }
    const matched = fields.filter((field) => field.value)
    const confidence = matched.length ? matched.reduce((sum, field) => sum + field.confidence, 0) / matched.length : 0.1
    const evidence = [
      {
        source: 'local-rule-engine',
        docType,
        fileName: dto.fileName ?? null,
        fileUrl: dto.fileUrl ?? null,
        textLength: text.length,
        matchedFields: matched.map((field) => field.key)
      }
    ]
    const result = {
      docType,
      fields,
      needsReview: fields.filter((field) => !field.value || field.confidence < 0.85).map((field) => field.key),
      originalFile: dto.fileUrl ?? dto.fileName ?? null,
      note: '无外部 OCR 服务时使用规则引擎兜底；低置信字段必须人工复核。'
    }
    return this.persistTask(AI_CAPABILITY.OCR, dto.text ?? { fileName: dto.fileName, fileUrl: dto.fileUrl }, result, evidence, confidence, user, started)
  }

  async docParse(dto: AiDocParseDto, user: JwtUser): Promise<AiExecutionResult<Record<string, unknown>>> {
    const started = Date.now()
    const lines = dto.lines?.length ? dto.lines : this.parseDocumentLines(dto.text)
    const header = {
      customerName: this.extract(/客户(?:名称)?[:：\s]*([^\n，,；;]+)/, dto.text),
      orderDate: this.extract(/(?:订单日期|日期)[:：\s]*(\d{4}-\d{1,2}-\d{1,2})/, dto.text),
      warehouse: this.extract(/仓库[:：\s]*([^\n，,；;]+)/, dto.text),
      remark: this.extract(/备注[:：\s]*([^\n]+)/, dto.text)
    }
    const filled = Object.values(header).filter((value) => Boolean(value)).length
    const confidence = Math.min(0.96, 0.45 + filled * 0.1 + Math.min(lines.length, 5) * 0.04)
    const targetType = dto.targetType ?? 'SALE_ORDER'
    const result = {
      targetType,
      header,
      lines,
      draft: { ...header, lines, sourceType: 'AI_DRAFT' },
      warnings: [
        ...(header.customerName ? [] : ['客户名称未识别，请人工补充']),
        ...(lines.length ? [] : ['未识别到明细行，请人工录入'])
      ]
    }
    const evidence = [
      { source: 'local-rule-engine', fileName: dto.fileName ?? null, fileUrl: dto.fileUrl ?? null, textLength: dto.text.length, lineCount: lines.length }
    ]
    return this.persistTask(AI_CAPABILITY.DOC_PARSE, { text: dto.text, fileName: dto.fileName, fileUrl: dto.fileUrl }, result, evidence, confidence, user, started)
  }

  /** 文件解析：PDF/图片使用已提取文本，CSV/Excel 按表格文本解析为明细 */
  async parseFile(dto: AiFileParseDto, user: JwtUser): Promise<AiExecutionResult<Record<string, unknown>>> {
    const parsed = parseDocumentFile(dto.fileName, dto.mimeType, dto.text)
    const execution = await this.docParse({
      text: dto.text,
      fileName: dto.fileName,
      targetType: dto.targetType,
      lines: parsed.lines
    }, user)
    return {
      ...execution,
      result: { ...execution.result, format: parsed.format, parseWarnings: parsed.warnings }
    }
  }

  /** OCR 重识别：以人工修正字段覆盖原识别结果并提升置信度 */
  async rerecognize(dto: AiRerecognizeDto, user: JwtUser): Promise<AiExecutionResult<Record<string, unknown>>> {
    const task = await this.taskRepo.findOne({ where: { id: dto.taskId, tenantId: user.tenantId } })
    if (!task) throw new NotFoundException('AI 任务不存在')
    const original = (task.resultJson ?? {}) as {
      docType?: string
      fields?: Array<{ key: string; value?: string | null; confidence?: number }>
      [key: string]: unknown
    }
    if (!original.fields?.length) throw new BadRequestException('该任务没有可重识别的 OCR 字段')
    const started = Date.now()
    const corrected = applyOcrCorrections(original.fields, dto.corrections)
    const result = {
      ...original,
      fields: corrected.fields,
      needsReview: corrected.fields.filter((field) => !field.value || (field.confidence ?? 0) < 0.85).map((field) => field.key),
      rerecognizedFrom: dto.taskId,
      correctedFields: corrected.corrected
    }
    return this.persistTask(AI_CAPABILITY.OCR, { taskId: dto.taskId, corrections: dto.corrections }, result, [
      { source: 'human-correction', taskId: dto.taskId, corrected: corrected.corrected }
    ], corrected.confidence, user, started)
  }

  /** 运行时模型选择：按能力灰度分流，稳定哈希保证同一用户命中同一模型 */
  async selectGrayModel(dto: AiGrayModelDto, user: JwtUser): Promise<Record<string, unknown>> {
    const configs = await this.modelRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const selected = selectGrayModel(configs.map((config) => ({
      code: config.code,
      capability: config.capability ?? 'ALL',
      grayPercent: config.grayPercent ?? 0,
      status: config.status,
      isDefault: config.isDefault
    })), dto.capability, dto.seed ?? String(user.userId))
    return { capability: dto.capability, model: selected }
  }

  /** 报表导出：保留诊断、引用与指标快照的 CSV */
  async exportReport(dto: AiReportExportDto, user: JwtUser): Promise<{ filename: string; content: string }> {
    const content = buildReportExport(dto.diagnoses ?? [], dto.citations ?? [], dto.metrics as Record<string, number>)
    await this.recordAudit(AI_CAPABILITY.REPORT, JSON.stringify(dto), JSON.stringify({ exported: true }), user, Date.now())
    return { filename: `ai-report-${Date.now()}.csv`, content }
  }

  /** 报表归因下钻：对收入、成本与逾期风险按维度拆解 */
  reportDrill(dto: AiReportDrillDto, _user: JwtUser): Array<Record<string, unknown>> {
    return buildAttributionDrill(dto.metrics as Record<string, number>, dto.dimension)
  }

  async forecast(dto: AiForecastDto, user: JwtUser): Promise<AiExecutionResult<Record<string, unknown>>> {
    const started = Date.now()
    const periods = dto.periods ?? 3
    let history = (dto.history ?? []).map((item) => ({
      period: String(item.period ?? item.date ?? ''),
      qty: this.num(item.qty ?? item.quantity ?? item.value ?? item.amount)
    })).filter((item) => item.period && item.qty > 0)

    if (history.length === 0) {
      history = await this.loadSalesHistory(user, dto.productId)
    }

    const recent = history.slice(-periods)
    const avg = recent.length ? recent.reduce((sum, item) => sum + item.qty, 0) / recent.length : 0
    const previous = recent.length > 1 ? recent[recent.length - 2]?.qty ?? avg : avg
    const trendRate = previous > 0 ? (avg - previous) / previous : 0
    const forecast: ForecastPoint[] = []
    for (let i = 1; i <= periods; i += 1) {
      forecast.push({
        period: this.nextPeriod(recent.at(-1)?.period ?? this.currentPeriod(), i),
        qty: Math.max(0, Math.round(avg * (1 + trendRate * i * 0.5)))
      })
    }
    const availableQty = dto.availableQty ?? 0
    const suggestion = buildReplenishmentSuggestion({
      avgQty: avg,
      trendRate,
      availableQty,
      safetyStock: dto.safetyStock ?? 0,
      leadTimeDays: dto.leadTimeDays ?? 30,
      minOrderQty: dto.minOrderQty ?? 0,
      lotSize: dto.lotSize ?? 0,
      historyCount: history.length
    })
    const accuracy = this.backtestAccuracy(history)
    const mape = accuracy.mape
    const evidence = [
      { source: history.length ? 'business-data' : 'empty', records: history.length, model: 'MOVING_AVERAGE', productId: dto.productId ?? null }
    ]
    const suggestionEntity = await this.suggestionRepo.save(this.suggestionRepo.create({
      tenantId: user.tenantId,
      productId: dto.productId ?? 0,
      model: 'MOVING_AVERAGE',
      avgQty: avg.toFixed(3),
      trendRate: trendRate.toFixed(4),
      availableQty: availableQty.toFixed(3),
      suggestQty: suggestion.suggestQty.toFixed(3),
      confirmQty: '0.000',
      coverDays: suggestion.coverDays.toFixed(1),
      level: suggestion.level,
      confidence: suggestion.confidence.toFixed(4),
      mape: mape.toFixed(2),
      accuracy: accuracy.accuracy.toFixed(4),
      status: 'PENDING',
      reason: suggestion.reason,
      evidence: [...evidence, {
        source: 'replenishment-rule',
        demandQty: suggestion.demandQty,
        netQty: suggestion.netQty,
        coverDays: suggestion.coverDays,
        level: suggestion.level,
        confidence: suggestion.confidence
      }],
      createdBy: user.userId
    }))
    const result = {
      model: 'MOVING_AVERAGE',
      history,
      forecast,
      avgQty: Number(avg.toFixed(3)),
      trendRate: Number(trendRate.toFixed(4)),
      suggestedQty: suggestion.suggestQty,
      suggestionId: suggestionEntity.id,
      suggestionStatus: 'PENDING',
      suggestion: {
        suggestQty: suggestion.suggestQty,
        netQty: suggestion.netQty,
        demandQty: suggestion.demandQty,
        coverDays: suggestion.coverDays,
        level: suggestion.level,
        confidence: suggestion.confidence,
        reason: suggestion.reason
      },
      accuracy,
      mape,
      note: '补货建议已生成待确认记录，人工确认后写回采购需求。'
    }
    const execution = await this.persistTask(AI_CAPABILITY.FORECAST, dto.history ? { history: dto.history, periods } : { productId: dto.productId, periods }, result, evidence, history.length ? 0.86 : 0.3, user, started)
    await this.suggestionRepo.update({ id: suggestionEntity.id }, { taskId: execution.taskId })
    return execution
  }

  /** 补货建议列表（待确认 / 已确认 / 已拒绝） */
  async listForecastSuggestions(query: QueryForecastSuggestionDto, user: JwtUser): Promise<PageResult<AiForecastSuggestionEntity>> {
    const where = {
      tenantId: user.tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.productId ? { productId: query.productId } : {})
    }
    const [list, total] = await this.suggestionRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 人工确认/拒绝补货建议：确认后写回采购需求（幂等，状态机校验 + 权限二次校验） */
  async confirmForecastSuggestion(
    id: number,
    dto: ConfirmForecastSuggestionDto,
    user: JwtUser
  ): Promise<{ suggestion: AiForecastSuggestionEntity; demand?: { id: number; demandNo: string; qty: string } }> {
    const suggestion = await this.findForecastSuggestion(id, user)
    const state = checkSuggestionState(suggestion.status, suggestion.appliedBizId)
    if (!state.ok) throw new BadRequestException(state.reason ?? '当前状态不允许确认')

    if (dto.accepted === 'NO') {
      const reason = (dto.reason ?? '').trim()
      if (reason.length < 2) throw new BadRequestException('拒绝建议时必须填写原因')
      suggestion.status = 'REJECTED'
      suggestion.rejectReason = reason
      suggestion.confirmedBy = user.userId
      suggestion.confirmedAt = new Date()
      const saved = await this.suggestionRepo.save(suggestion)
      await this.auditService.record({ bizType: 'ai_forecast_suggestion', bizId: saved.id, action: 'REJECT', afterValue: saved }, user)
      return { suggestion: saved }
    }

    if (!this.hasPermission(user, 'purchase:demand:create')) {
      throw new ForbiddenException('缺少采购需求创建权限，无法确认写回')
    }
    if (!suggestion.productId) throw new BadRequestException('补货建议未关联产品，无法写回采购需求')
    const qty = dto.qty ?? Number(suggestion.suggestQty)
    if (!Number.isFinite(qty) || qty <= 0) throw new BadRequestException('确认补货量必须大于 0')

    const demand = await this.purchaseService.createDemand(
      { productId: suggestion.productId, qty: String(qty), sourceType: 'AI_FORECAST' },
      user
    )
    suggestion.status = 'CONFIRMED'
    suggestion.appliedBizType = 'purchase_demand'
    suggestion.appliedBizId = demand.id
    suggestion.confirmQty = qty.toFixed(3)
    suggestion.confirmedBy = user.userId
    suggestion.confirmedAt = new Date()
    const saved = await this.suggestionRepo.save(suggestion)
    await this.auditService.record({
      bizType: 'ai_forecast_suggestion',
      bizId: saved.id,
      action: 'CONFIRM',
      afterValue: { ...saved, demandNo: demand.demandNo }
    }, user)
    return { suggestion: saved, demand: { id: demand.id, demandNo: demand.demandNo, qty: demand.qty } }
  }

  /** 外部模型服务接入连通性测试：校验配置并发起真实探测请求 */
  async testModelEndpoint(
    dto: TestModelEndpointDto,
    user: JwtUser
  ): Promise<{ ok: boolean; reason?: string; status?: number; latencyMs?: number; url?: string }> {
    let endpoint = dto.endpoint
    let apiKey = dto.apiKey
    let model = dto.model
    if (dto.configId) {
      const config = await this.modelRepo.findOne({ where: { id: dto.configId, tenantId: user.tenantId } })
      if (!config) throw new NotFoundException('模型配置不存在')
      endpoint = endpoint ?? config.endpoint ?? undefined
      model = model ?? config.model
      if (!apiKey && config.apiKeyMask && !config.apiKeyMask.includes('*')) {
        apiKey = config.apiKeyMask
      }
    }
    const validation = evaluateModelEndpoint({ endpoint, apiKey, model, timeoutMs: dto.timeoutMs })
    if (!validation.ok) {
      await this.auditService.record({
        bizType: 'ai_model_config',
        bizId: dto.configId ?? 0,
        action: 'TEST_ENDPOINT',
        afterValue: { ok: false, reason: validation.reason, endpoint: endpoint ?? null }
      }, user)
      return { ok: false, reason: validation.reason }
    }
    const probe = buildModelProbeRequest({ endpoint, apiKey, model, timeoutMs: validation.timeoutMs })
    if (!probe) return { ok: false, reason: '外部模型服务配置不完整，无法发起探测' }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), validation.timeoutMs)
    const startedAt = Date.now()
    try {
      const response = await fetch(probe.url, {
        method: probe.method,
        headers: probe.headers,
        body: JSON.stringify(probe.body),
        signal: controller.signal
      })
      const latencyMs = Date.now() - startedAt
      const ok = response.status >= 200 && response.status < 300
      const reason = ok ? '外部模型服务连通正常' : `外部模型服务返回状态码 ${response.status}`
      await this.auditService.record({
        bizType: 'ai_model_config',
        bizId: dto.configId ?? 0,
        action: 'TEST_ENDPOINT',
        afterValue: { ok, status: response.status, latencyMs, endpoint: probe.url }
      }, user)
      return { ok, reason, status: response.status, latencyMs, url: probe.url }
    } catch (error) {
      const latencyMs = Date.now() - startedAt
      const reason = error instanceof Error && error.name === 'AbortError'
        ? `外部模型服务探测超时（${validation.timeoutMs}ms）`
        : `外部模型服务连接失败：${error instanceof Error ? error.message : '未知错误'}`
      await this.auditService.record({
        bizType: 'ai_model_config',
        bizId: dto.configId ?? 0,
        action: 'TEST_ENDPOINT',
        afterValue: { ok: false, reason, latencyMs, endpoint: probe.url }
      }, user)
      return { ok: false, reason, latencyMs, url: probe.url }
    } finally {
      clearTimeout(timer)
    }
  }

  private async findForecastSuggestion(id: number, user: JwtUser): Promise<AiForecastSuggestionEntity> {
    const suggestion = await this.suggestionRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!suggestion) throw new NotFoundException('补货建议不存在')
    return suggestion
  }

  private hasPermission(user: JwtUser, perm: string): boolean {
    if (user.isSuperAdmin) return true
    const list = user.permissions ?? []
    return list.includes('*:*') || list.includes(perm)
  }

  /** 历史回测：用移动平均在历史数据上做样本外预测，得到模型历史准确率 */
  private backtestAccuracy(history: ForecastPoint[]): { mape: number; accuracy: number; sampleSize: number; level: 'GOOD' | 'FAIR' | 'POOR' } {
    const actuals: number[] = []
    const predictions: number[] = []
    for (let i = 1; i < history.length; i += 1) {
      const window = history.slice(0, i)
      const predicted = window.reduce((sum, item) => sum + item.qty, 0) / window.length
      actuals.push(history[i].qty)
      predictions.push(predicted)
    }
    return evaluateForecastAccuracy(actuals, predictions)
  }

  async anomalyScan(dto: AiAnomalyDto, user: JwtUser): Promise<AiExecutionResult<Record<string, unknown>>> {
    const started = Date.now()
    const findings: Record<string, unknown>[] = []
    const today = new Date().toISOString().slice(0, 10)

    if (!dto.scope || dto.scope === 'INVENTORY' || dto.scope === 'ALL') {
      const balances = await this.stockRepo.find({ where: scopeWhere<StockBalanceEntity>({ tenantId: user.tenantId }, user), take: 500 })
      for (const balance of balances) {
        const available = this.num(balance.qtyOnHand) - this.num(balance.qtyOccupied) - this.num(balance.qtyFrozen)
        if (available < 0) {
          findings.push({
            type: 'NEGATIVE_AVAILABLE',
            severity: 'HIGH',
            target: `product:${balance.productId}`,
            message: `可用量为 ${available.toFixed(3)}，实物量小于占用与冻结合计`,
            evidence: { qtyOnHand: balance.qtyOnHand, qtyOccupied: balance.qtyOccupied, qtyFrozen: balance.qtyFrozen },
            suggestion: '核对锁定与冻结来源，禁止在此状态下继续发货。'
          })
        }
      }
    }

    if (!dto.scope || dto.scope === 'FINANCE' || dto.scope === 'ALL') {
      const receivables = await this.receivableRepo.find({ where: scopeWhere<ReceivableEntity>({ tenantId: user.tenantId, status: 'OPEN' }, user), take: 500 })
      for (const item of receivables) {
        const balance = this.num(item.amount) - this.num(item.receivedAmount)
        if (item.dueDate && item.dueDate < today && balance > 0) {
          findings.push({
            type: 'OVERDUE_RECEIVABLE',
            severity: balance > 10000 ? 'HIGH' : 'MEDIUM',
            target: `receivable:${item.id}`,
            message: `应收逾期 ${today} 之前到期，未收余额 ${balance.toFixed(2)}`,
            evidence: { sourceNo: item.sourceNo, dueDate: item.dueDate, amount: item.amount, receivedAmount: item.receivedAmount },
            suggestion: '生成催收任务并核对信用占用。'
          })
        }
      }
      const vouchers = await this.voucherRepo.find({ where: scopeWhere<VoucherEntity>({ tenantId: user.tenantId }, user, { ownerField: 'createdBy' }), take: 500 })
      for (const voucher of vouchers) {
        if (voucher.status === 'DRAFT') continue
        if (Math.abs(this.num(voucher.totalDebit) - this.num(voucher.totalCredit)) > 0.0001) {
          findings.push({
            type: 'UNBALANCED_VOUCHER',
            severity: 'HIGH',
            target: `voucher:${voucher.id}`,
            message: `凭证借贷不平：借 ${voucher.totalDebit} / 贷 ${voucher.totalCredit}`,
            evidence: { voucherNo: voucher.voucherNo, period: voucher.period, status: voucher.status },
            suggestion: '禁止过账，修正分录后重新校验。'
          })
        }
      }
    }

    if (!dto.scope || dto.scope === 'SHOP' || dto.scope === 'ALL') {
      const logs = await this.syncLogRepo.find({ where: { tenantId: user.tenantId }, take: 200, order: { id: 'DESC' } })
      for (const log of logs) {
        if (!/FAIL|ERROR|TIMEOUT/i.test(log.result)) continue
        findings.push({
          type: 'SHOP_SYNC_FAILED',
          severity: 'MEDIUM',
          target: `shop:${log.storeId}:${log.bizType}:${log.bizId}`,
          message: `商城同步失败：${log.errorText ?? log.result}`,
          evidence: { idempotentKey: log.idempotentKey, result: log.result, createdAt: log.createdAt },
          suggestion: '检查幂等键后重试同步，避免重复建单。'
        })
      }
    }

    const result = { findings, count: findings.length, scannedAt: new Date().toISOString(), scope: dto.scope ?? 'ALL' }
    const evidence = findings.slice(0, 20).map((item) => ({
      type: item.type,
      target: item.target,
      evidence: item.evidence
    }))
    const taskResult = await this.persistTask(AI_CAPABILITY.ANOMALY, { scope: dto.scope ?? 'ALL' }, result, evidence, findings.length ? 0.92 : 0.8, user, started)
    // 扫描发现落库为可跟踪异常（按 type+target 去重，已关闭的重新打开）
    for (const finding of findings) {
      const target = String(finding.target ?? '')
      const existing = await this.anomalyRepo.findOne({ where: { tenantId: user.tenantId, type: String(finding.type), target } })
      if (existing) {
        if (existing.status === 'CLOSED') {
          existing.status = 'OPEN'
          existing.closedBy = null
          existing.closeNote = null
          existing.closedAt = null
          existing.message = String(finding.message ?? '')
          await this.anomalyRepo.save(existing)
        }
        continue
      }
      await this.anomalyRepo.save(this.anomalyRepo.create({
        tenantId: user.tenantId,
        scanTaskId: taskResult.taskId,
        type: String(finding.type),
        severity: String(finding.severity ?? 'MEDIUM'),
        target,
        message: String(finding.message ?? ''),
        evidence: (finding.evidence as Record<string, unknown>) ?? null,
        suggestion: finding.suggestion ? String(finding.suggestion) : null
      }))
    }
    return taskResult
  }

  /** AI 异常列表 */
  async listAnomalies(query: { page?: number; pageSize?: number; status?: string }, user: JwtUser) {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const where: FindOptionsWhere<AiAnomalyEntity> = {
      tenantId: user.tenantId,
      ...(query.status ? { status: query.status } : {})
    }
    const [list, total] = await this.anomalyRepo.findAndCount({ where, order: { id: 'DESC' }, skip: (page - 1) * pageSize, take: pageSize })
    return buildPageResult(list, total, page, pageSize)
  }

  /** AI 异常指派 */
  async assignAnomaly(id: number, assigneeId: number, user: JwtUser): Promise<AiAnomalyEntity> {
    const anomaly = await this.anomalyRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!anomaly) throw new NotFoundException('AI 异常不存在')
    if (anomaly.status === 'CLOSED') throw new BadRequestException('已关闭异常不可指派')
    anomaly.assigneeId = assigneeId
    anomaly.status = 'ASSIGNED'
    const saved = await this.anomalyRepo.save(anomaly)
    await this.auditService.record({ bizType: 'ai_anomaly', bizId: id, action: 'ASSIGN_ANOMALY', afterValue: { assigneeId } }, user)
    return saved
  }

  /** AI 异常关闭（需填写处理说明） */
  async closeAnomaly(id: number, note: string, user: JwtUser): Promise<AiAnomalyEntity> {
    if (!note?.trim()) throw new BadRequestException('关闭异常必须填写处理说明')
    const anomaly = await this.anomalyRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!anomaly) throw new NotFoundException('AI 异常不存在')
    if (anomaly.status === 'CLOSED') throw new BadRequestException('该异常已关闭')
    anomaly.status = 'CLOSED'
    anomaly.closedBy = user.userId
    anomaly.closeNote = note.trim()
    anomaly.closedAt = new Date()
    const saved = await this.anomalyRepo.save(anomaly)
    await this.auditService.record({ bizType: 'ai_anomaly', bizId: id, action: 'CLOSE_ANOMALY', afterValue: { note } }, user)
    return saved
  }

  async reportInsight(dto: AiReportInsightDto, user: JwtUser): Promise<AiExecutionResult<Record<string, unknown>>> {
    const started = Date.now()
    const revenue = this.num(dto.metrics.revenue ?? dto.metrics.amount)
    const previousRevenue = this.num(dto.metrics.previousRevenue ?? dto.metrics.lastRevenue)
    const cost = this.num(dto.metrics.cost)
    const overdueAmount = this.num(dto.metrics.overdueAmount ?? dto.metrics.overdue)
    const growth = previousRevenue > 0 ? (revenue - previousRevenue) / previousRevenue : null
    const grossMargin = revenue > 0 ? (revenue - cost) / revenue : null
    const diagnoses: string[] = []
    if (growth !== null && growth < 0) diagnoses.push(`收入同比下降 ${(Math.abs(growth) * 100).toFixed(1)}%，需拆解客户与产品贡献。`)
    if (grossMargin !== null && grossMargin < 0.15) diagnoses.push(`毛利率 ${(grossMargin * 100).toFixed(1)}% 低于 15% 警戒线，需关注价格与成本。`)
    if (overdueAmount > 0) diagnoses.push(`逾期金额 ${overdueAmount.toFixed(2)}，建议联动应收账龄与催收。`)
    if (diagnoses.length === 0) diagnoses.push('关键指标未触发预警，建议继续观察同环比与账龄变化。')
    const citations = Object.entries(dto.metrics).map(([field, value]) => ({
      source: `${dto.reportType ?? 'REPORT'}.${field}`,
      field,
      value
    }))
    const result = {
      reportType: dto.reportType ?? 'REPORT',
      diagnoses,
      citations,
      note: '结论基于本次传入指标快照；导出简报应保留数据快照与生成时间。'
    }
    return this.persistTask(AI_CAPABILITY.REPORT, dto.metrics, result, citations, citations.length ? 0.86 : 0.3, user, started)
  }

  async listKnowledgeDocs(user: JwtUser): Promise<AiKnowledgeDocEntity[]> {
    const docs = await this.docRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 }, order: { id: 'DESC' } })
    // 文档列表与 RAG 引用使用同一可见性规则，避免列出无权限文档
    return docs.filter((doc) =>
      user.isSuperAdmin ||
      doc.createdBy === user.userId ||
      doc.visibility === 'PUBLIC' ||
      (doc.visibility === 'DEPT' && doc.orgId !== null && doc.orgId === user.orgId)
    )
  }

  async upsertKnowledge(dto: AiRagUpsertDto, user: JwtUser): Promise<AiExecutionResult<Record<string, unknown>>> {
    const started = Date.now()
    const existing = await this.docRepo.findOne({ where: { tenantId: user.tenantId, docCode: dto.docCode, isDeleted: 0 } })
    const doc = existing ?? this.docRepo.create({
      tenantId: user.tenantId,
      docCode: dto.docCode,
      createdBy: user.userId
    })
    doc.title = dto.title
    doc.content = dto.content
    doc.docType = dto.docType ?? 'TEXT'
    doc.visibility = dto.visibility ?? 'DEPT'
    doc.orgId = dto.orgId ?? user.orgId
    doc.fileUrl = dto.fileUrl ?? null
    doc.status = 'ACTIVE'
    doc.isDeleted = 0
    const saved = await this.docRepo.save(doc)
    await this.chunkRepo.delete({ tenantId: user.tenantId, docId: saved.id })
    const contents = this.splitChunks(dto.content)
    for (let i = 0; i < contents.length; i += 1) {
      await this.chunkRepo.save(this.chunkRepo.create({
        tenantId: user.tenantId,
        docId: saved.id,
        chunkNo: i + 1,
        content: contents[i] ?? '',
        vectorStatus: 'LOCAL'
      }))
    }
    saved.chunkCount = contents.length
    await this.docRepo.save(saved)
    await this.auditService.record({ bizType: 'ai_knowledge', bizId: saved.id, action: 'UPSERT_DOC', afterValue: saved }, user)
    const result = { docId: saved.id, docCode: saved.docCode, chunkCount: contents.length, visibility: saved.visibility }
    const evidence = [{ source: 'knowledge-doc', docId: saved.id, chunks: contents.length }]
    return this.persistTask(AI_CAPABILITY.RAG, { docCode: dto.docCode, title: dto.title }, result, evidence, 0.95, user, started)
  }

  async queryKnowledge(dto: AiRagQueryDto, user: JwtUser): Promise<AiExecutionResult<Record<string, unknown>>> {
    const started = Date.now()
    const docs = await this.docRepo.find({
      where: { tenantId: user.tenantId, isDeleted: 0, status: 'ACTIVE' },
      take: 500
    })
    const allowed = docs.filter((doc) =>
      user.isSuperAdmin ||
      doc.createdBy === user.userId ||
      doc.visibility === 'PUBLIC' ||
      (doc.visibility === 'DEPT' && doc.orgId !== null && doc.orgId === user.orgId)
    )
    const docIds = allowed.map((doc) => doc.id)
    const chunks = docIds.length
      ? await this.chunkRepo.find({ where: { tenantId: user.tenantId, docId: In(docIds) }, take: 1000 })
      : []
    const tokens = this.tokenize(dto.question)
    const ranked = chunks.map((chunk) => {
      const content = chunk.content.toLowerCase()
      const score = tokens.reduce((sum, token) => sum + (content.includes(token) ? 1 : 0), 0)
      return { chunk, score }
    }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, dto.topK ?? 3)
    const citations = ranked.map(({ chunk, score }) => {
      const doc = allowed.find((item) => item.id === chunk.docId)
      return {
        docId: chunk.docId,
        docTitle: doc?.title ?? '未知文档',
        chunkId: chunk.id,
        chunkNo: chunk.chunkNo,
        score,
        snippet: chunk.content.slice(0, 240)
      }
    })
    const answer = citations.length
      ? `根据 ${citations.length} 条可引用内容：${citations.map((item) => `【${item.docTitle}#${item.chunkNo}】${item.snippet}`).join('\n')}`
      : '未检索到有权限引用的知识内容。请检查文档权限或补充知识库。'
    const confidence = citations.length && tokens.length
      ? Math.min(0.95, 0.5 + (ranked[0]?.score ?? 0) / tokens.length * 0.4)
      : 0.2
    const result = { answer, citations, filteredDocs: docs.length - allowed.length }
    return this.persistTask(AI_CAPABILITY.RAG, { question: dto.question, topK: dto.topK ?? 3 }, result, citations, confidence, user, started)
  }

  async feedbackKnowledge(dto: AiRagFeedbackDto, user: JwtUser): Promise<AiKnowledgeChunkEntity> {
    const chunk = await this.chunkRepo.findOne({ where: { id: dto.chunkId, tenantId: user.tenantId } })
    if (!chunk) throw new NotFoundException('知识片段不存在')
    if (dto.feedback === 'GOOD') chunk.feedbackGood += 1
    else chunk.feedbackBad += 1
    const saved = await this.chunkRepo.save(chunk)
    await this.auditService.record({ bizType: 'ai_knowledge_chunk', bizId: saved.id, action: 'FEEDBACK', afterValue: { feedback: dto.feedback } }, user)
    return saved
  }

  async recommend(dto: AiRecommendDto, user: JwtUser): Promise<AiExecutionResult<Record<string, unknown>>> {
    const started = Date.now()
    const since = new Date()
    since.setDate(since.getDate() - 90)
    const lines = await this.saleLineRepo.find({
      where: scopeWhere<SaleOrderLineEntity>({ tenantId: user.tenantId, createdAt: MoreThanOrEqual(since) }, user),
      take: 1000
    })
    const totals = new Map<number, number>()
    for (const line of lines) {
      totals.set(line.productId, (totals.get(line.productId) ?? 0) + this.num(line.qty))
    }
    const recommendations = [...totals.entries()]
      .map(([productId, qty]) => ({ productId, qty: Number(qty.toFixed(3)), score: Number((qty / Math.max(1, lines.length)).toFixed(4)) }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, dto.limit ?? 5)
    const result = {
      customerId: dto.customerId ?? null,
      recommendations,
      note: '基于近 90 天销售明细聚合；价格与客户信用仍需业务校验。'
    }
    const evidence = recommendations.map((item) => ({ source: 'sale_order_line', productId: item.productId, qty: item.qty }))
    return this.persistTask(AI_CAPABILITY.RECOMMEND, { customerId: dto.customerId, limit: dto.limit ?? 5 }, result, evidence, recommendations.length ? 0.82 : 0.25, user, started)
  }

  async reconcile(dto: AiReconcileDto, user: JwtUser): Promise<AiExecutionResult<Record<string, unknown>>> {
    const started = Date.now()
    const leftMap = new Map<string, number>()
    const rightMap = new Map<string, number>()
    for (const item of dto.left) {
      leftMap.set(String(item.key ?? item.id ?? item.no ?? ''), this.num(item.amount ?? item.qty))
    }
    for (const item of dto.right) {
      rightMap.set(String(item.key ?? item.id ?? item.no ?? ''), this.num(item.amount ?? item.qty))
    }
    const onlyLeft = [...leftMap.keys()].filter((key) => key && !rightMap.has(key))
    const onlyRight = [...rightMap.keys()].filter((key) => key && !leftMap.has(key))
    const amountMismatch = [...leftMap.entries()]
      .filter(([key, amount]) => rightMap.has(key) && Math.abs(amount - (rightMap.get(key) ?? 0)) > 0.0001)
      .map(([key, amount]) => ({ key, left: amount, right: rightMap.get(key) ?? 0 }))
    const result = { onlyLeft, onlyRight, amountMismatch, diffCount: onlyLeft.length + onlyRight.length + amountMismatch.length }
    const evidence = [
      { source: 'input-left', count: dto.left.length },
      { source: 'input-right', count: dto.right.length }
    ]
    return this.persistTask(AI_CAPABILITY.RECONCILE, { leftCount: dto.left.length, rightCount: dto.right.length }, result, evidence, 0.9, user, started)
  }

  async subjectMatch(dto: AiSubjectMatchDto, user: JwtUser): Promise<AiExecutionResult<Record<string, unknown>>> {
    const started = Date.now()
    const subjects = await this.subjectRepo.find({
      where: { tenantId: user.tenantId, isDeleted: 0, status: 'ENABLED' },
      take: 500
    })
    const tokens = this.tokenize(dto.summary)
    const candidates = subjects.map((subject) => {
      const text = `${subject.subjectCode}${subject.subjectName}`.toLowerCase()
      const score = tokens.reduce((sum, token) => sum + (text.includes(token) ? 1 : 0), 0)
      return {
        subjectId: subject.id,
        subjectCode: subject.subjectCode,
        subjectName: subject.subjectName,
        confidence: Number((0.4 + score * 0.18).toFixed(4))
      }
    }).filter((item) => item.confidence > 0.4).sort((a, b) => b.confidence - a.confidence).slice(0, dto.limit ?? 5)
    const result = {
      candidates,
      note: candidates.length ? '科目建议需会计确认后使用。' : '未匹配到科目，请人工选择。'
    }
    return this.persistTask(AI_CAPABILITY.SUBJECT_MATCH, { summary: dto.summary }, result, candidates, candidates.length ? 0.84 : 0.2, user, started)
  }

  async resumeParse(dto: AiResumeDto, user: JwtUser): Promise<AiExecutionResult<Record<string, unknown>>> {
    const started = Date.now()
    const result = {
      name: this.extract(/(?:姓名|名字)[:：\s]*([\u4e00-\u9fa5]{2,4})/, dto.text),
      phone: this.extract(/(1[3-9]\d{9})/, dto.text),
      email: this.extract(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/, dto.text),
      education: this.extract(/(博士|硕士|本科|大专|高中)/, dto.text),
      company: this.extract(/(?:公司|任职)[:：\s]*([^\n，,；;]{2,40})/, dto.text),
      skills: this.extractSkills(dto.text),
      fileName: dto.fileName ?? null,
      note: '简历解析结果不直接写入候选人档案，需招聘人员确认。'
    }
    const confidence = Object.values(result).filter((value) => typeof value === 'string' && value.length > 0).length >= 4 ? 0.86 : 0.45
    return this.persistTask(AI_CAPABILITY.RESUME, { text: dto.text, fileName: dto.fileName }, result, [{ source: 'local-rule-engine', fileName: dto.fileName ?? null }], confidence, user, started)
  }

  async labelRecognize(dto: AiLabelDto, user: JwtUser): Promise<AiExecutionResult<Record<string, unknown>>> {
    const started = Date.now()
    const source = `${dto.text} ${dto.fileName ?? ''}`
    const category = ['电子', '食品', '服装', '建材', '化工', '医药'].find((item) => source.includes(item)) ?? null
    const result = {
      productName: this.extract(/(?:品名|名称|商品)[:：\s]*([^\n，,；;]{2,40})/, source) ?? dto.fileName?.replace(/\.[^.]+$/, '') ?? null,
      category,
      spec: this.extract(/(\d+(?:\.\d+)?\s*(?:ml|L|g|kg|mm|cm|m|寸|英寸))/i, source),
      barcode: this.extract(/\b(\d{8,18})\b/, source),
      attributes: this.extractSkills(source),
      note: '标签识别必须人工确认后才能用于商品档案。'
    }
    const confidence = result.productName && category ? 0.84 : 0.4
    return this.persistTask(AI_CAPABILITY.LABEL, { text: dto.text, fileName: dto.fileName }, result, [{ source: 'local-rule-engine', fileName: dto.fileName ?? null }], confidence, user, started)
  }

  async csReply(dto: AiCsDto, user: JwtUser): Promise<AiExecutionResult<Record<string, unknown>>> {
    const started = Date.now()
    let answer = '您好，已收到您的问题，我们将转人工客服跟进。'
    if (/物流|发货|运单/.test(dto.question)) {
      answer = '您的订单正在处理中，发货后运单号会同步至订单详情；如超过承诺时效请联系人文客服核查。'
    } else if (/退款|退货/.test(dto.question)) {
      answer = '退款申请需先确认订单状态与售后原因，审核通过后按原支付渠道退回。'
    } else if (/发票/.test(dto.question)) {
      answer = '电子发票将在订单完成后开具，请确认开票抬头与税号准确无误。'
    }
    if (dto.orderNo) answer = `订单 ${dto.orderNo}：${answer}`
    const result = { answer, escalation: /人工|投诉/.test(dto.question), orderNo: dto.orderNo ?? null }
    return this.persistTask(AI_CAPABILITY.CS, { question: dto.question, orderNo: dto.orderNo }, result, [{ source: 'local-rule-engine', type: 'CS_TEMPLATE' }], 0.78, user, started)
  }

  async listModelConfigs(user: JwtUser): Promise<AiModelConfigEntity[]> {
    return this.modelRepo.find({ where: { tenantId: user.tenantId, isDeleted: 0 }, order: { id: 'DESC' } })
  }

  async createModelConfig(dto: CreateAiModelConfigDto, user: JwtUser): Promise<AiModelConfigEntity> {
    const existing = await this.modelRepo.findOne({ where: { tenantId: user.tenantId, code: dto.code, isDeleted: 0 } })
    if (existing) throw new BadRequestException('模型编码已存在')
    if (dto.isDefault === 'YES') await this.clearDefaultModels(user)
    const entity = this.modelRepo.create({
      tenantId: user.tenantId,
      code: dto.code,
      name: dto.name,
      provider: dto.provider,
      capability: dto.capability ?? 'ALL',
      grayPercent: dto.grayPercent ?? 0,
      model: dto.model,
      endpoint: dto.endpoint ?? null,
      apiKeyMask: this.maskApiKey(dto.apiKey),
      temperature: (dto.temperature ?? 0.2).toFixed(2),
      maxTokens: dto.maxTokens ?? 2048,
      rateLimit: dto.rateLimit ?? 60,
      isDefault: dto.isDefault === 'YES' ? 1 : 0,
      createdBy: user.userId
    })
    const saved = await this.modelRepo.save(entity)
    await this.auditService.record({ bizType: 'ai_model', bizId: saved.id, action: 'CREATE_MODEL', afterValue: saved }, user)
    return saved
  }

  async updateModelConfig(id: number, dto: UpdateAiModelConfigDto, user: JwtUser): Promise<AiModelConfigEntity> {
    const entity = await this.modelRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('模型配置不存在')
    const before = { ...entity }
    if (dto.apiKey !== undefined) entity.apiKeyMask = this.maskApiKey(dto.apiKey)
    if (dto.temperature !== undefined) entity.temperature = dto.temperature.toFixed(2)
    if (dto.isDefault === 'YES') {
      await this.clearDefaultModels(user, id)
      entity.isDefault = 1
    } else if (dto.isDefault === 'NO') {
      entity.isDefault = 0
    }
    const { apiKey: _apiKey, temperature: _temperature, isDefault: _isDefault, ...rest } = dto
    void _apiKey
    void _temperature
    void _isDefault
    Object.assign(entity, rest)
    entity.updatedAt = new Date()
    const saved = await this.modelRepo.save(entity)
    await this.auditService.record({ bizType: 'ai_model', bizId: id, action: 'UPDATE_MODEL', beforeValue: before, afterValue: saved }, user)
    return saved
  }

  private async recordAudit(
    capability: string,
    request: string,
    response: string,
    user: JwtUser,
    started: number
  ): Promise<AiAuditLogEntity> {
    const audit = this.auditLogRepo.create({
      tenantId: user.tenantId,
      capability,
      userId: user.userId,
      model: 'local-rule-engine',
      promptTokens: Math.ceil(request.length / 2),
      completionTokens: Math.ceil(response.length / 2),
      latencyMs: Date.now() - started,
      accepted: 'PENDING',
      request: request.slice(0, 60000),
      response: response.slice(0, 60000)
    })
    return this.auditLogRepo.save(audit)
  }

  private async persistTask<T>(
    capability: string,
    input: string | Record<string, unknown>,
    result: T,
    evidence: Record<string, unknown>[],
    confidence: number,
    user: JwtUser,
    started: number
  ): Promise<AiExecutionResult<T>> {
    const serialized = typeof input === 'string' ? input : JSON.stringify(input)
    const audit = await this.recordAudit(capability, serialized, JSON.stringify(result), user, started)
    const task = this.taskRepo.create({
      tenantId: user.tenantId,
      taskNo: this.taskNo(),
      capability,
      inputText: serialized.slice(0, 60000),
      inputJson: typeof input === 'string' ? null : input,
      resultJson: result as unknown as Record<string, unknown>,
      confidence: confidence.toFixed(4),
      status: 'DONE',
      auditId: audit.id,
      evidence,
      createdBy: user.userId
    })
    const saved = await this.taskRepo.save(task)
    return {
      taskId: saved.id,
      taskNo: saved.taskNo,
      auditId: audit.id,
      capability,
      confidence: saved.confidence,
      evidence,
      result
    }
  }

  private async loadSalesHistory(user: JwtUser, productId?: number): Promise<ForecastPoint[]> {
    const since = new Date()
    since.setMonth(since.getMonth() - 6)
    const lines = await this.saleLineRepo.find({
      where: scopeWhere<SaleOrderLineEntity>({
        tenantId: user.tenantId,
        createdAt: MoreThanOrEqual(since),
        ...(productId ? { productId } : {})
      }, user),
      order: { createdAt: 'ASC' },
      take: 1000
    })
    const groups = new Map<string, number>()
    for (const line of lines) {
      const created = line.createdAt instanceof Date ? line.createdAt : new Date(line.createdAt)
      const period = created.toISOString().slice(0, 7)
      groups.set(period, (groups.get(period) ?? 0) + this.num(line.qty))
    }
    return [...groups.entries()].map(([period, qty]) => ({ period, qty: Number(qty.toFixed(3)) }))
  }

  private parseDocumentLines(text: string): Array<Record<string, unknown>> {
    const result: Array<Record<string, unknown>> = []
    const regex = /([^\s，,；;]{2,30})\s+(\d+(?:\.\d{1,3})?)\s*[×x*]\s*(\d+(?:\.\d{1,4})?)/g
    for (const match of text.matchAll(regex)) {
      const qty = Number(match[2] ?? 0)
      const price = Number(match[3] ?? 0)
      result.push({ productName: match[1], qty, unitPrice: price, amount: Number((qty * price).toFixed(4)) })
    }
    return result.slice(0, 100)
  }

  private splitChunks(content: string): string[] {
    const paragraphs = content.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean)
    const chunks: string[] = []
    for (const paragraph of paragraphs) {
      for (let i = 0; i < paragraph.length; i += 800) {
        chunks.push(paragraph.slice(i, i + 800))
      }
    }
    return chunks.slice(0, 500)
  }

  private tokenize(text: string): string[] {
    return [...new Set((text.toLowerCase().match(/[\u4e00-\u9fa5]{2,}|[a-z0-9]{2,}/g) ?? []))].slice(0, 30)
  }

  private extractSkills(text: string): string[] {
    const skills = ['Vue', 'NestJS', 'MySQL', 'ERP', '销售', '采购', '财务', '沟通', '管理']
    return skills.filter((skill) => text.toLowerCase().includes(skill.toLowerCase()))
  }

  private extract(pattern: RegExp, text: string): string | null {
    const match = text.match(pattern)
    return match?.[1]?.trim() ?? null
  }

  private num(value: unknown): number {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  private currentPeriod(): string {
    return new Date().toISOString().slice(0, 7)
  }

  private nextPeriod(period: string, offset: number): string {
    const [yearText, monthText] = period.split('-')
    const year = Number(yearText ?? new Date().getFullYear())
    const month = Number(monthText ?? new Date().getMonth() + 1)
    const date = new Date(year, month - 1 + offset, 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  }

  private taskNo(): string {
    return `AI${`${Date.now().toString(36)}${randomBytes(2).toString('hex')}`.toUpperCase()}`
  }

  private maskApiKey(apiKey?: string): string | null {
    if (!apiKey) return null
    if (apiKey.length <= 8) return `${apiKey.slice(0, 2)}****`
    return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`
  }

  private async clearDefaultModels(user: JwtUser, exceptId?: number): Promise<void> {
    const defaults = await this.modelRepo.find({ where: { tenantId: user.tenantId, isDefault: 1, isDeleted: 0 } })
    for (const model of defaults) {
      if (model.id === exceptId) continue
      model.isDefault = 0
      await this.modelRepo.save(model)
    }
  }

  private buildSuggestion(prompt: string): string {
    if (prompt.includes('库存')) {
      return '建议先核对库存余额、锁定量和冻结量，可用量=实物量-锁定量-冻结量；任何调整必须保留库存流水。'
    }
    if (prompt.includes('销售')) {
      return '建议按客户信用额度、协议价和可用库存顺序校验销售单；确认后才会生成应收和凭证。'
    }
    if (prompt.includes('采购')) {
      return '建议按供应商准入、采购价目、质检状态和批次信息校验采购收货；未质检不可入库。'
    }
    if (prompt.includes('凭证')) {
      return '建议先检查借贷是否平衡，再检查摘要、科目辅助核算和附件；过账后凭证不可直接修改。'
    }
    return '我已收到问题。当前使用本地规则引擎兜底，建议仅作为业务参考；写入业务数据前请人工确认。'
  }

  private async findPrompt(id: number, user: JwtUser): Promise<AiPromptEntity> {
    const entity = await this.promptRepo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) {
      throw new NotFoundException('Prompt 不存在')
    }
    return entity
  }
}
