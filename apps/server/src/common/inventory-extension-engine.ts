/**
 * 库存与仓储扩展规则引擎：
 * 上架策略规则构建与库位匹配、拣货路径优化、库存库龄分析、ABC 分类、
 * 收发存报表与在途量汇总。全部为纯函数，便于单元测试。
 */

export type PutawayRuleType = 'TEMPERATURE' | 'BATCH' | 'VOLUME' | 'TURNOVER' | 'WEIGHT' | 'ZONE'

export interface PutawayRule {
  id: number
  ruleType: PutawayRuleType
  priority: number
  ruleValue: string
}

export interface PutawayContext {
  temperatureZone?: string
  volume?: number
  turnoverDays?: number
  batchNo?: string
  weight?: number
  location: {
    locationId: number
    zone?: string
    temperatureZone?: string
    maxWeight?: number
    maxVolume?: number
    occupied?: number
  }
}

export interface PutawayDecision {
  locationId: number
  matched: boolean
  ruleType: PutawayRuleType | null
  reason: string
  score: number
}

export interface PutawayRuleInput {
  mixedBatch?: boolean
  temperatureControlled?: boolean
  bigItemFirst?: boolean
  fastTurnoverFirst?: boolean
  weightThreshold?: number
  zone?: string
}

/**
 * 上架策略规则构建器：把上架作业要求编译为有序规则集。
 * 规则优先级：温区 > 批次隔离 > 库区 > 体积 > 周转 > 承重。
 */
export function buildPutawayRules(input: PutawayRuleInput): PutawayRule[] {
  const rules: PutawayRule[] = []
  let priority = 1
  if (input.temperatureControlled) {
    rules.push({ id: rules.length + 1, ruleType: 'TEMPERATURE', priority: priority++, ruleValue: 'MATCH' })
  }
  if (input.mixedBatch === false) {
    rules.push({ id: rules.length + 1, ruleType: 'BATCH', priority: priority++, ruleValue: 'SEPARATE' })
  }
  if (input.zone) {
    rules.push({ id: rules.length + 1, ruleType: 'ZONE', priority: priority++, ruleValue: input.zone })
  }
  if (input.bigItemFirst) {
    rules.push({ id: rules.length + 1, ruleType: 'VOLUME', priority: priority++, ruleValue: 'LARGE' })
  }
  if (input.fastTurnoverFirst) {
    rules.push({ id: rules.length + 1, ruleType: 'TURNOVER', priority: priority++, ruleValue: 'FAST' })
  }
  if (input.weightThreshold != null && Number(input.weightThreshold) > 0) {
    rules.push({ id: rules.length + 1, ruleType: 'WEIGHT', priority: priority++, ruleValue: String(input.weightThreshold) })
  }
  return rules
}

function ruleSatisfied(rule: PutawayRule, context: PutawayContext): { ok: boolean; reason: string } {
  const location = context.location
  switch (rule.ruleType) {
    case 'TEMPERATURE': {
      const need = context.temperatureZone
      if (!need) return { ok: true, reason: '未指定温区要求' }
      if (location.temperatureZone !== need) {
        return { ok: false, reason: `库位温区 ${location.temperatureZone ?? '未知'} 与要求温区 ${need} 不符` }
      }
      return { ok: true, reason: `温区 ${need} 匹配` }
    }
    case 'BATCH': {
      const occupied = location.occupied ?? 0
      if (occupied > 0) return { ok: false, reason: '库位已占用，批次需隔离' }
      return { ok: true, reason: '空库位，满足批次隔离' }
    }
    case 'ZONE': {
      if (location.zone !== rule.ruleValue) {
        return { ok: false, reason: `库区 ${location.zone ?? '未知'} 与指定库区 ${rule.ruleValue} 不符` }
      }
      return { ok: true, reason: `库区 ${rule.ruleValue} 匹配` }
    }
    case 'VOLUME': {
      const volume = context.volume ?? 0
      const maxVolume = location.maxVolume ?? 0
      if (maxVolume && volume > maxVolume) {
        return { ok: false, reason: `货物体积 ${volume} 超过库位容量 ${maxVolume}` }
      }
      return { ok: true, reason: '体积符合库位容量' }
    }
    case 'TURNOVER': {
      const days = context.turnoverDays ?? 0
      if (days <= 30 && location.zone !== 'FAST') {
        return { ok: false, reason: '快周转商品需上架快周转库区' }
      }
      return { ok: true, reason: '周转策略匹配' }
    }
    case 'WEIGHT': {
      const weight = context.weight ?? 0
      const maxWeight = location.maxWeight ?? 0
      const threshold = Number(rule.ruleValue)
      if (maxWeight && weight > maxWeight) {
        return { ok: false, reason: `货物重量 ${weight} 超过库位承重 ${maxWeight}` }
      }
      if (threshold && weight >= threshold && location.zone !== 'HEAVY') {
        return { ok: false, reason: '重货需上架重货库区' }
      }
      return { ok: true, reason: '承重符合要求' }
    }
    default:
      return { ok: true, reason: '规则未覆盖' }
  }
}

