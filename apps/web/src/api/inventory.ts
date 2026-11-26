import { request, requestBlob } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface StockBalance { id: number; warehouseId: number; locationId: number; productId: number; variantId: number; batchNo: string; qtyOnHand: string; qtyOccupied: string; qtyFrozen: string; avgCost: string }
export interface StockLedger { id: number; voucherType: string; voucherId: number; warehouseId: number; productId: number; variantId: number; batchNo: string; qtyIn: string; qtyOut: string; qtyDelta: string; balanceQty: string; cost: string; occurredAt: string; remark: string | null }
export interface StockLock { id: number; sourceType: string; sourceId: number; warehouseId: number; productId: number; lockedQty: string; status: string }
export interface StockAlert { id: number; alertType: string; alertLevel?: string; batchNo?: string | null; productId: number; warehouseId: number; thresholdQty: string; currentQty: string; suggestQty: string; status: string; message: string | null }
export interface BatchProfile { id: number; productId: number; productName: string; batchNo: string; warehouseId: number | null; expiryDate: string | null; shelfLifeDays: number | null; qty: string; status: string; daysLeft: number | null }
export interface ExpiryAlert { productId: number; productName: string; batchNo: string; expiryDate: string; daysLeft: number; qty: number; level: string }
export interface Stocktake { id: number; stocktakeNo: string; warehouseId: number; status: string }
export interface StocktakeLine { id: number; stocktakeId: number; productId: number; bookQty: string; actualQty: string; diffQty: string }
export interface StockTransfer { id: number; transferNo: string; fromWarehouseId: number; toWarehouseId: number; status: string }
export interface Putaway { id: number; sourceType: string; sourceId: number; warehouseId: number; locationId: number; strategyCode: string; status: string }
export interface PickWave { id: number; waveNo: string; status: string; priority: number }
export interface PickTask { id: number; waveId: number; sourceType: string; sourceId: number; productId: number; warehouseId: number; locationId: number; qty: string; pickedQty: string; status: string }
export interface Assembly { id: number; assemblyNo: string; assemblyType: string; productId: number; warehouseId: number; qty: string; status: string }
export interface InventorySummary { totalQty: string; lockedQty: string; frozenQty: string; ledgerCount: number; byWarehouse: Array<{ name: string; qty: string }>; byProduct: Array<{ name: string; qty: string }>; recentLedger: StockLedger[] }

export interface InventoryQuery extends PageQuery {
  warehouseId?: number
  productId?: number
  voucherType?: string
  status?: string
  batchNo?: string
}

/** 负库存清单行 */
export interface NegativeStockRow {
  negative: boolean
  level: 'NEGATIVE_ONHAND' | 'NEGATIVE_AVAILABLE' | 'NORMAL'
  onHand: number
  occupied: number
  frozen: number
  availableQty: number
  shortageQty: number
  warehouseId: number
  locationId: number
  productId: number
  variantId: number
  batchNo: string
  productName: string
  warehouseName: string
}

/** 成本层 */
export interface StockCostLayer {
  id: number
  warehouseId: number
  productId: number
  variantId: number
  batchNo: string
  qtyIn: string
  qtyAvailable: string
  unitCost: string
  amount: string
  sourceVoucherType: string
  occurredAt: string
  status: string
}

const base = '/inventory'

