/**
 * 备份策略与恢复规则层（纯函数，供系统备份模块与测试复用）。
 * 设计原则：备份策略只描述"怎么做"，执行细节在服务层；恢复默认走演练模式，避免误操作生产库。
 */

/** 备份类型 */
export type BackupType = 'FULL' | 'INCREMENTAL'
/** 恢复模式 */
export type RestoreMode = 'DRY_RUN' | 'FULL'

export interface BackupPolicyInput {
  policyCode: string
  backupType: BackupType
  /** 触发间隔（分钟） */
  intervalMinutes: number
  /** 保留天数 */
  retentionDays: number
  /** 本地存储目录 */
  storagePath: string
  /** 是否同时推送到异地存储 */
  remoteEnabled: boolean
  enabled: boolean
}

export interface BackupDueInput {
  enabled: boolean
  intervalMinutes: number
  lastRunAt: Date | string | null
}

export interface BackupRecordLike {
  id: number
  status: string
  filePath: string | null
  finishedAt: Date | string | null
  createdAt?: Date | string | null
}

export interface RestoreRequestInput {
  mode: RestoreMode
  backupStatus: string
  fileExists: boolean
  /** 目标环境标识：必须与当前环境一致才允许真实恢复 */
  targetEnv: string
  currentEnv: string
  /** 是否二次确认 */
  confirmed: boolean
}

export interface RuleResult {
  ok: boolean
  reason?: string
}

/** 生成备份文件名：库名-类型-时间戳.sql.gz */
export function buildBackupFileName(database: string, type: BackupType, at: Date = new Date()): string {
  const stamp = at.toISOString().replace(/[:.]/g, '-')
  const kind = type === 'INCREMENTAL' ? 'inc' : 'full'
  return `${database}-${kind}-${stamp}.sql.gz`
}

/** 策略是否到期需要执行 */
export function isBackupDue(input: BackupDueInput, now: Date = new Date()): boolean {
  if (!input.enabled) return false
  if (input.intervalMinutes <= 0) return false
  if (!input.lastRunAt) return true
  const last = new Date(input.lastRunAt).getTime()
  if (Number.isNaN(last)) return true
  return now.getTime() - last >= input.intervalMinutes * 60 * 1000
}

/** 校验备份策略参数 */
export function validateBackupPolicy(input: BackupPolicyInput): RuleResult {
  if (!input.policyCode?.trim()) return { ok: false, reason: '策略编码不能为空' }
  if (input.backupType !== 'FULL' && input.backupType !== 'INCREMENTAL') return { ok: false, reason: '备份类型不支持' }
  if (!Number.isFinite(input.intervalMinutes) || input.intervalMinutes < 5) return { ok: false, reason: '备份间隔不得小于 5 分钟' }
  if (!Number.isFinite(input.retentionDays) || input.retentionDays < 1) return { ok: false, reason: '保留天数必须大于 0' }
  if (!input.storagePath?.trim()) return { ok: false, reason: '存储目录不能为空' }
  return { ok: true }
}

/** 增量备份依赖 MySQL binlog，未开启时不允许静默降级为全量 */
export function evaluateIncrementalSupport(binlogEnabled: boolean): RuleResult {
  if (!binlogEnabled) {
    return { ok: false, reason: '增量备份需要开启 MySQL binlog，当前实例未开启，请改用全量备份或联系 DBA 开启 binlog' }
  }
  return { ok: true }
}

/** 计算需要清理的过期备份记录（按保留天数） */
export function resolveRetention(
  records: BackupRecordLike[],
  retentionDays: number,
  now: Date = new Date()
): { expiredIds: number[]; expiredPaths: string[]; keptCount: number } {
  const deadline = now.getTime() - retentionDays * 24 * 60 * 60 * 1000
  const expiredIds: number[] = []
  const expiredPaths: string[] = []
  let keptCount = 0
  for (const record of records) {
    if (record.status !== 'SUCCESS') continue
    const time = new Date(record.finishedAt ?? record.createdAt ?? 0).getTime()
    if (time < deadline) {
      expiredIds.push(record.id)
      if (record.filePath) expiredPaths.push(record.filePath)
    } else {
      keptCount += 1
    }
  }
  return { expiredIds, expiredPaths, keptCount }
}

/** 恢复请求校验：默认演练，真实恢复需环境一致 + 显式确认 */
export function evaluateRestoreRequest(input: RestoreRequestInput): RuleResult {
  if (input.backupStatus !== 'SUCCESS') return { ok: false, reason: '仅成功备份可用于恢复' }
  if (!input.fileExists) return { ok: false, reason: '备份文件不存在，无法恢复' }
  if (input.mode === 'DRY_RUN') return { ok: true }
  if (!input.confirmed) return { ok: false, reason: '真实恢复必须二次确认' }
  if (input.targetEnv !== input.currentEnv) {
    return { ok: false, reason: `目标环境 ${input.targetEnv} 与当前环境 ${input.currentEnv} 不一致，拒绝执行真实恢复` }
  }
  return { ok: true }
}

/** 备份覆盖度统计：最近备份时间、覆盖时长、失败次数与风险等级 */
export function summarizeBackupCoverage(
  records: BackupRecordLike[],
  now: Date = new Date(),
  maxGapHours = 48
): {
  latestBackupAt: string | null
  coverageHours: number
  successCount: number
  failedCount: number
  riskLevel: 'HEALTHY' | 'WARNING' | 'CRITICAL'
} {
  const success = records.filter((item) => item.status === 'SUCCESS')
  const failed = records.filter((item) => item.status === 'FAILED')
  const latest = success
    .map((item) => new Date(item.finishedAt ?? item.createdAt ?? 0).getTime())
    .filter((time) => !Number.isNaN(time))
    .sort((a, b) => b - a)[0]
  const coverageHours = latest ? Math.round(((now.getTime() - latest) / 3_600_000) * 10) / 10 : Number.POSITIVE_INFINITY
  let riskLevel: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY'
  if (!latest || coverageHours > maxGapHours * 2) riskLevel = 'CRITICAL'
  else if (coverageHours > maxGapHours) riskLevel = 'WARNING'
  if (failed.length > 0 && riskLevel === 'HEALTHY') riskLevel = 'WARNING'
  return {
    latestBackupAt: latest ? new Date(latest).toISOString() : null,
    coverageHours: Number.isFinite(coverageHours) ? coverageHours : 99999,
    successCount: success.length,
    failedCount: failed.length,
    riskLevel
  }
}
