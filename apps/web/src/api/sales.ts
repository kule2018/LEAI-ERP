import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface Lead {
  id: number
  leadNo: string
  name: string
  phone: string | null
  source: string | null
  score: number
  status: string
  ownerUserId: number | null
}

export interface Opportunity {
  id: number
  oppNo: string
  customerId: number
  title: string
  stage: string
  expectedAmount: string
  winRate: number
  closeDate: string | null
}

export interface Follow {
  id: number
  bizType: string
  bizId: number
  content: string
  followType: string
  createdAt: string
  createdBy?: number | null
  nextTime?: string | null
  /** 关联对象名称（客户 / 线索 / 商机） */
  bizName?: string | null
}

export interface Quotation {
  id: number
  quoteNo: string
  customerId: number
  quoteDate: string
  expireDate: string | null
  status: string
  totalAmount: string
}

export interface QuotationLine {
  id: number
  productId: number
  qty: string
  unitPrice: string
  amount: string
}

export interface SaleContract {
  id: number
  contractNo: string
  customerId: number
  title: string
  startDate: string | null
  endDate: string | null
  totalAmount: string
  status: string
  clauseIds?: string | null
  esignNo?: string | null
  version?: number
  renewCount?: number
  renewedFromId?: number | null
  signedAt?: string | null
}

export interface SaleOrder {
  id: number
  orderNo: string
  customerId: number
  warehouseId: number | null
  orderDate: string
  sourceType: string
  status: string
  payStatus: string
  shipStatus: string
  totalAmount: string
  paidAmount: string
}

export interface SaleOrderLine {
  id: number
  orderId: number
  productId: number
  variantId: number | null
  qty: string
  unitPrice: string
  amount: string
  shippedQty: string
}

export interface Statement {
  id: number
  statementNo: string
  customerId: number
  period: string
  amount: string
  settledAmount: string
  reversedAmount: string
  reverseReason: string | null
  reversedAt: string | null
  dueDate: string | null
  status: string
}

export interface Shipment {
  id: number
  shipmentNo: string
  orderId: number
  customerId: number
  status: string
  trackingNo: string | null
  signedAt: string | null
  signedBy: string | null
  signEvidence: Record<string, unknown> | null
  createdAt: string
}

export interface SaleReturn {
  id: number
  returnNo: string
  customerId: number
  orderId: number | null
  reason: string | null
  status: string
  refundAmount: string
}

export interface PriceAgreement {
  id: number
  customerId: number
  productId: number | null
  categoryId: number | null
  price: string
  qtyStep: string
  startDate: string | null
  endDate: string | null
  status: string
}

export interface SaleTarget {
  id: number
  period: string
  orgId: number | null
  userId: number | null
  targetAmount: string
  actualAmount: string
}

export interface SalesSummary {
  orderCount: number
  totalAmount: string
  byCustomer: Array<{ name: string; amount: string }>
  byProduct: Array<{ name: string; amount: string }>
  byMonth: Array<{ month: string; amount: string }>
}

export interface SalesQuery extends PageQuery {
  status?: string
}

const base = '/sales'

export function fetchLeads(params: SalesQuery) { return request<PageResult<Lead>>({ url: `${base}/leads`, method: 'get', params }) }
export function createLead(data: Record<string, unknown>) { return request<Lead>({ url: `${base}/leads`, method: 'post', data }) }
export function updateLead(id: number, data: Record<string, unknown>) { return request<Lead>({ url: `${base}/leads/${id}`, method: 'put', data }) }
export function convertLead(id: number) { return request<Lead>({ url: `${base}/leads/${id}/convert`, method: 'post' }) }

export function fetchOpportunities(params: SalesQuery) { return request<PageResult<Opportunity>>({ url: `${base}/opportunities`, method: 'get', params }) }
export function createOpportunity(data: Record<string, unknown>) { return request<Opportunity>({ url: `${base}/opportunities`, method: 'post', data }) }
export function updateOpportunity(id: number, data: Record<string, unknown>) { return request<Opportunity>({ url: `${base}/opportunities/${id}`, method: 'put', data }) }

export function fetchFollows(bizType: string, bizId: number) { return request<Follow[]>({ url: `${base}/follows`, method: 'get', params: { bizType, bizId } }) }
export function createFollow(data: Record<string, unknown>) { return request<Follow>({ url: `${base}/follows`, method: 'post', data }) }

export interface FollowTimelineQuery extends SalesQuery {
  bizType?: string
  bizId?: number
  followType?: string
  keyword?: string
  startDate?: string
  endDate?: string
}

/** 跟进流水（跨线索 / 商机 / 客户） */
export function fetchFollowTimeline(params: FollowTimelineQuery) {
  return request<PageResult<Follow>>({ url: `${base}/follows/timeline`, method: 'get', params })
}

export function fetchQuotations(params: SalesQuery) { return request<PageResult<Quotation>>({ url: `${base}/quotations`, method: 'get', params }) }
export function fetchQuotationDetail(id: number) { return request<{ quotation: Quotation; lines: QuotationLine[] }>({ url: `${base}/quotations/${id}/detail`, method: 'get' }) }
export function createQuotation(data: Record<string, unknown>) { return request<Quotation>({ url: `${base}/quotations`, method: 'post', data }) }

