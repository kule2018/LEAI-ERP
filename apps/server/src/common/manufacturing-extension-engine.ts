/**
 * 生产制造域扩展纯规则：BOM 版本对比、排产冲突检测、产能负荷、超额领料、
 * 生产指标（良率/效率/工时/达成率）、停线影响、设备故障状态机、在制看板、
 * MRP 需求优先级、检验项判定、工单拆分、扫码条码解析。
 * 与持久层解耦，便于单测与复用。
 */

/* ---------------- BOM 版本对比 ---------------- */

export interface BomItemSnapshot {
  materialId: number
  qty: number
  lossRate?: number
  substituteMaterialId?: number | null
}

export interface BomVersionDiff {
  added: BomItemSnapshot[]
  removed: BomItemSnapshot[]
  changed: Array<{ materialId: number; before: BomItemSnapshot; after: BomItemSnapshot }>
  unchangedCount: number
  changedCount: number
}

/** BOM 版本对比：按子件物料编码比对用量/损耗/替代料差异 */
export function diffBomVersions(oldItems: BomItemSnapshot[], newItems: BomItemSnapshot[]): BomVersionDiff {
  const oldMap = new Map(oldItems.map((item) => [item.materialId, item]))
  const newMap = new Map(newItems.map((item) => [item.materialId, item]))
  const added: BomItemSnapshot[] = []
  const removed: BomItemSnapshot[] = []
  const changed: BomVersionDiff['changed'] = []
  let unchangedCount = 0

  for (const [materialId, after] of newMap) {
    const before = oldMap.get(materialId)
    if (!before) {
      added.push(after)
      continue
    }
    const sameQty = Number(before.qty) === Number(after.qty)
    const sameLoss = Number(before.lossRate ?? 0) === Number(after.lossRate ?? 0)
    const sameSubstitute = (before.substituteMaterialId ?? null) === (after.substituteMaterialId ?? null)
    if (sameQty && sameLoss && sameSubstitute) unchangedCount += 1
    else changed.push({ materialId, before, after })
  }
  for (const [materialId, before] of oldMap) {
    if (!newMap.has(materialId)) removed.push(before)
  }
  return { added, removed, changed, unchangedCount, changedCount: changed.length }
}

/* ---------------- 排产冲突检测与产能负荷 ---------------- */

export interface PlanTaskSnapshot {
  id: number
  taskName?: string
  workOrderId?: number | null
  workCenterId?: number | null
  startAt: Date | string
  endAt: Date | string
  status?: string
  locked?: boolean
}

export interface WorkCenterSnapshot {
  id: number
  centerName?: string
  capacity?: number
  standardCapacity?: number
  shiftHours?: number
}

export interface ScheduleConflict {
  type: 'CENTER_OVERLAP' | 'ORDER_OVERLAP'
  taskIds: [number, number]
  reason: string
}

function toTime(value: Date | string): number {
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

/**
 * 排产冲突检测：
 * 1. 同一工作中心时间重叠（CENTER_OVERLAP）
 * 2. 同一工单工序时间重叠（ORDER_OVERLAP）
 * 已取消任务不参与判定。
 */
export function detectScheduleConflicts(tasks: PlanTaskSnapshot[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = []
  const active = tasks.filter((task) => task.status !== 'CANCELLED' && task.status !== 'DONE')
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]
      const b = active[j]
      const aStart = toTime(a.startAt)
      const aEnd = toTime(a.endAt)
      const bStart = toTime(b.startAt)
      const bEnd = toTime(b.endAt)
      const overlap = aStart < bEnd && bStart < aEnd
      if (!overlap) continue
      if (a.workCenterId && b.workCenterId && a.workCenterId === b.workCenterId) {
        conflicts.push({
          type: 'CENTER_OVERLAP',
          taskIds: [a.id, b.id],
          reason: `工作中心 ${a.workCenterId} 在 ${new Date(aStart).toISOString()} ~ ${new Date(aEnd).toISOString()} 存在重叠排产`
        })
      }
      if (a.workOrderId && b.workOrderId && a.workOrderId === b.workOrderId) {
        conflicts.push({
          type: 'ORDER_OVERLAP',
          taskIds: [a.id, b.id],
          reason: `工单 ${a.workOrderId} 的工序排产时间重叠`
        })
      }
    }
  }
  return conflicts
}

/**
 * 产能负荷：按工作中心统计排产工时与可用产能（标准产能 × 天数 × 班次工时）。
 * loadRate = 负荷工时 / 可用产能（保留 2 位小数百分比）。
 */
