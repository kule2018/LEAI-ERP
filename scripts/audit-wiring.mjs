import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p, exts, out)
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(p)
  }
  return out
}

const serverFiles = walk(path.join(root, 'apps/server/src'), ['.ts'])
const engineFiles = walk(path.join(root, 'apps/server/src/common'), ['.ts'])
const moduleFiles = serverFiles.filter((f) => !f.includes(`${path.sep}common${path.sep}`))
const webFiles = walk(path.join(root, 'apps/web/src'), ['.ts', '.vue'])

// 1. 引擎导出符号是否在其他文件被引用（排除自身文件）
const orphans = []
let totalExports = 0
for (const file of engineFiles) {
  const text = fs.readFileSync(file, 'utf8')
  const names = [
    ...[...text.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)].map((m) => m[1]),
    ...[...text.matchAll(/export\s+const\s+([A-Za-z0-9_]+)\s*[:=]/g)].map((m) => m[1])
  ]
  const others = serverFiles
    .filter((f) => f !== file)
    .map((f) => fs.readFileSync(f, 'utf8'))
    .join('\n')
  for (const name of names) {
    totalExports += 1
    if (!new RegExp(`\\b${name}\\b`).test(others)) orphans.push({ file: path.relative(root, file), name })
  }
}

// 2. 控制器权限码是否已登记（宽松匹配：任意以引号包裹的字符串）
const seeder = fs.readFileSync(path.join(root, 'apps/server/src/modules/platform/platform-seeder.service.ts'), 'utf8')
const seededText = new Set([...seeder.matchAll(/['"]([a-z][a-z0-9-]*(?::[a-z0-9-]+)+)['"]/g)].map((m) => m[1]))
const controllerFiles = serverFiles.filter((f) => f.endsWith('.controller.ts'))
const missingPerm = []
const usedPerms = new Set()
for (const file of controllerFiles) {
  const text = fs.readFileSync(file, 'utf8')
  for (const m of text.matchAll(/@RequirePerm\('([^']+)'\)/g)) {
    const code = m[1]
    usedPerms.add(code)
    if (!seededText.has(code)) missingPerm.push({ file: path.relative(root, file), code })
  }
}

// 3. 写接口审计留痕：逐个 service 检查写方法内是否调用 auditService.record
const serviceFiles = serverFiles.filter((f) => f.endsWith('.service.ts'))
const noAudit = []
for (const file of serviceFiles) {
  const text = fs.readFileSync(file, 'utf8')
  const methods = [...text.matchAll(/async\s+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*(?::[^{]+)?\{/g)]
  for (const m of methods) {
    const name = m[1]
    if (/^(list|get|find|query|search|preview|export|download|count|exists|check|resolve|validate|calculate|compute|suggest|analyze|summar|stat|overview|load|fetch|read|page|options|config|test|ping|health)/i.test(name)) continue
    const start = m.index
    let depth = 0
    let end = start
    for (let i = start; i < text.length; i += 1) {
      if (text[i] === '{') depth += 1
      else if (text[i] === '}') {
        depth -= 1
        if (depth === 0) { end = i; break }
      }
    }
    const body = text.slice(start, end)
    const writes = /\.(save|update|remove|delete|insert|softRemove)\(|createQueryBuilder\(\)\.insert|repo\.save/.test(body)
    if (!writes) continue
    if (!/auditService\.record\(|audit\.record\(|\.record\(/.test(body)) {
      noAudit.push({ file: path.relative(root, file), method: name })
    }
  }
}

// 4. 前端页面：是否存在纯静态（无 API 调用）的新增业务页面
const viewFiles = walk(path.join(root, 'apps/web/src/views'), ['.vue'])
const staticPages = []
for (const file of viewFiles) {
  const text = fs.readFileSync(file, 'utf8')
  const hasApi = /from '@\/api\/|request\(/.test(text)
  const isM00 = /m00/i.test(file)
  if (!hasApi && !isM00) staticPages.push(path.relative(root, file))
}

console.log('=== 引擎接线审计 ===')
console.log(`引擎导出符号：${totalExports}，未被任何服务端文件引用：${orphans.length}`)
for (const o of orphans) console.log(`  [未接线] ${o.file} -> ${o.name}`)

console.log('\n=== 权限码审计 ===')
console.log(`控制器使用权限码：${usedPerms.size}，种子未登记：${missingPerm.length}`)
for (const m of missingPerm) console.log(`  [缺种子] ${m.file} -> ${m.code}`)

console.log('\n=== 写操作审计留痕 ===')
console.log(`写库方法缺审计调用：${noAudit.length}`)
for (const n of noAudit) console.log(`  [缺审计] ${n.file} -> ${n.method}`)

console.log('\n=== 前端页面 API 接入 ===')
console.log(`疑似静态页面：${staticPages.length}`)
for (const s of staticPages) console.log(`  [静态] ${s}`)
