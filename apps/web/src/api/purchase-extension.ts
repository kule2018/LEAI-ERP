import { request } from '@/utils/http'

const base = '/purchase'

/** 供应商资质与银行账户 */
export function listQualifications(supplierId: number) {
  return request<Array<Record<string, unknown>>>({ url: `${base}/supplier-extensions/qualifications/${supplierId}`, method: 'get' })
}

export function createQualification(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/supplier-extensions/qualifications`, method: 'post', data })
}

export function renewQualification(id: number, expireDate: string) {
  return request<Record<string, unknown>>({ url: `${base}/supplier-extensions/qualifications/${id}/renew`, method: 'put', data: { expireDate } })
}

export function qualificationAlerts() {
  return request<Array<Record<string, unknown>>>({ url: `${base}/supplier-extensions/qualification-alerts`, method: 'get' })
}

export function listBankAccounts(supplierId: number) {
  return request<Array<Record<string, unknown>>>({ url: `${base}/supplier-extensions/bank-accounts/${supplierId}`, method: 'get' })
}

export function createBankAccount(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/supplier-extensions/bank-accounts`, method: 'post', data })
}

export function supplierRadar(supplierId: number) {
  return request<Record<string, unknown>>({ url: `${base}/supplier-extensions/radar/${supplierId}`, method: 'get' })
}

/** 询价多轮比价与授标 */
export function listAwards(params?: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/awards`, method: 'get', params })
}

export function openQuoteRound(rfqId: number) {
  return request<Record<string, unknown>>({ url: `${base}/awards/rfqs/${rfqId}/rounds`, method: 'post' })
}

export function addRoundQuote(lineId: number, data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/awards/rfq-lines/${lineId}/quotes`, method: 'post', data })
}

export function compareQuotes(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/awards/compare`, method: 'post', data })
}

export function createAward(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/awards`, method: 'post', data })
}

export function approveAward(id: number, status: string, reason?: string) {
  return request<Record<string, unknown>>({ url: `${base}/awards/${id}/approve`, method: 'post', data: { status, reason } })
}

/** 需求合并转单与订单变更 */
export function mergeDemands(demandIds: number[]) {
  return request<Array<Record<string, unknown>>>({ url: `${base}/order-extensions/demands/merge`, method: 'post', data: { demandIds } })
}

export function convertDemand(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/order-extensions/demands/convert`, method: 'post', data })
}

export function changeOrder(id: number, data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/order-extensions/${id}/changes`, method: 'post', data })
}

export function listOrderChanges(id: number) {
  return request<Array<Record<string, unknown>>>({ url: `${base}/order-extensions/${id}/changes`, method: 'get' })
}

export function createArrivalPlan(id: number, data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/order-extensions/${id}/arrival-plans`, method: 'post', data })
}

export function orderProgress(id: number) {
  return request<Record<string, unknown>>({ url: `${base}/order-extensions/${id}/progress`, method: 'get' })
}

export function confirmOrderByPortal(id: number) {
  return request<Record<string, unknown>>({ url: `${base}/order-extensions/${id}/portal-confirm`, method: 'post' })
}

/** 扫码收货、差异收货、暂估与成本分摊 */
export function scanReceipt(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/receipt-extensions/scan`, method: 'post', data })
}

export function receiveDifference(id: number, data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/receipt-extensions/${id}/difference`, method: 'post', data })
}

export function createEstimate(id: number, amount: string) {
  return request<Record<string, unknown>>({ url: `${base}/receipt-extensions/${id}/estimate`, method: 'post', data: { amount } })
}

export function reverseEstimate(id: number, data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/receipt-extensions/${id}/estimate/reverse`, method: 'post', data })
}

export function allocateCost(id: number, data: Record<string, unknown>) {
  return request<Array<Record<string, unknown>>>({ url: `${base}/receipt-extensions/${id}/cost-allocations`, method: 'post', data })
}

/** 对账差异与红冲 */
export function statementDifference(id: number) {
  return request<Record<string, unknown>>({ url: `${base}/statement-extensions/${id}/difference`, method: 'get' })
}

