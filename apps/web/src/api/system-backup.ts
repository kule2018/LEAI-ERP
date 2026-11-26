import { request } from '@/utils/http'

const base = '/system/backup'

export interface BackupPolicy {
  id: number
  policyCode: string
  policyName: string
  backupType: string
  intervalMinutes: number
  retentionDays: number
  storagePath: string
  remotePath: string | null
  remoteEnabled: number
  status: string
  lastRunAt: string | null
  lastResult: string | null
}

export interface BackupRecord {
  id: number
  backupNo: string
  policyCode: string
  backupType: string
  status: string
  fileName: string
  filePath: string | null
  fileSize: number
  durationMs: number
  errorMessage: string | null
  isOffsite: number
  startedAt: string | null
  finishedAt: string | null
}

export interface RestoreRecord {
  id: number
  restoreNo: string
  backupId: number
  backupNo: string
  restoreMode: string
  targetEnv: string
  status: string
  resultMessage: string | null
  operatorNote: string | null
  startedAt: string | null
  finishedAt: string | null
}

export interface BackupSummary {
  latestBackupAt: string | null
  coverageHours: number
  successCount: number
  failedCount: number
  riskLevel: string
  policyCount: number
  enabledPolicyCount: number
  totalSize: number
}

export interface BackupPolicyPayload {
  policyCode?: string
  policyName?: string
  backupType?: string
  intervalMinutes?: number
  retentionDays?: number
  storagePath?: string
  remotePath?: string
  remoteEnabled?: boolean
}

export function fetchBackupPolicies() {
  return request<BackupPolicy[]>({ url: `${base}/policies`, method: 'get' })
}
export function createBackupPolicy(data: BackupPolicyPayload) {
  return request<BackupPolicy>({ url: `${base}/policies`, method: 'post', data })
}
export function updateBackupPolicy(id: number, data: BackupPolicyPayload) {
  return request<BackupPolicy>({ url: `${base}/policies/${id}`, method: 'put', data })
}
export function toggleBackupPolicy(id: number) {
  return request<BackupPolicy>({ url: `${base}/policies/${id}/toggle`, method: 'post' })
}
export function fetchBackupRecords(params: { page?: number; pageSize?: number; status?: string }) {
  return request<{ list: BackupRecord[]; total: number }>({ url: `${base}/records`, method: 'get', params })
}
export function fetchBackupSummary() {
  return request<BackupSummary>({ url: `${base}/summary`, method: 'get' })
}
export function executeBackup(data: { policyId?: number; backupType?: string }) {
  return request<BackupRecord>({ url: `${base}/execute`, method: 'post', data })
}
export function fetchRestoreRecords() {
  return request<{ list: RestoreRecord[]; total: number }>({ url: `${base}/restores`, method: 'get' })
}
export function createRestore(data: { backupId: number; restoreMode?: string; targetEnv?: string; confirmed?: boolean; operatorNote?: string }) {
  return request<RestoreRecord>({ url: `${base}/restore`, method: 'post', data })
}
export function cleanupBackups() {
  return request<{ retentionDays: number; removed: number; removedFiles: number; keptCount: number }>({ url: `${base}/cleanup`, method: 'post' })
}