/**
 * 供应商门户自助填报规则（纯函数，便于单测）
 */

export interface PortalCheckResult {
  allowed: boolean
  reason?: string
}

/** 供应商订单确认：仅已提交/已审批/部分收货订单可确认，且不可重复确认 */
export function checkPortalOrderConfirm(status: string, alreadyConfirmed: boolean): PortalCheckResult {
  if (!['SUBMITTED', 'APPROVED', 'PARTIAL'].includes(status)) {
    return { allowed: false, reason: '当前订单状态不允许供应商确认' }
  }
  if (alreadyConfirmed) return { allowed: false, reason: '该订单已确认，请勿重复填报' }
  return { allowed: true }
}

/** 供应商对账确认：结清或已红冲的对账单不可确认，且不可重复确认 */
export function checkPortalStatementConfirm(status: string, alreadyConfirmed: boolean): PortalCheckResult {
  if (alreadyConfirmed) return { allowed: false, reason: '该对账单已确认，请勿重复填报' }
  if (['DONE', 'REVERSED'].includes(status)) {
    return { allowed: false, reason: '当前对账单状态不允许供应商确认' }
  }
  return { allowed: true }
}

/** 自助填报单据号重复校验（运单号 / 发票号） */
export function checkPortalDuplicate(kind: 'WAYBILL' | 'INVOICE', existed: boolean): PortalCheckResult {
  if (!existed) return { allowed: true }
  const label = kind === 'WAYBILL' ? '运单号' : '发票号'
  return { allowed: false, reason: `该${label}已登记，请勿重复填报` }
}
