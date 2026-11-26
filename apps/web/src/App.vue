<script setup lang="ts">
import { computed } from 'vue'
import elementEn from 'element-plus/es/locale/lang/en'
import elementZh from 'element-plus/es/locale/lang/zh-cn'
import { useI18n } from './locales'
import { initShortcuts } from '@/utils/shortcuts'

const { locale } = useI18n()

// 全局快捷键（N/S/Ctrl+Enter/P//）统一在此注册
initShortcuts()

// Element Plus 内置文案语言包跟随当前业务语言切换
const elementLocale = computed(() => (locale.value === 'en_US' ? elementEn : elementZh))
</script>

<template>
  <el-config-provider :locale="elementLocale">
    <router-view />
  </el-config-provider>
</template>
