/**
 * 银企直连规则（纯函数层）
 *
 * 规范要求：资金 —— 银企直连（银行连接配置、流水同步、余额同步、对账）。
 * 适配器：
 * - MOCK：内置模拟流水，用于联调与演示；
 * - CSV：解析银行流水文件（externalNo,direction,amount,txDate,summary）；
 * - JSON：网银直连 JSON 报文；
 * - XML：网银直连 XML 报文。
 */

/** 银行连接适配器类型 */
export const BANK_CONNECTOR_TYPES = ['MOCK', 'CSV', 'JSON', 'XML'] as const
export type BankConnectorType = (typeof BANK_CONNECTOR_TYPES)[number]

/** 适配器中文名 */
export const BANK_CONNECTOR_LABEL: Record<BankConnectorType, string> = {
  MOCK: '模拟直连',
  CSV: '流水文件直连',
  JSON: '网银 JSON 直连',
  XML: '网银 XML 直连'
}

/** 银行流水行 */
export interface BankStatementRow {
  externalNo: string
  direction: 'IN' | 'OUT'
  amount: number
  txDate?: string | null
  summary?: string | null
}

/** 判断是否为合法的适配器 */
export function isBankConnectorType(value: unknown): value is BankConnectorType {
  return typeof value === 'string' && (BANK_CONNECTOR_TYPES as readonly string[]).includes(value)
}

function toNum(value: unknown): number {
  const num = Number(value ?? 0)
  return Number.isFinite(num) ? num : 0
}

function round4(value: number): number {
  return Number(toNum(value).toFixed(4))
}

/**
 * 解析银行流水 CSV：首行为表头，忽略空行与注释行，非法行计入 errors
 */
export function parseCsvStatement(csv: string): { rows: BankStatementRow[]; errors: string[] } {
  const rows: BankStatementRow[] = []
  const errors: string[] = []
  const lines = (csv ?? '').split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0 && !line.startsWith('#'))
  if (lines.length === 0) return { rows, errors: ['流水文件为空'] }
  const header = lines[0].split(',').map((item) => item.trim().toLowerCase())
  const idxExternal = header.indexOf('externalno')
  const idxDirection = header.indexOf('direction')
  const idxAmount = header.indexOf('amount')
  const idxDate = header.indexOf('txdate')
  const idxSummary = header.indexOf('summary')
  if (idxExternal < 0 || idxAmount < 0) {
    return { rows, errors: ['流水文件缺少 externalNo 或 amount 列'] }
  }
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map((item) => item.trim())
    const externalNo = parts[idxExternal] ?? ''
    const amount = toNum(parts[idxAmount])
    if (!externalNo) {
      errors.push(`第 ${i + 1} 行缺少流水号`)
      continue
    }
    if (amount <= 0) {
      errors.push(`第 ${i + 1} 行金额必须大于 0`)
      continue
    }
    const rawDirection = (idxDirection >= 0 ? parts[idxDirection] : '').toUpperCase()
    const direction: 'IN' | 'OUT' = rawDirection === 'OUT' || rawDirection === '借' ? 'OUT' : 'IN'
    rows.push({
      externalNo,
      direction,
      amount: round4(amount),
      txDate: idxDate >= 0 && parts[idxDate] ? parts[idxDate] : null,
      summary: idxSummary >= 0 && parts[idxSummary] ? parts[idxSummary] : null
    })
  }
  return { rows, errors }
}

/**
 * 生成模拟银行流水（联调用）：按余额与笔数产出稳定的流水号
 */
export function buildMockStatement(input: {
  accountNo?: string | null
  balance: number
  count?: number
  date?: string
}): BankStatementRow[] {
  const count = Math.max(1, Math.min(input.count ?? 2, 20))
  const balance = Math.abs(toNum(input.balance))
  const date = input.date ?? new Date().toISOString().slice(0, 10)
  const prefix = input.accountNo ? String(input.accountNo).slice(-4) : '0000'
  const rows: BankStatementRow[] = []
  for (let i = 1; i <= count; i++) {
    const amount = round4(balance / (count + 1))
    if (amount <= 0) break
    rows.push({
      externalNo: `MOCK${prefix}${date.replace(/-/g, '')}${String(i).padStart(3, '0')}`,
      direction: i % 2 === 0 ? 'OUT' : 'IN',
      amount,
      txDate: date,
      summary: i % 2 === 0 ? '模拟支出' : '模拟收入'
    })
  }
  return rows
}

/** 同步计划结果 */
export interface BankSyncPlan {
  inflow: number
  outflow: number
  net: number
  /** 按本次流水推算的期末余额 */
  endingBalance: number
  /** 与账面余额差异（银行余额 - 账面余额），银行余额缺失时为 null */
  difference: number | null
  matched: boolean
  rows: BankStatementRow[]
}

/**
 * 银行同步计划：统计本次流水收支、推算期末余额并与账面/银行余额比对
 */
