export interface TrackingEvent {
  status: string
  location?: string | null
  description?: string | null
  eventAt: Date | string
}

export interface LogisticsException {
  exception: boolean
  reason?: string
  hoursSinceLastEvent: number
}

export interface CsQcInput {
  responseMinutes: number
  resolved: boolean
  politeness: number
  firstReplySlaMinutes?: number
}

export interface CsQcResult {
  score: number
  result: 'PASS' | 'REVIEW' | 'FAIL'
  reasons: string[]
}

export function detectCarrier(waybillNo: string): string {
  const no = waybillNo.toUpperCase()
  if (/^SF/.test(no)) return '顺丰速运'
  if (/^YT/.test(no)) return '圆通速递'
  if (/^ZTO/.test(no)) return '中通快递'
  if (/^JD/.test(no)) return '京东物流'
  if (/^EMS/.test(no)) return 'EMS'
  return '其他'
}

export function sortTrackingEvents(events: TrackingEvent[]): TrackingEvent[] {
  return [...events].sort((a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime())
}

export function detectLogisticsException(events: TrackingEvent[], at = new Date()): LogisticsException {
  const sorted = sortTrackingEvents(events)
  if (sorted.length === 0) return { exception: true, reason: '暂无物流轨迹', hoursSinceLastEvent: 0 }
  const last = sorted[0]
  const lastTime = new Date(last.eventAt).getTime()
  const hours = Math.max(0, (at.getTime() - lastTime) / 3600000)
  const status = last.status.toUpperCase()
  if (status === 'EXCEPTION' || status === 'LOST') {
    return { exception: true, reason: `最新状态为 ${status}`, hoursSinceLastEvent: hours }
  }
  if (hours > 48) return { exception: true, reason: '物流轨迹超过 48 小时未更新', hoursSinceLastEvent: hours }
  return { exception: false, hoursSinceLastEvent: hours }
}

export function scoreCsQuality(input: CsQcInput): CsQcResult {
  const reasons: string[] = []
  let score = 60
  const sla = input.firstReplySlaMinutes ?? 10
  if (input.responseMinutes <= sla) score += 20
  else reasons.push(`首次响应 ${input.responseMinutes} 分钟，超过 SLA ${sla} 分钟`)
  if (input.resolved) score += 15
  else reasons.push('会话未标记解决')
  if (input.politeness >= 4) score += 5
  else reasons.push('服务态度评分偏低')
  const finalScore = Math.max(0, Math.min(100, score))
  const result: CsQcResult['result'] = finalScore >= 85 ? 'PASS' : finalScore >= 70 ? 'REVIEW' : 'FAIL'
  return { score: finalScore, result, reasons }
}
