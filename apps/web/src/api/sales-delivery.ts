import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

const base = '/sales'

export interface TrackingNode {
  nodeCode: string
  nodeName: string
  nodeTime: string
  location: string | null
  operator: string | null
  source: string | null
  remark: string | null
  step?: number
  isCurrent?: boolean
}

export interface ShipmentException {
  id: number
  shipmentId: number
  orderId: number | null
  exceptionType: string
  severity: string
  description: string
  evidence: string[] | null
  status: string
  returnId: number | null
  handleRemark: string | null
  createdAt: string
}

export interface PickWaveState {
  id: number
  waveNo: string
  status: string
  priority: number
  totalTasks: number
  pickedTasks: number
  shippable: boolean
  reason: string
}

export interface PosShift {
  id: number
  shiftNo: string
  storeName: string
  cashierUserId: number | null
  openAt: string
  closeAt: string | null
  openingCash: string
  cashReceived: string
  otherIncome: string
  expectedCash: string
  actualCash: string | null
  differenceAmount: string
  level: string
  orderCount: number
  orderAmount: string
  paymentSummary: Array<{ payType: string; amount: number; count: number }> | null
  status: string
  remark: string | null
}

export interface PromotionBundle {
  id: number
  promotionCode: string
  promotionName: string
  bundleType: string
  thresholdAmount: string | null
  discountAmount: string | null
  comboPrice: string | null
  startDate: string | null
  endDate: string | null
  status: string
  priority: number
  remark: string | null
  items?: Array<{ id?: number; productId: number; qty: string }>
}

export interface BundlePreview {
  candidates: Array<{
    bundleId: number
    code: string
    name: string
    type: string
    discountAmount: number
    reason: string
    matchedLines: Array<{ productId: number; qty: number; amount: number }>
  }>
  applied: Array<{
    bundleId: number
    code: string
    name: string
    type: string
    discountAmount: number
    reason: string
  }>
  totalDiscount: number
  orderAmount: number
}

/** 出货物流轨迹 */
export function fetchShipmentTimeline(id: number) {
  return request<TrackingNode[]>({ url: `${base}/shipments/${id}/tracking`, method: 'get' })
}

/** 登记物流轨迹节点 */
export function addTrackingNode(id: number, data: Record<string, unknown>) {
  return request<TrackingNode>({ url: `${base}/shipments/${id}/tracking`, method: 'post', data })
}

/** 可关联的拣货波次（已复核方可发货） */
export function fetchShippableWaves() {
  return request<PickWaveState[]>({ url: `${base}/shipments/waves/available`, method: 'get' })
}

/** 出货单关联拣货波次 */
export function linkShipmentWave(id: number, waveId: number) {
  return request({ url: `${base}/shipments/${id}/wave`, method: 'post', data: { waveId } })
}

/** 出货异常列表 */
export function fetchShipmentExceptions(params: PageQuery) {
  return request<PageResult<ShipmentException>>({ url: `${base}/shipment-exceptions`, method: 'get', params })
}

/** 登记出货异常回单 */
export function registerShipmentException(id: number, data: Record<string, unknown>) {
  return request<ShipmentException>({ url: `${base}/shipments/${id}/exceptions`, method: 'post', data })
}

/** 处理出货异常（可转售后退货单） */
export function handleShipmentException(id: number, data: Record<string, unknown>) {
  return request<{ exception: ShipmentException; returnId: number | null }>({
    url: `${base}/shipment-exceptions/${id}/handle`, method: 'post', data
  })
}

/** 退货换货 */
export function exchangeReturn(id: number, data: Record<string, unknown>) {
  return request<{ orderId: number; shipmentId: number }>({ url: `${base}/returns/${id}/exchange`, method: 'post', data })
}

/** 退货单明细行 */
export interface SaleReturnLine {
  id: number
  returnId: number
  productId: number
  qty: string
  amount: string
  qcStatus?: string | null
}
/** 换货记录 */
export interface SaleReturnExchange {
  id: number
  returnId: number
  exchangeOrderId: number | null
  exchangeShipmentId: number | null
  exchangeQty: string
  exchangeStatus: string
  remark?: string | null
  createdAt: string
}
/** 退货单详情（明细 + 换货记录） */
export function fetchReturnDetail(id: number) {
  return request<{
    ret: { id: number; returnNo: string; customerId: number; status: string; returnType?: string | null; refundAmount?: string | null }
    lines: SaleReturnLine[]
    exchanges: SaleReturnExchange[]
  }>({ url: `${base}/returns/${id}/detail`, method: 'get' })
}

/** 班次列表 */
export function fetchPosShifts(params: PageQuery) {
  return request<PageResult<PosShift>>({ url: `${base}/pos-shifts`, method: 'get', params })
}

/** 当前未交班班次 */
export function fetchCurrentShift() {
  return request<PosShift | null>({ url: `${base}/pos-shifts/current`, method: 'get' })
}

/** 开班 */
export function openShift(data: Record<string, unknown>) {
  return request<PosShift>({ url: `${base}/pos-shifts/open`, method: 'post', data })
}

/** 交班 */
export function closeShift(id: number, data: Record<string, unknown>) {
  return request<PosShift>({ url: `${base}/pos-shifts/${id}/close`, method: 'post', data })
}

/** 大额差异班次审批 */
export function approveShift(id: number, remark: string) {
  return request<PosShift>({ url: `${base}/pos-shifts/${id}/approve`, method: 'post', data: { remark } })
}

/** 组合促销列表 */
export function fetchPromotionBundles(params: PageQuery) {
  return request<PageResult<PromotionBundle>>({ url: `${base}/promotion-bundles`, method: 'get', params })
}

/** 新建组合促销 */
export function createPromotionBundle(data: Record<string, unknown>) {
  return request<PromotionBundle>({ url: `${base}/promotion-bundles`, method: 'post', data })
}

/** 更新组合促销 */
export function updatePromotionBundle(id: number, data: Record<string, unknown>) {
  return request<PromotionBundle>({ url: `${base}/promotion-bundles/${id}`, method: 'put', data })
}

/** 组合促销试算 */
export function previewPromotionBundle(data: Record<string, unknown>) {
  return request<BundlePreview>({ url: `${base}/promotion-bundles/preview`, method: 'post', data })
}

/** 对账单差异分析与 AI 对账建议 */
export function analyzeStatement(statementId: number) {
  return request<{
    statement: Record<string, unknown>
    diff: { flag: string; diffAmount: number; diffRate: number; level: string; reasons: string[] }
    suggestions: Array<{ type: string; title: string; amount: number; confidence: number; evidence: string[]; action: string }>
  }>({ url: `${base}/statements/analysis`, method: 'post', data: { statementId } })
}
