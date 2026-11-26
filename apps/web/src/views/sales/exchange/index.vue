<script setup lang="ts">
import SimpleRecordPage from '@/components/SimpleRecordPage.vue'
import { fetchReturns } from '@/api/sales'
import { exchangeReturn } from '@/api/sales-delivery'

const columns = [
  { prop: 'id', label: 'ID', width: '80' },
  { prop: 'returnNo', label: '退货单号', width: '160' },
  { prop: 'customerId', label: '客户ID', width: '110' },
  { prop: 'status', label: '状态', width: '120' }
]
const actions = [
  { label: '发起换货', call: (row: any) => exchangeReturn(row.id, { reason: '页面发起换货' }) }
]
const fetcher = async (params: Record<string, unknown>) => {
  const result = await fetchReturns(params as any)
  return { list: result.list, total: result.total }
}
</script>

<template>
  <SimpleRecordPage title="换货单" description="基于销售退货发起换货，换货记录与退货单关联留档。" :columns="columns" :actions="actions" :fetcher="fetcher" />
</template>