export function fetchBalances(params: InventoryQuery) { return request<PageResult<StockBalance>>({ url: `${base}/balances`, method: 'get', params }) }
/** 负库存清单 */
export function fetchNegativeStock(params: InventoryQuery) {
  return request<{
    list: NegativeStockRow[]
    summary: { totalRows: number; negativeOnHandRows: number; negativeAvailableRows: number; totalShortageQty: number }
    config: { allowNegativeStock: boolean; permitRequired: boolean }
  }>({ url: `${base}/negative-stock`, method: 'get', params })
}
/** 成本层列表 */
export function fetchCostLayers(params: InventoryQuery) { return request<PageResult<StockCostLayer>>({ url: `${base}/costing/layers`, method: 'get', params }) }
/** 成本层消耗预览 */
export function previewCostConsumption(productId: number, qty: string) {
  return request<{
    method: string
    unitCost: number
    amount: number
    source: string
    consumptions: Array<{ layerId: number; qty: number; unitCost: number; amount: number }>
  }>({ url: `${base}/costing/preview`, method: 'get', params: { productId, qty } })
}
/** 切换产品成本核算方法 */
export function updateCostingMethod(productId: number, method: string) {
  return request<{ id: number; costingMethod: string }>({ url: `${base}/costing/products/${productId}/method`, method: 'put', data: { method } })
}
export function fetchLedger(params: InventoryQuery) { return request<PageResult<StockLedger>>({ url: `${base}/ledger`, method: 'get', params }) }
/** 批次正反向追溯树 */
export interface BatchTraceEntry {
  id: number
  batchNo: string
  voucherType: string
  voucherId: number
  direction: 'IN' | 'OUT'
  qty: number
  productId: number
  occurredAt: string
}
export interface BatchTrace {
  batchNo: string
  sources: BatchTraceEntry[]
  destinations: BatchTraceEntry[]
  recall: Array<{ voucherType: string; voucherId: number }>
}
export function traceBatch(batchNo: string) { return request<BatchTrace>({ url: `${base}/ledger/trace/${encodeURIComponent(batchNo)}`, method: 'get' }) }
/** 召回冻结批次库存 */
export function recallFreeze(data: { productId: number; batchNo: string; qty: string }) {
  return request<{ frozen: boolean }>({ url: `${base}/recall/freeze`, method: 'post', data })
}
export function exportLedger(params: InventoryQuery) { return requestBlob({ url: `${base}/ledger/export`, method: 'get', params }) }
export function createMovement(data: Record<string, unknown>) { return request<StockLedger>({ url: `${base}/movements`, method: 'post', data }) }
export function fetchLocks(params: InventoryQuery) { return request<PageResult<StockLock>>({ url: `${base}/locks`, method: 'get', params }) }
export function lockStock(data: Record<string, unknown>) { return request<StockLock>({ url: `${base}/locks`, method: 'post', data }) }
export function unlockStock(data: Record<string, unknown>) { return request<null>({ url: `${base}/locks/unlock`, method: 'post', data }) }

export function fetchAlerts(params: InventoryQuery) { return request<PageResult<StockAlert>>({ url: `${base}/alerts`, method: 'get', params }) }
export function createAlert(data: Record<string, unknown>, idempotencyKey?: string) { return request<StockAlert>({ url: `${base}/alerts`, method: 'post', data, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined }) }
export function closeAlert(id: number, reason: string) { return request<StockAlert>({ url: `${base}/alerts/${id}/close`, method: 'post', data: { reason } }) }

/** 批次效期档案与临期巡检 */
export function fetchBatchProfiles(params: { productId?: number; batchNo?: string; pageSize?: number }) { return request<BatchProfile[]>({ url: `${base}/batch-profiles`, method: 'get', params }) }
export function saveBatchProfile(data: { productId: number; variantId?: number; batchNo: string; warehouseId?: number; expiryDate?: string; shelfLifeDays?: number; qty?: string; status?: string; remark?: string }, idempotencyKey?: string) { return request<BatchProfile>({ url: `${base}/batch-profiles`, method: 'post', data, headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined }) }
export interface StockAlertPolicy { id: number; productId: number; warehouseId: number; warnDays: number; urgentDays: number; safetyStock: string; slowMovingDays: number; status: string; remark: string | null }
export interface AlertScanResult {
  expiry: ExpiryAlert[]
  safety: Array<{ productId: number; productName: string; warehouseId: number; onHand: number; safetyStock: number; shortage: number; suggestQty: number }>
  slowMoving: Array<{ productId: number; productName: string; warehouseId: number; qty: number; lastOutboundDays: number; thresholdDays: number }>
  created: number
  updated: number
  reopened: number
  skipped: number
  closed: number
}
export function fetchAlertPolicies() { return request<StockAlertPolicy[]>({ url: `${base}/batch-profiles/policies`, method: 'get' }) }
export function saveAlertPolicy(data: { productId?: number; warehouseId?: number; warnDays?: number; urgentDays?: number; safetyStock?: string; slowMovingDays?: number; status?: string; remark?: string }) { return request<StockAlertPolicy>({ url: `${base}/batch-profiles/policies`, method: 'post', data }) }
export function scanAlerts(data: { warnDays?: number; urgentDays?: number }) { return request<AlertScanResult>({ url: `${base}/batch-profiles/scan`, method: 'post', data }) }

