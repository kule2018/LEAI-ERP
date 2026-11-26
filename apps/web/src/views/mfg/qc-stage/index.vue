<script setup lang="ts">
import SimpleRecordPage from '@/components/SimpleRecordPage.vue'
import { createQc, fetchQcs } from '@/api/manufacturing'

const props = defineProps<{ stage: string; title: string }>()

const columns = [
  { prop: 'id', label: 'ID', width: '80' },
  { prop: 'qcNo', label: '检验单号', width: '150' },
  { prop: 'bizType', label: '业务类型', width: '120' },
  { prop: 'result', label: '检验结果', width: '120' }
]
const fields = [
  { key: 'bizType', label: '业务类型' },
  { key: 'bizId', label: '业务ID', type: 'number' as const },
  { key: 'sampleQty', label: '抽样数量', type: 'number' as const },
  { key: 'result', label: '检验结果' }
]
const fetcher = async (params: Record<string, unknown>) => {
  const result = await fetchQcs(params as any)
  const list = result.list.filter((item: any) => item.inspectionType === props.stage)
  return { list, total: list.length }
}
const creator = async (data: Record<string, unknown>) => createQc({ ...data, inspectionType: props.stage })
</script>

<template>
  <SimpleRecordPage :title="title" :description="`按 ${stage} 检验类型筛选的质检记录，支持抽样与让步接收。`" :columns="columns" :fields="fields" :fetcher="fetcher" :creator="creator" />
</template>