export function fetchContracts(params: SalesQuery) { return request<PageResult<SaleContract>>({ url: `${base}/contracts`, method: 'get', params }) }
export function createContract(data: Record<string, unknown>) { return request<SaleContract>({ url: `${base}/contracts`, method: 'post', data }) }
export function fetchExpiringContracts() { return request<SaleContract[]>({ url: `${base}/contracts/expiring`, method: 'get' }) }
export function renewContract(id: number, data: Record<string, unknown>) { return request<SaleContract>({ url: `${base}/contracts/${id}/renew`, method: 'post', data }) }
export function signContract(id: number, data: Record<string, unknown>) { return request<SaleContract>({ url: `${base}/contracts/${id}/sign`, method: 'post', data }) }

export interface SaleClause {
  id: number
  clauseCode: string
  clauseTitle: string
  clauseContent: string | null
  category: string | null
  isSystem: number
  status: string
}

export function fetchClauses(params: SalesQuery) { return request<PageResult<SaleClause>>({ url: `${base}/clauses`, method: 'get', params }) }
export function createClause(data: Record<string, unknown>) { return request<SaleClause>({ url: `${base}/clauses`, method: 'post', data }) }
export function updateClause(id: number, data: Record<string, unknown>) { return request<SaleClause>({ url: `${base}/clauses/${id}`, method: 'put', data }) }

export function fetchOrders(params: SalesQuery) { return request<PageResult<SaleOrder>>({ url: `${base}/orders`, method: 'get', params }) }
export function fetchOrderDetail(id: number) { return request<{ order: SaleOrder; lines: SaleOrderLine[] }>({ url: `${base}/orders/${id}/detail`, method: 'get' }) }
export function createOrder(data: Record<string, unknown>) { return request<SaleOrder>({ url: `${base}/orders`, method: 'post', data }) }
export function submitOrder(id: number) { return request<SaleOrder>({ url: `${base}/orders/${id}/submit`, method: 'post' }) }
export function approveOrder(id: number) { return request<SaleOrder>({ url: `${base}/orders/${id}/approve`, method: 'post' }) }
/** 拆单：按明细行ID拆出新单 */
export function splitOrder(id: number, lineIds: number[]) {
  return request<{ source: SaleOrder; created: SaleOrder }>({ url: `${base}/orders/${id}/split`, method: 'post', data: { lineIds } })
}
/** 出货签收：记录签收人与签收凭证 */
export function signShipment(id: number, data: { signedBy?: string; evidenceUrls?: string[]; remark?: string }) {
  return request<Shipment>({ url: `${base}/shipments/${id}/sign`, method: 'post', data })
}
/** 缺货替代推荐 */
export function fetchSubstitutes(productId: number, warehouseId: number) {
  return request<Array<{ productId: number; productName: string; price: string; availableQty: string; priceDiff: string }>>({
    url: `${base}/products/${productId}/substitutes`, method: 'get', params: { warehouseId }
  })
}
export function createPosOrder(data: Record<string, unknown>) { return request<SaleOrder>({ url: `${base}/pos/orders`, method: 'post', data }) }

export function fetchStatements(params: SalesQuery) { return request<PageResult<Statement>>({ url: `${base}/statements`, method: 'get', params }) }
export function createStatement(data: Record<string, unknown>) { return request<Statement>({ url: `${base}/statements`, method: 'post', data }) }
export function settleStatement(id: number, amount: string) { return request<Statement>({ url: `${base}/statements/${id}/settle`, method: 'post', data: { amount } }) }
export function reverseStatement(id: number, amount: string, reason: string) {
  return request<Statement>({ url: `${base}/statements/${id}/reverse`, method: 'post', data: { amount, reason } })
}

export function fetchCollectionPlan() {
  return request<Array<Record<string, unknown>>>({ url: `${base}/statements/collection-plan`, method: 'get' })
}

export function fetchWriteoffSuggestion(id: number) {
  return request<Record<string, unknown>>({ url: `${base}/statements/${id}/writeoff-suggestion`, method: 'get' })
}

export function generateCollectionLetter(id: number) {
  return request<{ statementId: number; content: string }>({ url: `${base}/statements/${id}/collection-letter`, method: 'post' })
}

export function fetchShipments(params: SalesQuery) { return request<PageResult<Shipment>>({ url: `${base}/shipments`, method: 'get', params }) }
export function createShipment(data: Record<string, unknown>) { return request<Shipment>({ url: `${base}/shipments`, method: 'post', data }) }

export function fetchReturns(params: SalesQuery) { return request<PageResult<SaleReturn>>({ url: `${base}/returns`, method: 'get', params }) }
export function createReturn(data: Record<string, unknown>) { return request<SaleReturn>({ url: `${base}/returns`, method: 'post', data }) }

export function fetchAgreements(params: SalesQuery) { return request<PageResult<PriceAgreement>>({ url: `${base}/price-agreements`, method: 'get', params }) }
export function createAgreement(data: Record<string, unknown>) { return request<PriceAgreement>({ url: `${base}/price-agreements`, method: 'post', data }) }

export function fetchTargets(params: SalesQuery) { return request<PageResult<SaleTarget>>({ url: `${base}/targets`, method: 'get', params }) }
export function createTarget(data: Record<string, unknown>) { return request<SaleTarget>({ url: `${base}/targets`, method: 'post', data }) }

export function fetchSalesSummary() { return request<SalesSummary>({ url: `${base}/reports/summary`, method: 'get' }) }
