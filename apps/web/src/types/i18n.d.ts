import 'vue'

declare module '@vue/runtime-core' {
  export interface ComponentCustomProperties {
    /** 轻量 i18n 翻译函数，等价于 locales 中的 translate */
    $t: (key: string, params?: Record<string, string | number>) => string
  }
}

export {}
