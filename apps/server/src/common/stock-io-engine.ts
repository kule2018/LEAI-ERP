/**
 * 库存出入库单纯规则引擎：多类型定义、暂估与冲销校验、单据状态机。
 * 与持久层解耦，便于单元测试。
 */

export type IoDirection = 'IN' | 'OUT' | 'BOTH'
export type IoDocStatus = 'DRAFT' | 'POSTED' | 'REVERSED'

export interface IoTypeMeta {
  /** 单据类型编码 */
  code: string
  /** 类型名称 */
  label: string
  /** 固定方向，BOTH 表示按行数量自动判定 */
  direction: IoDirection
  /** 是否允许暂估成本（入库未取得正式成本） */
  allowProvisional: boolean
  /** 是否要求行具备成本（出库需成本来源） */
  requireCost: boolean
  /** 过账前是否必须上传附件 */
  requireAttachment: boolean
}

export const IO_TYPE_META: IoTypeMeta[] = [
  { code: 'PURCHASE_IN', label: '采购入库', direction: 'IN', allowProvisional: true, requireCost: false, requireAttachment: false },
  { code: 'SALE_OUT', label: '销售出库', direction: 'OUT', allowProvisional: false, requireCost: true, requireAttachment: false },
  { code: 'PRODUCTION_IN', label: '生产入库', direction: 'IN', allowProvisional: true, requireCost: true, requireAttachment: false },
  { code: 'PRODUCTION_OUT', label: '生产领料', direction: 'OUT', allowProvisional: false, requireCost: false, requireAttachment: false },
  { code: 'TRANSFER_IN', label: '调拨入库', direction: 'IN', allowProvisional: false, requireCost: false, requireAttachment: false },
  { code: 'TRANSFER_OUT', label: '调拨出库', direction: 'OUT', allowProvisional: false, requireCost: false, requireAttachment: false },
  { code: 'RETURN_IN', label: '销售退货入库', direction: 'IN', allowProvisional: true, requireCost: false, requireAttachment: true },
  { code: 'RETURN_OUT', label: '采购退货出库', direction: 'OUT', allowProvisional: false, requireCost: false, requireAttachment: true },
  { code: 'ADJUST', label: '库存调整', direction: 'BOTH', allowProvisional: false, requireCost: false, requireAttachment: false },
  { code: 'SCRAP', label: '报废出库', direction: 'OUT', allowProvisional: false, requireCost: false, requireAttachment: false },
  { code: 'SAMPLE', label: '样品出库', direction: 'OUT', allowProvisional: false, requireCost: false, requireAttachment: false }
]

export interface IoLineSnapshot {
  /** 入库数量 */
  qtyIn?: number
  /** 出库数量 */
  qtyOut?: number
  /** 单位成本 */
  unitCost?: number
  /** 是否暂估行 */
  isProvisional?: boolean
}

export interface IoDocumentSnapshot {
  ioType: string
  status: IoDocStatus
  lines: IoLineSnapshot[]
  /** 附件数量 */
  attachmentCount?: number
  /** 暂估总金额 */
  provisionalAmount?: number
}

export interface IoCheckResult {
  ok: boolean
  reasons: string[]
}

/** 查询单据类型元数据 */
export function getIoTypeMeta(ioType: string): IoTypeMeta | null {
  return IO_TYPE_META.find((item) => item.code === ioType) ?? null
}

/** 单据方向：按类型固定方向，或按行数量判定（BOTH） */
export function resolveIoDirection(meta: IoTypeMeta, lines: IoLineSnapshot[]): 'IN' | 'OUT' | 'MIXED' {
  if (meta.direction !== 'BOTH') return meta.direction
  let hasIn = false
  let hasOut = false
  for (const line of lines) {
    if ((line.qtyIn ?? 0) > 0) hasIn = true
    if ((line.qtyOut ?? 0) > 0) hasOut = true
  }
  if (hasIn && hasOut) return 'MIXED'
  if (hasIn) return 'IN'
  if (hasOut) return 'OUT'
  return 'MIXED'
}

