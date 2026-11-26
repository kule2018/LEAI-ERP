import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { FindOptionsWhere, Repository } from 'typeorm'
import {
  buildRevisionPayload,
  diffSnapshots,
  nextRevisionVersion,
  summarizeRevisionDiff
} from '../../common/revision-engine'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { AuditService } from '../audit/audit.service'
import { QueryRevisionSnapshotDto, RecordRevisionSnapshotDto } from './dto'
import { RevisionSnapshotEntity } from './entities/revision-snapshot.entity'

/**
 * 通用版本快照服务：各业务域统一通过该服务留存单据版本，
 * 并自动计算与上一版本的差异，支持任意单据追溯与比对。
 */
@Injectable()
export class RevisionService {
  private readonly logger = new Logger(RevisionService.name)

  constructor(
    @InjectRepository(RevisionSnapshotEntity) private readonly repo: Repository<RevisionSnapshotEntity>,
    private readonly auditService: AuditService
  ) {}

  /**
   * 安全写入快照：快照属于辅助能力，写入失败不应阻断业务主流程，
   * 这里吞掉异常并记录日志，由调用方无需各自 try/catch。
   */
  async recordSafe(dto: RecordRevisionSnapshotDto, user: JwtUser): Promise<RevisionSnapshotEntity | null> {
    try {
      return await this.record(dto, user)
    } catch (cause) {
      this.logger.warn(
        `版本快照写入失败（${dto.entityCode}#${dto.bizId}）：${cause instanceof Error ? cause.message : cause}`
      )
      return null
    }
  }

  /** 记录快照：版本号自动推进，并计算与上一版本的差异 */
  async record(dto: RecordRevisionSnapshotDto, user: JwtUser): Promise<RevisionSnapshotEntity> {
    const entityCode = dto.entityCode.trim()
    const previous = await this.latestByBiz(user.tenantId, entityCode, dto.bizId)
    const snapshot = buildRevisionPayload(dto.snapshot)
    const diff = previous ? diffSnapshots(previous.snapshot, snapshot) : []
    const entity = this.repo.create({
      tenantId: user.tenantId,
      entityCode,
      bizId: dto.bizId,
      versionNo: nextRevisionVersion(previous?.versionNo),
      action: dto.action ?? 'SNAPSHOT',
      snapshot,
      diff,
      operatorId: user.userId,
      operatorName: user.username ?? null,
      source: dto.source ?? 'SYSTEM',
      remark: dto.remark?.trim() ?? null
    })
    const saved = await this.repo.save(entity)
    await this.auditService.record({
      bizType: 'revision_snapshot',
      bizId: saved.id,
      action: 'RECORD_REVISION_SNAPSHOT',
      afterValue: { entityCode, bizId: dto.bizId, versionNo: saved.versionNo, changes: summarizeRevisionDiff(diff) }
    }, user)
    return saved
  }

  async list(query: QueryRevisionSnapshotDto, user: JwtUser): Promise<PageResult<RevisionSnapshotEntity>> {
    const where: FindOptionsWhere<RevisionSnapshotEntity> = { tenantId: user.tenantId }
    if (query.entityCode) where.entityCode = query.entityCode
    if (query.bizId) where.bizId = query.bizId
    if (query.action) where.action = query.action
    const [list, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  async detail(id: number, user: JwtUser): Promise<RevisionSnapshotEntity> {
    const entity = await this.repo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!entity) throw new NotFoundException('版本快照不存在')
    return entity
  }

  /** 两个版本之间的差异 */
  async diff(fromId: number, toId: number, user: JwtUser) {
    const [from, to] = await Promise.all([this.detail(fromId, user), this.detail(toId, user)])
    const entries = diffSnapshots(from.snapshot, to.snapshot)
    return {
      entityCode: to.entityCode,
      bizId: to.bizId,
      from: { id: from.id, versionNo: from.versionNo, createdAt: from.createdAt },
      to: { id: to.id, versionNo: to.versionNo, createdAt: to.createdAt },
      diff: entries,
      summary: summarizeRevisionDiff(entries)
    }
  }

  /** 某业务单据的最新快照 */
  async latestByBiz(tenantId: number, entityCode: string, bizId: number): Promise<RevisionSnapshotEntity | null> {
    const list = await this.repo.find({
      where: { tenantId, entityCode, bizId },
      order: { versionNo: 'DESC' },
      take: 1
    })
    return list[0] ?? null
  }

  /** 某业务单据的全部版本（按版本号升序） */
  async history(tenantId: number, entityCode: string, bizId: number): Promise<RevisionSnapshotEntity[]> {
    return this.repo.find({
      where: { tenantId, entityCode, bizId },
      order: { versionNo: 'ASC' }
    })
  }
}
