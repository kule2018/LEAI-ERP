const BASE = process.env.API_BASE ?? 'http://127.0.0.1:3000/api/v1'
const USERNAME = process.env.INITIAL_ADMIN_USERNAME ?? 'admin'
const PASSWORD = process.env.INITIAL_ADMIN_PASSWORD ?? 'Admin@123456'
const TODAY = new Date().toISOString().slice(0, 10)

let token = ''

async function api(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  const payload = await response.json()
  if (!response.ok || payload.code !== 0) {
    throw new Error(`${method} ${path} 失败：${payload.message ?? response.status}`)
  }
  return payload.data
}

function asId(entity) {
  return { ...entity, id: Number(entity.id) }
}

async function count(path) {
  const data = await api('GET', path)
  return data.total ?? data.length ?? 0
}

async function list(path) {
  const data = await api('GET', `${path}?pageSize=200`)
  return data.list ?? data.items ?? []
}

async function ensure(path, codeField, code, body) {
  const existing = (await list(path)).find((item) => item[codeField] === code)
  if (existing) return asId(existing)
  return asId(await api('POST', path, body))
}

async function main() {
  const login = await api('POST', '/auth/login', { username: USERNAME, password: PASSWORD })
  token = login.accessToken
  console.log('登录成功，开始同步业务数据')

  const warehouse = await ensure('/master-data/warehouses', 'warehouseCode', 'WH-MAIN', {
    warehouseCode: 'WH-MAIN',
    warehouseName: '主仓库',
    isDefault: 'YES'
  })

  const customers = []
  for (const [code, name] of [
    ['C001', '华东科技有限公司'],
    ['C002', '华南贸易集团'],
    ['C003', '北方制造有限公司']
  ]) {
    customers.push(await ensure('/master-data/customers', 'customerCode', code, {
      customerCode: code,
      customerName: name,
      customerGroup: '重点客户',
      creditLimit: '1000000',
      remark: '业务种子数据'
    }))
  }
  console.log(`客户：${customers.length} 条`)

  const suppliers = []
  for (const [code, name] of [
    ['S001', '恒信供应链有限公司'],
    ['S002', '远达电子元器件'],
    ['S003', '中联原材料供应']
  ]) {
    suppliers.push(await ensure('/master-data/suppliers', 'supplierCode', code, {
      supplierCode: code,
      supplierName: name,
      supplierGroup: '核心供应商',
      qualificationStatus: 'QUALIFIED',
      ratingScore: '95',
      remark: '业务种子数据'
    }))
  }
  console.log(`供应商：${suppliers.length} 条`)

  const products = []
  for (const [code, name, cost, price] of [
    ['P001', '智能终端 A100', '1200', '1880'],
    ['P002', '智能终端 B200', '2400', '3680'],
    ['P003', '工业传感器 S10', '320', '580'],
    ['P004', '企业级路由器 R50', '860', '1280'],
    ['P005', '办公笔记本 N14', '4200', '5999']
  ]) {
    products.push(await ensure('/master-data/products', 'productCode', code, {
      productCode: code,
      productName: name,
      barcode: `6900000000${code.slice(1)}`,
      productType: 'GOODS',
      trackingType: 'NONE',
      cost,
      price,
      floorPrice: cost,
      defaultWarehouseId: warehouse.id,
      remark: '业务种子数据'
    }))
  }
  console.log(`产品：${products.length} 条`)

  const balances = await list('/inventory/balances')
  for (const [index, product] of products.entries()) {
    const hasStock = balances.some((item) => Number(item.productId) === product.id && Number(item.qtyOnHand) > 0)
    if (hasStock) continue
    await api('POST', '/inventory/movements', {
      voucherType: 'OTHER_IN',
      voucherId: 0,
      warehouseId: warehouse.id,
      productId: product.id,
      qtyIn: String(100 + index * 50),
      cost: product.cost,
      remark: '期初库存'
    })
  }
  console.log('期初库存：已同步')

  if (await count('/sales/orders') === 0) {
    for (let index = 0; index < 3; index += 1) {
      await api('POST', '/sales/orders', {
        customerId: customers[index].id,
        warehouseId: warehouse.id,
        orderDate: TODAY,
        sourceType: 'SEED',
        lines: [
          { productId: products[index].id, qty: String(2 + index), unitPrice: products[index].price },
          { productId: products[(index + 1) % products.length].id, qty: '1', unitPrice: products[(index + 1) % products.length].price }
        ],
        remark: '业务种子数据'
      })
    }
    console.log('销售订单：3 条')
  }

  if (await count('/purchase/orders') === 0) {
    for (let index = 0; index < 2; index += 1) {
      await api('POST', '/purchase/orders', {
        supplierId: suppliers[index].id,
        warehouseId: warehouse.id,
        orderDate: TODAY,
        lines: [
          { productId: products[index].id, qty: String(10 + index * 5), unitPrice: products[index].cost },
          { productId: products[(index + 2) % products.length].id, qty: '8', unitPrice: products[(index + 2) % products.length].cost }
        ],
        remark: '业务种子数据'
      })
    }
    console.log('采购订单：2 条')
  }

  for (const path of [
    '/master-data/products',
    '/inventory/balances',
    '/sales/orders',
    '/purchase/orders'
  ]) {
    console.log(`${path} total=${await count(path)}`)
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
