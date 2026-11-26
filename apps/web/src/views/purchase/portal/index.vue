<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchSuppliers, type Supplier } from '@/api/master-data'
import {
  fetchPortalEvaluates,
  fetchPortalOrders,
  fetchPortalReceipts,
  fetchPortalStatements,
  fetchPortalSummary,
  portalConfirmOrder,
  portalConfirmStatement,
  portalCreateInvoice,
  portalCreateShipment,
  type PortalSummary
} from '@/api/purchase'
import type { PageQuery } from '@/types/contract'

const suppliers = ref<Supplier[]>([])
const summary = ref<PortalSummary | null>(null)
const orders = ref<Record<string, unknown>[]>([])
const receipts = ref<Record<string, unknown>[]>([])
const statements = ref<Record<string, unknown>[]>([])
const evaluates = ref<Record<string, unknown>[]>([])
const active = ref('orders')
const loading = ref(false)
const submitting = ref(false)
const query = reactive<PageQuery & { supplierId?: number }>({ page: 1, pageSize: 20, supplierId: 0 })

const shipmentForm = reactive({ waybillNo: '', carrierId: undefined as number | undefined, sourceType: 'PURCHASE', sourceId: undefined as number | undefined, freightAmount: '0' })
const invoiceForm = reactive({ invoiceNo: '', amount: '', receiptId: undefined as number | undefined })

const confirmableOrders = computed(() => orders.value.filter((item) => ['SUBMITTED', 'APPROVED', 'PARTIAL'].includes(String(item.status ?? ''))))

async function load(): Promise<void> {
  loading.value = true
  try {
    const supplierResult = await fetchSuppliers({ page: 1, pageSize: 500 })
    suppliers.value = supplierResult.list
    if (!query.supplierId && suppliers.value.length) {
      query.supplierId = suppliers.value[0]?.id ?? 0
    }
    const params = { page: query.page, pageSize: query.pageSize, supplierId: query.supplierId || undefined }
    const [summaryResult, orderResult, receiptResult, statementResult, evaluateResult] = await Promise.all([
      fetchPortalSummary(params),
      fetchPortalOrders(params),
      fetchPortalReceipts(params),
      fetchPortalStatements(params),
      fetchPortalEvaluates(params)
    ])
    summary.value = summaryResult
    orders.value = orderResult.list as unknown as Record<string, unknown>[]
    receipts.value = receiptResult.list as unknown as Record<string, unknown>[]
    statements.value = statementResult.list as unknown as Record<string, unknown>[]
    evaluates.value = evaluateResult.list as unknown as Record<string, unknown>[]
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载供应商门户失败')
  } finally {
    loading.value = false
  }
}

function requireSupplier(): number | null {
  if (!query.supplierId) {
    ElMessage.warning('请先选择供应商')
    return null
  }
  return query.supplierId
}

async function confirmOrder(row: Record<string, unknown>): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认接受订单 ${String(row.orderNo ?? '')}？`, '供应商订单确认', { type: 'warning' })
  } catch { return }
  try {
    await portalConfirmOrder(Number(row.id))
    ElMessage.success('订单已确认')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '订单确认失败')
  }
}

async function confirmStatement(row: Record<string, unknown>): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认对账单 ${String(row.statementNo ?? '')} 金额无误？`, '供应商对账确认', { type: 'warning' })
  } catch { return }
  try {
    await portalConfirmStatement(Number(row.id))
    ElMessage.success('对账单已确认')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '对账确认失败')
  }
}

async function submitShipment(): Promise<void> {
  const supplierId = requireSupplier()
  if (!supplierId) return
  if (!shipmentForm.waybillNo.trim()) { ElMessage.warning('请填写运单号'); return }
  if (!shipmentForm.carrierId) { ElMessage.warning('请填写承运商 ID'); return }
  submitting.value = true
  try {
    await portalCreateShipment({
      supplierId,
      waybillNo: shipmentForm.waybillNo.trim(),
      carrierId: shipmentForm.carrierId,
      sourceType: shipmentForm.sourceType || undefined,
      sourceId: shipmentForm.sourceId ?? undefined,
      freightAmount: shipmentForm.freightAmount || '0'
    })
    ElMessage.success('发货登记成功')
    shipmentForm.waybillNo = ''
    shipmentForm.carrierId = undefined
    shipmentForm.sourceId = undefined
    shipmentForm.freightAmount = '0'
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '发货登记失败')
  } finally {
    submitting.value = false
  }
}

