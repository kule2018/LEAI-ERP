/**
 * 劳动合同规则（纯函数）
 *
 * 产品文档要求：员工档案需支持「合同到期」提醒与劳动合同管理；
 * 规范要求：到期提醒可归集到提醒中心，续签/解除需留审计。
 */

/** 合同类型 */
export const CONTRACT_TYPES = ['FIXED', 'OPEN_ENDED', 'OUTSOURCE', 'INTERN', 'SERVICE'] as const
export type ContractType = (typeof CONTRACT_TYPES)[number]

/** 合同类型中文名 */
export const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  FIXED: '固定期限',
  OPEN_ENDED: '无固定期限',
  OUTSOURCE: '外包合同',
  INTERN: '实习协议',
  SERVICE: '劳务协议'
}

/** 合同状态 */
export const CONTRACT_STATUS = ['DRAFT', 'EFFECTIVE', 'EXPIRED', 'RENEWED', 'TERMINATED'] as const
export type ContractStatus = (typeof CONTRACT_STATUS)[number]

/** 默认到期提醒提前天数 */
export const DEFAULT_REMIND_DAYS = 30

/** 判断合同类型是否合法 */
export function isContractType(value: unknown): value is ContractType {
  return typeof value === 'string' && (CONTRACT_TYPES as readonly string[]).includes(value)
}

/**
 * 推导合同到期日：
 * - 固定期限：生效日 + 期限年数
 * - 无固定期限：无固定到期日
 * - 外包 / 实习 / 劳务：按约定月数计算
 */
