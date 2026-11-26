/**
 * 财务结算域扩展纯规则：科目停用与辅助核算校验、凭证模板与科目建议、
 * 试算平衡高亮与凭证下钻、三大报表同环比附注、收支 OCR 与费用政策、
 * 账龄坏账催收与计提、银行流水自动匹配、现金流日历与情景模拟、
 * 成本重算任务回滚、月结检查清单与反结账、预算编制控制占用。
 * 与持久层解耦，便于单测与复用。
 */

/* ---------------- 科目停用校验与辅助核算必填 ---------------- */

export interface SubjectSnapshot {
  id: number
  subjectCode: string
  subjectName: string
  category: string
  auxType?: string | null
  isLeaf?: boolean | number
  status?: string
  disabledAt?: string | Date | null
}

export interface VoucherEntrySnapshot {
  subjectId: number
  summary?: string
  debit?: number
  credit?: number
  auxType?: string | null
  auxId?: string | null
}

export interface SubjectUsageIssue {
  lineNo: number
  subjectId: number
  subjectCode: string
  subjectName: string
  type: 'NOT_FOUND' | 'DISABLED' | 'NOT_LEAF' | 'AUX_MISSING' | 'AUX_MISMATCH' | 'EMPTY_AMOUNT'
  message: string
}

/**
 * 凭证分录科目合法性校验：
 * 1. 科目必须存在（NOT_FOUND）
 * 2. 已停用科目不可记账（DISABLED）
 * 3. 只能记末级科目（NOT_LEAF）
 * 4. 科目配置辅助核算时，分录必须填写且类型一致（AUX_MISSING / AUX_MISMATCH）
 * 5. 借方与贷方不得同时为 0（EMPTY_AMOUNT）
 */
export function validateSubjectUsage(
  subjects: SubjectSnapshot[],
  entries: VoucherEntrySnapshot[]
): { ok: boolean; issues: SubjectUsageIssue[]; disabledCount: number; auxMissingCount: number } {
  const map = new Map(subjects.map((item) => [item.id, item]))
  const issues: SubjectUsageIssue[] = []
  let disabledCount = 0
  let auxMissingCount = 0

  entries.forEach((entry, index) => {
    const lineNo = index + 1
    const subject = map.get(entry.subjectId)
    if (!subject) {
      issues.push({
        lineNo,
        subjectId: entry.subjectId,
        subjectCode: '',
        subjectName: '',
        type: 'NOT_FOUND',
        message: `第 ${lineNo} 行：科目 ${entry.subjectId} 不存在`
      })
      return
    }
    const base = { lineNo, subjectId: subject.id, subjectCode: subject.subjectCode, subjectName: subject.subjectName }
    if ((subject.status ?? 'ENABLED') !== 'ENABLED') {
      disabledCount += 1
      issues.push({
        ...base,
        type: 'DISABLED',
        message: `第 ${lineNo} 行：科目 ${subject.subjectCode} 已停用，不可用于记账`
      })
    }
    const isLeaf = subject.isLeaf === undefined ? true : Boolean(subject.isLeaf)
    if (!isLeaf) {
      issues.push({
        ...base,
        type: 'NOT_LEAF',
        message: `第 ${lineNo} 行：科目 ${subject.subjectCode} 为非末级科目，不可记账`
      })
    }
    if (subject.auxType) {
      if (!entry.auxId) {
        auxMissingCount += 1
        issues.push({
          ...base,
          type: 'AUX_MISSING',
          message: `第 ${lineNo} 行：科目 ${subject.subjectCode} 启用辅助核算「${subject.auxType}」，必须填写辅助核算项`
        })
      } else if (entry.auxType && entry.auxType !== subject.auxType) {
        issues.push({
          ...base,
          type: 'AUX_MISMATCH',
          message: `第 ${lineNo} 行：辅助核算类型「${entry.auxType}」与科目要求「${subject.auxType}」不一致`
        })
      }
    }
    const debit = Number(entry.debit) || 0
    const credit = Number(entry.credit) || 0
    if (debit === 0 && credit === 0) {
      issues.push({
        ...base,
        type: 'EMPTY_AMOUNT',
        message: `第 ${lineNo} 行：借方与贷方金额不能同时为 0`
      })
    }
  })

  return { ok: issues.length === 0, issues, disabledCount, auxMissingCount }
}

/* ---------------- 凭证模板 ---------------- */

export interface VoucherTemplateItem {
  subjectCode: string
  direction: 'DEBIT' | 'CREDIT'
  ratio: number
  summary?: string
  auxType?: string | null
}

export interface VoucherTemplateSnapshot {
  templateCode: string
  templateName: string
  bizType?: string
  items: VoucherTemplateItem[]
}

export interface VoucherTemplateEntry {
  subjectId: number | null
  subjectCode: string
  summary: string
  direction: 'DEBIT' | 'CREDIT'
  debit: number
  credit: number
  auxType?: string | null
}

