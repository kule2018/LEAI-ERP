/**
 * 财务期间与总账纯逻辑规则：科目余额表、明细账、期末结转、资金转账、资产变更。
 * 与持久层解耦便于单测，供财务服务与其他业务模块复用。
 */

/** 借方为正、贷方为负的余额口径 */
export interface LedgerEntrySnapshot {
  subjectId: number
  voucherId: number
  voucherNo: string
  voucherDate: string
  period: string
  summary: string
  debit: number
  credit: number
  auxType?: string | null
  auxId?: string | null
}

export interface SubjectSnapshot {
  id: number
  subjectCode: string
  subjectName: string
  category: string
  direction: 'DEBIT' | 'CREDIT'
}

export interface SubjectBalanceRow {
  subjectId: number
  subjectCode: string
  subjectName: string
  category: string
  direction: 'DEBIT' | 'CREDIT'
  /** 期初余额（借正贷负） */
  openingBalance: number
  periodDebit: number
  periodCredit: number
  /** 期末余额（借正贷负） */
  closingBalance: number
  /** 余额方向：借方 / 贷方 / 平 */
  balanceDirection: 'DEBIT' | 'CREDIT' | 'FLAT'
}

const round4 = (value: number): number => Number(Number(value).toFixed(4))

/**
 * 科目余额表：期初 + 本期借贷发生额 = 期末
 * @param subjects 科目列表
 * @param entries 本期已过账分录
 * @param openingBalances 上期结转过来的期初余额（借正贷负），缺省视为 0
 */
export function buildSubjectBalanceTable(
  subjects: SubjectSnapshot[],
  entries: LedgerEntrySnapshot[],
  openingBalances: Map<number, number> = new Map()
): SubjectBalanceRow[] {
  const movement = new Map<number, { debit: number; credit: number }>()
  for (const entry of entries) {
    const current = movement.get(entry.subjectId) ?? { debit: 0, credit: 0 }
    current.debit += entry.debit
    current.credit += entry.credit
    movement.set(entry.subjectId, current)
  }
  return subjects.map((subject) => {
    const move = movement.get(subject.id) ?? { debit: 0, credit: 0 }
    const opening = round4(openingBalances.get(subject.id) ?? 0)
    const closing = round4(opening + move.debit - move.credit)
    return {
      subjectId: subject.id,
      subjectCode: subject.subjectCode,
      subjectName: subject.subjectName,
      category: subject.category,
      direction: subject.direction,
      openingBalance: opening,
      periodDebit: round4(move.debit),
      periodCredit: round4(move.credit),
      closingBalance: closing,
      balanceDirection: closing > 0 ? 'DEBIT' : closing < 0 ? 'CREDIT' : 'FLAT'
    }
  })
}

export interface DetailLedgerRow {
  date: string
  voucherId: number
  voucherNo: string
  summary: string
  auxType: string | null
  auxId: string | null
  debit: number
  credit: number
  /** 借贷方向 */
  direction: 'DEBIT' | 'CREDIT'
  /** 累计余额（借正贷负） */
  runningBalance: number
}

/**
 * 明细账：按凭证顺序逐笔累计，期初余额带入首行
 */
export function buildDetailLedger(
  entries: LedgerEntrySnapshot[],
  openingBalance = 0,
  direction: 'DEBIT' | 'CREDIT' = 'DEBIT'
): DetailLedgerRow[] {
  const sorted = [...entries].sort((a, b) =>
    a.voucherDate === b.voucherDate ? a.voucherId - b.voucherId : a.voucherDate < b.voucherDate ? -1 : 1
  )
  let running = round4(openingBalance)
  const rows: DetailLedgerRow[] = sorted.map((entry) => {
    running = round4(running + entry.debit - entry.credit)
    return {
      date: entry.voucherDate,
      voucherId: entry.voucherId,
      voucherNo: entry.voucherNo,
      summary: entry.summary,
      auxType: entry.auxType ?? null,
      auxId: entry.auxId ?? null,
      debit: round4(entry.debit),
      credit: round4(entry.credit),
      direction: entry.debit > 0 ? 'DEBIT' : entry.credit > 0 ? 'CREDIT' : direction,
      runningBalance: running
    }
  })
  return rows
}

export interface CarryForwardSubject {
  subjectId: number
  subjectCode: string
  subjectName: string
  category: string
  /** 期末余额（借正贷负） */
  balance: number
}

export interface CarryForwardEntry {
  subjectId: number
  summary: string
  debit: number
  credit: number
}

export interface CarryForwardPlan {
  entries: CarryForwardEntry[]
  totalDebit: number
  totalCredit: number
  balanced: boolean
  /** 结转后利润（收入 - 费用） */
  profit: number
  warnings: string[]
}

