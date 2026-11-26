/**
 * 统一告警规则纯逻辑引擎：比较符、阈值解析与规则筛选。
 * 把原先散落在各业务域的硬编码阈值收敛为可配置的告警规则。
 */

export const ALERT_COMPARATOR = {
  GT: 'GT',
  GTE: 'GTE',
  LT: 'LT',
  LTE: 'LTE',
  EQ: 'EQ',
  NEQ: 'NEQ'
} as const

export type AlertComparator = (typeof ALERT_COMPARATOR)[keyof typeof ALERT_COMPARATOR]

export const ALERT_SEVERITY = {
  INFO: 'INFO',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
} as const

export type AlertSeverity = (typeof ALERT_SEVERITY)[keyof typeof ALERT_SEVERITY]

/** 内置告警指标：与各业务域的判定口径一一对应 */
export const ALERT_METRIC = {
  CREDIT_OVER_RATIO: 'CREDIT_OVER_RATIO',
  STOCK_CRITICAL_RATIO: 'STOCK_CRITICAL_RATIO',
  AR_MEDIUM_DAYS: 'AR_MEDIUM_DAYS',
  AR_HIGH_DAYS: 'AR_HIGH_DAYS',
  SECURITY_UNAUTHORIZED_ATTEMPTS: 'SECURITY_UNAUTHORIZED_ATTEMPTS',
  OPS_SLOW_REQUEST_MS: 'OPS_SLOW_REQUEST_MS',
  OPS_ERROR_RATE: 'OPS_ERROR_RATE'
} as const

export type AlertMetric = (typeof ALERT_METRIC)[keyof typeof ALERT_METRIC]

export interface AlertRuleDefinition {
  ruleCode: string
  bizType: string
  metric: string
  comparator: AlertComparator | string
  threshold: number
  windowMinutes?: number
  severity: AlertSeverity | string
  enabled: boolean
  notifyChannels?: string[]
}

/** 阈值兜底：未配置规则时使用的业务默认值 */
export const ALERT_DEFAULT_THRESHOLDS: Record<string, number> = {
  [ALERT_METRIC.CREDIT_OVER_RATIO]: 0.2,
  [ALERT_METRIC.STOCK_CRITICAL_RATIO]: 0.5,
  [ALERT_METRIC.AR_MEDIUM_DAYS]: 7,
  [ALERT_METRIC.AR_HIGH_DAYS]: 30,
  [ALERT_METRIC.SECURITY_UNAUTHORIZED_ATTEMPTS]: 5,
  [ALERT_METRIC.OPS_SLOW_REQUEST_MS]: 1000,
  [ALERT_METRIC.OPS_ERROR_RATE]: 0.1
}

/** 比较符判定 */
export function compareAlertValue(value: number, comparator: string, threshold: number): boolean {
  switch (comparator) {
    case ALERT_COMPARATOR.GT:
      return value > threshold
    case ALERT_COMPARATOR.GTE:
      return value >= threshold
    case ALERT_COMPARATOR.LT:
      return value < threshold
    case ALERT_COMPARATOR.LTE:
      return value <= threshold
    case ALERT_COMPARATOR.EQ:
      return value === threshold
    case ALERT_COMPARATOR.NEQ:
      return value !== threshold
    default:
      return false
  }
}

/** 规则命中判定：仅启用规则参与比较 */
export function matchAlertRule(rule: AlertRuleDefinition, sample: number): boolean {
  if (!rule?.enabled) return false
  const threshold = Number(rule.threshold)
  if (!Number.isFinite(threshold)) return false
  return compareAlertValue(Number(sample), String(rule.comparator), threshold)
}

/** 按业务域筛选规则 */
export function collectAlertRules(rules: AlertRuleDefinition[], bizType?: string): AlertRuleDefinition[] {
  if (!bizType) return [...rules]
  return rules.filter((rule) => rule.bizType === bizType)
}

/** 阈值解析：优先取已启用规则，否则回落默认值 */
export function resolveAlertThreshold(
  rules: AlertRuleDefinition[],
  metric: string,
  fallback?: number
): number {
  const matched = rules.find((rule) => rule.metric === metric && rule.enabled)
  if (matched && Number.isFinite(Number(matched.threshold))) {
    return Number(matched.threshold)
  }
  if (fallback !== undefined && Number.isFinite(fallback)) return fallback
  return ALERT_DEFAULT_THRESHOLDS[metric] ?? 0
}

/** 阈值映射：一次取出多个指标的阈值，供业务域批量使用 */
export function resolveAlertThresholds(
  rules: AlertRuleDefinition[],
  metrics: string[]
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const metric of metrics) {
    result[metric] = resolveAlertThreshold(rules, metric)
  }
  return result
}

/** 严重度排序权重 */
export function alertSeverityWeight(severity: string): number {
  switch (severity) {
    case ALERT_SEVERITY.CRITICAL:
      return 5
    case ALERT_SEVERITY.HIGH:
      return 4
    case ALERT_SEVERITY.MEDIUM:
      return 3
    case ALERT_SEVERITY.LOW:
      return 2
    default:
      return 1
  }
}