export interface VoucherTemplateApplyResult {
  entries: VoucherTemplateEntry[]
  totalDebit: number
  totalCredit: number
  difference: number
  balanced: boolean
  warnings: string[]
}

/**
 * 凭证模板套用：按模板条目比例生成分录草稿。
 * 借贷比例不等时保留差额并给出警告，交由制单人调整。
 */
export function applyVoucherTemplate(
  template: VoucherTemplateSnapshot,
  context: { amount: number; subjectMap: Record<string, number>; summary?: string; auxMap?: Record<string, string> }
): VoucherTemplateApplyResult {
  const warnings: string[] = []
  const amount = Number(context.amount) || 0
  const items = template.items ?? []
  if (items.length === 0) warnings.push('凭证模板未配置任何分录条目')
  const entries: VoucherTemplateEntry[] = items.map((item) => {
    const ratio = Number(item.ratio) || 0
    const value = Number((amount * ratio).toFixed(4))
    const subjectId = context.subjectMap[item.subjectCode] ?? null
    if (subjectId == null) warnings.push(`科目 ${item.subjectCode} 未在科目表中找到对应科目`)
    const auxId = context.auxMap?.[item.subjectCode] ?? null
    if (item.auxType && !auxId) warnings.push(`科目 ${item.subjectCode} 需要辅助核算项，套用模板时尚未指定`)
    return {
      subjectId,
      subjectCode: item.subjectCode,
      summary: item.summary ?? context.summary ?? `${template.templateName} ${item.subjectCode}`,
      direction: item.direction,
      debit: item.direction === 'DEBIT' ? value : 0,
      credit: item.direction === 'CREDIT' ? value : 0,
      auxType: item.auxType ?? null,
      auxId
    }
  })
  const totalDebit = Number(entries.reduce((sum, item) => sum + item.debit, 0).toFixed(4))
  const totalCredit = Number(entries.reduce((sum, item) => sum + item.credit, 0).toFixed(4))
  const difference = Number((totalDebit - totalCredit).toFixed(4))
  if (Math.abs(difference) > 0.0001) warnings.push(`模板借贷不平衡，差额 ${difference}`)
  return { entries, totalDebit, totalCredit, difference, balanced: Math.abs(difference) <= 0.0001, warnings }
}

/* ---------------- AI 科目建议 ---------------- */

export interface SubjectHistoryItem {
  subjectId: number
  subjectCode: string
  subjectName: string
  summary: string
  amount: number
}

export interface SubjectSuggestion {
  subjectId: number
  subjectCode: string
  subjectName: string
  score: number
  reason: string
}