/**
 * 期末结转计划：把损益类科目（INCOME/EXPENSE）本期净额结转到本年利润科目
 * 规则：收入科目余额为贷方 → 借该科目、贷本年利润；费用科目余额为借方 → 借本年利润、贷该科目；
 * 零余额科目不结转；借贷合计必须相等。
 */
export function buildCarryForwardPlan(
  subjects: CarryForwardSubject[],
  options: { profitSubjectId: number; profitSummary?: string }
): CarryForwardPlan {
  const warnings: string[] = []
  const entries: CarryForwardEntry[] = []
  const profitSummary = options.profitSummary ?? '结转本期损益'
  for (const subject of subjects) {
    if (subject.category !== 'INCOME' && subject.category !== 'EXPENSE') continue
    const amount = round4(Math.abs(subject.balance))
    if (amount <= 0) continue
    if (subject.category === 'INCOME') {
      // 收入为贷方余额：借记收入科目冲平
      entries.push({ subjectId: subject.subjectId, summary: `结转${subject.subjectName}`, debit: amount, credit: 0 })
      entries.push({ subjectId: options.profitSubjectId, summary: profitSummary, debit: 0, credit: amount })
    } else {
      // 费用为借方余额：贷记费用科目冲平
      entries.push({ subjectId: options.profitSubjectId, summary: profitSummary, debit: amount, credit: 0 })
      entries.push({ subjectId: subject.subjectId, summary: `结转${subject.subjectName}`, debit: 0, credit: amount })
    }
  }
  const totalDebit = round4(entries.reduce((sum, item) => sum + item.debit, 0))
  const totalCredit = round4(entries.reduce((sum, item) => sum + item.credit, 0))
  if (!options.profitSubjectId || options.profitSubjectId <= 0) warnings.push('未指定本年利润科目，无法结转')
  if (entries.length === 0) warnings.push('本期无损益类科目发生额，无需结转')
  const income = subjects.filter((s) => s.category === 'INCOME').reduce((sum, s) => sum - s.balance, 0)
  const expense = subjects.filter((s) => s.category === 'EXPENSE').reduce((sum, s) => sum + s.balance, 0)
  return {
    entries,
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.0001,
    profit: round4(income - expense),
    warnings
  }
}

export interface AccountTransferInput {
  fromAccountId: number
  toAccountId: number
  amount: number
  fromBalance: number
  fromStatus?: string
  toStatus?: string
}

/** 资金账户间转账校验：同账户、金额、余额、账户状态 */
export function validateAccountTransfer(input: AccountTransferInput): { ok: boolean; reason?: string } {
  if (!input.fromAccountId || !input.toAccountId) return { ok: false, reason: '请选择转出与转入资金账户' }
  if (input.fromAccountId === input.toAccountId) return { ok: false, reason: '转出与转入账户不能相同' }
  if (!Number.isFinite(input.amount) || input.amount <= 0) return { ok: false, reason: '转账金额必须大于 0' }
  if (input.fromStatus && input.fromStatus !== 'ACTIVE') return { ok: false, reason: '转出账户已停用' }
  if (input.toStatus && input.toStatus !== 'ACTIVE') return { ok: false, reason: '转入账户已停用' }
  if (input.amount > input.fromBalance + 0.0001) return { ok: false, reason: '转出账户余额不足' }
  return { ok: true }
}

/**
 * 期初余额合并：期初余额表（导入/录入）优先，历史分录倒推作为兜底
 */
export function mergeOpeningBalances(
  imported: Map<number, number>,
  derived: Map<number, number>
): Map<number, number> {
  const result = new Map<number, number>()
  for (const [subjectId, amount] of derived) result.set(subjectId, round4(amount))
  for (const [subjectId, amount] of imported) result.set(subjectId, round4(amount))
  return result
}

/** 多科目明细账分组 */
export interface GroupedDetailLedger {
  subjectId: number
  subjectCode: string
  subjectName: string
  direction: 'DEBIT' | 'CREDIT'
  openingBalance: number
  rows: DetailLedgerRow[]
  periodDebit: number
  periodCredit: number
  closingBalance: number
}

/**
 * 明细账（多科目）：按科目分组逐笔累计，支持科目集合、日期区间与凭证号过滤
 */
