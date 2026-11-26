export const BIZ_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  PARTIAL: 'PARTIAL',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED'
} as const

export type BizStatus = (typeof BIZ_STATUS)[keyof typeof BIZ_STATUS]

export const DATA_SCOPE_LEVEL = {
  SELF: 'SELF',
  DEPT: 'DEPT',
  DEPT_AND_CHILD: 'DEPT_AND_CHILD',
  ORG: 'ORG',
  ALL: 'ALL'
} as const

export type DataScopeLevel = (typeof DATA_SCOPE_LEVEL)[keyof typeof DATA_SCOPE_LEVEL]

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 500

export const DICT_CACHE_TTL_SECONDS = 7200
export const SEQUENCE_KEY_TTL_SECONDS = 86400

export const AI_CAPABILITY = {
  COPILOT: 'ai.copilot',
  DICT_SUGGEST: 'ai.dict.suggest',
  PRINT_SUGGEST: 'ai.print.suggest',
  DOC_PARSE: 'ai.doc.parse',
  OCR: 'ai.ocr',
  RECOMMEND: 'ai.recommend',
  FORECAST: 'ai.forecast',
  ANOMALY: 'ai.anomaly',
  RECONCILE: 'ai.reconcile',
  SUBJECT_MATCH: 'ai.subject.match',
  REPORT: 'ai.report',
  RAG: 'ai.rag',
  CS: 'ai.cs',
  RESUME: 'ai.resume',
  LABEL: 'ai.label'
} as const

export type AiCapability = (typeof AI_CAPABILITY)[keyof typeof AI_CAPABILITY]

export const PRINT_CHANNEL = {
  SERVER_PDF: 'SERVER_PDF',
  CLIENT: 'CLIENT',
  /** 静默打印：直接下发本地打印客户端，不产生服务端 PDF */
  SILENT: 'SILENT'
} as const

export type PrintChannel = (typeof PRINT_CHANNEL)[keyof typeof PRINT_CHANNEL]

export interface ApiResponse<T> {
  code: number
  data: T
  message: string
}

export interface PageResult<T> {
  list: T[]
  items?: T[]
  total: number
  page: number
  pageSize: number
}

export interface JwtUser {
  userId: number
  tenantId: number
  username: string
  realName: string
  orgId: number | null
  roles: string[]
  permissions: string[]
  isSuperAdmin: boolean
  dataScopeLevel: DataScopeLevel
  /** 权限版本号：授权变更后自增，令牌版本落后即需重新登录 */
  permVersion?: number
}

/**
 * 供应商门户外部用户：与内部员工账号完全隔离，
 * 只能访问其所属供应商的数据，令牌类型为 supplier_portal。
 */
export interface PortalUser {
  portalUserId: number
  tenantId: number
  supplierId: number
  username: string
  displayName: string
}

export interface DataScopeInfo {
  org: 'dept' | 'org' | 'created_by'
  level: DataScopeLevel
  orgId: number | null
  orgField?: string
  /** DEPT_AND_CHILD 级别下由守卫展开的子组织 ID，避免每个调用方重复查组织树 */
  childOrgIds?: number[]
}

export interface MenuTreeItem {
  id: number
  parentId: number | null
  title: string
  path: string
  component: string
  icon: string
  perm: string
  sortNo: number
  hidden: boolean
  children: MenuTreeItem[]
}

export function buildPageResult<T>(list: T[], total: number, page: number, pageSize: number): PageResult<T> {
  return { list, items: list, total, page, pageSize }
}
