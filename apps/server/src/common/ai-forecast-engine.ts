/**
 * AI 预测与补货建议纯规则引擎：
 * - 补货建议量计算（含安全库存、提前期、最小起订量与批量倍数）
 * - 预测准确率评估（MAPE → 准确率等级）
 * - 建议确认状态机（人工确认/拒绝，幂等）
 * - 外部模型服务接入配置校验
 */

/** 补货建议输入 */
export interface ReplenishmentInput {
  /** 日均销量（由月均换算传入时需同时给出 avgQty 月均） */
  avgQty?: number
  /** 趋势率，0.1 表示月均增长 10% */
  trendRate?: number
  /** 当前可用量 */
  availableQty?: number
  /** 安全库存 */
  safetyStock?: number
  /** 采购提前期（天） */
  leadTimeDays?: number
  /** 最小起订量 */
  minOrderQty?: number
  /** 批量倍数（包装规格） */
  lotSize?: number
  /** 历史样本数，用于置信度评估 */
  historyCount?: number
}

/** 补货建议结果 */
export interface ReplenishmentSuggestion {
  /** 建议补货量（已按批量倍数与最小起订量取整） */
  suggestQty: number
  /** 未取整的净需求 */
  netQty: number
  /** 提前期需求 + 安全库存 */
  demandQty: number
  /** 当前可用量可覆盖天数 */
  coverDays: number
  trendRate: number
  /** 置信度 0~1 */
  confidence: number
  /** 建议紧急度 */
  level: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  reason: string
}

/** 预测准确率评估结果 */
export interface ForecastAccuracy {
  /** 平均绝对百分比误差（%） */
  mape: number
  /** 准确率 0~1 */
  accuracy: number
  sampleSize: number
  level: 'GOOD' | 'FAIR' | 'POOR'
}

function num(value: number | undefined | null): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/**
 * 批量倍数与最小起订量取整：先向上取整到批量倍数，再保证不小于最小起订量。
 * 批量倍数非法（<=0）时不做倍数处理，仅保证最小起订量。
 */
export function roundToLot(qty: number, lotSize = 0, minOrderQty = 0): number {
  const target = Math.max(0, num(qty))
  if (target <= 0) return 0
  const lot = num(lotSize)
  const min = Math.max(0, num(minOrderQty))
  let result = target
  if (min > 0 && result < min) result = min
  if (lot > 0) result = Math.ceil(result / lot) * lot
  return round(result)
}

/**
 * 计算补货建议：
 * 需求 = 月均销量 × 提前期天数/30 × (1 + 趋势率) + 安全库存
 * 净需求 = 需求 - 可用量
 */
export function buildReplenishmentSuggestion(input: ReplenishmentInput): ReplenishmentSuggestion {
  const avgQty = Math.max(0, num(input.avgQty))
  const trendRate = num(input.trendRate)
  const availableQty = Math.max(0, num(input.availableQty))
  const safetyStock = Math.max(0, num(input.safetyStock))
  const leadTimeDays = Math.max(0, num(input.leadTimeDays) || 30)
  const historyCount = Math.max(0, num(input.historyCount))

  const dailyQty = avgQty > 0 ? avgQty / 30 : 0
  const coverDays = dailyQty > 0 ? round(availableQty / dailyQty, 1) : 999
  const demandQty = round(dailyQty * leadTimeDays * (1 + trendRate) + safetyStock)
  const netQty = round(Math.max(0, demandQty - availableQty))
  const suggestQty = roundToLot(netQty, input.lotSize, input.minOrderQty)

  const sampleScore = Math.min(0.4, historyCount * 0.08)
  const confidence = round(Math.min(0.95, Math.max(0.2, 0.35 + sampleScore - Math.abs(trendRate) * 0.2)), 4)

  let level: ReplenishmentSuggestion['level'] = 'LOW'
  let reason = '可用量充足，暂不补货'
  if (suggestQty <= 0) {
    level = 'LOW'
    reason = `可用量可覆盖 ${coverDays} 天，暂无补货需求`
  } else if (coverDays <= leadTimeDays) {
    level = 'URGENT'
    reason = `可用量仅可覆盖 ${coverDays} 天，已低于采购提前期 ${leadTimeDays} 天，建议立即补货 ${suggestQty}`
  } else if (coverDays <= leadTimeDays * 1.5) {
    level = 'HIGH'
    reason = `可用量可覆盖 ${coverDays} 天，接近提前期 ${leadTimeDays} 天，建议尽快补货 ${suggestQty}`
  } else {
    level = 'NORMAL'
    reason = `按提前期 ${leadTimeDays} 天与安全库存测算，建议补货 ${suggestQty}`
  }

  return { suggestQty, netQty, demandQty, coverDays, trendRate: round(trendRate, 4), confidence, level, reason }
}

