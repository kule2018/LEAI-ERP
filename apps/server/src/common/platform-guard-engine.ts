/**
 * 平台侧治理规则：越权告警、权限即时失效、慢 SQL 采集、通知渠道投递、标签重复打印提示。
 * 纯函数实现，与持久层解耦便于单测。
 */

/** 通知渠道支持列表 */
export const NOTIFY_CHANNELS = ['INMAIL', 'EMAIL', 'SMS', 'WECOM', 'DINGTALK'] as const
export type NotifyChannel = (typeof NOTIFY_CHANNELS)[number]

export interface ChannelConfig {
  /** 渠道网关地址（邮件/短信服务商 HTTP 接口） */
  gatewayUrl?: string | null
  /** 网关鉴权令牌 */
  token?: string | null
  /** 邮件发件人 / 短信签名 */
  sender?: string | null
}

/** 渠道是否属于需要外部网关投递的渠道 */
export function isExternalChannel(channel: string): boolean {
  return channel !== 'INMAIL'
}

/**
 * 渠道配置校验：外部渠道必须配置网关地址，且站内信无需网关。
 * 返回目标地址与投递结果描述，供通知服务落地。
 */
export function evaluateNotifyChannelConfig(
  channel: string,
  config: ChannelConfig
): { ok: boolean; target: string | null; gatewayUrl: string | null; reason: string | null } {
  if (!NOTIFY_CHANNELS.includes(channel as NotifyChannel)) {
    return { ok: false, target: null, gatewayUrl: null, reason: `不支持的通知渠道：${channel}` }
  }
  if (channel === 'INMAIL') {
    return { ok: true, target: 'inbox', gatewayUrl: null, reason: null }
  }
  if (!config.gatewayUrl) {
    return { ok: false, target: null, gatewayUrl: null, reason: `渠道 ${channel} 未配置投递网关` }
  }
  return { ok: true, target: config.sender ?? null, gatewayUrl: config.gatewayUrl, reason: null }
}

/** 组装渠道投递报文（网关约定统一为 JSON POST） */
export function buildNotifyDeliveryPayload(
  channel: string,
  target: string,
  title: string,
  content: string,
  variables: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    channel,
    target,
    title,
    content,
    variables,
    sentAt: new Date().toISOString()
  }
}

/** 投递结果判定：HTTP 2xx 视为成功 */
export function evaluateDeliveryResponse(status: number): { success: boolean; message: string } {
  if (status >= 200 && status < 300) return { success: true, message: '投递成功' }
  return { success: false, message: `渠道网关返回异常状态：${status}` }
}

/** 越权访问告警判定：窗口内累计越权次数达到阈值升级 */
export function evaluateUnauthorizedAttempt(
  attempts: number,
  threshold = 5
): { alert: boolean; level: 'LOW' | 'HIGH'; reason: string | null } {
  if (attempts >= threshold) {
    return { alert: true, level: 'HIGH', reason: `${attempts} 分钟内累计 ${attempts} 次越权访问，已升级为高危告警` }
  }
  if (attempts >= Math.max(2, Math.ceil(threshold / 2))) {
    return { alert: true, level: 'LOW', reason: `短时间多次越权访问（${attempts} 次），请关注` }
  }
  return { alert: false, level: 'LOW', reason: null }
}

/** 权限版本：角色/用户授权变更后自增，令牌版本落后即失效 */
export function nextPermissionVersion(current: number): number {
  return (Number.isFinite(current) ? current : 0) + 1
}

/** 令牌权限版本与当前版本是否已背离 */
export function permissionVersionChanged(currentVersion: number, tokenVersion: number | undefined): boolean {
  if (tokenVersion === undefined || tokenVersion === null) return false
  return Number(tokenVersion) !== Number(currentVersion)
}

/** 慢 SQL 判定 */
export function isSlowSql(durationMs: number, thresholdMs = 500): boolean {
  return durationMs > thresholdMs
}

export interface SlowSqlEntry {
  sql: string
  durationMs: number
  rowCount: number
  thresholdMs: number
  capturedAt: string
}

/** 构造慢 SQL 采集条目（SQL 压缩空白，避免日志膨胀） */
export function buildSlowSqlEntry(
  sql: string,
  durationMs: number,
  rowCount: number,
  thresholdMs = 500,
  now: Date = new Date()
): SlowSqlEntry {
  return {
    sql: sql.replace(/\s+/g, ' ').trim().slice(0, 500),
    durationMs,
    rowCount,
    thresholdMs,
    capturedAt: now.toISOString()
  }
}

/** 慢 SQL 聚合：按 SQL 归并统计出现次数与总耗时 */
export function aggregateSlowSql(entries: SlowSqlEntry[]): Array<{
  sql: string
  count: number
  totalMs: number
  maxMs: number
  avgMs: number
}> {
  const map = new Map<string, { sql: string; count: number; totalMs: number; maxMs: number }>()
  for (const entry of entries) {
    const current = map.get(entry.sql) ?? { sql: entry.sql, count: 0, totalMs: 0, maxMs: 0 }
    current.count += 1
    current.totalMs += entry.durationMs
    current.maxMs = Math.max(current.maxMs, entry.durationMs)
    map.set(entry.sql, current)
  }
  return [...map.values()]
    .map((item) => ({
      sql: item.sql,
      count: item.count,
      totalMs: item.totalMs,
      maxMs: item.maxMs,
      avgMs: Math.round(item.totalMs / item.count)
    }))
    .sort((left, right) => right.totalMs - left.totalMs)
}

export interface DuplicatePrintInput {
  bizType: string
  bizId: number
  templateId?: number | null
  printedAt: Date | string
}

export interface DuplicatePrintResult {
  duplicated: boolean
  count: number
  lastPrintedAt: string | null
  message: string | null
}

/**
 * 标签重复打印提示：同一业务单据在时间窗内已打印过则提示，
 * 但不阻断（规范要求重复打印需留记录并提示，而非禁止）。
 */
export function evaluateDuplicatePrint(
  records: DuplicatePrintInput[],
  bizType: string,
  bizId: number,
  windowMinutes = 30,
  now: Date = new Date()
): DuplicatePrintResult {
  const limit = now.getTime() - windowMinutes * 60 * 1000
  const hits = records.filter((item) => {
    if (item.bizType !== bizType || item.bizId !== bizId) return false
    const time = new Date(item.printedAt).getTime()
    return Number.isFinite(time) && time >= limit
  })
  if (hits.length === 0) {
    return { duplicated: false, count: 0, lastPrintedAt: null, message: null }
  }
  const last = hits
    .map((item) => new Date(item.printedAt).getTime())
    .reduce((max, current) => Math.max(max, current))
  const lastPrintedAt = new Date(last).toISOString()
  return {
    duplicated: true,
    count: hits.length,
    lastPrintedAt,
    message: `该单据在最近 ${windowMinutes} 分钟内已打印 ${hits.length} 次（最近一次 ${lastPrintedAt}），请确认是否重复打印`
  }
}
