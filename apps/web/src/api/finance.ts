import { request, requestBlob } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface Subject { id: number; subjectCode: string; subjectName: string; parentId: number | null; category: string; direction: string; status: string }
export interface FinAccount { id: number; accountCode: string; accountName: string; accountType: string; balance: string; status: string }
export interface Voucher { id: number; voucherNo: string; voucherDate: string; period: string; sourceType: string | null; status: string; totalDebit: string; totalCredit: string; remark: string | null }
export interface VoucherEntry { id: number; subjectId: number; summary: string; debit: string; credit: string }
export interface TrialRow { subjectId: number; subjectCode: string; subjectName: string; debit: string; credit: string; balance: string }
export interface StatementData { period: string; incomeStatement: { income: string; expense: string; profit: string }; balanceSheet: { assets: string; liabilities: string; equity: string; balanced: boolean }; cashFlow: { inflow: string; outflow: string } }
export interface Receivable { id: number; customerId: number; sourceNo: string | null; amount: string; receivedAmount: string; dueDate: string | null; status: string }
export interface Payable { id: number; supplierId: number; sourceNo: string | null; amount: string; paidAmount: string; dueDate: string | null; status: string }
export interface Receipt { id: number; receiptNo: string; customerId: number; accountId: number; amount: string; receivedAt: string; status: string }
export interface Payment { id: number; paymentNo: string; supplierId: number; accountId: number; amount: string; paidAt: string; status: string }
export interface Invoice { id: number; invoiceNo: string; invoiceType: string; amount: string; taxAmount: string; status: string }
export interface Asset { id: number; assetNo: string; assetName: string; originalValue: string; depreciatedValue: string; netValue: string; usefulMonths: number; status: string }
export interface FinPeriod { id: number; period: string; status: string; closedAt: string | null }
export interface Cost { id: number; productId: number; period: string; costType: string; amount: string }
export interface Budget { id: number; period: string; deptId: number | null; subjectId: number | null; budgetAmount: string; usedAmount: string; controlRule: string }
export interface CostJob {
  id: number
  period: string
  status: string
  progress: number
  totalItems: number
  errorMessage: string | null
  snapshot: Record<string, unknown> | null
  rollbackStatus: string | null
  rolledBackAt: string | null
  createdAt: string
  finishedAt: string | null
}
export interface FinanceDashboard {
  receivableAmount: string
  payableAmount: string
  fundBalance: string
  voucherCount: number
  postedCount: number
  budgetExecution: {
    budgetAmount: string
    usedAmount: string
    occupiedAmount: string
    executionRate: number
    overBudgetCount: number
    controlRules: string[]
  }
  riskMetrics: {
    overdueReceivableAmount: string
    overdueReceivableCount: number
    overduePayableAmount: string
    overduePayableCount: number
    highRiskReceivableCount: number
    provisionAmount: string
    unpostedVoucherCount: number
  }
}
export interface Aging { type: string; current: string; days31: string; days61: string; days91: string }
export interface SubjectBalanceRow {
  subjectId: number
  subjectCode: string
  subjectName: string
  category: string
  direction: string
  openingBalance: number
  periodDebit: number
  periodCredit: number
  closingBalance: number
  balanceDirection: string
}
export interface SubjectBalanceResult {
  period: string
  beginPeriod: string
  rows: SubjectBalanceRow[]
  totals: { openingBalance: string; periodDebit: string; periodCredit: string; closingBalance: string }
}
export interface DetailLedgerRow {
  date: string
  voucherId: number
  voucherNo: string
  summary: string
  auxType: string | null
  auxId: string | null
  debit: number
  credit: number
  direction: string
  runningBalance: number
}
export interface DetailLedgerGroup {
  subjectId: number
  subjectCode: string
  subjectName: string
  direction: string
  openingBalance: number
  rows: DetailLedgerRow[]
  periodDebit: number
  periodCredit: number
  closingBalance: number
}
export interface DetailLedgerResult {
  period: string
  subjectId?: number
  subjectCode?: string
  subjectName?: string
  openingBalance?: string
  rows: DetailLedgerRow[]
  totals: { periodDebit: string; periodCredit: string; closingBalance: string }
  groups?: DetailLedgerGroup[]
}
export interface PeriodCarry { id: number; period: string; voucherId: number; totalAmount: string; profitAmount: string; subjectCount: number; status: string; createdAt: string }
export interface AccountTransfer { id: number; transferNo: string; fromAccountId: number; toAccountId: number; amount: string; transferDate: string; voucherId: number | null; remark: string | null; createdAt: string }
export interface AssetChange {
  id: number
  assetId: number
  changeType: string
  beforeValue: Record<string, unknown> | null
  afterValue: Record<string, unknown> | null
  changes: Array<{ field: string; label: string; before: unknown; after: unknown }> | null
  reason: string | null
  createdAt: string
}

