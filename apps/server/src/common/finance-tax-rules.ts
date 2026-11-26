/**
 * 税务申报与类别主数据规则：税码税率校验、销项/进项税额计算、申报汇总、类别码校验。
 */

export interface TaxCodeInput {
  code: string
  name: string
  rate: number
  taxType: 'VAT' | 'CIT' | 'SURTAX' | 'STAMP' | 'OTHER'
  direction: 'OUTPUT' | 'INPUT' | 'BOTH'
  status: string
}

/** 税码参数校验 */
export function validateTaxCode(input: TaxCodeInput): { ok: boolean; reason?: string } {
  if (!input.code?.trim()) return { ok: false, reason: '税码编码不能为空' }
  if (!input.name?.trim()) return { ok: false, reason: '税码名称不能为空' }
  if (!Number.isFinite(input.rate) || input.rate < 0 || input.rate > 1) {
    return { ok: false, reason: '税率必须在 0~1 之间' }
  }
  if (!['VAT', 'CIT', 'SURTAX', 'STAMP', 'OTHER'].includes(input.taxType)) {
    return { ok: false, reason: '税种不合法' }
  }
  return { ok: true }
}

/** 价税分离：不含税金额 × 税率 = 税额 */
export function computeTaxAmount(amount: number, rate: number, inclusive = false): {
  netAmount: number
  taxAmount: number
  grossAmount: number
} {
  const safeRate = Number.isFinite(rate) ? Math.max(0, rate) : 0
  const gross = Number.isFinite(amount) ? Math.max(0, amount) : 0
  const net = inclusive ? Number((gross / (1 + safeRate)).toFixed(4)) : gross
  const tax = Number((net * safeRate).toFixed(4))
  return {
    netAmount: net,
    taxAmount: tax,
    grossAmount: Number((net + tax).toFixed(4))
  }
}

/** 申报行输入 */
export interface TaxDeclarationInput {
  taxCode: string
  taxName: string
  taxType: string
  direction: 'OUTPUT' | 'INPUT' | 'BOTH'
  taxableAmount: number
  taxAmount: number
  deductibleAmount?: number
}

/** 申报汇总行 */
export interface TaxDeclarationRow {
  taxCode: string
  taxName: string
  taxType: string
  outputTax: number
  inputTax: number
  netTax: number
}

/** 按税码汇总销项/进项税额 */
export function buildTaxDeclaration(rows: TaxDeclarationInput[]): {
  rows: TaxDeclarationRow[]
  totalOutputTax: number
  totalInputTax: number
  taxPayable: number
} {
  const map = new Map<string, TaxDeclarationRow>()
  for (const row of rows) {
    const current = map.get(row.taxCode) ?? {
      taxCode: row.taxCode,
      taxName: row.taxName,
      taxType: row.taxType,
      outputTax: 0,
      inputTax: 0,
      netTax: 0
    }
    const amount = Number.isFinite(row.taxAmount) ? row.taxAmount : 0
    if (row.direction === 'OUTPUT' || row.direction === 'BOTH') current.outputTax += amount
    if (row.direction === 'INPUT' || row.direction === 'BOTH') {
      current.inputTax += row.deductibleAmount !== undefined && Number.isFinite(row.deductibleAmount)
        ? Math.min(amount, row.deductibleAmount)
        : amount
    }
    map.set(row.taxCode, current)
  }
  const result = [...map.values()].map((row) => ({
    ...row,
    outputTax: Number(row.outputTax.toFixed(4)),
    inputTax: Number(row.inputTax.toFixed(4)),
    netTax: Number((row.outputTax - row.inputTax).toFixed(4))
  }))
  const totalOutputTax = Number(result.reduce((sum, row) => sum + row.outputTax, 0).toFixed(4))
  const totalInputTax = Number(result.reduce((sum, row) => sum + row.inputTax, 0).toFixed(4))
  return { rows: result, totalOutputTax, totalInputTax, taxPayable: Number((totalOutputTax - totalInputTax).toFixed(4)) }
}

/** 类别码校验（费用/收入类别主数据） */
export function validateCategory(input: {
  code: string
  name: string
  categoryType: 'EXPENSE' | 'REVENUE'
  parentCode?: string | null
}): { ok: boolean; reason?: string } {
  if (!input.code?.trim()) return { ok: false, reason: '类别编码不能为空' }
  if (!input.name?.trim()) return { ok: false, reason: '类别名称不能为空' }
  if (input.parentCode && input.parentCode === input.code) return { ok: false, reason: '父级类别不能为自身' }
  return { ok: true }
}
