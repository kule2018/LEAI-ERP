/**
 * 负库存规则（纯函数）
 *
 * 产品文档要求：
 * - 报表需输出「负库存清单」
 * - 负库存必须受权限与系统参数控制（默认不允许负库存）
 */

/** 系统参数键：是否允许负库存 */
export const ALLOW_NEGATIVE_STOCK_KEY = 'inventory.allowNegativeStock'

/** 允许负库存所需权限码 */
export const ALLOW_NEGATIVE_STOCK_PERM = 'inventory:negative:allow'

export interface NegativeStockInput {
  /** 实物量 */
  qtyOnHand: string | number
  /** 占用量 */
  qtyOccupied: string | number
  /** 冻结量 */
  qtyFrozen: string | number
}

/** 负库存级别 */
export type NegativeStockLevel = 'NEGATIVE_ONHAND' | 'NEGATIVE_AVAILABLE' | 'NORMAL'

export interface NegativeStockEvaluation {
  /** 是否负库存 */
  negative: boolean
  /** 负库存级别 */
  level: NegativeStockLevel
  /** 实物量 */
  onHand: number
  /** 占用量 */
  occupied: number
  /** 冻结量 */
  frozen: number
  /** 可用量（允许负库存时保留负数） */
  availableQty: number
  /** 缺口数量（正数表示缺多少） */
  shortageQty: number
}

/**
 * 负库存判定：
 * - 实物量小于 0 → NEGATIVE_ONHAND
 * - 可用量（实物 - 占用 - 冻结）小于 0 → NEGATIVE_AVAILABLE
 */
export function evaluateNegativeStock(input: NegativeStockInput): NegativeStockEvaluation {
  const onHand = num(input.qtyOnHand)
  const occupied = num(input.qtyOccupied)
  const frozen = num(input.qtyFrozen)
  const availableQty = round3(onHand - occupied - frozen)
  if (onHand < 0) {
    return {
      negative: true,
      level: 'NEGATIVE_ONHAND',
      onHand,
      occupied,
      frozen,
      availableQty,
      shortageQty: round3(Math.abs(onHand))
    }
  }
  if (availableQty < 0) {
    return {
      negative: true,
      level: 'NEGATIVE_AVAILABLE',
      onHand,
      occupied,
      frozen,
      availableQty,
      shortageQty: round3(Math.abs(availableQty))
    }
  }
  return {
    negative: false,
    level: 'NORMAL',
    onHand,
    occupied,
    frozen,
    availableQty,
    shortageQty: 0
  }
}

export interface AllowNegativeStockInput {
  /** 系统参数是否开启 */
  configAllowed: boolean
  /** 当前用户是否具备放行权限 */
  hasPermission: boolean
  /** 是否超级管理员 */
  isSuperAdmin?: boolean
}

/**
 * 负库存放行判定：系统参数开启且用户具备权限（或超级管理员）才允许负库存。
 */
export function resolveAllowNegativeStock(input: AllowNegativeStockInput): boolean {
  if (!input.configAllowed) return false
  return input.isSuperAdmin === true || input.hasPermission
}

export interface NegativeStockSummary {
  /** 负库存行数 */
  totalRows: number
  /** 实物量为负的行数 */
  negativeOnHandRows: number
  /** 可用量为负的行数 */
  negativeAvailableRows: number
  /** 缺口合计 */
  totalShortageQty: number
}

/** 负库存清单汇总 */
export function summarizeNegativeStock(rows: NegativeStockEvaluation[]): NegativeStockSummary {
  const negative = rows.filter((item) => item.negative)
  return {
    totalRows: negative.length,
    negativeOnHandRows: negative.filter((item) => item.level === 'NEGATIVE_ONHAND').length,
    negativeAvailableRows: negative.filter((item) => item.level === 'NEGATIVE_AVAILABLE').length,
    totalShortageQty: round3(negative.reduce((sum, item) => sum + item.shortageQty, 0))
  }
}

function num(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000
}
