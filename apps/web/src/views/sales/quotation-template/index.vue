<script setup lang="ts">
import SimpleRecordPage from '@/components/SimpleRecordPage.vue'
import { createQuotationTemplate, fetchQuotationTemplates } from '@/api/page-gaps'

const columns = [
  { prop: 'id', label: 'ID', width: '80' },
  { prop: 'code', label: '模板编码', width: '140' },
  { prop: 'name', label: '模板名称' },
  { prop: 'status', label: '状态', width: '100' }
]
const fields = [
  { key: 'code', label: '模板编码' },
  { key: 'name', label: '模板名称' },
  { key: 'content', label: '条款内容', type: 'textarea' as const }
]
const fetcher = async (_params: Record<string, unknown>) => {
  const list = await fetchQuotationTemplates()
  return { list, total: list.length }
}
</script>

<template>
  <SimpleRecordPage title="报价模板" description="管理可复用的报价条款与模板，支持版本对比和审批。" :columns="columns" :fields="fields" :fetcher="fetcher" :creator="createQuotationTemplate" />
</template>
