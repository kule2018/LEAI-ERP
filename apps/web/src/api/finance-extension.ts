import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface FinanceExtensionQuery extends PageQuery {
  status?: string
  period?: string
  customerId?: string
}

export interface VoucherTemplate {
  id: number
  templateCode: string
  templateName: string
  bizType: string
  status: string
  items: unknown
}

export interface ExpensePolicy {
  id: number
  policyCode: string
  policyName: string
  category: string | null
  maxAmount: string | null
  requireInvoice: number
  requireApproval: number
  status: string
}

export interface ExpenseClaim {
  id: number
  claimNo: string
  direction: string
  amount: string
  occurredAt: string | null
  summary: string | null
  counterparty: string | null
  policyLevel: string
  status: string
  deptId: number | null
  approveRemark: string | null
  paymentId: number | null
}

export interface BadDebtProvision {
  id: number
  period: string
  customerId: number
  customerName: string | null
  agingBucket: string
  receivableAmount: string
  provisionRate: string
  provisionAmount: string
  status: string
}

export interface CollectionPlan {
  id: number
  customerId: number
  customerName: string | null
  amount: string
  overdueDays: number
  riskLevel: string
  suggestion: string | null
  status: string
}

export interface BankMatch {
  id: number
  transactionId: number
  externalNo: string | null
  bizType: string | null
  bizId: number | null
  score: string
  difference: string
  reason: string | null
  status: string
}

export interface CashflowScenario {
  id: number
  scenarioName: string
  scenarioType: string
  inflowFactor: string
  outflowFactor: string
  oneOff: string
  startDate: string | null
  endDate: string | null
}

export interface PeriodCheck {
  id: number
  period: string
  checkCode: string
  checkName: string
  passed: number
  detail: string | null
  severity: string
}

export interface BudgetOccupation {
  id: number
  budgetId: number
  period: string
  deptId: number | null
  subjectId: number | null
  amount: string
  bizType: string | null
  released: number
}

const base = '/finance/extensions'

/* 科目停用校验与辅助核算 */
export function validateVoucherEntries(data: { entries: Array<Record<string, unknown>> }) {
  return request<Record<string, unknown>>({ url: `${base}/vouchers/validate`, method: 'post', data })
}
export function fetchSubjectUsage(subjectId: number) {
  return request<Record<string, unknown>>({ url: `${base}/subjects/${subjectId}/usage`, method: 'get' })
}

/* 凭证模板与 AI 科目建议 */
export function fetchVoucherTemplates(params: FinanceExtensionQuery) {
  return request<PageResult<VoucherTemplate>>({ url: `${base}/templates`, method: 'get', params })
}
export function createVoucherTemplate(data: Record<string, unknown>) {
  return request<VoucherTemplate>({ url: `${base}/templates`, method: 'post', data })
}
export function applyVoucherTemplate(templateId: number, data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/templates/${templateId}/apply`, method: 'post', data })
}
export function fetchSubjectSuggestions(params: { keyword: string; limit?: number }) {
  return request<Record<string, unknown>>({ url: `${base}/vouchers/subject-suggestions`, method: 'get', params })
}

/* 凭证附件 */
export function fetchVoucherAttachments(voucherId: number) {
  return request<Array<Record<string, unknown>>>({ url: `${base}/vouchers/${voucherId}/attachments`, method: 'get' })
}
export function addVoucherAttachment(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/vouchers/attachments`, method: 'post', data })
}

/* 试算平衡与报表下钻 */
export function fetchTrialBalanceAnalysis(params: { period?: string }) {
  return request<Record<string, unknown>>({ url: `${base}/trial-balance/analysis`, method: 'get', params })
}
export function fetchStatementComparison(params: { period?: string }) {
  return request<Record<string, unknown>>({ url: `${base}/statements/compare`, method: 'get', params })
}

