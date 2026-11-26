#!/usr/bin/env node
/**
 * 规范一比一覆盖矩阵审计
 * 依据 docs/ERP业务功能扩展与增强规范.md 的 141 个扩展点，在后端/前端/权限/迁移中检索证据，
 * 输出证据薄弱行供人工复核。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const MATRIX = JSON.parse(readFileSync(join(ROOT, 'scripts', 'spec-matrix.json'), 'utf8'))

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git' || entry === 'coverage') continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (/\.(ts|vue|mjs|sql)$/.test(entry)) out.push(full)
  }
  return out
}

const files = walk(join(ROOT, 'apps', 'server', 'src')).map((f) => ({ f, area: 'server' }))
  .concat(walk(join(ROOT, 'apps', 'web', 'src')).map((f) => ({ f, area: 'web' })))

const contents = files.map(({ f, area }) => ({
  area,
  rel: relative(ROOT, f).replace(/\\/g, '/'),
  text: readFileSync(f, 'utf8')
}))

const permText = contents.filter((c) => c.rel.includes('platform-seeder')).map((c) => c.text).join('\n')
const migText = contents.filter((c) => c.rel.includes('migration')).map((c) => c.text).join('\n')

const results = MATRIX.map((item) => {
  const hits = { server: [], web: [] }
  for (const kw of item.kw) {
    for (const c of contents) {
      if (c.text.includes(kw)) {
        const idx = hits[c.area].findIndex((h) => h.rel === c.rel)
        if (idx >= 0) hits[c.area][idx].kw.push(kw)
        else hits[c.area].push({ rel: c.rel, kw: [kw] })
      }
    }
  }
  const permHit = item.kw.some((kw) => permText.includes(kw))
  const migHit = item.kw.some((kw) => migText.includes(kw))
  const serverCount = hits.server.length
  const webCount = hits.web.length
  const score = serverCount + webCount + (permHit ? 1 : 0) + (migHit ? 1 : 0)
  return { ...item, hits, permHit, migHit, serverCount, webCount, score }
})

const weak = results.filter((r) => r.score < 4).sort((a, b) => a.score - b.score)

console.log('=== 规范覆盖矩阵：证据薄弱行（score<4）===')
console.log(`总扩展点：${results.length}，薄弱：${weak.length}，平均证据分：${(results.reduce((s, r) => s + r.score, 0) / results.length).toFixed(1)}`)
console.log('')
for (const r of weak) {
  console.log(`[第${r.ch}章 行${r.row}] ${r.name}`)
  console.log(`  score=${r.score} server=${r.serverCount} web=${r.webCount} perm=${r.permHit ? 'Y' : 'N'} mig=${r.migHit ? 'Y' : 'N'}`)
  const sample = [...r.hits.server.slice(0, 3).map((h) => `S:${h.rel}`), ...r.hits.web.slice(0, 3).map((h) => `W:${h.rel}`)]
  if (sample.length) console.log(`  命中: ${sample.join(', ')}`)
}
