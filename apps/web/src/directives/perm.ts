import type { Directive } from 'vue'
import { useUserStore } from '@/stores/user'

function applyPermission(element: HTMLElement, value: unknown): void {
  const store = useUserStore()
  const required = typeof value === 'string' || Array.isArray(value) ? (value as string | string[]) : ''
  if (!store.hasPerm(required)) {
    element.remove()
  }
}

export const perm: Directive<HTMLElement, string | string[]> = {
  mounted(element, binding) {
    applyPermission(element, binding.value)
  },
  updated(element, binding) {
    applyPermission(element, binding.value)
  }
}
