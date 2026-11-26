export interface ApiResponse<T> {
  code: number
  data: T
  message: string
}

export interface PageQuery {
  page: number
  pageSize: number
  keyword?: string
}

export interface PageResult<T> {
  list: T[]
  items?: T[]
  total: number
  page: number
  pageSize: number
}

export type BizStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PARTIAL' | 'DONE' | 'CANCELLED'

export type DataScopeLevel = 'SELF' | 'DEPT' | 'DEPT_AND_CHILD' | 'ORG' | 'ALL'

export interface MenuItem {
  id: number
  parentId: number | null
  title: string
  path: string
  component: string
  icon: string
  perm: string
  sortNo: number
  hidden: boolean
  children: MenuItem[]
}

export interface UserProfile {
  id: number
  tenantId: number
  username: string
  realName: string
  orgId: number | null
  roles: string[]
  permissions: string[]
  dataScopeLevel: DataScopeLevel
  isSuperAdmin: boolean
  /** 是否要求强制修改密码 */
  mustChangePassword?: boolean
}

export interface GridColumn {
  prop: string
  label: string
  width?: number
  align?: 'left' | 'center' | 'right'
  /** 冻结列方向 */
  fixed?: 'left' | 'right'
  /** 是否允许点击表头排序 */
  sortable?: boolean
}

/** 列表页视图配置：列显隐与顺序、列宽、行密度、默认排序 */
export type GridDensity = 'compact' | 'default' | 'loose'

export interface ViewConfigState {
  columns: string[]
  widths: Record<string, number>
  density: GridDensity
  sort: { prop: string; order: 'asc' | 'desc' } | null
}

/** 批量操作结果 */
export interface BatchResultItem {
  id: number
  success: boolean
  message?: string
}

export interface BatchResult {
  total: number
  succeeded: number
  failed: number
  items: BatchResultItem[]
}

export interface FieldOption {
  label: string
  value: string
}

export interface FieldDef {
  key: string
  label: string
  type: 'input' | 'textarea' | 'select' | 'int' | 'decimal'
  required?: boolean
  maxlength?: number
  options?: FieldOption[]
}