export interface FinanceQuery extends PageQuery { status?: string; period?: string }

const base = '/finance'

export function fetchSubjects(params: FinanceQuery) { return request<PageResult<Subject>>({ url: `${base}/subjects`, method: 'get', params }) }
export function createSubject(data: Record<string, unknown>) { return request<Subject>({ url: `${base}/subjects`, method: 'post', data }) }
export function updateSubject(id: number, data: { subjectName?: string; status?: 'ENABLED' | 'DISABLED'; disableReason?: string }) {
  return request<Subject>({ url: `${base}/subjects/${id}`, method: 'put', data })
}
export function mergeSubjects(data: { sourceSubjectId: number; targetSubjectId: number }) {
  return request<{ migratedEntryCount: number; mergedBalance: string }>({ url: `${base}/subjects/merge`, method: 'post', data })
}
export function fetchAccounts(params: FinanceQuery) { return request<PageResult<FinAccount>>({ url: `${base}/accounts`, method: 'get', params }) }
export function createAccount(data: Record<string, unknown>) { return request<FinAccount>({ url: `${base}/accounts`, method: 'post', data }) }

export function fetchVouchers(params: FinanceQuery) { return request<PageResult<Voucher>>({ url: `${base}/vouchers`, method: 'get', params }) }
export function fetchVoucherDetail(id: number) { return request<{ voucher: Voucher; entries: VoucherEntry[] }>({ url: `${base}/vouchers/${id}/detail`, method: 'get' }) }
export function createVoucher(data: Record<string, unknown>) { return request<Voucher>({ url: `${base}/vouchers`, method: 'post', data }) }
export function postVoucher(id: number) { return request<Voucher>({ url: `${base}/vouchers/${id}/post`, method: 'post' }) }
export function reverseVoucher(id: number) { return request<Voucher>({ url: `${base}/vouchers/${id}/reverse`, method: 'post' }) }
export function voidVoucher(id: number, reason?: string) {
  return request<Voucher>({ url: `${base}/vouchers/${id}/void`, method: 'post', data: { reason } })
}
export function unpostVoucher(id: number) {
  return request<Voucher>({ url: `${base}/vouchers/${id}/unpost`, method: 'post' })
}

export function fetchTrialBalance(params: FinanceQuery) { return request<TrialRow[]>({ url: `${base}/trial-balance`, method: 'get', params }) }
export function fetchSubjectBalance(params: FinanceQuery & { beginPeriod?: string; subjectId?: number }) {
  return request<SubjectBalanceResult>({ url: `${base}/report/subject-balance`, method: 'get', params })
}
export function fetchDetailLedger(params: FinanceQuery & { subjectId?: number; subjectIds?: number[]; beginDate?: string; endDate?: string; voucherNo?: string }) {
  return request<DetailLedgerResult>({ url: `${base}/report/detail-ledger`, method: 'get', params })
}
/** 报表指标下钻：返回可继续下钻明细账的科目列表 */
export function fetchReportDrilldown(key: string, period: string) {
  return request<{
    key: string
    label: string
    period: string
    subjectIds: number[]
    side: string
    rows: Array<{ subjectId: number; subjectCode: string; subjectName: string; amount: number }>
    total: number
  }>({ url: `${base}/report/drilldown/${key}`, method: 'get', params: { period } })
}
/** 导出财务报表 CSV（带水印） */
export function downloadFinanceReport(type: 'statements' | 'balance' | 'ledger', period: string, subjectId?: number) {
  return requestBlob({ url: `${base}/report/export`, method: 'get', params: { type, period, subjectId } })
}
export function fetchPeriodCarries(params: FinanceQuery) { return request<PageResult<PeriodCarry>>({ url: `${base}/periods/carries`, method: 'get', params }) }
export function fetchAccountTransfers(params: FinanceQuery) { return request<PageResult<AccountTransfer>>({ url: `${base}/accounts/transfers`, method: 'get', params }) }
export function transferAccount(data: {
  fromAccountId: number
  toAccountId: number
  amount: string
  transferDate: string
  bankSubjectId?: number
  /** 自定义转账凭证分录（多科目借贷），填写后优先于 bankSubjectId */
  entries?: Array<{ subjectId: number; summary?: string; debit?: string; credit?: string }>
  remark?: string
}) {
  return request<{ transfer: AccountTransfer; fromBalance: string; toBalance: string; voucherId: number | null }>({ url: `${base}/accounts/transfer`, method: 'post', data })
}
export function changeAsset(id: number, data: Record<string, unknown>) { return request<{ asset: Asset; change: AssetChange }>({ url: `${base}/assets/${id}/change`, method: 'post', data }) }
export function fetchAssetChanges(params: FinanceQuery) { return request<PageResult<AssetChange>>({ url: `${base}/assets/changes`, method: 'get', params }) }
export function fetchStatements(params: FinanceQuery) { return request<StatementData>({ url: `${base}/statements`, method: 'get', params }) }
export function fetchFinanceDashboard() { return request<FinanceDashboard>({ url: `${base}/dashboard`, method: 'get' }) }
export function fetchAging(type: 'RECEIVABLE' | 'PAYABLE') { return request<Aging>({ url: `${base}/aging/${type}`, method: 'get' }) }

