<script setup lang="ts">
import SimpleRecordPage from '@/components/SimpleRecordPage.vue'
import { fetchTodo } from '@/api/collaboration'

const columns = [
  { prop: 'id', label: 'ID', width: '80' },
  { prop: 'instanceId', label: '流程实例', width: '110' },
  { prop: 'title', label: '事项' },
  { prop: 'status', label: '状态', width: '110' }
]
const fetcher = async (params: Record<string, unknown>) => {
  const result = await fetchTodo(params as any)
  return { list: result.list, total: result.total }
}
</script>

<template>
  <SimpleRecordPage title="流程追回" description="从待办流程中定位可追回的审批事项。" :columns="columns" :fetcher="fetcher" />
</template>
