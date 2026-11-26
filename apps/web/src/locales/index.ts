import { computed, reactive, type App, type ComputedRef } from 'vue'
import enUS from './en-US'
import jaJP from './ja-JP'
import zhCN from './zh-CN'
import zhTW from './zh-TW'

export type LocaleCode = 'zh_CN' | 'zh_TW' | 'en_US' | 'ja_JP'

export const LOCALE_OPTIONS: Array<{ code: LocaleCode; label: string }> = [
  { code: 'zh_CN', label: '简体中文' },
  { code: 'zh_TW', label: '繁體中文' },
  { code: 'en_US', label: 'English' },
  { code: 'ja_JP', label: '日本語' }
]

const STORAGE_KEY = 'erp-locale'

const builtIn: Record<LocaleCode, Record<string, string>> = {
  zh_CN: zhCN as Record<string, string>,
  zh_TW: zhTW as Record<string, string>,
  en_US: enUS as Record<string, string>,
  ja_JP: jaJP as Record<string, string>
}

const state = reactive({
  locale: (localStorage.getItem(STORAGE_KEY) as LocaleCode | null) ?? 'zh_CN',
  /** 后端语言包覆盖（key → value），按语言分别缓存 */
  overrides: {} as Record<LocaleCode, Record<string, string>>
})

function messagesOf(locale: LocaleCode): Record<string, string> {
  return { ...builtIn[locale], ...(state.overrides[locale] ?? {}) }
}

/** 翻译：支持 {name} 占位符，缺省回退到 key 本身 */
export function translate(locale: LocaleCode, key: string, params?: Record<string, string | number>): string {
  const dict = messagesOf(locale)
  const fallback = builtIn[locale]?.[key] ?? key
  const template = dict[key] ?? fallback
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    params[name] === undefined ? match : String(params[name])
  )
}

export function setLocale(locale: LocaleCode): void {
  state.locale = locale
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.setAttribute('lang', locale.replace('_', '-'))
}

/** 合并后端语言包 */
export function mergeLocaleMessages(locale: LocaleCode, values: Record<string, string>): void {
  state.overrides[locale] = { ...(state.overrides[locale] ?? {}), ...values }
}

/** 组合式 API */
export function useI18n(): {
  locale: ComputedRef<LocaleCode>
  t: (key: string, params?: Record<string, string | number>) => string
  setLocale: (locale: LocaleCode) => void
  mergeLocaleMessages: (locale: LocaleCode, values: Record<string, string>) => void
} {
  const locale = computed(() => state.locale)
  return {
    locale,
    t: (key: string, params?: Record<string, string | number>) => translate(state.locale, key, params),
    setLocale,
    mergeLocaleMessages
  }
}

/** 全局插件：注入 $t */
export function installI18n(app: App): void {
  app.config.globalProperties.$t = (key: string, params?: Record<string, string | number>): string =>
    translate(state.locale, key, params)
  setLocale(state.locale)
}

export default { install: installI18n, useI18n, translate, setLocale }
