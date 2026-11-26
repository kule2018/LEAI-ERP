<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, Close } from '@element-plus/icons-vue'
import { clearSearchHistory, fetchSearchHistory, recordSearchKeyword, type QuickSearchLog } from '@/api/user-preference'
import { useUserStore } from '@/stores/user'
import type { MenuItem } from '@/types/contract'

const router = useRouter()
const userStore = useUserStore()

const keyword = ref('')
const history = ref<QuickSearchLog[]>([])
const panelVisible = ref(false)
const inputRef = ref<{ focus: () => void } | null>(null)

/** 扁平化菜单，用于关键词匹配跳转 */
const menuEntries = computed(() => {
  const result: { title: string; path: string }[] = []
  const walk = (items: MenuItem[]): void => {
    for (const item of items ?? []) {
      if (item.hidden) continue
      if (item.path) result.push({ title: item.title, path: item.path })
      walk(item.children ?? [])
    }
  }
  walk(userStore.menus)
  return result
})

interface SearchSuggestion {
  label: string
  count: number
  path: string | null
}

const suggestions = computed<SearchSuggestion[]>(() => {
  const text = keyword.value.trim().toLowerCase()
  if (!text) {
    return history.value.map((item) => ({ label: item.keyword, count: item.count, path: null }))
  }
  return menuEntries.value
    .filter((item) => item.title.toLowerCase().includes(text))
    .slice(0, 8)
    .map((item) => ({ label: item.title, count: 0, path: item.path }))
})

async function loadHistory(): Promise<void> {
  try {
    history.value = await fetchSearchHistory(10)
  } catch {
    history.value = []
  }
}

function focusInput(): void {
  inputRef.value?.focus()
  panelVisible.value = true
  void loadHistory()
}

function isEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  return target.isContentEditable
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  const isCombo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'
  const isSlash = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey
  if (!isCombo && !isSlash) return
  if (isSlash && isEditingTarget(event.target)) return
  event.preventDefault()
  focusInput()
}

async function submit(): Promise<void> {
  const text = keyword.value.trim()
  if (!text) return
  try {
    await recordSearchKeyword(text)
  } catch {
    // 历史记录失败不阻断搜索
  }
  await loadHistory()
  window.dispatchEvent(new CustomEvent('erp:quick-search', { detail: text }))
  const matched = menuEntries.value.find((item) => item.title.toLowerCase() === text.toLowerCase())
    ?? menuEntries.value.find((item) => item.title.toLowerCase().includes(text.toLowerCase()))
  if (matched) {
    panelVisible.value = false
    keyword.value = ''
    await router.push(matched.path)
    return
  }
  ElMessage.info(`已记录搜索关键词「${text}」，未匹配到功能菜单`)
}

function applySuggestion(item: SearchSuggestion): void {
  keyword.value = item.label
  panelVisible.value = false
  if (item.path) {
    void router.push(item.path)
    keyword.value = ''
    return
  }
  void submit()
}

async function handleClear(): Promise<void> {
  try {
    await clearSearchHistory()
  } catch {
    // 忽略
  }
  history.value = []
}

onMounted(() => {
  void loadHistory()
  window.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <div class="quick-search">
    <el-input
      ref="inputRef"
      v-model="keyword"
      class="quick-search-input"
      placeholder="搜索功能 / 关键词"
      clearable
      @focus="panelVisible = true"
      @keyup.enter="submit"
    >
      <template #prefix>
        <el-icon><Search /></el-icon>
      </template>
    </el-input>

    <div v-if="panelVisible" class="quick-search-panel">
      <div v-if="suggestions.length === 0" class="quick-search-empty">暂无匹配结果</div>
      <ul v-else class="quick-search-list">
        <li
          v-for="item in suggestions"
          :key="item.label"
          class="quick-search-item"
          @click="applySuggestion(item)"
        >
          <span class="quick-search-text">{{ item.label }}</span>
          <span v-if="item.count" class="quick-search-count">{{ item.count }} 次</span>
        </li>
      </ul>
      <div v-if="history.length > 0" class="quick-search-footer">
        <el-button text size="small" @click="handleClear">
          <el-icon><Close /></el-icon>
          清空历史
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quick-search {
  position: relative;
  width: 220px;
}

.quick-search-input {
  width: 100%;
}

.quick-search-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 2200;
  width: 280px;
  padding: 6px 0;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  box-shadow: 0 6px 18px rgb(0 0 0 / 12%);
}

.quick-search-list {
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 260px;
  overflow: auto;
}

.quick-search-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
}

.quick-search-item:hover {
  background: #f4f6fa;
}

.quick-search-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-search-count {
  color: #909399;
  font-size: 12px;
}

.quick-search-empty {
  padding: 10px 12px;
  color: #909399;
  font-size: 13px;
}

.quick-search-footer {
  padding: 4px 8px 0;
  border-top: 1px solid #f0f2f5;
}
</style>
