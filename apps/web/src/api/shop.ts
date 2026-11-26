import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface ShopStore {
  id: number
  storeCode: string
  storeName: string
  platform: string
  healthStatus: string
  syncStrategy: string
  authExpireAt: string | null
  status: string
  createdAt: string
}

export interface ShopGoodsMap {
  id: number
  storeId: number
  platformGoodsId: string
  platformSkuId: string | null
  productId: number
  variantId: number
  priceRule: string | null
  stockRule: string | null
  status: string
  syncStatus: string
  errorText: string | null
}

export interface ShopOrder {
  id: number
  storeId: number
  platformOrderNo: string
  customerId: number | null
  saleOrderId: number | null
  orderAmount: string
  paidAmount: string
  shipStatus: string
  status: string
  retryCount?: number
  errorText?: string | null
  syncedAt: string | null
  createdAt: string
}

export interface ShopPromotion {
  id: number
  storeId: number
  promotionCode: string
  promotionType: string
  startTime: string
  endTime: string
  stockLimit: string
  status: string
}

export interface ShopPaymentConfig {
  id: number
  storeId: number
  channel: string
  merchantId: string | null
  secretMask: string | null
  status: string
}

export interface ShopWaybill {
  id: number
  storeId: number
  shopOrderId: number
  waybillNo: string
  carrier: string | null
  labelUrl: string | null
  status: string
  exceptionFlag: string
  createdAt: string
}

export interface ShopConversation {
  id: number
  storeId: number
  platformBuyerId: string | null
  status: string
  lastMessage: string | null
  createdAt: string
  updatedAt: string | null
}

export interface ShopLog {
  id: number
  storeId: number
  bizType: string
  bizId: number
  idempotentKey: string | null
  result: string
  errorText: string | null
  createdAt: string
}

export interface ShopReport {
  storeCount: number
  orderCount: number
  syncedCount: number
  shippedCount: number
  orderAmount: string
}

export function fetchStores(params: PageQuery) {
  return request<PageResult<ShopStore>>({ url: '/shop/stores', method: 'get', params })
}

export function createStore(data: Record<string, unknown>) {
  return request<ShopStore>({ url: '/shop/stores', method: 'post', data })
}

export function checkStoreHealth(id: number) {
  return request<ShopStore>({ url: `/shop/stores/${id}/health`, method: 'post' })
}

export function fetchGoodsMaps(params: PageQuery) {
  return request<PageResult<ShopGoodsMap>>({ url: '/shop/goods-maps', method: 'get', params })
}

export function createGoodsMap(data: Record<string, unknown>) {
  return request<ShopGoodsMap>({ url: '/shop/goods-maps', method: 'post', data })
}

export function syncGoodsMap(id: number) {
  return request<ShopGoodsMap>({ url: `/shop/goods-maps/${id}/sync`, method: 'post' })
}

export function retryFailedGoodsMaps() {
  return request<number>({ url: '/shop/goods-maps/retry-failed', method: 'post' })
}

export function fetchShopOrders(params: PageQuery & { status?: string }) {
  return request<PageResult<ShopOrder>>({ url: '/shop/orders', method: 'get', params })
}

export function syncShopOrder(data: Record<string, unknown>) {
  return request<ShopOrder>({ url: '/shop/orders/sync', method: 'post', data })
}

export function shipShopOrder(id: number, data: { waybillNo: string; carrier?: string }) {
  return request<ShopOrder>({ url: `/shop/orders/${id}/ship`, method: 'post', data })
}

export function retryShopOrder(id: number) {
  return request<ShopOrder>({ url: `/shop/orders/${id}/retry`, method: 'post' })
}

export function retryShopOrdersBatch() {
  return request<{ retried: number }>({ url: '/shop/orders/retry-batch', method: 'post' })
}

export function fetchPromotions(params: PageQuery & { status?: string }) {
  return request<PageResult<ShopPromotion>>({ url: '/shop/promotions', method: 'get', params })
}

export function createPromotion(data: Record<string, unknown>) {
  return request<ShopPromotion>({ url: '/shop/promotions', method: 'post', data })
}

