import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, open, readdir } from 'node:fs/promises'
import path from 'node:path'

const host = process.env.DB_HOST ?? '127.0.0.1'
const port = process.env.DB_PORT ?? '3306'
const user = process.env.DB_USERNAME ?? 'root'
const password = process.env.DB_PASSWORD ?? 'leaierp_dev'
const database = process.env.DB_DATABASE ?? 'leaierp'
const localDir = path.resolve(process.env.BACKUP_DIR ?? 'backups')
const offsiteDir = path.resolve(process.env.OFFSITE_BACKUP_DIR ?? path.join(localDir, 'offsite'))
const binlogDir = process.env.BINLOG_DIR ?? null
const stamp = new Date().toISOString().replace(/[:.]/g, '-')

function run(command, args, stdio = ['ignore', 'pipe', 'pipe']) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio })
  if (result.status !== 0) throw new Error(`${command} 执行失败：${result.stderr?.trim() ?? ''}`)
  return result.stdout ?? ''
}

await mkdir(localDir, { recursive: true })
await mkdir(offsiteDir, { recursive: true })

// 一致性快照：--master-data=2 记录 binlog 位点，--flush-logs 滚动新日志
const dumpFile = path.join(localDir, `${database}-${stamp}.sql`)
const descriptor = await open(dumpFile, 'w')
try {
  run(process.env.MYSQLDUMP_BIN ?? 'mysqldump', [
    `-h${host}`, `-P${port}`, `-u${user}`, `-p${password}`,
    '--single-transaction', '--master-data=2', '--flush-logs', '--routines', '--triggers', database
  ], ['ignore', descriptor.fd, 'pipe'])
} finally {
  await descriptor.close()
}
run(process.env.MYSQL_BIN ?? 'mysql', [`-h${host}`, `-P${port}`, `-u${user}`, `-p${password}`, '-e', 'FLUSH LOGS;'])

if (binlogDir) {
  const target = path.join(offsiteDir, 'binlog')
  await mkdir(target, { recursive: true })
  const files = (await readdir(binlogDir)).filter((name) => name.startsWith('mysql-bin.') && name !== 'mysql-bin.index')
  for (const file of files) {
    await copyFile(path.join(binlogDir, file), path.join(target, file))
  }
  console.log(`binlog 已同步到异地目录：${target}（${files.length} 个文件）`)
}

console.log(`一致性备份完成：${dumpFile}`)
