import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildBackupFileName,
  evaluateIncrementalSupport,
  evaluateRestoreRequest,
  isBackupDue,
  resolveRetention,
  summarizeBackupCoverage,
  validateBackupPolicy
} from '../apps/server/dist/common/backup-policy-rules.js'

const basePolicy = {
  policyCode: 'daily-full',
  backupType: 'FULL',
  intervalMinutes: 1440,
  retentionDays: 30,
  storagePath: 'backups',
  remoteEnabled: false,
  enabled: true
}

test('备份策略参数校验', () => {
  assert.equal(validateBackupPolicy(basePolicy).ok, true)
  assert.equal(validateBackupPolicy({ ...basePolicy, intervalMinutes: 1 }).ok, false)
  assert.equal(validateBackupPolicy({ ...basePolicy, retentionDays: 0 }).ok, false)
  assert.equal(validateBackupPolicy({ ...basePolicy, storagePath: '' }).ok, false)
  assert.equal(validateBackupPolicy({ ...basePolicy, policyCode: ' ' }).ok, false)
})

test('备份文件名包含库名、类型与时间戳', () => {
  const name = buildBackupFileName('leaierp', 'FULL', new Date('2026-01-02T03:04:05.000Z'))
  assert.match(name, /^leaierp-full-.*\.sql\.gz$/)
})

test('备份到期判定：间隔未到不执行', () => {
  const now = new Date('2026-01-02T12:00:00.000Z')
  assert.equal(isBackupDue({ enabled: true, intervalMinutes: 60, lastRunAt: null }, now), true)
  assert.equal(isBackupDue({ enabled: true, intervalMinutes: 60, lastRunAt: new Date('2026-01-02T11:30:00.000Z') }, now), false)
  assert.equal(isBackupDue({ enabled: true, intervalMinutes: 60, lastRunAt: new Date('2026-01-02T10:00:00.000Z') }, now), true)
  assert.equal(isBackupDue({ enabled: false, intervalMinutes: 60, lastRunAt: null }, now), false)
})

test('增量备份必须开启 binlog', () => {
  assert.equal(evaluateIncrementalSupport(true).ok, true)
  assert.equal(evaluateIncrementalSupport(false).ok, false)
})

test('保留期清理只清理过期成功记录', () => {
  const now = new Date('2026-02-01T00:00:00.000Z')
  const records = [
    { id: 1, status: 'SUCCESS', filePath: 'a.sql.gz', finishedAt: '2026-01-01T00:00:00.000Z' },
    { id: 2, status: 'SUCCESS', filePath: 'b.sql.gz', finishedAt: '2026-01-31T00:00:00.000Z' },
    { id: 3, status: 'FAILED', filePath: null, finishedAt: '2025-12-01T00:00:00.000Z' }
  ]
  const result = resolveRetention(records, 30, now)
  assert.deepEqual(result.expiredIds, [1])
  assert.deepEqual(result.expiredPaths, ['a.sql.gz'])
  assert.equal(result.keptCount, 1)
})

test('恢复：默认演练通过，真实恢复需环境一致并确认', () => {
  const base = { backupStatus: 'SUCCESS', fileExists: true, targetEnv: 'prod', currentEnv: 'prod' }
  assert.equal(evaluateRestoreRequest({ ...base, mode: 'DRY_RUN', confirmed: false }).ok, true)
  assert.equal(evaluateRestoreRequest({ ...base, mode: 'FULL', confirmed: false }).ok, false)
  assert.equal(evaluateRestoreRequest({ ...base, mode: 'FULL', confirmed: true }).ok, true)
  assert.equal(evaluateRestoreRequest({ ...base, mode: 'FULL', confirmed: true, targetEnv: 'test' }).ok, false)
  assert.equal(evaluateRestoreRequest({ ...base, mode: 'DRY_RUN', confirmed: true, backupStatus: 'FAILED' }).ok, false)
  assert.equal(evaluateRestoreRequest({ ...base, mode: 'DRY_RUN', confirmed: true, fileExists: false }).ok, false)
})

test('备份覆盖度统计与风险等级', () => {
  const now = new Date('2026-02-01T00:00:00.000Z')
  const recent = summarizeBackupCoverage([{ id: 1, status: 'SUCCESS', filePath: 'a', finishedAt: '2026-01-31T20:00:00.000Z' }], now)
  assert.equal(recent.riskLevel, 'HEALTHY')
  const stale = summarizeBackupCoverage([{ id: 1, status: 'SUCCESS', filePath: 'a', finishedAt: '2026-01-01T00:00:00.000Z' }], now)
  assert.equal(stale.riskLevel, 'CRITICAL')
  const failed = summarizeBackupCoverage([
    { id: 1, status: 'SUCCESS', filePath: 'a', finishedAt: '2026-01-31T20:00:00.000Z' },
    { id: 2, status: 'FAILED', filePath: null, finishedAt: '2026-01-31T21:00:00.000Z' }
  ], now)
  assert.equal(failed.riskLevel, 'WARNING')
  assert.equal(failed.failedCount, 1)
})