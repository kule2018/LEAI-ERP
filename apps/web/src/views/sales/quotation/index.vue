<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import BaseGrid from '@/components/BaseGrid.vue'
import ColumnSetting from '@/components/ColumnSetting.vue'
import FavoriteButton from '@/components/FavoriteButton.vue'
import { createQuotation, fetchQuotationDetail, fetchQuotations, type Quotation } from '@/api/sales'
import type { GridColumn, PageQuery } from '@/types/contract'
import { useViewConfig } from '@/utils/view-config'

const VIEW_PAGE_KEY = 'sales.quotation'

interface LineDraft {
  productId: number
  qty: string
  unitPrice: string
}

const columns: GridColumn[] = [
  { prop: 'quoteNo', label: '报价单号', width: 160 },
  { prop: 'customerId', label: '客户ID', width: 110 },
  { prop: 'quoteDate', label: '报价日期', width: 130 },
  { prop: 'expireDate', label: '有效期至', width: 130 },
  { prop: 'totalAmount', label: '金额', width: 140 },
  { prop: 'status', label: '状态', width: 110 }
]
const rows = ref<Quotation[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const query = ref<PageQuery>({ page: 1, pageSize: 20, keyword: '' })
const dialogVisible = ref(false)
const detailVisible = ref(false)
const detail = ref<{ quotation: Quotation; lines: Array<{ productId: number; qty: string; unitPrice: string; amount: string }> } | null>(null)
const form = reactive({ customerId: 0, quoteDate: '', expireDate: '' })
const lines = ref<LineDraft[]>([{ productId: 0, qty: '1', unitPrice: '0' }])
const { visibleProps, visibleColumns, load: loadViewConfig } = useViewConfig(VIEW_PAGE_KEY, columns)
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
    const result = await fetchQuotations(query.value)
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
  form.quoteDate = new Date().toISOString().slice(0, 10)
  form.expireDate = ''
  lines.value = [{ productId: 0, qty: '1', unitPrice: '0' }]
  dialogVisible.value = true
}

async function openDetail(row: unknown): Promise<void> {
  const quotation = row as Quotation
  try {
    detail.value = await fetchQuotationDetail(quotation.id)
    detailVisible.value = true
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '详情加载失败')
  }
}

async function save(): Promise<void> {
  try {
    await createQuotation({
      customerId: form.customerId,
      quoteDate: form.quoteDate,
      expireDate: form.expireDate || undefined,
      lines: lines.value
    })
    dialogVisible.value = false
    ElMessage.success('报价单已创建')
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  }
}

function handlePage(value: number): void { query.value.page = value; void load() }
function handlePageSize(value: number): void { query.value.pageSize = value; void load() }

onMounted(() => {
  void loadViewConfig()
  void load()
})
onUnmounted(() => { requestSeq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header">
      <h2>报价单</h2>
      <p>按客户维护报价版本与有效期；低于底价的报价需走审批。</p>
    </header>
    <BaseGrid
      :columns="visibleColumns" :rows="rows" :loading="loading" :error="error" :total="total"
      :page="query.page" :page-size="query.pageSize" perm-prefix="sales:quotation"
      @refresh="load" @add="openAdd" @row-click="openDetail"
      @update:page="handlePage" @update:page-size="handlePageSize"
    >
      <template #toolbar>
        <el-input v-model="query.keyword" placeholder="搜索报价单号" clearable @keyup.enter="load" />
        <ColumnSetting v-model="visibleProps" :page-key="VIEW_PAGE_KEY" :columns="columns" />
      </template>
      <template #row-extra="{ row }">
        <FavoriteButton
          target-type="RECORD"
          :target-key="`quotation:${row.id}`"
          :title="row.quoteNo"
          biz-type="quotation"
          :biz-id="row.id"
        />
      </template>
    </BaseGrid>

    <el-dialog v-model="dialogVisible" title="新建报价单" width="860px">
      <el-form label-width="90px">
        <el-form-item label="客户ID"><el-input-number v-model="form.customerId" :min="1" /></el-form-item>
        <el-form-item label="报价日期"><el-date-picker v-model="form.quoteDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
        <el-form-item label="有效期至"><el-date-picker v-model="form.expireDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
      </el-form>
      <h4>报价明细</h4>
      <el-table :data="lines" row-key="productId" size="small">
        <el-table-column label="产品ID" width="130">
          <template #default="{ row }"><el-input :model-value="lineValue(row, 'productId')" @update:model-value="setLineValue(row, 'productId', $event)" /></template>
        </el-table-column>
        <el-table-column label="数量" width="130">
          <template #default="{ row }"><el-input :model-value="lineValue(row, 'qty')" @update:model-value="setLineValue(row, 'qty', $event)" /></template>
        </el-table-column>
        <el-table-column label="单价" width="130">
          <template #default="{ row }"><el-input :model-value="lineValue(row, 'unitPrice')" @update:model-value="setLineValue(row, 'unitPrice', $event)" /></template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default><el-button link type="danger" :disabled="lines.length <= 1" @click="lines.pop()">删除</el-button></template>
        </el-table-column>
      </el-table>
      <el-button class="add-line" @click="lines.push({ productId: 0, qty: '1', unitPrice: '0' })">添加明细</el-button>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="报价单明细" width="720px">
      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item label="单号">{{ detail.quotation.quoteNo }}</el-descriptions-item>
        <el-descriptions-item label="客户ID">{{ detail.quotation.customerId }}</el-descriptions-item>
        <el-descriptions-item label="金额">{{ detail.quotation.totalAmount }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ detail.quotation.status }}</el-descriptions-item>
      </el-descriptions>
      <el-table v-if="detail" :data="detail.lines" size="small" class="detail-table">
        <el-table-column prop="productId" label="产品ID" />
        <el-table-column prop="qty" label="数量" />
        <el-table-column prop="unitPrice" label="单价" />
        <el-table-column prop="amount" label="金额" />
      </el-table>
    </el-dialog>
  </section>
</template>

<style scoped>
.add-line { margin-top: 12px; }
.detail-table { margin-top: 16px; }
</style>
