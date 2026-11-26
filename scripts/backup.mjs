import { spawn, spawnSync } from 'node:child_process'
import { createWriteStream, mkdir } from 'node:fs/promises'
import { createGzip } from 'node:zlib'
import path from 'node:path'

const host = process.env.DB_HOST ?? '127.0.0.1'
const port = process.env.DB_PORT ?? '3306'
const user = process.env.DB_USERNAME ?? 'root'
const password = process.env.DB_PASSWORD ?? 'leaierp_dev'
const database = process.env.DB_DATABASE ?? 'leaierp'
const backupDir = path.resolve(process.env.BACKUP_DIR ?? 'backups')
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const outputFile = path.join(backupDir, `${database}-${stamp}.sql.gz`)

await mkdir(backupDir, { recursive: true })

const localDumpAvailable = spawnSync(process.env.MYSQLDUMP_BIN ?? 'mysqldump', ['--version'], { stdio: 'ignore' }).status === 0
const useDocker = process.env.DB_CLIENT === 'docker' || (!process.env.MYSQLDUMP_BIN && !localDumpAvailable)
const dumpArgs = [
  `-h${useDocker ? '127.0.0.1' : host}`,
  `-P${useDocker ? '3306' : port}`,
  `-u${user}`,
  `-p${password}`,
  '--single-transaction',
  '--routines',
  '--triggers',
  '--events',
  '--hex-blob',
  database
]
const [dumpCommand, dumpCommandArgs] = useDocker
  ? ['docker', ['compose', 'exec', '-T', 'mysql', 'mysqldump', ...dumpArgs]]
  : [process.env.MYSQLDUMP_BIN ?? 'mysqldump', dumpArgs]
const dump = spawn(dumpCommand, dumpCommandArgs, { stdio: ['ignore', 'pipe', 'pipe'] })

const output = createWriteStream(outputFile)
dump.stdout.pipe(createGzip()).pipe(output)

let stderr = ''
dump.stderr.on('data', (chunk) => {
  stderr += String(chunk)
})

const dumpDone = new Promise((resolve, reject) => {
  dump.on('error', reject)
  dump.on('close', (code) => {
    if (code === 0) resolve()
    else reject(new Error(stderr.trim() || `mysqldump exited with ${code}`))
  })
})
const writeDone = new Promise((resolve, reject) => {
  output.on('finish', resolve)
  output.on('error', reject)
})

await Promise.all([dumpDone, writeDone])
console.log(`[backup] ${outputFile}`)
