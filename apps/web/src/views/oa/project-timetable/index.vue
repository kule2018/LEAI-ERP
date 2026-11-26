<script setup lang="ts">
import SimpleRecordPage from '@/components/SimpleRecordPage.vue'
import { createWorklog, fetchWorklogs } from '@/api/project-ops'

const columns = [
  { prop: 'id', label: 'ID', width: '80' },
  { prop: 'taskId', label: '任务ID', width: '100' },
  { prop: 'workDate', label: '日期', width: '120' },
  { prop: 'hours', label: '工时', width: '90' },
  { prop: 'note', label: '说明' }
]
const fields = [
  { key: 'taskId', label: '任务ID', type: 'number' as const },
  { key: 'hours', label: '工时', type: 'number' as const },
  { key: 'workDate', label: '日期' },
  { key: 'note', label: '说明', type: 'textarea' as const }
]
const fetcher = async (params: Record<string, unknown>) => {
  const result = await fetchWorklogs(params as any)
  return { list: result.list, total: result.total }
}
</script>

<template>
  <SimpleRecordPage title="项目时间表" description="按任务登记工时，形成项目时间线与负荷视图。" :columns="columns" :fields="fields" :fetcher="fetcher" :creator="createWorklog" />
</template>
