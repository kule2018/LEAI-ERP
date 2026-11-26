<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  fetchPortalActions,
  fetchPortalInvoices,
  fetchPortalOrders,
  fetchPortalProfile,
  fetchPortalShipments,
  fetchPortalStatements,
  fetchPortalSummary,
  portalConfirmOrder,
  portalConfirmStatement,
  portalCreateInvoice,
  portalCreateShipment,
  portalLogout,
  type PortalProfile,
  type PortalSummary
} from '@/api/supplier-portal'
import { clearPortalSession, getPortalToken } from '@/utils/portal-http'

const router = useRouter()
const profile = ref<PortalProfile | null>(null)
const summary = ref<PortalSummary | null>(null)
const orders = ref<Record<string, unknown>[]>([])
const statements = ref<Record<string, unknown>[]>([])
const shipments = ref<Record<string, unknown>[]>([])
const invoices = ref<Record<string, unknown>[]>([])
const actions = ref<Record<string, unknown>[]>([])
const active = ref('orders')
const loading = ref(false)
const submitting = ref(false)

const shipmentForm = reactive({ waybillNo: '', carrierId: undefined as number | undefined, sourceId: undefined as number | undefined, freightAmount: '0' })
const invoiceForm = reactive({ invoiceNo: '', amount: '', receiptId: undefined as number | undefined })

const pendingOrders = computed(() => orders.value.filter((item) => !item.portalConfirmedAt))

async function load(): Promise<void> {
  if (!getPortalToken()) {
    await router.replace('/supplier-portal/login')
    return
  }
  loading.value = true
  try {
    const [profileResult, summaryResult, orderResult, statementResult, shipmentResult, invoiceResult, actionResult] =
      await Promise.all([
        fetchPortalProfile(),
        fetchPortalSummary(),
        fetchPortalOrders({ page: 1, pageSize: 50 }),
        fetchPortalStatements({ page: 1, pageSize: 50 }),
        fetchPortalShipments({ page: 1, pageSize: 50 }),
        fetchPortalInvoices({ page: 1, pageSize: 50 }),
        fetchPortalActions({ page: 1, pageSize: 20 })
      ])
    profile.value = profileResult
    summary.value = summaryResult
    orders.value = orderResult.list as unknown as Record<string, unknown>[]
    statements.value = statementResult.list as unknown as Record<string, unknown>[]
    shipments.value = shipmentResult.list as unknown as Record<string, unknown>[]
    invoices.value = invoiceResult.list as unknown as Record<string, unknown>[]
    actions.value = actionResult.list as unknown as Record<string, unknown>[]
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载门户数据失败')
  } finally {
    loading.value = false
  }
}

async function confirmOrder(row: Record<string, unknown>): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认接受订单 ${String(row.orderNo ?? '')}？`, '订单确认', { type: 'warning' })
  } catch { return }
  try {
    await portalConfirmOrder(Number(row.id))
    ElMessage.success('订单已确认')
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '订单确认失败')
  }
}

async function confirmStatement(row: Record<string, unknown>): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认对账单 ${String(row.statementNo ?? '')} 金额无误？`, '对账确认', { type: 'warning' })
  } catch { return }
  try {
    await portalConfirmStatement(Number(row.id))
    ElMessage.success('对账单已确认')
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '对账确认失败')
  }
}

async function submitShipment(): Promise<void> {
  if (!shipmentForm.waybillNo.trim()) { ElMessage.warning('请填写运单号'); return }
  if (!shipmentForm.carrierId) { ElMessage.warning('请填写承运商 ID'); return }
  submitting.value = true
  try {
    await portalCreateShipment({
      waybillNo: shipmentForm.waybillNo.trim(),
      carrierId: shipmentForm.carrierId as number,
      sourceType: 'PURCHASE',
      sourceId: shipmentForm.sourceId ?? undefined,
      freightAmount: shipmentForm.freightAmount || '0'
    })
    ElMessage.success('发货通知已提交')
    shipmentForm.waybillNo = ''
    shipmentForm.carrierId = undefined
    shipmentForm.sourceId = undefined
    shipmentForm.freightAmount = '0'
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '发货通知提交失败')
  } finally {
    submitting.value = false
  }
}

async function submitInvoice(): Promise<void> {
  if (!invoiceForm.invoiceNo.trim()) { ElMessage.warning('请填写发票号'); return }
  if (!invoiceForm.amount.trim()) { ElMessage.warning('请填写发票金额'); return }
  submitting.value = true
  try {
    await portalCreateInvoice({
      invoiceNo: invoiceForm.invoiceNo.trim(),
      amount: invoiceForm.amount.trim(),
      receiptId: invoiceForm.receiptId ?? undefined
    })
    ElMessage.success('发票已上传')
    invoiceForm.invoiceNo = ''
    invoiceForm.amount = ''
    invoiceForm.receiptId = undefined
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '发票上传失败')
  } finally {
    submitting.value = false
  }
}

async function handleLogout(): Promise<void> {
  try {
    await portalLogout()
  } catch {
    // 令牌失效时也允许本地退出
  }
  clearPortalSession()
  await router.replace('/supplier-portal/login')
}

onMounted(load)
</script>

