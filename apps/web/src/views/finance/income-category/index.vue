<script setup lang="ts">
import SimpleRecordPage from '@/components/SimpleRecordPage.vue'
import { createCategory, fetchCategories } from '@/api/finance-tax'

const columns = [
  { prop: 'id', label: 'ID', width: '80' },
  { prop: 'code', label: '编码', width: '130' },
  { prop: 'name', label: '类别名称' },
  { prop: 'categoryType', label: '类型', width: '110' }
]
const fields = [
  { key: 'code', label: '编码' },
  { key: 'name', label: '类别名称' }
]
const fetcher = async () => {
  const list = await fetchCategories('INCOME')
  return { list, total: list.length }
}
const creator = async (data: Record<string, unknown>) => createCategory({ ...data, categoryType: 'INCOME' })
</script>

<template>
  <SimpleRecordPage title="收入类别" description="费用与收入共用类别表，按 categoryType 区分。" :columns="columns" :fields="fields" :fetcher="fetcher" :creator="creator" />
</template>
