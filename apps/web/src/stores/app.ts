import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', () => {
  const sidebarCollapsed = ref(false)
  const pageLoading = ref(false)

  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function setPageLoading(value: boolean): void {
    pageLoading.value = value
  }

  return {
    sidebarCollapsed,
    pageLoading,
    toggleSidebar,
    setPageLoading
  }
})
