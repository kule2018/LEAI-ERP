<script setup lang="ts">
import SimpleRecordPage from '@/components/SimpleRecordPage.vue'
import { createComplaint, fetchComplaints } from '@/api/sales-crm-extension'

const columns = [
  { prop: 'id', label: 'ID', width: '80' },
  { prop: 'title', label: '投诉标题' },
  { prop: 'customerId', label: '客户ID', width: '110' },
  { prop: 'status', label: '状态', width: '110' }
]
const fields = [
  { key: 'title', label: '投诉标题' },
  { key: 'customerId', label: '客户ID', type: 'number' as const },
  { key: 'content', label: '投诉内容', type: 'textarea' as const }
]
const fetcher = async (params: Record<string, unknown>) => {
  const result = await fetchComplaints(params)
  return { list: result.list, total: result.total }
}
</script>

<template>
  <SimpleRecordPage title="投诉工单" description="客户投诉登记、分派、处理与关闭，带 SLA 超时提醒。" :columns="columns" :fields="fields" :fetcher="fetcher" :creator="createComplaint" />
</template>
