import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface Evaluate { id: number; supplierId: number; period: string; totalScore: string; level: string }
export interface Rfq { id: number; rfqNo: string; projectName: string; quoteDeadline: string | null; status: string }
export interface Demand { id: number; demandNo: string; productId: number; qty: string; sourceType: string; status: string }
export interface PurchaseOrder { id: number; orderNo: string; supplierId: number; orderDate: string; status: string; totalAmount: string; payStatus: string }
export interface PurchaseOrderLine { id: number; orderId: number; productId: number; qty: string; unitPrice: string; amount: string; receivedQty: string }
export interface Receipt { id: number; receiptNo: string; orderId: number; supplierId: number; status: string; receivedAt: string | null }
export interface VendorStatement { id: number; statementNo: string; supplierId: number; period: string; amount: string; settledAmount: string; status: string }
export interface PurchaseReturn { id: number; returnNo: string; supplierId: number; receiptId: number | null; reason: string | null; refundAmount: string; status: string }
export interface PurchaseContract { id: number; contractNo: string; supplierId: number; title: string; totalAmount: string; status: string }
export interface PurchasePrice { id: number; supplierId: number; productId: number; price: string; startDate: string | null; endDate: string | null; status: string }
export interface Carrier { id: number; carrierCode: string; carrierName: string; contactPhone: string | null; status: string }
export interface Waybill { id: number; waybillNo: string; carrierId: number; sourceType: string | null; status: string }
export interface PurchaseSummary {
  orderCount: number
  receiptCount: number
  totalAmount: string
  receivedQty: string
  bySupplier: Array<{ name: string; amount: string }>
  onTimeRate: number
  onTimeSampleCount: number
  qualityPassRate: number
  inspectedLineCount: number
  supplierRanking: Array<{ name: string; amount: string }>
}

export interface PurchaseQuery extends PageQuery { status?: string }

const base = '/purchase'

export function fetchEvaluates(params: PurchaseQuery) { return request<PageResult<Evaluate>>({ url: `${base}/evaluates`, method: 'get', params }) }
export function createEvaluate(data: Record<string, unknown>) { return request<Evaluate>({ url: `${base}/evaluates`, method: 'post', data }) }

export function fetchRfqs(params: PurchaseQuery) { return request<PageResult<Rfq>>({ url: `${base}/rfqs`, method: 'get', params }) }
export function fetchRfqDetail(id: number) { return request<{ rfq: Rfq; lines: Array<{ id: number; productId: number; qty: string; targetPrice: string; quotes: Array<{ id: number; supplierId: number; price: string; score: string; awarded: string }> }> }>({ url: `${base}/rfqs/${id}/detail`, method: 'get' }) }
export function createRfq(data: Record<string, unknown>) { return request<Rfq>({ url: `${base}/rfqs`, method: 'post', data }) }
export function addQuote(lineId: number, data: Record<string, unknown>) { return request<{ id: number }>({ url: `${base}/rfqs/lines/${lineId}/quotes`, method: 'post', data }) }
export function awardQuote(quoteId: number) { return request<{ id: number }>({ url: `${base}/rfqs/award`, method: 'post', data: { quoteId } }) }

export function fetchDemands(params: PurchaseQuery) { return request<PageResult<Demand>>({ url: `${base}/demands`, method: 'get', params }) }
export function createDemand(data: Record<string, unknown>) { return request<Demand>({ url: `${base}/demands`, method: 'post', data }) }

export function fetchPurchaseOrders(params: PurchaseQuery) { return request<PageResult<PurchaseOrder>>({ url: `${base}/orders`, method: 'get', params }) }
export function fetchPurchaseOrderDetail(id: number) { return request<{ order: PurchaseOrder; lines: PurchaseOrderLine[] }>({ url: `${base}/orders/${id}/detail`, method: 'get' }) }
export function createPurchaseOrder(data: Record<string, unknown>) { return request<PurchaseOrder>({ url: `${base}/orders`, method: 'post', data }) }
export function submitPurchaseOrder(id: number) { return request<PurchaseOrder>({ url: `${base}/orders/${id}/submit`, method: 'post' }) }
export function approvePurchaseOrder(id: number) { return request<PurchaseOrder>({ url: `${base}/orders/${id}/approve`, method: 'post' }) }

export interface ReceiptLine { id: number; receiptId: number; productId: number; qty: string; batchNo: string | null; serialNo: string | null; qcStatus: string }
export function fetchReceipts(params: PurchaseQuery) { return request<PageResult<Receipt>>({ url: `${base}/receipts`, method: 'get', params }) }
export function fetchReceiptDetail(id: number) { return request<{ receipt: Receipt; lines: ReceiptLine[] }>({ url: `${base}/receipts/${id}/detail`, method: 'get' }) }
export function createReceipt(data: Record<string, unknown>) { return request<Receipt>({ url: `${base}/receipts`, method: 'post', data }) }
export function updateQc(receiptId: number, lineId: number, qcStatus: string) { return request<ReceiptLine>({ url: `${base}/receipts/${receiptId}/lines/${lineId}/qc`, method: 'put', data: { qcStatus } }) }
export function completeReceipt(id: number) { return request<Receipt>({ url: `${base}/receipts/${id}`, method: 'put', data: { status: 'DONE' } }) }

