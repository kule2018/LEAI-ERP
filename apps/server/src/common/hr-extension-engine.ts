export interface ContractInfo {
  startDate: Date | string
  endDate: Date | string
}

export interface PayrollInput {
  gross: number
  socialRate?: number
  taxable?: number
}

export interface PayrollResult {
  social: number
  taxable: number
  tax: number
  net: number
}

export interface PerformanceInput {
  kpiScore: number
  peerScore?: number
  calibration?: number
}

export interface TrainingResult {
  passed: boolean
  certificateNo: string | null
}

export interface VehicleUseWindow {
  startTime: Date | string
  endTime: Date | string
}

const TAX_BRACKETS = [
  { limit: 3000, rate: 0.03, quick: 0 },
  { limit: 12000, rate: 0.1, quick: 210 },
  { limit: 25000, rate: 0.2, quick: 1410 },
  { limit: 35000, rate: 0.25, quick: 2660 },
  { limit: 55000, rate: 0.3, quick: 4410 },
  { limit: 80000, rate: 0.35, quick: 7160 },
  { limit: Number.POSITIVE_INFINITY, rate: 0.45, quick: 15160 }
]

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function contractExpiryWarning(contract: ContractInfo, at = new Date()): { expiring: boolean; days: number } {
  const start = new Date(contract.startDate).getTime()
  const end = new Date(contract.endDate).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return { expiring: true, days: 0 }
  const days = Math.ceil((end - at.getTime()) / 86400000)
  return { expiring: days <= 30, days }
}

export function detectAttendanceAnomaly(punches: Array<{ punchTime: Date | string }>, shiftStart: string, at = new Date()): string[] {
  const reasons: string[] = []
  const dayKey = (date: Date): string => date.toISOString().slice(0, 10)
  const dayPunches = punches.filter((item) => {
    const time = new Date(item.punchTime)
    return Number.isFinite(time.getTime()) && dayKey(time) === dayKey(at)
  })
  if (dayPunches.length === 0) reasons.push('当日无打卡记录')
  const [hour, minute] = shiftStart.split(':').map(Number)
  const startMinutes = (hour || 0) * 60 + (minute || 0)
  const first = dayPunches.map((item) => new Date(item.punchTime)).filter((item) => Number.isFinite(item.getTime())).sort((a, b) => a.getTime() - b.getTime())[0]
  if (!first) return reasons
  const punchMinutes = first.getUTCHours() * 60 + first.getUTCMinutes()
  if (punchMinutes > startMinutes) reasons.push(`上班迟到 ${punchMinutes - startMinutes} 分钟`)
  return reasons
}

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const gross = Math.max(0, Number(input.gross) || 0)
  const social = round(gross * (input.socialRate ?? 0.105))
  const taxable = Math.max(0, input.taxable ?? gross - social - 5000)
  const bracket = TAX_BRACKETS.find((item) => taxable <= item.limit) ?? TAX_BRACKETS[TAX_BRACKETS.length - 1]
  const tax = round(Math.max(0, taxable * bracket.rate - bracket.quick))
  return { social, taxable: round(taxable), tax, net: round(gross - social - tax) }
}

export function calibratePerformance(input: PerformanceInput): { score: number; level: string } {
  const score = round(input.kpiScore * 0.7 + (input.peerScore ?? input.kpiScore) * 0.2 + (input.calibration ?? 0) * 0.1, 1)
  const level = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : 'D'
  return { score, level }
}

export function trainingCertification(examScore: number, passLine = 60): TrainingResult {
  const passed = Number(examScore) >= passLine
  return { passed, certificateNo: passed ? `CERT-${Date.now()}` : null }
}

export function assetTransition(current: string, action: 'ISSUE' | 'RETURN' | 'INVENTORY' | 'REPAIR'): string | null {
  const transitions: Record<string, Partial<Record<typeof action, string>>> = {
    IDLE: { ISSUE: 'IN_USE', INVENTORY: 'IDLE', REPAIR: 'REPAIR' },
    IN_USE: { RETURN: 'IDLE', REPAIR: 'REPAIR' },
    REPAIR: { RETURN: 'IDLE' }
  }
  return transitions[current]?.[action] ?? null
}

export function vehicleConflict(existing: VehicleUseWindow[], next: VehicleUseWindow): boolean {
  const start = new Date(next.startTime).getTime()
  const end = new Date(next.endTime).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return true
  return existing.some((item) => {
    const itemStart = new Date(item.startTime).getTime()
    const itemEnd = new Date(item.endTime).getTime()
    return start < itemEnd && itemStart < end
  })
}

export function offerApproval(salary: number, budget: number): boolean {
  return Number.isFinite(salary) && Number.isFinite(budget) && salary > 0 && salary <= budget
}