export function fetchReceivables(params: FinanceQuery) { return request<PageResult<Receivable>>({ url: `${base}/receivables`, method: 'get', params }) }
export function createReceivable(data: Record<string, unknown>) { return request<Receivable>({ url: `${base}/receivables`, method: 'post', data }) }
export interface RedLineResult {
  original: Record<string, unknown>
  redLine: Record<string, unknown>
  releasedWriteoffAmount: number
  accountBalance?: string
  voucher: { id: number } | null
}
export function reverseReceivable(id: number, data: { reason?: string; entries?: Array<{ subjectId: number; summary?: string; debit?: string; credit?: string }> }) {
  return request<RedLineResult>({ url: `${base}/receivables/${id}/reverse`, method: 'post', data })
}
export function reversePayable(id: number, data: { reason?: string; entries?: Array<{ subjectId: number; summary?: string; debit?: string; credit?: string }> }) {
  return request<RedLineResult>({ url: `${base}/payables/${id}/reverse`, method: 'post', data })
}
export function reverseReceipt(id: number, data: { reason?: string; entries?: Array<{ subjectId: number; summary?: string; debit?: string; credit?: string }> }) {
  return request<RedLineResult>({ url: `${base}/receipts/${id}/reverse`, method: 'post', data })
}
export function reversePayment(id: number, data: { reason?: string; entries?: Array<{ subjectId: number; summary?: string; debit?: string; credit?: string }> }) {
  return request<RedLineResult>({ url: `${base}/payments/${id}/reverse`, method: 'post', data })
}
export function fetchPayables(params: FinanceQuery) { return request<PageResult<Payable>>({ url: `${base}/payables`, method: 'get', params }) }
export function createPayable(data: Record<string, unknown>) { return request<Payable>({ url: `${base}/payables`, method: 'post', data }) }

export function fetchReceipts(params: FinanceQuery) { return request<PageResult<Receipt>>({ url: `${base}/receipts`, method: 'get', params }) }
export function createReceipt(data: Record<string, unknown>) { return request<Receipt>({ url: `${base}/receipts`, method: 'post', data }) }
export function fetchPayments(params: FinanceQuery) { return request<PageResult<Payment>>({ url: `${base}/payments`, method: 'get', params }) }
export function createPayment(data: Record<string, unknown>) { return request<Payment>({ url: `${base}/payments`, method: 'post', data }) }

export function fetchInvoices(params: FinanceQuery) { return request<PageResult<Invoice>>({ url: `${base}/invoices`, method: 'get', params }) }
export function createInvoice(data: Record<string, unknown>) { return request<Invoice>({ url: `${base}/invoices`, method: 'post', data }) }

