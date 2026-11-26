import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { copyFile, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { Repository } from 'typeorm'
import {
  evaluateIncrementalSupport,
  evaluateRestoreRequest,
  isBackupDue,
  resolveRetention,
  summarizeBackupCoverage,
  validateBackupPolicy
} from '../../common/backup-policy-rules'
import { buildPageResult, type JwtUser, type PageResult } from '../../common/contracts'
import { AuditService } from '../audit/audit.service'
import { SchedulerService } from '../ops/scheduler.service'
import { CreateBackupPolicyDto, CreateRestoreDto, ExecuteBackupDto, QueryBackupDto, UpdateBackupPolicyDto } from './dto'
import { SysBackupPolicyEntity, SysBackupRecordEntity, SysRestoreRecordEntity } from './entities/backup.entities'

/**
 * 备份策略与恢复服务：
 * - 策略：全量/增量、触发间隔、保留天数、本地与异地存储目录；
 * - 执行：复用 scripts/backup.mjs 完成逻辑备份，增量备份依赖 MySQL binlog，未开启直接失败而非静默降级；
 * - 恢复：默认演练模式（校验备份文件可读），真实恢复需环境一致并二次确认；
 * - 调度：注册到统一调度器，按策略间隔检查到期并执行。
 */
@Injectable()
export class SystemBackupService implements OnModuleInit {
  private readonly logger = new Logger(SystemBackupService.name)

  constructor(
    @InjectRepository(SysBackupPolicyEntity) private readonly policyRepo: Repository<SysBackupPolicyEntity>,
    @InjectRepository(SysBackupRecordEntity) private readonly recordRepo: Repository<SysBackupRecordEntity>,
    @InjectRepository(SysRestoreRecordEntity) private readonly restoreRepo: Repository<SysRestoreRecordEntity>,
    private readonly auditService: AuditService,
    private readonly scheduler: SchedulerService
  ) {}

  onModuleInit(): void {
    this.scheduler.register({
      code: 'system.backup',
      name: '数据库备份调度',
      intervalMinutes: 15,
      enabled: true,
      handler: async () => this.runDuePolicies()
    })
  }

  /* ---------------- 策略 ---------------- */

  async listPolicies(user: JwtUser): Promise<SysBackupPolicyEntity[]> {
    return this.policyRepo.find({ where: { tenantId: user.tenantId }, order: { id: 'ASC' } })
  }

  async createPolicy(dto: CreateBackupPolicyDto, user: JwtUser): Promise<SysBackupPolicyEntity> {
    const check = validateBackupPolicy({
      policyCode: dto.policyCode,
      backupType: dto.backupType as 'FULL' | 'INCREMENTAL',
      intervalMinutes: dto.intervalMinutes,
      retentionDays: dto.retentionDays,
      storagePath: dto.storagePath,
      remoteEnabled: dto.remoteEnabled ?? false,
      enabled: true
    })
    if (!check.ok) throw new Error(check.reason ?? '备份策略参数不合法')
    const existed = await this.policyRepo.findOne({ where: { tenantId: user.tenantId, policyCode: dto.policyCode } })
    if (existed) throw new Error(`备份策略编码已存在：${dto.policyCode}`)
    const policy = await this.policyRepo.save(this.policyRepo.create({
      tenantId: user.tenantId,
      policyCode: dto.policyCode,
      policyName: dto.policyName,
      backupType: dto.backupType,
      intervalMinutes: dto.intervalMinutes,
      retentionDays: dto.retentionDays,
      storagePath: dto.storagePath,
      remotePath: dto.remotePath ?? null,
      remoteEnabled: dto.remoteEnabled ? 1 : 0,
      status: 'ENABLED',
      createdBy: user.userId
    }))
    await this.auditService.record({ bizType: 'sys_backup_policy', bizId: policy.id, action: 'CREATE_BACKUP_POLICY', afterValue: policy }, user)
    return policy
  }

  async updatePolicy(id: number, dto: UpdateBackupPolicyDto, user: JwtUser): Promise<SysBackupPolicyEntity> {
    const policy = await this.policyRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!policy) throw new Error('备份策略不存在')
    if (dto.policyName) policy.policyName = dto.policyName
    if (dto.backupType) policy.backupType = dto.backupType
    if (dto.intervalMinutes) policy.intervalMinutes = dto.intervalMinutes
    if (dto.retentionDays) policy.retentionDays = dto.retentionDays
    if (dto.storagePath) policy.storagePath = dto.storagePath
    if (dto.remotePath !== undefined) policy.remotePath = dto.remotePath
    if (dto.remoteEnabled !== undefined) policy.remoteEnabled = dto.remoteEnabled ? 1 : 0
    if (dto.status) policy.status = dto.status
    const saved = await this.policyRepo.save(policy)
    await this.auditService.record({ bizType: 'sys_backup_policy', bizId: id, action: 'UPDATE_BACKUP_POLICY', afterValue: saved }, user)
    return saved
  }

  async togglePolicy(id: number, user: JwtUser): Promise<SysBackupPolicyEntity> {
    const policy = await this.policyRepo.findOne({ where: { id, tenantId: user.tenantId } })
    if (!policy) throw new Error('备份策略不存在')
    policy.status = policy.status === 'ENABLED' ? 'DISABLED' : 'ENABLED'
    const saved = await this.policyRepo.save(policy)
    await this.auditService.record({ bizType: 'sys_backup_policy', bizId: id, action: 'TOGGLE_BACKUP_POLICY', afterValue: { status: saved.status } }, user)
    return saved
  }

  /* ---------------- 备份记录 ---------------- */

  async listRecords(query: QueryBackupDto, user: JwtUser): Promise<PageResult<SysBackupRecordEntity>> {
    const where: Record<string, unknown> = { tenantId: user.tenantId }
    if (query.status) where.status = query.status
    if (query.backupType) where.backupType = query.backupType
    if (query.policyCode) where.policyCode = query.policyCode
    const [list, total] = await this.recordRepo.findAndCount({
      where: where as never,
      order: { id: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize
    })
    return buildPageResult(list, total, query.page, query.pageSize)
  }

  /** 备份覆盖度与失败统计（用于运维面板） */
  async summary(user: JwtUser): Promise<Record<string, unknown>> {
    const records = await this.recordRepo.find({ where: { tenantId: user.tenantId }, order: { id: 'DESC' }, take: 200 })
    const coverage = summarizeBackupCoverage(records)
    const policies = await this.policyRepo.find({ where: { tenantId: user.tenantId } })
    return {
      ...coverage,
      policyCount: policies.length,
      enabledPolicyCount: policies.filter((item) => item.status === 'ENABLED').length,
      totalSize: records.reduce((sum, item) => sum + Number(item.fileSize ?? 0), 0)
    }
  }

  /** 立即执行一次备份 */
  async execute(dto: ExecuteBackupDto, user: JwtUser): Promise<SysBackupRecordEntity> {
    const policy = dto.policyId
      ? await this.policyRepo.findOne({ where: { id: dto.policyId, tenantId: user.tenantId } })
      : await this.policyRepo.findOne({ where: { tenantId: user.tenantId, status: 'ENABLED' }, order: { id: 'ASC' } })
    const backupType = (dto.backupType ?? policy?.backupType ?? 'FULL') as 'FULL' | 'INCREMENTAL'
    const storagePath = policy?.storagePath ?? path.resolve(process.cwd(), 'backups')
    const record = await this.recordRepo.save(this.recordRepo.create({
      tenantId: user.tenantId,
      backupNo: this.number('BAK'),
      policyId: policy?.id ?? null,
      policyCode: policy?.policyCode ?? 'MANUAL',
      backupType,
      status: 'RUNNING',
      startedAt: new Date(),
      operatorId: user.userId
    }))
    const startedAt = Date.now()
    try {
      if (backupType === 'INCREMENTAL') {
        const support = evaluateIncrementalSupport(await this.binlogEnabled())
        if (!support.ok) throw new Error(support.reason ?? '增量备份不可用')
      }
      const filePath = await this.runBackupScript(storagePath)
      const stat = statSync(filePath)
      let isOffsite = 0
      if (policy?.remoteEnabled && policy.remotePath) {
        await mkdir(policy.remotePath, { recursive: true })
        await copyFile(filePath, path.join(policy.remotePath, path.basename(filePath)))
        isOffsite = 1
      }
      record.status = 'SUCCESS'
      record.fileName = path.basename(filePath)
      record.filePath = filePath
      record.fileSize = stat.size
      record.durationMs = Date.now() - startedAt
      record.isOffsite = isOffsite
      record.finishedAt = new Date()
      await this.recordRepo.save(record)
      if (policy) {
        policy.lastRunAt = record.finishedAt
        policy.lastResult = `SUCCESS ${record.fileName}`
        await this.policyRepo.save(policy)
      }
      await this.auditService.record({
        bizType: 'sys_backup_record', bizId: record.id, action: 'EXECUTE_BACKUP',
        afterValue: { backupNo: record.backupNo, fileName: record.fileName, fileSize: record.fileSize, isOffsite }
      }, user)
      return record
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      record.status = 'FAILED'
      record.errorMessage = message.slice(0, 500)
      record.durationMs = Date.now() - startedAt
      record.finishedAt = new Date()
      await this.recordRepo.save(record)
      if (policy) {
        policy.lastRunAt = record.finishedAt
        policy.lastResult = `FAILED: ${message.slice(0, 200)}`
        await this.policyRepo.save(policy)
      }
      await this.auditService.record({
        bizType: 'sys_backup_record', bizId: record.id, action: 'EXECUTE_BACKUP',
        afterValue: { backupNo: record.backupNo, error: message.slice(0, 300) }
      }, user)
      throw new Error(message)
    }
  }

  /* ---------------- 恢复 ---------------- */

  async listRestores(user: JwtUser): Promise<PageResult<SysRestoreRecordEntity>> {
    const [list, total] = await this.restoreRepo.findAndCount({
      where: { tenantId: user.tenantId },
      order: { id: 'DESC' },
      skip: 0,
      take: 100
    })
    return buildPageResult(list, total, 1, 100)
  }

  /** 创建并执行恢复单：默认演练模式，真实恢复需二次确认 */
  async restore(dto: CreateRestoreDto, user: JwtUser): Promise<SysRestoreRecordEntity> {
    const backup = await this.recordRepo.findOne({ where: { id: dto.backupId, tenantId: user.tenantId } })
    if (!backup) throw new Error('备份记录不存在')
    const mode = dto.restoreMode ?? 'DRY_RUN'
    const filePath = backup.filePath ?? ''
    const fileExists = filePath ? existsSync(filePath) : false
    const check = evaluateRestoreRequest({
      mode: mode as 'DRY_RUN' | 'FULL',
      backupStatus: backup.status,
      fileExists,
      targetEnv: dto.targetEnv ?? this.currentEnv(),
      currentEnv: this.currentEnv(),
      confirmed: dto.confirmed ?? false
    })
    const record = await this.restoreRepo.save(this.restoreRepo.create({
      tenantId: user.tenantId,
      restoreNo: this.number('RST'),
      backupId: backup.id,
      backupNo: backup.backupNo,
      restoreMode: mode,
      targetEnv: dto.targetEnv ?? this.currentEnv(),
      status: 'PENDING',
      operatorNote: dto.operatorNote ?? null,
      operatorId: user.userId,
      startedAt: new Date()
    }))
    if (!check.ok) {
      record.status = 'FAILED'
      record.resultMessage = (check.reason ?? '恢复校验未通过').slice(0, 500)
      record.finishedAt = new Date()
      await this.restoreRepo.save(record)
      await this.auditService.record({
        bizType: 'sys_restore_record', bizId: record.id, action: 'RESTORE_REJECTED',
        afterValue: { reason: record.resultMessage }
      }, user)
      throw new Error(record.resultMessage)
    }
    try {
      let message: string
      if (mode === 'DRY_RUN') {
        const readable = await this.verifyBackupFile(filePath)
        if (!readable) throw new Error('备份文件无法读取，可能已损坏')
        message = `恢复演练通过：${backup.backupNo}（${backup.fileName}），未写入数据库`
      } else {
        await this.runRestoreScript(filePath)
        message = `真实恢复完成：${backup.backupNo}`
      }
      record.status = 'SUCCESS'
      record.resultMessage = message.slice(0, 500)
      record.finishedAt = new Date()
      await this.restoreRepo.save(record)
      await this.auditService.record({
        bizType: 'sys_restore_record', bizId: record.id, action: mode === 'FULL' ? 'RESTORE_FULL' : 'RESTORE_DRY_RUN',
        afterValue: { restoreNo: record.restoreNo, backupNo: backup.backupNo, mode }
      }, user)
      return record
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      record.status = 'FAILED'
      record.resultMessage = message.slice(0, 500)
      record.finishedAt = new Date()
      await this.restoreRepo.save(record)
      await this.auditService.record({
        bizType: 'sys_restore_record', bizId: record.id, action: 'RESTORE_FAILED',
        afterValue: { restoreNo: record.restoreNo, error: message.slice(0, 300) }
      }, user)
      throw new Error(message)
    }
  }

  /* ---------------- 保留期清理 ---------------- */

  async cleanup(user: JwtUser): Promise<Record<string, unknown>> {
    const policies = await this.policyRepo.find({ where: { tenantId: user.tenantId } })
    const retentionDays = policies.length > 0 ? Math.min(...policies.map((item) => item.retentionDays)) : 30
    const records = await this.recordRepo.find({ where: { tenantId: user.tenantId }, order: { id: 'DESC' } })
    const { expiredIds, expiredPaths, keptCount } = resolveRetention(records, retentionDays)
    let removedFiles = 0
    for (const filePath of expiredPaths) {
      try {
        await rm(filePath, { force: true })
        removedFiles += 1
      } catch (cause) {
        this.logger.warn(`清理备份文件失败：${filePath} ${String(cause)}`)
      }
    }
    if (expiredIds.length > 0) {
      await this.recordRepo.delete(expiredIds.map((id) => ({ id, tenantId: user.tenantId })) as never)
    }
    await this.auditService.record({
      bizType: 'sys_backup_record', bizId: 0, action: 'CLEANUP_BACKUP',
      afterValue: { retentionDays, removed: expiredIds.length, removedFiles, keptCount }
    }, user)
    return { retentionDays, removed: expiredIds.length, removedFiles, keptCount }
  }

  /* ---------------- 内部实现 ---------------- */

  /** 调度器按策略间隔检查到期策略并执行 */
  async runDuePolicies(): Promise<string> {
    const policies = await this.policyRepo.find({ where: { status: 'ENABLED' } })
    const executed: string[] = []
    for (const policy of policies) {
      if (!isBackupDue({ enabled: policy.status === 'ENABLED', intervalMinutes: policy.intervalMinutes, lastRunAt: policy.lastRunAt })) continue
      const actor = this.systemActor(policy.tenantId)
      try {
        const record = await this.execute({ policyId: policy.id, backupType: policy.backupType }, actor)
        executed.push(`${policy.policyCode}:${record.backupNo}`)
      } catch (cause) {
        this.logger.error(`备份策略 ${policy.policyCode} 执行失败：${cause instanceof Error ? cause.message : String(cause)}`)
      }
    }
    return executed.length > 0 ? `EXECUTED ${executed.join(',')}` : 'NO_DUE_POLICY'
  }

  private systemActor(tenantId: number): JwtUser {
    return {
      userId: 0,
      tenantId,
      username: 'system.scheduler',
      realName: '系统调度',
      orgId: null,
      roles: ['SYSTEM'],
      permissions: [],
      isSuperAdmin: false,
      dataScopeLevel: 'ALL'
    }
  }

  private currentEnv(): string {
    return process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development'
  }

  /** 调用备份脚本，返回生成的备份文件绝对路径 */
  private async runBackupScript(storagePath: string): Promise<string> {
    await mkdir(storagePath, { recursive: true })
    const script = this.resolveScript('backup.mjs')
    const result = await this.runProcess(process.execPath, [script], { BACKUP_DIR: storagePath })
    if (result.code !== 0) throw new Error(result.stderr || `备份脚本执行失败（exit ${result.code}）`)
    const matched = result.stdout.match(/\[backup\]\s+(.+)/)
    const filePath = matched?.[1]?.trim()
    if (!filePath || !existsSync(filePath)) throw new Error('备份脚本未生成备份文件')
    return path.resolve(filePath)
  }

  /** 调用恢复脚本执行真实恢复 */
  private async runRestoreScript(filePath: string): Promise<void> {
    const script = this.resolveScript('restore.mjs')
    const result = await this.runProcess(process.execPath, [script, filePath], {})
    if (result.code !== 0) throw new Error(result.stderr || `恢复脚本执行失败（exit ${result.code}）`)
  }

  /** 校验 gzip 备份文件可读：读取文件头并尝试解压首块 */
  private async verifyBackupFile(filePath: string): Promise<boolean> {
    if (!filePath || !existsSync(filePath)) return false
    try {
      const { createReadStream } = await import('node:fs')
      const { createGunzip } = await import('node:zlib')
      await new Promise<void>((resolve, reject) => {
        const stream = createReadStream(filePath).pipe(createGunzip())
        stream.once('data', () => { stream.destroy(); resolve() })
        stream.once('error', reject)
        stream.once('end', () => resolve())
      })
      return true
    } catch {
      return false
    }
  }

  /** 检测 MySQL 是否开启 binlog（增量备份前置条件） */
  private async binlogEnabled(): Promise<boolean> {
    try {
      const rows = await this.recordRepo.query('SHOW BINARY LOGS')
      return Array.isArray(rows) && rows.length > 0
    } catch {
      return false
    }
  }

  /** 定位仓库 scripts 目录下的脚本文件 */
  private resolveScript(name: string): string {
    const candidates = [
      path.resolve(process.cwd(), 'scripts', name),
      path.resolve(process.cwd(), '..', '..', 'scripts', name),
      path.resolve(__dirname, '..', '..', '..', '..', '..', 'scripts', name)
    ]
    return candidates.find((item) => existsSync(item)) ?? candidates[0]
  }

  private runProcess(command: string, args: string[], env: Record<string, string>): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      const child = spawn(command, args, { env: { ...process.env, ...env } })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (chunk) => { stdout += String(chunk) })
      child.stderr.on('data', (chunk) => { stderr += String(chunk) })
      child.on('error', (cause) => resolve({ code: -1, stdout, stderr: stderr + cause.message }))
      child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }))
    })
  }

  /** 备份单号：BAK + 时间戳 */
  private number(prefix: string): string {
    return `${prefix}${new Date().toISOString().replace(/[:.]/g, '').replace('T', '').slice(0, 14)}`
  }
}
