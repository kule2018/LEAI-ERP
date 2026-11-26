import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import {
  AiProcurementAdviceEntity,
  type AdviceQuote,
  type AdviceSupplier,
  type AdviceSuggestion
} from './entities/procurement-advice.entity'
import { AddQuoteDto, ConfirmAdviceDto, QueryAdviceDto, StartAdviceDto } from './dto'

@Injectable()
export class ProcurementAdviceService {
  constructor(
    @InjectRepository(AiProcurementAdviceEntity)
    private readonly repo: Repository<AiProcurementAdviceEntity>
  ) {}

  async list(query: QueryAdviceDto, user: JwtUser): Promise<PageResult<AiProcurementAdviceEntity>> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const where = {
      tenantId: user.tenantId,
      isDeleted: 0,
      ...(query.status ? { status: query.status } : {})
    }
    const [list, total] = await this.repo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
    return buildPageResult(list, total, page, pageSize)
  }

  async detail(id: number, user: JwtUser): Promise<AiProcurementAdviceEntity> {
    return this.load(id, user)
  }

  async start(dto: StartAdviceDto, user: JwtUser): Promise<AiProcurementAdviceEntity> {
    if (!dto.suppliers.length) throw new BadRequestException('至少选择一家供应商')
    const stamp = Date.now()
    const taskNo = `PA-${stamp}-${Math.floor(Math.random() * 1000)}`
    const suppliers: AdviceSupplier[] = dto.suppliers.map((name, index) => ({
      name,
      inquiryNo: `RFQ-${stamp}-${index + 1}`,
      sourceType: 'EMAIL'
    }))
    const entity = this.repo.create({
      tenantId: user.tenantId,
      taskNo,
      productName: dto.productName,
      shortageQty: String(dto.shortageQty),
      ruleText: dto.ruleText ?? '',
      suppliers,
      quotes: [],
      suggestion: null,
      status: 'WAITING',
      progress: 'INQUIRING',
      resumeCount: 0,
      remindCount: 0,
      createdBy: user.userId,
      evaluation: { startedAt: new Date().toISOString(), reminders: 0, resumes: 0 }
    })
    return this.repo.save(entity)
  }

  async pause(id: number, user: JwtUser): Promise<AiProcurementAdviceEntity> {
    const entity = await this.load(id, user)
    if (entity.status !== 'WAITING') throw new BadRequestException('仅等待中的任务可以暂停')
    entity.status = 'PAUSED'
    return this.repo.save(entity)
  }

  async resume(id: number, user: JwtUser): Promise<AiProcurementAdviceEntity> {
    const entity = await this.load(id, user)
    if (entity.status === 'WAITING') return entity
    if (entity.status !== 'PAUSED') throw new BadRequestException('仅暂停的任务可以恢复')
    entity.status = 'WAITING'
    entity.resumeCount += 1
    return this.repo.save(entity)
  }

  async remind(id: number, user: JwtUser): Promise<AiProcurementAdviceEntity> {
    const entity = await this.load(id, user)
    if (entity.status !== 'WAITING' && entity.status !== 'PAUSED') {
      throw new BadRequestException('当前任务状态无需催办')
    }
    entity.remindCount += 1
    return this.repo.save(entity)
  }

  async addQuote(id: number, dto: AddQuoteDto, user: JwtUser): Promise<AiProcurementAdviceEntity> {
    const entity = await this.load(id, user)
    if (entity.status === 'CONFIRMED' || entity.status === 'REJECTED') {
      throw new BadRequestException('任务已结束，不能继续录入报价')
    }
    if (!entity.status || !['WAITING', 'PAUSED', 'READY'].includes(entity.status)) {
      throw new BadRequestException('任务状态异常')
    }
    const quotes = [...(entity.quotes ?? [])]
    const quote: AdviceQuote = {
      supplier: dto.supplier,
      sourceType: dto.sourceType,
      fileName: dto.fileName ?? '',
      unitPrice: dto.unitPrice,
      moq: dto.moq,
      leadTimeDays: dto.leadTimeDays,
      ruleOk: dto.ruleOk,
      evidence: dto.evidence ?? ''
    }
    const existing = quotes.findIndex((item) => item.supplier === dto.supplier)
    if (existing >= 0) quotes[existing] = quote
    else quotes.push(quote)
    entity.quotes = quotes
    entity.progress = 'QUOTED'

    const suppliers = entity.suppliers ?? []
    if (suppliers.length > 0 && quotes.length >= suppliers.length) {
      entity.suggestion = this.buildSuggestion(quotes)
      entity.status = 'READY'
      entity.progress = 'SUGGESTED'
    }
    return this.repo.save(entity)
  }

  async confirm(id: number, dto: ConfirmAdviceDto, user: JwtUser): Promise<AiProcurementAdviceEntity> {
    const entity = await this.load(id, user)
    if (entity.status !== 'READY') throw new BadRequestException('报价未到齐，不能确认采购建议')
    entity.status = dto.decision === 'CONFIRM' ? 'CONFIRMED' : 'REJECTED'
    entity.progress = 'DONE'
    entity.confirmedBy = user.userId
    entity.confirmedAt = new Date()
    entity.draftNo = dto.decision === 'CONFIRM' ? `PD-${entity.taskNo}` : null
    const evaluation = { ...(entity.evaluation ?? {}) }
    evaluation.decision = dto.decision
    evaluation.note = dto.note ?? ''
    evaluation.confirmedAt = entity.confirmedAt.toISOString()
    entity.evaluation = evaluation
    return this.repo.save(entity)
  }

  async metrics(user: JwtUser): Promise<Record<string, unknown>> {
    const all = await this.repo.find({ where: { tenantId: user.tenantId, isDeleted: 0 } })
    const total = all.length
    const confirmed = all.filter((item) => item.status === 'CONFIRMED').length
    const resumes = all.reduce((sum, item) => sum + item.resumeCount, 0)
    const reminders = all.reduce((sum, item) => sum + item.remindCount, 0)
    const accuracy = total ? `${((confirmed / total) * 100).toFixed(1)}%` : '—'
    return {
      note: '数值以实际评测为准，当前为运行记录统计',
      rows: [
        { scheme: '基线', accuracy: '—', modelCost: '—', duration: '—', remark: '人工逐家询价与比价' },
        {
          scheme: '当前',
          accuracy,
          modelCost: `${total} 个任务`,
          duration: `${reminders} 次催办 / ${resumes} 次恢复`,
          remark: '多模态识别 + 规则引用 + 人工确认'
        },
        {
          scheme: '优化版',
          accuracy: '待评测',
          modelCost: '待评测',
          duration: '待评测',
          remark: '接入真实报价样本后回填'
        }
      ]
    }
  }

  private buildSuggestion(quotes: AdviceQuote[]): AdviceSuggestion {
    const ranking = quotes
      .map((quote) => ({
        supplier: quote.supplier,
        score: Number(((quote.ruleOk ? 100 : 0) - quote.unitPrice * 0.01 - quote.leadTimeDays).toFixed(2)),
        reason: `${quote.ruleOk ? '规则校验通过' : '规则待核对'}；单价 ${quote.unitPrice}；起订量 ${quote.moq}；交期 ${quote.leadTimeDays} 天`
      }))
      .sort((left, right) => right.score - left.score)
    const winner = ranking[0]?.supplier ?? ''
    return {
      winner,
      reason: `依据规则校验与综合评分推荐 ${winner}，其余供应商的待核对项已在比价表标注`,
      ruleCitations: ['供应商资质有效期规则', '采购价格阈值规则', '交期承诺规则'],
      ranking
    }
  }

  private async load(id: number, user: JwtUser): Promise<AiProcurementAdviceEntity> {
    const entity = await this.repo.findOne({ where: { id, tenantId: user.tenantId, isDeleted: 0 } })
    if (!entity) throw new NotFoundException('询比价任务不存在')
    return entity
  }
}
