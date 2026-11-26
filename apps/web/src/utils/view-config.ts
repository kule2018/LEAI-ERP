import { computed, ref } from 'vue'
import { fetchViewConfig, saveViewConfig } from '@/api/user-preference'
import type { GridColumn, GridDensity, ViewConfigState } from '@/types/contract'

const DEFAULT_DENSITY: GridDensity = 'default'

function emptyState(columns: GridColumn[]): ViewConfigState {
  return {
    columns: columns.map((column) => column.prop),
    widths: {},
    density: DEFAULT_DENSITY,
    sort: null
  }
}

/**
 * 列表页视图配置：列显隐与顺序、列宽、行密度、默认排序统一持久化到服务端
 * （user_view_config）。列表页统一用 visibleColumns 渲染，配置加载失败时回落到默认列。
 */
export function useViewConfig(pageKey: string, defaultColumns: GridColumn[]) {
  const state = ref<ViewConfigState>(emptyState(defaultColumns))
  /** 可见列（可写，兼容 ColumnSetting 的 v-model 绑定） */
  const visibleProps = ref<string[]>(defaultColumns.map((column) => column.prop))
  const loaded = ref(false)

  /** 可见列：按配置顺序排列，并应用列宽 */
  const visibleColumns = computed<GridColumn[]>(() => {
    const order = state.value.columns.length ? state.value.columns : defaultColumns.map((column) => column.prop)
    const sorted = [...defaultColumns].sort((left, right) => {
      const leftIndex = order.indexOf(left.prop)
      const rightIndex = order.indexOf(right.prop)
      if (leftIndex === -1) return 1
      if (rightIndex === -1) return -1
      return leftIndex - rightIndex
    })
    return sorted
      .filter((column) => visibleProps.value.includes(column.prop))
      .map((column) => {
        const width = state.value.widths[column.prop]
        return width ? { ...column, width } : column
      })
  })

  const density = computed<GridDensity>(() => state.value.density ?? DEFAULT_DENSITY)
  const widths = computed(() => state.value.widths)
  const sort = computed(() => state.value.sort)

  async function persist(): Promise<void> {
    try {
      await saveViewConfig(pageKey, state.value as unknown as Record<string, unknown>)
    } catch {
      // 偏好保存失败不阻塞列表渲染
    }
  }

  async function load(): Promise<void> {
    try {
      const config = await fetchViewConfig(pageKey)
      const raw = (config ?? {}) as Partial<ViewConfigState>
      const savedColumns = Array.isArray(raw.columns)
        ? (raw.columns as unknown[]).filter((item): item is string => typeof item === 'string')
        : []
      state.value = {
        columns: savedColumns.length ? savedColumns : defaultColumns.map((column) => column.prop),
        widths: raw.widths && typeof raw.widths === 'object' ? raw.widths : {},
        density: raw.density ?? DEFAULT_DENSITY,
        sort: raw.sort ?? null
      }
      visibleProps.value = state.value.columns.filter((prop) => defaultColumns.some((column) => column.prop === prop))
      if (!visibleProps.value.length) visibleProps.value = defaultColumns.map((column) => column.prop)
    } catch {
      state.value = emptyState(defaultColumns)
      visibleProps.value = defaultColumns.map((column) => column.prop)
    } finally {
      loaded.value = true
    }
  }

  async function save(next: Partial<ViewConfigState>): Promise<void> {
    state.value = { ...state.value, ...next }
    await persist()
  }

  /** 仅保存列显隐与顺序（ColumnSetting 兼容入口） */
  async function saveColumns(props: string[]): Promise<void> {
    visibleProps.value = [...props]
    const order = state.value.columns.filter((prop) => props.includes(prop))
    for (const prop of props) if (!order.includes(prop)) order.push(prop)
    await save({ columns: order })
  }

  /** 恢复默认视图 */
  async function reset(): Promise<void> {
    state.value = emptyState(defaultColumns)
    visibleProps.value = defaultColumns.map((column) => column.prop)
    await persist()
  }

  /** 调整列顺序：把 prop 移动到目标位置 */
  async function moveColumn(prop: string, targetIndex: number): Promise<void> {
    const order = [...state.value.columns]
    const current = order.indexOf(prop)
    if (current === -1) return
    order.splice(current, 1)
    order.splice(Math.max(0, Math.min(targetIndex, order.length)), 0, prop)
    visibleProps.value = order.filter((item) => visibleProps.value.includes(item))
    await save({ columns: order })
  }

  /** 设置列宽 */
  async function setWidth(prop: string, width: number): Promise<void> {
    if (!Number.isFinite(width) || width <= 0) return
    await save({ widths: { ...state.value.widths, [prop]: Math.round(width) } })
  }

  /** 设置行密度 */
  async function setDensity(value: GridDensity): Promise<void> {
    await save({ density: value })
  }

  /** 设置默认排序 */
  async function setSort(prop: string, order: 'asc' | 'desc'): Promise<void> {
    await save({ sort: { prop, order } })
  }

  return {
    visibleProps,
    visibleColumns,
    state,
    loaded,
    load,
    save,
    saveColumns,
    reset,
    moveColumn,
    setWidth,
    setDensity,
    setSort,
    sort,
    density,
    widths
  }
}
