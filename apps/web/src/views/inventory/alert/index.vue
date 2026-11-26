<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { closeAlert, createAlert, fetchAlertPolicies, fetchAlerts, fetchBatchProfiles, saveAlertPolicy, saveBatchProfile, scanAlerts, type BatchProfile, type InventoryQuery, type StockAlert, type StockAlertPolicy } from '@/api/inventory'

const rows = ref<StockAlert[]>([])
const batches = ref<BatchProfile[]>([])
const policies = ref<StockAlertPolicy[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<InventoryQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const form = reactive({ alertType: 'LOW_STOCK', productId: 0, warehouseId: 0, thresholdQty: '0', message: '' })
const batchForm = reactive({ productId: 0, batchNo: '', expiryDate: '', shelfLifeDays: 0, qty: '0' })
const policyForm = reactive({ productId: 0, warehouseId: 0, warnDays: 30, urgentDays: 7, safetyStock: '0', slowMovingDays: 0 })
const closeVisible = ref(false)
const closeTarget = ref<StockAlert | null>(null)
const closeReason = ref('')
const alertKey = ref(newKey())
const batchKey = ref(newKey())
function newKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchAlerts(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void { Object.assign(form, { alertType: 'LOW_STOCK', productId: 0, warehouseId: 0, thresholdQty: '0', message: '' }); alertKey.value = newKey(); visible.value = true }
async function save(): Promise<void> {
  try {
    await createAlert({ ...form }, alertKey.value)
    visible.value = false
    alertKey.value = newKey()
    ElMessage.success('预警已创建')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
async function handleClose(row: unknown): Promise<void> {
  closeTarget.value = row as StockAlert
  closeReason.value = ''
  closeVisible.value = true
}
async function submitClose(): Promise<void> {
  if (!closeTarget.value) return
  if (!closeReason.value.trim()) { ElMessage.warning('请填写关闭原因'); return }
  try {
    await closeAlert(closeTarget.value.id, closeReason.value.trim())
    closeVisible.value = false
    ElMessage.success('已关闭')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '操作失败') }
}
function handlePage(value: number): void { query.value.page = value; void load() }
async function loadBatches(): Promise<void> {
  try { batches.value = await fetchBatchProfiles({ pageSize: 100 }) }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '批次加载失败') }
}
async function saveBatch(): Promise<void> {
  if (!batchForm.productId || !batchForm.batchNo) { ElMessage.warning('请填写产品ID与批次号'); return }
  try {
    await saveBatchProfile({
      productId: batchForm.productId,
      batchNo: batchForm.batchNo,
      expiryDate: batchForm.expiryDate || undefined,
      shelfLifeDays: batchForm.shelfLifeDays || undefined,
      qty: batchForm.qty
    }, batchKey.value)
    ElMessage.success('批次档案已保存')
    batchKey.value = newKey()
    batchForm.batchNo = ''
    await loadBatches()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
async function runScan(): Promise<void> {
  try {
    const result = await scanAlerts({})
    ElMessage.success(`巡检完成：新增 ${result.created}，更新 ${result.updated}，重开 ${result.reopened}，自动关闭 ${result.closed}`)
    await load()
    await loadBatches()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '巡检失败') }
}
async function loadPolicies(): Promise<void> {
  try { policies.value = await fetchAlertPolicies() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '策略加载失败') }
}
async function savePolicy(): Promise<void> {
  try {
    await saveAlertPolicy({
      productId: policyForm.productId,
      warehouseId: policyForm.warehouseId,
      warnDays: policyForm.warnDays,
      urgentDays: policyForm.urgentDays,
      safetyStock: policyForm.safetyStock,
      slowMovingDays: policyForm.slowMovingDays
    })
    ElMessage.success('策略已保存')
    await loadPolicies()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
onMounted(() => { void load(); void loadBatches(); void loadPolicies() })
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>库存预警</h2><p>低库存、呆滞、临期和 AI 补货建议入口；关闭预警需记录原因。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-button type="primary" v-perm="'inventory:alert:create'" @click="openAdd">新增预警</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="alertType" label="类型" width="140" />
        <el-table-column prop="alertLevel" label="级别" width="100" />
        <el-table-column prop="batchNo" label="批次" width="130" />
        <el-table-column prop="productId" label="产品ID" width="100" />
        <el-table-column prop="warehouseId" label="仓库ID" width="100" />
        <el-table-column prop="thresholdQty" label="阈值" width="120" />
        <el-table-column prop="currentQty" label="当前量" width="120" />
        <el-table-column prop="suggestQty" label="建议量" width="120" />
        <el-table-column prop="status" label="状态" width="100" />
        <el-table-column prop="message" label="说明" min-width="180" />
        <el-table-column label="操作" width="90"><template #default="{ row }"><el-button link type="primary" v-perm="'inventory:alert:update'" @click="handleClose(row)">关闭</el-button></template></el-table-column>
      </el-table>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
    </article>
    <article class="panel">
      <div class="toolbar">
        <h3>批次效期与临期巡检</h3>
        <el-button type="primary" v-perm="'inventory:alert:create'" @click="runScan">执行临期巡检</el-button>
        <el-button @click="loadBatches">刷新批次</el-button>
      </div>
      <el-form inline>
        <el-form-item label="产品ID"><el-input-number v-model="batchForm.productId" :min="1" /></el-form-item>
        <el-form-item label="批次号"><el-input v-model="batchForm.batchNo" /></el-form-item>
        <el-form-item label="到期日期"><el-date-picker v-model="batchForm.expiryDate" type="date" value-format="YYYY-MM-DD" placeholder="YYYY-MM-DD"  /></el-form-item>
        <el-form-item label="保质期(天)"><el-input-number v-model="batchForm.shelfLifeDays" :min="0" /></el-form-item>
        <el-form-item label="数量"><el-input v-model="batchForm.qty" style="width: 110px" /></el-form-item>
        <el-button type="primary" v-perm="'inventory:alert:create'" @click="saveBatch">登记批次</el-button>
      </el-form>
      <el-table :data="batches" row-key="id" size="small">
        <el-table-column prop="productId" label="产品ID" width="90" />
        <el-table-column prop="productName" label="产品名称" min-width="140" />
        <el-table-column prop="batchNo" label="批次号" width="150" />
        <el-table-column prop="expiryDate" label="到期日期" width="140" />
        <el-table-column prop="daysLeft" label="剩余天数" width="110" />
        <el-table-column prop="qty" label="数量" width="110" />
        <el-table-column prop="status" label="状态" width="110" />
      </el-table>
    </article>
    <article class="panel">
      <div class="toolbar">
        <h3>预警策略</h3>
        <el-button @click="loadPolicies">刷新策略</el-button>
      </div>
      <el-form inline>
        <el-form-item label="产品ID(0=全局)"><el-input-number v-model="policyForm.productId" :min="0" /></el-form-item>
        <el-form-item label="仓库ID(0=全部)"><el-input-number v-model="policyForm.warehouseId" :min="0" /></el-form-item>
        <el-form-item label="预警天数"><el-input-number v-model="policyForm.warnDays" :min="1" /></el-form-item>
        <el-form-item label="紧急天数"><el-input-number v-model="policyForm.urgentDays" :min="1" /></el-form-item>
        <el-form-item label="安全库存"><el-input v-model="policyForm.safetyStock" style="width: 110px" /></el-form-item>
        <el-form-item label="呆滞天数"><el-input-number v-model="policyForm.slowMovingDays" :min="0" /></el-form-item>
        <el-button type="primary" v-perm="'inventory:alert:create'" @click="savePolicy">保存策略</el-button>
      </el-form>
      <el-table :data="policies" row-key="id" size="small">
        <el-table-column prop="productId" label="产品ID" width="100" />
        <el-table-column prop="warehouseId" label="仓库ID" width="100" />
        <el-table-column prop="warnDays" label="预警天数" width="110" />
        <el-table-column prop="urgentDays" label="紧急天数" width="110" />
        <el-table-column prop="safetyStock" label="安全库存" width="120" />
        <el-table-column prop="slowMovingDays" label="呆滞天数" width="110" />
        <el-table-column prop="status" label="状态" width="100" />
      </el-table>
    </article>
    <el-dialog v-model="visible" title="新增库存预警" width="520px">
      <el-form label-width="90px">
        <el-form-item label="类型"><el-select v-model="form.alertType"><el-option label="低库存" value="LOW_STOCK" /><el-option label="呆滞库存" value="SLOW_MOVING" /><el-option label="临期" value="EXPIRING" /></el-select></el-form-item>
        <el-form-item label="产品ID"><el-input-number v-model="form.productId" :min="1" /></el-form-item>
        <el-form-item label="仓库ID"><el-input-number v-model="form.warehouseId" :min="0" /></el-form-item>
        <el-form-item label="阈值"><el-input v-model="form.thresholdQty" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="form.message" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
    <el-dialog v-model="closeVisible" title="关闭预警" width="480px">
      <el-form label-width="90px">
        <el-form-item label="预警"><span>{{ closeTarget?.alertType }} / {{ closeTarget?.alertLevel }} / {{ closeTarget?.message }}</span></el-form-item>
        <el-form-item label="关闭原因"><el-input v-model="closeReason" type="textarea" :rows="3" placeholder="关闭预警必须填写原因" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="closeVisible = false">取消</el-button><el-button type="primary" @click="submitClose">确认关闭</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
