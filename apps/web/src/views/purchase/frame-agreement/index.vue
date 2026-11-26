<script setup lang="ts">
import SimpleRecordPage from '@/components/SimpleRecordPage.vue'
import { createFrameAgreement, listFrameAgreements } from '@/api/purchase-extension'

const columns = [
  { prop: 'id', label: 'ID', width: '80' },
  { prop: 'code', label: '协议编号', width: '140' },
  { prop: 'supplierId', label: '供应商ID', width: '110' },
  { prop: 'version', label: '版本', width: '90' },
  { prop: 'status', label: '状态', width: '110' }
]
const fields = [
  { key: 'code', label: '协议编号' },
  { key: 'supplierId', label: '供应商ID', type: 'number' as const },
  { key: 'terms', label: '协议条款', type: 'textarea' as const }
]
const fetcher = async (params: Record<string, unknown>) => {
  const result: any = await listFrameAgreements(params)
  const list = Array.isArray(result) ? result : (result?.list ?? [])
  return { list, total: result?.total ?? list.length }
}
</script>

<template>
  <SimpleRecordPage title="采购框架协议" description="维护框架协议、版本与价格有效期，支持到期提醒。" :columns="columns" :fields="fields" :fetcher="fetcher" :creator="createFrameAgreement" />
</template>
