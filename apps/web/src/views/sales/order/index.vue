<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import StatusSteps from '@/components/StatusSteps.vue'
import {
  approveOrder,
  createOrder,
  fetchOrderDetail,
  fetchOrders,
  submitOrder,
  splitOrder,
  type SaleOrder,
  type SaleOrderLine
} from '@/api/sales'
import type { BizStatus, PageQuery } from '@/types/contract'

interface LineDraft {
  productId: number
  qty: string
  unitPrice: string
  discount: string
}

const rows = ref<SaleOrder[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const selected = ref<SaleOrder | null>(null)
const detail = ref<SaleOrderLine[]>([])
const dialogVisible = ref(false)
const submitting = ref(false)
const form = reactive({ customerId: 0, warehouseId: 0, orderDate: '' })
const lines = ref<LineDraft[]>([{ productId: 0, qty: '1', unitPrice: '0', discount: '0' }])
const selectedLineIds = ref<number[]>([])
let requestSeq = 0

function lineValue(row: unknown, key: keyof LineDraft): string | number {
  const line = row as LineDraft
  return line[key]
}

function setLineValue(row: unknown, key: keyof LineDraft, value: string): void {
  const line = row as LineDraft
  if (key === 'productId') line.productId = Number(value) || 0
  else line[key] = value
}

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchOrders(query.value)
    if (seq !== requestSeq) return
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    if (seq === requestSeq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

async function loadDetail(row: unknown): Promise<void> {
  const order = row as SaleOrder
  selected.value = order
  try {
    const result = await fetchOrderDetail(order.id)
    detail.value = result.lines
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '明细加载失败')
  }
}

function openAdd(): void {
  form.customerId = 0
  form.warehouseId = 0
  form.orderDate = new Date().toISOString().slice(0, 10)
  lines.value = [{ productId: 0, qty: '1', unitPrice: '0', discount: '0' }]
  dialogVisible.value = true
}

async function save(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  try {
    await createOrder({
      customerId: form.customerId,
      warehouseId: form.warehouseId || undefined,
      orderDate: form.orderDate,
      lines: lines.value
    })
    dialogVisible.value = false
    ElMessage.success('销售单已创建')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  } finally {
    submitting.value = false
  }
}

async function handleSubmit(row: unknown): Promise<void> {
  const order = row as SaleOrder
  try {
    await submitOrder(order.id)
    ElMessage.success('已提交')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '提交失败')
  }
}

async function handleApprove(row: unknown): Promise<void> {
  const order = row as SaleOrder
  try {
    await approveOrder(order.id)
    ElMessage.success('审核通过，已占用客户信用额度')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '审核失败')
  }
}

/** 明细行勾选变化：记录待拆出的行 */
function handleSelectionChange(rows: SaleOrderLine[]): void {
  selectedLineIds.value = rows.map((item) => item.id)
}

/** 拆单：把选中的明细行拆出新单，原单保留剩余行 */
async function handleSplit(): Promise<void> {
  if (!selected.value) {
    ElMessage.warning('请先在左侧选择销售单')
    return
  }
  if (!isDraft(selected.value)) {
    ElMessage.warning('只有草稿状态的销售单可以拆单')
    return
  }
  if (selectedLineIds.value.length === 0) {
    ElMessage.warning('请在右侧勾选需要拆出的明细行')
    return
  }
  try {
    const result = await splitOrder(selected.value.id, selectedLineIds.value)
    ElMessage.success(`已拆单生成 ${result.created.orderNo}`)
    selectedLineIds.value = []
    await load()
    await loadDetail(selected.value)
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '拆单失败')
  }
}

function statusOf(row: unknown): BizStatus {
  return (row as SaleOrder).status as BizStatus
}

function isDraft(row: unknown): boolean {
  return (row as SaleOrder).status === 'DRAFT'
}

function isSubmitted(row: unknown): boolean {
  return (row as SaleOrder).status === 'SUBMITTED'
}

