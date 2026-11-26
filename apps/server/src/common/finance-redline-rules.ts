/**
 * 财务红冲与单据作废规则层
 *
 * 覆盖：凭证作废、单据红冲（应收/应付/收款/付款）、科目停用校验、科目合并。
 */

/* ------------------------------ 凭证作废 ------------------------------ */

export interface VoidVoucherInput {
  /** 凭证状态：DRAFT / POSTED / CANCELLED / VOID */
  status: string
  /** 所属期间是否已结账 */
  periodClosed: boolean
  /** 是否已被其他单据引用 */
  hasReferences: boolean
}

export interface RuleCheck {
  ok: boolean
  reason?: string
}

/**
 * 凭证作废判定：
 * - 仅草稿可作废；已过账需先反审核
 * - 已被红冲或已作废的凭证不可重复作废
 * - 期间已结账禁止作废
 */
export function evaluateVoidVoucher(input: VoidVoucherInput): RuleCheck {
  if (input.status === 'VOID') return { ok: false, reason: '凭证已作废' }
  if (input.status === 'CANCELLED') return { ok: false, reason: '凭证已红冲，无需作废' }
  if (input.status === 'POSTED') return { ok: false, reason: '已过账凭证请先反审核再作废' }
  if (input.status !== 'DRAFT') return { ok: false, reason: '仅草稿凭证可以作废' }
  if (input.periodClosed) return { ok: false, reason: '所属期间已结账，无法作废凭证' }
  if (input.hasReferences) return { ok: false, reason: '凭证已被单据引用，无法作废' }
  return { ok: true }
}

/* ------------------------------ 红字分录 ------------------------------ */

export interface RedLineEntryInput {
  subjectId: number
  summary?: string
  debit?: string | number
  credit?: string | number
  auxType?: string | null
  auxId?: string | null
}

export interface RedLineEntryResult {
  subjectId: number
  summary: string
  debit: string
  credit: string
  auxType?: string | null
  auxId?: string | null
}

/** 红冲分录构造时使用的原分录输入（与凭证分录 DTO 兼容） */

