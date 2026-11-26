<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { Connection, Fold, Expand, Refresh, SwitchButton } from '@element-plus/icons-vue'
import MenuItem from './MenuItem.vue'
import LocaleSwitcher from '@/components/LocaleSwitcher.vue'
import QuickSearch from '@/components/QuickSearch.vue'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import { resetDynamicRoutes } from '@/router'
import { offlineFormSummary } from '@/utils/offline-form'
import { fetchLangPackages } from '@/api/system-lang'
import { useI18n, type LocaleCode } from '@/locales'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()
const { t, mergeLocaleMessages } = useI18n()

interface TabItem { path: string; title: string }

const activeMenu = computed(() => route.path)
const pageTitle = computed(() => String(route.meta.title ?? '工作台'))
const breadcrumbs = computed(() => route.matched.map((item) => String(item.meta.title ?? '')).filter(Boolean))
const menus = computed(() => userStore.menus)
const userName = computed(() => userStore.profile?.realName || userStore.profile?.username || '未登录')
const visitedTabs = ref<TabItem[]>([])
const isDark = ref(false)

watch(
  () => route.fullPath,
  () => {
    if (route.meta.public === true || route.path === '/login') return
    const title = String(route.meta.title ?? pageTitle.value)
    if (!visitedTabs.value.some((item) => item.path === route.fullPath)) {
      visitedTabs.value.push({ path: route.fullPath, title })
    }
  },
  { immediate: true }
)

const offlineSummary = ref({ total: 0, pending: 0, conflict: 0, failed: 0 })
const offlineTip = computed(() => {
  if (offlineSummary.value.total === 0) return t('common.tips.offlineEmpty')
  const parts = [`待同步 ${offlineSummary.value.pending}`]
  if (offlineSummary.value.conflict > 0) parts.push(`待核对 ${offlineSummary.value.conflict}`)
  if (offlineSummary.value.failed > 0) parts.push(`失败 ${offlineSummary.value.failed}`)
  return `离线表单：${parts.join(' / ')}`
})

let offlineTimer: number | undefined

function refreshOfflineSummary(): void {
  offlineSummary.value = offlineFormSummary()
}

onMounted(() => {
  refreshOfflineSummary()
  offlineTimer = window.setInterval(refreshOfflineSummary, 15000)
  void loadLocaleOverrides()
})

/** 加载后端语言包覆盖（无权限或失败时静默降级为内置语言包） */
async function loadLocaleOverrides(): Promise<void> {
  try {
    const packages = await fetchLangPackages()
    for (const item of packages) {
      if (item.langCode === 'zh_CN' || item.langCode === 'en_US') {
        mergeLocaleMessages(item.langCode as LocaleCode, item.values)
      }
    }
  } catch {
    // 忽略：使用内置语言包
  }
}

onUnmounted(() => {
  if (offlineTimer) window.clearInterval(offlineTimer)
})

function handleMenuSelect(index: string): void {
  void router.push(index)
}

function handleTabClick(pane: { name?: string | number }): void {
  if (pane.name) void router.push(String(pane.name))
}

function closeTab(name: string | number): void {
  const path = String(name)
  const index = visitedTabs.value.findIndex((item) => item.path === path)
  if (index >= 0) visitedTabs.value.splice(index, 1)
  if (route.fullPath === path) {
    const next = visitedTabs.value[index] ?? visitedTabs.value[index - 1]
    void router.push(next?.path ?? '/dashboard')
  }
}

function closeAllTabs(): void {
  visitedTabs.value = []
  if (route.path !== '/dashboard') {
    void router.push('/dashboard')
    return
  }
  visitedTabs.value.push({ path: route.fullPath, title: pageTitle.value || '工作台' })
}

function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen()
  else void document.documentElement.requestFullscreen()
}

function toggleTheme(): void {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
}

async function openHelp(): Promise<void> {
  await ElMessageBox.alert('请使用左侧菜单进入业务模块；列表页支持查询收起、导出与打印。遇到问题请联系系统管理员。', '帮助', { confirmButtonText: '知道了' })
}

function handleCommand(command: string): void {
  if (command === 'logout') {
    void handleLogout()
  }
}

async function handleLogout(): Promise<void> {
  await ElMessageBox.confirm(t('common.tips.logoutConfirm'), t('common.tips.confirm'), { type: 'warning' })
  await userStore.logout()
  resetDynamicRoutes()
  await router.replace('/login')
}
</script>

