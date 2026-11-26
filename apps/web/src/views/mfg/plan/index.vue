<script setup lang="ts">
import SimpleRecordPage from '@/components/SimpleRecordPage.vue'
import { createPlanTasks, fetchPlanTasks } from '@/api/manufacturing'

const columns = [
  { prop: 'id', label: 'ID', width: '80' },
  { prop: 'taskNo', label: '任务编号', width: '140' },
  { prop: 'productId', label: '产品ID', width: '110' },
  { prop: 'qty', label: '数量', width: '110' },
  { prop: 'status', label: '状态', width: '110' }
]
const fields = [
  { key: 'productId', label: '产品ID', type: 'number' as const },
  { key: 'qty', label: '计划数量', type: 'number' as const },
  { key: 'planStart', label: '计划开始' },
  { key: 'planEnd', label: '计划结束' }
]
const fetcher = async (params: Record<string, unknown>) => {
  const result = await fetchPlanTasks(params as any)
  return { list: result.list, total: result.total }
}
</script>

<template>
  <SimpleRecordPage title="生产计划" description="计划任务、需求汇总与排产甘特的数据来源。" :columns="columns" :fields="fields" :fetcher="fetcher" :creator="createPlanTasks" />
</template>
