<script setup lang="ts">
import SimpleRecordPage from '@/components/SimpleRecordPage.vue'
import { fetchDictOptions } from '@/api/page-gaps'

const columns = [
  { prop: 'id', label: 'ID', width: '80' },
  { prop: 'dictLabel', label: '原因名称' },
  { prop: 'dictValue', label: '编码', width: '140' },
  { prop: 'status', label: '状态', width: '100' }
]
const fetcher = async (_params: Record<string, unknown>) => {
  const list = await fetchDictOptions('RETURN_REASON')
  return { list, total: list.length }
}
</script>

<template>
  <SimpleRecordPage title="退货原因" description="维护退货原因字典，销售退货与质检共用。" :columns="columns" :fetcher="fetcher" />
</template>
