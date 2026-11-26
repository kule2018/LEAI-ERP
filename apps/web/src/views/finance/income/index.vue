<script setup lang="ts">
import SimpleRecordPage from '@/components/SimpleRecordPage.vue'
import { createReceipt, fetchReceipts } from '@/api/finance'

const columns = [
  { prop: 'id', label: 'ID', width: '80' },
  { prop: 'receiptNo', label: '单据号', width: '150' },
  { prop: 'customerId', label: '客户ID', width: '110' },
  { prop: 'amount', label: '金额', width: '120' },
  { prop: 'status', label: '状态', width: '110' }
]
const fields = [
  { key: 'customerId', label: '客户ID', type: 'number' as const },
  { key: 'amount', label: '收入金额', type: 'number' as const },
  { key: 'remark', label: '说明', type: 'textarea' as const }
]
const fetcher = async (params: Record<string, unknown>) => {
  const result = await fetchReceipts(params as any)
  return { list: result.list, total: result.total }
}
</script>

<template>
  <SimpleRecordPage title="收入单" description="新建收入与收入列表，数据来源于收款单据，可按类别统计。" :columns="columns" :fields="fields" :fetcher="fetcher" :creator="createReceipt" />
</template>