<template>
  <el-container class="main-layout">
    <el-aside :width="appStore.sidebarCollapsed ? '64px' : '220px'" class="main-sidebar">
      <div class="brand">
        <span v-if="!appStore.sidebarCollapsed">LEAI ERP</span>
        <span v-else>LE</span>
      </div>
      <div class="menu-scroll">
        <el-menu
          :default-active="activeMenu"
          :collapse="appStore.sidebarCollapsed"
          :unique-opened="true"
          background-color="#12161f"
          text-color="#c9d1d9"
          active-text-color="#ffffff"
          @select="handleMenuSelect"
        >
          <MenuItem :items="menus" />
        </el-menu>
      </div>
    </el-aside>

    <el-container class="main-content">
      <el-header class="main-header">
        <div class="header-left">
          <el-button text class="header-icon" @click="appStore.toggleSidebar">
            <el-icon><component :is="appStore.sidebarCollapsed ? Expand : Fold" /></el-icon>
          </el-button>
          <el-breadcrumb separator="/" class="breadcrumb">
            <el-breadcrumb-item v-for="item in breadcrumbs" :key="item">{{ item }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div class="header-right">
          <el-button text size="small" @click="router.push('/finance/collection')">收账台</el-button>
          <el-button text size="small" @click="router.push('/system/notify')">通知</el-button>
          <el-button text size="small" @click="openHelp">帮助</el-button>
          <el-button text size="small" @click="router.push('/system/config')">设置</el-button>
          <el-button text size="small" @click="toggleFullscreen">全屏</el-button>
          <el-button text size="small" @click="toggleTheme">{{ isDark ? '亮色' : '暗色' }}</el-button>
          <QuickSearch />
          <el-tooltip :content="offlineTip" placement="bottom">
            <el-badge :value="offlineSummary.total" :hidden="offlineSummary.total === 0" type="warning">
              <el-button text class="header-icon" @click="router.push('/dashboard/offline-queue')">
                <el-icon><Connection /></el-icon>
              </el-button>
            </el-badge>
          </el-tooltip>
          <LocaleSwitcher />
          <el-button text class="header-icon" @click="router.go(0)">
            <el-icon><Refresh /></el-icon>
          </el-button>
          <el-dropdown @command="handleCommand">
            <span class="user-entry">
              <span class="user-avatar">{{ userName.slice(0, 1) }}</span>
              <span class="user-name">{{ userName }}</span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">
                  <el-icon><SwitchButton /></el-icon>
                  {{ t('common.action.logout') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="main-body">
        <div v-if="visitedTabs.length > 0" class="tabs-bar">
          <el-tabs
            :model-value="route.fullPath"
            type="card"
            closable
            class="page-tabs"
            @tab-click="handleTabClick"
            @tab-remove="closeTab"
          >
            <el-tab-pane v-for="tab in visitedTabs" :key="tab.path" :label="tab.title" :name="tab.path" />
          </el-tabs>
          <el-button class="tabs-close-all" link type="danger" size="small" @click="closeAllTabs">全部删除</el-button>
        </div>
        <router-view v-slot="{ Component }">
          <KeepAlive :max="20">
            <component :is="Component" :key="route.fullPath" />
          </KeepAlive>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.main-layout {
  width: 100%;
  height: 100%;
}

.main-sidebar {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--erp-color-sidebar);
  transition: width 0.2s ease;
}

.brand {
  display: flex;
  flex: 0 0 60px;
  align-items: center;
  justify-content: center;
  height: 60px;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
  border-bottom: 1px solid rgb(255 255 255 / 8%);
}

.menu-scroll {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgb(255 255 255 / 22%) transparent;
}

.menu-scroll::-webkit-scrollbar {
  width: 6px;
}

.menu-scroll::-webkit-scrollbar-thumb {
  background: rgb(255 255 255 / 22%);
  border-radius: 3px;
}

.menu-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.main-sidebar :deep(.el-menu) {
  border-right: none;
}

.main-sidebar :deep(.el-menu-item),
.main-sidebar :deep(.el-sub-menu__title) {
  height: 44px;
  line-height: 44px;
}

.main-content {
  min-width: 0;
}

.main-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
  padding: 0 var(--erp-space-4);
  background: #fff;
  border-bottom: 1px solid #e5e6eb;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: var(--erp-space-2);
}

.header-icon {
  width: 40px;
  height: 40px;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
}

.user-entry {
  display: flex;
  align-items: center;
  gap: var(--erp-space-2);
  min-height: 44px;
  padding: 0 var(--erp-space-2);
  cursor: pointer;
}

.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: #fff;
  background: var(--erp-color-primary);
  border-radius: 50%;
}

.user-name {
  font-size: 14px;
}

.breadcrumb {
  margin-left: var(--erp-space-2);
  font-size: 13px;
}

.tabs-bar {
  display: flex;
  align-items: center;
  background: #fff;
  padding-right: 12px;
}

.page-tabs {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 6px 12px 0;
  background: #fff;
}

.tabs-close-all {
  flex: none;
  white-space: nowrap;
}

.page-tabs :deep(.el-tabs__header) {
  margin-bottom: 8px;
}

.main-body {
  padding: 0;
  overflow: auto;
}

:global(html.dark) .main-header,
:global(html.dark) .page-tabs {
  background: #1f2430;
  border-color: #30363f;
}

:global(html.dark) .main-body {
  background: #12161f;
}
</style>
