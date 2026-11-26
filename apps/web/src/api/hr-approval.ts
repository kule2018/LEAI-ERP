import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

const base = '/hr'

export type HrDecision = 'APPROVE' | 'REJECT'

export interface ShiftSchedule {
  id: number
  employeeId: number
  workDate: string
  shiftCode: string
  shiftName: string
  status: string
}

export interface PayslipRow {
  id: number
  employeeId: number
  period: string
  grossAmount: string
  netAmount: string
  social: string
  tax: string
  payslipNo?: string | null
  status: string
}

export interface SocialInsuranceRow {
  id: number
  salaryId: number
  employeeId: number
  period: string
  itemCode: string
  itemName: string
  baseAmount: string
  companyRate: string
  personalRate: string
  companyAmount: string
  personalAmount: string
}

export interface PerformanceKpi {
  id: number
  kpiCode: string
  kpiName: string
  category: string
  weight: string
  targetValue: string
  unit: string
  status: string
}

export interface CalibrationRow {
  id: number
  period: string
  calibrationDate: string
  participantCount: number
  distribution: string | null
  conclusion: string | null
  status: string
}

export interface StocktakeRow {
  id: number
  stocktakeNo: string
  stocktakeDate: string
  status: string
  totalCount: number
  diffCount: number
  remark?: string | null
}

export interface AssetRepairRow {
  id: number
  assetId: number
  repairType: string
  repairReason: string
  vendor?: string | null
  amount: string
  repairDate: string
  status: string
  finishedAt?: string | null
}

export interface VehicleFuelStat {
  vehicleId: number
  plateNo: string
  vehicleName: string
  litres: number
  mileage: number
  per100km: number
  warning: boolean
}

export interface PayrollDetailRow {
  id: number
  salaryId: number
  baseAmount: string
  social: string
  tax: string
  payslipNo?: string | null
  status?: string
}

/* ------------------------------------------------------------ 个税与发放审批 */

export function fetchPayrollDetails(params: PageQuery) {
  return request<PageResult<PayrollDetailRow>>({ url: `${base}/payroll-details`, method: 'get', params })
}

export function reviewPayrollDetail(id: number, decision: HrDecision) {
  return request<Record<string, unknown>>({ url: `${base}/payroll-details/${id}/review`, method: 'post', data: { decision } })
}

/* ------------------------------------------------------------ 考勤排班 */

export function fetchShiftSchedules(params: PageQuery & { employeeId?: number }) {
  return request<PageResult<ShiftSchedule>>({ url: `${base}/shift-schedules`, method: 'get', params })
}

export function createShiftSchedule(data: Record<string, unknown>) {
  return request<ShiftSchedule>({ url: `${base}/shift-schedules`, method: 'post', data })
}

export function approveLeave(id: number, decision: HrDecision, comment?: string) {
  return request<Record<string, unknown>>({ url: `${base}/leaves/${id}/approve`, method: 'post', data: { decision, comment } })
}

export function approveOvertime(id: number, decision: HrDecision, comment?: string) {
  return request<Record<string, unknown>>({ url: `${base}/overtimes/${id}/approve`, method: 'post', data: { decision, comment } })
}

/* ------------------------------------------------------------ 薪酬社保 */

export function fetchPayslips(params: PageQuery & { period?: string }) {
  return request<PageResult<PayslipRow>>({ url: `${base}/payslips`, method: 'get', params })
}

export function fetchSocialInsurances(salaryId?: number) {
  return request<SocialInsuranceRow[]>({ url: `${base}/social-insurances`, method: 'get', params: { salaryId } })
}

export function generateSocialInsurance(data: { salaryId: number; baseAmount?: string }) {
  return request<SocialInsuranceRow[]>({ url: `${base}/social-insurances`, method: 'post', data })
}

/* ------------------------------------------------------------ 绩效 */

export function fetchPerformanceKpis(params: PageQuery) {
  return request<PageResult<PerformanceKpi>>({ url: `${base}/performance-kpis`, method: 'get', params })
}

export function createPerformanceKpi(data: Record<string, unknown>) {
  return request<PerformanceKpi>({ url: `${base}/performance-kpis`, method: 'post', data })
}

export function fetchCalibrations(params: PageQuery) {
  return request<PageResult<CalibrationRow>>({ url: `${base}/performance-calibrations`, method: 'get', params })
}

export function createCalibration(data: { period: string; calibrationDate: string; conclusion?: string }) {
  return request<CalibrationRow>({ url: `${base}/performance-calibrations`, method: 'post', data })
}