export function fetchStocktakes(params: InventoryQuery) { return request<PageResult<Stocktake>>({ url: `${base}/stocktakes`, method: 'get', params }) }
export function fetchStocktakeDetail(id: number) { return request<{ stocktake: Stocktake; lines: StocktakeLine[] }>({ url: `${base}/stocktakes/${id}/detail`, method: 'get' }) }
export function createStocktake(data: Record<string, unknown>) { return request<Stocktake>({ url: `${base}/stocktakes`, method: 'post', data }) }
export function approveStocktake(id: number) { return request<Stocktake>({ url: `${base}/stocktakes/${id}/approve`, method: 'post' }) }
/** 提交盘点差异审批：无差异直接过账，有差异进入审批中 */
export function submitStocktakeApproval(id: number) { return request<Stocktake>({ url: `${base}/stocktakes/${id}/submit-approval`, method: 'post' }) }
/** 驳回盘点差异审批 */
export function rejectStocktakeApproval(id: number, reason?: string) { return request<Stocktake>({ url: `${base}/stocktakes/${id}/reject-approval`, method: 'post', data: { reason } }) }
export function scanStocktake(id: number, scans: Array<{ lineId?: number; productId?: number; batchNo?: string; barcode?: string; qty: string }>) {
  return request<Stocktake>({ url: `${base}/stocktakes/${id}/scan`, method: 'post', data: { scans } })
}
export function recountStocktake(id: number, lines: Array<{ lineId: number; recountQty: string }>) {
  return request<Stocktake>({ url: `${base}/stocktakes/${id}/recount`, method: 'post', data: { lines } })
}

export function fetchTransfers(params: InventoryQuery) { return request<PageResult<StockTransfer>>({ url: `${base}/transfers`, method: 'get', params }) }
export function createTransfer(data: Record<string, unknown>) { return request<StockTransfer>({ url: `${base}/transfers`, method: 'post', data }) }
export function receiveTransfer(id: number) { return request<StockTransfer>({ url: `${base}/transfers/${id}/receive`, method: 'post' }) }

export function fetchPutaways(params: InventoryQuery) { return request<PageResult<Putaway>>({ url: `${base}/putaways`, method: 'get', params }) }
export function createPutaway(data: Record<string, unknown>) { return request<Putaway>({ url: `${base}/putaways`, method: 'post', data }) }
export function completePutaway(id: number) { return request<Putaway>({ url: `${base}/putaways/${id}/complete`, method: 'post' }) }

export function fetchWaves(params: InventoryQuery) { return request<PageResult<PickWave>>({ url: `${base}/waves`, method: 'get', params }) }
export function fetchWaveDetail(id: number) { return request<{ wave: PickWave; tasks: PickTask[] }>({ url: `${base}/waves/${id}/detail`, method: 'get' }) }
export function createWave(data: Record<string, unknown>) { return request<PickWave>({ url: `${base}/waves`, method: 'post', data }) }
export function pickTask(waveId: number, taskId: number, qty: string) { return request<PickTask>({ url: `${base}/waves/${waveId}/tasks/${taskId}/pick`, method: 'post', data: { qty } }) }
export function completeWave(id: number) { return request<PickWave>({ url: `${base}/waves/${id}/complete`, method: 'post' }) }

export function fetchAssemblies(params: InventoryQuery) { return request<PageResult<Assembly>>({ url: `${base}/assemblies`, method: 'get', params }) }
export function createAssembly(data: Record<string, unknown>) { return request<Assembly>({ url: `${base}/assemblies`, method: 'post', data }) }
export function approveAssembly(id: number) { return request<Assembly>({ url: `${base}/assemblies/${id}/approve`, method: 'post' }) }

export function fetchInventorySummary() { return request<InventorySummary>({ url: `${base}/reports/summary`, method: 'get' }) }

/** 上架策略规则 */
export interface PutawayStrategy { id: number; warehouseId: number; strategyName: string; ruleType: string; priority: number; ruleValue: string; status: string }
export function fetchPutawayStrategies(params: InventoryQuery) { return request<PutawayStrategy[]>({ url: `${base}/putaway-strategies`, method: 'get', params }) }
export function createPutawayStrategy(data: Record<string, unknown>) { return request<PutawayStrategy>({ url: `${base}/putaway-strategies`, method: 'post', data }) }
export function recommendPutaway(data: Record<string, unknown>) { return request<Record<string, unknown>>({ url: `${base}/putaway-strategies/recommend`, method: 'post', data }) }

/** 拣货路径优化 */
export function fetchPickPath(id: number) { return request<Record<string, unknown>>({ url: `${base}/waves/${id}/pick-path`, method: 'get' }) }