export function fetchAssets(params: FinanceQuery) { return request<PageResult<Asset>>({ url: `${base}/assets`, method: 'get', params }) }
export function createAsset(data: Record<string, unknown>) { return request<Asset>({ url: `${base}/assets`, method: 'post', data }) }
export interface DepreciationResult {
  records: Array<Record<string, unknown>>
  totalAmount: number
  voucherIds: number[]
  skipped: number
}
export function runDepreciation(period: string, options?: { withVoucher?: boolean; expenseSubjectId?: number; accumulatedSubjectId?: number }) {
  return request<DepreciationResult>({ url: `${base}/assets/depreciation`, method: 'post', data: { period, ...options } })
}
export function fetchCashFlowStatement(period: string) {
  return request<Record<string, unknown>>({ url: `${base}/statements/cash-flow`, method: 'get', params: { period } })
}

/** 出具正式现金流量表（期间需已结账） */
export function issueCashFlowReport(data: { period: string; remark?: string; reportType?: 'OFFICIAL' | 'PREVIEW' }) {
  return request<Record<string, unknown>>({ url: `${base}/statements/cash-flow/issue`, method: 'post', data })
}
export interface CashFlowReport {
  id: number
  reportNo: string
  period: string
  reportType: string
  status: string
  issuedBy: number | null
  issuedAt: string | null
  remark: string | null
  snapshot: Record<string, unknown> | null
}
export function fetchCashFlowReports(period?: string) {
  return request<CashFlowReport[]>({ url: `${base}/statements/cash-flow/reports`, method: 'get', params: { period } })
}
export function fetchCashFlowReport(id: number) {
  return request<CashFlowReport>({ url: `${base}/statements/cash-flow/reports/${id}`, method: 'get' })
}
export function voidCashFlowReport(id: number, reason: string) {
  return request<CashFlowReport>({ url: `${base}/statements/cash-flow/reports/${id}/void`, method: 'post', data: { reason } })
}

/** 折旧台账：明细 + 折旧/净值汇总 */
export interface DepreciationLedger {
  rows: Array<Record<string, unknown>>
  total: number
  summary: {
    period: string | null
    periodAmount: number
    accumulatedAmount: number
    netValueAmount: number
    assetCount: number
    depreciatedAssetCount: number
    missingAssetCount: number
    missingAssetNos: string[]
  }
}
export function fetchDepreciationLedger(params: { period?: string; assetId?: number; page?: number; pageSize?: number }) {
  return request<DepreciationLedger>({ url: `${base}/assets/depreciations`, method: 'get', params })
}

export function fetchPeriods(params: FinanceQuery) { return request<PageResult<FinPeriod>>({ url: `${base}/periods`, method: 'get', params }) }
export function closePeriod(period: string) { return request<FinPeriod>({ url: `${base}/periods/close`, method: 'post', data: { period } }) }

export function fetchCosts(params: FinanceQuery) { return request<PageResult<Cost>>({ url: `${base}/costs`, method: 'get', params }) }
export function createCost(data: Record<string, unknown>) { return request<Cost>({ url: `${base}/costs`, method: 'post', data }) }
export function fetchCostJobs(params: FinanceQuery) { return request<PageResult<CostJob>>({ url: `${base}/costs/jobs`, method: 'get', params }) }
export function createCostJob(period: string) { return request<CostJob>({ url: `${base}/costs/recalculate`, method: 'post', data: { period } }) }
export function executeCostJob(id: number) { return request<CostJob>({ url: `${base}/costs/jobs/${id}/execute`, method: 'post' }) }
export function retryCostJob(id: number) { return request<CostJob>({ url: `${base}/costs/jobs/${id}/retry`, method: 'post' }) }
export function fetchBudgets(params: FinanceQuery) { return request<PageResult<Budget>>({ url: `${base}/budgets`, method: 'get', params }) }
export function createBudget(data: Record<string, unknown>) { return request<Budget>({ url: `${base}/budgets`, method: 'post', data }) }