export function fetchPaymentConfigs(params: PageQuery) {
  return request<PageResult<ShopPaymentConfig>>({ url: '/shop/payment-configs', method: 'get', params })
}

export function createPaymentConfig(data: Record<string, unknown>) {
  return request<ShopPaymentConfig>({ url: '/shop/payment-configs', method: 'post', data })
}

export function reconcilePayment(storeId: number, data: { result: 'SUCCESS' | 'DIFF' | 'PENDING'; note?: string }) {
  return request<ShopLog>({ url: `/shop/payment-configs/${storeId}/reconcile`, method: 'post', data })
}

export function fetchWaybills(params: PageQuery) {
  return request<PageResult<ShopWaybill>>({ url: '/shop/waybills', method: 'get', params })
}

export function markWaybillException(id: number) {
  return request<ShopWaybill>({ url: `/shop/waybills/${id}/exception`, method: 'post' })
}

export function fetchConversations(params: PageQuery) {
  return request<PageResult<ShopConversation>>({ url: '/shop/cs', method: 'get', params })
}

export function createConversation(data: Record<string, unknown>) {
  return request<ShopConversation>({ url: '/shop/cs', method: 'post', data })
}

export function replyConversation(id: number, message: string) {
  return request<ShopConversation>({ url: `/shop/cs/${id}/reply`, method: 'post', data: { message } })
}

export function fetchShopLogs(params: PageQuery) {
  return request<PageResult<ShopLog>>({ url: '/shop/logs', method: 'get', params })
}

export function fetchShopReport() {
  return request<ShopReport>({ url: '/shop/report', method: 'get' })
}

export interface ShopCoupon {
  id: number
  storeId: number
  couponCode: string
  couponType: 'FIXED' | 'PERCENT'
  discountValue: string
  minAmount: string
  maxDiscount: string
  startTime: string
  endTime: string
  stackable: number
  usedCount: number
  status: string
}

export interface ShopSeckill {
  id: number
  storeId: number
  seckillCode: string
  productId: number
  variantId: number
  basePrice: string
  seckillPrice: string
  limitPerUser: number
  startTime: string
  endTime: string
  status: string
}

export interface ShopActivityStock {
  id: number
  storeId: number
  activityType: string
  activityId: number
  productId: number
  variantId: number
  totalStock: string
  soldStock: string
  lockedStock: string
  status: string
}

export interface PromotionEffect {
  couponCount: number
  couponUsedCount: number
  seckillCount: number
  activityStockCount: number
  totalActivityStock: string
  reservedQty: string
  soldQty: string
  releasedQty: string
  oversellBlockedCount: number
  discountAmount: string
}

export function fetchCoupons(params: PageQuery & { status?: string }) {
  return request<PageResult<ShopCoupon>>({ url: '/shop/promotions/coupons', method: 'get', params })
}

export function createCoupon(data: Record<string, unknown>) {
  return request<ShopCoupon>({ url: '/shop/promotions/coupons', method: 'post', data })
}

export function validateCoupon(data: { storeId: number; couponCode: string; amount: string; at?: string }) {
  return request<{ valid: boolean; discount: number; reason?: string }>({ url: '/shop/promotions/coupons/validate', method: 'post', data })
}

export function fetchSeckills(params: PageQuery & { status?: string }) {
  return request<PageResult<ShopSeckill>>({ url: '/shop/promotions/seckills', method: 'get', params })
}

export function createSeckill(data: Record<string, unknown>) {
  return request<ShopSeckill>({ url: '/shop/promotions/seckills', method: 'post', data })
}

export function fetchActivityStocks(params: PageQuery & { status?: string }) {
  return request<PageResult<ShopActivityStock>>({ url: '/shop/promotions/activity-stock', method: 'get', params })
}

export function setActivityStock(data: Record<string, unknown>) {
  return request<ShopActivityStock>({ url: '/shop/promotions/activity-stock', method: 'post', data })
}