export function buildBankSyncPlan(input: {
  transactions: BankStatementRow[]
  bookBalance: number
  bankBalance?: number | null
}): BankSyncPlan {
  const rows = input.transactions ?? []
  let inflow = 0
  let outflow = 0
  for (const row of rows) {
    if (row.direction === 'OUT') outflow = round4(outflow + toNum(row.amount))
    else inflow = round4(inflow + toNum(row.amount))
  }
  const net = round4(inflow - outflow)
  const endingBalance = round4(toNum(input.bookBalance) + net)
  const bankBalance = input.bankBalance === null || input.bankBalance === undefined ? null : toNum(input.bankBalance)
  const difference = bankBalance === null ? null : round4(bankBalance - toNum(input.bookBalance))
  return {
    inflow,
    outflow,
    net,
    endingBalance,
    difference,
    matched: difference === null ? true : Math.abs(difference) < 0.0001,
    rows
  }
}

/**
 * 连接配置校验
 */
export function validateBankConnection(input: {
  accountId?: number | null
  bankName?: string | null
  connector?: string | null
}): { ok: boolean; reason?: string } {
  if (!input.accountId || input.accountId <= 0) return { ok: false, reason: '请选择资金账户' }
  if (!input.bankName || !input.bankName.trim()) return { ok: false, reason: '请填写开户银行' }
  if (!isBankConnectorType(input.connector)) return { ok: false, reason: '不支持的直连适配器' }
  return { ok: true }
}

/**
 * 凭证掩码：返回给前端时隐藏敏感字段
 */
export function maskConnectionCredentials(credentials: Record<string, unknown> | null | undefined): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(credentials ?? {})) {
    const text = String(value ?? '')
    result[key] = /password|secret|token|key/i.test(key) && text.length > 0
      ? `${text.slice(0, 2)}****`
      : text
  }
  return result
}

/* ------------------------------ 多渠道报文适配（第十六批） ------------------------------ */

function normalizeDirection(value: unknown): 'IN' | 'OUT' {
  const text = String(value ?? '').toUpperCase()
  return text === 'OUT' || text === 'DEBIT' || text === '借' || text === '支出' ? 'OUT' : 'IN'
}

function normalizeRow(raw: Record<string, unknown>): BankStatementRow | null {
  const externalNo = String(raw.externalNo ?? raw.external_no ?? raw.txNo ?? raw.txId ?? raw.refNo ?? '').trim()
  const amount = toNum(raw.amount ?? raw.txAmount ?? raw.tranAmt)
  if (!externalNo) return null
  if (amount <= 0) return null
  const direction = normalizeDirection(raw.direction ?? raw.dcFlag ?? raw.flag ?? raw.txType)
  return {
    externalNo,
    direction,
    amount: round4(amount),
    txDate: String(raw.txDate ?? raw.tx_date ?? raw.tranDate ?? raw.date ?? '').trim() || null,
    summary: String(raw.summary ?? raw.memo ?? raw.remark ?? raw.narrative ?? '').trim() || null
  }
}

/** 网银 JSON 报文解析：支持数组根节点或 { transactions: [...] } */
export function parseJsonStatement(payload: string): { rows: BankStatementRow[]; errors: string[] } {
  const errors: string[] = []
  const rows: BankStatementRow[] = []
  let parsed: unknown
  try {
    parsed = JSON.parse(payload ?? '')
  } catch {
    return { rows, errors: ['JSON 报文格式错误'] }
  }
  const rawRows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object'
      ? ((parsed as Record<string, unknown>).transactions ?? (parsed as Record<string, unknown>).rows ?? (parsed as Record<string, unknown>).list)
      : null
  if (!Array.isArray(rawRows)) return { rows, errors: ['JSON 报文缺少 transactions 数组'] }
  rawRows.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      errors.push(`第 ${index + 1} 条报文格式错误`)
      return
    }
    const row = normalizeRow(item as Record<string, unknown>)
    if (!row) errors.push(`第 ${index + 1} 条流水缺少流水号或金额无效`)
    else rows.push(row)
  })
  return { rows, errors }
}

/** 网银 XML 报文解析：提取 <transaction>...</transaction>（或 <txn>/<row>）节点 */
export function parseXmlStatement(payload: string): { rows: BankStatementRow[]; errors: string[] } {
  const errors: string[] = []
  const rows: BankStatementRow[] = []
  const blocks = (payload ?? '').match(/<(transaction|txn|row)\b[^>]*>[\s\S]*?<\/\1>/gi)
  if (!blocks || blocks.length === 0) return { rows, errors: ['XML 报文中未找到流水节点'] }
  blocks.forEach((block, index) => {
    const raw: Record<string, unknown> = {}
    const fields = block.match(/<(externalNo|external_no|txNo|txId|refNo|amount|txAmount|tranAmt|direction|dcFlag|flag|txType|txDate|tx_date|tranDate|date|summary|memo|remark|narrative)\b[^>]*>([\s\S]*?)<\/\1>/gi)
    for (const field of fields ?? []) {
      const matched = field.match(/^<([^>\s]+)[^>]*>([\s\S]*?)<\/\1>$/i)
      if (matched) raw[matched[1]] = matched[2].trim()
    }
    const row = normalizeRow(raw)
    if (!row) errors.push(`第 ${index + 1} 个流水节点缺少流水号或金额无效`)
    else rows.push(row)
  })
  return { rows, errors }
}

