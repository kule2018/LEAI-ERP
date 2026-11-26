<script setup lang="ts">
import { computed } from 'vue'
import type { BatchResult } from '@/types/contract'

const props = defineProps<{
  modelValue: boolean
  result: BatchResult | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const failedItems = computed(() => props.result?.items.filter((item) => !item.success) ?? [])

/** 导出失败明细为 CSV，便于线下修正 */
function exportFailed(): void {
  const rows = failedItems.value
  if (!rows.length) return
  const matrix: Array<Array<string | number>> = [
    ['ID', '结果', '说明'],
    ...rows.map((item) => [item.id, item.success ? '成功' : '失败', item.message ?? ''])
  ]
  const csv = matrix
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = '批量操作失败明细.csv'
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <el-dialog v-model="visible" title="批量操作结果" width="640px">
    <div v-if="result" class="batch-result">
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="总数">{{ result.total }}</el-descriptions-item>
        <el-descriptions-item label="成功">{{ result.succeeded }}</el-descriptions-item>
        <el-descriptions-item label="失败">{{ result.failed }}</el-descriptions-item>
      </el-descriptions>
      <el-table :data="result.items" size="small" border max-height="320" class="batch-result-table">
        <el-table-column prop="id" label="ID" width="90" />
        <el-table-column label="结果" width="90">
          <template #default="{ row }">
            <el-tag :type="row.success ? 'success' : 'danger'" size="small">
              {{ row.success ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="说明" show-overflow-tooltip />
      </el-table>
    </div>
    <template #footer>
      <el-button v-if="failedItems.length" @click="exportFailed">导出失败明细</el-button>
      <el-button type="primary" @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.batch-result-table {
  margin-top: var(--erp-space-3);
}
</style>
