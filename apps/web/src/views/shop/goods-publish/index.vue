<script setup lang="ts">
import SimpleRecordPage from '@/components/SimpleRecordPage.vue'
import { createGoodsMap, fetchGoodsMaps, syncGoodsMap } from '@/api/shop'

const columns = [
  { prop: 'id', label: 'ID', width: '80' },
  { prop: 'platformGoodsId', label: '平台商品ID', width: '140' },
  { prop: 'productId', label: 'ERP产品ID', width: '120' },
  { prop: 'syncStatus', label: '同步状态', width: '120' }
]
const fields = [
  { key: 'platformGoodsId', label: '平台商品ID' },
  { key: 'productId', label: 'ERP产品ID', type: 'number' as const }
]
const actions = [{ label: '发布同步', call: (row: any) => syncGoodsMap(row.id) }]
const fetcher = async (params: Record<string, unknown>) => {
  const result = await fetchGoodsMaps(params as any)
  return { list: result.list, total: result.total }
}
</script>

<template>
  <SimpleRecordPage title="商品发布" description="维护平台商品与 ERP SKU 映射，并发起价格库存同步。" :columns="columns" :fields="fields" :actions="actions" :fetcher="fetcher" :creator="createGoodsMap" />
</template>