/** 渠道解析器输入 */
export interface BankStatementParseInput {
  content?: string | null
  accountNo?: string | null
  balance?: number
  count?: number
  date?: string
}

/** 渠道解析器注册表 */
export const BANK_STATEMENT_PARSERS: Record<BankConnectorType, (input: BankStatementParseInput) => { rows: BankStatementRow[]; errors: string[] }> = {
  MOCK: (input) => ({ rows: buildMockStatement({ accountNo: input.accountNo, balance: toNum(input.balance), count: input.count, date: input.date }), errors: [] }),
  CSV: (input) => parseCsvStatement(input.content ?? ''),
  JSON: (input) => parseJsonStatement(input.content ?? ''),
  XML: (input) => parseXmlStatement(input.content ?? '')
}

/** 按适配器解析银行报文 */
export function parseBankStatement(connector: string, input: BankStatementParseInput): { rows: BankStatementRow[]; errors: string[] } {
  const parser = BANK_STATEMENT_PARSERS[connector as BankConnectorType]
  if (!parser) return { rows: [], errors: [`不支持的直连适配器：${connector}`] }
  return parser(input)
}

/* ------------------------------ 流水对账差异处理（第十六批） ------------------------------ */

/** 账面候选单据（收付款单） */
export interface BankReconcileCandidate {
  id: number
  direction: 'IN' | 'OUT'
  amount: number
  date?: string | null
  summary?: string | null
}

export interface BankReconcileMatch {
  transactionId: number
  targetId: number | null
  score: number
  matched: boolean
  reason: string
}

/** 流水与账面单据匹配：方向/金额一致为基础，日期相同 +10，摘要包含 +5，得分 >= 100 自动匹配 */
export function matchBankTransactions(
  transactions: Array<BankReconcileCandidate>,
  candidates: BankReconcileCandidate[]
): {
  matches: BankReconcileMatch[]
  unmatchedTransactions: number[]
  unmatchedCandidates: number[]
  summary: { matchedCount: number; unmatchedBankCount: number; unmatchedBookCount: number; matchedAmount: number; unmatchedBankAmount: number; unmatchedBookAmount: number }
} {
  const used = new Set<number>()
  const matches: BankReconcileMatch[] = []
  for (const tx of transactions) {
    let best: { candidate: BankReconcileCandidate; score: number } | null = null
    for (const candidate of candidates) {
      if (used.has(candidate.id)) continue
      if (candidate.direction !== tx.direction) continue
      if (Math.abs(toNum(candidate.amount) - toNum(tx.amount)) > 0.0001) continue
      let score = 100
      if (tx.date && candidate.date && String(tx.date).slice(0, 10) === String(candidate.date).slice(0, 10)) score += 10
      if (tx.summary && candidate.summary && (String(tx.summary).includes(String(candidate.summary)) || String(candidate.summary).includes(String(tx.summary)))) score += 5
      if (!best || score > best.score) best = { candidate, score }
    }
    if (best) {
      used.add(best.candidate.id)
      matches.push({ transactionId: tx.id, targetId: best.candidate.id, score: best.score, matched: true, reason: '金额方向一致' })
    } else {
      matches.push({ transactionId: tx.id, targetId: null, score: 0, matched: false, reason: '未找到匹配的账面单据' })
    }
  }
  const unmatchedTransactions = matches.filter((item) => !item.matched).map((item) => item.transactionId)
  const unmatchedCandidates = candidates.map((item) => item.id).filter((id) => !used.has(id))
  const amountOf = (id: number) => toNum(transactions.find((item) => item.id === id)?.amount)
  const candidateAmountOf = (id: number) => toNum(candidates.find((item) => item.id === id)?.amount)
  return {
    matches,
    unmatchedTransactions,
    unmatchedCandidates,
    summary: {
      matchedCount: matches.filter((item) => item.matched).length,
      unmatchedBankCount: unmatchedTransactions.length,
      unmatchedBookCount: unmatchedCandidates.length,
      matchedAmount: round4(matches.filter((item) => item.matched).reduce((sum, item) => sum + amountOf(item.transactionId), 0)),
      unmatchedBankAmount: round4(unmatchedTransactions.reduce((sum, id) => sum + amountOf(id), 0)),
      unmatchedBookAmount: round4(unmatchedCandidates.reduce((sum, id) => sum + candidateAmountOf(id), 0))
    }
  }
}
