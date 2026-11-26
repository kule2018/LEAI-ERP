<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createShipment, fetchOrderDetail, fetchOrders, fetchShipments, signShipment, type SaleOrder, type SaleOrderLine, type Shipment } from '@/api/sales'
import type { PageQuery } from '@/types/contract'

interface ShipLineDraft {
  orderLineId: number
  qty: string
  batchNo: string
}

const rows = ref<Shipment[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const orders = ref<SaleOrder[]>([])
const selectedOrder = ref<SaleOrder | null>(null)
const orderLines = ref<SaleOrderLine[]>([])
const dialogVisible = ref(false)
const submitting = ref(false)
const form = reactive({ orderId: 0, trackingNo: '' })
const lines = ref<ShipLineDraft[]>([])
let requestSeq = 0

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const [shipmentResult, orderResult] = await Promise.all([fetchShipments(query.value), fetchOrders({ page: 1, pageSize: 200 })])
    if (seq !== requestSeq) return
    rows.value = shipmentResult.list
    total.value = shipmentResult.total
    orders.value = orderResult.list
  } catch (cause) {
    if (seq === requestSeq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

watch(() => form.orderId, async (value) => {
  selectedOrder.value = orders.value.find((order) => order.id === value) ?? null
  if (!value) {
    orderLines.value = []
    lines.value = []
    return
  }
  try {
    const result = await fetchOrderDetail(value)
    orderLines.value = result.lines
    lines.value = result.lines.map((line) => ({
      orderLineId: line.id,
      qty: String(Math.max(0, Number(line.qty) - Number(line.shippedQty))),
      batchNo: ''
    })).filter((line) => Number(line.qty) > 0)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '订单明细加载失败')
  }
})

function openCreate(): void {
  form.orderId = 0
  form.trackingNo = ''
  selectedOrder.value = null
  orderLines.value = []
  lines.value = []
  dialogVisible.value = true
}

async function save(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  try {
    await createShipment({
      orderId: form.orderId,
      trackingNo: form.trackingNo || undefined,
      lines: lines.value
    })
    dialogVisible.value = false
    ElMessage.success('发货单已创建')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  } finally {
    submitting.value = false
  }
}

function lineValue(row: unknown, key: keyof ShipLineDraft): string | number {
  const line = row as ShipLineDraft
  return line[key]
}

function setLineValue(row: unknown, key: keyof ShipLineDraft, value: string): void {
  const line = row as ShipLineDraft
  if (key === 'orderLineId') line.orderLineId = Number(value) || 0
  else line[key] = value
}

function handlePage(value: number): void { query.value.page = value; void load() }

/* ---------- 签收 ---------- */
const signVisible = ref(false)
const signTarget = ref<Shipment | null>(null)
const signForm = reactive({ signedBy: '', evidenceUrls: '', remark: '' })

function openSign(row: Shipment): void {
  signTarget.value = row
  signForm.signedBy = ''
  signForm.evidenceUrls = ''
  signForm.remark = ''
  signVisible.value = true
}

async function submitSign(): Promise<void> {
  if (!signTarget.value) return
  try {
    await signShipment(signTarget.value.id, {
      signedBy: signForm.signedBy || undefined,
      evidenceUrls: signForm.evidenceUrls.split('\n').map((item) => item.trim()).filter(Boolean),
      remark: signForm.remark || undefined
    })
    ElMessage.success('签收已登记')
    signVisible.value = false
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '签收失败')
  }
}

onMounted(load)
onUnmounted(() => { requestSeq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>出货单</h2>
      <p>从已审核订单生成发货任务，按未发数量校验，支持批次和物流单号。</p>
    </header>
    <article class="panel">
      <div class="toolbar">
        <el-input v-model="query.keyword" placeholder="搜索发货单" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'sales:shipment:create'" @click="openCreate">新建发货</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <div v-if="error" class="error">{{ error }}</div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="shipmentNo" label="发货单号" width="170" />
        <el-table-column prop="orderId" label="订单ID" width="100" />
        <el-table-column prop="customerId" label="客户ID" width="100" />
        <el-table-column prop="trackingNo" label="物流单号" min-width="150" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column prop="createdAt" label="创建时间" width="180" />
        <el-table-column label="签收" width="110" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'sales:shipment:update'" @click="openSign(row)">
              {{ row.signedAt ? '已签收' : '登记签收' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
    </article>

    <el-dialog v-model="dialogVisible" title="新建发货" width="860px">
      <el-form label-width="90px">
        <el-form-item label="销售订单">
          <el-select v-model="form.orderId" placeholder="请选择已审核订单">
            <el-option v-for="order in orders.filter((item) => ['APPROVED', 'PARTIAL'].includes(item.status))" :key="order.id" :label="`${order.orderNo} · ${order.totalAmount}`" :value="order.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="物流单号"><el-input v-model="form.trackingNo" /></el-form-item>
      </el-form>
      <el-table :data="lines" size="small">
        <el-table-column label="订单行ID" width="130">
          <template #default="{ row }"><el-input :model-value="lineValue(row, 'orderLineId')" disabled /></template>
        </el-table-column>
        <el-table-column label="发货数量" width="150">
          <template #default="{ row }"><el-input :model-value="lineValue(row, 'qty')" @update:model-value="setLineValue(row, 'qty', $event)" /></template>
        </el-table-column>
        <el-table-column label="批次号">
          <template #default="{ row }"><el-input :model-value="lineValue(row, 'batchNo')" @update:model-value="setLineValue(row, 'batchNo', $event)" /></template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="save">确认发货</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="signVisible" title="登记签收" width="520px">
      <el-form label-width="90px">
        <el-form-item label="签收人"><el-input v-model="signForm.signedBy" placeholder="客户签收人姓名" /></el-form-item>
        <el-form-item label="签收凭证">
          <el-input v-model="signForm.evidenceUrls" type="textarea" :rows="3" placeholder="每行一个照片或单据地址" />
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="signForm.remark" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="signVisible = false">取消</el-button>
        <el-button type="primary" v-perm="'sales:shipment:update'" @click="submitSign">确认签收</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.error { color: #f5222d; margin-bottom: 12px; }
</style>
