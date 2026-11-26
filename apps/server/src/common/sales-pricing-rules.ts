/**
 * 销售拆单与替代规则（纯函数，便于单元测试与复用）。
 * 底价校验复用 `common/pricing-engine` 的 `checkFloorPrice`。
 */

/**
 * 缺货替代校验：替代品必须与原产品同品类。
 */
export function checkSubstituteCategory(
  originProductName: string,
  originCategoryId: number | null | undefined,
  substituteProductName: string,
  substituteCategoryId: number | null | undefined
): string {
  if (!originCategoryId || !substituteCategoryId) {
    return `替代品「${substituteProductName}」缺少品类，无法校验替代关系`
  }
  if (originCategoryId !== substituteCategoryId) {
    return `替代品「${substituteProductName}」与原产品「${originProductName}」品类不一致`
  }
  return ''
}

/**
 * 拆单校验：至少需要拆出一行，且原单需保留至少一行。
 */
export function checkSplitSelection(pickedCount: number, totalCount: number): string {
  if (pickedCount <= 0) return '未选择需要拆分的明细行'
  if (pickedCount >= totalCount) return '不能拆出全部明细行，原单需至少保留一行'
  return ''
}
