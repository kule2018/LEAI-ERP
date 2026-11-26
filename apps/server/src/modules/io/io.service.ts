import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource, type EntityTarget, type FindOptionsWhere, type ObjectLiteral } from 'typeorm'
import { randomUUID } from 'node:crypto'
import { encodeCsv, parseCsvTable } from '../../common/csv'
import { appendWatermark, buildCsvWatermark, sanitizeExportRow } from '../../common/export-guard-engine'
import { buildPageResult, DATA_SCOPE_LEVEL, type DataScopeLevel, type JwtUser, type PageResult } from '../../common/contracts'
import { currentScope, enterScope, scopeWhere } from '../../common/data-scope-context'
import { CUSTOM_VALUE_KEY_PREFIX, type CustomFieldDefinition } from '../../common/custom-field-engine'
import { AuditService } from '../audit/audit.service'
import { ConfigService } from '../config/config.service'
import { SchedulerService } from '../ops/scheduler.service'
import { CustomFieldService } from '../customization/custom-field.service'
import { CustomerEntity } from '../master-data/entities/customer.entity'
import { ProductEntity } from '../master-data/entities/product.entity'
import { applyHeaderMapping, buildImportPreview, buildTemplateCsv } from './io-engine'
import { IMPORT_CONFIGS } from './io.configs'
import { IoJobEntity } from './entities/io-job.entity'
import { IoImportErrorEntity } from './entities/io-import-error.entity'
import { IoImportMappingEntity } from './entities/io-import-mapping.entity'
import { IoImportTaskEntity } from './entities/io-import-task.entity'
import type { ExportConfig, ImportConfig, ImportPreview } from './io.types'

type MappedRow = Record<string, unknown>

interface ExportScopeSnapshot {
  level: DataScopeLevel
  orgId: number | null
  orgField?: string
  childOrgIds?: number[]
}

const ENTITY_TARGETS: Record<string, EntityTarget<ObjectLiteral>> = {
  customer: CustomerEntity,
  product: ProductEntity
}

/** 自定义字段在导入/导出中的表头前缀 */
const CUSTOM_HEADER_PREFIX = '自定义-'

