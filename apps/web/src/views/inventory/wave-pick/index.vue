<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  completeWave, createWave, fetchPickPath, fetchWaveDetail, fetchWaves,
  type InventoryQuery, type PickTask, type PickWave
} from '@/api/inventory'
import { submitOfflineForm } from '@/utils/offline-form'

const rows = ref<PickWave[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<InventoryQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const detailVisible = ref(false)
const detail = ref<{ wave: PickWave; tasks: PickTask[] } | null>(null)
const form = reactive({ priority: 0 })
const tasks = ref([{ sourceId: 0, productId: 0, warehouseId: 0, qty: '1' }])
const pathResult = ref<Record<string, unknown> | null>(null)
const pathVisible = ref(false)
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchWaves(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void { form.priority = 0; tasks.value = [{ sourceId: 0, productId: 0, warehouseId: 0, qty: '1' }]; visible.value = true }
async function save(): Promise<void> {
  try {
    await createWave({ priority: form.priority, tasks: tasks.value })
    visible.value = false
    ElMessage.success('波次已创建')
    await load()
  } catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
async function openDetail(row: unknown): Promise<void> {
  const wave = row as PickWave
  try { detail.value = await fetchWaveDetail(wave.id); detailVisible.value = true }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '详情加载失败') }
}
async function handlePick(task: PickTask): Promise<void> {
  if (!detail.value) return
  // 拣货支持离线暂存：断网时按任务维度入队，恢复后按同一幂等键补录
  const result = await submitOfflineForm<Record<string, unknown>>({
    formType: 'WAVE_PICK',
    label: `波次拣货（波次 ${detail.value.wave.id} / 任务 ${task.id}）`,
    url: `/inventory/waves/${detail.value.wave.id}/tasks/${task.id}/pick`,
    method: 'post',
    data: { qty: task.qty }
  })
  if (result.status === 'success') {
    detail.value = await fetchWaveDetail(detail.value.wave.id)
    ElMessage.success('拣货完成')
    return
  }
  if (result.status === 'queued') {
    ElMessage.warning(`网络不可用，拣货已暂存待同步（本地单号 ${result.localNo}）`)
    return
  }
  if (result.status === 'conflict') {
    ElMessage.error(`该拣货任务疑似已提交，请核对：${result.message ?? ''}`)
    return
  }
  ElMessage.error(result.message ?? '拣货失败')
}
async function handleComplete(): Promise<void> {
  if (!detail.value) return
  try { await completeWave(detail.value.wave.id); detailVisible.value = false; ElMessage.success('波次已完成'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '完成失败') }
}
async function loadPickPath(): Promise<void> {
  if (!detail.value) return
  try { pathResult.value = await fetchPickPath(detail.value.wave.id); pathVisible.value = true; ElMessage.success('拣货路径已生成') }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '路径生成失败') }
}
function handlePage(value: number): void { query.value.page = value; void load() }
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>波次拣货</h2><p>按波次分配拣货任务，扫码或手工确认拣货数量。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-button type="primary" v-perm="'inventory:wave:create'" @click="openAdd">新建波次</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="rows" row-key="id" @row-click="openDetail">
        <el-table-column prop="waveNo" label="波次号" width="170" />
        <el-table-column prop="priority" label="优先级" width="110" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column prop="createdAt" label="创建时间" width="180" />
      </el-table>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
    </article>

    <el-dialog v-model="visible" title="新建拣货波次" width="820px">
      <el-form label-width="90px"><el-form-item label="优先级"><el-input-number v-model="form.priority" :min="0" /></el-form-item></el-form>
      <el-table :data="tasks" size="small">
        <el-table-column label="来源ID" width="130"><template #default="{ row }"><el-input v-model="row.sourceId" /></template></el-table-column>
        <el-table-column label="产品ID" width="130"><template #default="{ row }"><el-input v-model="row.productId" /></template></el-table-column>
        <el-table-column label="仓库ID" width="130"><template #default="{ row }"><el-input v-model="row.warehouseId" /></template></el-table-column>
        <el-table-column label="数量"><template #default="{ row }"><el-input v-model="row.qty" /></template></el-table-column>
        <el-table-column width="70"><template #default><el-button link type="danger" :disabled="tasks.length <= 1" @click="tasks.pop()">删</el-button></template></el-table-column>
      </el-table>
      <el-button class="add-line" @click="tasks.push({ sourceId: 0, productId: 0, warehouseId: 0, qty: '1' })">加行</el-button>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="拣货任务" width="860px">
      <el-table v-if="detail" :data="detail.tasks" size="small">
        <el-table-column prop="productId" label="产品ID" width="110" />
        <el-table-column prop="warehouseId" label="仓库ID" width="110" />
        <el-table-column prop="locationId" label="库位ID" width="110" />
        <el-table-column prop="qty" label="应拣量" width="110" />
        <el-table-column prop="pickedQty" label="已拣量" width="110" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column label="操作" width="100"><template #default="{ row }"><el-button link type="primary" :disabled="row.status === 'DONE'" @click="handlePick(row)">拣货</el-button></template></el-table-column>
      </el-table>
      <template #footer><el-button @click="detailVisible = false">关闭</el-button><el-button v-perm="'inventory:wave:view'" @click="loadPickPath">生成拣货路径</el-button><el-button type="primary" @click="handleComplete">完成波次</el-button></template>
    </el-dialog>

    <el-dialog v-model="pathVisible" title="拣货路径（蛇形排序）" width="720px">
      <el-descriptions v-if="pathResult" :column="2" border>
        <el-descriptions-item label="优化后距离">{{ pathResult.distance ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="原始距离">{{ pathResult.naiveDistance ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="节省距离">{{ pathResult.savedDistance ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="节省比例">{{ pathResult.savedRatio ?? 0 }}%</el-descriptions-item>
      </el-descriptions>
      <el-table v-if="pathResult" :data="(pathResult.order as Array<Record<string, unknown>>) ?? []" size="small" style="margin-top: 12px">
        <el-table-column prop="step" label="步骤" width="80" />
        <el-table-column prop="taskId" label="任务ID" width="100" />
        <el-table-column prop="locationCode" label="库位" width="140" />
        <el-table-column prop="aisle" label="巷道" width="100" />
        <el-table-column prop="rack" label="货架" width="90" />
        <el-table-column prop="level" label="层" width="80" />
        <el-table-column prop="qty" label="数量" width="100" />
      </el-table>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.add-line { margin-top: 12px; }
</style>
