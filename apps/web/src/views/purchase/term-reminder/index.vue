<script setup lang="ts">
import SimpleRecordPage from '@/components/SimpleRecordPage.vue'
import { fetchReminders } from '@/api/project-ops'

const columns = [
  { prop: 'id', label: 'ID', width: '80' },
  { prop: 'title', label: '提醒事项' },
  { prop: 'bizType', label: '业务类型', width: '120' },
  { prop: 'dueDate', label: '到期日', width: '120' },
  { prop: 'level', label: '级别', width: '100' }
]
const fetcher = async (params: Record<string, unknown>) => {
  const list = await fetchReminders({ ...params, type: 'PURCHASE_TERM' })
  return { list, total: list.length }
}
</script>

<template>
  <SimpleRecordPage title="采购条款提醒" description="合同与框架协议条款到期提醒，来自通用提醒中心。" :columns="columns" :fetcher="fetcher" />
</template>