export function recalculatePerformance(id: number) {
  return request<Record<string, unknown>>({ url: `${base}/performance-reviews/${id}/recalculate`, method: 'post' })
}

export interface PerformanceReviewRow {
  id: number
  employeeId: number
  period: string
  kpiScore: number
  peerScore: number
  calibration: number
  finalScore?: string | null
  level: string
  appealStatus?: string | null
  appealReason?: string | null
}

export function fetchPerformanceReviews(params: PageQuery) {
  return request<PageResult<PerformanceReviewRow>>({ url: `${base}/performance-reviews`, method: 'get', params })
}

export function appealPerformance(id: number, reason: string) {
  return request<Record<string, unknown>>({ url: `${base}/performance-reviews/${id}/appeal`, method: 'post', data: { reason } })
}

export function resolvePerformanceAppeal(id: number, data: { result: 'ACCEPT' | 'REJECT'; resolution?: string }) {
  return request<Record<string, unknown>>({ url: `${base}/performance-reviews/${id}/appeal-resolve`, method: 'post', data })
}

/* ------------------------------------------------------------ 行政资产 */

export function fetchStocktakes(params: PageQuery) {
  return request<PageResult<StocktakeRow>>({ url: `${base}/asset-stocktakes`, method: 'get', params })
}

export function createStocktake(data: { stocktakeDate: string; remark?: string }) {
  return request<StocktakeRow>({ url: `${base}/asset-stocktakes`, method: 'post', data })
}

export function submitStocktake(id: number, items: Array<{ assetId: number; actualStatus: string; actualHolderId?: number }>) {
  return request<{ stocktake: StocktakeRow; items: Array<Record<string, unknown>> }>({
    url: `${base}/asset-stocktakes/${id}/submit`, method: 'post', data: { items }
  })
}

export function fetchAssetRepairs(params: PageQuery) {
  return request<PageResult<AssetRepairRow>>({ url: `${base}/asset-repairs`, method: 'get', params })
}

export function assetAction(data: { assetId: number; action: 'ISSUE' | 'RETURN' | 'INVENTORY' | 'REPAIR'; holderId?: number }) {
  return request<Record<string, unknown>>({ url: `${base}/asset-actions`, method: 'post', data })
}

export function createAssetRepair(data: Record<string, unknown>) {
  return request<AssetRepairRow>({ url: `${base}/asset-repairs`, method: 'post', data })
}

export function finishAssetRepair(id: number, data: { amount?: string; vendor?: string }) {
  return request<AssetRepairRow>({ url: `${base}/asset-repairs/${id}/finish`, method: 'post', data })
}

/* ------------------------------------------------------------ 车队 */

export function approveVehicleUse(id: number, decision: HrDecision, comment?: string) {
  return request<Record<string, unknown>>({ url: `${base}/vehicle-uses/${id}/approve`, method: 'post', data: { decision, comment } })
}

export function updateVehicleUse(id: number, data: { mileage?: string; reason?: string }) {
  return request<Record<string, unknown>>({ url: `${base}/vehicle-uses/${id}`, method: 'patch', data })
}

export function approveVehicleExpense(id: number, decision: HrDecision, comment?: string) {
  return request<Record<string, unknown>>({ url: `${base}/vehicle-expenses/${id}/approve`, method: 'post', data: { decision, comment } })
}

export function fetchVehicleFuelStats() {
  return request<VehicleFuelStat[]>({ url: `${base}/vehicle-fuel-stats`, method: 'get' })
}

export interface VehicleExpenseRow {
  id: number
  vehicleId: number
  vehicleUseId?: number | null
  expenseType: string
  amount: string
  expenseDate: string
  fuelLitres?: string | null
  status: string
}

export interface VehicleTrackRow {
  id: number
  vehicleId: number
  latitude: string | number
  longitude: string | number
  speed?: string | number | null
  recordedAt: string
}

export function fetchVehicleExpenses(params: PageQuery) {
  return request<PageResult<VehicleExpenseRow>>({ url: `${base}/vehicle-expenses`, method: 'get', params })
}

export function createVehicleExpense(data: Record<string, unknown>) {
  return request<VehicleExpenseRow>({ url: `${base}/vehicle-expenses`, method: 'post', data })
}

export function fetchVehicleTracks(params: PageQuery & { vehicleId?: number }) {
  return request<PageResult<VehicleTrackRow>>({ url: `${base}/vehicle-tracks`, method: 'get', params })
}
