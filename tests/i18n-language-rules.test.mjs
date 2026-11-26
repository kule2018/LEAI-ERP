import assert from 'node:assert/strict'
import test from 'node:test'

/** 优先使用编译产物，未编译时回退到 TypeScript 源码（Node 原生类型擦除） */
const rules = await import('../apps/server/dist/common/i18n-rules.js')
  .catch(() => import('../apps/server/src/common/i18n-rules.ts'))

const {
  buildLanguagePackage,
  diffLanguagePackage,
  isValidLangCode,
  isValidResourceKey,
  mergeFallback,
  validateLangEntries
} = rules

test('语言编码校验', () => {
  assert.equal(isValidLangCode('zh_CN'), true)
  assert.equal(isValidLangCode('en_US'), true)
  assert.equal(isValidLangCode('zh'), false)
  assert.equal(isValidLangCode('ZH_cn'), false)
})

test('资源键校验', () => {
  assert.equal(isValidResourceKey('common.action.confirm'), true)
  assert.equal(isValidResourceKey('a'), false)
  assert.equal(isValidResourceKey('bad key!'), false)
})

test('语言包聚合忽略非法条目', () => {
  const pkg = buildLanguagePackage([
    { langCode: 'zh_CN', resourceKey: 'a.b', resourceValue: '值' },
    { langCode: 'zh_CN', resourceKey: 'bad key', resourceValue: 'x' },
    { langCode: 'ZH', resourceKey: 'c.d', resourceValue: 'x' }
  ])
  assert.deepEqual(pkg.values, { 'a.b': '值' })
})

test('fallback 合并补齐缺失键', () => {
  const base = buildLanguagePackage([
    { langCode: 'en_US', resourceKey: 'a.b', resourceValue: 'B' },
    { langCode: 'en_US', resourceKey: 'c.d', resourceValue: '' }
  ])
  const fallback = buildLanguagePackage([
    { langCode: 'zh_CN', resourceKey: 'a.b', resourceValue: '甲' },
    { langCode: 'zh_CN', resourceKey: 'c.d', resourceValue: '丙' }
  ])
  const merged = mergeFallback(base, fallback)
  assert.equal(merged.values['a.b'], 'B')
  assert.equal(merged.values['c.d'], '丙')
})

test('语言包差异比较', () => {
  const diff = diffLanguagePackage({ a: '1', b: '2' }, { a: '9', c: '3' })
  assert.deepEqual(diff.added, ['c'])
  assert.deepEqual(diff.updated, ['a'])
  assert.deepEqual(diff.removed, ['b'])
  assert.deepEqual(diff.changedKeys, ['a'])
})

test('批量条目校验', () => {
  assert.equal(validateLangEntries([]).ok, false)
  assert.equal(validateLangEntries([{ langCode: 'zh_CN', resourceKey: 'a.b', resourceValue: 'x' }]).ok, true)
  assert.equal(validateLangEntries([{ langCode: 'ZH', resourceKey: 'a.b', resourceValue: 'x' }]).ok, false)
})