/**
 * 预测准确率评估：对齐历史实际与预测值计算 MAPE。
 * 无有效样本时返回低置信度结果。
 */
export function evaluateForecastAccuracy(history: number[], forecast: number[]): ForecastAccuracy {
  const actuals = (history ?? []).map((item) => num(item))
  const predictions = (forecast ?? []).map((item) => num(item))
  const size = Math.min(actuals.length, predictions.length)
  if (size === 0) {
    return { mape: 100, accuracy: 0, sampleSize: 0, level: 'POOR' }
  }
  let total = 0
  let valid = 0
  for (let i = 0; i < size; i += 1) {
    const actual = actuals[i]
    if (actual <= 0) continue
    total += Math.abs(actual - predictions[i]) / actual
    valid += 1
  }
  if (valid === 0) {
    return { mape: 100, accuracy: 0, sampleSize: 0, level: 'POOR' }
  }
  const mape = round((total / valid) * 100, 2)
  const accuracy = round(Math.max(0, 1 - mape / 100), 4)
  const level: ForecastAccuracy['level'] = accuracy >= 0.9 ? 'GOOD' : accuracy >= 0.75 ? 'FAIR' : 'POOR'
  return { mape, accuracy, sampleSize: valid, level }
}

/** 建议确认状态机：仅 PENDING 可操作 */
export function checkSuggestionState(status: string, appliedBizId?: number | null): { ok: boolean; reason?: string } {
  const current = (status ?? '').toUpperCase()
  if (current === 'PENDING') return { ok: true }
  if (current === 'CONFIRMED') {
    return { ok: false, reason: appliedBizId ? `建议已确认并生成单据（#${appliedBizId}），不可重复操作` : '建议已确认，不可重复操作' }
  }
  if (current === 'REJECTED') return { ok: false, reason: '建议已被拒绝，不可重复操作' }
  return { ok: false, reason: `建议状态 ${current || '未知'} 不允许确认` }
}

/** 外部模型服务接入配置 */
export interface ModelEndpointInput {
  endpoint?: string | null
  apiKey?: string | null
  model?: string | null
  timeoutMs?: number
}

/** 外部模型服务接入配置校验结果 */
export interface ModelEndpointValidation {
  ok: boolean
  reason?: string
  url?: string
  timeoutMs: number
}

const ALLOWED_PROTOCOLS = ['http:', 'https:']

/**
 * 外部模型服务接入配置校验：endpoint 必须是 http(s) 地址；apiKey 与 model 缺失时给出提示但不阻断（部分网关无需鉴权）。
 */
export function evaluateModelEndpoint(input: ModelEndpointInput): ModelEndpointValidation {
  const timeoutMs = Math.min(30000, Math.max(1000, num(input.timeoutMs) || 8000))
  const endpoint = (input.endpoint ?? '').trim()
  if (!endpoint) {
    return { ok: false, reason: '未配置外部模型服务地址', timeoutMs }
  }
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return { ok: false, reason: '外部模型服务地址格式不正确', timeoutMs }
  }
  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
    return { ok: false, reason: '外部模型服务地址仅支持 http/https 协议', timeoutMs }
  }
  if (!input.model) {
    return { ok: false, reason: '未指定模型名称，无法发起连通性探测', timeoutMs }
  }
  return { ok: true, url: url.toString(), timeoutMs }
}

/** 构造模型连通性探测请求 */
export function buildModelProbeRequest(
  input: ModelEndpointInput
): { url: string; method: 'POST'; headers: Record<string, string>; body: Record<string, unknown> } | null {
  const validation = evaluateModelEndpoint(input)
  if (!validation.ok || !validation.url) return null
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  const apiKey = (input.apiKey ?? '').trim()
  if (apiKey) headers.authorization = `Bearer ${apiKey}`
  return {
    url: validation.url,
    method: 'POST',
    headers,
    body: {
      model: input.model,
      max_tokens: 16,
      temperature: 0,
      messages: [{ role: 'user', content: 'ping' }]
    }
  }
}