/* 收支 OCR 与费用政策 */
export function ocrReceipt(text: string) {
  return request<Record<string, unknown>>({ url: `${base}/expense/ocr`, method: 'post', data: { text } })
}
export function fetchExpensePolicies(params: FinanceExtensionQuery) {
  return request<PageResult<ExpensePolicy>>({ url: `${base}/expense/policies`, method: 'get', params })
}
export function createExpensePolicy(data: Record<string, unknown>) {
  return request<ExpensePolicy>({ url: `${base}/expense/policies`, method: 'post', data })
}
export function fetchExpenseClaims(params: FinanceExtensionQuery) {
  return request<PageResult<ExpenseClaim>>({ url: `${base}/expense/claims`, method: 'get', params })
}
export function createExpenseClaim(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/expense/claims`, method: 'post', data })
}
export function approveExpenseClaim(id: number, data: { status?: string; remark?: string }) {
  return request<Record<string, unknown>>({ url: `${base}/expense/claims/${id}/approve`, method: 'post', data })
}
export function allocateExpenseClaim(id: number, items: Array<{ deptId: number; ratio: number; subjectId?: number }>) {
  return request<Record<string, unknown>>({ url: `${base}/expense/claims/${id}/allocate`, method: 'post', data: { items } })
}
export function payExpenseClaim(id: number, data: { supplierId: number; accountId: number; amount?: string }) {
  return request<Record<string, unknown>>({ url: `${base}/expense/claims/${id}/pay`, method: 'post', data })
}

/* 账龄催收与坏账计提 */
export function fetchAgingRisk(params: { customerId?: string }) {
  return request<Record<string, unknown>>({ url: `${base}/aging/risk`, method: 'get', params })
}
export function fetchCollectionPlans(params: FinanceExtensionQuery) {
  return request<PageResult<CollectionPlan>>({ url: `${base}/collection-plans`, method: 'get', params })
}
export function createCollectionPlan(data: Record<string, unknown>) {
  return request<CollectionPlan>({ url: `${base}/collection-plans`, method: 'post', data })
}
export function fetchProvisions(params: FinanceExtensionQuery) {
  return request<PageResult<BadDebtProvision>>({ url: `${base}/provisions`, method: 'get', params })
}
export function fetchProvisionSuggestion(period: string) {
  return request<Record<string, unknown>>({ url: `${base}/provisions/suggestion`, method: 'get', params: { period } })
}
export function submitProvision(data: Record<string, unknown>) {
  return request<BadDebtProvision>({ url: `${base}/provisions`, method: 'post', data })
}
export function approveProvision(id: number, data: { approved: boolean; comment?: string }) {
  return request<BadDebtProvision>({ url: `${base}/provisions/${id}/approve`, method: 'put', data })
}

/* 银行流水自动匹配 */
export function fetchBankMatches(params: FinanceExtensionQuery) {
  return request<PageResult<BankMatch>>({ url: `${base}/bank-matches`, method: 'get', params })
}
export function runBankMatch(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/bank-matches/run`, method: 'post', data })
}
export function confirmBankMatch(data: { transactionId: number; bizType: string; bizId: number }) {
  return request<BankMatch>({ url: `${base}/bank-matches/confirm`, method: 'post', data })
}

/* 现金流日历与情景模拟 */
export function fetchCashflowScenarios(params: FinanceExtensionQuery) {
  return request<PageResult<CashflowScenario>>({ url: `${base}/cashflow/scenarios`, method: 'get', params })
}
export function createCashflowScenario(data: Record<string, unknown>) {
  return request<CashflowScenario>({ url: `${base}/cashflow/scenarios`, method: 'post', data })
}
export function fetchCashflowCalendar(params: { period?: string }) {
  return request<Record<string, unknown>>({ url: `${base}/cashflow/calendar`, method: 'get', params })
}
export function createCashflowCalendarItem(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/cashflow/calendar`, method: 'post', data })
}
export function simulateCashflow(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/cashflow/simulate`, method: 'post', data })
}

/** 滚动预测单月行 */
export interface RollingForecastRow {
  month: string
  openingBalance: number
  inflow: number
  outflow: number
  net: number
  endingBalance: number
  source: 'PLAN' | 'BASELINE'
  confidence: number
}

/** 滚动预测结果 */
export interface RollingForecast {
  baseMonth: string
  months: number
  baseline: { inflow: number; outflow: number }
  rows: RollingForecastRow[]
  totalInflow: number
  totalOutflow: number
  net: number
  endingBalance: number
  minEndingBalance: number
  warning: string | null
}

export function rollingForecast(data: { months?: number; baseMonth?: string; scenarioId?: number; inflowFactor?: number; outflowFactor?: number; openingBalance?: number; baselineMonths?: number }) {
  return request<RollingForecast>({ url: `${base}/cashflow/rolling-forecast`, method: 'post', data })
}

/* 成本重算任务回滚 */
export function rollbackCostJob(id: number) {
  return request<Record<string, unknown>>({ url: `${base}/cost-jobs/${id}/rollback`, method: 'post' })
}

/* 月结检查清单与反结账 */
export function fetchPeriodChecks(params: { period?: string }) {
  return request<PeriodCheck[]>({ url: `${base}/period-checks`, method: 'get', params })
}
export function runPeriodChecks(period: string) {
  return request<Record<string, unknown>>({ url: `${base}/period-checks/run`, method: 'post', data: { period } })
}
export function reopenPeriod(data: { period: string; reason?: string }) {
  return request<Record<string, unknown>>({ url: `${base}/periods/reopen`, method: 'post', data })
}

/* 预算编制控制占用 */
export function fetchBudgetOccupations(params: FinanceExtensionQuery) {
  return request<PageResult<BudgetOccupation>>({ url: `${base}/budget-occupations`, method: 'get', params })
}
export function occupyBudget(data: Record<string, unknown>) {
  return request<Record<string, unknown>>({ url: `${base}/budget-occupations`, method: 'post', data })
}
export function releaseBudget(occupationId: number) {
  return request<BudgetOccupation>({ url: `${base}/budget-occupations/release`, method: 'post', data: { occupationId } })
}

/* 财务仪表盘指标下钻 */
export function fetchFinanceDashboard() {
  return request<Record<string, unknown>>({ url: `${base}/dashboard`, method: 'get' })
}
