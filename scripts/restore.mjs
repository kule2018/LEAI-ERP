import { spawn, spawnSync } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { createGunzip } from 'node:zlib'
import path from 'node:path'

const backupFile = process.argv[2]
if (!backupFile) {
  console.error('用法: npm run restore:db -- backups/xxx.sql.gz')
  process.exit(1)
}

const host = process.env.DB_HOST ?? '127.0.0.1'
const port = process.env.DB_PORT ?? '3306'
const user = process.env.DB_USERNAME ?? 'root'
const password = process.env.DB_PASSWORD ?? 'leaierp_dev'
const database = process.env.DB_DATABASE ?? 'leaierp'

const localMysqlAvailable = spawnSync(process.env.MYSQL_BIN ?? 'mysql', ['--version'], { stdio: 'ignore' }).status === 0
const useDocker = process.env.DB_CLIENT === 'docker' || (!process.env.MYSQL_BIN && !localMysqlAvailable)
const mysqlArgs = [
  `-h${useDocker ? '127.0.0.1' : host}`,
  `-P${useDocker ? '3306' : port}`,
  `-u${user}`,
  `-p${password}`,
  database
]
const [mysqlCommand, mysqlCommandArgs] = useDocker
  ? ['docker', ['compose', 'exec', '-T', 'mysql', 'mysql', ...mysqlArgs]]
  : [process.env.MYSQL_BIN ?? 'mysql', mysqlArgs]
const mysql = spawn(mysqlCommand, mysqlCommandArgs, { stdio: ['pipe', 'inherit', 'inherit'] })

const source = createReadStream(path.resolve(backupFile))
const stream = backupFile.endsWith('.gz') ? source.pipe(createGunzip()) : source
stream.pipe(mysql.stdin)

let stderr = ''
mysql.stderr?.on('data', (chunk) => {
  stderr += String(chunk)
})

const result = await new Promise((resolve, reject) => {
  mysql.on('error', reject)
  mysql.on('close', (code) => {
    if (code === 0) resolve()
    else reject(new Error(stderr.trim() || `mysql exited with ${code}`))
  })
})

console.log(`[restore] ${backupFile}`)
void result
