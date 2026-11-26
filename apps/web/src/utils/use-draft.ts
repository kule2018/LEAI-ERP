import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { deleteDraft, fetchDraft, saveDraft } from '@/api/user-preference'

export interface UseDraftOptions<T extends Record<string, unknown>> {
  /** 草稿键，建议 页面标识:业务标识 */
  draftKey: string
  /** 表单数据源（ref） */
  form: Ref<T>
  /** 自动保存间隔（毫秒），默认 5 秒 */
  interval?: number
  /** 关闭页面时是否提示未保存内容 */
  confirmLeave?: boolean
  /** 判断内容是否为空（空则不保存） */
  isEmpty?: (value: T) => boolean
}

/**
 * 表单草稿：自动把未提交内容保存到服务端（同时本地兜底），
 * 并在离开页面时提示「有未保存的内容」。
 */
export function useDraft<T extends Record<string, unknown>>(options: UseDraftOptions<T>) {
  const dirty = ref(false)
  const restored = ref(false)
  const localKey = `draft:${options.draftKey}`
  let timer: number | null = null

  const defaultEmpty = (value: T): boolean => Object.values(value ?? {}).every((item) => {
    if (item === null || item === undefined || item === '') return true
    if (Array.isArray(item)) return item.length === 0
    return false
  })
  const isEmpty = options.isEmpty ?? defaultEmpty

  async function loadDraft(): Promise<void> {
    try {
      const remote = await fetchDraft(options.draftKey)
      const content = remote?.content ?? null
      const local = localStorage.getItem(localKey)
      const source = content ?? (local ? (JSON.parse(local) as T) : null)
      if (source && Object.keys(source).length) {
        options.form.value = { ...options.form.value, ...(source as T) }
        restored.value = true
      }
    } catch {
      // 草稿读取失败不影响页面
    }
  }

  async function persist(): Promise<void> {
    if (isEmpty(options.form.value)) return
    try {
      localStorage.setItem(localKey, JSON.stringify(options.form.value))
      await saveDraft(options.draftKey, options.form.value as Record<string, unknown>)
      dirty.value = false
    } catch {
      // 草稿保存失败不阻塞编辑
    }
  }

  /** 提交成功后清除草稿 */
  async function clear(): Promise<void> {
    dirty.value = false
    localStorage.removeItem(localKey)
    try {
      await deleteDraft(options.draftKey)
    } catch {
      // 忽略清理失败
    }
  }

  function handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (!dirty.value) return
    event.preventDefault()
    event.returnValue = ''
  }

  onMounted(() => {
    void loadDraft()
    window.addEventListener('beforeunload', handleBeforeUnload)
    timer = window.setInterval(() => {
      if (dirty.value) void persist()
    }, options.interval ?? 5000)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
    if (timer) window.clearInterval(timer)
    if (dirty.value) void persist()
  })

  watch(
    () => options.form.value,
    () => {
      dirty.value = true
    },
    { deep: true }
  )

  if (options.confirmLeave !== false) {
    onBeforeRouteLeave(async () => {
      if (!dirty.value) return true
      try {
        await ElMessageBox.confirm('当前页面有未保存的内容，确认离开？草稿会保留，可稍后继续。', '离开确认', {
          confirmButtonText: '离开',
          cancelButtonText: '继续编辑',
          type: 'warning'
        })
        return true
      } catch {
        return false
      }
    })
  }

  return { dirty, restored, persist, clear, loadDraft }
}