/** 上架策略匹配：按优先级返回首个满足的库位判定 */
export function putawayStrategyMatch(rules: PutawayRule[], context: PutawayContext): PutawayDecision {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority)
  if (!sorted.length) {
    return { locationId: context.location.locationId, matched: true, ruleType: null, reason: '未配置上架策略，默认上架', score: 0 }
  }
  let lastReason = '库位不满足上架策略'
  for (const rule of sorted) {
    const result = ruleSatisfied(rule, context)
    if (result.ok) {
      return {
        locationId: context.location.locationId,
        matched: true,
        ruleType: rule.ruleType,
        reason: result.reason,
        score: 1000 - rule.priority
      }
    }
    lastReason = result.reason
  }
  return { locationId: context.location.locationId, matched: false, ruleType: null, reason: lastReason, score: 0 }
}

export interface PickTaskInput {
  taskId: number
  locationCode: string
  qty: number
}

export interface PickPathResult {
  order: Array<PickTaskInput & { aisle: string; rack: number; level: number; step: number }>
  distance: number
  naiveDistance: number
  savedDistance: number
  savedRatio: number
}

function parseLocation(code: string): { aisle: string; rack: number; level: number } {
  const parts = String(code ?? '').split('-')
  const aisle = parts[0] ?? 'A'
  const rack = Number(parts[1] ?? 0) || 0
  const level = Number(parts[2] ?? 0) || 0
  return { aisle, rack, level }
}

/** 拣货路径优化：按巷道分组并采用蛇形排序，返回行走距离与优化节省比例 */
export function optimizePickPath(tasks: PickTaskInput[]): PickPathResult {
  const decorated = tasks.map((task) => ({ ...task, ...parseLocation(task.locationCode) }))
  const naiveDistance = decorated.reduce((sum, task, index) => {
    if (index === 0) return sum
    const prev = decorated[index - 1]
    return sum + Math.abs(task.rack - prev.rack) + task.level + prev.level
  }, 0)

  const aisleOrder = [...new Set(decorated.map((task) => task.aisle))].sort()
  const sorted = [...decorated].sort((a, b) => {
    if (a.aisle !== b.aisle) return aisleOrder.indexOf(a.aisle) - aisleOrder.indexOf(b.aisle)
    const aisleIndex = aisleOrder.indexOf(a.aisle)
    const rackDiff = aisleIndex % 2 === 0 ? a.rack - b.rack : b.rack - a.rack
    if (rackDiff !== 0) return rackDiff
    return a.level - b.level
  })
  const distance = sorted.reduce((sum, task, index) => {
    if (index === 0) return sum
    const prev = sorted[index - 1]
    if (prev.aisle !== task.aisle) return sum + 10
    return sum + Math.abs(task.rack - prev.rack) + Math.abs(task.level - prev.level)
  }, 0)
  const savedDistance = Math.max(naiveDistance - distance, 0)
  const savedRatio = naiveDistance > 0 ? Math.round((savedDistance / naiveDistance) * 10000) / 100 : 0
  return {
    order: sorted.map((task, index) => ({ ...task, step: index + 1 })),
    distance,
    naiveDistance,
    savedDistance,
    savedRatio
  }
}

export interface AgingInput {
  productId: number
  qty: number
  amount: number
  firstInDate: string
}

export interface AgingBucket {
  label: string
  min: number
  max: number
}

/** 库存库龄分析：按入库首日计算库龄并落入区间桶 */
export function inventoryAging(items: AgingInput[], at: string, buckets?: AgingBucket[]): {
  buckets: AgingBucket[]
  rows: Array<{ productId: number; qty: number; amount: number; ageDays: number; bucket: string }>
  totals: Array<{ label: string; qty: number; amount: number }>
} {
  const ranges: AgingBucket[] = buckets ?? [
    { label: '0-30天', min: 0, max: 30 },
    { label: '31-60天', min: 31, max: 60 },
    { label: '61-90天', min: 61, max: 90 },
    { label: '91-180天', min: 91, max: 180 },
    { label: '181-365天', min: 181, max: 365 },
    { label: '365天以上', min: 366, max: Number.MAX_SAFE_INTEGER }
  ]
  const dayDiff = (from: string, to: string): number => {
    const start = Date.parse(`${from}T00:00:00Z`)
    const end = Date.parse(`${to}T00:00:00Z`)
    if (Number.isNaN(start) || Number.isNaN(end)) return 0
    return Math.max(Math.floor((end - start) / 86400000), 0)
  }
  const rows = items.map((item) => {
    const ageDays = dayDiff(item.firstInDate, at)
    const bucket = ranges.find((range) => ageDays >= range.min && ageDays <= range.max) ?? ranges[ranges.length - 1]
    return { productId: item.productId, qty: item.qty, amount: item.amount, ageDays, bucket: bucket.label }
  })
  const totals = ranges.map((range) => {
    const matched = rows.filter((row) => row.bucket === range.label)
    return {
      label: range.label,
      qty: Math.round(matched.reduce((sum, row) => sum + row.qty, 0) * 1000) / 1000,
      amount: Math.round(matched.reduce((sum, row) => sum + row.amount, 0) * 10000) / 10000
    }
  })
  return { buckets: ranges, rows, totals }
}

