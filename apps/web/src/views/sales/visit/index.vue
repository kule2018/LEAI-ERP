<script setup lang="ts">
import SimpleRecordPage from '@/components/SimpleRecordPage.vue'
import { createVisit, fetchVisits } from '@/api/sales-crm-extension'

const columns = [
  { prop: 'id', label: 'ID', width: '80' },
  { prop: 'customerId', label: '客户ID', width: '110' },
  { prop: 'visitType', label: '回访类型', width: '120' },
  { prop: 'content', label: '回访内容' },
  { prop: 'status', label: '状态', width: '110' }
]
const fields = [
  { key: 'customerId', label: '客户ID', type: 'number' as const },
  { key: 'visitType', label: '回访类型' },
  { key: 'content', label: '回访内容', type: 'textarea' as const }
]
const fetcher = async (params: Record<string, unknown>) => {
  const result = await fetchVisits(params)
  return { list: result.list, total: result.total }
}
</script>

<template>
  <SimpleRecordPage title="客户回访" description="记录客户回访计划与结果，支持回访汇总。" :columns="columns" :fields="fields" :fetcher="fetcher" :creator="createVisit" />
</template>
