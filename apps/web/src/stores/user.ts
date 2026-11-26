import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as authApi from '@/api/auth'
import { ACCESS_TOKEN_KEY } from '@/utils/http'
import type { MenuItem, UserProfile } from '@/types/contract'

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(sessionStorage.getItem(ACCESS_TOKEN_KEY))
  const profile = ref<UserProfile | null>(null)
  const permissions = ref<string[]>([])
  const menus = ref<MenuItem[]>([])
  const roles = ref<string[]>([])
  const loading = ref(false)

  const isLogged = computed(() => Boolean(token.value))

  function applyProfile(data: UserProfile): void {
    profile.value = data
    permissions.value = data.permissions ?? []
    roles.value = data.roles ?? []
  }

  async function login(payload: authApi.LoginPayload): Promise<void> {
    loading.value = true
    try {
      const result = await authApi.login(payload)
      token.value = result.accessToken
      sessionStorage.setItem(ACCESS_TOKEN_KEY, result.accessToken)
      applyProfile(result.user)
      menus.value = result.menus
    } finally {
      loading.value = false
    }
  }

  async function bootstrap(): Promise<void> {
    if (!token.value) {
      return
    }
    loading.value = true
    try {
      const [profileData, menuData] = await Promise.all([authApi.fetchProfile(), authApi.fetchMenus()])
      applyProfile(profileData)
      menus.value = menuData
    } finally {
      loading.value = false
    }
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout()
    } catch {
      // 本地会话始终清理，避免后端不可用时用户无法退出。
    }
    token.value = null
    profile.value = null
    permissions.value = []
    roles.value = []
    menus.value = []
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  }

  function hasPerm(value: string | string[]): boolean {
    const required = Array.isArray(value) ? value : [value]
    if (required.length === 0) {
      return true
    }
    return required.some((perm) => {
      if (permissions.value.includes('*:*')) {
        return true
      }
      if (permissions.value.includes(perm)) {
        return true
      }
      const module = perm.split(':')[0]
      return Boolean(module) && permissions.value.includes(`${module}:*`)
    })
  }

  return {
    token,
    profile,
    permissions,
    menus,
    roles,
    loading,
    isLogged,
    login,
    bootstrap,
    logout,
    hasPerm
  }
})
