/**
 * 协同与人事增强规则引擎（纯函数）：敏感词过滤、薪酬脱敏、补卡审批、证书到期、会议纪要转任务。
 */

export interface SensitiveWordRule {
  word: string
  level?: string
  enabled?: boolean
}

export interface SensitiveFilterResult {
  text: string
  hits: string[]
  blocked: boolean
}

/** 敏感词过滤：命中词替换为掩码，命中高危词时阻断发送 */
export function filterSensitiveWords(text: string, rules: SensitiveWordRule[]): SensitiveFilterResult {
  let result = text ?? ''
  const hits: string[] = []
  let blocked = false
  for (const rule of rules) {
    if (!rule.word || rule.enabled === false) continue
    const word = rule.word.trim()
    if (!word) continue
    if (!result.includes(word)) continue
    hits.push(word)
    if ((rule.level ?? 'MEDIUM') === 'HIGH') blocked = true
    result = result.split(word).join('***')
  }
  return { text: result, hits: [...new Set(hits)], blocked }
}

/** 薪酬金额脱敏：无查看权限时仅保留区间信息 */
export function maskSalaryAmount(value: string | number, canView: boolean): string {
  if (canView) return String(value)
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount) || amount <= 0) return '***'
  const level = amount >= 20000 ? '高档' : amount >= 10000 ? '中档' : '低档'
  return `***(${level})`
}

/** 补卡申请校验：同一天同一员工重复补卡时拒绝 */
export function evaluatePunchRequest(
  existing: Array<{ employeeId: number; punchDate: string }>,
  employeeId: number,
  punchDate: string
): { ok: boolean; reason: string | null } {
  const duplicated = existing.some((item) => item.employeeId === employeeId && item.punchDate === punchDate)
  if (duplicated) return { ok: false, reason: '该员工当日已有补卡申请，不可重复提交' }
  return { ok: true, reason: null }
}

/** 薪酬发放审批：仅草稿或驳回状态可提交发放审批 */
export function evaluateSalaryApproval(status: string): { ok: boolean; reason: string | null } {
  if (status === 'DRAFT' || status === 'REJECTED') return { ok: true, reason: null }
  return { ok: false, reason: `薪酬单当前状态 ${status} 不允许提交发放审批` }
}

/** 培训证书到期提醒：返回距到期天数与是否临期 */
export function evaluateCertificateExpiry(expireDate: string | null, days = 30, at = new Date()): {
  expired: boolean
  expiring: boolean
  days: number | null
} {
  if (!expireDate) return { expired: false, expiring: false, days: null }
  const target = new Date(expireDate).getTime()
  if (!Number.isFinite(target)) return { expired: false, expiring: false, days: null }
  const diffDays = Math.ceil((target - at.getTime()) / 86400000)
  return { expired: diffDays < 0, expiring: diffDays >= 0 && diffDays <= days, days: diffDays }
}

/** 绩效申诉处理：仅已申诉状态可处理 */
export function evaluatePerformanceAppeal(status: string): { ok: boolean; reason: string | null } {
  if (status === 'APPEALED' || status === 'PENDING') return { ok: true, reason: null }
  return { ok: false, reason: `绩效申诉当前状态 ${status} 不允许处理` }
}

export interface MeetingTaskCandidate {
  taskName: string
  assigneeId: number | null
  dueDate: string | null
}

/** 会议纪要转任务：按 "- 任务名@负责人@YYYY-MM-DD" 逐行解析 */
export function parseMeetingTasks(minutes: string): MeetingTaskCandidate[] {
  const result: MeetingTaskCandidate[] = []
  for (const rawLine of (minutes ?? '').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const matched = /^[-*·]\s*(.+)$/.exec(line)
    if (!matched) continue
    const parts = matched[1].split('@').map((item) => item.trim())
    const taskName = parts[0]
    if (!taskName) continue
    const assigneeRaw = parts[1]
    const dueRaw = parts[2]
    const assigneeId = assigneeRaw && /^\d+$/.test(assigneeRaw) ? Number(assigneeRaw) : null
    const dueDate = dueRaw && /^\d{4}-\d{2}-\d{2}$/.test(dueRaw) ? dueRaw : null
    result.push({ taskName, assigneeId, dueDate })
  }
  return result
}
