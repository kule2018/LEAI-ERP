<script setup lang="ts">
/** 批量操作条：选中行后展示，支持自定义批量动作 */
export interface BatchAction {
  key: string
  label: string
  /** 权限标识，存在时按权限显示 */
  perm?: string
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'default'
}

defineProps<{
  count: number
  actions: BatchAction[]
  loading?: boolean
}>()

const emit = defineEmits<{
  action: [key: string]
  clear: []
}>()
</script>

<template>
  <div v-if="count > 0" class="batch-bar">
    <span class="batch-count">已选 {{ count }} 项</span>
    <el-button
      v-for="action in actions"
      :key="action.key"
      :type="action.type ?? 'default'"
      :loading="loading"
      size="small"
      @click="emit('action', action.key)"
    >
      {{ action.label }}
    </el-button>
    <el-button link size="small" @click="emit('clear')">取消选择</el-button>
  </div>
</template>

<style scoped>
.batch-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--erp-space-2);
  padding: var(--erp-space-2) var(--erp-space-3);
  margin-bottom: var(--erp-space-2);
  background: #f5f7fa;
  border: 1px solid #e5e6eb;
  border-radius: var(--erp-radius-base);
}

.batch-count {
  font-size: 13px;
  color: #1f2329;
}
</style>
