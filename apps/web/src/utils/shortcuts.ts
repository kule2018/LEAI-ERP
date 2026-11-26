import { onBeforeUnmount } from 'vue'

export interface ShortcutHandlers {
  /** N：新建 */
  onNew?: () => void
  /** S：保存 */
  onSave?: () => void
  /** Ctrl/Cmd + Enter：提交 */
  onSubmit?: () => void
  /** P：打印 */
  onPrint?: () => void
  /** /：聚焦搜索框 */
  onSearch?: () => void
}

type HandlerKey = keyof ShortcutHandlers

const registry = new Map<string, ShortcutHandlers>()

/** 判断当前焦点是否在可输入元素内（输入框、文本域、下拉等） */
function isEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  return target.isContentEditable
}

function matchCombo(event: KeyboardEvent, key: HandlerKey): boolean {
  switch (key) {
    case 'onSubmit':
      return (event.ctrlKey || event.metaKey) && event.key === 'Enter'
    case 'onSearch':
      return event.key === '/' || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')
    default:
      return !event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === key.replace('on', '').toLowerCase()
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (isEditingTarget(event.target)) return
  // 从后注册的页面优先（后进先出）
  const entries = [...registry.entries()].reverse()
  for (const [id, handlers] of entries) {
    for (const key of Object.keys(handlers) as HandlerKey[]) {
      const handler = handlers[key]
      if (!handler) continue
      if (matchCombo(event, key)) {
        event.preventDefault()
        handler()
        return
      }
    }
    void id
  }
}

let initialized = false

/** 初始化全局快捷键监听（应用启动时调用一次） */
export function initShortcuts(): void {
  if (initialized) return
  initialized = true
  window.addEventListener('keydown', handleKeydown)
}

/** 页面级快捷键注册：组件内调用，随组件卸载自动注销 */
export function usePageShortcuts(handlers: ShortcutHandlers): void {
  const id = `sc-${Math.random().toString(36).slice(2)}`
  registry.set(id, handlers)
  onBeforeUnmount(() => {
    registry.delete(id)
  })
}

/** 供测试或动态场景直接触发 */
export function triggerShortcut(key: HandlerKey): void {
  const entries = [...registry.entries()].reverse()
  for (const [, handlers] of entries) {
    const handler = handlers[key]
    if (handler) {
      handler()
      return
    }
  }
}
