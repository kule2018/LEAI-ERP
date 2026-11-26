import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface Company {
  id: number
  companyCode: string
  companyName: string
  creditCode: string | null
  legalPerson: string | null
  status: string
  createdAt: string
}

export interface Org {
  id: number
  companyId: number
  parentId: number | null
  orgCode: string
  orgName: string
  orgType: string
  sortNo: number
  status: string
}

export interface Dept {
  id: number
  orgId: number
  parentId: number | null
  deptCode: string
  deptName: string
  leaderUserId: number | null
  sortNo: number
  status: string
}

export interface Position {
  id: number
  orgId: number
  deptId: number | null
  positionCode: string
  positionName: string
  grade: string
  sortNo: number
  status: string
}

export interface SystemUser {
  id: number
  username: string
  realName: string
  deptId: number | null
  orgId: number | null
  mobile: string | null
  status: string
  createdAt: string
}

export interface SystemRole {
  id: number
  roleCode: string
  roleName: string
  dataScopeLevel: string
  parentId: number | null
  sortNo: number
  status: string
}

export interface SystemPermission {
  id: number
  permCode: string
  permName: string
  permType: string
  parentId: number | null
  sortNo: number
}

export interface SystemMenu {
  id: number
  parentId: number | null
  menuName: string
  routePath: string
  componentPath: string | null
  icon: string | null
  permCode: string | null
  sortNo: number
  hidden: number
}

interface SystemQuery extends PageQuery {
  status?: string
}

function list<T>(path: string, params: SystemQuery) {
  return request<PageResult<T>>({ url: `/system/${path}`, method: 'get', params })
}

function create<T>(path: string, data: Record<string, unknown>) {
  return request<T>({ url: `/system/${path}`, method: 'post', data })
}

function update<T>(path: string, id: number, data: Record<string, unknown>) {
  return request<T>({ url: `/system/${path}/${id}`, method: 'put', data })
}

function remove(path: string, id: number) {
  return request<void>({ url: `/system/${path}/${id}`, method: 'delete' })
}

export const fetchCompanies = (params: SystemQuery) => list<Company>('companies', params)
export const createCompany = (data: Record<string, unknown>) => create<Company>('companies', data)
export const updateCompany = (id: number, data: Record<string, unknown>) => update<Company>('companies', id, data)
export const removeCompany = (id: number) => remove('companies', id)

export const fetchOrgs = (params: SystemQuery) => list<Org>('orgs', params)
export const createOrg = (data: Record<string, unknown>) => create<Org>('orgs', data)
export const updateOrg = (id: number, data: Record<string, unknown>) => update<Org>('orgs', id, data)
export const removeOrg = (id: number) => remove('orgs', id)

export const fetchDepts = (params: SystemQuery) => list<Dept>('depts', params)
export const createDept = (data: Record<string, unknown>) => create<Dept>('depts', data)
export const updateDept = (id: number, data: Record<string, unknown>) => update<Dept>('depts', id, data)
export const removeDept = (id: number) => remove('depts', id)

export const fetchPositions = (params: SystemQuery) => list<Position>('positions', params)
export const createPosition = (data: Record<string, unknown>) => create<Position>('positions', data)
export const updatePosition = (id: number, data: Record<string, unknown>) => update<Position>('positions', id, data)
export const removePosition = (id: number) => remove('positions', id)

export const fetchSystemUsers = (params: SystemQuery) => list<SystemUser>('users', params)
export const createSystemUser = (data: Record<string, unknown>) => create<SystemUser>('users', data)
export const updateSystemUser = (id: number, data: Record<string, unknown>) => update<SystemUser>('users', id, data)
export const removeSystemUser = (id: number) => remove('users', id)
export const assignUserRoles = (id: number, roleIds: number[]) =>
  request<void>({ url: `/system/users/${id}/roles`, method: 'post', data: { roleIds } })

export const fetchSystemRoles = (params: SystemQuery) => list<SystemRole>('roles', params)
export const createSystemRole = (data: Record<string, unknown>) => create<SystemRole>('roles', data)
export const updateSystemRole = (id: number, data: Record<string, unknown>) => update<SystemRole>('roles', id, data)
export const removeSystemRole = (id: number) => remove('roles', id)
export const assignRolePermissions = (id: number, permissionIds: number[]) =>
  request<void>({ url: `/system/roles/${id}/permissions`, method: 'post', data: { permissionIds } })

export const fetchSystemPermissions = (params: SystemQuery) => list<SystemPermission>('permissions', params)
export const createSystemPermission = (data: Record<string, unknown>) => create<SystemPermission>('permissions', data)
export const updateSystemPermission = (id: number, data: Record<string, unknown>) => update<SystemPermission>('permissions', id, data)
export const removeSystemPermission = (id: number) => remove('permissions', id)

export const fetchSystemMenus = (params: SystemQuery) => list<SystemMenu>('menus', params)
export const createSystemMenu = (data: Record<string, unknown>) => create<SystemMenu>('menus', data)
export const updateSystemMenu = (id: number, data: Record<string, unknown>) => update<SystemMenu>('menus', id, data)
export const removeSystemMenu = (id: number) => remove('menus', id)
