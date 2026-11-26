<script setup lang="ts">
import { computed } from 'vue'
import { ChatDotRound } from '@element-plus/icons-vue'
import { LOCALE_OPTIONS, useI18n, type LocaleCode } from '@/locales'

const { locale, t, setLocale } = useI18n()

const current = computed(() => locale.value)

function handleCommand(command: string): void {
  setLocale(command as LocaleCode)
}
</script>

<template>
  <el-tooltip :content="t('locale.switch')" placement="bottom">
    <el-dropdown trigger="click" @command="handleCommand">
      <el-button text class="header-icon">
        <el-icon><ChatDotRound /></el-icon>
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="item in LOCALE_OPTIONS"
            :key="item.code"
            :command="item.code"
            :disabled="item.code === current"
          >
            {{ item.label }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </el-tooltip>
</template>