export function fetchVendorStatements(params: PurchaseQuery) { return request<PageResult<VendorStatement>>({ url: `${base}/statements`, method: 'get', params }) }
export function createVendorStatement(data: Record<string, unknown>) { return request<VendorStatement>({ url: `${base}/statements`, method: 'post', data }) }
export function settleVendorStatement(id: number, amount: string) { return request<VendorStatement>({ url: `${base}/statements/${id}/settle`, method: 'post', data: { amount } }) }

export function fetchPurchaseReturns(params: PurchaseQuery) { return request<PageResult<PurchaseReturn>>({ url: `${base}/returns`, method: 'get', params }) }
export function createPurchaseReturn(data: Record<string, unknown>) { return request<PurchaseReturn>({ url: `${base}/returns`, method: 'post', data }) }

export function fetchPurchaseContracts(params: PurchaseQuery) { return request<PageResult<PurchaseContract>>({ url: `${base}/contracts`, method: 'get', params }) }
export function createPurchaseContract(data: Record<string, unknown>) { return request<PurchaseContract>({ url: `${base}/contracts`, method: 'post', data }) }

export function fetchPurchasePrices(params: PurchaseQuery) { return request<PageResult<PurchasePrice>>({ url: `${base}/prices`, method: 'get', params }) }
export function createPurchasePrice(data: Record<string, unknown>) { return request<PurchasePrice>({ url: `${base}/prices`, method: 'post', data }) }

export function fetchCarriers(params: PurchaseQuery) { return request<PageResult<Carrier>>({ url: `${base}/carriers`, method: 'get', params }) }
export function createCarrier(data: Record<string, unknown>) { return request<Carrier>({ url: `${base}/carriers`, method: 'post', data }) }
export function fetchWaybills(params: PurchaseQuery) { return request<PageResult<Waybill>>({ url: `${base}/waybills`, method: 'get', params }) }
export function createWaybill(data: Record<string, unknown>) { return request<Waybill>({ url: `${base}/waybills`, method: 'post', data }) }

export function fetchPurchaseSummary() { return request<PurchaseSummary>({ url: `${base}/reports/summary`, method: 'get' }) }

export interface OutsourceOrder {
  id: number
  outsourceNo: string
  supplierId: number
  productId: number
  warehouseId: number | null
  qty: string
  unitPrice: string
  amount: string
  issuedQty: string
  receivedQty: string
  status: string
  createdAt: string
  remark: string | null
}

export interface OutsourceOrderLine {
  id: number
  orderId: number
  materialId: number
  qty: string
  issuedQty: string
  returnedQty: string
}

export interface PortalSummary {
  supplierId: number | null
  orderCount: number
  receiptCount: number
  statementCount: number
  orderAmount: string
  unpaidAmount: string
  rating: string
}

export interface PortalQuery extends PageQuery {
  supplierId?: number
  status?: string
}

export function fetchOutsourceOrders(params: PurchaseQuery) { return request<PageResult<OutsourceOrder>>({ url: `${base}/outsource-orders`, method: 'get', params }) }
export function createOutsourceOrder(data: Record<string, unknown>) { return request<OutsourceOrder>({ url: `${base}/outsource-orders`, method: 'post', data }) }
export function fetchOutsourceDetail(id: number) { return request<{ order: OutsourceOrder; lines: OutsourceOrderLine[] }>({ url: `${base}/outsource-orders/${id}/detail`, method: 'get' }) }
export function setOutsourceStatus(id: number, status: string) { return request<OutsourceOrder>({ url: `${base}/outsource-orders/${id}/status`, method: 'post', data: { status } }) }
export function issueOutsourceMaterial(id: number, data: Record<string, unknown>) { return request<OutsourceOrder>({ url: `${base}/outsource-orders/${id}/issue`, method: 'post', data }) }
export function receiveOutsource(id: number, data: Record<string, unknown>) { return request<OutsourceOrder>({ url: `${base}/outsource-orders/${id}/receive`, method: 'post', data }) }

export function fetchPortalSummary(params: PortalQuery) { return request<PortalSummary>({ url: `${base}/portal/summary`, method: 'get', params }) }
export function fetchPortalOrders(params: PortalQuery) { return request<PageResult<PurchaseOrder>>({ url: `${base}/portal/orders`, method: 'get', params }) }
export function fetchPortalReceipts(params: PortalQuery) { return request<PageResult<Receipt>>({ url: `${base}/portal/receipts`, method: 'get', params }) }
export function fetchPortalStatements(params: PortalQuery) { return request<PageResult<VendorStatement>>({ url: `${base}/portal/statements`, method: 'get', params }) }
export function fetchPortalEvaluates(params: PortalQuery) { return request<PageResult<Evaluate>>({ url: `${base}/portal/evaluates`, method: 'get', params }) }

/** 供应商自助填报：订单确认 / 对账确认 / 发货登记 / 发票登记 */
export function portalConfirmOrder(id: number) { return request<PurchaseOrder>({ url: `${base}/order-extensions/${id}/portal-confirm`, method: 'post' }) }
export function portalConfirmStatement(id: number) { return request<VendorStatement>({ url: `${base}/statement-extensions/${id}/portal-confirm`, method: 'post' }) }
export function portalCreateShipment(data: Record<string, unknown>) { return request<Record<string, unknown>>({ url: `${base}/price-extensions/portal/shipments`, method: 'post', data }) }
export function portalCreateInvoice(data: Record<string, unknown>) { return request<Record<string, unknown>>({ url: `${base}/price-extensions/portal/invoices`, method: 'post', data }) }
