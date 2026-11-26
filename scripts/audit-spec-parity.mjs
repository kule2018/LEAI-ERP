#!/usr/bin/env node
/**
 * 规范一比一核查器：解析《ERP业务功能扩展与增强规范.md》表格中的「扩展/新增功能」列，
 * 拆解为子能力后到源码中检索实现痕迹，输出疑似缺失清单（供人工复核）。
 *
 * 用法：node scripts/audit-spec-parity.mjs [输出文件]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const root = process.cwd()
const specPath = join(root, 'docs', 'ERP业务功能扩展与增强规范.md')
const outPath = process.argv[2] ? join(root, process.argv[2]) : join(root, 'docs', 'spec-parity-report.md')

const SCAN_DIRS = ['apps/server/src', 'apps/web/src', 'apps/web/src/views', 'apps/web/src/api']
const CODE_EXT = new Set(['.ts', '.tsx', '.vue', '.js', '.mjs'])
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage'])

/** 过于通用的词，命中不代表能力落地 */
const GENERIC = new Set([
  '数据', '记录', '列表', '查看', '编辑', '新增', '导出', '导入', '校验', '状态', '日志', '页面', '按钮',
  '接口', '流程', '配置', '字段', '历史', '详情', '操作', '结果', '信息', '内容', '数量', '时间', '名称',
  '类型', '状态机', '设计', '支持', '提供', '实现', '其他', '相关', '对应', '所有', '以及', '并且', '以及'
])

function collectFiles(dir, acc = []) {
  let entries = []
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) collectFiles(full, acc)
    else if (CODE_EXT.has(extname(entry))) acc.push(full)
  }
  return acc
}

const corpus = []
for (const dir of SCAN_DIRS) {
  for (const file of collectFiles(join(root, dir))) {
    corpus.push({ file: file.slice(root.length + 1), text: readFileSync(file, 'utf8') })
  }
}

const corpusText = corpus.map((c) => c.text).join('\n').toLowerCase()

/** 收集源码中出现过的中文词（2-6 字），用于匹配子能力关键词 */
function chineseTokens(text) {
  const tokens = new Set()
  const re = /[\u4e00-\u9fa5]{2,6}/g
  let m
  while ((m = re.exec(text))) tokens.add(m[0])
  return tokens
}
const sourceTokens = chineseTokens(corpusText)

function splitSubItems(cell) {
  return cell
    .split(/[、；;，,]|\s*\/\s*/)
    .map((s) => s.replace(/[`*()（）]/g, '').trim())
    .filter(Boolean)
}

/** 判断子能力是否在源码中出现 */
function matchItem(item) {
  const chars = [...item.replace(/[^一-龥A-Za-z0-9]/g, '')]
  if (chars.length === 0) return { hit: true, evidence: '空' }
  const candidates = []
  if (chars.length >= 4) {
    // 取头尾各一个 3 字词 + 中间 2 字词，覆盖「XX管理」「XX看板」等构词
    candidates.push(chars.slice(0, 3).join(''), chars.slice(-3).join(''))
    for (let i = 0; i + 2 <= chars.length; i += 2) candidates.push(chars.slice(i, i + 2).join(''))
  } else {
    candidates.push(chars.join(''))
  }
  const meaningful = candidates.filter((c) => !GENERIC.has(c))
  const pool = meaningful.length ? meaningful : candidates
  for (const c of pool) {
    if (sourceTokens.has(c)) return { hit: true, evidence: c }
  }
  return { hit: false, evidence: '' }
}

const spec = readFileSync(specPath, 'utf8')
const lines = spec.split(/\r?\n/)
const report = []
let chapter = ''
let totalItems = 0
let hitItems = 0
const missing = []

for (const line of lines) {
  const chapterMatch = /^##\s+(.+)$/.exec(line)
  if (chapterMatch) {
    chapter = chapterMatch[1].trim()
    report.push(`\n## ${chapter}`)
    continue
  }
  const trimmed = line.trim()
  if (!trimmed.startsWith('|') || trimmed.startsWith('|---')) continue
  const cells = trimmed.split('|').slice(1, -1).map((c) => c.trim())
  if (cells.length < 2) continue
  const feature = cells[0]
  const itemsCell = cells[1]
  const priority = cells[cells.length - 1]
  if (!feature || feature === '原页面/功能' || feature === '能力' || feature === '原页面/功能或能力') continue
  if (!/[一-龥]/.test(itemsCell)) continue

  const items = splitSubItems(itemsCell)
  const missed = []
  for (const item of items) {
    totalItems += 1
    const res = matchItem(item)
    if (res.hit) hitItems += 1
    else missed.push(item)
  }
  if (missed.length) {
    report.push(`- **${feature}**（${priority}）｜${itemsCell}`)
    report.push(`  - 疑似缺失：${missed.join('、')}`)
    missing.push({ chapter, feature, priority, missed })
  }
}

const summary = [
  `# 规范一比一核查报告（自动筛查）`,
  ``,
  `- 生成时间：${new Date().toISOString()}`,
  `- 子能力总数：${totalItems}`,
  `- 源码命中：${hitItems}`,
  `- 疑似缺失：${totalItems - hitItems}`,
  ``,
  `> 本报告由关键词筛查生成，用于定位「值得人工复核」的候选；命中不等于功能完备，未命中可能为命名差异。`,
  ``
].join('\n')

writeFileSync(outPath, `${summary}${report.join('\n')}\n`, 'utf8')
console.log(`子能力 ${totalItems}，命中 ${hitItems}，疑似缺失 ${totalItems - hitItems}`)
console.log(`报告：${outPath.slice(root.length + 1)}`)