export function computeCapacityLoad(
  tasks: PlanTaskSnapshot[],
  centers: WorkCenterSnapshot[],
  days: number,
  dailyShiftHours?: number
): Array<{ workCenterId: number; name: string; loadHours: number; capacityHours: number; loadRate: number; overloaded: boolean; taskCount: number }> {
  const horizon = Math.max(1, Math.floor(days))
  const shift = dailyShiftHours && dailyShiftHours > 0 ? dailyShiftHours : 8
  const map = new Map<number, number>()
  const countMap = new Map<number, number>()
  for (const task of tasks) {
    if (!task.workCenterId) continue
    if (task.status === 'CANCELLED') continue
    const hours = Math.max(0, (toTime(task.endAt) - toTime(task.startAt)) / 3_600_000)
    map.set(task.workCenterId, (map.get(task.workCenterId) ?? 0) + hours)
    countMap.set(task.workCenterId, (countMap.get(task.workCenterId) ?? 0) + 1)
  }
  return centers.map((center) => {
    const perDay = center.standardCapacity && center.standardCapacity > 0
      ? center.standardCapacity
      : center.capacity && center.capacity > 0
        ? center.capacity
        : 1
    const capacityHours = Number((perDay * shift * horizon).toFixed(2))
    const loadHours = Number((map.get(center.id) ?? 0).toFixed(2))
    const loadRate = capacityHours > 0 ? Number(((loadHours / capacityHours) * 100).toFixed(2)) : 0
    return {
      workCenterId: center.id,
      name: center.centerName ?? `工作中心 ${center.id}`,
      loadHours,
      capacityHours,
      loadRate,
      overloaded: loadRate > 100,
      taskCount: countMap.get(center.id) ?? 0
    }
  })
}

/* ---------------- 超额领料 ---------------- */

export interface OverIssueResult {
  issuedQty: number
  requiredQty: number
  overQty: number
  ratio: number
  over: boolean
  needApproval: boolean
}

/**
 * 超额领料判定：累计领料超过 BOM 应耗量即视为超额；
 * ratio 超过 1 时必须走审批（needApproval）。
 */
export function evaluateOverIssue(issuedQty: number, requiredQty: number, toleranceRate = 0): OverIssueResult {
  const issued = Number(issuedQty) || 0
  const required = Number(requiredQty) || 0
  const tolerance = required * (toleranceRate / 100)
  const limit = required + tolerance
  const overQty = Number(Math.max(0, issued - limit).toFixed(4))
  const ratio = required > 0 ? Number((issued / required).toFixed(4)) : 0
  return {
    issuedQty: issued,
    requiredQty: required,
    overQty,
    ratio,
    over: overQty > 0,
    needApproval: overQty > 0
  }
}

/* ---------------- 生产指标 ---------------- */

export interface ProductionMetricInput {
  plannedQty: number
  outputQty: number
  defectQty: number
  standardHours: number
  actualHours: number
  completedOnTime: number
  totalOrders: number
}

/**
 * 生产指标：良率 / 效率 / 达成率 / 实际工时。
 * 良率 = (产出-不良)/产出；效率 = 标准工时/实际工时；达成率 = 按期完成工单数/工单总数。
 */
export function computeProductionMetrics(input: ProductionMetricInput): {
  yieldRate: number
  efficiencyRate: number
  achievementRate: number
  actualHours: number
  outputQty: number
  defectQty: number
} {
  const output = Number(input.outputQty) || 0
  const defect = Number(input.defectQty) || 0
  const good = Math.max(0, output - defect)
  const yieldRate = output > 0 ? Number(((good / output) * 100).toFixed(2)) : 0
  const standardHours = Number(input.standardHours) || 0
  const actualHours = Number(input.actualHours) || 0
  const efficiencyRate = actualHours > 0 ? Number(((standardHours / actualHours) * 100).toFixed(2)) : 0
  const totalOrders = Number(input.totalOrders) || 0
  const achievementRate = totalOrders > 0
    ? Number(((Number(input.completedOnTime) / totalOrders) * 100).toFixed(2))
    : 0
  return { yieldRate, efficiencyRate, achievementRate, actualHours, outputQty: output, defectQty: defect }
}

/* ---------------- 停线影响 ---------------- */

export interface StopLineInput {
  startAt: Date | string
  endAt: Date | string
  planEnd?: Date | string | null
  dailyCapacity?: number
}

