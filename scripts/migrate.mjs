import { createRequire } from 'node:module'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const require = createRequire(import.meta.url)
let mysql
try {
  mysql = require('mysql2/promise')
} catch {
  mysql = require('../apps/server/node_modules/mysql2/promise')
}

const migrationsDir = path.resolve('apps/server/src/migrations')
const files = (await readdir(migrationsDir))
  .filter((name) => /^M\d+.*\.sql$/.test(name))
  .sort()

const connection = await mysql.createConnection({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? 'leaierp_dev',
  database: process.env.DB_DATABASE ?? 'leaierp',
  multipleStatements: true
})

try {
  await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name VARCHAR(120) NOT NULL PRIMARY KEY,
    applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  let applied = 0
  for (const file of files) {
    const [rows] = await connection.query('SELECT 1 FROM schema_migrations WHERE name = ? LIMIT 1', [file])
    if (Array.isArray(rows) && rows.length > 0) {
      console.log(`[migrate] skipped ${file}`)
      continue
    }
    const sql = await readFile(path.join(migrationsDir, file), 'utf8')
    await connection.query(sql)
    await connection.query('INSERT INTO schema_migrations(name) VALUES (?)', [file])
    applied += 1
    console.log(`[migrate] applied ${file}`)
  }
  console.log(`[migrate] ${applied} applied, ${files.length - applied} skipped`)
} finally {
  await connection.end()
}
