<script setup lang="ts">
import SimpleRecordPage from '@/components/SimpleRecordPage.vue'
import { fetchWorklogs } from '@/api/project-ops'

const columns = [
  { prop: 'taskId', label: '任务ID', width: '100' },
  { prop: 'workDate', label: '日期', width: '120' },
  { prop: 'hours', label: '投入工时', width: '100' },
  { prop: 'note', label: '进展说明' }
]
const fetcher = async (params: Record<string, unknown>) => {
  const result = await fetchWorklogs(params as any)
  return { list: result.list, total: result.total }
}
</script>

<template>
  <SimpleRecordPage title="项目报告" description="以工时与进展记录汇总项目报告数据。" :columns="columns" :fetcher="fetcher" />
</template>