@Injectable()
export class IoService implements OnModuleInit {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly scheduler: SchedulerService,
    private readonly configService: ConfigService,
    private readonly customFieldService: CustomFieldService
  ) {}

  onModuleInit(): void {
    this.scheduler.register({
      code: 'io.export.worker',
      name: '异步导出发任务执行器',
      intervalMinutes: 5,
      enabled: true,
      handler: async () => this.processPendingJobs()
    })
  }

  /** 消费 PENDING 导出任务：生成 CSV 并标记完成（内容存于 resultUrl 占位，供后续下载端点读取） */
  async processPendingJobs(): Promise<string> {
    const jobRepo = this.dataSource.getRepository(IoJobEntity)
    const pending = await jobRepo.find({ where: { status: 'PENDING' }, take: 20 })
    let done = 0
    for (const job of pending) {
      try {
        const snapshot = this.parseScopeSnapshot(job.scopeJson)
        const actor = this.actorFromScope(job.tenantId, job.createdBy ?? 0, job.scopeJson)
        enterScope({
          org: snapshot?.orgField === 'org_id' ? 'org' : snapshot?.orgField === 'created_by' ? 'created_by' : 'dept',
          level: actor.dataScopeLevel,
          orgId: actor.orgId,
          ...(snapshot?.orgField ? { orgField: snapshot.orgField } : {}),
          ...(snapshot?.childOrgIds ? { childOrgIds: snapshot.childOrgIds } : {})
        })
        const rows = (await this.loadExportRows(job.code, job.tenantId, actor)).slice(0, 500).map(sanitizeExportRow)
        const watermarkOptions = await this.configService.getExportWatermarkOptions(job.tenantId)
        const content = encodeCsv(
          appendWatermark(rows, buildCsvWatermark({ tenantId: job.tenantId, userId: job.createdBy ?? 0 }), watermarkOptions),
          { bom: true }
        )
        job.resultUrl = `/api/v1/system/io/jobs/${job.id}/content`
        job.content = content
        job.status = 'DONE'
        job.finishedAt = new Date()
        await jobRepo.save(job)
        done++
      } catch (cause) {
        job.status = 'FAILED'
        job.errorMessage = String(cause instanceof Error ? cause.message : cause).slice(0, 1000)
        job.finishedAt = new Date()
        await jobRepo.save(job)
      }
    }
    return `处理导出任务 ${pending.length}，完成 ${done}`
  }

  /** 按资源代码导出基础数据（当前支持 customer/product），并追加该实体的自定义字段列 */
  async loadExportRows(code: string, tenantId: number, actor?: JwtUser): Promise<Array<Array<string | number>>> {
    const user = actor ?? this.actorFromScope(tenantId, 0, null)
    const customFields = await this.loadCustomFields(code, user)
    const customHeaders = customFields.map((f) => `${CUSTOM_HEADER_PREFIX}${f.fieldLabel}`)
    if (code === 'customer') {
      const rows = await this.dataSource.getRepository(CustomerEntity).find({
        where: scopeWhere({ tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' })
      })
      const customValues = await this.customFieldService.valuesBatch('CUSTOMER', rows.map((r) => r.id), user)
      return [
        ['客户编码', '客户名称', '信用额度', '状态', ...customHeaders],
        ...rows.map((r) => [
          r.customerCode,
          r.customerName,
          r.creditLimit,
          r.status,
          ...customFields.map((f) => this.formatCustomValue(customValues[String(r.id)]?.[f.fieldKey]))
        ])
      ]
    }
    if (code === 'product') {
      const rows = await this.dataSource.getRepository(ProductEntity).find({
        where: scopeWhere({ tenantId, isDeleted: 0 }, user, { ownerField: 'createdBy' })
      })
      const customValues = await this.customFieldService.valuesBatch('PRODUCT', rows.map((r) => r.id), user)
      return [
        ['产品编码', '产品名称', '销售价', '成本价', ...customHeaders],
        ...rows.map((r) => [
          r.productCode,
          r.productName,
          r.price,
          r.cost,
          ...customFields.map((f) => this.formatCustomValue(customValues[String(r.id)]?.[f.fieldKey]))
        ])
      ]
    }
    return [['提示', `资源 ${code} 暂未配置导出字段`]]
  }

  /**
   * 读取资源关联的自定义字段定义：导入模板、导入写入与导出列都会并入这些字段，
   * 保证自定义字段在「表单 / 列表 / 导入导出」各层口径一致。
   */
  private async loadCustomFields(code: string, user: JwtUser): Promise<CustomFieldDefinition[]> {
    const entityCode = IMPORT_CONFIGS[code]?.entityCode
    if (!entityCode) return []
    try {
      return await this.customFieldService.definitions(entityCode, user)
    } catch {
      return []
    }
  }

  /** 自定义字段的导入列定义 */
  private buildCustomImportFields(fields: CustomFieldDefinition[]): Array<ImportConfig<Record<string, unknown>>['fields'][number]> {
    return fields.map((field) => ({
      header: `${CUSTOM_HEADER_PREFIX}${field.fieldLabel}`,
      key: `${CUSTOM_VALUE_KEY_PREFIX}${field.fieldKey}`,
      required: field.required,
      type: field.fieldType === 'NUMBER' ? 'decimal' : field.fieldType === 'BOOLEAN' ? 'boolean' : 'string',
      maxLength: field.maxLength
    }))
  }

  /** 解析导入配置：基础字段 + 该实体的自定义字段列 */
  private async resolveConfig(code: string, user: JwtUser): Promise<ImportConfig<Record<string, unknown>>> {
    const base = IMPORT_CONFIGS[code]
    if (!base) throw new NotFoundException(`导入配置不存在：${code}`)
    const customFields = await this.loadCustomFields(code, user)
    if (customFields.length === 0) return base
    return { ...base, fields: [...base.fields, ...this.buildCustomImportFields(customFields)] }
  }

  private formatCustomValue(value: unknown): string {
    if (value === null || value === undefined) return ''
    if (Array.isArray(value)) return value.join(',')
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  /** 列出可用的导入资源 */
  async listImportConfigs(user: JwtUser) {
    const result = []
    for (const config of Object.values(IMPORT_CONFIGS)) {
      const resolved = await this.resolveConfig(config.code, user)
      result.push({
        code: resolved.code,
        name: resolved.name,
        headers: resolved.fields.map((f) => f.header)
      })
    }
    return result
  }

  /** 下载导入模板（CSV，带 BOM），含该实体的自定义字段列 */
  async template(code: string, user: JwtUser): Promise<{ filename: string; content: string }> {
    const config = await this.resolveConfig(code, user)
    return { filename: `${code}-template.csv`, content: buildTemplateCsv(config) }
  }

  /** 校验预览：只解析校验，不落库；先应用已保存的字段映射 */
  async preview(code: string, csvText: string, user: JwtUser): Promise<ImportPreview> {
    const config = await this.resolveConfig(code, user)
    if (!csvText || !csvText.trim()) throw new BadRequestException('文件内容为空')
    return buildImportPreview(config, await this.applySavedMapping(code, csvText, user))
  }

  /** 读取已保存的字段映射并应用到上传的 CSV 表头 */
  private async applySavedMapping(code: string, csvText: string, user: JwtUser): Promise<string> {
    const rows = await this.dataSource.getRepository(IoImportMappingEntity).find({
      where: { tenantId: user.tenantId, code }
    })
    if (rows.length === 0) return csvText
    const mapping: Record<string, string> = {}
    for (const row of rows) mapping[row.sourceHeader] = row.targetHeader
    return applyHeaderMapping(csvText, mapping)
  }

  /** 查询某资源的字段映射与可映射的标准表头 */
  async listMappings(code: string, user: JwtUser): Promise<{
    code: string
    headers: string[]
    mappings: Array<{ sourceHeader: string; targetHeader: string }>
  }> {
    const config = await this.resolveConfig(code, user)
    const rows = await this.dataSource.getRepository(IoImportMappingEntity).find({
      where: { tenantId: user.tenantId, code },
      order: { id: 'ASC' }
    })
    return {
      code,
      headers: config.fields.map((field) => field.header),
      mappings: rows.map((row) => ({ sourceHeader: row.sourceHeader, targetHeader: row.targetHeader }))
    }
  }

  /** 保存字段映射（整体覆盖），写审计 */
  async saveMappings(code: string, mappings: Array<{ sourceHeader: string; targetHeader: string }>, user: JwtUser): Promise<{
    code: string
    mappings: Array<{ sourceHeader: string; targetHeader: string }>
  }> {
    const config = await this.resolveConfig(code, user)
    const validHeaders = new Set(config.fields.map((field) => field.header))
    for (const mapping of mappings) {
      if (!mapping.sourceHeader?.trim()) throw new BadRequestException('映射项缺少来源列名')
      if (!validHeaders.has(mapping.targetHeader)) throw new BadRequestException(`目标列名不属于模板：${mapping.targetHeader}`)
    }
    const repo = this.dataSource.getRepository(IoImportMappingEntity)
    await repo.delete({ tenantId: user.tenantId, code })
    for (const mapping of mappings) {
      await repo.save(repo.create({
        tenantId: user.tenantId,
        code,
        sourceHeader: mapping.sourceHeader.trim(),
        targetHeader: mapping.targetHeader,
        createdBy: user.userId
      }))
    }
    await this.auditService.record({ bizType: 'io_import_mapping', bizId: 0, action: 'SAVE_MAPPING', afterValue: { code, mappings } }, user)
    return { code, mappings: mappings.map((m) => ({ sourceHeader: m.sourceHeader.trim(), targetHeader: m.targetHeader })) }
  }

  /**
   * 事务导入：先整体校验，错误行不写入业务表；全批通过后在单事务内写入。
   * - mode=STRICT（默认）：存在错误行时整批拒绝，错误行写入错误行表供修正后重导。
   * - mode=SKIP_INVALID：只导入正确行，错误行写入错误行表，业务数据不受影响。
   * 自定义字段列（custom.字段标识）会随主表一起写入自定义字段取值表。
   */
  async import(code: string, csvText: string, user: JwtUser, options?: { skipInvalid?: boolean }): Promise<{
    code: string
    batchNo: string
    total: number
    imported: number
    skipped: number
    issues: ImportPreview['issues']
  }> {
    const config = await this.resolveConfig(code, user)
    const target = ENTITY_TARGETS[code]
    if (!target) throw new BadRequestException(`资源 ${code} 未接入导入写入`)
    const skipInvalid = options?.skipInvalid === true
    const batchNo = `IMP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 8).toUpperCase()}`

    const previewResult = buildImportPreview(config, await this.applySavedMapping(code, csvText, user))
    if (previewResult.total === 0) throw new BadRequestException('无有效数据行')

    const task = await this.createImportTask(code, batchNo, skipInvalid ? 'SKIP_INVALID' : 'STRICT', user)
    // 错误行统一落错误行表，便于下载错误报告与修正后重导
    await this.persistImportErrors(code, batchNo, csvText, previewResult.issues, user)

    if (previewResult.valid === 0) {
      await this.finishImportTask(task, 'FAILED', previewResult.total, 0, previewResult.invalid, previewResult.invalid)
      await this.auditService.record({ bizType: 'io_import', bizId: 0, action: 'IMPORT_REJECTED', afterValue: { code, batchNo, issues: previewResult.issues } }, user)
      return { code, batchNo, total: previewResult.total, imported: 0, skipped: previewResult.invalid, issues: previewResult.issues }
    }
    if (previewResult.invalid > 0 && !skipInvalid) {
      await this.finishImportTask(task, 'FAILED', previewResult.total, 0, previewResult.invalid, previewResult.invalid)
      await this.auditService.record({ bizType: 'io_import', bizId: 0, action: 'IMPORT_REJECTED', afterValue: { code, batchNo, issues: previewResult.issues } }, user)
      return { code, batchNo, total: previewResult.total, imported: 0, skipped: previewResult.invalid, issues: previewResult.issues }
    }

    let imported = 0
    let skipped = 0
    const customValuesByBizId: Array<{ bizId: number; values: Record<string, unknown> }> = []

    await this.dataSource.transaction(async (manager) => {
      const txRepo = manager.getRepository<ObjectLiteral>(target)
      for (const row of previewResult.rows) {
        const existing = config.uniqueKeys?.length
          ? await txRepo.findOne({ where: this.buildLookup(config.uniqueKeys, this.splitCustomKeys(row).values, user.tenantId) })
          : null
        if (existing && !config.upsert) {
          skipped++
          continue
        }
        const split = this.splitCustomKeys(row)
        const payload = {
          ...split.values,
          tenantId: user.tenantId,
          createdBy: user.userId,
          isDeleted: 0,
          ...(existing ? { id: existing.id } : {})
        }
        const saved = await txRepo.save(payload)
        imported++
        if (split.customValues && Object.keys(split.customValues).length > 0) {
          customValuesByBizId.push({ bizId: Number(saved.id), values: split.customValues })
        }
      }
    })

    // 自定义字段取值单独落库（校验失败不影响主流程一致性，写入失败记录审计）
    if (config.entityCode) {
      for (const item of customValuesByBizId) {
        try {
          await this.customFieldService.saveValues(config.entityCode, item.bizId, { values: item.values }, user)
        } catch (cause) {
          await this.auditService.record({
            bizType: 'io_import',
            bizId: item.bizId,
            action: 'IMPORT_CUSTOM_VALUE_FAILED',
            afterValue: { code, batchNo, reason: cause instanceof Error ? cause.message : String(cause) }
          }, user)
        }
      }
    }

    const status = previewResult.invalid > 0 ? 'PARTIAL' : 'SUCCESS'
    await this.finishImportTask(task, status, previewResult.total, imported, skipped, previewResult.invalid)
    await this.auditService.record(
      { bizType: 'io_import', bizId: 0, action: 'IMPORT_COMMIT', afterValue: { code, batchNo, total: previewResult.total, imported, skipped } },
      user
    )
    return { code, batchNo, total: previewResult.total, imported, skipped, issues: previewResult.issues }
  }

  /** 拆出自定义字段取值（custom.* 键不写入业务表字段） */
  private splitCustomKeys(row: MappedRow): { values: MappedRow; customValues: Record<string, unknown> } {
    const values: MappedRow = {}
    const customValues: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row)) {
      if (key.startsWith(CUSTOM_VALUE_KEY_PREFIX)) {
        customValues[key.slice(CUSTOM_VALUE_KEY_PREFIX.length)] = value
        continue
      }
      values[key] = value
    }
    return { values, customValues }
  }

  /** 登记导入批次任务 */
  private async createImportTask(code: string, batchNo: string, mode: string, user: JwtUser): Promise<IoImportTaskEntity> {
    const repo = this.dataSource.getRepository(IoImportTaskEntity)
    const task = repo.create({
      tenantId: user.tenantId,
      code,
      batchNo,
      status: 'RUNNING',
      mode,
      createdBy: user.userId
    })
    return repo.save(task)
  }

  /** 更新导入批次结果 */
  private async finishImportTask(
    task: IoImportTaskEntity,
    status: string,
    total: number,
    imported: number,
    skipped: number,
    errorRows: number
  ): Promise<void> {
    const repo = this.dataSource.getRepository(IoImportTaskEntity)
    task.status = status
    task.totalRows = total
    task.importedRows = imported
    task.skippedRows = skipped
    task.errorRows = errorRows
    task.finishedAt = new Date()
    await repo.save(task)
  }

  /** 错误行落库：记录行号、列名、原因与原始数据 */
  private async persistImportErrors(
    code: string,
    batchNo: string,
    csvText: string,
    issues: ImportPreview['issues'],
    user: JwtUser
  ): Promise<void> {
    if (!issues.length) return
    const repo = this.dataSource.getRepository(IoImportErrorEntity)
    const rows = parseCsvTable(csvText).rows
    for (const issue of issues) {
      await repo.save(repo.create({
        tenantId: user.tenantId,
        code,
        batchNo,
        rowNo: issue.row,
        fieldName: issue.field,
        message: issue.message,
        rowData: issue.row > 0 ? rows[issue.row - 2] ?? null : null,
        createdBy: user.userId
      }))
    }
  }

  /** 查询导入批次列表 */
  async listImportTasks(query: { page?: number; pageSize?: number; code?: string }, user: JwtUser): Promise<PageResult<IoImportTaskEntity>> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const where: FindOptionsWhere<IoImportTaskEntity> = { tenantId: user.tenantId }
    if (query.code) where.code = query.code
    const [list, total] = await this.dataSource.getRepository(IoImportTaskEntity).findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
    return buildPageResult(list, total, page, pageSize)
  }

  /** 查询导入错误行明细 */
  async listImportErrors(
    query: { page?: number; pageSize?: number; code?: string; batchNo?: string },
    user: JwtUser
  ): Promise<PageResult<IoImportErrorEntity>> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const where: FindOptionsWhere<IoImportErrorEntity> = { tenantId: user.tenantId }
    if (query.code) where.code = query.code
    if (query.batchNo) where.batchNo = query.batchNo
    const [list, total] = await this.dataSource.getRepository(IoImportErrorEntity).findAndCount({
      where,
      order: { id: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
    return buildPageResult(list, total, page, pageSize)
  }

  /** 导出错误报告（CSV） */
  async exportImportErrors(code: string, batchNo: string, user: JwtUser): Promise<{ filename: string; content: string }> {
    const rows = await this.dataSource.getRepository(IoImportErrorEntity).find({
      where: { tenantId: user.tenantId, code, batchNo },
      order: { id: 'ASC' }
    })
    const matrix: Array<Array<string | number>> = [
      ['行号', '列名', '错误原因', '原始数据'],
      ...rows.map((row) => [
        row.rowNo,
        row.fieldName ?? '',
        row.message,
        row.rowData ? JSON.stringify(row.rowData) : ''
      ])
    ]
    return { filename: `${code}-${batchNo}-errors.csv`, content: encodeCsv(matrix, { bom: true }) }
  }

  /** 同步导出：查询数据后生成带 BOM 的 CSV，并留审计 */
  async export<T extends Record<string, unknown>>(
    config: ExportConfig<T>,
    rows: T[],
    user: JwtUser
  ): Promise<{ filename: string; content: string }> {
    const matrix = [
      config.fields.map((f) => f.header),
      ...rows.map((row) =>
        config.fields.map((f) => {
          const value = f.format ? f.format(row[f.key] as unknown, row) : (row[f.key] ?? '')
          return value == null ? '' : String(value)
        })
      )
    ]
    const watermarkOptions = await this.configService.getExportWatermarkOptions(user.tenantId)
    const content = encodeCsv(appendWatermark(matrix.map(sanitizeExportRow), buildCsvWatermark(user), watermarkOptions), { bom: true })
    await this.auditService.record(
      { bizType: 'io_export', bizId: 0, action: 'EXPORT', afterValue: { code: config.code, rows: rows.length, watermark: buildCsvWatermark(user).code } },
      user
    )
    return { filename: `${config.code}-${Date.now()}.csv`, content }
  }

  /**
   * 生成资源导出内容（带水印与导出脱敏），供同步导出与异步导出任务共用。
   * 异步导出（export_task）复用同一实现，保证「同步/异步」口径一致。
   */
  async exportResource(code: string, user: JwtUser): Promise<{ filename: string; content: string; rowCount: number }> {
    const matrix = await this.loadExportRows(code, user.tenantId, user)
    const watermarkOptions = await this.configService.getExportWatermarkOptions(user.tenantId)
    const content = encodeCsv(
      appendWatermark(matrix.map(sanitizeExportRow), buildCsvWatermark(user), watermarkOptions),
      { bom: true }
    )
    return { filename: `${code}-${Date.now()}.csv`, content, rowCount: Math.max(matrix.length - 1, 0) }
  }

  /** 创建异步导出任务（记录任务，实际生成由 worker 消费；此处置为 PENDING） */
  async createExportJob(code: string, user: JwtUser): Promise<IoJobEntity> {
    const job = this.dataSource.getRepository(IoJobEntity).create({
      tenantId: user.tenantId,
      code,
      type: 'EXPORT',
      status: 'PENDING',
      createdBy: user.userId,
      scopeJson: JSON.stringify(this.buildScopeSnapshot(user))
    })
    const saved = await this.dataSource.getRepository(IoJobEntity).save(job)
    await this.auditService.record({ bizType: 'io_job', bizId: saved.id, action: 'CREATE_EXPORT_JOB', afterValue: saved }, user)
    return saved
  }

  /** 查询导出任务状态（按租户隔离） */
  async listJobs(query: { page?: number; pageSize?: number }, user: JwtUser): Promise<PageResult<IoJobEntity>> {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const [list, total] = await this.dataSource.getRepository(IoJobEntity).findAndCount({
      where: { tenantId: user.tenantId },
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
    return buildPageResult(list, total, page, pageSize)
  }

  /** 获取已完成任务生成的 CSV 内容（按租户隔离） */
  async jobContent(id: number, user: JwtUser): Promise<string> {
    const job = await this.dataSource.getRepository(IoJobEntity).findOne({ where: { id, tenantId: user.tenantId } })
    if (!job) throw new NotFoundException('导出任务不存在')
    if (job.status !== 'DONE' || !job.content) throw new BadRequestException('导出任务尚未完成')
    return job.content
  }

  private buildLookup(keys: string[], row: MappedRow, tenantId: number): FindOptionsWhere<ObjectLiteral> {
    const where: FindOptionsWhere<ObjectLiteral> = { tenantId }
    for (const key of keys) where[key] = row[key]
    return where
  }

  private buildScopeSnapshot(user: JwtUser): ExportScopeSnapshot {
    const scope = currentScope()
    return {
      level: scope?.level ?? user.dataScopeLevel ?? DATA_SCOPE_LEVEL.SELF,
      orgId: scope?.orgId ?? user.orgId,
      ...(scope?.orgField ? { orgField: scope.orgField } : {}),
      ...(scope?.childOrgIds ? { childOrgIds: scope.childOrgIds } : {})
    }
  }

  private parseScopeSnapshot(raw: string | null): ExportScopeSnapshot | undefined {
    if (!raw) return undefined
    try {
      const parsed = JSON.parse(raw) as Partial<ExportScopeSnapshot>
      if (!parsed.level) return undefined
      return {
        level: parsed.level,
        orgId: parsed.orgId ?? null,
        ...(parsed.orgField ? { orgField: parsed.orgField } : {}),
        ...(parsed.childOrgIds ? { childOrgIds: parsed.childOrgIds } : {})
      }
    } catch {
      return undefined
    }
  }

  /** 任务执行时的用户身份：无快照时按 SELF 处理，绝不默认超管 */
  private actorFromScope(tenantId: number, userId: number, raw: string | null): JwtUser {
    const snapshot = this.parseScopeSnapshot(raw)
    return {
      userId,
      tenantId,
      username: 'export-worker',
      realName: '导出任务',
      orgId: snapshot?.orgId ?? null,
      roles: [],
      permissions: [],
      isSuperAdmin: false,
      dataScopeLevel: snapshot?.level ?? DATA_SCOPE_LEVEL.SELF
    }
  }
}
