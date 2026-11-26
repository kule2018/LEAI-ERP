import fs from 'node:fs'
import path from 'node:path'

const kws = process.argv.slice(2)
const roots = ['apps/server/src', 'apps/web/src']
const hits = {}
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f)
    const st = fs.statSync(p)
    if (st.isDirectory()) {
      if (/node_modules|dist|\.git/.test(p)) continue
      walk(p)
    } else if (/\.(ts|vue)$/.test(f)) {
      const text = fs.readFileSync(p, 'utf8').toLowerCase()
      for (const k of kws) {
        if (text.includes(k.toLowerCase())) (hits[k] ??= []).push(p.replace(/\\/g, '/'))
      }
    }
  }
}
for (const r of roots) walk(r)
for (const k of kws) {
  const v = hits[k] ?? []
  console.log(`${k} :: ${v.length ? v.slice(0, 4).join(', ') : 'NONE'}`)
}
