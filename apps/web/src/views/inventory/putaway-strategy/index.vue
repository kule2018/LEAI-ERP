<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  completePutaway, createPutaway, createPutawayStrategy, fetchPutawayStrategies, fetchPutaways,
  recommendPutaway, type InventoryQuery, type Putaway, type PutawayStrategy
} from '@/api/inventory'

const rows = ref<Putaway[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<InventoryQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const form = reactive({ sourceType: 'PURCHASE_RECEIPT', sourceId: 0, warehouseId: 0, locationId: 0, strategyCode: 'FIFO' })
const strategies = ref<PutawayStrategy[]>([])
const strategyForm = reactive({ warehouseId: 0, strategyName: '', ruleType: 'ZONE', priority: 1, ruleValue: '' })
const recommendForm = reactive({
  warehouseId: 0, productId: 0, locationId: 0, temperatureZone: '', volume: 0, weight: 0, turnoverDays: 0, batchNo: ''
})
const recommendResult = ref<Record<string, unknown> | null>(null)
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchPutaways(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
async function loadStrategies(): Promise<void> {
  try { strategies.value = await fetchPutawayStrategies({ page: 1, pageSize: 100 }) }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '加载失败') }
}
async function saveStrategy(): Promise<void> {
  try { await createPutawayStrategy({ ...strategyForm }); ElMessage.success('策略已保存'); await loadStrategies() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
async function runRecommend(): Promise<void> {
  try { recommendResult.value = await recommendPutaway({ ...recommendForm }); ElMessage.success('推荐完成') }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '推荐失败') }
}
function openAdd(): void { Object.assign(form, { sourceType: 'PURCHASE_RECEIPT', sourceId: 0, warehouseId: 0, locationId: 0, strategyCode: 'FIFO' }); visible.value = true }
async function save(): Promise<void> {
  try { await createPutaway({ ...form }); visible.value = false; ElMessage.success('上架任务已创建'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
async function complete(row: unknown): Promise<void> {
  const putaway = row as Putaway
  try { await completePutaway(putaway.id); ElMessage.success('上架已完成'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '操作失败') }
}
function handlePage(value: number): void { query.value.page = value; void load() }
onMounted(() => { load(); void loadStrategies() })
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>上架策略</h2><p>按收货来源生成上架任务，FIFO、FEFO、就近策略写入任务后由仓库执行。</p></header>
    <article class="panel">
      <div class="toolbar">
        <el-button type="primary" v-perm="'inventory:putaway:create'" @click="openAdd">新建上架任务</el-button>
        <el-button @click="load">刷新</el-button>
      </div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="sourceType" label="来源类型" width="160" />
        <el-table-column prop="sourceId" label="来源ID" width="110" />
        <el-table-column prop="warehouseId" label="仓库ID" width="110" />
        <el-table-column prop="locationId" label="库位ID" width="110" />
        <el-table-column prop="strategyCode" label="策略" width="120" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column label="操作" width="100"><template #default="{ row }"><el-button link type="primary" v-perm="'inventory:putaway:update'" @click="complete(row)">完成</el-button></template></el-table-column>
      </el-table>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
    </article>
    <el-dialog v-model="visible" title="新建上架任务" width="520px">
      <el-form label-width="100px">
        <el-form-item label="来源类型"><el-input v-model="form.sourceType" /></el-form-item>
        <el-form-item label="来源ID"><el-input-number v-model="form.sourceId" :min="1" /></el-form-item>
        <el-form-item label="仓库ID"><el-input-number v-model="form.warehouseId" :min="1" /></el-form-item>
        <el-form-item label="库位ID"><el-input-number v-model="form.locationId" :min="1" /></el-form-item>
        <el-form-item label="策略">
          <el-select v-model="form.strategyCode"><el-option label="FIFO" value="FIFO" /><el-option label="FEFO" value="FEFO" /><el-option label="就近" value="NEAREST" /></el-select>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>

    <article class="panel" style="margin-top: 16px">
      <h3>上架策略规则</h3>
      <el-form label-width="100px" style="max-width: 720px">
        <el-form-item label="仓库 ID"><el-input-number v-model="strategyForm.warehouseId" :min="0" /></el-form-item>
        <el-form-item label="策略名称"><el-input v-model="strategyForm.strategyName" /></el-form-item>
        <el-form-item label="规则类型">
          <el-select v-model="strategyForm.ruleType">
            <el-option label="温区" value="TEMPERATURE" />
            <el-option label="批次隔离" value="BATCH" />
            <el-option label="库区" value="ZONE" />
            <el-option label="体积" value="VOLUME" />
            <el-option label="周转" value="TURNOVER" />
            <el-option label="承重" value="WEIGHT" />
          </el-select>
        </el-form-item>
        <el-form-item label="优先级"><el-input-number v-model="strategyForm.priority" :min="1" /></el-form-item>
        <el-form-item label="规则值"><el-input v-model="strategyForm.ruleValue" placeholder="如 FAST / SEPARATE / 100" /></el-form-item>
      </el-form>
      <el-button type="primary" v-perm="'inventory:putaway:create'" @click="saveStrategy">保存策略</el-button>
      <el-table :data="strategies" size="small" style="margin-top: 12px">
        <el-table-column prop="strategyName" label="策略名称" min-width="150" />
        <el-table-column prop="warehouseId" label="仓库 ID" width="110" />
        <el-table-column prop="ruleType" label="规则类型" width="120" />
        <el-table-column prop="priority" label="优先级" width="100" />
        <el-table-column prop="ruleValue" label="规则值" width="140" />
        <el-table-column prop="status" label="状态" width="100" />
      </el-table>
    </article>

    <article class="panel" style="margin-top: 16px">
      <h3>库位推荐</h3>
      <el-form label-width="100px" style="max-width: 720px">
        <el-form-item label="仓库 ID"><el-input-number v-model="recommendForm.warehouseId" :min="1" /></el-form-item>
        <el-form-item label="产品 ID"><el-input-number v-model="recommendForm.productId" :min="1" /></el-form-item>
        <el-form-item label="温区"><el-input v-model="recommendForm.temperatureZone" placeholder="如 COLD" /></el-form-item>
        <el-form-item label="体积"><el-input-number v-model="recommendForm.volume" :min="0" /></el-form-item>
        <el-form-item label="重量"><el-input-number v-model="recommendForm.weight" :min="0" /></el-form-item>
        <el-form-item label="周转天数"><el-input-number v-model="recommendForm.turnoverDays" :min="0" /></el-form-item>
      </el-form>
      <el-button type="primary" v-perm="'inventory:putaway:view'" @click="runRecommend">推荐库位</el-button>
      <el-descriptions v-if="recommendResult" :column="2" border style="margin-top: 12px">
        <el-descriptions-item label="命中库位">
          {{ (recommendResult.matched as Record<string, unknown>)?.locationId ?? '无' }}
        </el-descriptions-item>
        <el-descriptions-item label="匹配规则">
          {{ (recommendResult.matched as Record<string, unknown>)?.ruleType ?? '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="策略条数">{{ recommendResult.strategyCount ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="候选库位">
          {{ ((recommendResult.candidates as Array<Record<string, unknown>>) ?? []).length }}
        </el-descriptions-item>
      </el-descriptions>
    </article>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
