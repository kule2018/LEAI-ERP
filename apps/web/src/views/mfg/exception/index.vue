<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { closeException, createException, fetchExceptions, type ManufacturingQuery, type ProductionException } from '@/api/manufacturing'

const rows = ref<ProductionException[]>([])
const total = ref(0)
const loading = ref(false)
const query = ref<ManufacturingQuery>({ page: 1, pageSize: 20, keyword: '' })
const visible = ref(false)
const closeVisible = ref(false)
const selected = ref<ProductionException | null>(null)
const form = reactive({ exceptionType: '', workOrderId: 0, reason: '' })
const closeForm = reactive({ closedNote: '' })
let seq = 0

async function load(): Promise<void> {
  const current = ++seq
  loading.value = true
  try {
    const result = await fetchExceptions(query.value)
    if (current !== seq) return
    rows.value = result.list
    total.value = result.total
  } finally { if (current === seq) loading.value = false }
}
function openAdd(): void { Object.assign(form, { exceptionType: '', workOrderId: 0, reason: '' }); visible.value = true }
async function save(): Promise<void> {
  try { await createException({ ...form, workOrderId: form.workOrderId || undefined }); visible.value = false; ElMessage.success('异常已登记'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '保存失败') }
}
function openClose(row: unknown): void { selected.value = row as ProductionException; closeForm.closedNote = ''; closeVisible.value = true }
async function handleClose(): Promise<void> {
  if (!selected.value) return
  try { await closeException(selected.value.id, closeForm.closedNote); closeVisible.value = false; ElMessage.success('异常已关闭'); await load() }
  catch (cause) { ElMessage.error(cause instanceof Error ? cause.message : '关闭失败') }
}
function handlePage(value: number): void { query.value.page = value; void load() }
onMounted(load)
onUnmounted(() => { seq += 1 })
</script>

<template>
  <section class="page-container">
    <header class="page-header"><h2>生产异常</h2><p>缺料、设备、质量、人员异常登记和关闭记录。</p></header>
    <article class="panel">
      <div class="toolbar"><el-button type="primary" v-perm="'mfg:exception:create'" @click="openAdd">登记异常</el-button><el-button @click="load">刷新</el-button></div>
      <el-table v-loading="loading" :data="rows" row-key="id">
        <el-table-column prop="exceptionNo" label="异常单号" width="170" />
        <el-table-column prop="exceptionType" label="类型" width="130" />
        <el-table-column prop="workOrderId" label="工单ID" width="110" />
        <el-table-column prop="reason" label="原因" min-width="180" />
        <el-table-column prop="status" label="状态" width="110" />
        <el-table-column prop="closedNote" label="关闭说明" min-width="180" />
        <el-table-column label="操作" width="100"><template #default="{ row }"><el-button link type="primary" :disabled="row.status === 'CLOSED'" v-perm="'mfg:exception:close'" @click="openClose(row)">关闭</el-button></template></el-table-column>
      </el-table>
      <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="handlePage" />
    </article>
    <el-dialog v-model="visible" title="登记生产异常" width="520px">
      <el-form label-width="90px">
        <el-form-item label="异常类型"><el-input v-model="form.exceptionType" placeholder="缺料/设备/质量/人员" /></el-form-item>
        <el-form-item label="工单ID"><el-input-number v-model="form.workOrderId" :min="0" /></el-form-item>
        <el-form-item label="原因"><el-input v-model="form.reason" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="visible = false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
    <el-dialog v-model="closeVisible" title="关闭生产异常" width="520px">
      <el-form label-width="90px"><el-form-item label="关闭说明"><el-input v-model="closeForm.closedNote" type="textarea" :rows="3" /></el-form-item></el-form>
      <template #footer><el-button @click="closeVisible = false">取消</el-button><el-button type="primary" @click="handleClose">确认关闭</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.panel { padding: 16px; background: #fff; border-radius: 8px; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
</style>
