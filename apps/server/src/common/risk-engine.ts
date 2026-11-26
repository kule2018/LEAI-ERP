/**
 * 风险预警纯逻辑引擎：把各业务域的原始数据转换为统一风险项。
 * 与持久层解耦，便于单元测试与规则扩展。
 */

export const RISK_TYPE = {
  CREDIT_OVER_LIMIT: 'CREDIT_OVER_LIMIT',
  STOCK_LOW: 'STOCK_LOW',
  AR_OVERDUE: 'AR_OVERDUE',
  APPROVAL_TIMEOUT: 'APPROVAL_TIMEOUT',
  SYNC_FAILED: 'SYNC_FAILED'
} as const

export type RiskType = (typeof RISK_TYPE)[keyof typeof RISK_TYPE]

export const RISK_SEVERITY = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
} as const

export type RiskSeverity = (typeof RISK_SEVERITY)[keyof typeof RISK_SEVERITY]

export interface RiskCandidate {
  type: RiskType
  bizType: string
  bizId: number
  severity: RiskSeverity
  title: string
  message: string
  evidence: Record<string, unknown>
  suggestion?: string
}

export interface CreditInput {
  customerId: number
  customerName: string
  creditLimit: string | number
  creditUsed: string | number
}

/** 风险判定阈值：可由统一告警规则表覆盖，默认值与历史口径一致 */
export interface RiskThresholdOptions {
  /** 信用超限进入高危的比例 */
  creditOverHighRatio?: number
  /** 库存低于安全线进入高危的比例 */
  stockCriticalRatio?: number
  /** 应收逾期进入中危的天数 */
  arMediumDays?: number
  /** 应收逾期进入高危的天数 */
  arHighDays?: number
}

/** 信用超限：额度 > 0 且已用 + 新增占用超过额度 */
export function detectCreditRisk(input: CreditInput, extraUsage = 0, options: RiskThresholdOptions = {}): RiskCandidate | null {
  const limit = Number(input.creditLimit) || 0
  const used = Number(input.creditUsed) || 0
  if (limit <= 0 || used + extraUsage <= limit) return null
  const over = used + extraUsage - limit
  const highRatio = options.creditOverHighRatio ?? 0.2
  return {
    type: RISK_TYPE.CREDIT_OVER_LIMIT,
    bizType: 'customer',
    bizId: input.customerId,
    severity: over > limit * highRatio ? RISK_SEVERITY.HIGH : RISK_SEVERITY.MEDIUM,
    title: `客户信用超限：${input.customerName}`,
    message: `额度 ${limit}，已占用 ${used}，超出 ${over.toFixed(2)}`,
    evidence: { customerId: input.customerId, creditLimit: limit, creditUsed: used, over: Number(over.toFixed(4)) },
    suggestion: '暂停新增授信单据，催收逾期款项或调整额度'
  }
}

export interface StockInput {
  productId: number
  warehouseId: number
  currentQty: string | number
  thresholdQty: string | number
}

/** 库存低于安全库存 */
export function detectStockRisk(input: StockInput, options: RiskThresholdOptions = {}): RiskCandidate | null {
  const current = Number(input.currentQty) || 0
  const threshold = Number(input.thresholdQty) || 0
  if (threshold <= 0 || current >= threshold) return null
  const criticalRatio = options.stockCriticalRatio ?? 0.5
  return {
    type: RISK_TYPE.STOCK_LOW,
    bizType: 'product',
    bizId: input.productId,
    severity: current <= threshold * criticalRatio ? RISK_SEVERITY.HIGH : RISK_SEVERITY.MEDIUM,
    title: `库存低于安全线（产品 ${input.productId}）`,
    message: `现有 ${current}，安全库存 ${threshold}`,
    evidence: { productId: input.productId, warehouseId: input.warehouseId, currentQty: current, thresholdQty: threshold },
    suggestion: '生成补货建议并确认采购需求'
  }
}

export interface ArInput {
  receivableId: number
  customerId: number
  amount: string | number
  receivedAmount: string | number
  dueDate: string | null
}

/** 逾期应收：到期日已过且未结清 */
export function detectArRisk(input: ArInput, now: Date = new Date(), options: RiskThresholdOptions = {}): RiskCandidate | null {
  if (!input.dueDate) return null
  const due = new Date(`${input.dueDate}T23:59:59`)
  if (Number.isNaN(due.getTime()) || due >= now) return null
  const balance = (Number(input.amount) || 0) - (Number(input.receivedAmount) || 0)
  if (balance <= 0) return null
  const overdueDays = Math.floor((now.getTime() - due.getTime()) / 86400000)
  const mediumDays = options.arMediumDays ?? 7
  const highDays = options.arHighDays ?? 30
  return {
    type: RISK_TYPE.AR_OVERDUE,
    bizType: 'receivable',
    bizId: input.receivableId,
    severity: overdueDays > highDays ? RISK_SEVERITY.HIGH : overdueDays > mediumDays ? RISK_SEVERITY.MEDIUM : RISK_SEVERITY.LOW,
    title: `应收逾期（客户 ${input.customerId}）`,
    message: `逾期 ${overdueDays} 天，未收余额 ${balance.toFixed(2)}`,
    evidence: { receivableId: input.receivableId, customerId: input.customerId, balance: Number(balance.toFixed(4)), overdueDays },
    suggestion: '生成催收计划并指派责任人'
  }
}

export interface TimeoutInput {
  instanceId: number
  bizType: string
  bizId: number
  dueAt: Date | null
  escalated?: number | boolean
}

/** 审批超时：已设置截止期且已过期，可传 escalated 标记避免重复 */
export function detectApprovalTimeout(input: TimeoutInput, now: Date = new Date()): RiskCandidate | null {
  if (!input.dueAt || input.dueAt.getTime() >= now.getTime()) return null
  if (input.escalated) return null
  return {
    type: RISK_TYPE.APPROVAL_TIMEOUT,
    bizType: input.bizType,
    bizId: input.bizId,
    severity: RISK_SEVERITY.MEDIUM,
    title: `审批超时（${input.bizType} #${input.bizId}）`,
    message: `流程实例 ${input.instanceId} 超过截止期 ${input.dueAt.toISOString()}`,
    evidence: { instanceId: input.instanceId, dueAt: input.dueAt.toISOString() },
    suggestion: '催办审批人或启动超时升级'
  }
}

export interface SyncFailInput {
  logId: number
  storeId: number
  bizType: string
  result: string
  errorText?: string | null
}

/** 同步失败：商城同步日志结果为 FAIL/ERROR/TIMEOUT */
export function detectSyncRisk(input: SyncFailInput): RiskCandidate | null {
  if (!/FAIL|ERROR|TIMEOUT/i.test(input.result)) return null
  return {
    type: RISK_TYPE.SYNC_FAILED,
    bizType: input.bizType || 'shop_sync',
    bizId: input.logId,
    severity: RISK_SEVERITY.MEDIUM,
    title: `商城同步失败（店铺 ${input.storeId}）`,
    message: input.errorText || `同步结果：${input.result}`,
    evidence: { logId: input.logId, storeId: input.storeId, result: input.result },
    suggestion: '检查映射与授权后重试同步'
  }
}

/** 风险项去重键：类型 + 业务单据 */
export function riskKey(candidate: RiskCandidate): string {
  return `${candidate.type}:${candidate.bizType}:${candidate.bizId}`
}

/** 严重度排序权重，用于列表按高风险优先 */
export function severityWeight(severity: RiskSeverity): number {
  return severity === RISK_SEVERITY.HIGH ? 3 : severity === RISK_SEVERITY.MEDIUM ? 2 : 1
}