export function reserveActivityStock(data: Record<string, unknown>) {
  return request<{ orderId: number; price: string }>({ url: '/shop/promotions/activity-stock/reserve', method: 'post', data })
}

export function releaseActivityStock(id: number) {
  return request<ShopActivityStock>({ url: `/shop/promotions/activity-stock/${id}/release`, method: 'post' })
}

export function fetchPromotionEffect(storeId?: number) {
  return request<PromotionEffect>({ url: '/shop/promotions/effect', method: 'get', params: storeId ? { storeId } : {} })
}

export interface ReconcileBill {
  id: number
  storeId: number
  billNo: string
  channel: string
  period: string | null
  platformAmount: string
  localAmount: string
  diffAmount: string
  currency: string
  status: string
  diffReason: string | null
  resolvedAt: string | null
  createdAt: string
}

export interface ShopRefund {
  id: number
  storeId: number
  shopOrderId: number
  saleReturnId: number | null
  refundNo: string
  amount: string
  reason: string | null
  status: string
  redInvoiceNo: string | null
  reviewNote: string | null
  reviewedAt: string | null
  createdAt: string
}

export function fetchReconcileBills(params: PageQuery & { status?: string }) {
  return request<PageResult<ReconcileBill>>({ url: '/shop/reconciliation/bills', method: 'get', params })
}

export function importReconcileBills(bills: Array<Record<string, unknown>>) {
  return request<ReconcileBill[]>({ url: '/shop/reconciliation/bills/import', method: 'post', data: { bills } })
}

export function resolveReconcileBill(id: number, note: string) {
  return request<ReconcileBill>({ url: `/shop/reconciliation/bills/${id}/resolve`, method: 'post', data: { note } })
}

export function fetchRefunds(params: PageQuery & { status?: string }) {
  return request<PageResult<ShopRefund>>({ url: '/shop/refunds', method: 'get', params })
}

export function createRefund(data: Record<string, unknown>) {
  return request<ShopRefund>({ url: '/shop/refunds', method: 'post', data })
}

export function approveRefund(id: number, data: { redInvoiceNo?: string; note?: string }) {
  return request<ShopRefund>({ url: `/shop/refunds/${id}/approve`, method: 'post', data })
}

export function rejectRefund(id: number, note: string) {
  return request<ShopRefund>({ url: `/shop/refunds/${id}/reject`, method: 'post', data: { note } })
}

export interface TrackingEvent {
  id: number
  waybillId: number
  carrierStatus: string
  location: string | null
  description: string | null
  eventAt: string
}

export interface CsQualityReview {
  id: number
  conversationId: number
  score: number
  result: 'PASS' | 'REVIEW' | 'FAIL'
  reviewNote: string | null
  createdAt: string
}

export function fetchTracking(waybillId: number) {
  return request<TrackingEvent[]>({ url: `/shop/waybills/${waybillId}/tracking`, method: 'get' })
}

export function pushTracking(waybillId: number, data: Record<string, unknown>) {
  return request<{ exception: { exception: boolean; reason?: string } }>({
    url: `/shop/waybills/${waybillId}/tracking`, method: 'post', data
  })
}

export function createCsQuality(conversationId: number, data: Record<string, unknown>) {
  return request<CsQualityReview>({ url: `/shop/cs/${conversationId}/quality`, method: 'post', data })
}

export function fetchCsQuality(params: PageQuery & { status?: string }) {
  return request<PageResult<CsQualityReview>>({ url: '/shop/cs/quality-reviews', method: 'get', params })
}

export function generateWaybill(orderId: number, carrier: string) {
  return request<ShopWaybill>({ url: `/shop/orders/${orderId}/waybill/generate`, method: 'post', data: { carrier } })
}

export function fetchActivityCalendar() {
  return request<Array<{ date: string; activities: Array<{ code: string; start: string; end: string }> }>>({
    url: '/shop/promotions/calendar', method: 'get'
  })
}

export function fetchQuickReplies(message: string) {
  return request<Array<{ code: string; content: string; matched: boolean }>>({
    url: '/shop/cs/quick-replies', method: 'post', data: { message }
  })
}
