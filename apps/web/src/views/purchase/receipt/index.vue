<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  completeReceipt, fetchPurchaseOrderDetail, fetchPurchaseOrders,
  fetchReceiptDetail, fetchReceipts, updateQc, type Receipt, type ReceiptLine
} from '@/api/purchase'
import { submitOfflineForm } from '@/utils/offline-form'
import type { PurchaseOrder, PurchaseOrderLine } from '@/api/purchase'
import type { PageQuery } from '@/types/contract'

interface ReceiptDraft { orderLineId: number; qty: string; batchNo: string; serialNo: string; qcStatus: string }
const rows = ref<Receipt[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const orders = ref<PurchaseOrder[]>([])
const orderLines = ref<PurchaseOrderLine[]>([])
const visible = ref(false)
const detailVisible = ref(false)
const submitting = ref(false)
const form = reactive({ orderId: 0 })
const drafts = ref<ReceiptDraft[]>([])
const detail = ref<{ receipt: Receipt; lines: ReceiptLine[] } | null>(null)
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  error.value = ''
  try {
    const [receiptResult, orderResult] = await Promise.all([fetchReceipts(query.value), fetchPurchaseOrders({ page: 1, pageSize: 200 })])
    if (current !== seq) return
    rows.value = receiptResult.list
    total.value = receiptResult.total
    orders.value = orderResult.list
  } catch (cause) { if (current === seq) error.value = cause instanceof Error ? cause.message : '加载失败' }
  finally { if (current === seq) loading.value = false }
}

watch(() => form.orderId, async (value) => {
  if (!value) { orderLines.value = []; drafts.value = []; return }
  try {
    const result = await fetchPurchaseOrderDetail(value)
    orderLines.value = result.lines
    drafts.value = result.lines.map((line) => ({
      orderLineId: line.id,
      qty: String(Math.max(0, Number(line.qty) - Number(line.receivedQty))),
      batchNo: '',
      serialNo: '',
      qcStatus: 'PENDING'
    })).filter((line) => Number(line.qty) > 0)
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '订单明细加载失败') }
})

function openAdd(): void {
  form.orderId = 0
  orderLines.value = []
  drafts.value = []
  visible.value = true
}

async function save(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  try {
    // 收货支持离线暂存：断网时按采购订单维度入队，恢复后按同一幂等键补录
    const result = await submitOfflineForm<Record<string, unknown>>({
      formType: 'RECEIPT',
      label: `采购收货单（订单 ${form.orderId}）`,
      url: '/purchase/receipts',
      method: 'post',
      data: { orderId: form.orderId, lines: drafts.value }
    })
    if (result.status === 'success') {
      visible.value = false
      ElMessage.success('收货单已创建')
      await load()
      return
    }
    if (result.status === 'queued') {
      visible.value = false
      ElMessage.warning(`网络不可用，收货单已暂存待同步（本地单号 ${result.localNo}）`)
      return
    }
    if (result.status === 'conflict') {
      ElMessage.error(`该收货单疑似已提交，请核对：${result.message ?? ''}`)
      return
    }
    ElMessage.error(result.message ?? '保存失败')
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
  finally { submitting.value = false }
}

async function openDetail(row: unknown): Promise<void> {
  const receipt = row as Receipt
  try {
    detail.value = await fetchReceiptDetail(receipt.id)
    detailVisible.value = true
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '详情加载失败') }
}

async function handleQc(lineId: number, qcStatus: string): Promise<void> {
  if (!detail.value) return
  try {
    await updateQc(detail.value.receipt.id, lineId, qcStatus)
    detail.value = await fetchReceiptDetail(detail.value.receipt.id)
    ElMessage.success('质检状态已更新')
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '更新失败') }
}

async function handleComplete(): Promise<void> {
  if (!detail.value) return
  try {
    await completeReceipt(detail.value.receipt.id)
    detailVisible.value = false
    ElMessage.success('收货已完成')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '完成失败') }
}

function draftValue(row: unknown, key: keyof ReceiptDraft): string | number { const line = row as ReceiptDraft; return line[key] }
function setDraftValue(row: unknown, key: keyof ReceiptDraft, value: string): void { const line = row as ReceiptDraft; if (key === 'orderLineId') line.orderLineId = Number(value) || 0; else line[key] = value }

function handlePage(value: number): void { query.value.page = value; void load() }
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>采购收货</h2><p>按订单行收货，录入批次/序列号，质检合格后完成收货。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-input v-model="query.keyword" placeholder="搜索收货单" clearable @keyup.enter="load" />
        <el-button type="primary" v-perm="'purchase:receipt:create'" @click="openAdd">新建收货</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <div v-if="error" class="error">{{ error }}</div>
      <el-table v-loading="loading" :data="rows" row-key="id" @row-click="openDetail">
        <el-table-column prop="receiptNo" label="收货单号" width="170" />
        <el-table-column prop="orderId" label="订单ID" width="100" />
        <el-table-column prop="supplierId" label="供应商ID" width="110" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column prop="receivedAt" label="收货时间" width="180" />
      </el-table>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
    </article>

    <el-dialog v-model="visible" title="新建收货" width="860px">
      <el-form label-width="90px">
        <el-form-item label="采购订单">
          <el-select v-model="form.orderId">
            <el-option v-for="order in orders.filter((item) => ['APPROVED', 'PARTIAL'].includes(item.status))" :key="order.id" :label="`${order.orderNo} · ${order.totalAmount}`" :value="order.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <el-table :data="drafts" size="small">
        <el-table-column label="订单行ID" width="130"><template #default="{ row }"><el-input :model-value="draftValue(row, 'orderLineId')" disabled /></template></el-table-column>
        <el-table-column label="收货数量" width="130"><template #default="{ row }"><el-input :model-value="draftValue(row, 'qty')" @update:model-value="setDraftValue(row, 'qty', $event)" /></template></el-table-column>
        <el-table-column label="批次号"><template #default="{ row }"><el-input :model-value="draftValue(row, 'batchNo')" @update:model-value="setDraftValue(row, 'batchNo', $event)" /></template></el-table-column>
        <el-table-column label="序列号"><template #default="{ row }"><el-input :model-value="draftValue(row, 'serialNo')" @update:model-value="setDraftValue(row, 'serialNo', $event)" /></template></el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="save">确认收货</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="收货质检" width="900px">
      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item label="收货单">{{ detail.receipt.receiptNo }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ detail.receipt.status }}</el-descriptions-item>
      </el-descriptions>
      <el-table v-if="detail" :data="detail.lines" size="small" class="detail-table">
        <el-table-column prop="productId" label="产品ID" width="110" />
        <el-table-column prop="qty" label="数量" width="110" />
        <el-table-column prop="batchNo" label="批次" width="140" />
        <el-table-column prop="qcStatus" label="质检" width="110" />
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <el-button link type="success" @click="handleQc(row.id, 'PASS')">合格</el-button>
            <el-button link type="danger" @click="handleQc(row.id, 'FAIL')">不合格</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button type="primary" :disabled="detail?.lines.some((line) => line.qcStatus !== 'PASS')" @click="handleComplete">完成收货</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.error { color: #f5222d; margin-bottom: 12px; }
.detail-table { margin-top: 16px; }
</style>
