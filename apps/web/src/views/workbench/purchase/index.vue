<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchPurchaseOrders, fetchReceipts } from '@/api/purchase'

const orders = ref<any[]>([])
const receipts = ref<any[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const [orderResult, receiptResult] = await Promise.all([
      fetchPurchaseOrders({ page: 1, pageSize: 20 } as any),
      fetchReceipts({ page: 1, pageSize: 20 } as any)
    ])
    orders.value = orderResult.list
    receipts.value = receiptResult.list
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="board">
    <el-card shadow="never">
      <template #header><span class="title">采购看板</span></template>
      <div class="stats">
        <div class="stat"><span>采购订单</span><strong>{{ orders.length }}</strong></div>
        <div class="stat"><span>收货单</span><strong>{{ receipts.length }}</strong></div>
      </div>
      <el-table :data="orders" v-loading="loading" size="small" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="orderNo" label="采购单号" width="150" />
        <el-table-column prop="supplierId" label="供应商ID" width="110" />
        <el-table-column prop="totalAmount" label="金额" width="120" />
        <el-table-column prop="status" label="状态" width="110" />
      </el-table>
      <h4>最近收货</h4>
      <el-table :data="receipts" size="small" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="receiptNo" label="收货单号" width="150" />
        <el-table-column prop="status" label="状态" width="110" />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.title { font-weight: 600; }
.stats { display: flex; gap: 16px; margin-bottom: 16px; }
.stat { flex: 1; padding: 14px; background: #f7f8fa; border-radius: 6px; }
.stat span { display: block; color: #606266; font-size: 13px; }
.stat strong { font-size: 24px; }
h4 { margin: 16px 0 8px; }
</style>
