import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const exists = (p) => fs.existsSync(path.join(root, p))

const moduleDirs = fs.readdirSync(path.join(root, 'apps/server/src/modules')).filter((name) =>
  fs.statSync(path.join(root, 'apps/server/src/modules', name)).isDirectory()
)

const problems = []
const seenRoutes = new Set()
const seenPrefixes = new Set()
const prefixByDir = new Map()

for (const dir of moduleDirs) {
  const base = `apps/server/src/modules/${dir}`
  const entityPath = `${base}/${dir}.entity.ts`
  const servicePath = `${base}/${dir}.service.ts`
  const controllerPath = `${base}/${dir}.controller.ts`
  const modulePath = `${base}/${dir}.module.ts`
  const dtoPath = `${base}/dto.ts`

  for (const file of [entityPath, servicePath, controllerPath, modulePath, dtoPath]) {
    if (!exists(file)) problems.push(`${dir}: 缺少 ${file}`)
  }
  if (problems.length > 0 && !exists(entityPath)) continue

  const entity = read(entityPath)
  const service = read(servicePath)
  const controller = read(controllerPath)
  const dto = read(dtoPath)

  const route = [...controller.matchAll(/@Controller\('([^']+)'\)/g)].map((m) => m[1])[0]
  const prefix = [...service.matchAll(/export class (\w+)Service/g)].map((m) => m[1])[0]
  if (!route || seenRoutes.has(route)) problems.push(`${dir}: 路由重复或缺失 ${route}`)
  if (!prefix || seenPrefixes.has(prefix)) problems.push(`${dir}: 业务前缀重复或缺失 ${prefix}`)
  seenRoutes.add(route)
  seenPrefixes.add(prefix)
  prefixByDir.set(dir, prefix)

  if (!entity.includes("name: 'tenant_id'") || !entity.includes("name: 'is_deleted'")) {
    problems.push(`${dir}: 实体缺少公共字段`)
  }
  if (!service.includes('isDeleted: 0') || !service.includes('allowedTransitions') || !service.includes('writeAudit')) {
    problems.push(`${dir}: Service 缺少租户过滤/状态机/审计`)
  }
  if (!controller.includes('@RequirePerm') || !controller.includes('@DataScope') || !controller.includes('@UseGuards')) {
    problems.push(`${dir}: Controller 缺少权限声明`)
  }
  if (service.includes('aiAuditRepo') && !controller.includes('ai-confirm')) {
    problems.push(`${dir}: AI 页面缺少人工确认入口`)
  }
  if (service.includes('printLogRepo') && !controller.includes("':id/print'")) {
    problems.push(`${dir}: 打印页面缺少打印入口`)
  }
  if (service.includes("'dashboard:'") && !service.includes('invalidateCache')) {
    problems.push(`${dir}: 看板缓存缺少失效处理`)
  }
  if (!dto.includes(`Create${prefix}Dto`) || !dto.includes(`Update${prefix}Dto`) || !dto.includes(`Query${prefix}Dto`)) {
    problems.push(`${dir}: DTO 未三分`)
  }

  const apiPath = `apps/web/src/api/${dir}.ts`
  const viewRoot = `apps/web/src/views/${route}`
  const viewPath = `${viewRoot}/index.vue`
  const drawerName = [...entity.matchAll(/export class (\w+)Record/g)]
    .map((m) => `${m[1]}Drawer.vue`)[0]
  if (!exists(apiPath)) problems.push(`${dir}: 缺少 api 文件`)
  if (!exists(viewPath)) problems.push(`${dir}: 缺少 view/index.vue`)
  if (drawerName && !exists(`${viewRoot}/${drawerName}`)) problems.push(`${dir}: 缺少抽屉 ${drawerName}`)

  if (exists(viewPath)) {
    const view = read(viewPath)
    for (const component of ['BaseGrid', 'BaseDrawer', 'StatusSteps']) {
      if (!view.includes(component)) problems.push(`${dir}: 页面未使用 ${component}`)
    }
    const usesDecimal = view.includes('new Decimal(')
    if (usesDecimal !== view.includes("from 'decimal.js'")) {
      problems.push(`${dir}: Decimal 使用与导入不一致`)
    }
  }

  for (const file of [entityPath, servicePath, controllerPath, modulePath, dtoPath, apiPath]) {
    if (!exists(file)) continue
    const text = read(file)
    if (text.includes('\\${')) problems.push(`${file}: 存在未转义的模板插值`)
  }
}

for (const dir of moduleDirs) {
  const ownPrefix = prefixByDir.get(dir)
  if (!ownPrefix) continue
  const dirFiles = []
  const serverBase = path.join(root, 'apps/server/src/modules', dir)
  for (const entry of fs.readdirSync(serverBase, { withFileTypes: true })) {
    if (entry.isFile()) dirFiles.push(`apps/server/src/modules/${dir}/${entry.name}`)
  }
  const apiFile = `apps/web/src/api/${dir}.ts`
  if (exists(apiFile)) dirFiles.push(apiFile)
  const route = [...read(`apps/server/src/modules/${dir}/${dir}.controller.ts`).matchAll(/@Controller\('([^']+)'\)/g)]
    .map((match) => match[1])[0]
  if (route) {
    const viewBase = path.join(root, 'apps/web/src/views', route)
    if (fs.existsSync(viewBase)) {
      for (const entry of fs.readdirSync(viewBase, { withFileTypes: true })) {
        if (entry.isFile()) dirFiles.push(`apps/web/src/views/${route}/${entry.name}`)
      }
    }
  }
  const combined = dirFiles.filter(exists).map(read).join('\n')
  for (const prefix of seenPrefixes) {
    if (prefix === ownPrefix) continue
    const pattern = new RegExp('(?<![A-Za-z])' + prefix + '(?![A-Za-z])')
    if (pattern.test(combined)) {
      problems.push(`${dir}: 出现其他业务前缀 ${prefix}`)
    }
  }
}

const allFiles = []
function walk(relative) {
  const absolute = path.join(root, relative)
  if (!fs.existsSync(absolute)) return
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const next = `${relative}/${entry.name}`
    if (entry.isDirectory()) walk(next)
    else if (/\.(ts|vue|mjs)$/.test(entry.name)) allFiles.push(next)
  }
}
walk('apps')

const forbidden = ['供应商', '客户订单']
for (const file of allFiles) {
  const text = read(file)
  for (const word of forbidden) {
    if (text.includes(word)) problems.push(`${file}: 出现其他业务域字样「${word}」`)
  }
  for (const line of text.split('\n')) {
    const importMatch = line.match(/^import \{([^}]+)\} from/)
    if (importMatch) {
      const names = importMatch[1].split(',').map((item) => item.trim()).filter(Boolean)
      if (new Set(names).size !== names.length) {
        problems.push(`${file}: 重复导入 ${names.join(', ')}`)
      }
    }
  }
}

console.log(`模块数：${moduleDirs.length}`)
console.log(`检查文件数：${allFiles.length}`)
if (problems.length === 0) {
  console.log('静态审计通过')
} else {
  console.log(`发现 ${problems.length} 个问题：`)
  for (const problem of problems) console.log(` - ${problem}`)
  process.exitCode = 1
}
