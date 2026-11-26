import { request } from '@/utils/http'

export interface ManufacturingExtensionQuery {
  page?: number
  pageSize?: number
  status?: string
  equipmentId?: number
  workOrderId?: number
  productId?: number
}

const base = '/mfg/extensions'

/* BOM 版本对比与变更审批 */
export function diffBomVersions(baseId: number, targetId: number) {
  return request<Record<string, unknown>>({ url: `${base}/boms/version-diff`, method: 'get', params: { baseId, targetId } })
}
export function createBomChange(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/boms/changes`, method: 'post', data })
}
export function listBomChanges(params: ManufacturingExtensionQuery) {
  return request<Array<Record<string, unknown>>>({ url: `${base}/boms/changes`, method: 'get', params })
}
export function approveBomChange(id: number, data: { approve: boolean; comment?: string }) {
  return request<Record<string, unknown>>({ url: `${base}/boms/changes/${id}/approve`, method: 'put', data })
}

/* 工单变更与拆分 */
export function createWorkOrderChange(workOrderId: number, data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/work-orders/${workOrderId}/changes`, method: 'post', data })
}
export function listWorkOrderChanges(workOrderId: number) {
  return request<Array<Record<string, unknown>>>({ url: `${base}/work-orders/${workOrderId}/changes`, method: 'get' })
}
export function approveWorkOrderChange(id: number, data: { approve: boolean; comment?: string }) {
  return request<Record<string, unknown>>({ url: `${base}/work-order-changes/${id}/approve`, method: 'put', data })
}
export function splitWorkOrder(workOrderId: number, data: { splitQty: string; reason?: string }) {
  return request<Record<string, unknown>>({ url: `${base}/work-orders/${workOrderId}/split`, method: 'post', data })
}

/* 排产冲突、产能负荷与锁定 */
export function fetchScheduleConflicts(params: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/schedule/conflicts`, method: 'get', params })
}
export function fetchCapacityLoad(params: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/schedule/capacity-load`, method: 'get', params })
}
export function lockPlanTask(id: number, data: { lock: boolean; reason?: string }) {
  return request<Record<string, unknown>>({ url: `${base}/plan-tasks/${id}/lock`, method: 'put', data })
}

/* 拖拽排产与换线 */
export interface GanttTaskRow {
  id: number
  taskName: string
  workCenterId: number | null
  workOrderId: number | null
  productId: number | null
  startAt: string
  endAt: string
  changeoverMinutes: number
  conflict: boolean
  locked: boolean
  status: string
}

export interface GanttCenterRow {
  workCenterId: number
  centerName: string
  centerCode: string
  capacity: string
  tasks: GanttTaskRow[]
}

export interface GanttScheduleResult {
  rows: GanttTaskRow[]
  centers: GanttCenterRow[]
  unassigned: GanttTaskRow[]
  conflictCount: number
  changeoverTotal: number
  ruleCount: number
}

export interface ChangeoverRule {
  id: number
  workCenterId: number | null
  fromProductId: number | null
  toProductId: number | null
  minutes: number
  remark: string | null
  status: string
}

export interface ChangeoverLog {
  id: number
  planTaskId: number
  workCenterId: number | null
  fromProductId: number | null
  toProductId: number | null
  minutes: number
  startAt: string
  endAt: string
  status: string
  source: string
}

export function fetchGanttSchedule(params: Record<string, unknown>) {
  return request<GanttScheduleResult>({ url: `${base}/schedule/gantt`, method: 'get', params })
}

export function reschedulePlanTask(id: number, data: { startAt: string; endAt?: string; reason?: string; ignoreConflict?: boolean }) {
  return request<{ applied: boolean; changeoverMinutes: number; conflicts: Array<{ a: number; b: number }>; message?: string }>({
    url: `${base}/plan-tasks/${id}/reschedule`, method: 'put', data
  })
}

export function fetchChangeoverRules() {
  return request<ChangeoverRule[]>({ url: `${base}/changeover/rules`, method: 'get' })
}

export function createChangeoverRule(data: Record<string, unknown>) {
  return request<ChangeoverRule>({ url: `${base}/changeover/rules`, method: 'post', data })
}

export function disableChangeoverRule(id: number) {
  return request<ChangeoverRule>({ url: `${base}/changeover/rules/${id}/disable`, method: 'put' })
}

export function fetchChangeoverLogs(params: Record<string, unknown>) {
  return request<ChangeoverLog[]>({ url: `${base}/changeover/logs`, method: 'get', params })
}

/* 超额领料 */
export function fetchOverIssueCheck(workOrderId: number, materialId: number) {
  return request<Record<string, unknown>>({ url: `${base}/work-orders/${workOrderId}/over-issue`, method: 'get', params: { materialId } })
}
export function requestOverIssue(workOrderId: number, data: { materialId: number; reason?: string }) {
  return request<Record<string, unknown>>({ url: `${base}/work-orders/${workOrderId}/over-issue`, method: 'post', data })
}
export function listOverIssues(params: ManufacturingExtensionQuery) {
  return request<Array<Record<string, unknown>>>({ url: `${base}/over-issues`, method: 'get', params })
}
export function approveOverIssue(id: number, data: { approve: boolean; comment?: string }) {
  return request<Record<string, unknown>>({ url: `${base}/over-issues/${id}/approve`, method: 'put', data })
}

/* 扫码报工与在制看板 */
export function scanReport(workOrderId: number, data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/work-orders/${workOrderId}/scan-report`, method: 'post', data })
}
export function fetchWipBoard() {
  return request<Record<string, unknown>>({ url: `${base}/wip-board`, method: 'get' })
}

/* 生产分析 */
export function fetchProductionAnalysis(params: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/production-analysis`, method: 'get', params })
}

/* 质检检验项 */
export function listQcItems(qcId: number) {
  return request<Array<Record<string, unknown>>>({ url: `${base}/qc/${qcId}/items`, method: 'get' })
}
export function createQcItem(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/qc/items`, method: 'post', data })
}

/* 设备故障与保养 */
export function createEquipmentFault(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/equipment/faults`, method: 'post', data })
}
export function listEquipmentFaults(params: ManufacturingExtensionQuery) {
  return request<Array<Record<string, unknown>>>({ url: `${base}/equipment/faults`, method: 'get', params })
}
export function repairEquipmentFault(id: number, data: { repairResult: string }) {
  return request<Record<string, unknown>>({ url: `${base}/equipment/faults/${id}/repair`, method: 'put', data })
}
export function createMaintenance(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/equipment/maintenances`, method: 'post', data })
}
export function listMaintenances(params: ManufacturingExtensionQuery) {
  return request<Array<Record<string, unknown>>>({ url: `${base}/equipment/maintenances`, method: 'get', params })
}
export function executeMaintenance(id: number, data: { executeResult?: string }) {
  return request<Record<string, unknown>>({ url: `${base}/equipment/maintenances/${id}/execute`, method: 'put', data })
}

/* 停线记录 */
export function recordStopLine(exceptionId: number, data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/exceptions/${exceptionId}/stop-line`, method: 'post', data })
}

/* MRP 模拟与优先级 */
export function simulateMrp(data: Record<string, unknown> = {}) {
  return request<Record<string, unknown>>({ url: `${base}/mrp/simulate`, method: 'post', data })
}
export function rankMrpRun(runId: number) {
  return request<Array<Record<string, unknown>>>({ url: `${base}/mrp/runs/${runId}/rank`, method: 'post' })
}
