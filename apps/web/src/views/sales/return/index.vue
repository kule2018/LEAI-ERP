<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import BaseGrid from '@/components/BaseGrid.vue'
import ViewConfigToolbar from '@/components/ViewConfigToolbar.vue'
import { useViewConfig } from '@/utils/view-config'
import { createReturn, fetchReturns, type SaleReturn } from '@/api/sales'
import { exchangeReturn, fetchReturnDetail, type SaleReturnExchange, type SaleReturnLine } from '@/api/sales-delivery'
import type { GridColumn, PageQuery } from '@/types/contract'

interface ReturnLine {
  productId: number
  qty: string
  amount: string
}

const VIEW_PAGE_KEY = 'sales.return'

const columns: GridColumn[] = [
  { prop: 'returnNo', label: '退货单号', width: 170 },
  { prop: 'customerId', label: '客户ID', width: 100 },
  { prop: 'orderId', label: '订单ID', width: 100 },
  { prop: 'reason', label: '原因', width: 180 },
  { prop: 'refundAmount', label: '退款金额', width: 140 },
  { prop: 'status', label: '状态', width: 110 }
]

const view = useViewConfig(VIEW_PAGE_KEY, columns)
const rows = ref<SaleReturn[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const dialogVisible = ref(false)
const form = reactive({ customerId: 0, orderId: 0, reason: '' })
const lines = ref<ReturnLine[]>([{ productId: 0, qty: '1', amount: '0' }])

/** 换货弹窗状态 */
const exchangeVisible = ref(false)
const exchangeLoading = ref(false)
const exchangeDetail = ref<{ lines: SaleReturnLine[]; exchanges: SaleReturnExchange[] } | null>(null)
const exchangeForm = reactive({ returnId: 0, lineId: 0, qty: '1', exchangeProductId: 0, exchangeUnitPrice: '', remark: '' })
let requestSeq = 0

function lineValue(row: unknown, key: keyof ReturnLine): string | number {
  const line = row as ReturnLine
  return line[key]
}

function setLineValue(row: unknown, key: keyof ReturnLine, value: string): void {
  const line = row as ReturnLine
  if (key === 'productId') line.productId = Number(value) || 0
  else line[key] = value
}

async function load(): Promise<void> {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const result = await fetchReturns(query.value)
    if (seq !== requestSeq) return
    rows.value = result.list
    total.value = result.total
  } catch (cause) {
    if (seq === requestSeq) error.value = cause instanceof Error ? cause.message : '加载失败'
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

function openAdd(): void {
  form.customerId = 0
  form.orderId = 0
  form.reason = ''
  lines.value = [{ productId: 0, qty: '1', amount: '0' }]
  dialogVisible.value = true
}

async function save(): Promise<void> {
  try {
    await createReturn({
      customerId: form.customerId,
      orderId: form.orderId || undefined,
      reason: form.reason,
      lines: lines.value
    })
    dialogVisible.value = false
    ElMessage.success('退货单已创建')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

/** 打开换货：先拉取退货明细，换货数量不得超过退货数量 */
async function openExchange(row: unknown): Promise<void> {
  const ret = row as SaleReturn
  exchangeVisible.value = true
  exchangeLoading.value = true
  exchangeForm.returnId = ret.id
  exchangeForm.lineId = 0
  exchangeForm.qty = '1'
  exchangeForm.exchangeProductId = 0
  exchangeForm.exchangeUnitPrice = ''
  exchangeForm.remark = ''
  exchangeDetail.value = null
  try {
    const detail = await fetchReturnDetail(ret.id)
    exchangeDetail.value = { lines: detail.lines, exchanges: detail.exchanges }
    if (detail.lines.length) {
      exchangeForm.lineId = detail.lines[0].id
      exchangeForm.qty = detail.lines[0].qty
    }
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '加载退货明细失败')
  } finally {
    exchangeLoading.value = false
  }
}

async function submitExchange(): Promise<void> {
  if (!exchangeForm.lineId || !exchangeForm.exchangeProductId) {
    ElMessage.warning('请选择退货明细并填写换货商品')
    return
  }
  try {
    const result = await exchangeReturn(exchangeForm.returnId, {
      lineId: exchangeForm.lineId,
      qty: exchangeForm.qty,
      exchangeProductId: exchangeForm.exchangeProductId,
      exchangeUnitPrice: exchangeForm.exchangeUnitPrice || undefined,
      remark: exchangeForm.remark || undefined
    })
    ElMessage.success(`换货单已生成（销售单 #${result.orderId}、出库单 #${result.shipmentId}）`)
    exchangeVisible.value = false
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '换货失败')
  }
}

function handlePage(value: number): void { query.value.page = value; void load() }
function handlePageSize(value: number): void { query.value.pageSize = value; void load() }

onMounted(load)
onUnmounted(() => { requestSeq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>销售退货</h2>
      <p>红字单据：退货原因、退款金额、处置方式；审核后回补库存并冲减信用占用。审核通过的退货可发起换货，生成换货销售单与换货出库单。</p>
    </header>
    <BaseGrid
      :columns="view.visibleColumns.value" :density="view.density.value"
      :rows="rows" :loading="loading" :error="error" :total="total"
      :page="query.page" :page-size="query.pageSize" perm-prefix="sales:return"
      @refresh="load" @add="openAdd" @update:page="handlePage" @update:page-size="handlePageSize"
    >
      <template #toolbar>
        <ViewConfigToolbar
          page-key="sales.return"
          :columns="columns"
          :view="view"
          title="销售退货"
          route="/sales/return"
        />
        <el-input v-model="query.keyword" placeholder="搜索退货单" clearable @keyup.enter="load" />
      </template>
      <template #row-extra="{ row }">
        <el-button link type="warning" v-perm="'sales:return:exchange'" @click.stop="openExchange(row)">换货</el-button>
      </template>
    </BaseGrid>

    <el-dialog v-model="dialogVisible" title="新建退货单" width="760px">
      <el-form label-width="90px">
        <el-form-item label="客户ID"><el-input-number v-model="form.customerId" :min="1" /></el-form-item>
        <el-form-item label="原订单ID"><el-input-number v-model="form.orderId" :min="0" /></el-form-item>
        <el-form-item label="退货原因"><el-input v-model="form.reason" /></el-form-item>
      </el-form>
      <el-table :data="lines" size="small">
        <el-table-column label="产品ID" width="130">
          <template #default="{ row }"><el-input :model-value="lineValue(row, 'productId')" @update:model-value="setLineValue(row, 'productId', $event)" /></template>
        </el-table-column>
        <el-table-column label="数量" width="120">
          <template #default="{ row }"><el-input :model-value="lineValue(row, 'qty')" @update:model-value="setLineValue(row, 'qty', $event)" /></template>
        </el-table-column>
        <el-table-column label="退款金额">
          <template #default="{ row }"><el-input :model-value="lineValue(row, 'amount')" @update:model-value="setLineValue(row, 'amount', $event)" /></template>
        </el-table-column>
        <el-table-column width="70">
          <template #default><el-button link type="danger" :disabled="lines.length <= 1" @click="lines.pop()">删</el-button></template>
        </el-table-column>
      </el-table>
      <el-button class="add-line" @click="lines.push({ productId: 0, qty: '1', amount: '0' })">添加明细</el-button>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="exchangeVisible" title="退货换货" width="820px">
      <div v-loading="exchangeLoading">
        <el-form label-width="110px">
          <el-form-item label="退货明细行">
            <el-select v-model="exchangeForm.lineId" placeholder="选择退货明细" style="width: 320px">
              <el-option
                v-for="item in exchangeDetail?.lines ?? []"
                :key="item.id"
                :label="`#${item.id} 产品 ${item.productId} 数量 ${item.qty} 质检 ${item.qcStatus ?? '-'}`"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="换货数量"><el-input v-model="exchangeForm.qty" style="width: 180px" /></el-form-item>
          <el-form-item label="换货商品ID"><el-input-number v-model="exchangeForm.exchangeProductId" :min="1" /></el-form-item>
          <el-form-item label="换货单价"><el-input v-model="exchangeForm.exchangeUnitPrice" placeholder="留空取商品售价" style="width: 180px" /></el-form-item>
          <el-form-item label="备注"><el-input v-model="exchangeForm.remark" /></el-form-item>
        </el-form>
        <el-divider content-position="left">已有换货记录</el-divider>
        <el-table :data="exchangeDetail?.exchanges ?? []" size="small" border>
          <el-table-column prop="id" label="记录ID" width="90" />
          <el-table-column prop="exchangeOrderId" label="换货销售单" width="120" />
          <el-table-column prop="exchangeShipmentId" label="换货出库单" width="120" />
          <el-table-column prop="exchangeQty" label="数量" width="90" />
          <el-table-column prop="exchangeStatus" label="状态" width="110" />
          <el-table-column prop="remark" label="备注" min-width="140" />
        </el-table>
      </div>
      <template #footer>
        <el-button @click="exchangeVisible = false">取消</el-button>
        <el-button type="primary" @click="submitExchange">生成换货单</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.add-line { margin-top: 12px; }
</style>