/* --------------------------- 期末结转与期初余额 --------------------------- */
export function carryForwardPeriod(data: { period: string; profitSubjectId: number; carrySubjectIds?: number[]; targetSubjectId?: number }) {
  return request<{ carry: PeriodCarry; voucher: Voucher; warnings: string[] }>({ url: `${base}/periods/carry`, method: 'post', data })
}
export function reverseCarryForward(period: string) {
  return request<{ carry: PeriodCarry; voucher: Voucher }>({ url: `${base}/periods/reverse-carry`, method: 'post', data: { period } })
}
export interface OpeningBalance {
  id: number
  period: string
  subjectId: number
  auxType: string
  auxId: string
  direction: string
  amount: string
  remark: string | null
}
export function fetchOpeningBalances(period: string) {
  return request<OpeningBalance[]>({ url: `${base}/periods/opening-balances`, method: 'get', params: { period } })
}
export function setOpeningBalances(data: {
  period: string
  items: Array<{ subjectId: number; direction?: string; amount: string; remark?: string }>
}) {
  return request<{ period: string; count: number }>({ url: `${base}/periods/opening-balances`, method: 'post', data })
}

/* ------------------------------- 银企直连 ------------------------------- */
export interface BankConnection {
  id: number
  accountId: number
  bankName: string
  accountNo: string | null
  connector: string
  connectorLabel: string
  credentials: Record<string, string>
  status: string
  lastSyncAt: string | null
  lastBalance: string | null
  lastResult: string | null
  createdAt: string
}
export interface BankTransaction {
  id: number
  accountId: number
  externalNo: string
  direction: string
  amount: string
  txDate: string | null
  summary: string | null
  matched: number
}
export interface BankReconcileResult {
  connectionId: number
  matches: Array<{ transactionId: number; targetId: number | null; score: number; matched: boolean; reason: string }>
  unmatchedTransactions: number[]
  unmatchedCandidates: number[]
  summary: {
    matchedCount: number
    unmatchedBankCount: number
    unmatchedBookCount: number
    matchedAmount: number
    unmatchedBankAmount: number
    unmatchedBookAmount: number
  }
}
export interface BankSyncResult {
  connectionId: number
  imported: number
  skipped: number
  duplicates: string[]
  errors: string[]
  plan: {
    inflow: number
    outflow: number
    net: number
    endingBalance: number
    difference: number | null
    matched: boolean
  }
  reconcile: BankReconcileResult | null
}
export function fetchBankConnections() {
  return request<BankConnection[]>({ url: `${base}/bank/connections`, method: 'get' })
}
export function createBankConnection(data: Record<string, unknown>) {
  return request<BankConnection>({ url: `${base}/bank/connections`, method: 'post', data })
}
export function updateBankConnection(id: number, data: Record<string, unknown>) {
  return request<BankConnection>({ url: `${base}/bank/connections/${id}`, method: 'put', data })
}
export function removeBankConnection(id: number) {
  return request<void>({ url: `${base}/bank/connections/${id}`, method: 'delete' })
}
export function syncBankConnection(id: number, data: { csvContent?: string; payload?: string; date?: string; count?: number; reconcile?: boolean }) {
  return request<BankSyncResult>({ url: `${base}/bank/connections/${id}/sync`, method: 'post', data })
}
export function reconcileBankTransactions(id: number) {
  return request<BankReconcileResult>({ url: `${base}/bank/connections/${id}/reconcile`, method: 'post' })
}
export function syncBankBalance(id: number, balance: number) {
  return request<{ accountId: number; balance: string; difference: number | null; matched: boolean }>({ url: `${base}/bank/connections/${id}/sync-balance`, method: 'post', data: { balance } })
}
export function fetchBankTransactions(params: FinanceQuery & { accountId?: number; direction?: string; externalNo?: string }) {
  return request<PageResult<BankTransaction>>({ url: `${base}/bank/transactions`, method: 'get', params })
}

/* ----------------------------- 存货收发存成本 ----------------------------- */
export interface InventoryMovementRow {
  productId: number
  productName: string
  openingQty: number
  openingAmount: number
  openingAvgCost: number
  inQty: number
  inAmount: number
  outQty: number
  outAmount: number
  closingQty: number
  closingAmount: number
  closingAvgCost: number
}
export interface InventoryMovementResult {
  period: string
  subjectId: number | null
  rows: InventoryMovementRow[]
  totals: {
    openingQty: number
    openingAmount: number
    inQty: number
    inAmount: number
    outQty: number
    outAmount: number
    closingQty: number
    closingAmount: number
  }
  difference: number | null
  reconciled: boolean
}
export function fetchInventoryMovement(params: { period: string; subjectId?: number }) {
  return request<InventoryMovementResult>({ url: `${base}/costing/inventory-movement`, method: 'get', params })
}
