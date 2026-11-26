import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface CustomFieldOption {
  label: string
  value: string
}

export interface CustomFieldCondition {
  fieldKey: string
  operator: string
  value?: unknown
}

export interface CustomField {
  id: number
  entityCode: string
  fieldKey: string
  fieldLabel: string
  fieldType: string
  options: CustomFieldOption[] | null
  defaultValue: string | null
  required: number
  displayOrder: number
  groupName: string
  visibleInList: number
  allowFilter: number
  maxLength: number | null
  minValue: string | null
  maxValue: string | null
  pattern: string | null
  referenceType: string | null
  condition: CustomFieldCondition | null
  status: string
  remark: string | null
  createdAt: string
}

export interface CustomForm {
  id: number
  formCode: string
  formName: string
  entityCode: string
  layout: Array<Record<string, unknown>> | null
  version: number
  status: string
  remark: string | null
  createdAt: string
}

export interface CustomFormGroup {
  groupName: string
  fields: CustomField[]
}

export interface CustomFormSchema {
  entityCode: string
  fields: CustomField[]
  groups: CustomFormGroup[]
  form: CustomForm | null
}

export interface CustomFieldQuery extends PageQuery {
  entityCode?: string
  fieldType?: string
}

export interface CustomFormQuery extends PageQuery {
  entityCode?: string
}

export interface CustomFieldPayload {
  entityCode?: string
  fieldKey?: string
  fieldLabel?: string
  fieldType?: string
  options?: CustomFieldOption[]
  defaultValue?: string
  required?: boolean
  visibleInList?: boolean
  allowFilter?: boolean
  maxLength?: number
  min?: number
  max?: number
  pattern?: string
  groupName?: string
  displayOrder?: number
  referenceType?: string
  condition?: CustomFieldCondition
  remark?: string
}

export interface CustomFormPayload {
  formCode?: string
  formName?: string
  entityCode?: string
  layout?: Array<Record<string, unknown>>
  status?: string
  remark?: string
}

export function fetchCustomFields(params: CustomFieldQuery) {
  return request<PageResult<CustomField>>({ url: '/customization/fields', method: 'get', params })
}

export function createCustomField(data: CustomFieldPayload) {
  return request<CustomField>({ url: '/customization/fields', method: 'post', data })
}

export function updateCustomField(id: number, data: CustomFieldPayload) {
  return request<CustomField>({ url: `/customization/fields/${id}`, method: 'put', data })
}

export function deleteCustomField(id: number) {
  return request<{ id: number }>({ url: `/customization/fields/${id}`, method: 'delete' })
}

export function fetchCustomForms(params: CustomFormQuery) {
  return request<PageResult<CustomForm>>({ url: '/customization/forms', method: 'get', params })
}

export function createCustomForm(data: CustomFormPayload) {
  return request<CustomForm>({ url: '/customization/forms', method: 'post', data })
}

export function updateCustomForm(id: number, data: CustomFormPayload) {
  return request<CustomForm>({ url: `/customization/forms/${id}`, method: 'put', data })
}

export function deleteCustomForm(id: number) {
  return request<{ id: number }>({ url: `/customization/forms/${id}`, method: 'delete' })
}

export function fetchCustomFormSchema(entityCode: string) {
  return request<CustomFormSchema>({ url: `/customization/schema/${entityCode}`, method: 'get' })
}

export function fetchCustomValues(entityCode: string, bizId: number) {
  return request<Record<string, unknown>>({ url: `/customization/values/${entityCode}/${bizId}`, method: 'get' })
}

/** 批量读取自定义字段取值（列表页动态列使用），返回 { [bizId]: { [fieldKey]: value } } */
export function fetchCustomValuesBatch(entityCode: string, bizIds: number[]) {
  return request<Record<string, Record<string, unknown>>>({
    url: '/customization/values/batch',
    method: 'post',
    data: { entityCode, bizIds }
  })
}

export function saveCustomValues(entityCode: string, bizId: number, values: Record<string, unknown>) {
  return request<Record<string, unknown>>({
    url: `/customization/values/${entityCode}/${bizId}`,
    method: 'put',
    data: { values }
  })
}
