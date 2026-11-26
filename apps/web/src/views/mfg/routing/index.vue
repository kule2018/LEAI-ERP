<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createCenter, createRouting, fetchCenters, fetchRoutingDetail, fetchRoutings, type ManufacturingQuery, type Routing, type WorkCenter } from '@/api/manufacturing'

const rows = ref<Routing[]>([])
const centers = ref<WorkCenter[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<ManufacturingQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const centerVisible = ref(false)
const detailVisible = ref(false)
const detail = ref<Array<Record<string, unknown>>>([])
const form = reactive({ productId: 0, version: '' })
const operations = ref([{ operationName: '', workCenterId: 0, standardMinutes: '0', sortNo: 0 }])
const centerForm = reactive({ centerCode: '', centerName: '', capacity: '0' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const [routingResult, centerResult] = await Promise.all([fetchRoutings(query.value), fetchCenters({ page: 1, pageSize: 100 })])
    if (current !== seq) return
    rows.value = routingResult.list
    total.value = routingResult.total
    centers.value = centerResult.list
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void { Object.assign(form, { productId: 0, version: '' }); operations.value = [{ operationName: '', workCenterId: 0, standardMinutes: '0', sortNo: 0 }]; visible.value = true }
async function save(): Promise<void> {
  try {
    await createRouting({ ...form, operations: operations.value })
    visible.value = false
    ElMessage.success('工艺路线已创建')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
function openCenter(): void { Object.assign(centerForm, { centerCode: '', centerName: '', capacity: '0' }); centerVisible.value = true }
async function saveCenter(): Promise<void> {
  try { await createCenter({ ...centerForm }); centerVisible.value = false; ElMessage.success('工作中心已创建'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
async function openDetail(row: unknown): Promise<void> {
  const routing = row as Routing
  try {
    const result = await fetchRoutingDetail(routing.id)
    detail.value = result.operations as unknown as Array<Record<string, unknown>>
    detailVisible.value = true
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '详情加载失败') }
}
function handlePage(value: number): void { query.value.page = value; void load() }
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>工艺路线</h2><p>按产品版本维护工序、工作中心和工时；右侧维护工作中心。</p></header>
    <div class="routing-layout">
      <article class="panel">
        <div class="toolbar">
          <el-button type="primary" v-perm="'mfg:routing:create'" @click="openAdd">新建工艺</el-button>
          <el-button @click="load">刷新</el-button>
        </div>
        <el-table v-loading="loading" :data="rows" row-key="id" @row-click="openDetail">
          <el-table-column prop="productId" label="产品ID" width="110" />
          <el-table-column prop="version" label="版本" width="130" />
          <el-table-column prop="status" label="状态" width="110" />
        </el-table>
        <el-pagination background layout="prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
      </article>
      <article class="panel">
        <div class="toolbar"><h3>工作中心</h3><el-button size="small" type="primary" @click="openCenter">新增</el-button></div>
        <el-table :data="centers" size="small" row-key="id">
          <el-table-column prop="centerCode" label="编码" width="120" />
          <el-table-column prop="centerName" label="名称" min-width="140" />
          <el-table-column prop="capacity" label="产能" width="110" />
        </el-table>
      </article>
    </div>
    <el-dialog v-model="visible" title="新建工艺路线" width="820px">
      <el-form label-width="90px">
        <el-form-item label="产品ID"><el-input-number v-model="form.productId" :min="1" /></el-form-item>
        <el-form-item label="版本"><el-input v-model="form.version" /></el-form-item>
      </el-form>
      <el-table :data="operations" size="small">
        <el-table-column label="工序名称" width="180"><template #default="{ row }"><el-input v-model="row.operationName" /></template></el-table-column>
        <el-table-column label="工作中心ID" width="140"><template #default="{ row }"><el-input v-model="row.workCenterId" /></template></el-table-column>
        <el-table-column label="标准工时" width="140"><template #default="{ row }"><el-input v-model="row.standardMinutes" /></template></el-table-column>
        <el-table-column label="顺序"><template #default="{ row }"><el-input v-model="row.sortNo" /></template></el-table-column>
        <el-table-column width="70"><template #default><el-button link type="danger" :disabled="operations.length <= 1" @click="operations.pop()">删</el-button></template></el-table-column>
      </el-table>
      <el-button class="add-line" @click="operations.push({ operationName: '', workCenterId: 0, standardMinutes: '0', sortNo: 0 })">加行</el-button>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
    <el-dialog v-model="centerVisible" title="新增工作中心" width="480px">
      <el-form label-width="90px">
        <el-form-item label="编码"><el-input v-model="centerForm.centerCode" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="centerForm.centerName" /></el-form-item>
        <el-form-item label="产能"><el-input v-model="centerForm.capacity" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="centerVisible = false">取消</el-button><el-button type="primary" @click="saveCenter">保存</el-button></template>
    </el-dialog>
    <el-dialog v-model="detailVisible" title="工序明细" width="760px">
      <el-table :data="detail" size="small">
        <el-table-column prop="operationName" label="工序" />
        <el-table-column prop="standardMinutes" label="标准工时" width="120" />
        <el-table-column prop="sortNo" label="顺序" width="90" />
        <el-table-column prop="workCenterId" label="工作中心" width="120" />
      </el-table>
    </el-dialog>
  </section>
</template>

<style scoped>
.routing-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.panel h3 { margin: 0; flex: 1; }
.toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; }
.add-line { margin-top: 12px; }
@media (max-width: 1100px) { .routing-layout { grid-template-columns: 1fr; } }
</style>
