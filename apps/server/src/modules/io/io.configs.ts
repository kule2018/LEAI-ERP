import type { ImportConfig } from './io.types'

/**
 * 内置导入配置。写操作在 IoService 中基于 configuration.entity 在事务内执行，
 * 校验失败的整批不落库（先全部校验，再统一写入）。
 */

export const CUSTOMER_IMPORT: ImportConfig<Record<string, unknown>> = {
  code: 'customer',
  name: '客户',
  uniqueKeys: ['customerCode'],
  upsert: false,
  entityCode: 'CUSTOMER',
  fields: [
    { header: '客户编码', key: 'customerCode', required: true, maxLength: 50 },
    { header: '客户名称', key: 'customerName', required: true, maxLength: 150 },
    { header: '客户分组', key: 'customerGroup', maxLength: 50 },
    { header: '信用额度', key: 'creditLimit', type: 'decimal' },
    {
      header: '状态',
      key: 'status',
      transform: (v) => {
        const upper = v.toUpperCase()
        return upper === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'
      }
    }
  ]
}

export const PRODUCT_IMPORT: ImportConfig<Record<string, unknown>> = {
  code: 'product',
  name: '产品',
  uniqueKeys: ['productCode'],
  upsert: false,
  entityCode: 'PRODUCT',
  fields: [
    { header: '产品编码', key: 'productCode', required: true, maxLength: 50 },
    { header: '产品名称', key: 'productName', required: true, maxLength: 150 },
    { header: '条码', key: 'barcode', maxLength: 100 },
    { header: '销售价', key: 'price', type: 'decimal' },
    { header: '成本价', key: 'cost', type: 'decimal' }
  ]
}

export const IMPORT_CONFIGS: Record<string, ImportConfig<Record<string, unknown>>> = {
  [CUSTOMER_IMPORT.code]: CUSTOMER_IMPORT,
  [PRODUCT_IMPORT.code]: PRODUCT_IMPORT
}
