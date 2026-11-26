import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
let mysql
try {
  mysql = require('mysql2/promise')
} catch {
  mysql = require('../apps/server/node_modules/mysql2/promise')
}

const apiBase = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000/api/v1'
const username = process.env.INITIAL_ADMIN_USERNAME ?? 'admin'
const password = process.env.INITIAL_ADMIN_PASSWORD ?? 'Admin@123456'
const tenantCode = process.env.TENANT_CODE ?? 'default'
const totalRequests = Number(process.env.STRESS_REQUESTS ?? 200)
const initialQty = Number(process.env.STRESS_INITIAL_QTY ?? 100)
const batchSize = Number(process.env.STRESS_BATCH_SIZE ?? 40)

const connection = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? 'leaierp_dev',
  database: process.env.DB_DATABASE ?? 'leaierp'
})

const stamp = Date.now().toString(36).toUpperCase()
let tenantId = 0
let productId = 0
let warehouseId = 0

try {
  const [tenantRows] = await connection.query('SELECT id FROM sys_tenant WHERE tenant_code = ? LIMIT 1', [tenantCode])
  if (!Array.isArray(tenantRows) || tenantRows.length === 0) throw new Error(`租户不存在: ${tenantCode}`)
  tenantId = Number(tenantRows[0].id)

  const loginResponse = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tenantCode, username, password })
  })
  const loginBody = await loginResponse.json()
  if (!loginResponse.ok || loginBody.code !== 0) throw new Error(`登录失败: ${JSON.stringify(loginBody)}`)
  const token = loginBody.data.accessToken

  const [productResult] = await connection.query(
    'INSERT INTO product(tenant_id, product_code, product_name, product_type, tracking_type) VALUES (?, ?, ?, ?, ?)',
    [tenantId, `STRESS-${stamp}`, `并发测试产品-${stamp}`, 'STANDARD', 'NONE']
  )
  productId = Number(productResult.insertId)
  const [warehouseResult] = await connection.query(
    'INSERT INTO warehouse(tenant_id, warehouse_code, warehouse_name) VALUES (?, ?, ?)',
    [tenantId, `STRESS-WH-${stamp}`, `并发测试仓-${stamp}`]
  )
  warehouseId = Number(warehouseResult.insertId)
  await connection.query(
    'INSERT INTO stock_balance(tenant_id, warehouse_id, product_id, qty_on_hand) VALUES (?, ?, ?, ?)',
    [tenantId, warehouseId, productId, initialQty]
  )

  let success = 0
  let failed = 0
  for (let offset = 0; offset < totalRequests; offset += batchSize) {
    const batch = Array.from({ length: Math.min(batchSize, totalRequests - offset) }, (_, index) => offset + index)
    const results = await Promise.all(batch.map(async (voucherId) => {
      const response = await fetch(`${apiBase}/inventory/movements`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          voucherType: 'STRESS_OUT',
          voucherId: voucherId + 1,
          warehouseId,
          productId,
          qtyOut: '1',
          remark: '库存并发压测'
        })
      })
      return response.ok
    }))
    for (const ok of results) {
      if (ok) success += 1
      else failed += 1
    }
  }

  const [balanceRows] = await connection.query(
    'SELECT qty_on_hand FROM stock_balance WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ? LIMIT 1',
    [tenantId, warehouseId, productId]
  )
  const [ledgerRows] = await connection.query(
    "SELECT COUNT(*) AS count FROM stock_ledger WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ? AND voucher_type = 'STRESS_OUT'",
    [tenantId, warehouseId, productId]
  )
  const finalQty = Number(balanceRows[0]?.qty_on_hand ?? -1)
  const ledgerCount = Number(ledgerRows[0]?.count ?? 0)

  console.log(JSON.stringify({
    totalRequests,
    initialQty,
    success,
    failed,
    finalQty,
    ledgerCount,
    noOversell: success === initialQty && failed === totalRequests - initialQty && finalQty === 0 && ledgerCount === initialQty
  }, null, 2))

  if (success !== initialQty || finalQty < 0 || ledgerCount !== success) {
    throw new Error('库存并发压测未通过：出现超卖、负库存或流水不一致')
  }
} finally {
  if (productId && warehouseId) {
    await connection.query('DELETE FROM stock_ledger WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?', [tenantId, warehouseId, productId])
    await connection.query('DELETE FROM stock_balance WHERE tenant_id = ? AND warehouse_id = ? AND product_id = ?', [tenantId, warehouseId, productId])
    await connection.query('DELETE FROM product WHERE id = ?', [productId])
    await connection.query('DELETE FROM warehouse WHERE id = ?', [warehouseId])
  }
  await connection.end()
}
