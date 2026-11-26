import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(root, file))

const problems = []

function walk(relative, suffix) {
  const absolute = path.join(root, relative)
  if (!fs.existsSync(absolute)) return []
  const result = []
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const next = `${relative}/${entry.name}`
    if (entry.isDirectory()) result.push(...walk(next, suffix))
    else if (entry.name.endsWith(suffix)) result.push(next)
  }
  return result
}

const seeder = read('apps/server/src/modules/platform/platform-seeder.service.ts')
const permBlock = seeder.match(/export const PERMISSION_CODES = \[([\s\S]*?)\]/)?.[1] ?? ''
const permissionCodes = new Set([...permBlock.matchAll(/'([^']+)'/g)].map((match) => match[1]))

const usedPerms = new Set()
for (const file of walk('apps/server/src/modules', '.ts')) {
  const text = read(file)
  for (const match of text.matchAll(/@RequirePerm\('([^']+)'\)/g)) {
    usedPerms.add(match[1])
  }
}
for (const code of usedPerms) {
  if (!permissionCodes.has(code)) problems.push(`权限码未种入: ${code}`)
}

if (/componentPath: 'common\/coming-soon\/index'/.test(seeder)) {
  problems.push('菜单种子仍包含 coming-soon 占位组件')
}
for (const match of seeder.matchAll(/componentPath: '([^']+)'/g)) {
  const componentPath = match[1]
  const vueFile = `apps/web/src/views/${componentPath}.vue`
  if (!exists(vueFile)) problems.push(`菜单组件不存在: ${vueFile}`)
}

const migrationFiles = walk('apps/server/src/migrations', '.sql')
const migrationSql = migrationFiles.map(read).join('\n')
const tables = new Set()
for (const file of walk('apps/server/src/modules', '.ts')) {
  const text = read(file)
  for (const match of text.matchAll(/@Entity\('([^']+)'/g)) {
    tables.add(match[1])
  }
}
for (const table of tables) {
  if (!migrationSql.includes(`CREATE TABLE IF NOT EXISTS \`${table}\``)) {
    problems.push(`实体表缺少迁移: ${table}`)
  }
}

const serverFiles = walk('apps/server/src', '.ts')
const webFiles = [...walk('apps/web/src', '.ts'), ...walk('apps/web/src', '.vue')]
for (const file of [...serverFiles, ...webFiles]) {
  const text = read(file)
  if (/(\/\/|\/\*)\s*(TODO|FIXME)|not implemented/i.test(text)) {
    problems.push(`存在未完成标记: ${file}`)
  }
  for (const line of text.split('\n')) {
    const importMatch = line.match(/^import \{([^}]+)\} from/)
    if (!importMatch) continue
    const names = importMatch[1].split(',').map((item) => item.trim()).filter(Boolean)
    if (new Set(names).size !== names.length) {
      problems.push(`重复导入: ${file}`)
    }
  }
}

console.log(`权限码：种子 ${permissionCodes.size} 个，使用 ${usedPerms.size} 个`)
console.log(`实体表：${tables.size} 个，迁移文件：${migrationFiles.length} 个`)
console.log(`扫描源码：${serverFiles.length + webFiles.length} 个文件`)

if (problems.length === 0) {
  console.log('静态审计通过')
} else {
  console.log(`发现 ${problems.length} 个问题：`)
  for (const problem of problems) console.log(` - ${problem}`)
  process.exitCode = 1
}