/** 停线影响：计算停线时长（分钟）、按天折算的交期顺延天数与影响产量 */
export function computeStopLineImpact(input: StopLineInput): {
  downtimeMinutes: number
  delayDays: number
  affectedQty: number
  newPlanEnd: string | null
} {
  const start = toTime(input.startAt)
  const end = toTime(input.endAt)
  const downtimeMinutes = Math.max(0, Math.round((end - start) / 60000))
  const delayDays = Number(((downtimeMinutes / 60) / 24).toFixed(2))
  const dailyCapacity = input.dailyCapacity && input.dailyCapacity > 0 ? input.dailyCapacity : 0
  const affectedQty = Number((dailyCapacity * delayDays).toFixed(4))
  let newPlanEnd: string | null = null
  if (input.planEnd) {
    const planEnd = toTime(input.planEnd)
    newPlanEnd = new Date(planEnd + Math.round(delayDays * 24 * 3_600_000)).toISOString()
  }
  return { downtimeMinutes, delayDays, affectedQty, newPlanEnd }
}

/* ---------------- 设备故障状态机 ---------------- */

export const EQUIPMENT_FAULT_TRANSITIONS: Record<string, string[]> = {
  IDLE: ['RUNNING', 'FAULT', 'MAINTENANCE'],
  RUNNING: ['IDLE', 'FAULT', 'MAINTENANCE'],
  FAULT: ['MAINTENANCE'],
  MAINTENANCE: ['IDLE', 'RUNNING', 'FAULT']
}

/** 设备状态流转校验：故障必须先维修再复机 */
export function canTransitionEquipment(current: string, next: string): { ok: boolean; reason?: string } {
  const allowed = EQUIPMENT_FAULT_TRANSITIONS[current]
  if (!allowed) return { ok: false, reason: `未知设备状态 ${current}` }
  if (current === next) return { ok: true }
  if (!allowed.includes(next)) return { ok: false, reason: `设备状态不允许从 ${current} 变更为 ${next}` }
  return { ok: true }
}

/* ---------------- 在制看板 ---------------- */

export interface WipOrderInput {
  id: number
  orderNo: string
  productId: number
  status: string
  qty: number
  producedQty: number
  actualQty: number
  planStart?: Date | string | null
  planEnd?: Date | string | null
}

export interface WipBoardRow {
  workOrderId: number
  orderNo: string
  productId: number
  status: string
  plannedQty: number
  producedQty: number
  actualQty: number
  wipQty: number
  progress: number
  overdue: boolean
}

/** 在制看板：按工单统计在制数量与进度，并标记逾期工单 */
export function buildWipBoard(orders: WipOrderInput[], now: Date | string = new Date()): WipBoardRow[] {
  const current = toTime(now)
  return orders.map((order) => {
    const planned = Number(order.qty) || 0
    const produced = Number(order.producedQty) || 0
    const actual = Number(order.actualQty) || 0
    const wipQty = Number(Math.max(0, planned - actual).toFixed(4))
    const progress = planned > 0 ? Number(((actual / planned) * 100).toFixed(2)) : 0
    const overdue = order.planEnd ? toTime(order.planEnd) < current && !['DONE', 'CANCELLED'].includes(order.status) : false
    return {
      workOrderId: order.id,
      orderNo: order.orderNo,
      productId: order.productId,
      status: order.status,
      plannedQty: planned,
      producedQty: produced,
      actualQty: actual,
      wipQty,
      progress,
      overdue
    }
  })
}

/* ---------------- MRP 需求优先级 ---------------- */

export interface MrpDemandInput {
  productId: number
  netQty: number
  demandQty: number
  dueDate?: Date | string | null
  abcClass?: string
}

export interface MrpPriorityRow {
  productId: number
  netQty: number
  score: number
  priority: number
  priorityLabel: string
  reason: string
}

/**
 * MRP 需求优先级：交期越近、净需求越大、ABC 等级越高，优先级越高（1 为最高）。
 */
export function rankMrpDemands(demands: MrpDemandInput[], now: Date | string = new Date()): MrpPriorityRow[] {
  const current = toTime(now)
  const rows = demands.map((demand) => {
    let score = Number(demand.netQty) || 0
    const reasons: string[] = []
    if (demand.dueDate) {
      const days = Math.max(0, Math.ceil((toTime(demand.dueDate) - current) / 86_400_000))
      score += Math.max(0, 60 - days)
      reasons.push(`需求交期剩余 ${days} 天`)
    }
    if (demand.abcClass === 'A') {
      score += 30
      reasons.push('ABC 分类 A')
    } else if (demand.abcClass === 'B') {
      score += 15
      reasons.push('ABC 分类 B')
    }
    if ((Number(demand.netQty) || 0) > 0) reasons.push(`净需求 ${demand.netQty}`)
    return { productId: demand.productId, netQty: Number(demand.netQty) || 0, score: Number(score.toFixed(4)), reasons }
  })
  rows.sort((a, b) => b.score - a.score || b.netQty - a.netQty)
  return rows.map((row, index) => ({
    productId: row.productId,
    netQty: row.netQty,
    score: row.score,
    priority: index + 1,
    priorityLabel: index + 1 <= Math.max(1, Math.ceil(rows.length / 3)) ? 'HIGH' : index + 1 <= Math.max(2, Math.ceil((rows.length * 2) / 3)) ? 'MEDIUM' : 'LOW',
    reason: row.reasons.join('；') || '按净需求排序'
  }))
}

