/**
 * 供应商门户规则（纯函数）：外部账号登录判定与数据归属校验。
 */
export interface PortalAccountState {
  status: string
  failedLoginCount: number
  lockUntil?: Date | null
}

export interface PortalLoginDecision {
  allowed: boolean
  reason: string
  /** 是否应累计失败次数 */
  countFailure: boolean
  /** 是否应触发锁定 */
  shouldLock: boolean
}

export const PORTAL_MAX_FAILED_ATTEMPTS = 5
export const PORTAL_LOCK_MINUTES = 15

/**
 * 门户登录判定：停用账号禁止登录；连续失败达阈值锁定；
 * 锁定期内拒绝登录；正常账号可登录。
 */
export function evaluatePortalLogin(account: PortalAccountState | null, now = new Date()): PortalLoginDecision {
  if (!account) {
    return { allowed: false, reason: '账号或密码错误', countFailure: true, shouldLock: false }
  }
  if (account.status !== 'ACTIVE') {
    return { allowed: false, reason: '账号已停用，请联系采购管理员', countFailure: false, shouldLock: false }
  }
  if (account.lockUntil && account.lockUntil.getTime() > now.getTime()) {
    const remain = Math.ceil((account.lockUntil.getTime() - now.getTime()) / 1000)
    return { allowed: false, reason: `账号已锁定，请 ${remain} 秒后重试`, countFailure: false, shouldLock: false }
  }
  return { allowed: true, reason: '', countFailure: false, shouldLock: false }
}

/**
 * 密码错误后的处理：达到阈值即锁定。
 */
export function evaluatePortalLoginFailure(failedAttempts: number): PortalLoginDecision {
  const attempts = failedAttempts + 1
  const shouldLock = attempts >= PORTAL_MAX_FAILED_ATTEMPTS
  return {
    allowed: false,
    reason: '账号或密码错误',
    countFailure: true,
    shouldLock,
    ...(shouldLock ? { lockMinutes: PORTAL_LOCK_MINUTES } : {})
  } as PortalLoginDecision
}

/**
 * 数据归属校验：门户用户只能访问自身供应商的数据。
 */
export function evaluateSupplierOwnership(resourceSupplierId: number | null, portalSupplierId: number): {
  allowed: boolean
  reason: string
} {
  if (resourceSupplierId === null || resourceSupplierId === undefined) {
    return { allowed: false, reason: '数据不存在或不属于当前供应商' }
  }
  if (resourceSupplierId !== portalSupplierId) {
    return { allowed: false, reason: '数据不存在或不属于当前供应商' }
  }
  return { allowed: true, reason: '' }
}

/**
 * 门户账号状态流转：停用后令牌立即失效，仅允许启用/停用两种状态。
 */
export function evaluatePortalAccountStatus(target: string): { allowed: boolean; reason: string } {
  if (target === 'ACTIVE' || target === 'DISABLED') {
    return { allowed: true, reason: '' }
  }
  return { allowed: false, reason: '不支持的账号状态' }
}
