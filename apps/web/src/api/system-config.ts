import { request } from '@/utils/http'

export interface LoginLog {
  id: number
  tenantId: number
  userId: number | null
  username: string
  loginIp: string | null
  loginResult: string
  failReason: string | null
  userAgent: string | null
  loginAt: string
}

export interface LoginLogQuery {
  page?: number
  pageSize?: number
  username?: string
  loginResult?: string
  startDate?: string
  endDate?: string
}

export interface PageResult<T> {
  list: T[]
  total: number
  page?: number
  pageSize?: number
}

export interface SystemConfig {
  id: number
  tenantId: number
  configKey: string
  configValue: string | null
  valueType: string
  category: string | null
  isSystem: number
  remark: string | null
  updatedAt: string | null
}

/** 登录日志查询 */
export function fetchLoginLogs(params: LoginLogQuery) {
  return request<PageResult<LoginLog>>({ url: '/auth/login-logs', method: 'get', params })
}

/** 系统参数列表 */
export function fetchSystemConfigs() {
  return request<SystemConfig[]>({ url: '/system/configs', method: 'get' })
}

/** 保存系统参数 */
export function saveSystemConfig(data: {
  configKey: string
  configValue?: string
  valueType?: string
  category?: string
  remark?: string
}) {
  return request<SystemConfig>({ url: '/system/configs', method: 'post', data })
}

/** 删除系统参数 */
export function removeSystemConfig(configKey: string) {
  return request<{ removed: boolean }>({ url: `/system/configs/${encodeURIComponent(configKey)}`, method: 'delete' })
}