/** 库存分析报表 */
export function fetchAgingReport(params: Record<string, unknown>) { return request<Record<string, unknown>>({ url: `${base}/reports/aging`, method: 'get', params }) }
export function fetchAbcReport(params: Record<string, unknown>) { return request<Record<string, unknown>>({ url: `${base}/reports/abc`, method: 'get', params }) }
export function fetchInOutReport(params: Record<string, unknown>) { return request<Record<string, unknown>>({ url: `${base}/reports/in-out`, method: 'get', params }) }
export function fetchInTransitReport(params: Record<string, unknown>) { return request<Record<string, unknown>>({ url: `${base}/reports/in-transit`, method: 'get', params }) }
export interface StockAdjustment {
  id: number
  adjustNo: string
  adjustType: string
  warehouseId: number | null
  status: string
  totalQtyIn: string
  totalQtyOut: string
  totalAmount: string
  reason: string | null
  postedAt: string | null
  createdAt: string
}
export interface StockAdjustmentLine {
  id: number
  adjustmentId: number
  productId: number
  variantId: number
  batchNo: string
  qty: string
  cost: string
  amount: string
  reason: string | null
}
export function fetchAdjustments(params: InventoryQuery) { return request<PageResult<StockAdjustment>>({ url: `${base}/adjustments`, method: 'get', params }) }
export function fetchAdjustmentDetail(id: number) { return request<{ adjustment: StockAdjustment; lines: StockAdjustmentLine[] }>({ url: `${base}/adjustments/${id}`, method: 'get' }) }
export function createAdjustment(data: Record<string, unknown>) { return request<{ adjustment: StockAdjustment; lines: StockAdjustmentLine[] }>({ url: `${base}/adjustments`, method: 'post', data }) }
export function postAdjustment(id: number, data: Record<string, unknown> = {}) { return request<StockAdjustment>({ url: `${base}/adjustments/${id}/post`, method: 'post', data }) }
export function cancelAdjustment(id: number, data: Record<string, unknown> = {}) { return request<StockAdjustment>({ url: `${base}/adjustments/${id}/cancel`, method: 'post', data }) }

/* ==================== 出入库单 ==================== */

export interface IoTypeMeta {
  code: string
  label: string
  direction: string
  allowProvisional: boolean
  requireCost: boolean
  requireAttachment: boolean
}

export interface StockIoDocument {
  id: number
  docNo: string
  ioType: string
  direction: string
  sourceType: string
  sourceId: number
  warehouseId: number
  status: string
  provisionalAmount: string
  costAmount: string
  reversalOfId: number
  reversalReason: string | null
  docDate: string | null
  remark: string | null
  createdAt: string
  postedAt: string | null
  reversedAt: string | null
}

export interface StockIoLine {
  id: number
  docId: number
  productId: number
  variantId: number
  locationId: number
  batchNo: string
  qtyIn: string
  qtyOut: string
  unitCost: string
  amount: string
  isProvisional: number
  remark: string | null
}

export interface StockIoAttachment {
  id: number
  docId: number
  fileName: string
  fileUrl: string
  fileSize: number
  createdAt: string
}

export interface StockIoDetail {
  doc: StockIoDocument
  lines: StockIoLine[]
  attachments: StockIoAttachment[]
}

export interface StockIoLineInput {
  productId: number
  variantId?: number
  locationId?: number
  batchNo?: string
  qtyIn?: string
  qtyOut?: string
  unitCost?: string
  isProvisional?: boolean
  remark?: string
}

export interface CreateStockIoInput {
  ioType: string
  warehouseId: number
  sourceType?: string
  sourceId?: number
  provisionalAmount?: string
  docDate?: string
  remark?: string
  lines: StockIoLineInput[]
}

export function fetchIoTypes() { return request<IoTypeMeta[]>({ url: `${base}/io-doc/types`, method: 'get' }) }
export function fetchIoDocs(params: InventoryQuery & { ioType?: string; status?: string }) {
  return request<PageResult<StockIoDocument>>({ url: `${base}/io-doc`, method: 'get', params })
}
export function fetchIoDoc(id: number) { return request<StockIoDetail>({ url: `${base}/io-doc/${id}`, method: 'get' }) }
export function createIoDoc(data: CreateStockIoInput) { return request<StockIoDetail>({ url: `${base}/io-doc`, method: 'post', data }) }
export function postIoDoc(id: number, data: Record<string, unknown> = {}) { return request<StockIoDetail>({ url: `${base}/io-doc/${id}/post`, method: 'post', data }) }
export function reverseIoDoc(id: number, reason: string) { return request<StockIoDetail>({ url: `${base}/io-doc/${id}/reverse`, method: 'post', data: { reason } }) }
export function addIoAttachment(id: number, data: { fileName: string; fileUrl?: string; fileSize?: number }) {
  return request<StockIoAttachment>({ url: `${base}/io-doc/${id}/attachments`, method: 'post', data })
}
export function removeIoAttachment(id: number, attachmentId: number) {
  return request<null>({ url: `${base}/io-doc/${id}/attachments/${attachmentId}`, method: 'delete' })
}
