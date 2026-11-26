<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchBalances, fetchNegativeStock } from '@/api/inventory'

const balances = ref<any[]>([])
const negative = ref<any[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const [balanceResult, negativeResult] = await Promise.all([
      fetchBalances({ page: 1, pageSize: 20 } as any),
      fetchNegativeStock({ page: 1, pageSize: 20 } as any)
    ])
    balances.value = balanceResult.list
    negative.value = Array.isArray(negativeResult) ? negativeResult : ((negativeResult as any).list ?? [])
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="board">
    <el-card shadow="never">
      <template #header><span class="title">库存看板</span></template>
      <div class="stats">
        <div class="stat"><span>库存余额记录</span><strong>{{ balances.length }}</strong></div>
        <div class="stat"><span>负库存预警</span><strong class="warn">{{ negative.length }}</strong></div>
      </div>
      <el-table :data="balances" v-loading="loading" size="small" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="productId" label="产品ID" width="100" />
        <el-table-column prop="warehouseId" label="仓库ID" width="100" />
        <el-table-column prop="qtyOnHand" label="实物量" width="110" />
        <el-table-column prop="qtyOccupied" label="锁定量" width="110" />
      </el-table>
      <h4>负库存清单</h4>
      <el-table :data="negative" size="small" border>
        <el-table-column prop="productId" label="产品ID" width="100" />
        <el-table-column prop="warehouseId" label="仓库ID" width="100" />
        <el-table-column prop="qtyOnHand" label="库存量" width="110" />
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
.warn { color: #f56c6c; }
h4 { margin: 16px 0 8px; }
</style>
