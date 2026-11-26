import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface Bom { id: number; productId: number; version: string; baseQty: string; isActive: number; status: string }
export interface BomItem { id: number; bomId: number; materialId: number; qty: string; lossRate: string; substituteMaterialId: number | null }
export interface WorkCenter { id: number; centerCode: string; centerName: string; capacity: string; status: string }
export interface Routing { id: number; productId: number; version: string; status: string }
export interface Operation { id: number; routingId: number; operationName: string; workCenterId: number | null; standardMinutes: string; sortNo: number }
export interface MrpRun { id: number; runNo: string; planDate: string | null; status: string; createdAt: string }
export interface MrpSuggest { id: number; runId: number; productId: number; demandQty: string; availableQty: string; onwayQty: string; allocatedQty: string; netQty: string; suggestType: string }
export interface PlanTask { id: number; taskName: string; workOrderId: number | null; workCenterId: number | null; startAt: string; endAt: string; status: string }
export interface WorkOrder { id: number; orderNo: string; productId: number; bomId: number | null; routingId: number | null; warehouseId: number; qty: string; producedQty: string; actualQty: string; status: string }
export interface WorkOrderIssue { id: number; workOrderId: number; issueType: string; materialId: number; qty: string; batchNo: string | null }
export interface WorkOrderReport { id: number; workOrderId: number; operationId: number | null; qty: string; defectQty: string; reportedAt: string }
export interface WorkOrderComplete { id: number; workOrderId: number; productId: number; warehouseId: number; qty: string; qcResult: string }
export interface Qc { id: number; bizType: string; bizId: number; inspectionType: string; sampleQty: string; defectQty: string; result: string }
export interface Equipment { id: number; equipmentCode: string; equipmentName: string; workCenterId: number | null; status: string; oee: string; lastMaintenance: string | null }
export interface ProductionException { id: number; exceptionNo: string; exceptionType: string; workOrderId: number | null; reason: string | null; closedNote: string | null; status: string }
export interface ManufacturingSummary { workOrderCount: number; doneCount: number; producedQty: string; actualQty: string; defectQty: string; openExceptions: number }

export interface ManufacturingQuery extends PageQuery { status?: string; productId?: number }

const base = '/mfg'

export function fetchBoms(params: ManufacturingQuery) { return request<PageResult<Bom>>({ url: `${base}/boms`, method: 'get', params }) }
export function fetchBomDetail(id: number) { return request<{ bom: Bom; items: BomItem[] }>({ url: `${base}/boms/${id}/detail`, method: 'get' }) }
export function createBom(data: Record<string, unknown>) { return request<Bom>({ url: `${base}/boms`, method: 'post', data }) }
export function activateBom(id: number) { return request<Bom>({ url: `${base}/boms/${id}/activate`, method: 'post' }) }

export function fetchCenters(params: ManufacturingQuery) { return request<PageResult<WorkCenter>>({ url: `${base}/work-centers`, method: 'get', params }) }
export function createCenter(data: Record<string, unknown>) { return request<WorkCenter>({ url: `${base}/work-centers`, method: 'post', data }) }

export function fetchRoutings(params: ManufacturingQuery) { return request<PageResult<Routing>>({ url: `${base}/routings`, method: 'get', params }) }
export function fetchRoutingDetail(id: number) { return request<{ routing: Routing; operations: Operation[] }>({ url: `${base}/routings/${id}/detail`, method: 'get' }) }
export function createRouting(data: Record<string, unknown>) { return request<Routing>({ url: `${base}/routings`, method: 'post', data }) }

export function fetchMrpRuns(params: ManufacturingQuery) { return request<PageResult<MrpRun>>({ url: `${base}/mrp/runs`, method: 'get', params }) }
export function fetchMrpSuggests(runId: number) { return request<MrpSuggest[]>({ url: `${base}/mrp/runs/${runId}/suggests`, method: 'get' }) }
export function runMrp(data: Record<string, unknown> = {}) { return request<MrpRun>({ url: `${base}/mrp/run`, method: 'post', data }) }

export function fetchPlanTasks(params: ManufacturingQuery) { return request<PageResult<PlanTask>>({ url: `${base}/plans`, method: 'get', params }) }
export function createPlanTasks(data: Record<string, unknown>) { return request<PlanTask[]>({ url: `${base}/plans`, method: 'post', data }) }
export function updatePlanTask(id: number, data: Record<string, unknown>) { return request<PlanTask>({ url: `${base}/plans/${id}`, method: 'put', data }) }
export function deletePlanTask(id: number) { return request<{ deleted: boolean }>({ url: `${base}/plans/${id}`, method: 'delete' }) }

export function fetchWorkOrders(params: ManufacturingQuery) { return request<PageResult<WorkOrder>>({ url: `${base}/work-orders`, method: 'get', params }) }
export function fetchWorkOrderDetail(id: number) { return request<{ workOrder: WorkOrder; issues: WorkOrderIssue[]; reports: WorkOrderReport[]; completes: WorkOrderComplete[] }>({ url: `${base}/work-orders/${id}/detail`, method: 'get' }) }
export function createWorkOrder(data: Record<string, unknown>) { return request<WorkOrder>({ url: `${base}/work-orders`, method: 'post', data }) }
export function submitWorkOrder(id: number) { return request<WorkOrder>({ url: `${base}/work-orders/${id}/submit`, method: 'post' }) }
export function approveWorkOrder(id: number) { return request<WorkOrder>({ url: `${base}/work-orders/${id}/approve`, method: 'post' }) }
export function issueMaterial(id: number, data: Record<string, unknown>) { return request<WorkOrderIssue>({ url: `${base}/work-orders/${id}/issue`, method: 'post', data }) }
export function reportWork(id: number, data: Record<string, unknown>) { return request<WorkOrderReport>({ url: `${base}/work-orders/${id}/report`, method: 'post', data }) }
export function completeWork(id: number, data: Record<string, unknown>) { return request<WorkOrderComplete>({ url: `${base}/work-orders/${id}/complete`, method: 'post', data }) }

export function fetchQcs(params: ManufacturingQuery) { return request<PageResult<Qc>>({ url: `${base}/qc`, method: 'get', params }) }
export function createQc(data: Record<string, unknown>) { return request<Qc>({ url: `${base}/qc`, method: 'post', data }) }

export function fetchEquipment(params: ManufacturingQuery) { return request<PageResult<Equipment>>({ url: `${base}/equipment`, method: 'get', params }) }
export function createEquipment(data: Record<string, unknown>) { return request<Equipment>({ url: `${base}/equipment`, method: 'post', data }) }

export function fetchExceptions(params: ManufacturingQuery) { return request<PageResult<ProductionException>>({ url: `${base}/exceptions`, method: 'get', params }) }
export function createException(data: Record<string, unknown>) { return request<ProductionException>({ url: `${base}/exceptions`, method: 'post', data }) }
export function closeException(id: number, closedNote: string) { return request<ProductionException>({ url: `${base}/exceptions/${id}/close`, method: 'post', data: { closedNote } }) }

export function fetchManufacturingSummary() { return request<ManufacturingSummary>({ url: `${base}/reports/summary`, method: 'get' }) }