export function buildGroupedDetailLedger(
  entries: LedgerEntrySnapshot[],
  subjects: SubjectSnapshot[],
  options: {
    openingBalances?: Map<number, number>
    subjectIds?: number[]
    beginDate?: string
    endDate?: string
    voucherNo?: string
  } = {}
): GroupedDetailLedger[] {
  const subjectMap = new Map(subjects.map((item) => [item.id, item]))
  const wanted = options.subjectIds && options.subjectIds.length > 0 ? new Set(options.subjectIds) : null
  const groups = new Map<number, LedgerEntrySnapshot[]>()
  for (const entry of entries) {
    if (wanted && !wanted.has(entry.subjectId)) continue
    if (options.beginDate && entry.voucherDate < options.beginDate) continue
    if (options.endDate && entry.voucherDate > options.endDate) continue
    if (options.voucherNo && !entry.voucherNo.includes(options.voucherNo)) continue
    const list = groups.get(entry.subjectId) ?? []
    list.push(entry)
    groups.set(entry.subjectId, list)
  }
  const result: GroupedDetailLedger[] = []
  for (const [subjectId, list] of groups) {
    const subject = subjectMap.get(subjectId)
    const direction = subject?.direction === 'CREDIT' ? 'CREDIT' : 'DEBIT'
    const rows = buildDetailLedger(list, options.openingBalances?.get(subjectId) ?? 0, direction)
    const periodDebit = round4(rows.reduce((sum, row) => sum + row.debit, 0))
    const periodCredit = round4(rows.reduce((sum, row) => sum + row.credit, 0))
    result.push({
      subjectId,
      subjectCode: subject?.subjectCode ?? '',
      subjectName: subject?.subjectName ?? '',
      direction,
      openingBalance: round4(options.openingBalances?.get(subjectId) ?? 0),
      rows,
      periodDebit,
      periodCredit,
      closingBalance: round4((options.openingBalances?.get(subjectId) ?? 0) + periodDebit - periodCredit)
    })
  }
  return result.sort((a, b) => (a.subjectCode < b.subjectCode ? -1 : a.subjectCode > b.subjectCode ? 1 : 0))
}

/** 指定科目结转计划 */
export interface SubjectCarryForwardPlan {
  entries: CarryForwardEntry[]
  totalDebit: number
  totalCredit: number
  balanced: boolean
  warnings: string[]
}

/**
 * 结转指定科目（库存/往来/待处理等资产负债类科目）：
 * 借方余额科目 → 借记该科目、贷记目标科目；贷方余额科目 → 借记目标科目、贷记该科目。
 */
export function buildSubjectCarryForwardPlan(
  subjects: CarryForwardSubject[],
  options: { targetSubjectId: number; summary?: string }
): SubjectCarryForwardPlan {
  const warnings: string[] = []
  const entries: CarryForwardEntry[] = []
  const summary = options.summary ?? '结转指定科目余额'
  if (!options.targetSubjectId || options.targetSubjectId <= 0) {
    return { entries, totalDebit: 0, totalCredit: 0, balanced: true, warnings: ['未指定结转目标科目'] }
  }
  for (const subject of subjects) {
    if (subject.subjectId === options.targetSubjectId) continue
    const amount = round4(Math.abs(subject.balance))
    if (amount <= 0) continue
    if (subject.balance > 0) {
      entries.push({ subjectId: subject.subjectId, summary: `结转${subject.subjectName}`, debit: amount, credit: 0 })
      entries.push({ subjectId: options.targetSubjectId, summary, debit: 0, credit: amount })
    } else {
      entries.push({ subjectId: options.targetSubjectId, summary, debit: amount, credit: 0 })
      entries.push({ subjectId: subject.subjectId, summary: `结转${subject.subjectName}`, debit: 0, credit: amount })
    }
  }
  const totalDebit = round4(entries.reduce((sum, item) => sum + item.debit, 0))
  const totalCredit = round4(entries.reduce((sum, item) => sum + item.credit, 0))
  if (entries.length === 0) warnings.push('所选科目无余额，无需结转')
  return {
    entries,
    totalDebit,
    totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.0001,
    warnings
  }
}

/**
 * 反结转校验：结转记录已完成、期间未结账、结转凭证已过账才可反结转
 */
export function evaluateCarryForwardReversal(input: {
  carryStatus: string
  periodStatus?: string
  voucherStatus?: string
}): { ok: boolean; reason?: string } {
  if (input.carryStatus !== 'DONE') return { ok: false, reason: '结转记录未完成，无法反结转' }
  if (input.periodStatus === 'CLOSED') return { ok: false, reason: '该期间已结账，无法反结转' }
  if (input.voucherStatus && input.voucherStatus !== 'POSTED') {
    return { ok: false, reason: '结转凭证状态异常，无法反结转' }
  }
  return { ok: true }
}

export interface AssetChangeField {
  field: string
  label: string
  before: string | number | null
  after: string | number | null
}

/** 资产变更差异：仅返回发生变化的字段 */
export function buildAssetChangeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  labels: Record<string, string>
): AssetChangeField[] {
  const fields: AssetChangeField[] = []
  for (const [field, label] of Object.entries(labels)) {
    const from = before[field] ?? null
    const to = after[field] ?? null
    if (String(from ?? '') === String(to ?? '')) continue
    fields.push({ field, label, before: from as string | number | null, after: to as string | number | null })
  }
  return fields
}
