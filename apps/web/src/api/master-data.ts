import { request } from '@/utils/http'
import type { PageQuery, PageResult } from '@/types/contract'

export interface Customer {
  id: number
  customerCode: string
  customerName: string
  customerGroup: string | null
  creditLimit: string
  creditUsed: string
  ownerUserId: number | null
  status: string
}

export interface CustomerContact {
  id: number
  customerId: number
  name: string
  phone: string | null
  email: string | null
  position: string | null
  isPrimary: number
}

export interface CustomerAddress {
  id: number
  customerId: number
  province: string | null
  city: string | null
  district: string | null
  address: string
  contactName: string | null
  contactPhone: string | null
  isDefault: number
}

export interface Supplier {
  id: number
  supplierCode: string
  supplierName: string
  supplierGroup: string | null
  qualificationStatus: string
  qualificationExpire: string | null
  blacklist: number
  ratingScore: string
  contactName: string | null
  contactPhone: string | null
  status: string
}

export interface Product {
  id: number
  productCode: string
  productName: string
  barcode: string | null
  categoryId: number | null
  brandId: number | null
  unitId: number | null
  productType: string
  trackingType: string
  cost: string
  price: string
  attributes?: Record<string, unknown> | null
  defaultWarehouseId?: number | null
  defaultLocationId?: number | null
  isActive: number
}

export interface UnitConversion {
  id: number
  productId: number
  unitId: number
  unitCode: string
  unitName: string
  conversionRate: string
  isBase: number
  remark: string | null
  baseQty: number
}

export interface UnitOption {
  unitId: number
  unitCode: string
  unitName: string
  conversionRate: number
  isBase: boolean
  baseQty: number
}

export interface ProductVariant {
  id: number
  productId: number
  skuCode: string
  attributes: Record<string, string> | null
  barcode: string | null
  cost: string
  price: string
}

export interface LookupItem {
  id: number
  code?: string
  name?: string
  categoryCode?: string
  categoryName?: string
  brandCode?: string
  brandName?: string
  unitCode?: string
  unitName?: string
}

export interface Warehouse {
  id: number
  warehouseCode: string
  warehouseName: string
  address: string | null
  manager: string | null
  isDefault: number
  status: string
}

export interface Location {
  id: number
  warehouseId: number
  locationCode: string
  locationName: string | null
  zoneCode: string | null
  status: string
}

export interface Employee {
  id: number
  employeeNo: string
  name: string
  deptId: number | null
  positionId: number | null
  userId: number | null
  mobile: string | null
  email: string | null
  hireDate: string | null
  status: string
}

const base = '/master-data'

export function fetchCustomers(params: PageQuery) {
  return request<PageResult<Customer>>({ url: `${base}/customers`, method: 'get', params })
}

export function fetchUnitConversions(productId: number) {
  return request<UnitConversion[]>({ url: `${base}/product-unit-conversions`, method: 'get', params: { productId } })
}

export function fetchUnitOptions(productId: number) {
  return request<UnitOption[]>({ url: `${base}/product-unit-conversions/options`, method: 'get', params: { productId } })
}

export function createUnitConversion(data: { productId: number; unitId: number; conversionRate: string; isBase?: string; remark?: string }) {
  return request<UnitConversion>({ url: `${base}/product-unit-conversions`, method: 'post', data })
}

export function deleteUnitConversion(id: number) {
  return request<null>({ url: `${base}/product-unit-conversions/${id}`, method: 'delete' })
}

export function convertUnitQty(data: { productId: number; unitId: number; qty: string }) {
  return request<{ baseQty: number; unitId: number }>({ url: `${base}/product-unit-conversions/convert`, method: 'post', data })
}

export function createCustomer(data: Record<string, unknown>) {
  return request<Customer>({ url: `${base}/customers`, method: 'post', data })
}

export function updateCustomer(id: number, data: Record<string, unknown>) {
  return request<Customer>({ url: `${base}/customers/${id}`, method: 'put', data })
}

export function deleteCustomer(id: number) {
  return request<null>({ url: `${base}/customers/${id}`, method: 'delete' })
}

export function fetchCustomerContacts(customerId: number) {
  return request<CustomerContact[]>({ url: `${base}/customers/${customerId}/contacts`, method: 'get' })
}

