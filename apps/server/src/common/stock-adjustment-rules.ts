/**
 * 库存调整单纯规则：明细校验、过账分录生成、金额汇总。
 * 盘盈按移动加权成本或指定成本入库，盘亏按账面成本出库。
 */

export interface AdjustmentLineInput {
  productId: number
  variantId?: number
  batchNo?: string
  /** 调整数量：正数为盘盈，负数为盘亏 */
  qty: number
  /** 单位成本，盘盈时必填；盘亏时缺省取账面成本 */
  cost?: number
  /** 账面可用量（盘亏校验用） */
  availableQty?: number
  /** 账面单位成本（盘亏成本对比用） */
  availableCost?: number
  reason?: string
}

export interface AdjustmentViolation {
  lineIndex: number
  productId: number
  code: 'QTY_ZERO' | 'COST_MISSING' | 'NEGATIVE_COST' | 'STOCK_SHORTAGE' | 'COST_EXCEED'
  message: string
  level: 'ERROR' | 'WARN'
}

export interface AdjustmentPosting {
  productId: number
  variantId: number
  batchNo: string
  qtyIn: number
  qtyOut: number
  cost: number
  amount: number
  reason: string
}

export interface AdjustmentValidationResult {
  violations: AdjustmentViolation[]
  postings: AdjustmentPosting[]
  totalQtyIn: number
  totalQtyOut: number
  totalAmount: number
  passed: boolean
}

const round4 = (value: number): number => Number(Number(value).toFixed(4))

/**
 * 校验调整明细并生成过账分录
 * 规则：数量不能为 0；盘盈必须有成本且成本非负；盘亏不得超过可用量；盘亏成本不得高于账面成本（超额需审批）
 */
export function validateAdjustmentLines(lines: AdjustmentLineInput[]): AdjustmentValidationResult {
  const violations: AdjustmentViolation[] = []
  const postings: AdjustmentPosting[] = []
  let totalQtyIn = 0
  let totalQtyOut = 0
  let totalAmount = 0

  lines.forEach((line, lineIndex) => {
    const qty = round4(Number(line.qty ?? 0))
    if (qty === 0) {
      violations.push({ lineIndex, productId: line.productId, code: 'QTY_ZERO', message: '第 ' + (lineIndex + 1) + ' 行调整数量不能为 0', level: 'ERROR' })
      return
    }
    const cost = line.cost === undefined || line.cost === null ? undefined : round4(Number(line.cost))
    if (cost !== undefined && cost < 0) {
      violations.push({ lineIndex, productId: line.productId, code: 'NEGATIVE_COST', message: '第 ' + (lineIndex + 1) + ' 行成本不能为负数', level: 'ERROR' })
      return
    }
    if (qty > 0 && cost === undefined) {
      violations.push({ lineIndex, productId: line.productId, code: 'COST_MISSING', message: '第 ' + (lineIndex + 1) + ' 行盘盈必须填写单位成本', level: 'ERROR' })
      return
    }
    if (qty < 0) {
      const available = round4(Number(line.availableQty ?? 0))
      if (Math.abs(qty) > available) {
        violations.push({ lineIndex, productId: line.productId, code: 'STOCK_SHORTAGE', message: '第 ' + (lineIndex + 1) + ' 行盘亏数量超过可用库存', level: 'ERROR' })
        return
      }
      if (cost !== undefined && Number(line.availableCost ?? 0) > 0 && cost > Number(line.availableCost)) {
        violations.push({ lineIndex, productId: line.productId, code: 'COST_EXCEED', message: '第 ' + (lineIndex + 1) + ' 行盘亏成本高于账面成本，需差异说明', level: 'WARN' })
      }
    }
    // 盘盈按指定成本，盘亏缺省按账面成本出库
    const unitCost = cost ?? (qty < 0 ? round4(Number(line.availableCost ?? 0)) : 0)
    const amount = round4(Math.abs(qty) * unitCost)
    postings.push({
      productId: line.productId,
      variantId: line.variantId ?? 0,
      batchNo: line.batchNo ?? '',
      qtyIn: qty > 0 ? qty : 0,
      qtyOut: qty < 0 ? Math.abs(qty) : 0,
      cost: unitCost,
      amount,
      reason: line.reason ?? ''
    })
    if (qty > 0) totalQtyIn = round4(totalQtyIn + qty)
    else totalQtyOut = round4(totalQtyOut + Math.abs(qty))
    totalAmount = round4(totalAmount + amount)
  })

  return {
    violations,
    postings,
    totalQtyIn,
    totalQtyOut,
    totalAmount,
    passed: violations.every((item) => item.level !== 'ERROR')
  }
}

/** 调整类型：GAIN 盘盈 / LOSS 盘亏 / SYSTEM 系统差异修正 */
export type AdjustmentType = 'GAIN' | 'LOSS' | 'SYSTEM'

export const ADJUSTMENT_TYPE: AdjustmentType[] = ['GAIN', 'LOSS', 'SYSTEM']

/** 单据状态机：DRAFT → APPROVED(过账) → POSTED；DRAFT → CANCELLED */
export const ADJUSTMENT_STATUS = ['DRAFT', 'POSTED', 'CANCELLED'] as const
export type AdjustmentStatus = (typeof ADJUSTMENT_STATUS)[number]

export function canPostAdjustment(status: string): boolean {
  return status === 'DRAFT'
}

export function canCancelAdjustment(status: string): boolean {
  return status === 'DRAFT'
}