<template>
  <div class="portal-shell" v-loading="loading">
    <header class="portal-header">
      <div>
        <h2>供应商协同门户</h2>
        <p>{{ profile?.supplierName || '当前供应商' }} · {{ profile?.displayName || profile?.username }}</p>
      </div>
      <el-button @click="handleLogout">退出登录</el-button>
    </header>

    <section class="portal-metrics">
      <article class="portal-metric"><span>采购订单</span><strong>{{ summary?.orderCount ?? 0 }}</strong></article>
      <article class="portal-metric"><span>待确认订单</span><strong>{{ summary?.pendingConfirmCount ?? 0 }}</strong></article>
      <article class="portal-metric"><span>订单金额</span><strong>{{ summary?.orderAmount ?? '0.0000' }}</strong></article>
      <article class="portal-metric"><span>未结算金额</span><strong>{{ summary?.unpaidAmount ?? '0.0000' }}</strong></article>
      <article class="portal-metric"><span>收货单</span><strong>{{ summary?.receiptCount ?? 0 }}</strong></article>
      <article class="portal-metric"><span>已上传发票</span><strong>{{ summary?.invoiceCount ?? 0 }}</strong></article>
    </section>

    <el-tabs v-model="active" class="portal-panel">
      <el-tab-pane label="采购订单" name="orders">
        <el-table :data="orders" row-key="id" size="small">
          <el-table-column prop="orderNo" label="订单号" min-width="160" />
          <el-table-column prop="orderDate" label="日期" width="130" />
          <el-table-column prop="totalAmount" label="金额" width="140" />
          <el-table-column prop="status" label="状态" width="120" />
          <el-table-column label="门户确认" width="110">
            <template #default="{ row }">
              <span v-if="row.portalConfirmedAt">已确认</span>
              <span v-else>待确认</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="90">
            <template #default="{ row }">
              <el-button link type="primary" :disabled="!!row.portalConfirmedAt" @click="confirmOrder(row)">确认</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="对账确认" name="statements">
        <el-table :data="statements" row-key="id" size="small">
          <el-table-column prop="statementNo" label="对账单" min-width="160" />
          <el-table-column prop="period" label="期间" width="120" />
          <el-table-column prop="amount" label="金额" width="140" />
          <el-table-column prop="settledAmount" label="已结算" width="140" />
          <el-table-column prop="status" label="状态" width="120" />
          <el-table-column label="操作" width="90">
            <template #default="{ row }">
              <el-button link type="primary" :disabled="!!row.portalConfirmedAt" @click="confirmStatement(row)">确认</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="发货通知" name="shipments">
        <el-form :inline="true" size="small" class="portal-form">
          <el-form-item label="运单号"><el-input v-model="shipmentForm.waybillNo" placeholder="供应商运单号" /></el-form-item>
          <el-form-item label="承运商ID"><el-input-number v-model="shipmentForm.carrierId" :min="1" placeholder="承运商 ID" /></el-form-item>
          <el-form-item label="关联订单ID"><el-input-number v-model="shipmentForm.sourceId" :min="1" placeholder="采购订单 ID" /></el-form-item>
          <el-form-item label="运费"><el-input v-model="shipmentForm.freightAmount" placeholder="如 120.00" /></el-form-item>
          <el-form-item><el-button type="primary" :loading="submitting" @click="submitShipment">提交发货通知</el-button></el-form-item>
        </el-form>
        <el-table :data="shipments" row-key="id" size="small">
          <el-table-column prop="waybillNo" label="运单号" min-width="160" />
          <el-table-column prop="status" label="状态" width="120" />
          <el-table-column prop="freightAmount" label="运费" width="120" />
          <el-table-column prop="createdAt" label="提交时间" min-width="170" />
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="发票上传" name="invoices">
        <el-form :inline="true" size="small" class="portal-form">
          <el-form-item label="发票号"><el-input v-model="invoiceForm.invoiceNo" placeholder="供应商发票号" /></el-form-item>
          <el-form-item label="金额"><el-input v-model="invoiceForm.amount" placeholder="如 5000.00" /></el-form-item>
          <el-form-item label="收货单ID"><el-input-number v-model="invoiceForm.receiptId" :min="1" placeholder="关联收货单 ID" /></el-form-item>
          <el-form-item><el-button type="primary" :loading="submitting" @click="submitInvoice">上传发票</el-button></el-form-item>
        </el-form>
        <el-table :data="invoices" row-key="id" size="small">
          <el-table-column prop="invoiceNo" label="发票号" min-width="160" />
          <el-table-column prop="amount" label="金额" width="140" />
          <el-table-column prop="status" label="状态" width="120" />
          <el-table-column prop="createdAt" label="上传时间" min-width="170" />
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="协同动态" name="actions">
        <el-table :data="actions" row-key="id" size="small">
          <el-table-column prop="actionType" label="动作" width="150" />
          <el-table-column prop="bizType" label="单据类型" width="150" />
          <el-table-column prop="bizId" label="单据ID" width="110" />
          <el-table-column prop="createdAt" label="时间" min-width="170" />
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <p v-if="pendingOrders.length" class="portal-tip">有 {{ pendingOrders.length }} 张订单待确认</p>
  </div>
</template>

<style scoped>
.portal-shell {
  min-height: 100%;
  padding: 20px 24px;
  background: #f4f6f9;
}

.portal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.portal-header h2 {
  margin: 0;
  font-size: 20px;
}

.portal-header p {
  margin: 6px 0 0;
  color: #646a73;
  font-size: 13px;
}

.portal-metrics {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.portal-metric {
  padding: 14px;
  background: #fff;
  border-radius: 8px;
}

.portal-metric span {
  display: block;
  color: #646a73;
  font-size: 12px;
}

.portal-metric strong {
  display: block;
  margin-top: 6px;
  font-size: 18px;
}

.portal-panel {
  padding: 16px;
  background: #fff;
  border-radius: 8px;
}

.portal-form {
  margin-bottom: 12px;
}

.portal-tip {
  margin-top: 12px;
  color: #8a9099;
  font-size: 12px;
}
</style>
