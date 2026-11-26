<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createMovement, fetchBalances, type StockBalance } from '@/api/inventory'

const code = ref('')
const warehouseId = ref(1)
const qty = ref('1')
const rows = ref<StockBalance[]>([])
const loading = ref(false)

async function queryStock(): Promise<void> {
  const productId = Number(code.value.trim())
  if (!Number.isFinite(productId) || productId <= 0) {
    ElMessage.warning('请输入产品 ID 或可解析为产品 ID 的条码')
    return
  }
  loading.value = true
  try {
    const result = await fetchBalances({ page: 1, pageSize: 20, productId })
    rows.value = result.list
    ElMessage.success(`查询到 ${result.total} 条库存`)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '查询失败')
  } finally {
    loading.value = false
  }
}

async function receive(): Promise<void> {
  const productId = Number(code.value.trim())
  if (!Number.isFinite(productId) || productId <= 0) {
    ElMessage.warning('请先扫描或输入有效的产品 ID')
    return
  }
  try {
    await createMovement({
      voucherType: 'OTHER_IN',
      voucherId: 0,
      warehouseId: warehouseId.value,
      productId,
      qtyIn: qty.value,
      remark: '移动端扫码收货'
    })
    ElMessage.success('扫码收货已入库')
    await queryStock()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '收货失败')
  }
}

function num(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function available(row: StockBalance): string {
  return (num(row.qtyOnHand) - num(row.qtyOccupied) - num(row.qtyFrozen)).toFixed(3)
}
</script>

<template>
  <section class="mobile-page">
    <header class="mobile-header">
      <h2>扫码开单</h2>
      <p>扫码输入产品标识后查询库存，可快速创建其他入库单。</p>
    </header>

    <article class="mobile-card">
      <el-input v-model="code" size="large" placeholder="扫描条码或输入产品 ID" clearable @keyup.enter="queryStock" />
      <div class="form-row">
        <div>
          <label>仓库 ID</label>
          <el-input-number v-model="warehouseId" :min="1" />
        </div>
        <div>
          <label>数量</label>
          <el-input v-model="qty" />
        </div>
      </div>
      <div class="actions">
        <el-button type="primary" :loading="loading" v-perm="'inventory:balance:view'" @click="queryStock">查询库存</el-button>
        <el-button type="success" v-perm="'inventory:inout:create'" @click="receive">扫码收货</el-button>
      </div>
    </article>

    <article v-for="row in rows" :key="row.id" class="mobile-card">
      <div class="card-head"><strong>产品 #{{ row.productId }}</strong><span>可用 {{ available(row) }}</span></div>
      <div class="meta">仓库 {{ row.warehouseId }} ｜ 批次 {{ row.batchNo || '-' }}</div>
    </article>
  </section>
</template>

<style scoped>
.mobile-page { max-width: 560px; margin: 0 auto; }
.mobile-header { margin-bottom: 16px; }
.mobile-header h2 { margin: 0 0 6px; }
.mobile-header p { margin: 0; color: #646a73; font-size: 13px; }
.mobile-card { padding: 16px; margin-bottom: 12px; background: #fff; border-radius: 10px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
.form-row label { display: block; margin-bottom: 6px; color: #646a73; font-size: 12px; }
.actions { display: flex; gap: 12px; margin-top: 16px; }
.actions .el-button { min-height: 44px; flex: 1; }
.card-head { display: flex; justify-content: space-between; }
.meta { margin-top: 8px; color: #646a73; font-size: 13px; }
</style>