/** ABC 分类：按库存金额累计占比划分 A/B/C */
export function abcAnalysis(items: Array<{ productId: number; qty: number; amount: number }>): {
  rows: Array<{ productId: number; qty: number; amount: number; ratio: number; cumulative: number; category: string }>
  summary: { A: { count: number; amount: number }; B: { count: number; amount: number }; C: { count: number; amount: number } }
} {
  const sorted = [...items].sort((a, b) => b.amount - a.amount)
  const total = sorted.reduce((sum, item) => sum + item.amount, 0)
  let cumulativeAmount = 0
  const rows = sorted.map((item) => {
    cumulativeAmount += item.amount
    const ratio = total > 0 ? Math.round((item.amount / total) * 10000) / 100 : 0
    const cumulative = total > 0 ? Math.round((cumulativeAmount / total) * 10000) / 100 : 0
    const category = cumulative <= 80 ? 'A' : cumulative <= 95 ? 'B' : 'C'
    return { productId: item.productId, qty: item.qty, amount: item.amount, ratio, cumulative, category }
  })
  const summary = { A: { count: 0, amount: 0 }, B: { count: 0, amount: 0 }, C: { count: 0, amount: 0 } }
  for (const row of rows) {
    summary[row.category as 'A' | 'B' | 'C'].count += 1
    summary[row.category as 'A' | 'B' | 'C'].amount += row.amount
  }
  for (const key of ['A', 'B', 'C'] as const) {
    summary[key].amount = Math.round(summary[key].amount * 10000) / 10000
  }
  return { rows, summary }
}

/** 收发存报表：按期间聚合入库、出库与净变动 */
export function stockInOutReport(
  ledgers: Array<{ productId: number; qtyIn: number; qtyOut: number; occurredAt: string }>,
  from: string,
  to: string
): {
  from: string
  to: string
  rows: Array<{ productId: number; qtyIn: number; qtyOut: number; net: number }>
  totals: { qtyIn: number; qtyOut: number; net: number }
} {
  const inRange = (value: string): boolean => {
    if (!from) return true
    if (!to) return true
    const day = String(value ?? '').slice(0, 10)
    return day >= from && day <= to
  }
  const map = new Map<number, { productId: number; qtyIn: number; qtyOut: number; net: number }>()
  for (const ledger of ledgers) {
    if (!inRange(ledger.occurredAt)) continue
    const row = map.get(ledger.productId) ?? { productId: ledger.productId, qtyIn: 0, qtyOut: 0, net: 0 }
    row.qtyIn += ledger.qtyIn
    row.qtyOut += ledger.qtyOut
    row.net = row.qtyIn - row.qtyOut
    map.set(ledger.productId, row)
  }
  const rows = [...map.values()].map((row) => ({
    productId: row.productId,
    qtyIn: Math.round(row.qtyIn * 1000) / 1000,
    qtyOut: Math.round(row.qtyOut * 1000) / 1000,
    net: Math.round(row.net * 1000) / 1000
  }))
  const totals = rows.reduce(
    (acc, row) => ({
      qtyIn: Math.round((acc.qtyIn + row.qtyIn) * 1000) / 1000,
      qtyOut: Math.round((acc.qtyOut + row.qtyOut) * 1000) / 1000,
      net: Math.round((acc.net + row.net) * 1000) / 1000
    }),
    { qtyIn: 0, qtyOut: 0, net: 0 }
  )
  return { from, to, rows, totals }
}

/** 在途量汇总：统计在途数量、批次与超期未达 */
export function inTransitSummary(
  items: Array<{ productId: number; qty: number; etaDate: string | null; status: string }>,
  at: string
): {
  rows: Array<{ productId: number; qty: number; count: number; earliestEta: string | null; overdueQty: number }>
  totals: { qty: number; count: number; overdueQty: number }
} {
  const map = new Map<number, { productId: number; qty: number; count: number; earliestEta: string | null; overdueQty: number }>()
  for (const item of items) {
    if (item.status === 'RECEIVED' || item.status === 'CANCELLED') continue
    const row = map.get(item.productId) ?? { productId: item.productId, qty: 0, count: 0, earliestEta: null, overdueQty: 0 }
    row.qty += item.qty
    row.count += 1
    if (item.etaDate && (!row.earliestEta || item.etaDate < row.earliestEta)) row.earliestEta = item.etaDate
    if (item.etaDate && item.etaDate < at) row.overdueQty += item.qty
    map.set(item.productId, row)
  }
  const rows = [...map.values()].map((row) => ({ ...row, qty: Math.round(row.qty * 1000) / 1000, overdueQty: Math.round(row.overdueQty * 1000) / 1000 }))
  const totals = rows.reduce(
    (acc, row) => ({
      qty: Math.round((acc.qty + row.qty) * 1000) / 1000,
      count: acc.count + row.count,
      overdueQty: Math.round((acc.overdueQty + row.overdueQty) * 1000) / 1000
    }),
    { qty: 0, count: 0, overdueQty: 0 }
  )
  return { rows, totals }
}
