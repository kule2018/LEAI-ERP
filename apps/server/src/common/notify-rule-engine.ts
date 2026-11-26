/**
 * 统一通知规则纯逻辑：事件匹配、渠道解析、接收人类型判定。
 * 与持久层解耦，便于单测。
 */

/** 接收人类型 */
export const NOTIFY_RECEIVER_TYPES = ['USER', 'ROLE', 'BIZ_OWNER', 'ALL'] as const
export type NotifyReceiverType = (typeof NOTIFY_RECEIVER_TYPES)[number]

/** 通知级别 */
export const NOTIFY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
export type NotifyLevel = (typeof NOTIFY_LEVELS)[number]

/** 级别权重：用于「不低于指定级别」的匹配 */
export const NOTIFY_LEVEL_WEIGHT: Record<NotifyLevel, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
}

export interface NotifyRuleDefinition {
  ruleCode: string
  ruleName: string
  eventType: string
  bizType: string
  templateCode: string
  channels: string[]
  level: NotifyLevel
  receiverType: NotifyReceiverType
  receiverIds: number[]
  priority: number
  enabled: boolean
  description?: string | null
}

/**
 * 事件匹配：仅返回启用、事件类型一致、级别不低于门槛的规则。
 * 优先级数值小的排在前面，同优先级按规则编码稳定排序。
 */
export function matchNotifyRules(
  rules: NotifyRuleDefinition[],
  eventType: string,
  minLevel?: NotifyLevel
): NotifyRuleDefinition[] {
  const threshold = minLevel ? NOTIFY_LEVEL_WEIGHT[minLevel] : 0
  return rules
    .filter((rule) => rule.enabled)
    .filter((rule) => rule.eventType === eventType)
    .filter((rule) => NOTIFY_LEVEL_WEIGHT[rule.level] >= threshold)
    .sort((a, b) => a.priority - b.priority || a.ruleCode.localeCompare(b.ruleCode))
}

/**
 * 渠道解析：规则未配置渠道时回落模板渠道；
 * HIGH / CRITICAL 级别强制附加站内信，避免高危事件丢失。
 */
export function resolveRuleChannels(rule: NotifyRuleDefinition, fallback: string[]): string[] {
  const base = rule.channels.length > 0 ? rule.channels : fallback
  const channels = new Set(base.filter(Boolean))
  if (rule.level === 'HIGH' || rule.level === 'CRITICAL') channels.add('INMAIL')
  return [...channels]
}

/**
 * 接收人判定：USER/ROLE 需要显式指定接收对象；BIZ_OWNER 由业务数据提供；ALL 面向全租户。
 */
export function requiresExplicitReceiver(rule: NotifyRuleDefinition): boolean {
  if (rule.receiverType === 'USER' || rule.receiverType === 'ROLE') {
    return rule.receiverIds.length === 0
  }
  return false
}
