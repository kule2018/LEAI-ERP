/**
 * 采购与工艺纯逻辑规则：资金流水去重、供应商准入、预算控制、替代料取价、工艺版本生效。
 * 与持久层解耦便于单测。
 */

/** 资金流水去重：按外部流水号去重，返回可导入的唯一记录 */
export function dedupeBankTransactions<T extends { externalNo: string }>(rows: T[]): {
  unique: T[]
  duplicates: string[]
} {
  const seen = new Set<string>()
  const unique: T[] = []
  const duplicates: string[] = []
  for (const row of rows) {
    const key = row.externalNo.trim()
    if (!key || seen.has(key)) {
      duplicates.push(key)
      continue
    }
    seen.add(key)
    unique.push(row)
  }
  return { unique, duplicates }
}

/** 供应商准入评分：资质齐全 + 评级达到门槛 + 非黑名单 */
export function evaluateSupplierAdmission(input: {
  hasBusinessLicense: boolean
  hasQualification: boolean
  blacklisted: boolean
  score: number
  minScore?: number
}): { ok: boolean; reason?: string } {
  if (input.blacklisted) return { ok: false, reason: '供应商在黑名单中' }
  if (!input.hasBusinessLicense) return { ok: false, reason: '缺少营业执照' }
  if (!input.hasQualification) return { ok: false, reason: '缺少资质证明' }
  if (input.score < (input.minScore ?? 60)) return { ok: false, reason: `评分 ${input.score} 低于准入线` }
  return { ok: true }
}

/** 预算控制：按控制规则决定是否放行/警告 */
export function checkBudget(budgetAmount: number, usedAmount: number, requestAmount: number, rule: 'WARN' | 'STRICT' | 'NONE'): {
  allowed: boolean
  warning: boolean
  overAmount: number
} {
  const over = Number((usedAmount + requestAmount - budgetAmount).toFixed(4))
  if (rule === 'NONE') return { allowed: true, warning: false, overAmount: Math.max(0, over) }
  if (rule === 'WARN') return { allowed: true, warning: over > 0, overAmount: Math.max(0, over) }
  return { allowed: over <= 0, warning: false, overAmount: Math.max(0, over) }
}

/** 替代料取价：主料缺货时用替代料，按替代比例换算数量 */
export function resolveSubstitute(
  mainMaterialId: number,
  mainAvailable: number,
  requiredQty: number,
  substitute: { materialId: number; availableQty: number; ratio: number } | null
): { materialId: number; qty: number; usedSubstitute: boolean } | null {
  if (mainAvailable >= requiredQty) return { materialId: mainMaterialId, qty: requiredQty, usedSubstitute: false }
  if (!substitute) return null
  const shortage = requiredQty - mainAvailable
  const neededSubstitute = Math.ceil((shortage / substitute.ratio) * 10000) / 10000
  if (substitute.availableQty < neededSubstitute) return null
  return { materialId: substitute.materialId, qty: neededSubstitute, usedSubstitute: true }
}

/** 工艺版本生效区间判断 */
export function isRoutingEffective(effectiveFrom: string | null, effectiveTo: string | null, date: string): boolean {
  if (effectiveFrom && effectiveFrom > date) return false
  if (effectiveTo && effectiveTo < date) return false
  return true
}