function toNum(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * 生成红字分录：借贷方向互换，金额原样保留，摘要加「红冲」前缀。
 */
export function buildRedLineEntries(entries: RedLineEntryInput[], prefix = '红冲：'): RedLineEntryResult[] {
  return entries.map((entry) => ({
    subjectId: entry.subjectId,
    summary: `${prefix}${entry.summary ?? ''}`,
    debit: toNum(entry.credit).toFixed(4),
    credit: toNum(entry.debit).toFixed(4),
    auxType: entry.auxType ?? null,
    auxId: entry.auxId ?? null
  }))
}

/* ------------------------------ 单据红冲 ------------------------------ */

export type RedLineDocType = 'RECEIVABLE' | 'PAYABLE' | 'RECEIPT' | 'PAYMENT'

export interface RedLineDocInput {
  type: RedLineDocType
  /** 单据金额 */
  amount: string | number
  /** 已核销/已收付金额 */
  settledAmount: string | number
  /** 单据状态 */
  status: string
  /** 所属期间是否已结账 */
  periodClosed: boolean
  /** 坏账计提金额（应收/应付） */
  provisionAmount?: string | number
}

export interface RedLineDocPlan {
  ok: boolean
  reason?: string
  /** 红冲金额 */
  redAmount: number
  /** 需要释放的核销金额 */
  releaseWriteoffAmount: number
  /** 资金账户余额调整额（收款为负，付款为正） */
  accountBalanceDelta: number
  /** 红冲后单据状态 */
  redLineStatus: string
}

/**
 * 单据红冲计划：
 * - 期间已结账禁止红冲
 * - 已计提坏账需先冲回坏账计提
 * - 已核销金额在红冲时自动释放（回退核销记录并恢复单据未核销金额）
 */
export function buildDocumentRedLinePlan(input: RedLineDocInput): RedLineDocPlan {
  const amount = toNum(input.amount)
  const settled = toNum(input.settledAmount)
  const base: RedLineDocPlan = {
    ok: false,
    redAmount: amount,
    releaseWriteoffAmount: settled,
    accountBalanceDelta: 0,
    redLineStatus: 'REVERSED'
  }
  if (input.periodClosed) return { ...base, reason: '所属期间已结账，无法红冲' }
  if (input.status === 'REVERSED') return { ...base, reason: '单据已红冲' }
  if (input.status === 'VOID') return { ...base, reason: '单据已作废' }
  if (amount <= 0) return { ...base, reason: '单据金额必须大于 0' }
  if (toNum(input.provisionAmount) > 0) return { ...base, reason: '该单据已计提坏账，请先冲回坏账计提' }
  const accountBalanceDelta = input.type === 'RECEIPT' ? -amount : input.type === 'PAYMENT' ? amount : 0
  return { ...base, ok: true, accountBalanceDelta }
}

/* ------------------------------ 科目停用 ------------------------------ */

export interface DisableSubjectInput {
  /** 当前状态：ENABLED / DISABLED */
  status: string
  /** 科目余额（借正贷负） */
  balance: string | number
  /** 是否存在使用该科目的凭证分录 */
  usedInVoucher: boolean
}

/**
 * 科目停用校验：科目存在余额时禁止停用，避免历史余额失去归属。
 */
export function canDisableSubject(input: DisableSubjectInput): RuleCheck {
  if (input.status === 'DISABLED') return { ok: false, reason: '科目已停用' }
  if (Math.abs(toNum(input.balance)) > 0.00001) return { ok: false, reason: '科目仍有余额，请先结平后再停用' }
  return { ok: true }
}

/* ------------------------------ 科目合并 ------------------------------ */

export interface MergeSubjectInput {
  /** 源科目余额 */
  sourceBalance: string | number
  /** 目标科目余额 */
  targetBalance: string | number
  /** 源科目分类 */
  sourceCategory: string
  /** 目标科目分类 */
  targetCategory: string
  /** 源科目是否已被凭证使用 */
  sourceUsed: boolean
}

export interface MergeSubjectPlan extends RuleCheck {
  /** 需要迁移的凭证分录条数 */
  migratedEntryCount: number
  /** 合并后期末余额 */
  mergedBalance: string
  /** 合并后被合并科目的状态 */
  sourceStatus: string
}

/**
 * 科目合并计划：分类必须一致；余额按借贷方向合并。
 */
export function buildSubjectMergePlan(input: MergeSubjectInput, migratedEntryCount: number): MergeSubjectPlan {
  const base: MergeSubjectPlan = {
    ok: false,
    migratedEntryCount,
    mergedBalance: '0.0000',
    sourceStatus: 'MERGED'
  }
  if (input.sourceCategory !== input.targetCategory) return { ...base, reason: '只能合并同一分类的科目' }
  const merged = toNum(input.sourceBalance) + toNum(input.targetBalance)
  return { ...base, ok: true, mergedBalance: merged.toFixed(4) }
}

/* ------------------------------ 核销释放 ------------------------------ */

export interface WriteoffReleaseInput {
  /** 单据已核销金额 */
  settledAmount: string | number
  /** 核销记录金额合计 */
  writeoffAmount: string | number
}

/**
 * 核销释放校验：核销记录合计应与单据已核销金额一致，否则拒绝释放。
 */
export function canReleaseWriteoff(input: WriteoffReleaseInput): RuleCheck {
  const settled = toNum(input.settledAmount)
  const writeoff = toNum(input.writeoffAmount)
  if (writeoff <= 0) return { ok: true }
  if (Math.abs(settled - writeoff) > 0.00001) {
    return { ok: false, reason: `核销记录金额 ${writeoff} 与单据已核销金额 ${settled} 不一致，无法释放` }
  }
  return { ok: true }
}
