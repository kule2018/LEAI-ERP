import { request } from '@/utils/http'
import type { MenuItem, UserProfile } from '@/types/contract'

export interface LoginPayload {
  username: string
  password: string
  tenantCode?: string
  mfaCode?: string
  captchaId?: string
  captchaAnswer?: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: string
}

export interface LoginResult extends TokenPair {
  user: UserProfile
  menus: MenuItem[]
}

export function login(data: LoginPayload): Promise<LoginResult> {
  return request<LoginResult>({ url: '/auth/login', method: 'post', data })
}

export function refresh(refreshToken: string): Promise<TokenPair> {
  return request<TokenPair>({ url: '/auth/refresh', method: 'post', data: { refreshToken } })
}

export function logout(): Promise<null> {
  return request<null>({ url: '/auth/logout', method: 'post' })
}

export function fetchProfile(): Promise<UserProfile> {
  return request<UserProfile>({ url: '/auth/me', method: 'get' })
}

export function fetchMenus(): Promise<MenuItem[]> {
  return request<MenuItem[]>({ url: '/auth/menus', method: 'get' })
}

/** 自助修改密码 */
export function changePassword(data: { oldPassword: string; newPassword: string }): Promise<{ changed: boolean }> {
  return request<{ changed: boolean }>({ url: '/auth/change-password', method: 'post', data })
}

/** 高风险登录验证码 */
export function fetchCaptcha(): Promise<{ id: string; svg: string }> {
  return request({ url: '/auth/captcha', method: 'post' })
}

/** MFA 绑定：返回密钥与 otpauth 链接，可用验证器扫码 */
export function setupMfa(): Promise<{ secret: string; otpAuthUri: string }> {
  return request({ url: '/auth/mfa/setup', method: 'post' })
}

export function verifyMfa(code: string): Promise<{ enabled: boolean }> {
  return request({ url: '/auth/mfa/verify', method: 'post', data: { code } })
}

export function disableMfa(code: string): Promise<{ enabled: boolean }> {
  return request({ url: '/auth/mfa/disable', method: 'post', data: { code } })
}

/** SSO：获取授权跳转地址 */
export function ssoAuthorize(tenantCode = 'default'): Promise<{ url: string; state: string }> {
  return request({ url: '/auth/sso/authorize', method: 'get', params: { tenantCode } })
}

export function ssoCallback(code: string, state: string): Promise<LoginResult> {
  return request({ url: '/auth/sso/callback', method: 'post', data: { code, state } })
}