function tokenize(text: string): string[] {
  return (text ?? '')
    .toLowerCase()
    .split(/[\s,，、;；:：/\\()（）\-_]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function overlapScore(a: string, b: string): number {
  const left = new Set(tokenize(a))
  const right = new Set(tokenize(b))
  if (left.size === 0 || right.size === 0) return 0
  let hit = 0
  for (const item of left) {
    if (right.has(item)) hit += 1
  }
  return hit / left.size
}

/**
 * AI 科目建议：综合历史凭证使用频次、摘要关键词与科目名称相关度打分，
 * 返回得分最高的若干科目（确定性排序，便于单测）。
 */
export function suggestSubjects(
  history: SubjectHistoryItem[],
  keyword: string,
  subjects: SubjectSnapshot[],
  limit = 3
): SubjectSuggestion[] {
  const frequency = new Map<number, number>()
  const summaries = new Map<number, string[]>()
  for (const item of history) {
    frequency.set(item.subjectId, (frequency.get(item.subjectId) ?? 0) + 1)
    const list = summaries.get(item.subjectId) ?? []
    list.push(item.summary ?? '')
    summaries.set(item.subjectId, list)
  }
  const maxFrequency = Math.max(1, ...frequency.values())
  const suggestions = subjects
    .filter((subject) => (subject.status ?? 'ENABLED') === 'ENABLED')
    .map((subject) => {
      const freq = frequency.get(subject.id) ?? 0
      const freqScore = (freq / maxFrequency) * 40
      const nameScore = overlapScore(keyword, subject.subjectName) * 30
      const historyScore = overlapScore(keyword, (summaries.get(subject.id) ?? []).join(' ')) * 30
      const score = Number((freqScore + nameScore + historyScore).toFixed(2))
      const reasons: string[] = []
      if (freq > 0) reasons.push(`历史凭证使用 ${freq} 次`)
      if (nameScore > 0) reasons.push('科目名称与关键词相关')
      if (historyScore > 0) reasons.push('历史摘要包含关键词')
      return {
        subjectId: subject.id,
        subjectCode: subject.subjectCode,
        subjectName: subject.subjectName,
        score,
        reason: reasons.join('；') || '按科目编码顺序兜底推荐'
      }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.subjectCode.localeCompare(b.subjectCode))
  return suggestions.slice(0, Math.max(1, limit))
}

/* ---------------- 试算平衡高亮与凭证下钻 ---------------- */

export interface TrialBalanceRow {
  subjectId: number
  subjectCode: string
  subjectName: string
  debit: number
  credit: number
  voucherIds?: number[]
}

export interface VoucherBalanceRow {
  voucherId: number
  voucherNo: string
  debit: number
  credit: number
}

/** 凭证借贷平衡判定：返回不平衡凭证列表 */
export function evaluateVoucherBalances(vouchers: VoucherBalanceRow[], tolerance = 0.01): {
  balanced: boolean
  difference: number
  unbalanced: VoucherBalanceRow[]
} {
  let totalDebit = 0
  let totalCredit = 0
  const unbalanced: VoucherBalanceRow[] = []
  for (const voucher of vouchers) {
    const debit = Number(voucher.debit) || 0
    const credit = Number(voucher.credit) || 0
    totalDebit += debit
    totalCredit += credit
    if (Math.abs(debit - credit) > tolerance) unbalanced.push(voucher)
  }
  return {
    balanced: unbalanced.length === 0,
    difference: Number((totalDebit - totalCredit).toFixed(4)),
    unbalanced
  }
}

/**
 * 试算表分析：汇总借贷合计、标记不平衡科目（高亮）并给出凭证下钻入口。
 */
/** 按辅助核算维度展开试算表行（部门/客户/供应商/项目等） */
export function buildAuxTrialBalance(
  entries: Array<{ subjectId: number; auxType: string | null; auxId: string | null; debit: number; credit: number }>,
  subjectMap: Map<number, { subjectCode: string; subjectName: string }>
): Array<{ subjectId: number; subjectCode: string; subjectName: string; auxType: string; auxId: string; debit: number; credit: number; balance: number }> {
  const map = new Map<string, { subjectId: number; subjectCode: string; subjectName: string; auxType: string; auxId: string; debit: number; credit: number }>()
  for (const entry of entries) {
    const key = `${entry.subjectId}|${entry.auxType ?? ''}|${entry.auxId ?? ''}`
    const current = map.get(key) ?? {
      subjectId: entry.subjectId,
      subjectCode: subjectMap.get(entry.subjectId)?.subjectCode ?? '',
      subjectName: subjectMap.get(entry.subjectId)?.subjectName ?? '',
      auxType: entry.auxType ?? '',
      auxId: entry.auxId ?? '',
      debit: 0,
      credit: 0
    }
    current.debit += Number(entry.debit ?? 0)
    current.credit += Number(entry.credit ?? 0)
    map.set(key, current)
  }
  return [...map.values()].map((row) => ({
    ...row,
    debit: Number(row.debit.toFixed(4)),
    credit: Number(row.credit.toFixed(4)),
    balance: Number((row.debit - row.credit).toFixed(4))
  }))
}

export function evaluateTrialBalance(rows: TrialBalanceRow[], unbalancedVoucherIds: number[] = []): {
  totalDebit: number
  totalCredit: number
  difference: number
  balanced: boolean
  highlightedSubjectIds: number[]
  drilldowns: Array<{ subjectId: number; subjectCode: string; subjectName: string; voucherIds: number[] }>
} {
  let totalDebit = 0
  let totalCredit = 0
  const bad = new Set(unbalancedVoucherIds)
  const highlightedSubjectIds: number[] = []
  const drilldowns: Array<{ subjectId: number; subjectCode: string; subjectName: string; voucherIds: number[] }> = []
  for (const row of rows) {
    totalDebit += Number(row.debit) || 0
    totalCredit += Number(row.credit) || 0
    const voucherIds = row.voucherIds ?? []
    if (voucherIds.some((id) => bad.has(id))) highlightedSubjectIds.push(row.subjectId)
    if (voucherIds.length > 0) {
      drilldowns.push({
        subjectId: row.subjectId,
        subjectCode: row.subjectCode,
        subjectName: row.subjectName,
        voucherIds
      })
    }
  }
  const difference = Number((totalDebit - totalCredit).toFixed(4))
  return {
    totalDebit: Number(totalDebit.toFixed(4)),
    totalCredit: Number(totalCredit.toFixed(4)),
    difference,
    balanced: Math.abs(difference) <= 0.01,
    highlightedSubjectIds,
    drilldowns
  }
}

/* ---------------- 三大报表同环比与附注 ---------------- */

export interface StatementItem {
  key: string
  label: string
  current: number
  note?: string
}

export interface StatementComparison extends StatementItem {
  previous: number
  changeAmount: number
  changeRate: number
  direction: 'UP' | 'DOWN' | 'FLAT'
}

/** 报表同环比：计算环比金额、环比率与方向 */
export function compareStatements(current: StatementItem[], previous: StatementItem[]): StatementComparison[] {
  const map = new Map(previous.map((item) => [item.key, Number(item.current) || 0]))
  return current.map((item) => {
    const before = map.get(item.key) ?? 0
    const value = Number(item.current) || 0
    const changeAmount = Number((value - before).toFixed(4))
    const changeRate = before === 0 ? (value === 0 ? 0 : 100) : Number(((changeAmount / Math.abs(before)) * 100).toFixed(2))
    return {
      ...item,
      previous: before,
      changeAmount,
      changeRate,
      direction: changeAmount > 0 ? 'UP' : changeAmount < 0 ? 'DOWN' : 'FLAT'
    }
  })
}

/** 报表附注：波动超过阈值自动生成说明 */
export function buildStatementNotes(comparisons: StatementComparison[], threshold = 20): string[] {
  const notes: string[] = []
  for (const item of comparisons) {
    if (item.previous === 0 && item.current === 0) continue
    if (Math.abs(item.changeRate) >= threshold) {
      notes.push(`${item.label} 环比${item.direction === 'UP' ? '上升' : '下降'} ${Math.abs(item.changeRate)}%（金额 ${item.current}）`)
    } else if (item.note) {
      notes.push(`${item.label}：${item.note}`)
    }
  }
  return notes
}

/* ---------------- 收支 OCR 与费用政策 ---------------- */

export interface ReceiptOcrResult {
  ok: boolean
  amount: number | null
  date: string | null
  direction: 'IN' | 'OUT' | null
  summary: string | null
  counterparty: string | null
  reason?: string
}

/**
 * 收支单据 OCR 文本解析：识别金额、日期、收支方向、对方单位与摘要。
 */
export function parseReceiptText(text: string): ReceiptOcrResult {
  const raw = (text ?? '').trim()
  if (!raw) return { ok: false, amount: null, date: null, direction: null, summary: null, counterparty: null, reason: '识别文本为空' }

  let amount: number | null = null
  const dateMatch = raw.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/)
  const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}` : null
  // 优先识别带货币单位的金额，避免把日期中的年份当作金额
  const withUnit = [...raw.matchAll(/(\d+(?:\.\d{1,2})?)\s*(?:元|块|¥|￥|RMB)/gi)]
    .map((item) => Number(item[1]))
    .filter((value) => Number.isFinite(value) && value > 0)
  if (withUnit.length > 0) {
    amount = Number(Math.max(...withUnit).toFixed(2))
  } else {
    const withoutDate = raw.replace(/\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?/g, ' ')
    const plain = [...withoutDate.matchAll(/\d+(?:\.\d{1,2})?/g)]
      .map((item) => Number(item[0]))
      .filter((value) => Number.isFinite(value) && value > 0)
    if (plain.length > 0) amount = Number(Math.max(...plain).toFixed(2))
  }

  const inWords = ['收入', '收款', '来款', '转入', '收到', '入账', '入帐']
  const outWords = ['支出', '付款', '消费', '转出', '付给', '付出', '出账', '出帐']
  const hasIn = inWords.some((word) => raw.includes(word))
  const hasOut = outWords.some((word) => raw.includes(word))
  const direction: 'IN' | 'OUT' | null = hasIn && !hasOut ? 'IN' : hasOut && !hasIn ? 'OUT' : hasIn && hasOut ? (amount && amount > 0 ? 'IN' : 'OUT') : null

  const counterpartyMatch = raw.match(/(?:对方|来户|付款方|收款方|单位|商户)[:：]\s*([^\s,，;；]+)/)
  const counterparty = counterpartyMatch ? counterpartyMatch[1] : null

  const summary = raw.replace(/\s+/g, ' ').slice(0, 200)

  return {
    ok: amount != null && amount > 0,
    amount,
    date,
    direction,
    summary,
    counterparty,
    reason: amount == null || amount <= 0 ? '未识别到有效金额' : direction == null ? '未识别收支方向，请人工确认' : undefined
  }
}

export interface ExpensePolicySnapshot {
  policyCode: string
  policyName: string
  category?: string | null
  maxAmount?: number | null
  requireInvoice?: boolean
  requireApproval?: boolean
  keywords?: string[]
}

export interface ExpensePolicyResult {
  ok: boolean
  level: 'PASS' | 'WARN' | 'REJECT'
  violations: Array<{ type: string; message: string; level: 'WARN' | 'REJECT' }>
  suggestions: string[]
}

/**
 * 费用政策校验：金额超限直接驳回，缺发票驳回，缺审批给警告。
 */
export function evaluateExpensePolicy(
  amount: number,
  policy: ExpensePolicySnapshot | null,
  context: { hasInvoice?: boolean; approved?: boolean; category?: string; summary?: string } = {}
): ExpensePolicyResult {
  const value = Number(amount) || 0
  const violations: ExpensePolicyResult['violations'] = []
  const suggestions: string[] = []
  if (!policy) {
    return { ok: true, level: 'PASS', violations, suggestions: ['未匹配到费用政策，按默认规则处理'] }
  }
  if (context.category && policy.category && context.category !== policy.category) {
    violations.push({ type: 'CATEGORY_MISMATCH', message: `费用类别 ${context.category} 与政策 ${policy.policyCode} 不匹配`, level: 'WARN' })
  }
  if (policy.maxAmount != null && value > Number(policy.maxAmount)) {
    violations.push({ type: 'AMOUNT_EXCEED', message: `金额 ${value} 超过政策上限 ${policy.maxAmount}`, level: 'REJECT' })
    suggestions.push('拆分为多笔或提交超额审批')
  }
  if (policy.requireInvoice && !context.hasInvoice) {
    violations.push({ type: 'INVOICE_MISSING', message: '政策要求提供发票附件', level: 'REJECT' })
    suggestions.push('补充发票附件后重新提交')
  }
  if (policy.requireApproval && !context.approved) {
    violations.push({ type: 'APPROVAL_MISSING', message: '政策要求先完成审批', level: 'WARN' })
    suggestions.push('提交上级审批')
  }
  const hasReject = violations.some((item) => item.level === 'REJECT')
  const hasWarn = violations.length > 0
  return {
    ok: !hasReject && !hasWarn,
    level: hasReject ? 'REJECT' : hasWarn ? 'WARN' : 'PASS',
    violations,
    suggestions
  }
}

/* ---------------- 账龄风险、催收建议与坏账计提 ---------------- */

export interface AgingReceivable {
  customerId: number
  customerName?: string
  receivableId?: number
  amount: number
  receivedAmount: number
  dueDate?: string | null
  lastContactAt?: string | Date | null
}

export interface AgingRiskRow {
  customerId: number
  customerName: string
  receivableId: number | null
  remain: number
  overdueDays: number
  bucket: 'CURRENT' | 'D31' | 'D61' | 'D91'
  level: 'NORMAL' | 'LOW' | 'MEDIUM' | 'HIGH'
  suggestion: string
  action: string
}

function toTime(value: string | Date | null | undefined): number {
  if (!value) return 0
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

/** 账龄风险分级与催收建议 */
export function buildAgingRisk(rows: AgingReceivable[], now: Date | string = new Date()): AgingRiskRow[] {
  const current = toTime(now)
  return rows
    .map((row) => {
      const remain = Number((Number(row.amount) - Number(row.receivedAmount)).toFixed(4))
      const due = toTime(row.dueDate)
      const overdueDays = due > 0 ? Math.max(0, Math.floor((current - due) / 86_400_000)) : 0
      const bucket: AgingRiskRow['bucket'] = overdueDays <= 30 ? 'CURRENT' : overdueDays <= 60 ? 'D31' : overdueDays <= 90 ? 'D61' : 'D91'
      const level: AgingRiskRow['level'] = overdueDays > 90 ? 'HIGH' : overdueDays > 60 ? 'MEDIUM' : overdueDays > 0 ? 'LOW' : 'NORMAL'
      const contacted = row.lastContactAt ? Math.floor((current - toTime(row.lastContactAt)) / 86_400_000) : null
      const suggestion = level === 'HIGH'
        ? '逾期超过 90 天，建议立即电话催收并启动法务预警'
        : level === 'MEDIUM'
          ? '逾期超过 60 天，建议书面催收函并暂停新增授信'
          : level === 'LOW'
            ? '逾期未超 60 天，建议提前提醒客户安排付款'
            : '未逾期，保持常规跟进'
      const action = contacted == null
        ? '首次触达'
        : contacted > 30
          ? '距上次触达超过 30 天，需重新触达'
          : '继续跟进'
      return {
        customerId: row.customerId,
        customerName: row.customerName ?? `客户 ${row.customerId}`,
        receivableId: row.receivableId ?? null,
        remain,
        overdueDays,
        bucket,
        level,
        suggestion,
        action
      }
    })
    .filter((row) => row.remain > 0)
    .sort((a, b) => b.overdueDays - a.overdueDays || b.remain - a.remain)
}

export interface BadDebtProvisionResult {
  total: number
  rows: Array<{ customerId: number; customerName: string; bucket: string; receivableAmount: number; rate: number; amount: number }>
}

/** 坏账计提建议：按账龄区间比例计提 */
export function suggestBadDebtProvision(
  rows: AgingRiskRow[],
  rates: { current: number; days31: number; days61: number; days91: number }
): BadDebtProvisionResult {
  const rateOf = (bucket: AgingRiskRow['bucket']): number => {
    if (bucket === 'CURRENT') return Number(rates.current) || 0
    if (bucket === 'D31') return Number(rates.days31) || 0
    if (bucket === 'D61') return Number(rates.days61) || 0
    return Number(rates.days91) || 0
  }
  const grouped = new Map<number, { customerId: number; customerName: string; bucket: string; receivableAmount: number; rate: number; amount: number }>()
  for (const row of rows) {
    const rate = rateOf(row.bucket)
    if (rate <= 0) continue
    const amount = Number((row.remain * rate).toFixed(4))
    const key = row.customerId * 1000 + (row.bucket === 'CURRENT' ? 1 : row.bucket === 'D31' ? 2 : row.bucket === 'D61' ? 3 : 4)
    const existing = grouped.get(key)
    if (existing) {
      existing.receivableAmount = Number((existing.receivableAmount + row.remain).toFixed(4))
      existing.amount = Number((existing.amount + amount).toFixed(4))
    } else {
      grouped.set(key, {
        customerId: row.customerId,
        customerName: row.customerName,
        bucket: row.bucket,
        receivableAmount: row.remain,
        rate,
        amount
      })
    }
  }
  const list = [...grouped.values()]
  return { total: Number(list.reduce((sum, item) => sum + item.amount, 0).toFixed(4)), rows: list }
}

/* ---------------- 银行流水自动匹配 ---------------- */

export interface BankTransactionSnapshot {
  id: number
  externalNo: string
  direction: 'IN' | 'OUT'
  amount: number
  txDate?: string | null
  summary?: string | null
  counterparty?: string | null
}

export interface BankMatchCandidate {
  bizType: string
  bizId: number
  amount: number
  date?: string | null
  counterparty?: string | null
  refNo?: string | null
}

export interface BankMatchResult {
  transactionId: number
  externalNo: string
  matched: boolean
  bizType: string | null
  bizId: number | null
  score: number
  difference: number
  reason: string
}

/**
 * 银行流水自动匹配：金额权重最高，辅以日期、对手方与流水号匹配。
 * 得分低于阈值视为未匹配，避免误核销。
 */
export function matchBankTransactions(
  transactions: BankTransactionSnapshot[],
  candidates: BankMatchCandidate[],
  threshold = 60,
  tolerance = 0.01
): BankMatchResult[] {
  return transactions.map((tx) => {
    let best: BankMatchResult | null = null
    for (const candidate of candidates) {
      const difference = Number((Math.abs(tx.amount) - Math.abs(candidate.amount)).toFixed(4))
      let score = 0
      const reasons: string[] = []
      if (difference <= tolerance) {
        score += 60
        reasons.push('金额完全一致')
      } else if (difference <= Math.max(1, Math.abs(tx.amount) * 0.01)) {
        score += 35
        reasons.push(`金额接近（差 ${difference}）`)
      }
      if (tx.externalNo && candidate.refNo && tx.externalNo === candidate.refNo) {
        score += 25
        reasons.push('流水号一致')
      }
      const txDate = toTime(tx.txDate)
      const candidateDate = toTime(candidate.date)
      if (txDate && candidateDate) {
        const days = Math.abs(txDate - candidateDate) / 86_400_000
        if (days <= 1) {
          score += 15
          reasons.push('日期接近')
        } else if (days <= 5) {
          score += 8
          reasons.push('日期相差 5 天内')
        }
      }
      const overlap = overlapScore(tx.counterparty ?? tx.summary ?? '', candidate.counterparty ?? '')
      if (overlap > 0) {
        score += Math.round(overlap * 15)
        reasons.push('对手方/摘要相似')
      }
      const result: BankMatchResult = {
        transactionId: tx.id,
        externalNo: tx.externalNo,
        matched: score >= threshold,
        bizType: score >= threshold ? candidate.bizType : null,
        bizId: score >= threshold ? candidate.bizId : null,
        score,
        difference,
        reason: reasons.length > 0 ? reasons.join('；') : '无匹配特征'
      }
      if (!best || result.score > best.score) best = result
    }
    return best ?? {
      transactionId: tx.id,
      externalNo: tx.externalNo,
      matched: false,
      bizType: null,
      bizId: null,
      score: 0,
      difference: Number(Math.abs(tx.amount).toFixed(4)),
      reason: '无可匹配单据'
    }
  })
}

/* ---------------- 现金流日历与情景模拟 ---------------- */

export interface CashFlowDay {
  date: string
  inflow: number
  outflow: number
}

export interface CashFlowScenario {
  scenarioType: 'BASE' | 'OPTIMISTIC' | 'PESSIMISTIC'
  inflowFactor: number
  outflowFactor: number
  oneOff?: number
}

export interface CashFlowSimulationRow extends CashFlowDay {
  net: number
  cumulative: number
  endingBalance: number
}

export interface CashFlowSimulation {
  scenarioType: string
  rows: CashFlowSimulationRow[]
  totalInflow: number
  totalOutflow: number
  net: number
  endingBalance: number
  minBalance: number
  warning: string | null
}

/** 现金流情景模拟：按情景系数调整收支并推演期末余额 */
export function simulateCashFlow(
  days: CashFlowDay[],
  scenario: CashFlowScenario,
  openingBalance = 0
): CashFlowSimulation {
  const inflowFactor = Number(scenario.inflowFactor) || 0
  const outflowFactor = Number(scenario.outflowFactor) || 0
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  let cumulative = Number(openingBalance) || 0
  let minBalance = cumulative
  let totalInflow = 0
  let totalOutflow = 0
  const rows: CashFlowSimulationRow[] = sorted.map((day) => {
    const inflow = Number((Number(day.inflow || 0) * inflowFactor).toFixed(4))
    const outflow = Number((Number(day.outflow || 0) * outflowFactor).toFixed(4))
    const net = Number((inflow - outflow).toFixed(4))
    cumulative = Number((cumulative + net).toFixed(4))
    totalInflow += inflow
    totalOutflow += outflow
    if (cumulative < minBalance) minBalance = cumulative
    return { date: day.date, inflow, outflow, net, cumulative, endingBalance: cumulative }
  })
  const oneOff = Number(scenario.oneOff) || 0
  if (oneOff !== 0) {
    cumulative = Number((cumulative + oneOff).toFixed(4))
    if (rows.length > 0) {
      rows[rows.length - 1].endingBalance = cumulative
      rows[rows.length - 1].cumulative = cumulative
    }
    if (cumulative < minBalance) minBalance = cumulative
  }
  return {
    scenarioType: scenario.scenarioType,
    rows,
    totalInflow: Number(totalInflow.toFixed(4)),
    totalOutflow: Number(totalOutflow.toFixed(4)),
    net: Number((totalInflow - totalOutflow).toFixed(4)),
    endingBalance: Number(cumulative.toFixed(4)),
    minBalance: Number(minBalance.toFixed(4)),
    warning: minBalance < 0 ? `情景 ${scenario.scenarioType} 下存在资金缺口，最低余额 ${Number(minBalance.toFixed(2))}` : null
  }
}

/* ---------------- 成本重算任务回滚 ---------------- */

export interface CostJobSnapshot {
  id: number
  status: string
  period: string
  snapshot?: unknown
}

export interface CostRollbackResult {
  ok: boolean
  reason?: string
  restoredItems: number
}

/**
 * 成本重算回滚：仅已完成且存在快照的任务允许回滚。
 */
export function evaluateCostRollback(job: CostJobSnapshot, restoredItems = 0): CostRollbackResult {
  if (job.status === 'RUNNING' || job.status === 'PENDING') {
    return { ok: false, reason: '任务尚未完成，无法回滚', restoredItems: 0 }
  }
  if (job.status !== 'DONE' && job.status !== 'FAILED') {
    return { ok: false, reason: `任务状态 ${job.status} 不支持回滚`, restoredItems: 0 }
  }
  if (!job.snapshot) {
    return { ok: false, reason: '任务缺少成本快照，无法回滚', restoredItems: 0 }
  }
  return { ok: true, restoredItems: Math.max(0, restoredItems) }
}

/* ---------------- 月结检查清单与反结账 ---------------- */

export interface PeriodCheckItem {
  code: string
  name: string
  passed: boolean
  detail?: string
  severity: 'BLOCK' | 'WARN'
}

export interface PeriodChecklistResult {
  ok: boolean
  blocking: string[]
  warnings: string[]
  items: PeriodCheckItem[]
}

/** 月结检查清单：BLOCK 级不通过不允许结账，WARN 级仅提示 */
export function evaluatePeriodChecklist(items: PeriodCheckItem[]): PeriodChecklistResult {
  const blocking = items
    .filter((item) => !item.passed && item.severity === 'BLOCK')
    .map((item) => `${item.name}${item.detail ? `：${item.detail}` : ''}`)
  const warnings = items
    .filter((item) => !item.passed && item.severity === 'WARN')
    .map((item) => `${item.name}${item.detail ? `：${item.detail}` : ''}`)
  return { ok: blocking.length === 0, blocking, warnings, items }
}

export interface PeriodReopenContext {
  periodStatus: string
  hasPendingCostJob?: boolean
  hasUnreversedRedFlush?: boolean
  hasOccupiedBudget?: boolean
  hasPostedVoucherAfterClose?: boolean
}

/**
 * 反结账校验：期间必须已结账，且不存在未完成的成本任务、未冲销红冲凭证与已占用预算。
 */
export function canReopenPeriod(context: PeriodReopenContext): { ok: boolean; reason?: string } {
  if (context.periodStatus !== 'CLOSED') return { ok: false, reason: '仅已结账期间可以反结账' }
  if (context.hasPendingCostJob) return { ok: false, reason: '存在未完成的成本重算任务，请先完成或回滚' }
  if (context.hasUnreversedRedFlush) return { ok: false, reason: '存在未冲销的红字凭证' }
  if (context.hasOccupiedBudget) return { ok: false, reason: '存在已占用的预算占用记录' }
  if (context.hasPostedVoucherAfterClose) return { ok: false, reason: '结账后存在新过账凭证，请先反过账' }
  return { ok: true }
}

/* ---------------- 预算编制控制占用 ---------------- */

export interface BudgetSnapshot {
  id: number
  period: string
  deptId?: number | null
  subjectId?: number | null
  budgetAmount: number
  usedAmount: number
  occupiedAmount?: number
  controlRule?: 'WARN' | 'STRICT'
}

export interface BudgetOccupationResult {
  ok: boolean
  level: 'PASS' | 'WARN' | 'REJECT'
  available: number
  used: number
  occupied: number
  remaining: number
  reason: string | null
}

/**
 * 预算占用校验：可用 = 预算 - 已用 - 已占用。
 * STRICT 控制规则下超预算直接驳回，WARN 下仅告警。
 */
export function checkBudgetOccupation(budget: BudgetSnapshot, amount: number): BudgetOccupationResult {
  const request = Number(amount) || 0
  const budgetAmount = Number(budget.budgetAmount) || 0
  const used = Number(budget.usedAmount) || 0
  const occupied = Number(budget.occupiedAmount) || 0
  const available = Number((budgetAmount - used - occupied).toFixed(4))
  const remaining = Number((available - request).toFixed(4))
  if (request <= 0) {
    return { ok: true, level: 'PASS', available, used, occupied, remaining: available, reason: null }
  }
  if (remaining < 0) {
    const strict = (budget.controlRule ?? 'WARN') === 'STRICT'
    return {
      ok: !strict,
      level: strict ? 'REJECT' : 'WARN',
      available,
      used,
      occupied,
      remaining,
      reason: `占用 ${request} 超出可用预算 ${available}`
    }
  }
  return { ok: true, level: 'PASS', available, used, occupied, remaining, reason: null }
}

export interface BudgetOccupyRequest {
  period: string
  deptId?: number | null
  subjectId?: number | null
  amount: number
  bizType?: string | null
  bizId?: number | null
}

export interface BudgetAllocation {
  budgetId: number
  amount: number
  level: 'PASS' | 'WARN' | 'REJECT'
  reason: string | null
}

/**
 * 预算编制控制占用：将一笔申请按「期间 + 部门 + 科目」匹配到预算并判定占用结果。
 * 匹配优先级：部门+科目 > 科目 > 部门 > 期间。
 */
export function allocateBudgetOccupation(
  budgets: BudgetSnapshot[],
  request: BudgetOccupyRequest
): { allocations: BudgetAllocation[]; total: number; ok: boolean; level: 'PASS' | 'WARN' | 'REJECT' } {
  const amount = Number(request.amount) || 0
  const matched = budgets.filter((budget) => {
    if (budget.period !== request.period) return false
    const deptOk = request.deptId == null || budget.deptId == null || budget.deptId === request.deptId
    const subjectOk = request.subjectId == null || budget.subjectId == null || budget.subjectId === request.subjectId
    return deptOk && subjectOk
  })
  if (matched.length === 0) {
    return { allocations: [], total: 0, ok: true, level: 'PASS' }
  }
  matched.sort((a, b) => {
    const score = (item: BudgetSnapshot): number =>
      (request.deptId != null && item.deptId === request.deptId ? 2 : 0) +
      (request.subjectId != null && item.subjectId === request.subjectId ? 1 : 0)
    return score(b) - score(a) || a.id - b.id
  })
  const target = matched[0]
  const check = checkBudgetOccupation(target, amount)
  return {
    allocations: [{ budgetId: target.id, amount: check.level === 'REJECT' ? 0 : amount, level: check.level, reason: check.reason }],
    total: check.level === 'REJECT' ? 0 : amount,
    ok: check.ok,
    level: check.level
  }
}

/* ---------------- 财务仪表盘指标下钻 ---------------- */

export interface FinanceMetric {
  key: string
  label: string
  value: number
  unit?: string
  target?: number | null
  drillKey?: string | null
}

export interface FinanceMetricView extends FinanceMetric {
  status: 'GOOD' | 'WARN' | 'BAD'
  drillable: boolean
}

/** 仪表盘指标：与目标对比给出健康度，并标注是否支持下钻 */
export function buildDashboardMetrics(metrics: FinanceMetric[]): FinanceMetricView[] {
  return metrics.map((metric) => {
    const target = metric.target
    let status: FinanceMetricView['status'] = 'GOOD'
    if (target != null && target !== 0) {
      const rate = metric.value / target
      if (rate < 0.8) status = 'BAD'
      else if (rate < 1) status = 'WARN'
    }
    return { ...metric, status, drillable: Boolean(metric.drillKey) }
  })
}