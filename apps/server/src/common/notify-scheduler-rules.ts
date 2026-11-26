/**
 * 通知与调度纯逻辑规则：模板变量渲染、渠道选择、任务到期判定、慢查询判定。
 * 与持久层解耦便于单测。
 */

/** 模板变量渲染：{{key}} 替换为变量值，未提供的变量保留原样 */
export function renderTemplate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = variables[key]
    return value == null ? match : String(value)
  })
}

/** 提取模板变量名：解析 {{key}} 占位符，返回去重后的变量清单 */
export function extractTemplateVariables(text: string | null | undefined): string[] {
  if (!text) return []
  const variables = new Set<string>()
  for (const match of text.matchAll(/\{\{([^}]*)\}\}/g)) {
    const name = match[1].trim()
    if (/^\w+$/.test(name)) variables.add(name)
  }
  return [...variables]
}

/** 渠道选择：按模板配置 + 事件级别决定实际发送渠道 */
export function selectChannels(
  configured: string[],
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
): string[] {
  const channels = new Set(configured)
  if (level === 'HIGH' || level === 'CRITICAL') channels.add('INMAIL')
  return [...channels]
}

/** 发送失败重试判定：未达最大重试次数且未成功 */
export function shouldRetry(status: string, retryCount: number, maxRetry = 3): boolean {
  return status === 'FAILED' && retryCount < maxRetry
}

export interface ScheduleInput {
  lastRunAt: Date | null
  intervalMinutes: number
  enabled: boolean
}

/** 任务是否到期：从未执行或距上次执行已达间隔 */
export function isTaskDue(input: ScheduleInput, now: Date = new Date()): boolean {
  if (!input.enabled || input.intervalMinutes <= 0) return false
  if (!input.lastRunAt) return true
  const elapsed = now.getTime() - input.lastRunAt.getTime()
  return elapsed >= input.intervalMinutes * 60 * 1000
}

/** 慢查询判定：耗时超过阈值（毫秒） */
export function isSlowRequest(durationMs: number, thresholdMs = 1000): boolean {
  return durationMs > thresholdMs
}

/** 错误率告警判定：窗口内错误数/总数超阈值 */
export function shouldAlertOnErrors(errors: number, total: number, threshold = 0.1): boolean {
  return total >= 10 && errors / total > threshold
}
