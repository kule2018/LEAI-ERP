<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchShopOrders, retryShopOrder, retryShopOrdersBatch, shipShopOrder,
  syncShopOrder, type ShopOrder
} from '@/api/shop'
import type { PageQuery } from '@/types/contract'

interface OrderLineForm {
  productId: number
  qty: string
  unitPrice: string
}

const orders = ref<ShopOrder[]>([])
const total = ref(0)
const loading = ref(false)
const syncVisible = ref(false)
const shipVisible = ref(false)
const currentOrderId = ref(0)
const query = reactive<PageQuery & { status?: string }>({ page: 1, pageSize: 20, status: '' })
const syncForm = reactive({
  storeId: 0,
  platformOrderNo: '',
  customerId: 0,
  orderAmount: '0',
  orderDate: '',
  lines: [{ productId: 0, qty: '1', unitPrice: '0' }] as OrderLineForm[]
})
const shipForm = reactive({ waybillNo: '', carrier: '' })

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchShopOrders({
      page: query.page,
      pageSize: query.pageSize,
      ...(query.status ? { status: query.status } : {})
    })
    orders.value = result.list
    total.value = result.total
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载订单失败')
  } finally {
    loading.value = false
  }
}

function openSync(): void {
  Object.assign(syncForm, {
    storeId: 0,
    platformOrderNo: '',
    customerId: 0,
    orderAmount: '0',
    orderDate: '',
    lines: [{ productId: 0, qty: '1', unitPrice: '0' }]
  })
  syncVisible.value = true
}

async function handleSync(): Promise<void> {
  try {
    await syncShopOrder({
      storeId: syncForm.storeId,
      platformOrderNo: syncForm.platformOrderNo,
      customerId: syncForm.customerId || undefined,
      orderAmount: syncForm.orderAmount,
      orderDate: syncForm.orderDate || undefined,
      lines: syncForm.lines
    })
    syncVisible.value = false
    ElMessage.success('订单已同步并生成销售单')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '同步失败')
  }
}

async function handleRetry(id: number): Promise<void> {
  try {
    const result = await retryShopOrder(id)
    ElMessage.success(result.status === 'SYNCED' ? '重试成功' : result.errorText ?? '重试后仍失败')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '重试失败')
  }
}

async function handleRetryBatch(): Promise<void> {
  try {
    await retryShopOrdersBatch()
    ElMessage.success('失败订单批次已处理')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '批量重试失败')
  }
}

function openShip(id: number): void {
  currentOrderId.value = id
  shipForm.waybillNo = ''
  shipForm.carrier = ''
  shipVisible.value = true
}

async function handleShip(): Promise<void> {
  try {
    await shipShopOrder(currentOrderId.value, { ...shipForm })
    shipVisible.value = false
    ElMessage.success('订单已发货并生成运单')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '发货失败')
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>订单同步</h2>
      <p>平台订单按幂等键同步为 ERP 销售单，发货时联动库存出库和运单生成。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-input v-model="query.status" placeholder="同步状态" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'shop:order:sync'" @click="openSync">同步订单</el-button>
        <el-button v-perm="'shop:order:sync'" @click="handleRetryBatch">批量重试</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="orders" row-key="id">
        <el-table-column prop="platformOrderNo" label="平台订单号" min-width="170" />
        <el-table-column prop="storeId" label="店铺 ID" width="100" />
        <el-table-column prop="orderAmount" label="订单金额" width="130" />
        <el-table-column prop="paidAmount" label="已付金额" width="130" />
        <el-table-column prop="status" label="同步状态" width="110" />
        <el-table-column prop="shipStatus" label="发货状态" width="110" />
        <el-table-column prop="saleOrderId" label="销售单 ID" width="110" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'FAILED'" link type="warning" v-perm="'shop:order:sync'" @click="handleRetry(Number(row.id))">重试</el-button>
            <el-button link type="primary" v-perm="'shop:order:ship'" :disabled="row.shipStatus === 'SHIPPED'" @click="openShip(Number(row.id))">发货</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pagination">
        <el-pagination background layout="prev, pager, next" :total="total" v-model:current-page="query.page" :page-size="query.pageSize" @current-change="load" />
      </div>
    </article>

    <el-dialog v-model="syncVisible" title="同步平台订单" width="720px">
      <el-form label-width="110px">
        <el-form-item label="店铺 ID"><el-input-number v-model="syncForm.storeId" :min="1" /></el-form-item>
        <el-form-item label="平台订单号"><el-input v-model="syncForm.platformOrderNo" /></el-form-item>
        <el-form-item label="客户 ID"><el-input-number v-model="syncForm.customerId" :min="0" /></el-form-item>
        <el-form-item label="订单金额"><el-input v-model="syncForm.orderAmount" /></el-form-item>
        <el-form-item label="订单日期"><el-date-picker v-model="syncForm.orderDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
      </el-form>
      <div class="line-title">订单明细</div>
      <div v-for="(line, index) in syncForm.lines" :key="index" class="line-row">
        <el-input-number v-model="line.productId" :min="1" placeholder="产品 ID" />
        <el-input v-model="line.qty" placeholder="数量" />
        <el-input v-model="line.unitPrice" placeholder="单价" />
        <el-button @click="syncForm.lines.splice(index, 1)">删除</el-button>
      </div>
      <el-button @click="syncForm.lines.push({ productId: 0, qty: '1', unitPrice: '0' })">新增明细</el-button>
      <template #footer>
        <el-button @click="syncVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSync">同步</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="shipVisible" title="订单发货" width="460px">
      <el-form label-width="90px">
        <el-form-item label="运单号"><el-input v-model="shipForm.waybillNo" /></el-form-item>
        <el-form-item label="承运商"><el-input v-model="shipForm.carrier" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="shipVisible = false">取消</el-button>
        <el-button type="primary" @click="handleShip">确认发货</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.pagination { display: flex; justify-content: flex-end; margin-top: 16px; }
.line-title { margin: 12px 0 8px; font-weight: 600; }
.line-row { display: grid; grid-template-columns: 1fr 1fr 1fr 80px; gap: 8px; margin-bottom: 8px; }
</style>