export function createCustomerContact(customerId: number, data: Record<string, unknown>) {
  return request<CustomerContact>({ url: `${base}/customers/${customerId}/contacts`, method: 'post', data })
}

export function fetchCustomerAddresses(customerId: number) {
  return request<CustomerAddress[]>({ url: `${base}/customers/${customerId}/addresses`, method: 'get' })
}

export function createCustomerAddress(customerId: number, data: Record<string, unknown>) {
  return request<CustomerAddress>({ url: `${base}/customers/${customerId}/addresses`, method: 'post', data })
}

export function fetchSuppliers(params: PageQuery) {
  return request<PageResult<Supplier>>({ url: `${base}/suppliers`, method: 'get', params })
}

export function createSupplier(data: Record<string, unknown>) {
  return request<Supplier>({ url: `${base}/suppliers`, method: 'post', data })
}

export function updateSupplier(id: number, data: Record<string, unknown>) {
  return request<Supplier>({ url: `${base}/suppliers/${id}`, method: 'put', data })
}

export function deleteSupplier(id: number) {
  return request<null>({ url: `${base}/suppliers/${id}`, method: 'delete' })
}

export function fetchProducts(params: PageQuery) {
  return request<PageResult<Product>>({ url: `${base}/products`, method: 'get', params })
}

/** 产品导入：实际由 IO 模块提供（system/io），master-data 仅提供产品 CRUD */
export function importProducts(content: string) {
  return request<{ code: string; total: number; imported: number; skipped: number }>({
    url: '/system/io/import',
    method: 'post',
    data: { code: 'product', content }
  })
}

/** 产品条码标签：实际由打印模块生成（print/labels） */
export function generateProductBarcodeLabels(data: {
  productId: number
  variantId?: number
  batchNo?: string
  count: number
  ruleCode?: string
}) {
  return request<Array<{ id: number; barcode: string; labelCode: string }>>({
    url: '/print/labels/batch-generate',
    method: 'post',
    data
  })
}

export function createProduct(data: Record<string, unknown>) {
  return request<Product>({ url: `${base}/products`, method: 'post', data })
}

export function deleteProduct(id: number) {
  return request<null>({ url: `${base}/products/${id}`, method: 'delete' })
}

export function fetchVariants(productId: number) {
  return request<ProductVariant[]>({ url: `${base}/products/${productId}/variants`, method: 'get' })
}

export function fetchCategories() {
  return request<LookupItem[]>({ url: `${base}/lookups/categories`, method: 'get' })
}

export function fetchBrands() {
  return request<LookupItem[]>({ url: `${base}/lookups/brands`, method: 'get' })
}

export function fetchUnits() {
  return request<LookupItem[]>({ url: `${base}/lookups/units`, method: 'get' })
}

export function fetchWarehouses(params: PageQuery) {
  return request<PageResult<Warehouse>>({ url: `${base}/warehouses`, method: 'get', params })
}

export function createWarehouse(data: Record<string, unknown>) {
  return request<Warehouse>({ url: `${base}/warehouses`, method: 'post', data })
}

export function fetchLocations(warehouseId: number) {
  return request<Location[]>({ url: `${base}/warehouses/${warehouseId}/locations`, method: 'get' })
}

export function createLocation(warehouseId: number, data: Record<string, unknown>) {
  return request<Location>({ url: `${base}/warehouses/${warehouseId}/locations`, method: 'post', data })
}

export function deleteLocation(warehouseId: number, locationId: number) {
  return request<null>({ url: `${base}/warehouses/${warehouseId}/locations/${locationId}`, method: 'delete' })
}

export function fetchEmployees(params: PageQuery) {
  return request<PageResult<Employee>>({ url: `${base}/employees`, method: 'get', params })
}

export function createEmployee(data: Record<string, unknown>) {
  return request<Employee>({ url: `${base}/employees`, method: 'post', data })
}

export function updateEmployee(id: number, data: Record<string, unknown>) {
  return request<Employee>({ url: `${base}/employees/${id}`, method: 'put', data })
}

export function deleteEmployee(id: number) {
  return request<null>({ url: `${base}/employees/${id}`, method: 'delete' })
}
