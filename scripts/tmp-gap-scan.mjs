import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('apps/server/src')
const webRoot = path.resolve('apps/web/src')

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|vue)$/.test(e.name)) out.push(p)
  }
  return out
}

const files = [...walk(root), ...walk(webRoot)]
const contents = files.map((f) => ({ f, t: fs.readFileSync(f, 'utf8') }))

const keywords = process.argv.slice(2)
for (const kw of keywords) {
  const hit = contents.filter((c) => c.t.includes(kw))
  const server = hit.filter((c) => c.f.includes('apps/server')).length
  const web = hit.length - server
  const sample = hit.slice(0, 6).map((c) => path.relative(process.cwd(), c.f)).join(', ')
  console.log(`${hit.length === 0 ? 'MISS ' : 'HIT  '} ${kw}  [srv:${server} web:${web}]  ${sample}`)
}
