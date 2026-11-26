<script setup lang="ts">
import SimpleRecordPage from '@/components/SimpleRecordPage.vue'
import { fetchDone } from '@/api/collaboration'

const columns = [
  { prop: 'id', label: 'ID', width: '80' },
  { prop: 'instanceId', label: '流程实例', width: '110' },
  { prop: 'title', label: '事项' },
  { prop: 'status', label: '状态', width: '110' }
]
const fetcher = async (params: Record<string, unknown>) => {
  const result = await fetchDone(params as any)
  return { list: result.list, total: result.total }
}
</script>

<template>
  <SimpleRecordPage title="流程抄送" description="抄送我的流程事项，来自已办流程记录。" :columns="columns" :fetcher="fetcher" />
</template>
