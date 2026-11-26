<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchBalances, type StockBalance } from '@/api/inventory'
import type { PageQuery } from '@/types/contract'

const rows = ref<StockBalance[]>([])
const loading = ref(false)
const query = reactive<PageQuery>({ page: 1, pageSize: 50, keyword: '' })

function num(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function available(row: StockBalance): string {
  return (num(row.qtyOnHand) - num(row.qtyOccupied) - num(row.qtyFrozen)).toFixed(3)
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchBalances(query)
    rows.value = result.list
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载库存失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="mobile-page">
    <header class="mobile-header">
      <h2>移动库存</h2>
      <p>可用量 = 实物量 - 锁定量 - 冻结量；移动端只读展示，调整仍需审批。</p>
    </header>

    <article v-for="row in rows" :key="row.id" class="mobile-card">
      <div class="card-head">
        <strong>产品 #{{ row.productId }}</strong>
        <span :class="Number(available(row)) < 0 ? 'danger' : 'ok'">可用 {{ available(row) }}</span>
      </div>
      <div class="meta">仓库 {{ row.warehouseId }} ｜ 库位 {{ row.locationId }} ｜ 批次 {{ row.batchNo || '-' }}</div>
      <div class="meta">实物 {{ row.qtyOnHand }} ｜ 锁定 {{ row.qtyOccupied }} ｜ 冻结 {{ row.qtyFrozen }}</div>
    </article>
    <el-empty v-if="!loading && rows.length === 0" description="暂无库存记录" />
  </section>
</template>

<style scoped>
.mobile-page { max-width: 560px; margin: 0 auto; }
.mobile-header { margin-bottom: 16px; }
.mobile-header h2 { margin: 0 0 6px; }
.mobile-header p { margin: 0; color: #646a73; font-size: 13px; }
.mobile-card { padding: 16px; margin-bottom: 12px; background: #fff; border-radius: 10px; }
.card-head { display: flex; justify-content: space-between; align-items: center; }
.meta { margin-top: 8px; color: #646a73; font-size: 13px; }
.ok { color: #16a34a; font-size: 13px; }
.danger { color: #dc2626; font-size: 13px; }
</style>