onMounted(load)
onUnmounted(() => { requestSeq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>销售单</h2>
      <p>开单时校验客户信用、产品状态和仓库；审核通过后占用信用额度，发货后扣减可用库存。</p>
    </header>

    <div class="workbench">
      <article class="panel">
        <div class="toolbar">
          <el-input v-model="query.keyword" placeholder="搜索销售单号" clearable @keyup.enter="load" />
          <el-button type="primary" v-perm="'sales:order:create'" @click="openAdd">新建销售单</el-button>
          <el-button @click="load">刷新</el-button>
          <span v-if="error" class="error">{{ error }}</span>
        </div>
        <el-table v-loading="loading" :data="rows" row-key="id" highlight-current-row @row-click="loadDetail">
          <el-table-column prop="orderNo" label="单号" width="160" />
          <el-table-column prop="customerId" label="客户ID" width="100" />
          <el-table-column prop="orderDate" label="日期" width="120" />
          <el-table-column prop="totalAmount" label="金额" width="130" />
          <el-table-column prop="payStatus" label="收款" width="100" />
          <el-table-column prop="shipStatus" label="发货" width="100" />
          <el-table-column prop="status" label="状态" width="110" />
          <el-table-column label="操作" width="150" align="center">
            <template #default="{ row }">
              <el-button link type="primary" v-perm="'sales:order:submit'" :disabled="!isDraft(row)" @click.stop="handleSubmit(row)">提交</el-button>
              <el-button link type="success" v-perm="'sales:order:approve'" :disabled="!isSubmitted(row)" @click.stop="handleApprove(row)">审核</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="(value: number) => { query.page = value; void load() }" />
      </article>

      <article class="panel">
        <h3>单据详情</h3>
        <StatusSteps v-if="selected" :status="statusOf(selected)" />
        <el-descriptions v-if="selected" :column="2" border>
          <el-descriptions-item label="单号">{{ selected.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="客户ID">{{ selected.customerId }}</el-descriptions-item>
          <el-descriptions-item label="金额">{{ selected.totalAmount }}</el-descriptions-item>
          <el-descriptions-item label="来源">{{ selected.sourceType }}</el-descriptions-item>
        </el-descriptions>
        <div v-if="selected" class="detail-toolbar">
          <el-button v-perm="'sales:order:update'" :disabled="!isDraft(selected)" @click="handleSplit">按勾选行拆单</el-button>
          <span class="hint">勾选需要拆出的明细行，拆单后原单保留剩余行</span>
        </div>
        <el-table v-if="selected" :data="detail" size="small" class="detail-table" row-key="id" @selection-change="handleSelectionChange">
          <el-table-column type="selection" width="45" />
          <el-table-column prop="productId" label="产品ID" />
          <el-table-column prop="qty" label="数量" />
          <el-table-column prop="unitPrice" label="单价" />
          <el-table-column prop="amount" label="金额" />
          <el-table-column prop="shippedQty" label="已发数量" />
        </el-table>
        <el-empty v-if="!selected" description="请选择左侧销售单" />
      </article>
    </div>

    <el-dialog v-model="dialogVisible" title="新建销售单" width="900px">
      <el-form label-width="90px">
        <el-form-item label="客户ID"><el-input-number v-model="form.customerId" :min="1" /></el-form-item>
        <el-form-item label="仓库ID"><el-input-number v-model="form.warehouseId" :min="0" /></el-form-item>
        <el-form-item label="订单日期"><el-date-picker v-model="form.orderDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
      </el-form>
      <h4>订单明细</h4>
      <el-table :data="lines" size="small">
        <el-table-column label="产品ID" width="120">
          <template #default="{ row }"><el-input :model-value="lineValue(row, 'productId')" @update:model-value="setLineValue(row, 'productId', $event)" /></template>
        </el-table-column>
        <el-table-column label="数量" width="120">
          <template #default="{ row }"><el-input :model-value="lineValue(row, 'qty')" @update:model-value="setLineValue(row, 'qty', $event)" /></template>
        </el-table-column>
        <el-table-column label="单价" width="120">
          <template #default="{ row }"><el-input :model-value="lineValue(row, 'unitPrice')" @update:model-value="setLineValue(row, 'unitPrice', $event)" /></template>
        </el-table-column>
        <el-table-column label="折扣%" width="120">
          <template #default="{ row }"><el-input :model-value="lineValue(row, 'discount')" @update:model-value="setLineValue(row, 'discount', $event)" /></template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default><el-button link type="danger" :disabled="lines.length <= 1" @click="lines.pop()">删除</el-button></template>
        </el-table-column>
      </el-table>
      <el-button class="add-line" @click="lines.push({ productId: 0, qty: '1', unitPrice: '0', discount: '0' })">添加明细</el-button>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.workbench { display: grid; grid-template-columns: minmax(500px, 1.2fr) minmax(360px, 0.8fr); gap: 16px; }
.panel { min-width: 0; padding: 16px; background: #fff; border-radius: 8px; }
.panel h3 { margin: 0 0 16px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.error { color: #f5222d; }
.detail-table { margin-top: 16px; }
.detail-toolbar { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
.detail-toolbar .hint { color: #8c8c8c; font-size: 12px; }
.add-line { margin-top: 12px; }
@media (max-width: 1200px) { .workbench { grid-template-columns: 1fr; } }
</style>