async function submitInvoice(): Promise<void> {
  const supplierId = requireSupplier()
  if (!supplierId) return
  if (!invoiceForm.invoiceNo.trim()) { ElMessage.warning('请填写发票号'); return }
  if (!invoiceForm.amount.trim()) { ElMessage.warning('请填写发票金额'); return }
  submitting.value = true
  try {
    await portalCreateInvoice({
      supplierId,
      invoiceNo: invoiceForm.invoiceNo.trim(),
      amount: invoiceForm.amount.trim(),
      receiptId: invoiceForm.receiptId ?? undefined
    })
    ElMessage.success('发票登记成功')
    invoiceForm.invoiceNo = ''
    invoiceForm.amount = ''
    invoiceForm.receiptId = undefined
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '发票登记失败')
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>供应商门户</h2>
      <p>按供应商聚合订单、收货、对账与评级数据；供应商可自助确认订单与对账，并登记发货与发票。</p>
    </header>

    <article class="panel">
      <div class="panel-toolbar">
        <el-select v-model="query.supplierId" style="width: 240px" placeholder="选择供应商" @change="load">
          <el-option v-for="supplier in suppliers" :key="supplier.id" :label="supplier.supplierName" :value="supplier.id" />
        </el-select>
        <el-button @click="load">刷新</el-button>
      </div>

      <div class="metric-grid">
        <article class="metric-card"><span>订单数</span><strong>{{ summary?.orderCount ?? 0 }}</strong></article>
        <article class="metric-card"><span>收货数</span><strong>{{ summary?.receiptCount ?? 0 }}</strong></article>
        <article class="metric-card"><span>订单金额</span><strong>{{ summary?.orderAmount ?? '0.0000' }}</strong></article>
        <article class="metric-card"><span>未结算</span><strong>{{ summary?.unpaidAmount ?? '0.0000' }}</strong></article>
        <article class="metric-card"><span>评级</span><strong>{{ summary?.rating ?? '0.0000' }}</strong></article>
      </div>

      <el-tabs v-model="active" v-loading="loading">
        <el-tab-pane label="采购订单" name="orders">
          <el-table :data="orders" row-key="id" size="small">
            <el-table-column prop="orderNo" label="订单号" min-width="160" />
            <el-table-column prop="orderDate" label="日期" width="130" />
            <el-table-column prop="totalAmount" label="金额" width="140" />
            <el-table-column prop="status" label="状态" width="120" />
            <el-table-column prop="payStatus" label="付款状态" width="120" />
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="收货" name="receipts">
          <el-table :data="receipts" row-key="id" size="small">
            <el-table-column prop="receiptNo" label="收货单" min-width="160" />
            <el-table-column prop="orderId" label="订单 ID" width="120" />
            <el-table-column prop="status" label="状态" width="120" />
            <el-table-column prop="receivedAt" label="收货时间" min-width="170" />
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="对账" name="statements">
          <el-table :data="statements" row-key="id" size="small">
            <el-table-column prop="statementNo" label="对账单" min-width="160" />
            <el-table-column prop="period" label="期间" width="120" />
            <el-table-column prop="amount" label="金额" width="140" />
            <el-table-column prop="settledAmount" label="已结算" width="140" />
            <el-table-column prop="status" label="状态" width="120" />
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="评级" name="evaluates">
          <el-table :data="evaluates" row-key="id" size="small">
            <el-table-column prop="period" label="期间" width="120" />
            <el-table-column prop="totalScore" label="总分" width="140" />
            <el-table-column prop="level" label="等级" width="100" />
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="自助填报" name="self-service">
          <el-row :gutter="16">
            <el-col :span="12">
              <h4 class="block-title">待确认订单（{{ confirmableOrders.length }}）</h4>
              <el-table :data="confirmableOrders" row-key="id" size="small" border max-height="260">
                <el-table-column prop="orderNo" label="订单号" min-width="150" />
                <el-table-column prop="totalAmount" label="金额" width="120" />
                <el-table-column prop="status" label="状态" width="110" />
                <el-table-column label="操作" width="90">
                  <template #default="{ row }">
                    <el-button link type="primary" v-perm="'purchase:portal:write'" @click="confirmOrder(row)">确认</el-button>
                  </template>
                </el-table-column>
              </el-table>

              <h4 class="block-title">对账确认</h4>
              <el-table :data="statements" row-key="id" size="small" border max-height="220">
                <el-table-column prop="statementNo" label="对账单" min-width="150" />
                <el-table-column prop="amount" label="金额" width="120" />
                <el-table-column prop="status" label="状态" width="110" />
                <el-table-column label="操作" width="90">
                  <template #default="{ row }">
                    <el-button link type="primary" v-perm="'purchase:portal:write'" @click="confirmStatement(row)">确认</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-col>

            <el-col :span="12">
              <h4 class="block-title">发货登记</h4>
              <el-form label-width="90px" size="small">
                <el-form-item label="运单号"><el-input v-model="shipmentForm.waybillNo" placeholder="供应商运单号" /></el-form-item>
                <el-form-item label="承运商ID"><el-input-number v-model="shipmentForm.carrierId" :min="1" placeholder="承运商 ID" /></el-form-item>
                <el-form-item label="来源单据">
                  <el-input-number v-model="shipmentForm.sourceId" :min="1" placeholder="关联采购订单 ID" style="width: 100%" />
                </el-form-item>
                <el-form-item label="运费"><el-input v-model="shipmentForm.freightAmount" placeholder="如 120.00" /></el-form-item>
                <el-form-item>
                  <el-button type="primary" v-perm="'purchase:portal:write'" :loading="submitting" @click="submitShipment">提交发货登记</el-button>
                </el-form-item>
              </el-form>

              <h4 class="block-title">发票登记</h4>
              <el-form label-width="90px" size="small">
                <el-form-item label="发票号"><el-input v-model="invoiceForm.invoiceNo" placeholder="供应商发票号" /></el-form-item>
                <el-form-item label="金额"><el-input v-model="invoiceForm.amount" placeholder="如 5000.00" /></el-form-item>
                <el-form-item label="收货单ID">
                  <el-input-number v-model="invoiceForm.receiptId" :min="1" placeholder="关联收货单 ID" style="width: 100%" />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" v-perm="'purchase:portal:write'" :loading="submitting" @click="submitInvoice">提交发票登记</el-button>
                </el-form-item>
              </el-form>
            </el-col>
          </el-row>
        </el-tab-pane>
      </el-tabs>
    </article>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel-toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.metric-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 16px; }
.metric-card { padding: 14px; background: #f7f8fa; border-radius: 8px; }
.metric-card span { display: block; color: #646a73; font-size: 12px; }
.metric-card strong { display: block; margin-top: 6px; font-size: 18px; }
.block-title { margin: 12px 0 8px; font-size: 14px; color: #1f2329; }
</style>
