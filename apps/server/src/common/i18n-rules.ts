/**
 * 多语言语言包规则：语言编码校验、语言包聚合与差异比较。
 */

export const LANG_CODE_PATTERN = /^[a-z]{2}_[A-Z]{2}$/

export interface LangEntry {
  langCode: string
  resourceKey: string
  resourceValue: string
  fallbackLang?: string | null
}

export interface LanguagePackage {
  langCode: string
  localeName: string
  values: Record<string, string>
  updatedAt?: string | null
}

/** 校验语言编码，如 zh_CN / en_US */
export function isValidLangCode(langCode: string): boolean {
  return LANG_CODE_PATTERN.test(langCode)
}

/** 校验资源键（形如 module.page.action，仅允许字母数字与点号下划线） */
export function isValidResourceKey(key: string): boolean {
  return /^[A-Za-z0-9_.:-]{2,200}$/.test(key)
}

/** 聚合某语言的键值包（同名键后者覆盖前者） */
export function buildLanguagePackage(entries: LangEntry[], localeNames?: Record<string, string>): LanguagePackage {
  const values: Record<string, string> = {}
  let updatedAt: string | null = null
  for (const entry of entries) {
    if (!isValidLangCode(entry.langCode)) continue
    if (!isValidResourceKey(entry.resourceKey)) continue
    values[entry.resourceKey] = entry.resourceValue
  }
  const langCode = entries[0]?.langCode ?? 'zh_CN'
  return {
    langCode,
    localeName: localeNames?.[langCode] ?? langCode,
    values,
    updatedAt
  }
}

/** 按 fallback 语言补齐缺失键 */
export function mergeFallback(base: LanguagePackage, fallback: LanguagePackage | null): LanguagePackage {
  if (!fallback) return base
  const values = { ...fallback.values }
  for (const [key, value] of Object.entries(base.values)) {
    if (value !== '' && value !== undefined) values[key] = value
  }
  return { ...base, values }
}

/** 比较当前语言包与目标语言包差异 */
export function diffLanguagePackage(current: Record<string, string>, incoming: Record<string, string>): {
  added: string[]
  updated: string[]
  removed: string[]
  changedKeys: string[]
} {
  const added: string[] = []
  const updated: string[] = []
  const removed: string[] = []
  const changedKeys: string[] = []
  for (const [key, value] of Object.entries(incoming)) {
    if (!(key in current)) added.push(key)
    else if (current[key] !== value) { updated.push(key); changedKeys.push(key) }
  }
  for (const key of Object.keys(current)) {
    if (!(key in incoming)) removed.push(key)
  }
  return { added, updated, removed, changedKeys }
}

/** 批量 upsert 输入校验 */
export function validateLangEntries(entries: LangEntry[]): { ok: boolean; reason?: string } {
  if (entries.length === 0) return { ok: false, reason: '语言条目不能为空' }
  if (entries.length > 2000) return { ok: false, reason: '单次最多导入 2000 条语言条目' }
  for (const entry of entries) {
    if (!isValidLangCode(entry.langCode)) return { ok: false, reason: `语言编码非法：${entry.langCode}` }
    if (!isValidResourceKey(entry.resourceKey)) return { ok: false, reason: `资源键非法：${entry.resourceKey}` }
    if (entry.resourceValue === undefined || entry.resourceValue === null) {
      return { ok: false, reason: `资源值缺失：${entry.resourceKey}` }
    }
    if (entry.resourceValue.length > 500) return { ok: false, reason: `资源值过长：${entry.resourceKey}` }
  }
  return { ok: true }
}
