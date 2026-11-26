/**
 * 工作台纯逻辑引擎：KPI 聚合、同环比、现金流滚动预测、毛利拆解。
 * 与持久层解耦便于单测。
 */

export interface KpiConfig {
  code: string
  name: string
  source: string
  roles: string[]
}

/** 按角色筛选可见 KPI */
export function visibleKpis(configs: KpiConfig[], roles: string[]): KpiConfig[] {
  return configs.filter((k) => k.roles.length === 0 || k.roles.some((r) => roles.includes(r)))
}

/** 同比增长率 = (本期 - 同期) / 同期 */
export function growthRate(current: number, previous: number): number {
  if (!previous) return current > 0 ? 100 : 0
  return Number(((current - previous) / previous * 100).toFixed(2))
}

export interface TrendPoint {
  period: string
  amount: number
  cost?: number
}

/** 趋势增强：补充同比与毛利 */
export function enrichTrend(points: TrendPoint[], previous: TrendPoint[]): Array<TrendPoint & { yoy: number; grossProfit: number; margin: number }> {
  const prevMap = new Map(previous.map((p) => [p.period, p.amount]))
  return points.map((p) => {
    const grossProfit = p.amount - (p.cost ?? 0)
    return {
      ...p,
      yoy: growthRate(p.amount, prevMap.get(p.period) ?? 0),
      grossProfit: Number(grossProfit.toFixed(4)),
      margin: p.amount ? Number((grossProfit / p.amount * 100).toFixed(2)) : 0
    }
  })
}

export interface CashFlowItem {
  amount: number
  daysFromNow: number
  direction: 'IN' | 'OUT'
}

/** 13 周滚动现金流预测：按周聚合流入流出 */
export function forecastCashFlow(items: CashFlowItem[], weeks = 13): Array<{ week: number; inflow: number; outflow: number; net: number; cumulative: number }> {
  const result = Array.from({ length: weeks }, (_, i) => ({ week: i + 1, inflow: 0, outflow: 0, net: 0, cumulative: 0 }))
  for (const item of items) {
    const week = Math.floor(Math.max(0, item.daysFromNow) / 7)
    if (week >= weeks) continue
    if (item.direction === 'IN') result[week].inflow += item.amount
    else result[week].outflow += item.amount
  }
  let cumulative = 0
  for (const row of result) {
    row.net = Number((row.inflow - row.outflow).toFixed(4))
    cumulative += row.net
    row.cumulative = Number(cumulative.toFixed(4))
  }
  return result
}

/** 资金缺口预警：累计现金流转负的周 */
export function cashGapWarnings(forecast: Array<{ week: number; cumulative: number }>): number[] {
  return forecast.filter((f) => f.cumulative < 0).map((f) => f.week)
}

export type Scenario = 'BASE' | 'OPTIMISTIC' | 'PESSIMISTIC'

/** 情景模拟：按流入/流出系数放大基准预测 */
export function applyScenario(
  forecast: Array<{ week: number; inflow: number; outflow: number; net: number; cumulative: number }>,
  scenario: Scenario
): Array<{ week: number; inflow: number; outflow: number; net: number; cumulative: number }> {
  const factors: Record<Scenario, [number, number]> = {
    BASE: [1, 1],
    OPTIMISTIC: [1.1, 0.9],
    PESSIMISTIC: [0.85, 1.15]
  }
  const [inFactor, outFactor] = factors[scenario] ?? factors.BASE
  let cumulative = 0
  return forecast.map((row) => {
    const inflow = Number((row.inflow * inFactor).toFixed(4))
    const outflow = Number((row.outflow * outFactor).toFixed(4))
    const net = Number((inflow - outflow).toFixed(4))
    cumulative += net
    return { week: row.week, inflow, outflow, net, cumulative: Number(cumulative.toFixed(4)) }
  })
}

export interface NamedAmount { name: string; amount: number }

/** 贡献度：按金额降序并计算占比 */
export function contribution(items: NamedAmount[]): Array<NamedAmount & { share: number }> {
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  return items
    .map((item) => ({ ...item, share: total ? Number((item.amount / total * 100).toFixed(2)) : 0 }))
    .sort((a, b) => b.amount - a.amount)
}

/** 业务员/客户排行 */
export function ranking(items: NamedAmount[]): Array<NamedAmount & { rank: number }> {
  return [...items]
    .sort((a, b) => b.amount - a.amount)
    .map((item, index) => ({ ...item, rank: index + 1 }))
}

/** AI 日报摘要：结构化拼装并标注数据来源 */
export function dailyDigest(
  kpis: Array<{ name: string; value: string; yoy?: number }>,
  alerts: Array<{ title: string; severity: string }>
): { summary: string; sources: string[]; generatedAt: string } {
  const lines: string[] = ['今日经营摘要：']
  for (const kpi of kpis) {
    const yoy = typeof kpi.yoy === 'number' ? `，同比 ${kpi.yoy >= 0 ? '+' : ''}${kpi.yoy}%` : ''
    lines.push(`${kpi.name} ${kpi.value}${yoy}。`)
  }
  const sources = kpis.map((kpi) => kpi.name)
  if (alerts.length) {
    const high = alerts.filter((alert) => alert.severity === 'HIGH' || alert.severity === 'CRITICAL').length
    lines.push(`当前有 ${alerts.length} 条未关闭风险，其中高风险 ${high} 条。`)
    lines.push(...alerts.slice(0, 3).map((alert) => `- ${alert.title}`))
    sources.push('风险预警中心')
  } else {
    lines.push('当前无未关闭风险。')
  }
  return { summary: lines.join('\n'), sources, generatedAt: new Date().toISOString() }
}
