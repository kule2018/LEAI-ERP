<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { approveStocktake, createStocktake, fetchStocktakes, recountStocktake, rejectStocktakeApproval, submitStocktakeApproval, type InventoryQuery, type Stocktake } from '@/api/inventory'
import { submitOfflineForm } from '@/utils/offline-form'

const rows = ref<Stocktake[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<InventoryQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const form = reactive({ warehouseId: 0, planDate: '' })
const lines = ref([{ productId: 0, bookQty: '0', actualQty: '0' }])
const scanVisible = ref(false)
const recountVisible = ref(false)
const current = ref<Stocktake | null>(null)
const scans = ref<Array<{ lineId?: number; productId?: number; batchNo?: string; barcode?: string; qty: string }>>([{ qty: '0' }])
const recounts = ref<Array<{ lineId: number; recountQty: string }>>([])
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchStocktakes(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void { Object.assign(form, { warehouseId: 0, planDate: '' }); lines.value = [{ productId: 0, bookQty: '0', actualQty: '0' }]; visible.value = true }
async function save(): Promise<void> {
  try {
    await createStocktake({
      warehouseId: form.warehouseId,
      planDate: form.planDate || undefined,
      lines: lines.value
    })
    visible.value = false
    ElMessage.success('盘点单已创建')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
async function approve(row: unknown): Promise<void> {
  const stocktake = row as Stocktake
  try { await approveStocktake(stocktake.id); ElMessage.success('盘点差异已过账'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '过账失败') }
}

/** 提交差异审批：无差异直接过账，有差异进入审批中 */
async function submitApproval(row: unknown): Promise<void> {
  const stocktake = row as Stocktake
  try { await submitStocktakeApproval(stocktake.id); ElMessage.success('盘点差异已提交审批'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '提交审批失败') }
}

/** 驳回差异审批 */
async function rejectApproval(row: unknown): Promise<void> {
  const stocktake = row as Stocktake
  try { await rejectStocktakeApproval(stocktake.id); ElMessage.success('盘点差异审批已驳回'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '驳回失败') }
}
function handlePage(value: number): void { query.value.page = value; void load() }

/** 扫码实盘：支持按盘点行/产品/条码录入实盘数量 */
function openScan(row: unknown): void {
  current.value = row as Stocktake
  scans.value = [{ qty: '0' }]
  scanVisible.value = true
}

async function submitScan(): Promise<void> {
  if (!current.value) return
  const payload = scans.value.filter((item) => item.lineId || item.productId || item.barcode)
  // 扫码实盘支持离线暂存：断网时按盘点单维度入队，恢复后按同一幂等键补录
  const result = await submitOfflineForm<Record<string, unknown>>({
    formType: 'STOCKTAKE',
    label: `盘点扫码实盘（盘点单 ${current.value.id}）`,
    url: `/inventory/stocktakes/${current.value.id}/scan`,
    method: 'post',
    data: { scans: payload }
  })
  if (result.status === 'success') {
    scanVisible.value = false
    ElMessage.success('扫码实盘已记录')
    await load()
    return
  }
  if (result.status === 'queued') {
    scanVisible.value = false
    ElMessage.warning(`网络不可用，扫码实盘已暂存待同步（本地单号 ${result.localNo}）`)
    return
  }
  if (result.status === 'conflict') {
    ElMessage.error(`该扫码实盘疑似已提交，请核对：${result.message ?? ''}`)
    return
  }
  ElMessage.error(result.message ?? '扫码实盘失败')
}

/** 复盘：录入复盘数量，差异以复盘结果为准 */
function openRecount(row: unknown): void {
  current.value = row as Stocktake
  recounts.value = []
  recountVisible.value = true
}

async function submitRecount(): Promise<void> {
  if (!current.value) return
  try {
    await recountStocktake(current.value.id, recounts.value.filter((item) => item.lineId))
    recountVisible.value = false
    ElMessage.success('复盘结果已保存')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '复盘失败') }
}onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>盘点</h2><p>录入账面量和实盘量，审核后按差异生成库存流水。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-button type="primary" v-perm="'inventory:stocktake:create'" @click="openAdd">新建盘点</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="stocktakeNo" label="盘点单号" width="170" />
        <el-table-column prop="warehouseId" label="仓库ID" width="110" />
        <el-table-column prop="planDate" label="计划日期" width="130" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column label="操作" width="320">
          <template #default="{ row }">
            <el-button link type="primary" v-perm="'inventory:stocktake:create'" @click="openScan(row)">扫码实盘</el-button>
            <el-button link type="warning" v-perm="'inventory:stocktake:approve'" @click="openRecount(row)">复盘</el-button>
            <el-button link type="primary" v-perm="'inventory:stocktake:create'" :disabled="!['DRAFT', 'COUNTING', 'RECOUNTED', 'REJECTED'].includes(row.status)" @click="submitApproval(row)">提交审批</el-button>
            <el-button link type="success" v-perm="'inventory:stocktake:approve'" :disabled="row.status !== 'PENDING_APPROVAL'" @click="approve(row)">审批通过</el-button>
            <el-button link type="danger" v-perm="'inventory:stocktake:approve'" :disabled="row.status !== 'PENDING_APPROVAL'" @click="rejectApproval(row)">驳回</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
    </article>
    <el-dialog v-model="visible" title="新建盘点" width="760px">
      <el-form label-width="90px">
        <el-form-item label="仓库ID"><el-input-number v-model="form.warehouseId" :min="1" /></el-form-item>
        <el-form-item label="计划日期"><el-date-picker v-model="form.planDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
      </el-form>
      <el-table :data="lines" size="small">
        <el-table-column label="产品ID" width="130"><template #default="{ row }"><el-input v-model="row.productId" /></template></el-table-column>
        <el-table-column label="账面量" width="130"><template #default="{ row }"><el-input v-model="row.bookQty" /></template></el-table-column>
        <el-table-column label="实盘量"><template #default="{ row }"><el-input v-model="row.actualQty" /></template></el-table-column>
        <el-table-column width="70"><template #default><el-button link type="danger" :disabled="lines.length <= 1" @click="lines.pop()">删</el-button></template></el-table-column>
      </el-table>
      <el-button class="add-line" @click="lines.push({ productId: 0, bookQty: '0', actualQty: '0' })">加行</el-button>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="scanVisible" title="扫码实盘" width="720px">
      <el-table :data="scans" size="small">
        <el-table-column label="盘点行ID" width="120"><template #default="{ row }"><el-input v-model="row.lineId" placeholder="可选" /></template></el-table-column>
        <el-table-column label="产品ID" width="120"><template #default="{ row }"><el-input v-model="row.productId" placeholder="可选" /></template></el-table-column>
        <el-table-column label="批次号" width="140"><template #default="{ row }"><el-input v-model="row.batchNo" placeholder="可选" /></template></el-table-column>
        <el-table-column label="条码" width="150"><template #default="{ row }"><el-input v-model="row.barcode" placeholder="可选" /></template></el-table-column>
        <el-table-column label="实盘数量" width="120"><template #default="{ row }"><el-input v-model="row.qty" /></template></el-table-column>
        <el-table-column width="70"><template #default><el-button link type="danger" :disabled="scans.length <= 1" @click="scans.pop()">删</el-button></template></el-table-column>
      </el-table>
      <el-button class="add-line" @click="scans.push({ qty: '0' })">加行</el-button>
      <template #footer><el-button @click="scanVisible = false">取消</el-button><el-button type="primary" @click="submitScan">提交实盘</el-button></template>
    </el-dialog>

    <el-dialog v-model="recountVisible" title="复盘" width="560px">
      <el-table :data="recounts" size="small">
        <el-table-column label="盘点行ID" width="160"><template #default="{ row }"><el-input v-model="row.lineId" /></template></el-table-column>
        <el-table-column label="复盘数量"><template #default="{ row }"><el-input v-model="row.recountQty" /></template></el-table-column>
        <el-table-column width="70"><template #default="scope"><el-button link type="danger" @click="recounts.splice(scope.$index, 1)">删</el-button></template></el-table-column>
      </el-table>
      <el-button class="add-line" @click="recounts.push({ lineId: 0, recountQty: '0' })">加行</el-button>
      <template #footer><el-button @click="recountVisible = false">取消</el-button><el-button type="primary" @click="submitRecount">提交复盘</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.add-line { margin-top: 12px; }
</style>