export function markStatementDifference(id: number, data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/statement-extensions/${id}/difference`, method: 'post', data })
}

export function reverseStatement(id: number, data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/statement-extensions/${id}/reverse`, method: 'post', data })
}

export function confirmStatementByPortal(id: number) {
  return request<Record<string, unknown>>({ url: `${base}/statement-extensions/${id}/portal-confirm`, method: 'post' })
}

/** 委外损耗、结算与对账 */
export function createOutsourceLoss(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/outsource-extensions/losses`, method: 'post', data })
}

export function approveLoss(id: number, status: string, reason?: string) {
  return request<Record<string, unknown>>({ url: `${base}/outsource-extensions/losses/${id}/approve`, method: 'post', data: { status, reason } })
}

export function settleOutsource(id: number, amount: string) {
  return request<Record<string, unknown>>({ url: `${base}/outsource-extensions/${id}/settle`, method: 'post', data: { amount } })
}

export function outsourceReconcile(id: number) {
  return request<Record<string, unknown>>({ url: `${base}/outsource-extensions/${id}/reconcile`, method: 'get' })
}

/** 物流轨迹与运费对账 */
export function addTrackNode(waybillId: number, data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/logistics-extensions/waybills/${waybillId}/track-nodes`, method: 'post', data })
}

export function listTrackNodes(waybillId: number) {
  return request<Record<string, unknown>>({ url: `${base}/logistics-extensions/waybills/${waybillId}/track-nodes`, method: 'get' })
}

export function reportWaybillException(waybillId: number, data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/logistics-extensions/waybills/${waybillId}/exception`, method: 'post', data })
}

export function reconcileFreight(waybillId: number, data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/logistics-extensions/waybills/${waybillId}/freight-reconcile`, method: 'post', data })
}

/** 价目表、取价、门户与绩效 */
export function priceMatrix() {
  return request<Array<Record<string, unknown>>>({ url: `${base}/price-extensions/matrix`, method: 'get' })
}

export function priceHistory(productId: number, supplierId: number) {
  return request<Array<Record<string, unknown>>>({ url: `${base}/price-extensions/history`, method: 'get', params: { productId, supplierId } })
}

export function resolvePrice(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/price-extensions/resolve`, method: 'post', data })
}

export function approvePrice(id: number, status: string, reason?: string) {
  return request<Record<string, unknown>>({ url: `${base}/price-extensions/${id}/approve`, method: 'post', data: { status, reason } })
}

export function portalShipment(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/price-extensions/portal/shipments`, method: 'post', data })
}

export function portalInvoice(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/price-extensions/portal/invoices`, method: 'post', data })
}

export function purchasePerformance() {
  return request<Record<string, unknown>>({ url: `${base}/price-extensions/performance`, method: 'get' })
}

/** 三方匹配证据链 */
export function runMatchEvidence(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/compliance-extensions/match-evidence`, method: 'post', data })
}

export function listMatchEvidence(receiptId: number) {
  return request<Array<Record<string, unknown>>>({ url: `${base}/compliance-extensions/match-evidence/${receiptId}`, method: 'get' })
}

/** 框架协议版本 */
export function createFrameAgreement(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/compliance-extensions/frame-agreements`, method: 'post', data })
}

export function listFrameAgreements(params?: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/compliance-extensions/frame-agreements`, method: 'get', params })
}

export function upgradeFrameAgreement(id: number, data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/compliance-extensions/frame-agreements/${id}/upgrade`, method: 'put', data })
}

/** 供应商黑名单 */
export function addSupplierBlacklist(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/compliance-extensions/supplier-blacklist`, method: 'post', data })
}

export function listSupplierBlacklists(params?: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/compliance-extensions/supplier-blacklist`, method: 'get', params })
}

export function checkSupplierBlacklist(supplierId: number) {
  return request<Record<string, unknown>>({ url: `${base}/compliance-extensions/supplier-blacklist/${supplierId}/check`, method: 'get' })
}

export function liftSupplierBlacklist(supplierId: number) {
  return request<Record<string, unknown>>({ url: `${base}/compliance-extensions/supplier-blacklist/${supplierId}`, method: 'delete' })
}
