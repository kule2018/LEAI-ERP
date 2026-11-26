/**
 * 财务与质检纯逻辑规则：抽样、让步接收、余额调节、发票勾稽、月结检查。
 * 与持久层解耦便于单测，供各业务服务复用。
 */

/** 按 GB/T 2828 风格简化抽样：批量分段抽样，AQL 级别影响样本量 */
export function samplingPlan(lotQty: number, aql: 'NORMAL' | 'STRICT' | 'LOOSE' = 'NORMAL'): {
  sampleQty: number
  acceptDefects: number
} {
  if (lotQty <= 0) return { sampleQty: 0, acceptDefects: 0 }
  const base = lotQty <= 50 ? 5 : lotQty <= 150 ? 20 : lotQty <= 500 ? 32 : 50
  const factor = aql === 'STRICT' ? 1.5 : aql === 'LOOSE' ? 0.6 : 1
  const sampleQty = Math.min(lotQty, Math.max(1, Math.ceil(base * factor)))
  const acceptDefects = aql === 'STRICT' ? 0 : aql === 'LOOSE' ? 2 : 1
  return { sampleQty, acceptDefects }
}

/** 抽检判定：样本不良数不超过允收数则合格 */
export function judgeSampling(defectQty: number, acceptDefects: number): 'PASS' | 'FAIL' {
  return defectQty <= acceptDefects ? 'PASS' : 'FAIL'
}

/** 让步接收：仅不合格批可申请，需审批人，超期批次不允许 */
export function canConcession(result: string, approverId: number | null, expired: boolean): {
  ok: boolean
  reason?: string
} {
  if (result !== 'FAIL') return { ok: false, reason: '仅不合格批次可申请让步接收' }
  if (!approverId || approverId <= 0) return { ok: false, reason: '让步接收必须指定审批人' }
  if (expired) return { ok: false, reason: '批次已过期，不允许让步接收' }
  return { ok: true }
}

/** 银行余额调节：账面余额 + 已收未入账 - 已付未入账 = 银行余额 ± 未达账项 */
export function reconcileBalance(
  bookBalance: number,
  bankBalance: number,
  outstandingIncome: number,
  outstandingPayment: number
): { adjustedBook: number; difference: number; balanced: boolean } {
  const adjustedBook = bookBalance + outstandingIncome - outstandingPayment
  const difference = Number((adjustedBook - bankBalance).toFixed(4))
  return { adjustedBook: Number(adjustedBook.toFixed(4)), difference, balanced: Math.abs(difference) < 0.0001 }
}

/** 发票勾稽：发票金额与单据金额（含税额）比对 */
export function matchInvoice(invoiceAmount: number, invoiceTax: number, documentAmount: number, tolerance = 0.01): {
  matched: boolean
  difference: number
} {
  const total = Number((invoiceAmount + invoiceTax).toFixed(4))
  const difference = Number((total - documentAmount).toFixed(4))
  return { matched: Math.abs(difference) <= tolerance, difference }
}

export interface CloseCheck {
  name: string
  passed: boolean
  detail?: string
}

/** 月结检查清单：所有项通过才允许结账 */
export function evaluateCloseChecks(checks: CloseCheck[]): { ok: boolean; failures: string[] } {
  const failures = checks.filter((c) => !c.passed).map((c) => `${c.name}${c.detail ? `：${c.detail}` : ''}`)
  return { ok: failures.length === 0, failures }
}