export function deriveExpiryDate(
  contractType: ContractType,
  effectiveDate: string,
  duration?: number | null
): string | null {
  if (contractType === 'OPEN_ENDED') return null
  const base = new Date(`${effectiveDate.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(base.getTime())) return null
  if (contractType === 'FIXED') {
    const years = Number(duration ?? 0)
    if (!Number.isFinite(years) || years <= 0) return null
    base.setUTCFullYear(base.getUTCFullYear() + Math.floor(years))
    return base.toISOString().slice(0, 10)
  }
  const months = Number(duration ?? 0)
  if (!Number.isFinite(months) || months <= 0) return null
  base.setUTCMonth(base.getUTCMonth() + Math.floor(months))
  return base.toISOString().slice(0, 10)
}

export interface ContractEvaluateInput {
  /** 合同状态 */
  status: string
  /** 生效日期 */
  effectiveDate: string
  /** 到期日期（无固定期限可为空） */
  expiryDate?: string | null
  /** 解除日期 */
  terminateDate?: string | null
}

export interface ContractEvaluation {
  /** 生效中 */
  effective: boolean
  /** 已到期 */
  expired: boolean
  /** 即将到期（进入提醒窗口） */
  expiring: boolean
  /** 距到期天数（负数表示已过期天数） */
  daysLeft: number | null
  /** 建议状态 */
  suggestStatus: ContractStatus
}

/**
 * 评估合同状态：
 * - DRAFT 草稿不参与提醒
 * - TERMINATED / RENEWED 不参与提醒
 * - 到期日进入提醒窗口 → expiring
 */
export function evaluateContract(
  contract: ContractEvaluateInput,
  at: Date = new Date(),
  remindDays: number = DEFAULT_REMIND_DAYS
): ContractEvaluation {
  const atTime = at.getTime()
  if (contract.status === 'DRAFT') {
    return { effective: false, expired: false, expiring: false, daysLeft: null, suggestStatus: 'DRAFT' }
  }
  if (contract.status === 'TERMINATED' || contract.status === 'RENEWED') {
    return { effective: false, expired: false, expiring: false, daysLeft: null, suggestStatus: contract.status as ContractStatus }
  }
  if (!contract.expiryDate) {
    const effectiveStart = contract.effectiveDate
      ? new Date(`${contract.effectiveDate.slice(0, 10)}T00:00:00Z`).getTime()
      : Number.NaN
    const effective = Number.isFinite(effectiveStart) ? effectiveStart <= atTime : false
    return { effective, expired: false, expiring: false, daysLeft: null, suggestStatus: effective ? 'EFFECTIVE' : 'DRAFT' }
  }
  const expiry = new Date(`${contract.expiryDate.slice(0, 10)}T00:00:00Z`).getTime()
  if (!Number.isFinite(expiry)) {
    return { effective: false, expired: false, expiring: false, daysLeft: null, suggestStatus: 'DRAFT' }
  }
  const daysLeft = Math.ceil((expiry - atTime) / 86400000)
  const expired = daysLeft < 0
  const expiring = !expired && daysLeft <= remindDays
  const effectiveStart = contract.effectiveDate
    ? new Date(`${contract.effectiveDate.slice(0, 10)}T00:00:00Z`).getTime()
    : expiry
  const effective = Number.isFinite(effectiveStart) && effectiveStart <= atTime && !expired
  return {
    effective,
    expired,
    expiring,
    daysLeft,
    suggestStatus: expired ? 'EXPIRED' : effective ? 'EFFECTIVE' : 'DRAFT'
  }
}

/** 续签校验 */
export function canRenewContract(contract: ContractEvaluateInput): { allowed: boolean; reason: string } {
  if (contract.status === 'RENEWED') return { allowed: false, reason: '合同已续签，不可重复续签' }
  if (contract.status === 'TERMINATED') return { allowed: false, reason: '合同已解除，不可续签' }
  if (contract.status === 'DRAFT') return { allowed: false, reason: '草稿合同不可续签' }
  return { allowed: true, reason: '允许续签' }
}

/** 解除校验 */
export function canTerminateContract(contract: ContractEvaluateInput): { allowed: boolean; reason: string } {
  if (contract.status === 'TERMINATED') return { allowed: false, reason: '合同已解除，不可重复解除' }
  if (contract.status === 'DRAFT') return { allowed: false, reason: '草稿合同不可解除' }
  return { allowed: true, reason: '允许解除合同' }
}

/** 合同提醒条目 */
export interface ContractReminder {
  contractId: number
  contractNo: string
  employeeId: number
  employeeName: string
  contractType: string
  expiryDate: string
  daysLeft: number
  level: 'URGENT' | 'WARNING' | 'NORMAL'
  message: string
}

/**
 * 生成合同到期提醒：剩余天数 ≤ 7 天为紧急，≤ 提醒天数为预警，已过期同样提醒。
 */
export function buildContractReminder(
  contract: {
    id: number
    contractNo: string
    employeeId: number
    employeeName: string
    contractType: string
    expiryDate: string
    status: string
    effectiveDate: string
  },
  at: Date = new Date(),
  remindDays: number = DEFAULT_REMIND_DAYS
): ContractReminder | null {
  const evaluation = evaluateContract(
    { status: contract.status, effectiveDate: contract.effectiveDate, expiryDate: contract.expiryDate },
    at,
    remindDays
  )
  if (!evaluation.expiring && !evaluation.expired) return null
  const daysLeft = evaluation.daysLeft ?? 0
  const level: ContractReminder['level'] = daysLeft <= 7 ? 'URGENT' : daysLeft <= remindDays ? 'WARNING' : 'NORMAL'
  const message = evaluation.expired
    ? `劳动合同 ${contract.contractNo} 已于 ${contract.expiryDate} 到期（员工：${contract.employeeName}）`
    : `劳动合同 ${contract.contractNo} 将于 ${contract.expiryDate} 到期，剩余 ${daysLeft} 天（员工：${contract.employeeName}）`
  return {
    contractId: contract.id,
    contractNo: contract.contractNo,
    employeeId: contract.employeeId,
    employeeName: contract.employeeName,
    contractType: contract.contractType,
    expiryDate: contract.expiryDate,
    daysLeft,
    level,
    message
  }
}

/** 到期清单汇总 */
export interface ContractExpirySummary {
  /** 提醒窗口内合同数 */
  expiringCount: number
  /** 已到期未处理合同数 */
  expiredCount: number
  /** 紧急（≤7 天）合同数 */
  urgentCount: number
  /** 涉及员工数 */
  employeeCount: number
}

/** 汇总到期清单 */
export function summarizeContractExpiry(reminders: ContractReminder[]): ContractExpirySummary {
  const employeeIds = new Set(reminders.map((item) => item.employeeId))
  return {
    expiringCount: reminders.filter((item) => item.daysLeft >= 0).length,
    expiredCount: reminders.filter((item) => item.daysLeft < 0).length,
    urgentCount: reminders.filter((item) => item.level === 'URGENT').length,
    employeeCount: employeeIds.size
  }
}
