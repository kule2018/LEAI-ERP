<script setup lang="ts">
import { onMounted, type ComputedRef, type Ref } from 'vue'
import ColumnSetting from './ColumnSetting.vue'
import FavoriteButton from './FavoriteButton.vue'
import type { GridColumn, GridDensity, ViewConfigState } from '@/types/contract'

/** useViewConfig 返回值的最小契约，便于列表页统一接入 */
export interface ViewConfigLike {
  visibleProps: Ref<string[]>
  visibleColumns: ComputedRef<GridColumn[]>
  state: Ref<ViewConfigState>
  density: ComputedRef<GridDensity>
  widths: ComputedRef<Record<string, number>>
  load: () => Promise<void>
  saveColumns: (props: string[]) => Promise<void>
  save: (next: Partial<ViewConfigState>) => Promise<void>
  setDensity: (value: GridDensity) => Promise<void>
  setWidth: (prop: string, width: number) => Promise<void>
  reset: () => Promise<void>
}

const props = defineProps<{
  pageKey: string
  columns: GridColumn[]
  view: ViewConfigLike
  /** 收藏显示名 */
  title?: string
  /** 收藏路由 */
  route?: string
}>()

onMounted(() => {
  void props.view.load()
})

function handleColumnsChange(next: string[]): void {
  void props.view.saveColumns(next)
}

function handleMove(payload: { prop: string; offset: number }): void {
  const order = [...props.view.state.value.columns]
  const index = order.indexOf(payload.prop)
  if (index === -1) return
  const target = index + payload.offset
  if (target < 0 || target >= order.length) return
  order.splice(index, 1)
  order.splice(target, 0, payload.prop)
  void props.view.save({ columns: order })
}

function handleDensityChange(value: GridDensity): void {
  void props.view.setDensity(value)
}

function handleWidthChange(payload: { prop: string; width: number }): void {
  void props.view.setWidth(payload.prop, payload.width)
}

function handleReset(): void {
  void props.view.reset()
}
</script>

<template>
  <div class="view-config-toolbar">
    <ColumnSetting
      :page-key="props.pageKey"
      :columns="props.columns"
      :model-value="props.view.visibleProps.value"
      :density="props.view.density.value"
      :widths="props.view.widths.value"
      :state="props.view.state.value"
      @update:model-value="handleColumnsChange"
      @move="handleMove"
      @density-change="handleDensityChange"
      @width-change="handleWidthChange"
      @reset="handleReset"
    />
    <FavoriteButton
      v-if="props.route"
      target-type="PAGE"
      :target-key="props.pageKey"
      :title="props.title ?? props.pageKey"
      :route="props.route"
    />
  </div>
</template>

<style scoped>
.view-config-toolbar {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>