/** 出入库单过账前校验 */
export function validateIoDocument(doc: IoDocumentSnapshot, options?: { ignoreAttachment?: boolean; ignoreDirection?: boolean }): IoCheckResult {
  const reasons: string[] = []
  const meta = getIoTypeMeta(doc.ioType)
  if (!meta) {
    return { ok: false, reasons: [`未知单据类型：${doc.ioType}`] }
  }
  if (doc.lines.length === 0) {
    return { ok: false, reasons: ['单据至少需要一行明细'] }
  }
  const direction = resolveIoDirection(meta, doc.lines)
  if (direction === 'MIXED' && !options?.ignoreDirection) {
    reasons.push('单据方向不一致，同一单据不可同时包含入库与出库明细')
  }
  doc.lines.forEach((line, index) => {
    const qtyIn = line.qtyIn ?? 0
    const qtyOut = line.qtyOut ?? 0
    if (qtyIn <= 0 && qtyOut <= 0) {
      reasons.push(`第 ${index + 1} 行数量必须大于零`)
      return
    }
    if (qtyIn > 0 && qtyOut > 0) {
      reasons.push(`第 ${index + 1} 行不可同时填写入库与出库数量`)
    }
    if (!options?.ignoreDirection) {
      if (meta.direction === 'IN' && qtyOut > 0) reasons.push(`第 ${index + 1} 行与「${meta.label}」方向不符`)
      if (meta.direction === 'OUT' && qtyIn > 0) reasons.push(`第 ${index + 1} 行与「${meta.label}」方向不符`)
    }
    if (line.isProvisional) {
      if (!meta.allowProvisional) reasons.push(`第 ${index + 1} 行：「${meta.label}」不支持暂估成本`)
      if ((line.unitCost ?? 0) <= 0) reasons.push(`第 ${index + 1} 行：暂估行必须填写暂估单价`)
    } else if (meta.requireCost && (line.unitCost ?? 0) <= 0) {
      reasons.push(`第 ${index + 1} 行：「${meta.label}」必须填写成本`)
    }
  })
  if (!options?.ignoreAttachment && meta.requireAttachment && (doc.attachmentCount ?? 0) <= 0) {
    reasons.push(`「${meta.label}」过账前必须上传附件`)
  }
  if (meta.allowProvisional && doc.lines.some((line) => line.isProvisional) && (doc.provisionalAmount ?? 0) <= 0) {
    reasons.push('存在暂估行时必须填写暂估总金额')
  }
  return { ok: reasons.length === 0, reasons }
}

/** 状态机：DRAFT 可过账，POSTED 可冲销 */
export function canTransition(status: IoDocStatus, action: 'POST' | 'REVERSE'): { ok: boolean; reason?: string } {
  if (action === 'POST') {
    if (status !== 'DRAFT') return { ok: false, reason: '仅草稿状态单据可过账' }
    return { ok: true }
  }
  if (status === 'REVERSED') return { ok: false, reason: '单据已冲销，不可重复冲销' }
  if (status !== 'POSTED') return { ok: false, reason: '仅已过账单据可冲销' }
  return { ok: true }
}

/** 生成冲销明细：方向取反、数量与成本保持一致 */
export function buildReversalLines(lines: IoLineSnapshot[]): IoLineSnapshot[] {
  return lines.map((line) => ({
    qtyIn: line.qtyOut ?? 0,
    qtyOut: line.qtyIn ?? 0,
    unitCost: line.unitCost ?? 0,
    isProvisional: false
  }))
}

/** 暂估与正式成本结算差异校验 */
export function checkProvisionalSettlement(input: {
  estimateAmount: number
  actualAmount: number
  toleranceRate?: number
}): { allowed: boolean; diff: number; reason: string } {
  const diff = Math.round((input.actualAmount - input.estimateAmount) * 10000) / 10000
  const tolerance = Math.abs(input.estimateAmount) * (input.toleranceRate ?? 0.01)
  if (Math.abs(diff) <= tolerance) {
    return { allowed: true, diff, reason: '正式成本与暂估金额在容差内，可直接结算' }
  }
  return { allowed: false, diff, reason: `正式成本与暂估差异 ${diff} 超出容差 ${Math.round(tolerance * 10000) / 10000}，需差异审批` }
}
