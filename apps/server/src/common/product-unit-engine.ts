/**
 * 产品多单位换算纯逻辑：换算率校验、单位间换算、基准单位解析。
 * 换算率定义：1 个该单位 = conversionRate 个基准单位。
 * 与持久层解耦，便于单元测试。
 */

export interface UnitConversionRow {
  unitId: number
  unitCode?: string
  unitName?: string
  conversionRate: number
  isBase: boolean
}

export interface UnitOption {
  unitId: number
  unitCode: string
  unitName: string
  conversionRate: number
  isBase: boolean
  /** 1 个该单位折合多少个基准单位 */
  baseQty: number
}

/**
 * 校验一组单位换算配置：
 * - 换算率必须为正数
 * - 同一产品下单位不可重复
 * - 必须且只能有一个基准单位，且基准单位换算率为 1
 */
export function validateConversionSet(rows: UnitConversionRow[]): string[] {
  const issues: string[] = []
  if (rows.length === 0) {
    issues.push('至少需要配置一个计量单位')
    return issues
  }
  const seen = new Set<number>()
  let baseCount = 0
  for (const row of rows) {
    if (!Number.isFinite(row.conversionRate) || row.conversionRate <= 0) {
      issues.push(`单位 ${row.unitId} 的换算率必须大于 0`)
    }
    if (seen.has(row.unitId)) {
      issues.push(`单位 ${row.unitId} 重复配置`)
    }
    seen.add(row.unitId)
    if (row.isBase) {
      baseCount += 1
      if (Math.abs(row.conversionRate - 1) > 1e-6) {
        issues.push(`基准单位 ${row.unitId} 的换算率必须为 1`)
      }
    }
  }
  if (baseCount === 0) {
    issues.push('必须指定一个基准单位')
  }
  if (baseCount > 1) {
    issues.push('只能存在一个基准单位')
  }
  return issues
}

/** 数量换算：qty 个 fromRate 单位 = qty * fromRate / toRate 个 toRate 单位 */
export function convertQuantity(qty: number, fromRate: number, toRate: number): number {
  if (!Number.isFinite(qty) || !Number.isFinite(fromRate) || !Number.isFinite(toRate)) return 0
  if (fromRate <= 0 || toRate <= 0) return 0
  return Number((qty * fromRate / toRate).toFixed(6))
}

/** 解析基准单位换算率；没有显式基准时退回首行 */
export function resolveBaseRate(rows: UnitConversionRow[]): number {
  const base = rows.find((row) => row.isBase) ?? rows[0]
  return base ? base.conversionRate : 1
}

/** 生成单位下拉选项（含折合基准数量），供单据录入使用 */
export function buildUnitOptions(rows: UnitConversionRow[]): UnitOption[] {
  const baseRate = resolveBaseRate(rows)
  return rows.map((row) => ({
    unitId: row.unitId,
    unitCode: row.unitCode ?? String(row.unitId),
    unitName: row.unitName ?? '',
    conversionRate: row.conversionRate,
    isBase: row.isBase,
    baseQty: convertQuantity(1, row.conversionRate, baseRate)
  }))
}

/** 把指定单位数量折算成基准单位数量；单位不存在返回 0 */
export function convertToBaseQty(qty: number, unitId: number, rows: UnitConversionRow[]): number {
  const target = rows.find((row) => row.unitId === unitId)
  if (!target) return 0
  return convertQuantity(qty, target.conversionRate, resolveBaseRate(rows))
}
