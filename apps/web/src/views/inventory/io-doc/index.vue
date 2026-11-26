<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  addIoAttachment,
  createIoDoc,
  fetchIoDoc,
  fetchIoDocs,
  fetchIoTypes,
  postIoDoc,
  removeIoAttachment,
  reverseIoDoc,
  type IoTypeMeta,
  type StockIoDetail,
  type StockIoDocument,
  type StockIoLineInput
} from '@/api/inventory'
import { fetchProducts, fetchWarehouses, type Product, type Warehouse } from '@/api/master-data'
import { createPrintJob } from '@/api/print'
import { requestBlob } from '@/utils/http'

const rows = ref<StockIoDocument[]>([])
const types = ref<IoTypeMeta[]>([])
const warehouses = ref<Warehouse[]>([])
const products = ref<Product[]>([])
const loading = ref(false)
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const query = reactive({ ioType: '', status: '', keyword: '' })

const createVisible = ref(false)
const creating = ref(false)
const form = reactive({
  ioType: 'PURCHASE_IN',
  warehouseId: 0,
  docDate: '',
  provisionalAmount: '',
  remark: '',
  lines: [] as StockIoLineInput[]
})

const detailVisible = ref(false)
const detail = ref<StockIoDetail | null>(null)

const reverseVisible = ref(false)
const reverseReason = ref('')
const reverseTarget = ref<StockIoDocument | null>(null)

const currentType = () => types.value.find((item) => item.code === form.ioType)

function statusLabel(status: string): string {
  return status === 'POSTED' ? '已过账' : status === 'REVERSED' ? '已冲销' : '草稿'
}

function statusTag(status: string): 'success' | 'info' | 'warning' {
  return status === 'POSTED' ? 'success' : status === 'REVERSED' ? 'info' : 'warning'
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const result = await fetchIoDocs({
      page: page.value,
      pageSize: pageSize.value,
      ioType: query.ioType || undefined,
      status: query.status || undefined,
      keyword: query.keyword || undefined
    })
    rows.value = result.list
    total.value = result.total
  } finally {
    loading.value = false
  }
}

function handleSearch(): void {
  page.value = 1
  void load()
}

function handleReset(): void {
  query.ioType = ''
  query.status = ''
  query.keyword = ''
  page.value = 1
  void load()
}

function openCreate(): void {
  form.ioType = 'PURCHASE_IN'
  form.warehouseId = warehouses.value[0]?.id ?? 0
  form.docDate = new Date().toISOString().slice(0, 10)
  form.provisionalAmount = ''
  form.remark = ''
  form.lines = [{ productId: 0, qtyIn: '1', qtyOut: '', unitCost: '', isProvisional: false }]
  createVisible.value = true
}

function addLine(): void {
  form.lines.push({ productId: 0, qtyIn: '', qtyOut: '', unitCost: '', isProvisional: false })
}

function removeLine(index: number): void {
  form.lines.splice(index, 1)
}

function applyTypeDirection(): void {
  const meta = currentType()
  if (!meta) return
  form.lines.forEach((line) => {
    if (meta.direction === 'IN') {
      line.qtyOut = ''
      if (!line.qtyIn) line.qtyIn = '1'
    } else if (meta.direction === 'OUT') {
      line.qtyIn = ''
      if (!line.qtyOut) line.qtyOut = '1'
    }
  })
}

async function submitCreate(): Promise<void> {
  if (!form.warehouseId) {
    ElMessage.warning('请选择仓库')
    return
  }
  if (form.lines.length === 0) {
    ElMessage.warning('请至少添加一行明细')
    return
  }
  creating.value = true
  try {
    const result = await createIoDoc({
      ioType: form.ioType,
      warehouseId: form.warehouseId,
      docDate: form.docDate || undefined,
      provisionalAmount: form.provisionalAmount || undefined,
      remark: form.remark || undefined,
      lines: form.lines.map((line) => ({
        productId: line.productId,
        qtyIn: line.qtyIn || undefined,
        qtyOut: line.qtyOut || undefined,
        unitCost: line.unitCost || undefined,
        isProvisional: line.isProvisional
      }))
    })
    ElMessage.success(`单据 ${result.doc.docNo} 已保存为草稿`)
    createVisible.value = false
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    creating.value = false
  }
}