/* ---------------- 质检检验项判定 ---------------- */

export interface QcItemInput {
  itemCode: string
  itemName: string
  standardValue?: number | null
  measuredValue?: number | null
  upperLimit?: number | null
  lowerLimit?: number | null
  qualified?: boolean | null
}

/**
 * 检验项判定：优先使用显式合格标记；否则按上下限比较实测值。
 * 全部合格 → PASS，存在不合格 → FAIL。
 */
export function evaluateQcItems(items: QcItemInput[]): {
  result: 'PASS' | 'FAIL'
  passed: number
  failed: number
  items: Array<QcItemInput & { qualified: boolean; reason: string }>
} {
  const evaluated = items.map((item) => {
    let qualified = item.qualified ?? null
    let reason = '人工判定'
    if (qualified == null) {
      if (item.measuredValue == null) {
        qualified = false
        reason = '缺少实测值'
      } else if (item.upperLimit != null && item.measuredValue > item.upperLimit) {
        qualified = false
        reason = `实测 ${item.measuredValue} 超出上限 ${item.upperLimit}`
      } else if (item.lowerLimit != null && item.measuredValue < item.lowerLimit) {
        qualified = false
        reason = `实测 ${item.measuredValue} 低于下限 ${item.lowerLimit}`
      } else {
        qualified = true
        reason = '在允收范围内'
      }
    } else {
      reason = qualified ? '人工判定合格' : '人工判定不合格'
    }
    return { ...item, qualified, reason }
  })
  const failed = evaluated.filter((item) => !item.qualified).length
  return {
    result: failed > 0 ? 'FAIL' : 'PASS',
    passed: evaluated.length - failed,
    failed,
    items: evaluated
  }
}

/* ---------------- 工单拆分 ---------------- */

export interface SplitWorkOrderInput {
  qty: number
  producedQty: number
  actualQty: number
  status: string
  splitQty: number
}

/** 工单拆分校验：仅未开工工单可拆，拆分数量必须小于订单数量且大于 0 */
export function splitWorkOrder(input: SplitWorkOrderInput): { ok: boolean; reason?: string; remainingQty: number } {
  const qty = Number(input.qty) || 0
  const splitQty = Number(input.splitQty) || 0
  const remainingQty = Number((qty - splitQty).toFixed(4))
  if (!['DRAFT', 'SUBMITTED', 'APPROVED'].includes(input.status)) {
    return { ok: false, reason: '仅未开工工单可以拆分', remainingQty: qty }
  }
  if ((Number(input.producedQty) || 0) > 0 || (Number(input.actualQty) || 0) > 0) {
    return { ok: false, reason: '已报工或已完工的工单不允许拆分', remainingQty: qty }
  }
  if (splitQty <= 0) return { ok: false, reason: '拆分数量必须大于 0', remainingQty: qty }
  if (splitQty >= qty) return { ok: false, reason: '拆分数量必须小于工单数量', remainingQty: qty }
  return { ok: true, remainingQty }
}

/* ---------------- 扫码条码解析 ---------------- */

export interface ScanCodeResult {
  ok: boolean
  code: string
  productId: number | null
  batchNo: string | null
  serialNo: string | null
  qty: number | null
  reason?: string
}

/**
 * 扫码条码解析：支持 "产品ID|批次号|序列号|数量" 与 "产品ID,批次号" 两种分隔格式；
 * 仅数字时视为产品 ID。
 */
export function parseScanCode(code: string): ScanCodeResult {
  const raw = (code ?? '').trim()
  if (!raw) return { ok: false, code: raw, productId: null, batchNo: null, serialNo: null, qty: null, reason: '条码为空' }
  const parts = raw.split(/[|,;]/).map((part) => part.trim())
  const productId = /^\d+$/.test(parts[0]) ? Number(parts[0]) : null
  if (productId == null) {
    return { ok: false, code: raw, productId: null, batchNo: null, serialNo: null, qty: null, reason: '条码格式无法识别产品 ID' }
  }
  const batchNo = parts[1] && parts[1].length > 0 ? parts[1] : null
  const serialNo = parts[2] && parts[2].length > 0 ? parts[2] : null
  const qty = parts[3] && /^\d+(\.\d{1,3})?$/.test(parts[3]) ? Number(parts[3]) : null
  return { ok: true, code: raw, productId, batchNo, serialNo, qty }
}
