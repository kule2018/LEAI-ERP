import fs from 'node:fs'
import path from 'node:path'

const groups = {
  A: [], // 后端真实实现（排除 docs 文档清单模块）
  B: [], // 前端页面
  C: []  // 前端 API
}
function walk(dir, bucket) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'docs') continue
      walk(p, bucket)
    } else if (/\.(ts|vue)$/.test(entry.name)) {
      bucket.push(p)
    }
  }
}
walk('apps/server/src/modules', groups.A)
walk('apps/server/src/common', groups.A)
walk('apps/web/src/views', groups.B)
walk('apps/web/src/api', groups.C)
walk('apps/web/src/utils', groups.C)
walk('apps/web/src/components', groups.B)

const cache = new Map()
function content(p) {
  if (!cache.has(p)) cache.set(p, fs.readFileSync(p, 'utf8').toLowerCase())
  return cache.get(p)
}
function hits(bucket, keywords) {
  const found = new Set()
  for (const kw of keywords) {
    const k = kw.toLowerCase()
    for (const p of bucket) if (content(p).includes(k)) { found.add(kw); break }
  }
  return [...found]
}

const ITEMS = JSON.parse(fs.readFileSync('scripts/gap-items.json', 'utf8'))

const rows = []
for (const [chapter, item, keywords, scope] of ITEMS) {
  const a = hits(groups.A, keywords)
  const b = hits(groups.B, keywords)
  const c = hits(groups.C, keywords)
  const frontendOnly = scope === 'frontend'
  const state = frontendOnly
    ? (b.length > 0 || c.length > 0 ? '已实现' : '缺失')
    : a.length > 0 && (b.length > 0 || c.length > 0) ? '已实现'
      : a.length > 0 || b.length > 0 || c.length > 0 ? '部分实现'
        : '缺失'
  rows.push({ chapter, item, keywords, a, b, c, state })
}

const order = { 缺失: 0, 部分实现: 1, 已实现: 2 }
rows.sort((x, y) => order[x.state] - order[y.state] || Number(x.chapter) - Number(y.chapter))

let last = null
for (const r of rows) {
  if (r.chapter !== last) { console.log(`\n----- 第${r.chapter}章 -----`); last = r.chapter }
  const tag = r.state === '缺失' ? '【缺失】' : r.state === '部分实现' ? '【部分】' : '【已实现】'
  const detail = r.state === '缺失'
    ? ''
    : ` 后端:${r.a.join('/') || '-'} 页面:${r.b.join('/') || '-'} API:${r.c.join('/') || '-'}`
  console.log(`${tag} ${r.item}${detail}`)
}
const count = { 缺失: 0, 部分实现: 0, 已实现: 0 }
rows.forEach((r) => { count[r.state] += 1 })
console.log(`\n统计: 缺失 ${count.缺失} / 部分实现 ${count.部分实现} / 已实现 ${count.已实现} / 总计 ${rows.length}`)