async function openDetail(row: StockIoDocument): Promise<void> {
  detail.value = await fetchIoDoc(row.id)
  detailVisible.value = true
}

async function handlePost(row: StockIoDocument): Promise<void> {
  await ElMessageBox.confirm(`确认过账单据 ${row.docNo} ？`, '提示', { type: 'warning' })
  await postIoDoc(row.id)
  ElMessage.success('过账成功')
  await load()
}

function openReverse(row: StockIoDocument): void {
  reverseTarget.value = row
  reverseReason.value = ''
  reverseVisible.value = true
}

async function submitReverse(): Promise<void> {
  if (!reverseTarget.value) return
  if (!reverseReason.value.trim()) {
    ElMessage.warning('请填写冲销原因')
    return
  }
  await reverseIoDoc(reverseTarget.value.id, reverseReason.value.trim())
  ElMessage.success('冲销成功')
  reverseVisible.value = false
  await load()
}

async function handlePrint(row: StockIoDocument): Promise<void> {
  try {
    const record = await createPrintJob({ bizType: 'stock_io', bizId: row.id, bizNo: row.docNo })
    const blob = await requestBlob({ url: `/print/records/${record.id}/html`, method: 'get' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    ElMessage.success('打印预览已生成')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '打印任务创建失败')
  }
}

/** 明细弹窗内登记附件 */
async function handleDetailUpload(file: File): Promise<void> {
  if (!detail.value) return
  await addIoAttachment(detail.value.doc.id, { fileName: file.name, fileSize: file.size })
  ElMessage.success('附件登记成功')
  detail.value = await fetchIoDoc(detail.value.doc.id)
}

async function handleRemoveAttachment(attachmentId: number): Promise<void> {
  if (!detail.value) return
  await removeIoAttachment(detail.value.doc.id, attachmentId)
  ElMessage.success('附件已删除')
  detail.value = await fetchIoDoc(detail.value.doc.id)
}

onMounted(async () => {
  types.value = await fetchIoTypes()
  const [warehouseResult, productResult] = await Promise.all([
    fetchWarehouses({ page: 1, pageSize: 200 }),
    fetchProducts({ page: 1, pageSize: 200 })
  ])
  warehouses.value = warehouseResult.list
  products.value = productResult.list
  await load()
})
</script>

<template>
  <div class="io-doc-page">
    <section class="io-doc-filter">
      <el-form :inline="true" @submit.prevent="handleSearch">
        <el-form-item label="单据类型">
          <el-select v-model="query.ioType" clearable placeholder="全部" style="width: 170px">
            <el-option v-for="item in types" :key="item.code" :label="item.label" :value="item.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" clearable placeholder="全部" style="width: 140px">
            <el-option label="草稿" value="DRAFT" />
            <el-option label="已过账" value="POSTED" />
            <el-option label="已冲销" value="REVERSED" />
          </el-select>
        </el-form-item>
        <el-form-item label="单据号">
          <el-input v-model="query.keyword" placeholder="单据号" clearable style="width: 200px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </section>

    <section class="io-doc-table">
      <div class="io-doc-toolbar">
        <el-button type="primary" v-perm="'inventory:io-doc:create'" @click="openCreate">新建出入库单</el-button>
        <el-button @click="load">刷新</el-button>
      </div>

      <el-table v-loading="loading" :data="rows" border stripe>
        <el-table-column prop="docNo" label="单据号" width="180" show-overflow-tooltip />
        <el-table-column label="类型" width="130">
          <template #default="{ row }">
            {{ types.find((item) => item.code === row.ioType)?.label ?? row.ioType }}
          </template>
        </el-table-column>
        <el-table-column label="方向" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.direction === 'IN' ? 'success' : 'warning'">
              {{ row.direction === 'IN' ? '入库' : '出库' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="warehouseId" label="仓库 ID" width="100" />
        <el-table-column label="金额" width="140">
          <template #default="{ row }">
            <div>成本：{{ row.costAmount }}</div>
            <div v-if="Number(row.provisionalAmount) > 0">暂估：{{ row.provisionalAmount }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="statusTag(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="docDate" label="单据日期" width="120" />
        <el-table-column label="操作" fixed="right" width="260">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">明细</el-button>
            <el-button
              v-if="row.status === 'DRAFT'"
              link
              type="success"
              v-perm="'inventory:io-doc:post'"
              @click="handlePost(row)"
            >
              过账
            </el-button>
            <el-button
              v-if="row.status === 'POSTED'"
              link
              type="warning"
              v-perm="'inventory:io-doc:reverse'"
              @click="openReverse(row)"
            >
              冲销
            </el-button>
            <el-button link v-perm="'inventory:io-doc:view'" @click="handlePrint(row)">打印</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="io-doc-pagination">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          :current-page="page"
          :page-size="pageSize"
          :page-sizes="[20, 50, 100]"
          @current-change="(value: number) => { page = value; load() }"
          @size-change="(value: number) => { pageSize = value; page = 1; load() }"
        />
      </div>
    </section>

    <el-dialog v-model="createVisible" title="新建出入库单" width="960px">
      <el-form label-width="96px">
        <el-form-item label="单据类型">
          <el-select v-model="form.ioType" style="width: 220px" @change="applyTypeDirection">
            <el-option v-for="item in types" :key="item.code" :label="item.label" :value="item.code" />
          </el-select>
          <span v-if="currentType()" class="io-doc-tip">
            {{ currentType()?.allowProvisional ? '支持暂估成本' : '不支持暂估成本' }} ·
            {{ currentType()?.requireCost ? '需填写成本' : '成本可后补' }} ·
            {{ currentType()?.requireAttachment ? '过账前需上传附件' : '附件可选' }}
          </span>
        </el-form-item>
        <el-form-item label="仓库">
          <el-select v-model="form.warehouseId" style="width: 220px">
            <el-option
              v-for="item in warehouses"
              :key="item.id"
              :label="`${item.warehouseName} (${item.warehouseCode})`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="单据日期">
          <el-date-picker v-model="form.docDate" type="date" value-format="YYYY-MM-DD" style="width: 220px" />
        </el-form-item>
        <el-form-item label="暂估金额">
          <el-input v-model="form.provisionalAmount" placeholder="存在暂估行时必填" style="width: 220px" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>

      <el-table :data="form.lines" border size="small">
        <el-table-column label="商品" min-width="220">
          <template #default="{ row }">
            <el-select v-model="row.productId" filterable placeholder="选择商品">
              <el-option
                v-for="item in products"
                :key="item.id"
                :label="`${item.productName} (${item.productCode})`"
                :value="item.id"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="批次号" width="140">
          <template #default="{ row }">
            <el-input v-model="row.batchNo" />
          </template>
        </el-table-column>
        <el-table-column label="入库数量" width="120">
          <template #default="{ row }">
            <el-input v-model="row.qtyIn" :disabled="currentType()?.direction === 'OUT'" />
          </template>
        </el-table-column>
        <el-table-column label="出库数量" width="120">
          <template #default="{ row }">
            <el-input v-model="row.qtyOut" :disabled="currentType()?.direction === 'IN'" />
          </template>
        </el-table-column>
        <el-table-column label="单位成本" width="120">
          <template #default="{ row }">
            <el-input v-model="row.unitCost" placeholder="单位成本" />
          </template>
        </el-table-column>
        <el-table-column label="暂估" width="80" align="center">
          <template #default="{ row }">
            <el-checkbox v-model="row.isProvisional" :disabled="!currentType()?.allowProvisional" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="70" align="center">
          <template #default="{ $index }">
            <el-button link type="danger" @click="removeLine($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="io-doc-line-actions">
        <el-button link type="primary" @click="addLine">添加明细行</el-button>
      </div>

      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="submitCreate">保存草稿</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="出入库单明细" width="900px">
      <template v-if="detail">
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="单据号">{{ detail.doc.docNo }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag size="small" :type="statusTag(detail.doc.status)">{{ statusLabel(detail.doc.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="成本金额">{{ detail.doc.costAmount }}</el-descriptions-item>
          <el-descriptions-item label="暂估金额">{{ detail.doc.provisionalAmount }}</el-descriptions-item>
          <el-descriptions-item label="冲销原因">{{ detail.doc.reversalReason ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="备注">{{ detail.doc.remark ?? '-' }}</el-descriptions-item>
        </el-descriptions>

        <el-table :data="detail.lines" border size="small" class="io-doc-detail-table">
          <el-table-column prop="productId" label="商品 ID" width="110" />
          <el-table-column prop="batchNo" label="批次号" width="120" />
          <el-table-column prop="qtyIn" label="入库数量" width="110" />
          <el-table-column prop="qtyOut" label="出库数量" width="110" />
          <el-table-column prop="unitCost" label="单位成本" width="110" />
          <el-table-column prop="amount" label="金额" width="120" />
          <el-table-column label="暂估" width="80" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.isProvisional" size="small" type="warning">暂估</el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>

        <div class="io-doc-attachments">
          <div class="io-doc-attachments-title">附件</div>
          <el-upload
            v-if="detail.doc.status === 'DRAFT'"
            :auto-upload="false"
            :show-file-list="false"
            :on-change="(file: any) => handleDetailUpload(file.raw)"
          >
            <el-button size="small" v-perm="'inventory:io-doc:create'">上传附件</el-button>
          </el-upload>
          <ul class="io-doc-attachment-list">
            <li v-for="item in detail.attachments" :key="item.id">
              <span>{{ item.fileName }}</span>
              <el-button
                v-if="detail.doc.status === 'DRAFT'"
                link
                type="danger"
                size="small"
                v-perm="'inventory:io-doc:create'"
                @click="handleRemoveAttachment(item.id)"
              >
                删除
              </el-button>
            </li>
            <li v-if="detail.attachments.length === 0" class="io-doc-empty">暂无附件</li>
          </ul>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="reverseVisible" title="冲销单据" width="480px">
      <el-form label-width="80px">
        <el-form-item label="单据号">{{ reverseTarget?.docNo }}</el-form-item>
        <el-form-item label="冲销原因">
          <el-input v-model="reverseReason" type="textarea" :rows="3" placeholder="请填写冲销原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reverseVisible = false">取消</el-button>
        <el-button type="warning" v-perm="'inventory:io-doc:reverse'" @click="submitReverse">确认冲销</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.io-doc-page {
  display: flex;
  flex-direction: column;
  gap: var(--erp-space-4);
}

.io-doc-filter,
.io-doc-table {
  padding: var(--erp-space-4);
  background: #fff;
  border-radius: var(--erp-radius-base);
}

.io-doc-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--erp-space-2);
  margin-bottom: var(--erp-space-4);
}

.io-doc-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--erp-space-4);
}

.io-doc-tip {
  margin-left: 12px;
  color: #909399;
  font-size: 12px;
}

.io-doc-line-actions {
  margin-top: var(--erp-space-2);
}

.io-doc-detail-table {
  margin-top: var(--erp-space-3);
}

.io-doc-attachments {
  margin-top: var(--erp-space-4);
}

.io-doc-attachments-title {
  margin-bottom: var(--erp-space-2);
  font-weight: 600;
}

.io-doc-attachment-list {
  margin: var(--erp-space-2) 0 0;
  padding-left: 18px;
}

.io-doc-empty {
  color: #909399;
}
</style>
