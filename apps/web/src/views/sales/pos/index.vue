<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { submitOfflineForm } from '@/utils/offline-form'

interface CartLine {
  productId: number
  qty: string
  unitPrice: string
}

const customerId = ref(0)
const warehouseId = ref(0)
const lines = ref<CartLine[]>([{ productId: 0, qty: '1', unitPrice: '0' }])
const loading = ref(false)
const lastOrder = ref('')
const form = reactive({ search: '' })

const total = computed(() => lines.value.reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.unitPrice || 0), 0))

function lineValue(row: unknown, key: keyof CartLine): string | number {
  const line = row as CartLine
  return line[key]
}

function setLineValue(row: unknown, key: keyof CartLine, value: string): void {
  const line = row as CartLine
  if (key === 'productId') line.productId = Number(value) || 0
  else line[key] = value
}

async function checkout(): Promise<void> {
  if (loading.value) return
  loading.value = true
  try {
    // 收银支持离线暂存：断网时生成本地单号并入队，恢复后按同一幂等键补录
    const result = await submitOfflineForm<{ orderNo: string }>({
      formType: 'POS',
      label: 'POS 收银单',
      url: '/sales/pos/orders',
      method: 'post',
      data: {
        customerId: customerId.value,
        warehouseId: warehouseId.value || undefined,
        lines: lines.value
      }
    })
    if (result.status === 'success') {
      lastOrder.value = result.data?.orderNo ?? ''
      ElMessage.success(`收银成功：${result.data?.orderNo ?? ''}`)
      lines.value = [{ productId: 0, qty: '1', unitPrice: '0' }]
      return
    }
    if (result.status === 'queued') {
      lastOrder.value = result.localNo
      ElMessage.warning(`网络不可用，收银单已暂存待同步（本地单号 ${result.localNo}）`)
      lines.value = [{ productId: 0, qty: '1', unitPrice: '0' }]
      return
    }
    if (result.status === 'conflict') {
      ElMessage.error(`该收银单疑似已提交，请核对后再操作：${result.message ?? ''}`)
      return
    }
    ElMessage.error(result.message ?? '收银失败')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '收银失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>POS 收银</h2>
      <p>快速建单、挂单和多支付方式入口；当前版本先接通快速建单与信用校验。</p>
    </header>
    <div class="pos-layout">
      <article class="panel cart-panel">
        <div class="pos-toolbar">
          <el-input v-model="form.search" placeholder="扫码或搜索产品" />
          <el-button @click="lines.push({ productId: 0, qty: '1', unitPrice: '0' })">加行</el-button>
        </div>
        <el-table :data="lines" size="small">
          <el-table-column label="产品ID" width="140">
            <template #default="{ row }"><el-input :model-value="lineValue(row, 'productId')" @update:model-value="setLineValue(row, 'productId', $event)" /></template>
          </el-table-column>
          <el-table-column label="数量" width="130">
            <template #default="{ row }"><el-input-number :model-value="Number(lineValue(row, 'qty'))" :min="0.001" :precision="3" @update:model-value="setLineValue(row, 'qty', String($event ?? 0))" /></template>
          </el-table-column>
          <el-table-column label="单价" width="140">
            <template #default="{ row }"><el-input :model-value="lineValue(row, 'unitPrice')" @update:model-value="setLineValue(row, 'unitPrice', $event)" /></template>
          </el-table-column>
          <el-table-column label="小计">
            <template #default="{ row }">{{ (Number(lineValue(row, 'qty')) * Number(lineValue(row, 'unitPrice'))).toFixed(2) }}</template>
          </el-table-column>
          <el-table-column width="70">
            <template #default><el-button link type="danger" :disabled="lines.length <= 1" @click="lines.pop()">删</el-button></template>
          </el-table-column>
        </el-table>
      </article>

      <aside class="panel checkout-panel">
        <h3>收银台</h3>
        <el-form label-width="90px">
          <el-form-item label="客户ID"><el-input-number v-model="customerId" :min="1" /></el-form-item>
          <el-form-item label="仓库ID"><el-input-number v-model="warehouseId" :min="0" /></el-form-item>
        </el-form>
        <div class="total">
          <span>合计</span>
          <strong>¥ {{ total.toFixed(2) }}</strong>
        </div>
        <el-button type="primary" class="checkout-button" :loading="loading" v-perm="'sales:pos:create'" @click="checkout">收款并开单</el-button>
        <p v-if="lastOrder" class="last-order">最近单号：{{ lastOrder }}</p>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.pos-layout { display: grid; grid-template-columns: minmax(520px, 1fr) 320px; gap: 16px; }
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.pos-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.checkout-panel h3 { margin: 0 0 16px; }
.total { display: flex; align-items: baseline; justify-content: space-between; padding: 16px 0; border-top: 1px solid #e5e6eb; }
.total strong { font-size: 26px; }
.checkout-button { width: 100%; height: 44px; }
.last-order { color: #646a73; }
@media (max-width: 1000px) { .pos-layout { grid-template-columns: 1fr; } }
</style>
